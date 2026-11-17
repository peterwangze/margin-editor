const {createHash, randomUUID} = require('node:crypto')
const fs = require('node:fs/promises')
const {constants, createReadStream} = require('node:fs')
const path = require('node:path')

const repository = 'peterwangze/margin-editor'
const latestUrl = `https://api.github.com/repos/${repository}/releases/latest`
const releaseAssets = new Set(['release-assets.githubusercontent.com', 'objects.githubusercontent.com'])
const stableTag = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const hashPattern = /^sha256:([0-9a-f]{64})$/i
const interruptedTransfer = /^net::ERR_(?:CONNECTION_(?:CLOSED|RESET|ABORTED)|NETWORK_CHANGED|TIMED_OUT|CONTENT_LENGTH_MISMATCH|INCOMPLETE_CHUNKED_ENCODING)$/

// The release is always stable. A prerelease of the same numeric version is older.
function compareToStable(current, latest) {
  const installed = versionPattern.exec(current)
  const published = versionPattern.exec(latest)
  if (!installed || !published || published[4]) throw new Error('Invalid update version.')
  for (let index = 1; index <= 3; index++) {
    const before = BigInt(installed[index])
    const after = BigInt(published[index])
    if (before !== after) return before < after ? -1 : 1
  }
  return installed[4] ? -1 : 0
}

function assetName(version, {platform, arch, env, execPath}) {
  if (arch !== 'x64' && arch !== 'arm64') return null
  const prefix = `Margin-${version}`
  if (platform === 'win32') {
    const portable = env.PORTABLE_EXECUTABLE_FILE || env.PORTABLE_EXECUTABLE_DIR
    return `${prefix}-win-${arch}-${portable ? 'portable' : 'setup'}.exe`
  }
  if (platform === 'darwin') return `${prefix}-mac-${arch}.dmg`
  if (platform === 'linux') {
    if (!env.APPIMAGE && /^\/opt\/Margin\/margin$/i.test(execPath)) {
      return `${prefix}-linux-${arch === 'x64' ? 'amd64' : 'arm64'}.deb`
    }
    return `${prefix}-linux-${arch === 'x64' ? 'x86_64' : 'arm64'}.AppImage`
  }
  return null
}

function readRelease(release, currentVersion, environment) {
  const latestVersion = typeof release?.tag_name === 'string' && stableTag.exec(release.tag_name)?.[1]
  if (!latestVersion || release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)) {
    throw new Error('Invalid GitHub release metadata.')
  }
  const order = compareToStable(currentVersion, latestVersion)
  const status = order < 0 ? 'available' : order === 0 ? 'current' : 'ahead'
  const notes = typeof release.body === 'string' ? release.body : ''
  const name = assetName(latestVersion, environment)
  const url = `https://github.com/${repository}/releases/download/${release.tag_name}/${name}`
  const assets = status === 'available' && name ? release.assets.filter(item => item?.name === name) : []
  const [asset] = assets
  const digest = assets.length === 1 && typeof asset.digest === 'string' ? hashPattern.exec(asset.digest)?.[1].toLowerCase() : null
  const downloadable = digest && asset.state === 'uploaded' && asset.browser_download_url === url &&
    Number.isSafeInteger(asset.size) && asset.size > 0
  return {
    result: {currentVersion, latestVersion, status, notes, asset: downloadable ? {name, size: asset.size} : null},
    download: downloadable ? {name, size: asset.size, digest, url} : null,
  }
}

function allowedRedirect(location) {
  try {
    const url = new URL(location)
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && releaseAssets.has(url.hostname)
  } catch {
    return false
  }
}

async function openResponse(fetch, url, {signal, download = false, range}) {
  const headers = {'User-Agent': 'Margin', Accept: download ? 'application/octet-stream' : 'application/vnd.github+json'}
  if (range) headers.Range = `bytes=${range.offset}-`
  let location = url
  for (let redirects = 0; redirects <= 3; redirects++) {
    let response
    try {
      response = await fetch(location, {
        redirect: 'manual', credentials: 'omit', signal, headers,
      })
    } catch {
      throw new Error(signal.aborted ? 'The update request timed out.' : 'Could not connect to the update server.')
    }
    if (response.body) {
      if (!range && response.status === 200) return response.body
      if (range && response.status === 206 &&
        response.headers.get('content-range') === `bytes ${range.offset}-${range.total - 1}/${range.total}`) return response.body
    }
    await response.body?.cancel().catch(() => {})
    if (![301, 302, 303, 307, 308].includes(response.status)) throw new Error('The update server returned an error.')
    location = response.headers.get('location')
    if (!download || !allowedRedirect(location)) break
  }
  throw new Error('The update server sent an unexpected redirect.')
}

