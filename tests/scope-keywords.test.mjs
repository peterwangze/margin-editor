import assert from 'node:assert/strict'
import {test} from 'node:test'
import {EditorState} from '@codemirror/state'
import {ensureSyntaxTree} from '@codemirror/language'
import {languages} from '@codemirror/language-data'
import {highlightTree, tagHighlighter, tags} from '@lezer/highlight'
import {indexScopeKeywords, isScopeKeywordWord, matchScopeKeyword, scopeRulesFor} from '../shared/scope-keywords.mjs'

const keywords = tagHighlighter([{tag: tags.keyword, class: 'keyword'}])

async function fixture(mode, source, complete = true) {
  const rules = scopeRulesFor(mode)
  const language = await languages.find(language => language.name === mode).load()
  const state = EditorState.create({doc: source, extensions: [language]})
  const tree = ensureSyntaxTree(state, state.doc.length, 200)
  assert.ok(tree)
  const words = []
  highlightTree(tree, keywords, (from, to) => {
    for (const match of source.slice(from, to).matchAll(/[A-Za-z_][\w$]*/g)) {
      if (isScopeKeywordWord(rules, match[0])) words.push({from: from + match.index, to: from + match.index + match[0].length, text: match[0]})
    }
  })
  const index = indexScopeKeywords(state.doc, words, rules, complete)
  return {
    at(position) { return matchScopeKeyword(index, position) },
    in(text, skip = 0) {
      const from = source.indexOf(text)
      assert.notEqual(from, -1)
      return matchScopeKeyword(index, from + skip)
    },
    text(range) { return source.slice(range.from, range.to) },
  }
}

test('matches nested Verilog families and rejects contextual lookalikes', async () => {
  const model = await fixture('SystemVerilog', [
    '`define SAMPLE begin end',
    'module outer;',
    '  // begin end',
    '  string message = "begin end";',
    '  logic \\end ;',
    '  initial begin',
    '    casex (value)',
    '      default: begin value = 1; end',
    '    endcase',
    '    fork',
    '      wait fork;',
    '      disable fork;',
    '      value = 2;',
    '    join_any',
    '  end',
    'endmodule',
    'typedef class Prototype;',
    'virtual interface Ch link;',
    'extern function int run();',
    'assert property (value);',
  ].join('\n'))
  for (const [query, cursor, expected] of [
    ['module outer', 6, 'endmodule'], ['initial begin', 8, 'end'], ['casex', 3, 'endcase'],
    ['default: begin', 9, 'end'], ['join_any', 8, 'fork'], ['endmodule', 3, 'module'],
  ]) {
    const result = model.in(query, cursor)
    assert.equal(result?.matched, true, query)
    assert.equal(model.text(result.end), expected, query)
  }
  assert.deepEqual(model.in('default: begin', 9).end, model.in('end\n    endcase').start)
  assert.deepEqual(model.in('initial begin', 8).end, model.in('end\nendmodule').start)
  for (const [query, cursor] of [
    ['SAMPLE begin', 8], ['// begin', 3], ['"begin', 1], ['\\end', 1], ['wait fork', 5], ['disable fork', 8],
    ['typedef class', 8], ['virtual interface', 8], ['extern function', 7], ['assert property', 7],
  ]) assert.equal(model.in(query, cursor), null, query)
})

test('keeps typed mismatches separate and suppresses unfinished openings in a prefix', async () => {
  const crossed = await fixture('Verilog', 'module test;\nbegin\nendmodule\nend\n')
  assert.equal(crossed.in('module test')?.matched, false)
  assert.equal(crossed.in('endmodule')?.matched, false)
  assert.equal(crossed.in('begin')?.matched, true)
  assert.equal(crossed.in('endmodule', 7)?.end, undefined)
  assert.equal((await fixture('Verilog', 'begin', false)).in('begin'), null)
  assert.equal((await fixture('Verilog', 'begin', true)).in('begin')?.matched, false)
  assert.equal((await fixture('Verilog', '  ', true)).at(1), null)
})

test('matches a case-insensitive VHDL closer from either word', async () => {
  const model = await fixture('VHDL', [
    'example: POSTPONED PROCESS (clk)',
    'BEGIN',
    '  IF rising_edge(clk) THEN',
    '    signal_value <= 1;',
    '  END  IF;',
    'END POSTPONED PROCESS example;',
    'other: IF enable GENERATE',
    '   x <= y;',
    'END GENERATE;',
  ].join('\n'))
  for (const [query, cursor, start, end] of [
    ['IF rising_edge', 1, 'IF', 'END  IF'], ['END  IF', 5, 'END  IF', 'IF'],
    ['END POSTPONED PROCESS', 5, 'END POSTPONED PROCESS', 'PROCESS'],
  ]) {
    const result = model.in(query, cursor)
    assert.equal(result?.matched, true)
    assert.equal(model.text(result.start), start)
    assert.equal(model.text(result.end), end)
  }
  assert.equal(model.in('IF enable'), null)
  assert.equal(model.in('END GENERATE'), null)
})

test('matches Lua scopes through nested loops and ignores Shell argument keywords', async () => {
  const lua = await fixture('Lua', 'function f()\n  for i = 1, 4 do\n    if i > 2 then print("end") end\n  end\n  repeat i = i + 1 until i > 10\nend')
  assert.deepEqual(lua.in('4 do', 2).end, lua.in('  end\n  repeat', 2).start)
  assert.equal(lua.text(lua.in('repeat').end), 'until')
  assert.equal(lua.in('for i'), null)
  assert.equal(lua.in('"end"', 1), null)

  const shell = await fixture('Shell', 'if true; then\n  echo if fi do done\n  printf "%s" \\\n    if\n  for name in "$@"; do\n    echo "$name"\n  done\nfi\nrun() { if false; then echo hello; fi; }')
  assert.equal(shell.text(shell.at(0).end), 'fi')
  assert.equal(shell.text(shell.in('; do', 2).end), 'done')
  assert.equal(shell.in('echo if', 5), null)
  assert.equal(shell.in('fi do done'), null)
  assert.equal(shell.in('    if', 4), null)
  assert.equal(shell.text(shell.in('{ if false', 2).end), 'fi')
})

test('matches Pascal declaration and statement scopes without opening a variant record twice', async () => {
  const model = await fixture('Pascal', [
    'type TForward = class;',
    'type TShape = RECORD',
    '  case Kind of',
    '    1: (Radius: Integer);',
    'END;',
    'BEGIN',
    '  REPEAT',
    '    x := x + 1;',
    '  UNTIL x > 10;',
    'END.',
  ].join('\n'))
  assert.equal(model.in('class'), null)
  assert.equal(model.in('case Kind'), null)
  assert.equal(model.text(model.in('RECORD').end), 'END')
  assert.equal(model.text(model.in('BEGIN').end), 'END')
  assert.equal(model.text(model.in('UNTIL').end), 'REPEAT')
})
