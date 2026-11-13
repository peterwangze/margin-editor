import iconv from 'iconv-lite'
import {newlines, withNewlines} from '../shared/text.mjs'

const formats = [
  ['UTF-32 LE', 'utf32le', [0xff, 0xfe, 0, 0]], ['UTF-32 BE', 'utf32be', [0, 0, 0xfe, 0xff]],
  ['UTF-8 BOM', 'utf8', [0xef, 0xbb, 0xbf]], ['UTF-16 LE', 'utf16le', [0xff, 0xfe]], ['UTF-16 BE', 'utf16be', [0xfe, 0xff]],
  ['UTF-16 LE (no BOM)', 'utf16le', []], ['UTF-16 BE (no BOM)', 'utf16be', []], ['UTF-8', 'utf8', []],
]

function format(name) {
  return formats.find(([label]) => label === name) ?? [name, name, []]
}

export function decode(bytes, requested) {
  return decodeSegment(bytes, requested, true)
}

export function decodeSegment(bytes, requested, allowBom) {
  const bom = allowBom && formats.find(([, , prefix]) => prefix.length && bytes.subarray(0, prefix.length).equals(Buffer.from(prefix)))
  let guessed = bom?.[0] ?? 'UTF-8'
  if (!requested && !bom) {
    const sample = bytes.subarray(0, 4096)
    let even = 0, odd = 0
    for (let i = 0; i < sample.length; i++) {
      if (!sample[i]) i % 2 ? odd++ : even++
    }
    if (odd > sample.length / 4 && !even) guessed = 'UTF-16 LE (no BOM)'
    else if (even > sample.length / 4 && !odd) guessed = 'UTF-16 BE (no BOM)'
    else {
      try { new TextDecoder('utf-8', {fatal: true}).decode(bytes) }
      catch { guessed = 'Windows-1252' }
    }
  }
  const [encoding, codec] = format(requested ?? guessed)
  const stripped = bom?.[1] === codec ? bytes.subarray(bom[2].length) : bytes
  const decoded = iconv.decode(stripped, codec, {stripBOM: false})
  const lossy = !iconv.encode(decoded, codec).equals(stripped)
  return {...newlines(decoded), encoding, lossy, binary: decoded.includes('\0')}
}

export function encode(document, includeBom = true) {
  const [, codec, prefix] = format(document.encoding)
  const text = withNewlines(document)
  if (!text.isWellFormed()) throw new Error('The document contains an unmatched Unicode surrogate.')
  const encoded = iconv.encode(text, codec)
  if (iconv.decode(encoded, codec, {stripBOM: false}) !== text) throw new Error(`Some characters cannot be represented in ${document.encoding}. Choose another encoding.`)
  return includeBom && prefix.length ? Buffer.concat([Buffer.from(prefix), encoded]) : encoded
}
