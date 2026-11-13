import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import {decode, decodeSegment, encode} from './codec.mjs'

export const EDIT_LIMIT = 48 * 1024 * 1024
export const PAGE_SIZE = 1024 * 1024
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

export function largeFingerprint(stat) {
  return `paged:${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`
}

function utf8Boundary(bytes, start) {
  let index = start
  while (index > 0 && index < bytes.length && index > start - 3 && (bytes[index] & 0xc0) === 0x80) index--
  return index
}

export function supportsPagedEditing(encoding) {
  return /^(UTF-(8|16|32)\b|Windows-125[0-8]$|ISO-8859-\d+$|IBM\d+$|CP(?:[78]\d{2})$|KOI8-[RU]$|Macintosh$)/i.test(encoding)
}

export async function readLargePage(filename, requested, page = 0) {
  const file = await fs.realpath(filename)
  const handle = await fs.open(file, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) throw new Error('Choose a regular file.')
    const pages = Math.max(1, Math.ceil(stat.size / PAGE_SIZE))
    const index = Math.max(0, Math.min(pages - 1, Number.isFinite(page) ? Math.floor(page) : 0))
    const nominal = index * PAGE_SIZE
    const before = Math.max(0, nominal - 4)
    const length = Math.min(PAGE_SIZE + 8, stat.size - before)
    const probe = Buffer.alloc(Math.min(stat.size, 4096))
    const probeRead = await handle.read(probe, 0, probe.length, 0)
    const sample = probe.subarray(0, probeRead.bytesRead)
    let encoding = requested
    if (!encoding) {
      const valid = [0, 1, 2, 3].some(ignored => {
        try { new TextDecoder('utf-8', {fatal: true}).decode(sample.subarray(0, sample.length - ignored)); return true }
        catch { return false }
      })
      const guessed = decode(sample).encoding
      encoding = valid && guessed === 'Windows-1252' ? 'UTF-8' : guessed
    }
    const buffer = Buffer.alloc(length)
    let read = 0
    while (read < length) {
      const {bytesRead} = await handle.read(buffer, read, length - read, before + read)
      if (!bytesRead) break
      read += bytesRead
    }
    if (read !== length) throw new Error('The file changed while this page was being read. Try again.')
    let from = nominal - before
    let to = Math.min(from + PAGE_SIZE, buffer.length)
    if (encoding.startsWith('UTF-8')) {
      from = utf8Boundary(buffer, from)
      to = utf8Boundary(buffer, to)
    } else if (encoding.startsWith('UTF-16')) {
      const unit = encoding.includes('LE') ? at => buffer.readUInt16LE(at) : at => buffer.readUInt16BE(at)
      const align = at => at >= 2 && at + 1 < buffer.length && unit(at) >= 0xdc00 && unit(at) <= 0xdfff ? at - 2 : at
      from = align(from)
      to = align(to)
    }
    const width = encoding.startsWith('UTF-32') ? 4 : encoding.startsWith('UTF-16') ? 2 : 1
    const little = encoding.includes('LE')
    const unit = width === 4 ? little ? at => buffer.readUInt32LE(at) : at => buffer.readUInt32BE(at)
      : width === 2 ? little ? at => buffer.readUInt16LE(at) : at => buffer.readUInt16BE(at) : at => buffer[at]
    const avoidCRLF = at => at >= width && at + width <= buffer.length && unit(at - width) === 13 && unit(at) === 10 ? at - width : at
    from = avoidCRLF(from)
    to = avoidCRLF(to)
    const bytes = buffer.subarray(from, to)
    const result = decodeSegment(bytes, encoding, before + from === 0)
    const editable = supportsPagedEditing(encoding) && !result.lossy && !result.binary
    if (largeFingerprint(await handle.stat()) !== largeFingerprint(stat)) throw new Error('The file changed while this page was being read. Try again.')
    return {...result, path: file, name: path.basename(file), size: stat.size, mtime: stat.mtimeMs, fingerprint: largeFingerprint(stat), readOnly: !editable,
      large: {index, pages, offset: before + from, end: before + to, editable, digest: fingerprint(bytes)}}
  } finally { await handle.close() }
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
      if (typeof bytes === 'function') await bytes(handle)
      else await handle.writeFile(bytes)
      await handle.sync()
    } finally { await handle.close() }
    await validate?.()
    await fs.rename(temporary, file)
  } finally { await fs.unlink(temporary).catch(() => {}) }
}

async function copyRange(input, output, start, end) {
  const buffer = Buffer.allocUnsafe(PAGE_SIZE)
  let position = start
  while (position < end) {
    const length = Math.min(buffer.length, end - position)
    const {bytesRead} = await input.read(buffer, 0, length, position)
    if (!bytesRead) throw new Error('The source file was truncated during save.')
    await output.writeFile(buffer.subarray(0, bytesRead))
    position += bytesRead
  }
}

export async function saveLargePage(filename, document, expected, {backup = false} = {}) {
  const file = await fs.realpath(filename)
  const {large, encoding} = document
  const conflict = () => new Error('This file changed on disk. Reload it before saving the page.')
  const old = await readLargePage(file, encoding, large.index)
  if (old.fingerprint !== expected || old.large.digest !== large.digest || old.large.offset !== large.offset || old.large.end !== large.end) throw conflict()
  if (!old.large.editable) throw new Error('This page cannot be encoded losslessly.')
  const encoded = encode(document, large.offset === 0)
  const input = await fs.open(file, 'r')
  let originalClosed = false
  try {
    const stat = await input.stat()
    const check = async () => { if (largeFingerprint(await fs.stat(file)) !== expected || largeFingerprint(await input.stat()) !== expected) throw conflict() }
    await check()
    if (backup) await atomicWrite(`${file}.margin-backup`, handle => copyRange(input, handle, 0, stat.size), {validate: check})
    await atomicWrite(file, async handle => {
      await copyRange(input, handle, 0, large.offset)
      await handle.writeFile(encoded)
      await copyRange(input, handle, large.end, stat.size)
    }, {validate: async () => { await check(); await input.close(); originalClosed = true }, mode: stat.mode & 0o777})
  } finally { if (!originalClosed) await input.close() }
  const stat = await fs.stat(file)
  return stat.size > EDIT_LIMIT ? readLargePage(file, encoding, large.index) : readDocument(file, encoding)
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
