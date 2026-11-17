import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import updaterModule from '../desktop/update.cjs'

const {assetName, compareToStable, createUpdater} = updaterModule
const repository = 'peterwangze/margin-editor'
const api = `https://api.github.com/repos/${repository}/releases/latest`
const version = '1.10.0'
const filename = `Margin-${version}-win-x64-setup.exe`
const url = `https://github.com/${repository}/releases/download/v${version}/${filename}`
const bytes = Buffer.from('test release contents')
const digest = 'sha256:' + createHash('sha256').update(bytes).digest('hex')
const asset = {name: filename, state: 'uploaded', size: bytes.length, digest, browser_download_url: url}
const release = {tag_name: `v${version}`, draft: false, prerelease: false, body: 'Release notes', assets: [asset]}

async function fixture(t, {installed = '1.9.0', metadata = release, content = bytes, redirect, downloadResponse = () => new Response(content)} = {}) {
  const downloads = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-update-'))
  t.after(() => fs.rm(downloads, {recursive: true, force: true}))
  const requested = []
  const followed = []
  const revealed = []
  const updater = createUpdater({
    platform: 'win32', arch: 'x64', env: {}, getVersion: () => installed, getDownloads: () => downloads,
    showItemInFolder: file => revealed.push(file),
    async fetch(input, options) {
      requested.push({url: input, ...options})
      if (input === api) return Response.json(metadata)
      if (redirect && input === url) return new Response(null, {status: 302, headers: {Location: redirect}})
      if (input === redirect) followed.push(input)
      return downloadResponse()
    },
  })
  return {updater, downloads, requested, followed, revealed}
}

function interruptedResponse(content, options) {
  let sent = false
  // Make the stream report the interruption only when the reader asks for more bytes.
  const body = new ReadableStream({
    pull(controller) {
      if (sent) controller.error(new Error('net::ERR_CONNECTION_CLOSED'))
      else {
        sent = true
        controller.enqueue(content)
      }
    },
  }, {highWaterMark: 0})
  return new Response(body, options)
}

function remainingRange(offset) {
  return {status: 206, headers: {'Content-Range': `bytes ${offset}-${bytes.length - 1}/${bytes.length}`}}
}

test('updater compares version components numerically and selects the matching package form', () => {
  assert.equal(compareToStable('1.9.0', '1.10.0'), -1)
  assert.equal(compareToStable('1.10.0+local', '1.10.0'), 0)
  assert.equal(compareToStable('2.0.0', '1.10.0'), 1)
  assert.equal(compareToStable('1.10.0-rc.2', '1.10.0'), -1)
  const expected = [
    ['win32', 'x64', {}, '', 'win-x64-setup.exe'],
    ['win32', 'arm64', {PORTABLE_EXECUTABLE_DIR: 'D:/Portable'}, '', 'win-arm64-portable.exe'],
    ['darwin', 'x64', {}, '', 'mac-x64.dmg'],
    ['darwin', 'arm64', {}, '', 'mac-arm64.dmg'],
    ['linux', 'x64', {}, '/opt/Margin/margin', 'linux-amd64.deb'],
    ['linux', 'arm64', {}, '/opt/Margin/margin', 'linux-arm64.deb'],
    ['linux', 'x64', {APPIMAGE: '/tmp/Margin.AppImage'}, '/opt/Margin/margin', 'linux-x86_64.AppImage'],
    ['linux', 'arm64', {}, '/tmp/unpacked/margin', 'linux-arm64.AppImage'],
  ]
  for (const [platform, arch, env, execPath, suffix] of expected) {
    assert.equal(assetName(version, {platform, arch, env, execPath}), `Margin-${version}-${suffix}`)
  }
  assert.equal(assetName(version, {platform: 'win32', arch: 'ia32', env: {}}), null)
})

test('updater reports the stable version before allowing an explicit download, verifies and preserves existing files', async t => {
  const host = 'https://release-assets.githubusercontent.com/path'
  const {updater, downloads, requested, followed, revealed} = await fixture(t, {redirect: host})
  assert.deepEqual(requested, [])
  await assert.rejects(updater.downloadUpdate(version), /Check for updates again/)
  await assert.rejects(updater.showDownloadedUpdate(), /could not be found/)
  await assert.rejects(updater.installableUpdate(version), /could not be found/)
  assert.deepEqual(await updater.checkForUpdates(), {
    currentVersion: '1.9.0', latestVersion: version, status: 'available', notes: 'Release notes',
    asset: {name: filename, size: bytes.length},
  })
  assert.deepEqual(requested.map(item => item.url), [api])
  await assert.rejects(updater.downloadUpdate('99.0.0'), /Check for updates again/)
  await fs.writeFile(path.join(downloads, filename), 'keep this file')
  const [result, concurrent] = await Promise.all([updater.downloadUpdate(version), updater.downloadUpdate(version)])
  assert.deepEqual(concurrent, result)
  assert.equal(path.basename(result.path), `Margin-${version}-win-x64-setup (2).exe`)
  assert.deepEqual(requested.map(item => item.url), [api, url, host])
  assert.ok(requested.every(item => item.redirect === 'manual' && item.credentials === 'omit'))
  assert.deepEqual(followed, [host])
  assert.deepEqual(await fs.readFile(result.path), bytes)
  assert.equal(await fs.readFile(path.join(downloads, filename), 'utf8'), 'keep this file')
  assert.deepEqual(await updater.installableUpdate(version), {
    path: result.path, version, size: bytes.length, digest: digest.replace('sha256:', ''),
  })
  await assert.rejects(updater.installableUpdate('99.0.0'), /Check for updates again/)
  await updater.showDownloadedUpdate()
  assert.deepEqual(revealed, [result.path])
  await fs.unlink(result.path)
  await assert.rejects(updater.showDownloadedUpdate(), /could not be found/)
  await assert.rejects(updater.installableUpdate(version), /could not be found/)
})

