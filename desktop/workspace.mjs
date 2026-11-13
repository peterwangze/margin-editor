import fs from 'node:fs/promises'
import path from 'node:path'
import {minimatch} from 'minimatch'
import {findMatches, replaceMatches, updateMixed} from '../shared/text.mjs'
import {findBoostMatches} from '../shared/boost-regex.mjs'
import {readDocument, saveDocument} from './files.mjs'

const skippedDirs = new Set(['.git', '.hg', '.svn', 'node_modules', '.venv'])
let boost

async function matcher(query) {
  if (query.mode !== 'regex') return (text, range) => findMatches(text, query, range)
  boost ??= await WebAssembly.compile(await fs.readFile(new URL('../shared/boost-regex.wasm', import.meta.url)))
  findBoostMatches(boost, '', query, {limit: 0})
  return (text, range) => findBoostMatches(boost, text, query, range)
}

async function* walk(root, depth, counters) {
  const directory = await fs.opendir(root)
  for await (const entry of directory) {
    if (++counters.entries > 20000) return
    const file = path.join(root, entry.name)
    if (entry.isFile()) yield file
    if (entry.isDirectory() && depth > 0 && !skippedDirs.has(entry.name)) {
      try { yield* walk(file, depth - 1, counters) }
      catch { counters.skipped++ }
    }
  }
}

export async function searchWorkspace(root, query, {glob = '*', depth = 12, preview = false} = {}) {
  if (!query.needle) return {files: [], total: 0, skipped: 0, truncated: false}
  const matchesFor = await matcher(query)
  const patterns = glob.split(',').map(value => value.trim()).filter(Boolean)
  const counters = {entries: 0, skipped: 0}
  const files = []
  let total = 0
  let scannedBytes = 0
  let truncated = false
  for await (const file of walk(root, Math.max(0, Math.min(64, depth)), counters)) {
    if (counters.entries > 20000 || scannedBytes >= 256 * 1024 * 1024 || total >= 3000) { truncated = true; break }
    const name = path.relative(root, file).split(path.sep).join('/')
    if (patterns.length && !patterns.some(pattern => minimatch(name, pattern, {matchBase: true, dot: true, nocomment: true, nonegate: true}))) continue
    try {
      const stat = await fs.stat(file)
      if (stat.size > 8 * 1024 * 1024) { counters.skipped++; continue }
      const doc = await readDocument(file)
      scannedBytes += doc.size
      if (doc.binary || (preview && doc.lossy)) { counters.skipped++; continue }
      const {matches, truncated: capped} = matchesFor(doc.text, {limit: Math.min(3000 - total, 1000)})
      truncated ||= capped
      if (!matches.length) continue
      const results = []
      let line = 1
      let lineStart = 0
      let next = doc.text.indexOf('\n')
      for (const match of matches) {
        while (next !== -1 && next < match.from) {
          line++
          lineStart = next + 1
          next = doc.text.indexOf('\n', lineStart)
        }
        results.push({line, col: match.from - lineStart + 1, text: doc.text.slice(lineStart, Math.min(next === -1 ? Infinity : next, lineStart + 240)), before: doc.text.slice(match.from, Math.min(match.to, match.from + 160)), after: match.insert.slice(0, 160)})
      }
      files.push({path: file, name, fingerprint: doc.fingerprint, results})
      total += matches.length
    } catch (error) {
      if (query.mode === 'regex' && (error instanceof WebAssembly.RuntimeError || /Boost regex/.test(error.message))) throw error
      counters.skipped++
    }
  }
  return {files, total, skipped: counters.skipped, truncated: truncated || counters.entries > 20000}
}

export async function applyWorkspace(plan, query, selected) {
  const matchesFor = await matcher(query)
  const allowed = new Set(selected)
  const prepared = []
  for (const file of plan.files.filter(item => allowed.has(item.path))) {
    const doc = await readDocument(file.path)
    if (file.fingerprint !== doc.fingerprint) throw new Error(`${file.name} changed since preview. Run Preview Replace again.`)
    const {matches, truncated} = matchesFor(doc.text, {limit: 1000})
    if (truncated || doc.lossy || doc.binary) throw new Error(`Cannot safely replace in ${file.name}.`)
    const next = {...doc, text: replaceMatches(doc.text, matches), mixed: updateMixed(doc.text, doc.mixed, matches, doc.eol)}
    prepared.push({file, next})
  }
  const saved = []
  for (const {file, next} of prepared) {
    try { await saveDocument(file.path, next, file.fingerprint); saved.push(file.path) }
    catch (error) { return {saved, failed: file.name, error: error.message} }
  }
  return {saved}
}
