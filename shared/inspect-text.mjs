const names = new Map([
  [0x00a0, 'No-break space'], [0x00ad, 'Soft hyphen'], [0x061c, 'Arabic letter mark'], [0x1680, 'Ogham space mark'],
  [0x180e, 'Mongolian vowel separator'], [0x200b, 'Zero-width space'], [0x200c, 'Zero-width non-joiner'],
  [0x200d, 'Zero-width joiner'], [0x200e, 'Left-to-right mark'], [0x200f, 'Right-to-left mark'],
  [0x2028, 'Line separator'], [0x2029, 'Paragraph separator'], [0x202f, 'Narrow no-break space'],
  [0x2060, 'Word joiner'], [0x2066, 'Left-to-right isolate'], [0x2067, 'Right-to-left isolate'],
  [0x2068, 'First strong isolate'], [0x2069, 'Pop directional isolate'], [0x3000, 'Ideographic space'],
  [0xfeff, 'Zero-width no-break space'], [0xfffd, 'Replacement character'],
])
const hidden = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u00A0\u00AD\u061C\u1680\u180E\u2000-\u200F\u2028-\u202F\u205F\u2060-\u206F\u3000\uFEFF\uFFFD]/gu
const show = /[ \t\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u00A0\u00AD\u061C\u1680\u180E\u2000-\u200F\u2028-\u202F\u205F\u2060-\u206F\u3000\uFEFF\uFFFD]/gu
const hex = point => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`
const maxChanges = 50_000

export function inspectText(text, ranges) {
  const words = new Intl.Segmenter(undefined, {granularity: 'word'})
  const graphemes = new Intl.Segmenter(undefined, {granularity: 'grapheme'})
  const unusual = new Map()
  let wordCount = 0, characterCount = 0, tabs = 0
  for (const {from, to} of ranges) {
    const fragment = text.slice(from, to)
    for (const {isWordLike} of words.segment(fragment)) if (isWordLike) wordCount++
    for (const _ of graphemes.segment(fragment)) characterCount++
    for (const match of fragment.matchAll(hidden)) {
      const point = match[0].codePointAt(0)
      unusual.set(point, (unusual.get(point) ?? 0) + 1)
    }
    for (const _ of fragment.matchAll(/\t/g)) tabs++
  }
  const characters = [...unusual].sort(([a], [b]) => a - b).map(([point, count]) => ({
    code: hex(point), name: names.get(point) ?? (point <= 0x9f ? 'Control character' : 'Unicode space or formatting mark'), count,
  }))
  return {wordCount, characterCount, tabs, characters}
}

function display(text) {
  return text.replace(show, char => char === ' ' ? '·' : char === '\t' ? '⇥' : `[${hex(char.codePointAt(0))}]`)
}

function snippet(text, start) {
  const before = start > 0 ? '…' : ''
  return before + display(text.slice(start, start + 88).toWellFormed()) + (text.length > start + 88 ? '…' : '')
}

export function planCleanup(text, ranges, options, partialLastLine = false) {
  const changes = [], preview = []
  let line = 1, rangeIndex = 0, lineStart = 0, changedLines = 0, total = 0
  if (!options.trim && !options.noBreak && !options.zeroWidth) return {changes, preview, changedLines, total, limited: false}
  // Each line is scanned once. No change includes a line separator, so mixed EOLs survive.
  while (lineStart <= text.length && rangeIndex < ranges.length) {
    const next = text.indexOf('\n', lineStart)
    const end = next < 0 ? text.length : next
    const original = text.slice(lineStart, end)
    let trailing = original.length
    if (options.trim && (next >= 0 || !partialLastLine)) {
      while (trailing > 0 && (original[trailing - 1] === ' ' || original[trailing - 1] === '\t')) trailing--
    }
    while (ranges[rangeIndex]?.to <= lineStart) rangeIndex++
    const lineChanges = []
    let lineChanged = false
    const add = (from, to, insert) => {
      total++
      lineChanged = true
      if (total > maxChanges) return
      const change = {from, to, insert}
      changes.push(change)
      if (preview.length < 6) lineChanges.push(change)
    }
    for (let i = rangeIndex; i < ranges.length && ranges[i].from < end; i++) {
      const from = Math.max(lineStart, ranges[i].from)
      const to = Math.min(end, ranges[i].to)
      const trimFrom = Math.max(from, lineStart + trailing)
      if (options.noBreak || options.zeroWidth) {
        for (const match of text.slice(from, Math.min(to, trimFrom)).matchAll(/[\u00a0\u202f\u200b]+/gu)) {
          const result = match[0].replace(/[\u00a0\u202f\u200b]/gu, char => char === '\u200b' ? (options.zeroWidth ? '' : char) : (options.noBreak ? ' ' : char))
          if (result !== match[0]) add(from + match.index, from + match.index + match[0].length, result)
        }
      }
      if (trimFrom < to) add(trimFrom, to, '')
    }
    if (lineChanged) {
      changedLines++
      if (lineChanges.length) {
        let after = '', offset = lineStart
        for (const {from, to, insert} of lineChanges) { after += text.slice(offset, from) + insert; offset = to }
        after += text.slice(offset, end)
        const start = Math.max(0, lineChanges[0].from - lineStart - 28)
        preview.push({line, before: snippet(original, start), after: snippet(after, start)})
      }
    }
    if (next < 0) break
    lineStart = next + 1
    line++
  }
  return {changes: total > maxChanges ? [] : changes, preview, changedLines, total, limited: total > maxChanges}
}
