import assert from 'node:assert/strict'
import {execFile, execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {once} from 'node:events'
import {createReadStream} from 'node:fs'
import fs from 'node:fs/promises'
import {createServer} from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {promisify} from 'node:util'
import {_electron as electron, chromium, expect} from '@playwright/test'

const execute = promisify(execFile)
const {platform, arch} = process
const form = process.argv[2]
const {version} = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'))
const previous = '1.6.99'
const forms = {win32: ['setup', 'portable'], darwin: ['dmg'], linux: ['deb', 'appimage']}
assert.ok(forms[platform]?.includes(form), 'Pass the native package form: setup, portable, dmg, deb, or appimage')
const evidence = path.resolve(process.env.MARGIN_EVIDENCE || 'acceptance')
const baseline = path.resolve('release/upgrade-baseline')
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-upgrade-'))
const profile = path.join(temp, 'profile')
const downloads = path.join(temp, 'downloads')
const draft = 'Draft preserved through upgrade 中.'
const cleanFile = path.join(temp, 'clean-notes.txt')
const dirtyFile = path.join(temp, 'dirty-notes.txt')
const cleanText = 'Saved document with CRLF.'
const savedText = 'Untouched disk contents.'
const dirtyText = 'Unsaved changes to the file 中.'
const api = 'https://api.github.com/repos/peterwangze/margin-editor/releases/latest'
const repository = 'https://github.com/peterwangze/margin-editor'
const assetSuffix = {
  setup: `win-${arch}-setup.exe`,
  portable: `win-${arch}-portable.exe`,
  dmg: `mac-${arch}.dmg`,
  deb: `linux-${arch === 'x64' ? 'amd64' : arch}.deb`,
  appimage: `linux-${arch === 'x64' ? 'x86_64' : arch}.AppImage`,
}[form]
const assetName = `Margin-${version}-${assetSuffix}`
const candidate = path.resolve('release', assetName)
const oldPackage = path.join(baseline, `Margin-${previous}-${assetSuffix}`)
const resultFile = path.join(profile, 'update-install-result.json')
const readyFile = path.join(profile, 'update-install-ready.json')
const setupTarget = path.join(temp, 'Margin Install')
const packageName = 'margin-editor'
let app
let restartedBrowser
let oldPid
let newPid
let installedLegacyDeb = false
let oldTarget

function powerShell(script, extraEnv) {
  return execute('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: {...process.env, ...extraEnv}, timeout: 120000, windowsHide: true,
  })
}

async function unpacked(root, prefix, filename) {
  const entries = await fs.readdir(root, {withFileTypes: true})
  const directory = entries.find(entry => entry.isDirectory() && entry.name.startsWith(prefix) && entry.name.endsWith('-unpacked'))
  assert.ok(directory, `No unpacked ${prefix} fixture in ${root}`)
  return path.join(root, directory.name, filename)
}

async function macBundle(root) {
  const entries = await fs.readdir(root, {withFileTypes: true})
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('mac')) continue
    const bundle = path.join(root, entry.name, 'Margin.app')
    if ((await fs.stat(bundle).catch(() => null))?.isDirectory()) return bundle
  }
  throw new Error('Missing packaged macOS fixture')
}

