export const EOLS = {LF: '\n', CRLF: '\r\n', CR: '\r'}

export function newlines(text) {
  const breaks = text.match(/\r\n|\r|\n/g) ?? []
  const counts = new Map()
  for (const value of breaks) counts.set(value, (counts.get(value) ?? 0) + 1)
  const dominant = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '\n'
  const eol = Object.keys(EOLS).find(key => EOLS[key] === dominant)
  return {text: text.replace(/\r\n?/g, '\n'), eol, mixed: counts.size > 1 ? breaks : null}
}

export function withNewlines({text, eol, mixed}) {
  if (!mixed && eol === 'LF') return text
  let index = 0
  return text.replace(/\n/g, () => mixed?.[index++] ?? EOLS[eol] ?? '\n')
}

export const encodings = ['UTF-8', 'UTF-8 BOM', 'UTF-16 LE', 'UTF-16 BE', 'UTF-16 LE (no BOM)', 'UTF-16 BE (no BOM)', 'UTF-32 LE', 'UTF-32 BE', 'UTF-32 LE (no BOM)', 'UTF-32 BE (no BOM)', 'Windows-1252', 'Windows-1250', 'Windows-1251', 'Windows-1253', 'Windows-1254', 'Windows-1255', 'Windows-1256', 'Windows-1257', 'Windows-1258', 'GB18030', 'GBK', 'Big5', 'Shift_JIS', 'EUC-JP', 'EUC-KR', 'KOI8-R', 'KOI8-U', 'ISO-8859-1', 'ISO-8859-2', 'ISO-8859-5', 'ISO-8859-7', 'ISO-8859-9', 'ISO-8859-15', 'IBM437', 'IBM850', 'IBM866', 'Macintosh']

export const emptyQuery = {needle: '', replacement: '', mode: 'literal', caseSensitive: false, whole: false, dotAll: false, wrap: true, inSelection: false}

export function unescapeExtended(value) {
  return value.replace(/\\(?:[nrt0\\]|x[\da-fA-F]{2}|u[\da-fA-F]{4}|b[01]{8}|o[0-7]{3}|d\d{3})/g, token => {
    const character = {n: '\n', r: '\r', t: '\t', 0: '\0', '\\': '\\'}[token[1]]
    if (character !== undefined) return character
    const radix = {x: 16, u: 16, b: 2, o: 8, d: 10}[token[1]]
    return String.fromCharCode(Number.parseInt(token.slice(2), radix))
  })
}

export function compile(query) {
  const {needle, mode, caseSensitive, whole, dotAll} = query
  if (!needle) return null
  const literal = mode === 'extended' ? unescapeExtended(needle).replace(/\r\n?/g, '\n') : needle
  let source = mode === 'regex' ? needle : literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (whole) source = `(?<![\\p{L}\\p{M}\\p{N}_])(?:${source})(?![\\p{L}\\p{M}\\p{N}_])`
  return new RegExp(source, `gmu${caseSensitive ? '' : 'i'}${dotAll ? 's' : ''}`)
}

function expand(replacement, match, source) {
  return replacement.replace(/\$([$&'`]|\d{1,2}|<[^>]+>)/g, (token, key) => {
    if (key === '$') return '$'
    if (key === '&') return match[0]
    if (key === '`') return source.slice(0, match.index)
    if (key === "'") return source.slice(match.index + match[0].length)
    if (key[0] === '<') return match.groups ? match.groups[key.slice(1, -1)] ?? '' : token
    const index = Number(key)
    if (index > 0 && index < match.length) return match[index] ?? ''
    if (key.length === 2 && Number(key[0]) > 0 && Number(key[0]) < match.length) return (match[Number(key[0])] ?? '') + key[1]
    return token
  })
}

export function findMatches(text, query, {limit = 5000, from = 0, to = text.length} = {}) {
  const pattern = compile(query)
  if (!pattern) return {matches: [], truncated: false}
  const matches = []
  pattern.lastIndex = from
  let replacementBytes = 0
  const replacement = query.replacement ?? ''
  for (const match of text.matchAll(pattern)) {
    const start = match.index
    const end = start + match[0].length
    if (start > to) break
    if (end > to) continue
    const insert = query.mode === 'regex' ? expand(replacement, match, text) : query.mode === 'extended' ? unescapeExtended(replacement) : replacement
    replacementBytes += insert.length
    if (matches.length === limit || replacementBytes > 16 * 1024 * 1024) return {matches, truncated: true}
    matches.push({from: start, to: end, insert: insert.replace(/\r\n?/g, '\n')})
  }
  return {matches, truncated: false}
}

export function replaceMatches(text, matches) {
  let offset = 0
  const parts = []
  for (const match of matches) {
    parts.push(text.slice(offset, match.from), match.insert)
    offset = match.to
  }
  parts.push(text.slice(offset))
  return parts.join('')
}

export function updateMixed(before, mixed, changes, eol) {
  if (!mixed) return null
  let last = 0
  let breakIndex = 0
  const output = []
  const copy = (end, keep) => {
    for (let index = before.indexOf('\n', last); index !== -1 && index < end; index = before.indexOf('\n', index + 1)) {
      if (keep) output.push(mixed[breakIndex] ?? EOLS[eol])
      breakIndex++
    }
    last = end
  }
  for (const {from, to, insert} of changes) {
    copy(from, true)
    copy(to, false)
    for (const character of insert) if (character === '\n') output.push(EOLS[eol])
  }
  copy(before.length, true)
  return output
}
