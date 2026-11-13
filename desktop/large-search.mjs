import {compile, unescapeExtended} from '../shared/text.mjs'
import {readLargePage} from './files.mjs'

export async function searchLargeFile(file, encoding, expected, query) {
  if (query.mode === 'regex') throw new Error('Use Normal or Extended mode to search the whole large file.')
  const pattern = compile(query)
  if (!pattern) return {matches: [], truncated: false}
  const needle = query.mode === 'extended' ? unescapeExtended(query.needle) : query.needle
  if (needle.length > 4096) throw new Error('Whole-file search supports queries up to 4096 characters.')
  const matches = []
  const overlap = needle.length + 4
  let prior = null
  let cursor = 0
  let base = 0
  for (let index = 0; ; index++) {
    const current = await readLargePage(file, encoding, index)
    if (current.fingerprint !== expected) throw new Error('The file changed on disk during search. Reload it and try again.')
    if (current.binary || current.lossy) throw new Error('Choose a lossless encoding before searching the whole file.')
    if (!current.large.editable) throw new Error('Whole-file search requires UTF or a single-byte encoding.')
    const tail = prior?.text.slice(-overlap) ?? ''
    const last = index + 1 >= current.large.pages
    const text = tail + current.text
    const start = base - tail.length
    const end = last ? text.length : Math.max(0, text.length - overlap + 2)
    pattern.lastIndex = Math.max(0, cursor - start)
    for (const match of text.matchAll(pattern)) {
      if (match.index >= end) break
      if (matches.length === 3000) return {matches, truncated: true}
      const earlier = match.index < tail.length
      const pageText = earlier ? prior.text : current.text
      const from = earlier ? prior.text.length - tail.length + match.index : match.index - tail.length
      const to = Math.min(pageText.length, from + match[0].length)
      const preview = text.slice(Math.max(0, match.index - 30), Math.min(text.length, match.index + Math.min(match[0].length, 120) + 30)).replaceAll('\n', ' ')
      matches.push({page: earlier ? index - 1 : index, from, to, preview, crossesPage: to - from < match[0].length})
      cursor = start + match.index + match[0].length
    }
    cursor = Math.max(cursor, start + end)
    if (last) return {matches, truncated: false}
    prior = current
    base += current.text.length
  }
}