async function installBaseline() {
  if (form === 'setup') {
    await powerShell(
      '$p = Start-Process -FilePath $env:MARGIN_BASELINE_SETUP -ArgumentList "/S", ("/D=" + $env:MARGIN_BASELINE_TARGET) -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode',
      {MARGIN_BASELINE_SETUP: oldPackage, MARGIN_BASELINE_TARGET: setupTarget},
    )
    oldTarget = path.join(setupTarget, 'Margin.exe')
    return {executable: oldTarget, env: {}}
  }
  if (form === 'portable') {
    oldTarget = path.join(temp, 'Margin Portable.exe')
    await fs.copyFile(oldPackage, oldTarget)
    return {
      executable: await unpacked(baseline, 'win', 'Margin.exe'),
      env: {PORTABLE_EXECUTABLE_FILE: oldTarget, PORTABLE_EXECUTABLE_DIR: temp},
    }
  }
  if (form === 'dmg') {
    await fs.mkdir(path.join(temp, 'Applications'))
    const destination = path.join(temp, 'Applications', 'Margin.app')
    await execute('ditto', [await macBundle(baseline), destination], {timeout: 60000})
    oldTarget = path.join(destination, 'Contents', 'MacOS', 'Margin')
    return {executable: oldTarget, env: {}}
  }
  if (form === 'deb') {
    const previousStatus = await execute('dpkg-query', ['-W', '-f=${db:Status-Status}', packageName]).catch(() => null)
    assert.notEqual(previousStatus?.stdout.trim(), 'installed', 'Upgrade fixture requires a clean runner')
    installedLegacyDeb = true
    await execute('sudo', ['-n', 'dpkg', '--install', oldPackage], {timeout: 120000})
    oldTarget = '/opt/Margin/margin'
    return {executable: oldTarget, env: {}}
  }
  oldTarget = path.join(temp, 'Margin.AppImage')
  await fs.copyFile(oldPackage, oldTarget)
  await fs.chmod(oldTarget, 0o755)
  return {
    executable: oldTarget,
    env: {APPIMAGE_EXTRACT_AND_RUN: '1'},
  }
}

async function digest(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

function processExists(pid) {
  try { process.kill(pid, 0); return true }
  catch (error) { if (error.code === 'ESRCH') return false; throw error }
}

function stopProcess(pid) {
  if (!pid || !processExists(pid)) return
  if (platform === 'win32') {
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore', timeout: 7000}) }
    catch (error) { if (processExists(pid)) throw error }
  } else {
    try { process.kill(pid, 'SIGKILL') }
    catch (error) { if (error.code !== 'ESRCH') throw error }
  }
}

async function inspectCandidate(sha) {
  const assets = path.dirname(candidate)
  if (form === 'setup' || form === 'portable') {
    const {stdout} = await powerShell(
      '$p = Get-Process -Id ([int]$env:MARGIN_RESTART_PID) -ErrorAction Stop; $p.Path; (Get-Item -LiteralPath $p.Path).VersionInfo.FileVersion',
      {MARGIN_RESTART_PID: String(newPid)},
    )
    const [exe, currentVersion] = stdout.trim().split(/\r?\n/)
    assert.equal(currentVersion, version)
    if (form === 'setup') {
      assert.equal(path.normalize(exe).toLowerCase(), path.normalize(oldTarget).toLowerCase())
    } else {
      assert.equal(path.basename(exe).toLowerCase(), 'margin.exe')
      assert.equal(await digest(oldTarget), sha, 'Relaunched portable outer EXE contains the release bytes')
    }
    const candidateExe = await unpacked(assets, 'win', 'Margin.exe')
    assert.equal(await digest(path.join(path.dirname(exe), 'resources', 'app.asar')),
      await digest(path.join(path.dirname(candidateExe), 'resources', 'app.asar')))
    const file = await fs.open(exe)
    try {
      const header = Buffer.alloc(8)
      await file.read(header, 0, 4, 0x3c)
      const offset = header.readUInt32LE()
      await file.read(header, 0, 6, offset)
      assert.equal(header.readUInt32LE(), 0x4550)
      assert.equal(header.readUInt16LE(4), arch === 'arm64' ? 0xaa64 : 0x8664)
    } finally { await file.close() }
  } else if (form === 'dmg') {
    const bundle = path.dirname(path.dirname(path.dirname(oldTarget)))
    const info = path.join(bundle, 'Contents', 'Info.plist')
    assert.equal((await execute('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', info])).stdout.trim(), version)
    assert.equal((await execute('lipo', ['-archs', oldTarget])).stdout.trim(), arch === 'x64' ? 'x86_64' : arch)
    await execute('codesign', ['--verify', '--deep', '--strict', bundle], {timeout: 30000})
    assert.equal(await digest(path.join(bundle, 'Contents', 'Resources', 'app.asar')),
      await digest(path.join(await macBundle(assets), 'Contents', 'Resources', 'app.asar')))
    const command = (await execute('ps', ['-p', String(newPid), '-o', 'command='])).stdout.trim()
    assert.ok(command.includes(oldTarget) || command.includes(await fs.realpath(oldTarget)), 'Running app should be inside the replaced bundle')
  } else if (form === 'deb') {
    const {stdout} = await execute('dpkg-query', ['-W', '-f=${db:Status-Status} ${Version} ${Architecture}', packageName])
    assert.equal(stdout.trim(), `installed ${version} ${arch === 'x64' ? 'amd64' : arch}`)
    assert.equal(await fs.readlink(`/proc/${newPid}/exe`), await fs.realpath(oldTarget))
    const candidateExe = await unpacked(assets, 'linux', 'margin')
    assert.equal(await digest(path.join(path.dirname(oldTarget), 'resources', 'app.asar')),
      await digest(path.join(path.dirname(candidateExe), 'resources', 'app.asar')))
  } else {
    const exe = await fs.readlink(`/proc/${newPid}/exe`)
    assert.equal(path.basename(exe), 'margin')
    assert.equal(await digest(oldTarget), sha, 'The current AppImage contains the release bytes')
    assert.ok((await fs.stat(oldTarget)).mode & 0o100, 'Replacement AppImage remains executable')
  }
}

