import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {encode, decode} from '../desktop/codec.mjs'
import {readDocument, saveDocument, readLargePage, saveLargePage, EDIT_LIMIT, PAGE_SIZE} from '../desktop/files.mjs'
import {searchLargeFile} from '../desktop/large-search.mjs'
import {findBoostMatches} from '../shared/boost-regex.mjs'
import {searchWorkspace, applyWorkspace} from '../desktop/workspace.mjs'
import {findMatches, replaceMatches, emptyQuery, newlines, withNewlines, updateMixed, encodings} from '../shared/text.mjs'
import {formatJsonText} from '../shared/json.mjs'

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-tests-'))
  t.after(() => fs.rm(dir, {recursive: true, force: true}))
  return dir
}

test('F05 preserves Unicode BOMs, legacy encodings and mixed line endings', () => {
  for (const encoding of encodings) {
    const text = ['GB18030', 'UTF-8', 'UTF-8 BOM', 'UTF-16 LE', 'UTF-16 BE', 'UTF-32 LE', 'UTF-32 BE'].includes(encoding) ? 'a\r\n中🙂\nend\r' : 'a\r\nb\nend\r'
    const doc = {...newlines(text), encoding}
    const bytes = encode(doc)
    const read = decode(bytes, encoding)
    assert.equal(read.lossy, false, encoding)
    assert.equal(withNewlines(read), text, encoding)
    assert.deepEqual(encode(read), bytes, encoding)
  }
  for (const encoding of ['UTF-8 BOM', 'UTF-16 LE', 'UTF-16 BE', 'UTF-32 LE', 'UTF-32 BE']) assert.equal(decode(encode({text: '中\n', eol: 'CRLF', encoding})).encoding, encoding)
  assert.throws(() => encode({encoding: 'Windows-1252', text: '中', eol: 'LF'}), /cannot be represented/)
  assert.throws(() => encode({encoding: 'UTF-8', text: '\ud800', eol: 'LF'}), /surrogate/)
  const doc = newlines('a\r\nb\nc\r')
  const change = [{from: 0, to: 0, insert: 'new\n'}]
  assert.equal(withNewlines({...doc, mixed: updateMixed(doc.text, doc.mixed, change, doc.eol), text: replaceMatches(doc.text, change)}), 'new\r\na\r\nb\nc\r')
})

test('F03 distinguishes literal, extended, regex, word and selection search', () => {
  assert.equal(findMatches('x. x x.', {...emptyQuery, needle: 'x.'}).matches.length, 2)
  assert.equal(findMatches('foo\nbar', {...emptyQuery, needle: 'foo\\nbar', mode: 'extended'}).matches.length, 1)
  assert.equal(findMatches('中文 中文字 中文', {...emptyQuery, needle: '中文', whole: true}).matches.length, 2)
  const query = {...emptyQuery, mode: 'regex', needle: '(?<word>[a-z]+):(\\d+)', replacement: '$2/$<word>'}
  const text = 'row:17\nrow:20'
  assert.equal(replaceMatches(text, findMatches(text, query).matches), '17/row\n20/row')
  assert.equal(findMatches(text, query, {from: 7, to: 13}).matches.length, 1)
  assert.equal(findMatches('🙂!', {...emptyQuery, needle: '(?=.)', mode: 'regex'}).matches.length, 2)
  assert.throws(() => findMatches('x', {...emptyQuery, needle: '(', mode: 'regex'}), SyntaxError)
  assert.equal(findMatches('xx', {...emptyQuery, needle: 'x'}, {limit: 1}).truncated, true)
})

test('F03 Boost search supports Notepad++ reset, newline, anchors and case conversions', async () => {
  const module = await WebAssembly.compile(await fs.readFile(new URL('../shared/boost-regex.wasm', import.meta.url)))
  const pattern = {...emptyQuery, mode: 'regex', needle: '\\Aé😀\\Rprefix: \\K(?<word>value)\\z', replacement: '\\U$+{word}\\E'}
  assert.deepEqual(findBoostMatches(module, 'é😀\nprefix: value', pattern).matches, [{from: 12, to: 17, insert: 'VALUE'}])
  assert.throws(() => findBoostMatches(module, 'x', {...pattern, needle: '('}), /Invalid Boost regular expression/)
})

test('F01/F07 atomically save, back up and reject a stale fingerprint', async t => {
  const dir = await fixture(t)
  const file = path.join(dir, '测试.txt')
  await fs.writeFile(file, 'original\r\n')
  const opened = await readDocument(file)
  await saveDocument(file, {...opened, text: 'updated\n'}, opened.fingerprint, {backup: true})
  assert.equal(await fs.readFile(file, 'utf8'), 'updated\r\n')
  assert.equal(await fs.readFile(`${file}.margin-backup`, 'utf8'), 'original\r\n')
  await assert.rejects(saveDocument(file, opened, opened.fingerprint), /changed on disk/)
  assert.equal(await fs.readFile(file, 'utf8'), 'updated\r\n')
  assert.deepEqual((await fs.readdir(dir)).sort(), ['测试.txt', '测试.txt.margin-backup'])
})

