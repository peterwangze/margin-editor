import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import installer from '../desktop/install-unix.cjs'

const {prepareUnixInstall} = installer

const identity = bytes => ({size: bytes.length, digest: createHash('sha256').update(bytes).digest('hex')})

test('AppImage preparation leaves the installed file untouched and removes failed staging', async t => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-install-test-'))
  t.after(() => fs.rm(work, {recursive: true, force: true}))
  const application = path.join(work, 'Installed Margin.AppImage')
  const download = path.join(work, 'Downloaded Margin.AppImage')
  const profile = path.join(work, 'profile')
  await fs.mkdir(profile)
  await fs.writeFile(application, 'installed app', {mode: 0o700})
  const invalidImage = Buffer.from('unrelated download')
  await fs.writeFile(download, invalidImage)
  const options = {
    assetPath: download, latestVersion: '2.0.0', platform: 'linux', profile,
    env: {...process.env, APPIMAGE: application},
  }

  await assert.rejects(prepareUnixInstall({...options, ...identity(invalidImage)}), /matching AppImage/)
  assert.equal(await fs.readFile(application, 'utf8'), 'installed app')
  assert.deepEqual((await fs.readdir(work)).sort(), [path.basename(download), path.basename(application), 'profile'])

  const architecture = {x64: 62, arm64: 183}[process.arch]
  if (architecture === undefined) return
  const header = Buffer.from([127, 69, 76, 70, 2, 1, 1, 0, 65, 73, 2, 0, 0, 0, 0, 0, 0, 0, architecture, 0])
  const valid = {...options, ...identity(header)}
  const tampered = Buffer.from(header)
  tampered[17] ^= 1
  await fs.writeFile(download, tampered)
  await assert.rejects(prepareUnixInstall(valid), /checksum or size/)
  await assert.rejects(prepareUnixInstall({...valid, size: valid.size - 1}), /checksum or size/)
  assert.deepEqual((await fs.readdir(work)).sort(), [path.basename(download), path.basename(application), 'profile'])
  await fs.writeFile(download, header)
  const prepared = await prepareUnixInstall(valid)
  try {
    assert.equal(await fs.readFile(application, 'utf8'), 'installed app')
    const stage = (await fs.readdir(work)).find(name => name.startsWith('.margin-install-'))
    assert.ok(stage)
    await fs.writeFile(download, tampered)
    assert.deepEqual(await fs.readFile(path.join(work, stage, 'Margin.AppImage')), header)
    await prepared.start()
    await fs.access(path.join(work, stage, 'helper-ready'))
    assert.equal(await fs.readFile(application, 'utf8'), 'installed app')
  } finally {
    await prepared.cleanup()
  }
  assert.deepEqual((await fs.readdir(work)).sort(), [path.basename(download), path.basename(application), 'profile'])
})
