import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectText, planCleanup} from '../shared/inspect-text.mjs'

const all = text => [{from: 0, to: text.length}]
const result = (text, changes) => changes.reduceRight((value, {from, to, insert}) => value.slice(0, from) + insert + value.slice(to), text)

test('text inspection counts multilingual words and graphemes, and names hidden characters', () => {
  const text = '中文 e\u0301 👩‍💻\u00a0x\u200b\t'
  const stats = inspectText(text, all(text))
  assert.equal(stats.wordCount, 3)
  assert.equal(stats.characterCount, 10)
  assert.equal(stats.tabs, 1)
  assert.deepEqual(stats.characters.map(item => item.code), ['U+00A0', 'U+200B', 'U+200D'])
  assert.equal(inspectText(text, [{from: 3, to: 5}]).characterCount, 1)
})

test('cleanup touches selected offsets only and does not trim a line split across pages', () => {
  const text = 'a\u00a0b\u200b\u200d \t\nc  d   '
  const range = [{from: 0, to: 6}, {from: 11, to: text.length}]
  const plan = planCleanup(text, range, {trim: true, noBreak: true, zeroWidth: true}, true)
  assert.equal(result(text, plan.changes), 'a b\u200d\t\nc  d   ')
  assert.equal(plan.changedLines, 1)
  assert.match(plan.preview[0].before, /U\+200B/)
  assert.match(plan.preview[0].after, /U\+200D/)
  assert.equal(planCleanup(text, all(text), {}, false).changedLines, 0)
  const unicodeLineSeparator = 'a  \u2028b  '
  assert.equal(result(unicodeLineSeparator, planCleanup(unicodeLineSeparator, all(unicodeLineSeparator), {trim: true}).changes), 'a  \u2028b')
})
