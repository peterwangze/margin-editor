import {ensureSyntaxTree, syntaxTree, syntaxTreeAvailable} from '@codemirror/language'
import {Decoration, ViewPlugin} from '@codemirror/view'
import {highlightTree, tagHighlighter, tags} from '@lezer/highlight'
import {indexScopeKeywords, isScopeKeywordWord, matchScopeKeyword, scopeRulesFor} from '../shared/scope-keywords.mjs'

const keywordHighlighter = tagHighlighter([{tag: tags.keyword, class: 'keyword'}])
const matching = Decoration.mark({class: 'cm-matchingScopeKeyword'})
const unmatched = Decoration.mark({class: 'cm-nonmatchingScopeKeyword'})
const scopeScanDistance = 20_000

function scopeWords(tree, doc, from, to, rules) {
  const words = []
  highlightTree(tree, keywordHighlighter, (start, end) => {
    // The highlighter can combine contiguous keyword spans.
    for (const match of doc.sliceString(start, end).matchAll(/[A-Za-z_][\w$]*/g)) {
      if (!isScopeKeywordWord(rules, match[0])) continue
      const from = start + match.index
      const to = from + match[0].length
      if (/[\w$]/.test(doc.sliceString(Math.max(0, from - 1), from)) || /[\w$]/.test(doc.sliceString(to, to + 1))) continue
      words.push({from, to, text: match[0]})
    }
  }, from, to)
  return words
}

export function scopeKeywordMatching(modeName) {
  const rules = scopeRulesFor(modeName)
  if (!rules) return []
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.cache = null
      this.paused = false
      this.decorations = this.highlight(view.state)
    }

    update({state, startState, docChanged, selectionSet, view}) {
      if (docChanged) this.cache = null
      if (view.composing) {
        this.paused = true
        this.decorations = Decoration.none
      } else if (this.paused || docChanged || selectionSet || syntaxTree(state) !== syntaxTree(startState)) {
        this.paused = false
        this.decorations = this.highlight(state)
      }
    }

    indexAt(state, offset) {
      const {doc} = state
      const block = Math.floor(offset / scopeScanDistance) * scopeScanDistance
      const wholeDocument = doc.length <= scopeScanDistance * 3
      const from = wholeDocument ? 0 : Math.max(0, block - scopeScanDistance)
      const to = wholeDocument ? doc.length : Math.min(doc.length, block + 2 * scopeScanDistance)
      const currentTree = syntaxTree(state)
      const tree = currentTree.length >= to && syntaxTreeAvailable(state, to)
        ? currentTree
        : ensureSyntaxTree(state, to, 8)
      if (!tree) return null

      const cached = this.cache
      if (cached?.tree === tree && cached.doc === doc && cached.from === from && cached.to === to) return cached
      const complete = from === 0 && to === doc.length
      const index = indexScopeKeywords(doc, scopeWords(tree, doc, from, to, rules), rules, complete)
      return this.cache = {doc, tree, from, to, complete, index}
    }

    highlight(state) {
      const marks = new Map()
      for (const cursor of state.selection.ranges) {
        if (!cursor.empty) continue
        const word = state.wordAt(cursor.head)
        if (!word || !isScopeKeywordWord(rules, state.sliceDoc(word.from, word.to))) continue
        const entry = this.indexAt(state, cursor.head)
        if (!entry) continue
        const match = matchScopeKeyword(entry.index, cursor.head)
        if (!match || (!match.matched && !entry.complete)) continue
        const mark = match.matched ? matching : unmatched
        marks.set(match.start.from, mark.range(match.start.from, match.start.to))
        if (match.end) marks.set(match.end.from, mark.range(match.end.from, match.end.to))
      }
      return Decoration.set([...marks.values()], true)
    }
  }, {decorations: plugin => plugin.decorations})
}
