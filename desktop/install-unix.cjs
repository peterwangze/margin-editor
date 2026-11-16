const {execFile, spawn} = require('node:child_process')
const {createHash, randomUUID} = require('node:crypto')
const {once} = require('node:events')
const fs = require('node:fs/promises')
const {constants, createWriteStream} = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {Transform} = require('node:stream')
const {pipeline} = require('node:stream/promises')
const {setTimeout: delay} = require('node:timers/promises')
const {promisify} = require('node:util')

const exec = promisify(execFile)
const bundleId = 'io.github.peterwangze.margin'
const packageName = 'margin-editor'
const dpkg = '/usr/bin/dpkg'
const dpkgDeb = '/usr/bin/dpkg-deb'
const dpkgQuery = '/usr/bin/dpkg-query'
const sudo = '/usr/bin/sudo'
const pkexec = '/usr/bin/pkexec'
const packageStatusArgs = ['-W', '-f=${db:Status-Status} ${Version}', packageName]
const checksumError = 'The update download did not match its published checksum or size.'

async function statOrMissing(file) {
  try { return await fs.lstat(file) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

function sameFile(a, b) {
  return a?.dev === b.dev && a.ino === b.ino
}

async function run(program, args, options = {}) {
  const {stdout} = await exec(program, args, {timeout: 120000, maxBuffer: 1024 * 1024, ...options})
  return stdout.trim()
}

async function canExecute(file) {
  try { await fs.access(file, constants.X_OK); return true }
  catch { return false }
}

async function copyVerifiedDownload(source, destination, size, digest) {
  const input = await fs.open(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    const info = await input.stat()
    if (!info.isFile() || info.size !== size) throw new Error(checksumError)
    const hash = createHash('sha256')
    let copied = 0
    const verify = new Transform({
      transform(chunk, _, done) {
        copied += chunk.length
        if (copied > size) return done(new Error(checksumError))
        hash.update(chunk)
        done(null, chunk)
      },
    })
    await pipeline(input.createReadStream({autoClose: false}), verify,
      createWriteStream(destination, {flags: 'wx', mode: 0o600}))
    if (copied !== size || hash.digest('hex') !== digest.toLowerCase()) throw new Error(checksumError)
  } finally {
    await input.close()
  }
}

async function verifyDmgBundle(bundle, version) {
  const plist = path.join(bundle, 'Contents', 'Info.plist')
  const property = key => run('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist])
  const [identifier, shortVersion, executable] = await Promise.all([
    property('CFBundleIdentifier'), property('CFBundleShortVersionString'), property('CFBundleExecutable'),
  ])
  if (identifier !== bundleId || shortVersion !== version || executable !== 'Margin') {
    throw new Error('The update does not contain the expected Margin application.')
  }
  if (!await canExecute(path.join(bundle, 'Contents', 'MacOS', executable))) {
    throw new Error('The update does not contain the expected Margin application.')
  }
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
}

async function stageMac(asset, work, latestVersion) {
  const mount = path.join(work, 'mount')
  const staged = path.join(work, 'Margin.app')
  await fs.mkdir(mount)
  await run('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, asset])
  try {
    await run('/usr/bin/ditto', [path.join(mount, 'Margin.app'), staged])
    await verifyDmgBundle(staged, latestVersion)
  } finally {
    try { await run('/usr/bin/hdiutil', ['detach', mount]) }
    catch { await run('/usr/bin/hdiutil', ['detach', '-force', mount]) }
  }
  return staged
}

async function stageAppImage(staged, mode) {
  const handle = await fs.open(staged, 'r')
  try {
    const header = Buffer.alloc(20)
    const {bytesRead} = await handle.read(header)
    const architecture = header.readUInt16LE(18)
    if (bytesRead < header.length || !header.subarray(0, 7).equals(Buffer.from([127, 69, 76, 70, 2, 1, 1])) ||
      !header.subarray(8, 11).equals(Buffer.from([65, 73, 2])) || architecture !== {x64: 62, arm64: 183}[process.arch]) {
      throw new Error('The update does not contain a matching AppImage.')
    }
  } finally {
    await handle.close()
  }
  await fs.chmod(staged, (mode & 0o777) | 0o100)
}

async function stageDeb(staged, target, latestVersion) {
  const [installedPackage, originalStatus, name, version, arch, nativeArch] = await Promise.all([
    run(dpkgQuery, ['--search', target]),
    run(dpkgQuery, packageStatusArgs),
    run(dpkgDeb, ['--field', staged, 'Package']),
    run(dpkgDeb, ['--field', staged, 'Version']),
    run(dpkgDeb, ['--field', staged, 'Architecture']),
    run(dpkg, ['--print-architecture']),
  ])
  if (installedPackage !== `${packageName}: ${target}` || !originalStatus.startsWith('installed ') ||
    name !== packageName || version !== latestVersion || arch !== nativeArch) {
    throw new Error('The update does not match the installed Margin package.')
  }
  const args = ['--install', staged]
  if (process.getuid() === 0) return {file: dpkg, args, originalStatus}
  if (await canExecute(sudo)) {
    try {
      await run(sudo, ['-n', '-l', '--', dpkg, ...args], {timeout: 3000})
      return {file: sudo, args: ['-n', '--', dpkg, ...args], originalStatus}
    } catch { /* A desktop authorization agent can ask for permission. */ }
  }
  if (await canExecute(pkexec)) return {file: pkexec, args: ['--disable-internal-agent', dpkg, ...args], originalStatus}
  throw new Error('Administrator authorization is required to update this Linux package.')
}

function processExists(pid) {
  try { process.kill(pid, 0); return true }
  catch (error) { if (error.code === 'ESRCH') return false; throw error }
}

async function waitFor(check, milliseconds, message) {
  const deadline = Date.now() + milliseconds
  while (Date.now() < deadline) {
    if (await check()) return
    await delay(125)
  }
  throw new Error(message)
}

function relaunchEnvironment(env, profile) {
  const result = {...env, MARGIN_PROFILE: profile}
  delete result.ELECTRON_RUN_AS_NODE
  delete result.MARGIN_UPDATE_TOKEN
  // The AppImage runtime consumes --appimage-extract-and-run before launching Electron.
  if (env.APPIMAGE && env.APPDIR && /^appimage_extracted_[0-9a-f]+$/i.test(path.basename(env.APPDIR))) {
    result.APPIMAGE_EXTRACT_AND_RUN = '1'
  }
  if (env.APPDIR) {
    // AppRun prepends AppDir entries. The replacement's AppRun adds its own.
    for (const name of ['PATH', 'LD_LIBRARY_PATH', 'XDG_DATA_DIRS', 'GSETTINGS_SCHEMA_DIR']) {
      if (!result[name]) continue
      result[name] = result[name].split(':').filter(entry =>
        entry && entry !== env.APPDIR && !entry.startsWith(`${env.APPDIR}/`)).join(':')
      if (!result[name]) delete result[name]
    }
  }
  for (const name of ['APPDIR', 'APPIMAGE', 'ARGV0', 'OWD']) delete result[name]
  return result
}

async function launchApplication(executable, args, env) {
  const child = spawn(executable, args, {env, detached: true, stdio: 'ignore', cwd: os.homedir()})
  await once(child, 'spawn')
  child.unref()
  return child
}

async function stopReplacement(child) {
  if (!child?.pid) return
  // A relaunched AppImage can use a wrapper process. Stop its entire process group.
  const signal = value => {
    try { process.kill(-child.pid, value); return true }
    catch (error) { if (error.code === 'ESRCH') return false; throw error }
  }
  if (signal('SIGTERM')) {
    await delay(1000)
    signal('SIGKILL')
  }
}

async function writeResult(profile, version, status, diagnostic) {
  const temporary = path.join(profile, `.update-result-${randomUUID()}.json`)
  try {
    await fs.writeFile(temporary, JSON.stringify({status, version, diagnostic}), {flag: 'wx', mode: 0o600})
    await fs.rename(temporary, path.join(profile, 'update-install-result.json'))
  } finally {
    await fs.rm(temporary, {force: true})
  }
}

async function installReplacement(config) {
  const {kind, target, staged, original, executable, profile, latestVersion, relaunchArgs} = config
  if (!sameFile(await fs.lstat(target), original)) throw new Error('The installed application changed while preparing the update.')
  const stagedIdentity = await fs.lstat(staged)
  const backup = path.join(config.work, 'previous')
  if (kind === 'appimage') {
    try { await fs.link(target, backup) }
    catch (error) {
      if (!['ENOTSUP', 'EOPNOTSUPP', 'EPERM'].includes(error.code)) throw error
      await fs.copyFile(target, backup, constants.COPYFILE_EXCL)
    }
  } else await fs.rename(target, backup)

  let replaced = false
  let child
  const env = relaunchEnvironment(process.env, profile)
  const ready = path.join(profile, 'update-install-ready.json')
  const token = randomUUID()
  try {
    await fs.rename(staged, target)
    replaced = true
    child = await launchApplication(executable, relaunchArgs, {...env, MARGIN_UPDATE_TOKEN: token})
    await waitFor(async () => {
      try {
        const marker = JSON.parse(await fs.readFile(ready, 'utf8'))
        return marker.token === token && marker.version === latestVersion &&
          Number.isSafeInteger(marker.pid) && marker.pid > 0 && processExists(marker.pid)
      } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) return false
        throw error
      }
    }, 35000, 'The updated application did not finish starting.')
    await writeResult(profile, latestVersion, 'installed')
  } catch (error) {
    await stopReplacement(child)
    const current = await statOrMissing(target)
    if (current && !sameFile(current, replaced ? stagedIdentity : original)) {
      throw new Error('The application changed during installation. Its previous copy was retained.')
    }
    if (replaced && kind === 'mac' && current) await fs.rename(target, staged)
    if (replaced || !current) await fs.rename(backup, target)
    else if (kind === 'appimage') await fs.unlink(backup)
    throw error
  }
}

async function installDeb(config) {
  const {command, latestVersion, executable, profile} = config
  const env = relaunchEnvironment(process.env, profile)
  if (await run(dpkgQuery, packageStatusArgs) !== command.originalStatus || !sameFile(await fs.lstat(executable), config.original)) {
    throw new Error('The installed application changed while preparing the update.')
  }
  try {
    // The package manager must finish configuring the package before relaunch.
    await run(command.file, command.args, {timeout: 0, env})
    const metadata = await run(dpkgQuery, packageStatusArgs)
    if (metadata !== `installed ${latestVersion}` || !await canExecute(executable)) {
      throw new Error('The package manager could not verify the installed update.')
    }
  } catch (error) {
    if (command.file === pkexec && error.code === 126) return 'cancelled'
    throw error
  }
  return 'installed'
}

async function worker(configPath) {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
  const {work, profile, latestVersion, executable, oldPid, relaunchArgs} = config
  await fs.writeFile(path.join(work, 'helper-ready'), '', {flag: 'wx', mode: 0o600})
  try {
    await waitFor(() => !processExists(oldPid), 60000, 'The running application did not exit.')
  } catch {
    await fs.rm(work, {recursive: true, force: true})
    return
  }

  let status = 'failed'
  let diagnostic
  try {
    if (config.kind === 'deb') status = await installDeb(config)
    else { await installReplacement(config); status = 'installed' }
  } catch (error) {
    diagnostic = {phase: 'install', code: error.code ?? null}
    console.error(error.message)
  }
  if (config.kind === 'deb' || status !== 'installed') {
    await writeResult(profile, latestVersion, status, diagnostic ?? {phase: 'launching'})
    try {
      const child = await launchApplication(executable, relaunchArgs, relaunchEnvironment(process.env, profile))
      await writeResult(profile, latestVersion, status, {...(diagnostic ?? {phase: 'launched'}), pid: child.pid})
    } catch (error) {
      await writeResult(profile, latestVersion, 'failed', {phase: 'launch', code: error.code ?? null})
      throw error
    }
  }
  // If rollback was interrupted, preserve the original application for recovery.
  if (status === 'installed' || !await statOrMissing(path.join(work, 'previous'))) {
    await fs.rm(work, {recursive: true, force: true})
  }
}

async function prepareUnixInstall({assetPath, latestVersion, size, digest, platform = process.platform, execPath = process.execPath,
  env = process.env, oldPid = process.pid, relaunchArgs = [], profile}) {
  if (!path.isAbsolute(assetPath) || !path.isAbsolute(profile) || !/^\d+\.\d+\.\d+$/.test(latestVersion) ||
    !Number.isSafeInteger(size) || size <= 0 || typeof digest !== 'string' || !/^[0-9a-f]{64}$/i.test(digest) ||
    !Number.isSafeInteger(oldPid) || oldPid < 1) throw new Error('Invalid update installation details.')
  let kind, executable, target
  if (platform === 'darwin') {
    kind = 'mac'
    executable = await fs.realpath(execPath)
    target = path.dirname(path.dirname(path.dirname(executable)))
    if (path.extname(target) !== '.app' || executable !== path.join(target, 'Contents', 'MacOS', 'Margin')) {
      throw new Error('Install Margin in a writable Applications folder before updating.')
    }
  } else if (platform === 'linux' && env.APPIMAGE && path.isAbsolute(env.APPIMAGE)) {
    kind = 'appimage'
    executable = target = await fs.realpath(env.APPIMAGE)
  } else if (platform === 'linux' && /^\/opt\/Margin\/margin$/i.test(execPath)) {
    kind = 'deb'
    executable = target = await fs.realpath(execPath)
  } else {
    throw new Error('This application location does not support installing updates.')
  }
  const info = await fs.lstat(target)
  if (kind === 'mac' ? !info.isDirectory() : !info.isFile()) throw new Error('Could not locate the installed Margin application.')
  await fs.access(profile, constants.W_OK | constants.X_OK)
  const work = await fs.mkdtemp(path.join(kind === 'deb' ? os.tmpdir() : path.dirname(target), '.margin-install-'))
  let helperProcess
  async function cleanup() {
    if (helperProcess?.pid && helperProcess.exitCode === null && helperProcess.signalCode === null) {
      const exited = once(helperProcess, 'exit')
      helperProcess.kill()
      await Promise.race([exited, delay(2000, undefined, {ref: false})])
    }
    const mount = await statOrMissing(path.join(work, 'mount'))
    if (mount && mount.dev !== (await fs.lstat(work)).dev) return
    await fs.rm(work, {recursive: true, force: true, maxRetries: 3, retryDelay: 100})
  }
  try {
    const helper = path.join(work, 'install.cjs')
    const config = path.join(work, 'install.json')
    const details = {kind, target, executable, work, profile, oldPid, latestVersion, relaunchArgs, original: {dev: info.dev, ino: info.ino}}
    const verified = path.join(work, {mac: 'update.dmg', appimage: 'Margin.AppImage', deb: 'margin.deb'}[kind])
    await copyVerifiedDownload(assetPath, verified, size, digest)
    if (kind === 'mac') {
      details.staged = await stageMac(verified, work, latestVersion)
      await fs.unlink(verified)
    } else if (kind === 'appimage') {
      await stageAppImage(verified, info.mode)
      details.staged = verified
    } else details.command = await stageDeb(verified, target, latestVersion)
    await fs.writeFile(helper, await fs.readFile(__filename), {flag: 'wx', mode: 0o600})
    await fs.writeFile(config, JSON.stringify(details), {flag: 'wx', mode: 0o600})
    let starting
    async function startHelper() {
      const child = spawn(execPath, [helper, config], {env: {...env, ELECTRON_RUN_AS_NODE: '1'},
        cwd: work, stdio: 'ignore', detached: true})
      helperProcess = child
      try {
        await once(child, 'spawn')
        await waitFor(() => fs.access(path.join(work, 'helper-ready')).then(() => true, () => false),
          5000, 'Could not start the update installer.')
        child.unref()
      } catch (error) {
        child.kill()
        throw error
      }
    }
    return {start: () => starting ??= startHelper(), cleanup}
  } catch (error) {
    await cleanup()
    throw error
  }
}

if (require.main === module) {
  worker(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1 })
}

module.exports = {prepareUnixInstall}
