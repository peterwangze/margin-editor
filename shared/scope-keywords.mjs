function rulesFor(pairs, options = {}) {
  const openings = new Set()
  const closings = new Map()
  const compounds = new Map()
  const words = new Set(options.contextWords)
  for (const [starts, ends] of pairs) {
    for (const start of starts) {
      openings.add(start)
      words.add(start)
    }
    for (const end of ends) {
      const allowed = closings.get(end) ?? new Set()
      starts.forEach(start => allowed.add(start))
      closings.set(end, allowed)
      const parts = end.split(' ')
      parts.forEach(word => words.add(word))
      if (parts.length > 1) compounds.set(parts[0], [...(compounds.get(parts[0]) ?? []), parts])
    }
  }
  for (const parts of compounds.values()) parts.sort((a, b) => b.length - a.length)
  return {openings, closings, compounds, words, ...options}
}

function verilogToken({word, range, before, after, opening}) {
  if (before.includes('`define')) {
    const lines = before.split(/\r?\n/)
    let line = lines.length - 1
    while (line > 0 && lines[line - 1].trimEnd().endsWith('\\')) line--
    if ((line > 0 || range.from === before.length) && /^\s*`define\b/.test(lines[line])) return false
  }
  if (before.includes('\\') && before.match(/\S*$/)?.[0].includes('\\')) return false
  if (!opening) return true

  const statement = /\b(?:wait|disable|typedef|virtual|extern|import|export|pure|with)\b/.test(before)
    ? before.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, ' ').split(/[;{}]/).at(-1)
    : ''
  if (word === 'fork') return !/\b(?:wait|disable)\s*$/.test(statement)
  if (word === 'class') return !/\btypedef\s*$/.test(statement)
  if (word === 'interface') return !/\bvirtual\s*$/.test(statement) && !/^\s*class\b/.test(after)
  if (word === 'property') return /^\s+[A-Za-z_\\]/.test(after)
  if (word === 'clocking') return /^\s*(?:[A-Za-z_][\w$]*\s*)?@/.test(after)
  if (word === 'function' || word === 'task') {
    return !/\b(?:extern|import|export|pure|typedef)\b|\bwith\s*$/.test(statement)
  }
  return !/\bextern\s*$/.test(statement)
}

function shellToken({before, range}) {
  // The Shell lexer also calls many of these words keywords in command arguments.
  if (/\\\r?\n[\t ]*$/.test(before)) return false
  const prefix = range.from === before.length ? before : `x${before}`
  return /(?:^|\n|(?<!\\);|&&|\|\|)[\t ]*(?:(?:then|else|do|!)[\t ]+)*$/.test(prefix) ||
    /(?:^|\n|(?<!\\);)[\t ]*(?:(?:function[\t ]+)?[A-Za-z_][\w-]*[\t ]*\([\t ]*\)[\t ]*)?[({][\t ]*$/.test(prefix)
}

function vhdlToken({word, opening, following, read, range}) {
  if (!opening || word !== 'if') return true
  // An if-generate uses `end generate`, whereas a sequential if has `then`.
  for (const next of following) {
    if (next.from - range.to > 512 || read(range.to, next.from).includes(';')) break
    const value = next.text.toLowerCase()
    if (value === 'then' || value === 'generate' || value === 'end') return value === 'then'
  }
  return false
}

function pascalToken({word, before, after, opening, top}) {
  if (!opening) return word !== 'end' || top || !/^\s*\./.test(after)
  if (word === 'case') return top !== 'record'
  if (word === 'class' || word === 'object' || word === 'interface') {
    return /=\s*$/.test(before) && !/^\s*(?:of\b|;)/i.test(after)
  }
  return true
}

const verilogPairs = [
  [['begin'], ['end']], [['module', 'macromodule'], ['endmodule']],
  [['case', 'casex', 'casez', 'randcase'], ['endcase']],
  [['fork'], ['join', 'join_any', 'join_none']],
  ...['function', 'task', 'generate', 'primitive', 'specify', 'table', 'config', 'class', 'interface', 'package',
    'program', 'property', 'sequence', 'clocking', 'checker'].map(word => [[word], [`end${word}`]]),
  [['covergroup'], ['endgroup']],
]
const verilog = rulesFor(verilogPairs, {tokenAllowed: verilogToken})
const rulesByMode = new Map([
  ['Verilog', verilog], ['SystemVerilog', verilog],
  ['Lua', rulesFor([[['function', 'if', 'do'], ['end']], [['repeat'], ['until']]])],
  ['Shell', rulesFor([[['if'], ['fi']], [['do'], ['done']]], {tokenAllowed: shellToken})],
  ['Pascal', rulesFor([
    [['begin', 'case', 'record', 'try', 'asm', 'class', 'object', 'interface'], ['end']], [['repeat'], ['until']],
  ], {ignoreCase: true, tokenAllowed: pascalToken})],
  ['VHDL', rulesFor([
    ...['if', 'case', 'loop', 'block', 'record'].map(word => [[word], [`end ${word}`]]),
    [['process'], ['end process', 'end postponed process']],
  ], {ignoreCase: true, contextWords: ['then', 'generate'], tokenAllowed: vhdlToken})],
])

export function scopeRulesFor(modeName) {
  return rulesByMode.get(modeName)
}

const normalize = (rules, text) => rules.ignoreCase ? text.toLowerCase() : text

export function isScopeKeywordWord(rules, text) {
  return Boolean(rules?.words.has(normalize(rules, text)))
}

function compoundAt(words, index, rules, read) {
  const first = normalize(rules, words[index].text)
  for (const parts of rules.compounds.get(first) ?? []) {
    const found = parts.slice(1).every((part, offset) => {
      const next = words[index + offset + 1]
      return next && normalize(rules, next.text) === part && /^\s+$/.test(read(words[index + offset].to, next.from))
    })
    if (found) return parts
  }
  return [first]
}

function* afterWords(words, index) {
  for (let next = index + 1; next < words.length; next++) yield words[next]
}

export function indexScopeKeywords(source, words, rules, complete = true) {
  const read = typeof source === 'string' ? (from, to) => source.slice(from, to) : (from, to) => source.sliceString(from, to)
  const entries = []
  const stack = []
  for (let index = 0; index < words.length; index++) {
    const token = words[index]
    const parts = compoundAt(words, index, rules, read)
    index += parts.length - 1
    const word = parts.join(' ')
    const opening = rules.openings.has(word)
    const expected = rules.closings.get(word)
    if (!opening && !expected) continue
    const range = {from: token.from, to: words[index].to}
    const top = stack.at(-1)
    if (rules.tokenAllowed && !rules.tokenAllowed({word, range, opening, top: top?.word, read,
      get before() { return read(Math.max(0, range.from - 1024), range.from) },
      get after() { return read(range.to, Math.min(source.length, range.to + 256)) },
      get following() { return afterWords(words, index) },
    })) continue

    const entry = {word, range, opening, partner: null}
    entries.push(entry)
    if (opening) stack.push(entry)
    else if (expected.has(top?.word)) {
      entry.partner = stack.pop().range
      top.partner = range
    }
  }
  return {entries, complete}
}

export function matchScopeKeyword({entries, complete}, offset) {
  let start = 0
  let end = entries.length
  while (start < end) {
    const middle = (start + end) >>> 1
    if (entries[middle].range.to < offset) start = middle + 1
    else end = middle
  }
  const entry = entries[start]
  if (!entry || entry.range.from > offset) return null
  if (entry.partner) return {start: entry.range, end: entry.partner, matched: true}
  return !entry.opening || complete ? {start: entry.range, matched: false} : null
}