test('F03 workspace preview filters by depth and preflights selected files before writes', async t => {
  const dir = await fixture(t)
  const sub = path.join(dir, 'nested')
  await fs.mkdir(sub)
  const a = path.join(dir, 'a.txt'), b = path.join(sub, 'b.txt')
  await Promise.all([fs.writeFile(a, 'error 7\r\n'), fs.writeFile(b, 'error 9\n'), fs.writeFile(path.join(dir, 'skip.md'), 'error 8')])
  const query = {...emptyQuery, needle: 'error (\\d+)', replacement: 'fixed $1', mode: 'regex'}
  assert.equal((await searchWorkspace(dir, query, {glob: '*.txt', depth: 0})).total, 1)
  const preview = await searchWorkspace(dir, query, {glob: '*.txt', depth: 2, preview: true})
  assert.equal(preview.total, 2)
  assert.equal(preview.files.find(file => file.path === a).results[0].after, 'fixed 7')
  await fs.writeFile(b, 'third-party edit')
  await assert.rejects(applyWorkspace(preview, query, [a, b]), /changed since preview/)
  assert.equal(await fs.readFile(a, 'utf8'), 'error 7\r\n')
  assert.deepEqual(await applyWorkspace(preview, query, [a]), {saved: [a]})
  assert.equal(await fs.readFile(a, 'utf8'), 'fixed 7\r\n')
  assert.equal(await fs.readFile(b, 'utf8'), 'third-party edit')
})

test('F04 large-file pages are bounded and do not split a UTF-8 code point', async t => {
  const file = path.join(await fixture(t), 'large.log')
  const handle = await fs.open(file, 'w')
  try {
    await handle.truncate(EDIT_LIMIT + PAGE_SIZE)
    await handle.write(Buffer.from('start\n'), 0, 6, 0)
    const sample = Buffer.from('🙂\nsecond')
    await handle.write(sample, 0, sample.length, PAGE_SIZE - 2)
  } finally { await handle.close() }
  await assert.rejects(readDocument(file), /read limit/)
  const one = await readLargePage(file, 'UTF-8')
  const two = await readLargePage(file, 'UTF-8', 1)
  assert.equal(one.large.end, PAGE_SIZE - 2)
  assert.equal(two.large.offset, one.large.end)
  assert.ok(two.text.startsWith('🙂\nsecond'))
  assert.equal(two.readOnly, true)
  assert.equal(two.lossy, false)
})

test('F04 paged writes preserve untouched bytes and whole-file search finds a boundary-spanning match', async t => {
  const file = path.join(await fixture(t), 'pages.log')
  const prefix = Buffer.alloc(PAGE_SIZE - 4, 0x2e)
  const suffix = Buffer.alloc(EDIT_LIMIT, 0x2e)
  await fs.writeFile(file, Buffer.concat([prefix, Buffer.from('\r\nabcEND\n'), suffix]))
  const before = await readLargePage(file, 'UTF-8')
  assert.equal(before.readOnly, false)
  const found = await searchLargeFile(file, before.encoding, before.fingerprint, {...emptyQuery, mode: 'extended', needle: '\\nabcEND'})
  assert.equal(found.matches.length, 1)
  assert.equal(found.matches[0].page, 0)
  assert.equal(found.matches[0].crossesPage, true)
  await saveLargePage(file, {...before, text: `START${before.text.slice(5)}`}, before.fingerprint)
  const bytes = await fs.readFile(file)
  assert.equal(bytes.subarray(0, 5).toString(), 'START')
  assert.deepEqual(bytes.subarray(5, PAGE_SIZE - 4), prefix.subarray(5))
  assert.equal(bytes.subarray(PAGE_SIZE - 4, PAGE_SIZE + 5).toString(), '\r\nabcEND\n')
  assert.ok(bytes.subarray(PAGE_SIZE + 5).equals(suffix))
  await assert.rejects(saveLargePage(file, before, before.fingerprint), /changed on disk/)
})

test('F12 JSON formatting preserves raw numeric and string literals and duplicate keys', () => {
  const input = '{"x":9007199254740993,"x":1e999,"y":"\\u00e9","z":[{},true]}\n'
  const expected = '{\n  "x": 9007199254740993,\n  "x": 1e999,\n  "y": "\\u00e9",\n  "z": [\n    {},\n    true\n  ]\n}\n'
  assert.equal(formatJsonText(input), expected)
  assert.equal(formatJsonText(expected, 0), input.trim())
  assert.throws(() => formatJsonText('[1,]'), SyntaxError)
})