async function getPort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const {port} = server.address()
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}

async function json(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function settings(page) {
  await page.getByRole('button', {name: 'Settings', exact: true}).click()
  await page.getByRole('button', {name: /^Preferences/}).click()
  return page.getByRole('dialog', {name: 'Settings', exact: true})
}

const url = `${repository}/releases/download/v${version}/${assetName}`
const cdn = 'https://release-assets.githubusercontent.com/margin-upgrade-fixture'

async function configureFetch(release) {
  return app.evaluate(({app: instance}, fixture) => {
    instance.setPath('downloads', fixture.downloads)
    const {createReadStream} = process.getBuiltinModule('node:fs')
    const {Readable} = process.getBuiltinModule('node:stream')
    globalThis.marginFixtureMode = 'broken'
    globalThis.fetch = async requested => {
      const target = String(requested)
      if (target === fixture.api) {
        return Response.json({
          tag_name: `v${fixture.version}`, draft: false, prerelease: false,
          body: 'Release fixture for a packaged upgrade.', assets: [fixture.asset],
        })
      }
      if (target === fixture.asset.browser_download_url) return Response.redirect(fixture.cdn)
      if (target === fixture.cdn) {
        if (globalThis.marginFixtureMode === 'broken') return new Response('wrong bytes')
        return new Response(Readable.toWeb(createReadStream(fixture.candidate)))
      }
      throw new Error(`Unexpected fixture request to ${target}`)
    }
    return {pid: process.pid, version: instance.getVersion()}
  }, {api, cdn, candidate, downloads, version, asset: release})
}

try {
  await fs.mkdir(evidence, {recursive: true})
  await fs.mkdir(downloads)
  await fs.mkdir(profile)
  await fs.writeFile(cleanFile, cleanText + '\r\n')
  await fs.writeFile(dirtyFile, savedText + '\r\n')
  const {executable, env} = await installBaseline()
  const [sha, {size}, originalSha, port] = await Promise.all([
    digest(candidate), fs.stat(candidate), digest(oldTarget), getPort(),
  ])
  const args = [`--remote-debugging-port=${port}`, '--disable-background-networking', '--proxy-server=http://127.0.0.1:9', cleanFile, dirtyFile]
  app = await electron.launch({
    executablePath: executable, args, timeout: 50000,
    env: {...process.env, ...env, MARGIN_PROFILE: profile, MARGIN_TEST_LOCALE: 'en-US'},
  })
  const mainErrors = []
  app.on('console', message => {
    if (message.type() === 'error') mainErrors.push(message.text())
  })
  const initial = await configureFetch({name: assetName, state: 'uploaded', size, digest: `sha256:${sha}`, browser_download_url: url})
  oldPid = initial.pid
  assert.equal(initial.version, previous)
  const page = await app.firstWindow({timeout: 20000})
  const editor = page.getByRole('textbox', {name: 'Document editor', exact: true})
  await expect(page.getByRole('button', {name: `About Margin v${previous}`, exact: true})).toBeVisible()
  await page.getByRole('tab', {name: 'clean-notes.txt', exact: true}).click()
  await expect(editor).toHaveText(cleanText)
  await page.getByRole('tab', {name: 'dirty-notes.txt', exact: true}).click()
  await expect(editor).toHaveText(savedText)
  await editor.focus()
  await page.keyboard.press(`${platform === 'darwin' ? 'Meta' : 'Control'}+a`)
  await page.keyboard.insertText(dirtyText)
  await expect(page.getByRole('tab', {name: 'dirty-notes.txt Unsaved', exact: true})).toBeVisible()
  await page.getByRole('button', {name: 'New document', exact: true}).click()
  await editor.focus()
  await page.keyboard.insertText(draft)
  await expect(editor).toHaveText(draft)
  const beforeSettings = await settings(page)
  await beforeSettings.getByLabel('Appearance').selectOption('dark')
  await beforeSettings.getByLabel('Interface language').selectOption('en')
  await beforeSettings.getByRole('checkbox', {name: 'Restore session on launch', exact: true}).uncheck()
  await page.keyboard.press('Escape')
  await expect.poll(async () => {
    const normal = await json(path.join(profile, 'session.json'))
    return {count: normal?.docs?.length, recover: normal?.settings?.recover}
  }).toEqual({count: 0, recover: false})
  await page.getByRole('button', {name: 'Help', exact: true}).click()
  await page.getByRole('button', {name: 'Check for updates', exact: true}).click()
  const update = page.getByRole('dialog', {name: 'Check for updates', exact: true})
  await expect(update.getByText(assetName, {exact: true})).toBeVisible()
  await update.getByRole('button', {name: 'Download update', exact: true}).click()
  await expect(update.getByRole('alert')).toHaveText('Could not download the update.')
  assert.deepEqual(await fs.readdir(downloads), [])
  assert.ok(processExists(oldPid))
  assert.equal(await digest(oldTarget), originalSha)
  await expect(editor).toHaveText(draft)

  await app.evaluate(() => { globalThis.marginFixtureMode = 'valid' })
  await update.getByRole('button', {name: 'Try again', exact: true}).click()
  const install = update.getByRole('button', {name: 'Install and restart', exact: true})
  await expect(install).toBeEnabled({timeout: 60000})
  const verified = path.join(downloads, assetName)
  assert.equal(await digest(verified), sha)
  await fs.truncate(verified, 1)
  await install.click()
  await expect(update.getByRole('alert')).toHaveText('Could not start the installation. Your documents are still open.')
  assert.ok(processExists(oldPid))
  assert.equal(await digest(oldTarget), originalSha)
  await expect(editor).toHaveText(draft)
  assert.equal(await json(resultFile), null)
  await fs.unlink(verified)
  await page.keyboard.press('Escape')
  await page.getByRole('button', {name: 'Help', exact: true}).click()
  await page.getByRole('button', {name: 'Check for updates', exact: true}).click()
  await update.getByRole('button', {name: 'Download update', exact: true}).click()
  await expect(install).toBeEnabled({timeout: 60000})
  assert.equal(await digest(verified), sha)
  console.log(`${form}: ${previous} downloaded and verified ${assetName}; starting native install`)
  await install.click({noWaitAfter: true})

  const address = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 95000
  while (processExists(oldPid)) {
    const message = await update.getByRole('alert').textContent({timeout: 350}).catch(() => null)
    if (message) throw new Error(`${form}: ${message}\n${mainErrors.slice(-2).join('\n')}`)
    assert.ok(Date.now() < deadline, `${form}: the original application did not exit after installation was requested`)
    await delay(250)
  }
  try {
    await expect.poll(async () => {
      const ready = await json(readyFile)
      if (ready?.version === version && Number.isSafeInteger(ready.pid)) newPid = ready.pid
      try { return (await fetch(`${address}/json/version`, {signal: AbortSignal.timeout(350)})).ok }
      catch { return false }
    }, {timeout: 120000}).toBe(true)
  } catch (error) {
    const result = await json(resultFile).catch(() => null)
    const ready = await json(readyFile).catch(() => null)
    const database = form === 'deb'
      ? (await execute('dpkg-query', ['-W', '-f=${db:Status-Status} ${Version} ${Architecture}', packageName]).catch(() => null))?.stdout.trim()
      : undefined
    throw new Error(`${form}: application did not restart (${JSON.stringify({
      status: result?.status, version: result?.version, message: result?.message, diagnostic: result?.diagnostic,
      readyVersion: ready?.version, readyPid: ready?.pid, database,
    })})`, {cause: error})
  }
  restartedBrowser = await chromium.connectOverCDP(address, {timeout: 15000})
  const browserSession = await restartedBrowser.newBrowserCDPSession()
  const {processInfo} = await browserSession.send('SystemInfo.getProcessInfo')
  const actualPid = processInfo.find(item => item.type === 'browser')?.id
  assert.ok(Number.isSafeInteger(actualPid) && actualPid > 0 && actualPid !== oldPid)
  if (newPid) assert.equal(actualPid, newPid)
  newPid = actualPid
  const context = restartedBrowser.contexts()[0]
  const next = context.pages()[0] ?? await context.waitForEvent('page', {timeout: 20000})
  const restoredEditor = next.getByRole('textbox', {name: 'Document editor', exact: true})
  await expect(next.getByRole('button', {name: `About Margin v${version}`, exact: true})).toBeVisible({timeout: 20000})
  await expect(restoredEditor).toHaveText(draft, {timeout: 20000})
  await expect(next.locator('html')).toHaveAttribute('data-theme', 'dark')
  await next.getByRole('tab', {name: 'clean-notes.txt', exact: true}).click()
  await expect(restoredEditor).toHaveText(cleanText)
  await next.getByRole('tab', {name: 'dirty-notes.txt Unsaved', exact: true}).click()
  await expect(restoredEditor).toHaveText(dirtyText)
  assert.equal(await fs.readFile(cleanFile, 'utf8'), cleanText + '\r\n')
  assert.equal(await fs.readFile(dirtyFile, 'utf8'), savedText + '\r\n')
  const restoredSettings = await settings(next)
  await expect(restoredSettings.getByLabel('Appearance')).toHaveValue('dark')
  await expect(restoredSettings.getByLabel('Interface language')).toHaveValue('en')
  await expect(restoredSettings.getByRole('checkbox', {name: 'Restore session on launch', exact: true})).not.toBeChecked()
  await next.keyboard.press('Escape')
  await expect.poll(async () => {
    const normal = await json(path.join(profile, 'session.json'))
    const oneTime = await json(path.join(profile, 'update-session.json'))
    return {count: normal?.docs?.length, recover: normal?.settings?.recover, oneTime}
  }, {timeout: 15000}).toEqual({count: 0, recover: false, oneTime: null})
  await expect.poll(async () => (await json(resultFile))?.status, {timeout: 20000}).toBe('installed')
  assert.equal((await json(resultFile)).version, version)
  await inspectCandidate(sha)
  await next.screenshot({path: path.join(evidence, `upgrade-${form}.png`), animations: 'disabled'})
  await fs.writeFile(path.join(evidence, `upgrade-${form}.json`), JSON.stringify({
    platform, arch, form, previous, version, assetName, sha256: sha,
    failedDownloadPreservedOriginal: true, tamperedPackagePreservedOriginal: true, verifiedDownload: true,
    newProcess: true, nativeInstallation: true, restoredDraft: true, restoredFiles: true,
    restoredSettings: true, oneTimeRecovery: true,
  }, null, 2) + '\n')
  console.log(`${form}: restarted after native install, version ${version} and draft verified`)
} finally {
  if (!newPid) newPid = (await json(readyFile).catch(() => null))?.pid
  try {
    stopProcess(newPid)
    stopProcess(oldPid || app?.process().pid)
    if (restartedBrowser) await Promise.race([
      restartedBrowser.close().catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 2000).unref()),
    ])
    if (form === 'setup') {
      const items = await fs.readdir(setupTarget).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
      const removal = items.find(name => /^Uninstall.*\.exe$/i.test(name))
      if (removal) {
        await powerShell(
          '$p = Start-Process -FilePath $env:MARGIN_BASELINE_UNINSTALL -ArgumentList "/S" -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode',
          {MARGIN_BASELINE_UNINSTALL: path.join(setupTarget, removal)},
        )
      }
    }
    if (installedLegacyDeb) await execute('sudo', ['-n', 'dpkg', '--remove', packageName], {timeout: 60000})
  } finally {
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 10, retryDelay: 400})
  }
}
