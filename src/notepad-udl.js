import {StreamLanguage, foldService, HighlightStyle, syntaxHighlighting} from '@codemirror/language'
import {Tag, tags} from '@lezer/highlight'

function words(value) {
  return Array.from(value.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g), item => item[1] ?? item[2] ?? item[3]).filter(Boolean)
}

function numbered(value) {
  const fields = new Map()
  const matches = [...value.matchAll(/(?:^|\s)(\d\d)(?=\S|\s|$)/g)]
  for (const [i, match] of matches.entries()) {
    const content = value.slice(match.index + match[0].length, matches[i + 1]?.index).trim()
    const alternatives = content.startsWith('((') && content.endsWith('))') ? words(content.slice(2, -2)) : content ? [content] : []
    fields.set(Number(match[1]), alternatives)
  }
  return fields
}

function pairs(open, close, extra = {}) {
  return open.flatMap((start, index) => {
    const end = close[index] ?? close[0]
    return end ? [{start, end, ...extra}] : []
  })
}

export function readNotepadLanguages(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('The UDL file is not valid XML.')
  const modes = [...xml.querySelectorAll('UserLang[name]')].map(node => {
    const lists = new Map([...node.querySelectorAll('KeywordLists > Keywords[name]')].map(item => [item.getAttribute('name'), item.textContent]))
    const get = name => lists.get(name) ?? ''
    const globals = node.querySelector('Settings > Global')
    const prefixes = node.querySelector('Settings > Prefix')
    const comments = numbered(get('Comments'))
    const delimiters = numbered(get('Delimiters'))
    const openers = [...pairs(comments.get(3) ?? [], comments.get(4) ?? [], {token: 'comment', escape: ''})]
    for (let i = 0; i < 8; i++) openers.push(...pairs(delimiters.get(i * 3) ?? [], delimiters.get(i * 3 + 2) ?? [], {token: `delimiter${i + 1}`, escape: delimiters.get(i * 3 + 1)?.[0] ?? ''}))
    const groups = Array.from({length: 8}, (_, i) => ({token: `keyword${i + 1}`, prefix: prefixes?.getAttribute(`Keywords${i + 1}`) === 'yes', words: words(get(`Keywords${i + 1}`))}))
    const styles = Object.fromEntries([...node.querySelectorAll('Styles > WordsStyle[name]')].flatMap(style => {
      const name = style.getAttribute('name')
      const token = name === 'COMMENTS' || name === 'LINE COMMENTS' ? 'comment' : name === 'OPERATORS' ? 'operator' : name === 'NUMBERS' ? 'number' : /^KEYWORDS[1-8]$|^DELIMITERS[1-8]$/.test(name) ? name.toLowerCase().replace(/^(keywords|delimiters)/, group => group.slice(0, -1)) : null
      const color = style.getAttribute('fgColor')
      return token && /^[\da-f]{6}$/i.test(color ?? '') && Number(style.getAttribute('colorStyle') ?? 3) & 1 ? [[token, `#${color}`]] : []
    }))
    return {name: node.getAttribute('name'), extensions: node.getAttribute('ext') ?? '', keywords: groups.flatMap(group => group.words).join(' '), comment: comments.get(0)?.[0] ?? '', udl: {
      groups, styles, openers, lineComments: comments.get(0) ?? [], ignoreCase: globals?.getAttribute('caseIgnored') === 'yes',
      operators: words(get('Operators1')), wordOperators: words(get('Operators2')),
      folds: [1, 2].flatMap(i => pairs(words(get(`Folders in code${i}, open`)), words(get(`Folders in code${i}, close`)))),
    }}
  }).filter(mode => mode.name.trim())
  if (!modes.length) throw new Error('No Notepad++ UserLang entries were found.')
  return modes
}

export function udlMode(mode) {
  const {udl} = mode
  const norm = value => udl.ignoreCase ? value.toLowerCase() : value
  const compare = (stream, token) => norm(stream.string.slice(stream.pos, stream.pos + token.length)) === norm(token)
  const take = (stream, token) => { if (!compare(stream, token)) return false; stream.pos += token.length; return true }
  const operators = [...udl.operators].sort((a, b) => b.length - a.length)
  const openers = [...udl.openers].sort((a, b) => b.start.length - a.start.length)
  const wordOperators = new Set(udl.wordOperators.map(norm))
  const groups = udl.groups.map(group => ({...group, words: group.words.map(norm)}))
  const tokenTable = {comment: tags.comment, operator: tags.operator, number: tags.number}
  for (let i = 1; i <= 8; i++) { tokenTable[`keyword${i}`] = tags.keyword; tokenTable[`delimiter${i}`] = tags.string }
  const styles = Object.entries(udl.styles).flatMap(([token, color]) => {
    if (!tokenTable[token] || !/^#[a-f\d]{6}$/i.test(color)) return []
    const tag = Tag.define()
    tokenTable[token] = tag
    return [{tag, color}]
  })
  const language = StreamLanguage.define({
    languageData: {commentTokens: {line: udl.lineComments[0], block: udl.openers[0]?.token === 'comment' ? {open: udl.openers[0].start, close: udl.openers[0].end} : undefined}},
    tokenTable,
    startState: () => ({open: null}),
    token(stream, state) {
      const consume = rule => {
        while (!stream.eol()) {
          if (rule.escape && take(stream, rule.escape)) { stream.next(); continue }
          if (take(stream, rule.end)) { state.open = null; break }
          stream.next()
        }
        return rule.token
      }
      if (state.open) return consume(state.open)
      if (stream.eatSpace()) return null
      const comment = udl.lineComments.find(token => take(stream, token))
      if (comment) { stream.skipToEnd(); return 'comment' }
      const opener = openers.find(rule => take(stream, rule.start))
      if (opener) { state.open = opener; return consume(opener) }
      if (operators.some(token => take(stream, token))) return 'operator'
      if (stream.match(/^(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/)) return 'number'
      if (stream.match(/^[\p{L}_][\p{L}\p{N}_]*/u)) {
        const word = norm(stream.current())
        if (wordOperators.has(word)) return 'operator'
        return groups.find(group => group.words.some(keyword => group.prefix ? word.startsWith(keyword) : word === keyword))?.token ?? null
      }
      stream.next()
      return null
    },
  })
  const fold = foldService.of((state, from, to) => {
    const line = state.doc.lineAt(from)
    const rule = udl.folds.find(({start}) => norm(line.text.trimStart()).startsWith(norm(start)))
    if (!rule) return null
    let depth = 1
    for (let number = line.number + 1; number <= Math.min(state.doc.lines, line.number + 10000); number++) {
      const next = state.doc.line(number)
      const value = norm(next.text.trimStart())
      if (value.startsWith(norm(rule.end)) && --depth === 0) return next.from > to ? {from: to, to: next.from - 1} : null
      if (value.startsWith(norm(rule.start))) depth++
    }
    return null
  })
  return [language, fold, styles.length ? syntaxHighlighting(HighlightStyle.define(styles)) : []]
}
