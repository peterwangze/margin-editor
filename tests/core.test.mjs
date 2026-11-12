import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {encode, decode} from '../desktop/codec.mjs'
import {readDocument, saveDocument} from '../desktop/files.mjs'
import {searchWorkspace, applyWorkspace} from '../desktop/workspace.mjs'
import {findMatches, replaceMatches, emptyQuery, newlines, withNewlines, updateMixed, encodings} from '../shared/text.mjs'

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
