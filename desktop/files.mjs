import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import {decode, encode} from './codec.mjs'

export const EDIT_LIMIT = 48 * 1024 * 1024
export const fingerprint = bytes => createHash('sha256').update(bytes).digest('hex')

export async function readBytes(file, limit = EDIT_LIMIT) {
  const handle = await fs.open(file, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) throw new Error('Choose a regular file.')
    if (stat.size > limit) throw new Error(`File exceeds the ${limit / 1024 / 1024} MiB read limit.`)
    const bytes = Buffer.alloc(stat.size + 1)
    let offset = 0
    while (offset < bytes.length) {
      const {bytesRead} = await handle.read(bytes, offset, bytes.length - offset)
      if (!bytesRead) break
      offset += bytesRead
    }
    if (offset !== stat.size) throw new Error('The file changed while it was being read. Try again.')
    return {bytes: bytes.subarray(0, offset), stat}
  } finally { await handle.close() }
}

export async function readDocument(filename, encoding) {
  const file = await fs.realpath(filename)
  const {bytes, stat} = await readBytes(file)
  return {path: file, name: path.basename(file), size: stat.size, mtime: stat.mtimeMs, fingerprint: fingerprint(bytes), ...decode(bytes, encoding)}
}

export async function existing(file) {
  try { return await fs.realpath(file) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

export async function atomicWrite(file, bytes, {validate, mode} = {}) {
  const temporary = path.join(path.dirname(file), `.margin-${randomUUID()}.tmp`)
  try {
    const handle = await fs.open(temporary, 'wx', mode ?? 0o600)
    try {
      if (mode !== undefined && process.platform !== 'win32') await handle.chmod(mode)
      await handle.writeFile(bytes)
      await handle.sync()
    } finally { await handle.close() }
    await validate?.()
    await fs.rename(temporary, file)
  } finally { await fs.unlink(temporary).catch(() => {}) }
}

export async function saveDocument(filename, document, expected, {backup = false} = {}) {
  const file = await existing(filename) ?? filename
  const encoded = encode(document)
  const check = async () => {
    let old = null
    try { old = await readBytes(file) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    if ((old ? fingerprint(old.bytes) : null) !== expected) {
      const error = new Error('This file changed on disk. Reload it or save your edits under a new name.')
      error.code = 'CONFLICT'
      throw error
    }
    return old
  }
  const old = await check()
  if (backup && old) await atomicWrite(`${file}.margin-backup`, old.bytes)
  await atomicWrite(file, encoded, {validate: check, mode: old?.stat.mode && old.stat.mode & 0o777})
  const stat = await fs.stat(file)
  return {path: file, name: path.basename(file), mtime: stat.mtimeMs, size: encoded.length, fingerprint: fingerprint(encoded)}
}