async function readLatestRelease(fetch) {
  const signal = AbortSignal.timeout(15000)
  const body = await openResponse(fetch, latestUrl, {signal})
  const chunks = []
  let size = 0
  for await (const chunk of body) {
    signal.throwIfAborted()
    size += chunk.length
    if (size > 1024 * 1024) throw new Error('Invalid GitHub release metadata.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('Invalid GitHub release metadata.')
  }
}

async function publishDownload(temp, downloads, name) {
  const {name: stem, ext} = path.parse(name)
  for (let number = 1; number <= 1000; number++) {
    const destination = path.join(downloads, number === 1 ? name : `${stem} (${number})${ext}`)
    try {
      try {
        // A verified file becomes visible atomically on filesystems with hard
        // links. The exclusive copy fallback also preserves an existing file.
        await fs.link(temp, destination)
      } catch (error) {
        if (!['ENOSYS', 'ENOTSUP', 'EOPNOTSUPP', 'EXDEV', 'EPERM'].includes(error.code)) throw error
        await fs.copyFile(temp, destination, constants.COPYFILE_EXCL)
      }
      return destination
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
  }
  throw new Error('Could not choose a name for the update download.')
}

async function writeDownload(fetch, handle, asset) {
  const signal = AbortSignal.timeout(10 * 60 * 1000)
  const hash = createHash('sha256')
  const badFile = 'The update download did not match its published checksum or size.'
  let size = 0
  for (let attemptsLeft = 3; attemptsLeft > 0; attemptsLeft--) {
    const range = size ? {offset: size, total: asset.size} : undefined
    const body = await openResponse(fetch, asset.url, {signal, download: true, range})
    try {
      for await (const chunk of body) {
        signal.throwIfAborted()
        if (size + chunk.length > asset.size) throw new Error(badFile)
        await handle.writeFile(chunk)
        hash.update(chunk)
        size += chunk.length
      }
      break
    } catch (error) {
      if (attemptsLeft === 1 || signal.aborted || size >= asset.size || !interruptedTransfer.test(error.message)) throw error
    }
  }
  signal.throwIfAborted()
  if (size !== asset.size || hash.digest('hex') !== asset.digest) throw new Error(badFile)
}

async function saveDownload(fetch, downloads, asset) {
  await fs.mkdir(downloads, {recursive: true})
  const temp = path.join(downloads, `.margin-update-${randomUUID()}.part`)
  const handle = await fs.open(temp, 'wx', 0o600)
  try {
    try { await writeDownload(fetch, handle, asset) }
    finally { await handle.close() }
    const file = await publishDownload(temp, downloads, asset.name)
    return {path: file, stat: await fs.lstat(file)}
  } finally {
    await fs.unlink(temp)
  }
}

function createUpdater({
  fetch, getVersion, getDownloads, showItemInFolder,
  platform = process.platform, arch = process.arch, env = process.env, execPath = process.execPath,
}) {
  const environment = {platform, arch, env, execPath}
  let selection
  let lastDownloaded
  let check
  let download

  async function checkedDownload() {
    if (!lastDownloaded) throw new Error('The downloaded update file could not be found.')
    const {path: file, stat} = lastDownloaded
    const current = await fs.lstat(file).catch(() => null)
    if (!current?.isFile() || ['dev', 'ino', 'size', 'mtimeMs'].some(key => current[key] !== stat[key])) {
      throw new Error('The downloaded update file could not be found.')
    }
    return lastDownloaded
  }

  return {
    checkForUpdates() {
      if (!check) {
        selection = null
        check = readLatestRelease(fetch).then(release => {
          selection = readRelease(release, getVersion(), environment)
          return selection.result
        }).finally(() => { check = null })
      }
      return check
    },
    async downloadUpdate(latestVersion) {
      if (download && download.version === latestVersion) return download.promise
      if (!selection?.download || selection.result.latestVersion !== latestVersion ||
        compareToStable(getVersion(), latestVersion) >= 0) {
        throw new Error('Check for updates again before downloading.')
      }
      if (download) throw new Error('An update download is already in progress.')
      const asset = selection.download
      const promise = saveDownload(fetch, getDownloads(), asset).then(saved => {
        lastDownloaded = {...saved, version: latestVersion, asset}
        return {path: saved.path}
      }).finally(() => { download = null })
      download = {version: latestVersion, promise}
      return promise
    },
    async showDownloadedUpdate() {
      const {path: file} = await checkedDownload()
      showItemInFolder(file)
    },
    async installableUpdate(version) {
      const saved = await checkedDownload()
      if (saved.version !== version || compareToStable(getVersion(), version) >= 0) {
        throw new Error('Check for updates again before installing.')
      }
      const {size, digest} = saved.asset
      const hash = createHash('sha256')
      let bytes = 0
      for await (const chunk of createReadStream(saved.path)) {
        bytes += chunk.length
        if (bytes > size) throw new Error('The update download did not match its published checksum or size.')
        hash.update(chunk)
      }
      if (bytes !== size || hash.digest('hex') !== digest) {
        throw new Error('The update download did not match its published checksum or size.')
      }
      return {path: saved.path, version, size, digest}
    },
  }
}

module.exports = {createUpdater, assetName, compareToStable}