test('updater reports current and ahead without offering a file, and ignores unsafe or missing assets', async t => {
  for (const [installed, status] of [[version, 'current'], ['2.0.0', 'ahead']]) {
    const {updater} = await fixture(t, {installed})
    const state = await updater.checkForUpdates()
    assert.equal(state.status, status)
    assert.equal(state.asset, null)
    await assert.rejects(updater.downloadUpdate(version), /Check for updates again/)
  }
  for (const assets of [
    [], [{...asset, digest: null}], [{...asset, browser_download_url: 'https://example.org/installer.exe'}], [asset, asset],
  ]) {
    const {updater} = await fixture(t, {metadata: {...release, assets}})
    const state = await updater.checkForUpdates()
    assert.equal(state.status, 'available')
    assert.equal(state.asset, null)
    await assert.rejects(updater.downloadUpdate(version), /Check for updates again/)
  }
  const {updater} = await fixture(t, {metadata: {...release, prerelease: true}})
  await assert.rejects(updater.checkForUpdates(), /Invalid GitHub release metadata/)
})

test('updater removes temporary files after disallowed redirects, wrong size or wrong checksum', async t => {
  for (const [options, error] of [
    [{redirect: 'https://release-assets.githubusercontent.com.example.org/path'}, /unexpected redirect/],
    [{redirect: 'http://release-assets.githubusercontent.com/path'}, /unexpected redirect/],
    [{content: Buffer.concat([bytes, Buffer.from('x')])}, /checksum or size/],
    [{content: bytes.subarray(1)}, /checksum or size/],
    [{content: Buffer.alloc(bytes.length)}, /checksum or size/],
  ]) {
    const {updater, downloads, followed} = await fixture(t, options)
    await updater.checkForUpdates()
    await assert.rejects(updater.downloadUpdate(version), error)
    assert.deepEqual(await fs.readdir(downloads), [])
    assert.deepEqual(followed, [])
    await assert.rejects(updater.showDownloadedUpdate(), /could not be found/)
  }
})

test('updater continues interrupted downloads from staged bytes through fresh GitHub redirects', async t => {
  const host = 'https://release-assets.githubusercontent.com/resume'
  const responses = [
    interruptedResponse(bytes.subarray(0, 3)),
    interruptedResponse(bytes.subarray(3, 6), remainingRange(3)),
    new Response(bytes.subarray(6), remainingRange(6)),
  ]
  const {updater, downloads, requested} = await fixture(t, {redirect: host, downloadResponse: () => responses.shift()})
  await updater.checkForUpdates()
  const {path: file} = await updater.downloadUpdate(version)
  assert.deepEqual(requested.map(item => item.url), [api, url, host, url, host, url, host])
  assert.deepEqual(requested.slice(1).map(item => new Headers(item.headers).get('range')), [
    null, null, 'bytes=3-', 'bytes=3-', 'bytes=6-', 'bytes=6-',
  ])
  assert.ok(requested.slice(1).every(item => item.signal === requested[1].signal))
  assert.deepEqual(await fs.readFile(file), bytes)
  assert.deepEqual(await fs.readdir(downloads), [filename])
  assert.equal((await updater.installableUpdate(version)).path, file)
})

test('updater rejects invalid continuation metadata and verifies the checksum after continuation', async t => {
  const remaining = bytes.subarray(3)
  for (const continuation of [
    new Response(remaining),
    new Response(remaining, {status: 206}),
    new Response(remaining, {status: 206, headers: {'Content-Range': `bytes 2-${bytes.length - 1}/${bytes.length}`}}),
    new Response(remaining, {status: 206, headers: {'Content-Range': `bytes 3-${bytes.length - 2}/${bytes.length}`}}),
    new Response(remaining, {status: 206, headers: {'Content-Range': `bytes 3-${bytes.length - 1}/${bytes.length + 1}`}}),
    new Response(Buffer.alloc(remaining.length), remainingRange(3)),
  ]) {
    const responses = [interruptedResponse(bytes.subarray(0, 3)), continuation]
    const {updater, downloads, requested} = await fixture(t, {downloadResponse: () => responses.shift()})
    const existing = path.join(downloads, filename)
    await fs.writeFile(existing, 'keep this file')
    await updater.checkForUpdates()
    await assert.rejects(updater.downloadUpdate(version))
    assert.deepEqual(requested.map(item => item.url), [api, url, url])
    assert.equal(new Headers(requested.at(-1).headers).get('range'), 'bytes=3-')
    assert.deepEqual(await fs.readdir(downloads), [filename])
    assert.equal(await fs.readFile(existing, 'utf8'), 'keep this file')
    await assert.rejects(updater.installableUpdate(version), /could not be found/)
  }
})

test('updater cleans up the temporary file after exhausting continuation attempts', async t => {
  const responses = [
    interruptedResponse(bytes.subarray(0, 3)),
    interruptedResponse(bytes.subarray(3, 6), remainingRange(3)),
    interruptedResponse(bytes.subarray(6, 9), remainingRange(6)),
  ]
  const {updater, downloads, requested} = await fixture(t, {downloadResponse: () => responses.shift()})
  await updater.checkForUpdates()
  await assert.rejects(updater.downloadUpdate(version))
  assert.deepEqual(requested.map(item => item.url), [api, url, url, url])
  assert.deepEqual(requested.slice(1).map(item => new Headers(item.headers).get('range')), [null, 'bytes=3-', 'bytes=6-'])
  assert.deepEqual(await fs.readdir(downloads), [])
})
