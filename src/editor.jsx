import {useEffect, useLayoutEffect, useRef} from 'react'
import {EditorState, Compartment, Annotation, StateEffect, StateField, Transaction, EditorSelection} from '@codemirror/state'
import {EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars, highlightWhitespace, Decoration, GutterMarker, gutter, placeholder} from '@codemirror/view'
import {defaultKeymap, history, historyKeymap, indentWithTab, invertedEffects} from '@codemirror/commands'
import {foldGutter, foldKeymap, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting, HighlightStyle, StreamLanguage, foldable, foldEffect, ensureSyntaxTree} from '@codemirror/language'
import {closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap} from '@codemirror/autocomplete'
import {highlightSelectionMatches} from '@codemirror/search'
import {languages} from '@codemirror/language-data'
import {tags} from '@lezer/highlight'
import {updateMixed} from '../shared/text.mjs'
import {udlMode} from './notepad-udl'
import {useLocale} from './i18n'

export const syntax = syntaxHighlighting(HighlightStyle.define([
  {tag: [tags.propertyName, tags.keyword, tags.controlKeyword, tags.heading], color: 'var(--token-key)'},
  {tag: [tags.string, tags.regexp, tags.inserted], color: 'var(--token-string)'},
  {tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--token-number)'},
  {tag: [tags.comment, tags.meta], color: 'var(--token-comment)', fontStyle: 'italic'},
  {tag: [tags.typeName, tags.function(tags.variableName), tags.tagName], color: 'var(--token-blue)'},
  {tag: [tags.link, tags.url], color: 'var(--token-blue)', textDecoration: 'underline'},
  {tag: tags.strong, fontWeight: '700'}, {tag: tags.emphasis, fontStyle: 'italic'},
  {tag: tags.invalid, color: 'var(--danger)'},
]))

export const syncChange = Annotation.define()
const setMatches = StateEffect.define()
const setBookmarks = StateEffect.define()
const setOverwrite = StateEffect.define()
const setFormat = StateEffect.define()
const undoFormat = StateEffect.define()

function changesFor(changeSet) {
  const changes = []
  changeSet.iterChanges((from, to, _start, _end, insert) => changes.push({from, to, insert: insert.toString()}))
  return changes
}

const formatField = StateField.define({
  create: () => ({eol: 'LF', mixed: null, version: 0}),
  update(format, tr) {
    const reset = tr.effects.findLast(effect => effect.is(setFormat))
    if (reset) return reset.value
    const restored = tr.effects.findLast(effect => effect.is(undoFormat) && effect.value.version === format.version)
    if (restored && restored.value.mixed.length === tr.newDoc.lines - 1) return restored.value
    if (!tr.docChanged || !format.mixed) return format
    return {...format, mixed: updateMixed(tr.startState.doc.toString(), format.mixed, changesFor(tr.changes), format.eol)}
  },
})

const rememberFormat = invertedEffects.of(tr => {
  const format = tr.startState.field(formatField)
  return tr.docChanged && format.mixed ? [undoFormat.of(format)] : []
})

export function syncEditor(view, changes, doc) {
  view.dispatch({changes, effects: setFormat.of({eol: doc.eol, mixed: doc.mixed, version: doc.formatVersion ?? 0}), annotations: [syncChange.of(true), Transaction.addToHistory.of(false)]})
}

const searchMarks = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes)
    for (const effect of tr.effects) if (effect.is(setMatches)) {
      value = Decoration.set(effect.value.flatMap(({from, to}, index) => to > from && to <= tr.newDoc.length ? [Decoration.mark({class: index === effect.value.active ? 'search-hit active-hit' : 'search-hit'}).range(from, to)] : []), true)
    }
    return value
  },
  provide: field => EditorView.decorations.from(field),
})

class Bookmark extends GutterMarker {
  elementClass = 'bookmark-gutter-mark'
  constructor(label) { super(); this.label = label }
  eq(other) { return this.label === other.label }
  toDOM() {
    const item = document.createElement('span')
    item.textContent = '●'
    item.title = this.label
    return item
  }
}
const bookmarkField = StateField.define({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setBookmarks)) return effect.value
    if (!tr.docChanged) return value
    return [...new Set(value.map(line => tr.newDoc.lineAt(tr.changes.mapPos(tr.startState.doc.line(Math.min(line, tr.startState.doc.lines)).from, 1)).number))]
  },
})
function bookmarksGutter(t) {
  const bookmark = new Bookmark(t('Bookmark'))
  return gutter({
    class: 'bookmark-gutter',
    lineMarker: (view, block) => view.state.field(bookmarkField).includes(view.state.doc.lineAt(block.from).number) ? bookmark : null,
    lineMarkerChange: update => update.startState.field(bookmarkField) !== update.state.field(bookmarkField),
  })
}

const overwrite = StateField.define({
  create: () => false,
  update(value, tr) { return tr.effects.find(effect => effect.is(setOverwrite))?.value ?? value },
})
const overwriteInput = EditorView.inputHandler.of((view, from, to, text) => {
  if (!view.state.field(overwrite) || from !== to || view.state.selection.ranges.length !== 1 || text.includes('\n')) return false
  const end = Math.min(view.state.doc.lineAt(to).to, to + text.length)
  view.dispatch({changes: {from, to: end, insert: text}, selection: {anchor: from + text.length}, userEvent: 'input.type'})
  return true
})

export function modeFor(doc, custom = []) {
  const extension = doc.name.split('.').at(-1).toLowerCase()
  return custom.find(mode => doc.language === mode.name || (!doc.language && mode.extensions.split(/[ ,]+/).includes(extension)))
    ?? (doc.language ? languages.find(lang => lang.name === doc.language) : languages.find(lang => lang.filename?.test(doc.name) || lang.extensions?.includes(extension)))
}

function customMode(mode) {
  if (mode.udl) return udlMode(mode)
  const keywords = new Set(mode.keywords.split(/\s+/).filter(Boolean))
  return StreamLanguage.define({token(stream) {
    if (stream.eatSpace()) return null
    if (mode.comment && stream.match(mode.comment)) { stream.skipToEnd(); return 'comment' }
    if (stream.match(/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/)) return 'string'
    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number'
    if (stream.match(/^[\p{L}_][\p{L}\p{N}_]*/u)) return keywords.has(stream.current()) ? 'keyword' : null
    stream.next()
    return null
  }})
}

function editorOptions(settings, doc) {
  const large = (doc.size ?? doc.text.length) > 2 * 1024 * 1024
  return [settings.numbers ? lineNumbers() : [], highlightActiveLineGutter(), settings.whitespace && !large ? highlightWhitespace() : [],
    settings.wrap && !large ? EditorView.lineWrapping : [], EditorState.tabSize.of(settings.tabSize), indentUnit.of(settings.spaces ? ' '.repeat(settings.tabSize) : '\t'),
    EditorState.readOnly.of(doc.readOnly), EditorView.editable.of(!doc.readOnly),
    EditorView.contentAttributes.of({dir: (doc.rtl ?? settings.rtl) ? 'rtl' : 'ltr', spellcheck: 'false'}),
    settings.autocomplete && !large ? autocompletion() : [], large ? [] : [foldGutter(), highlightSelectionMatches(), highlightSpecialChars(), bracketMatching(), closeBrackets(), indentOnInput()]]
}

const editorPhrases = [
  'Completions', 'Control character', 'Selection deleted', 'Folded lines', 'Unfolded lines',
  'to', 'folded code', 'unfold', 'Fold line', 'Unfold line', 'Go to line', 'go',
  'replaced match on line $', 'replaced $ matches', 'Find', 'Replace', 'next', 'previous', 'all',
  'match case', 'regexp', 'by word', 'replace', 'replace all', 'close', 'current match', 'on line',
]

function editorInterface(t) {
  return [
    EditorState.phrases.of(Object.fromEntries(editorPhrases.map(phrase => [phrase, t(phrase)]))),
    EditorView.contentAttributes.of({'aria-label': t('Document editor')}),
    placeholder(t('Start typing…')),
    bookmarksGutter(t),
  ]
}

export function markSearch(view, matches, active) {
  if (!view) return
  const values = matches.slice()
  values.active = active
  view.dispatch({effects: setMatches.of(values)})
}

export function setEditorBookmarks(view, lines) { view?.dispatch({effects: setBookmarks.of(lines)}) }
export function toggleOverwrite(view) { if (view) view.dispatch({effects: setOverwrite.of(!view.state.field(overwrite))}) }
export const isOverwrite = view => view?.state.field(overwrite)

export function focusEditor(view) {
  if (!view) return
  const modal = document.querySelector('dialog[open]')
  if (!modal) { view.focus(); return }
  requestAnimationFrame(() => {
    if (view.dom.isConnected && !document.querySelector('dialog[open]')) view.focus()
  })
}

export function goTo(view, line, col = 1) {
  if (!view) return
  const target = view.state.doc.line(Math.max(1, Math.min(line || 1, view.state.doc.lines)))
  view.dispatch({selection: {anchor: target.from + Math.max(0, Math.min(col - 1, target.length))}, scrollIntoView: true})
  focusEditor(view)
}

export function EditorSurface({doc, settings, slot, attach, onEdit, onCursor, activate, onScroll, matches, matchIndex}) {
  const {t} = useLocale()
  const host = useRef(null)
  const cache = useRef(new Map())
  const viewRef = useRef(null)
  const current = useRef({})
  const compartments = useRef({mode: new Compartment(), options: new Compartment(), interface: new Compartment()})
  current.current = {doc, attach, onEdit, onCursor, activate, onScroll}

  useLayoutEffect(() => {
    const {mode, options, interface: interfaceText} = compartments.current
    const saved = cache.current.get(doc.id)
    const position = doc.positions?.[slot]
    const clamp = value => Math.min(value ?? 0, doc.text.length)
    const base = saved?.epoch === doc.epoch && saved?.state.doc.toString() === doc.text ? saved.state : EditorState.create({doc: doc.text, selection: {anchor: clamp(position?.anchor ?? doc.cursor), head: clamp(position?.head ?? doc.cursor)}, extensions: [
      history(), rememberFormat, formatField.init(() => ({eol: doc.eol, mixed: doc.mixed, version: doc.formatVersion ?? 0})), drawSelection(), dropCursor(), rectangularSelection(), crosshairCursor(), highlightActiveLine(), syntax, searchMarks, bookmarkField, overwrite, overwriteInput,
      interfaceText.of(editorInterface(t)), EditorState.allowMultipleSelections.of(true), mode.of([]), options.of(editorOptions(settings, doc)),
      keymap.of([indentWithTab, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap]),
      EditorView.updateListener.of(update => {
        const props = current.current
        if (update.docChanged && !update.transactions.some(tr => tr.annotation(syncChange))) {
          const changes = changesFor(update.changes)
          props.onEdit(slot, props.doc.id, update, changes, update.state.field(formatField).mixed, update.state.field(bookmarkField))
        }
        if (update.selectionSet || update.docChanged || update.focusChanged || update.transactions.some(tr => tr.effects.some(effect => effect.is(setOverwrite)))) props.onCursor(slot, props.doc.id, update.view)
      }),
    ]})
    const view = new EditorView({state: base, parent: host.current})
    viewRef.current = view
    setEditorBookmarks(view, doc.bookmarks)
    current.current.attach(slot, view, doc.id)
    const scroller = view.scrollDOM
    if (saved && saved.epoch === doc.epoch) scroller.scrollTop = saved.top
    else if (position?.reveal) view.dispatch({effects: EditorView.scrollIntoView(view.state.selection.main.head, {y: 'center'})})
    else if (position) {
      const line = view.state.doc.line(Math.min(view.state.doc.lines, position.top + 1))
      view.dispatch({effects: EditorView.scrollIntoView(line.from, {y: 'start'})})
      scroller.scrollLeft = position.horizontal
    }
    const scroll = () => current.current.onScroll(slot, scroller)
    scroller.addEventListener('scroll', scroll, {passive: true})
    return () => {
      cache.current.set(doc.id, {state: view.state, top: scroller.scrollTop, epoch: doc.epoch})
      while (cache.current.size > 20) cache.current.delete(cache.current.keys().next().value)
      scroller.removeEventListener('scroll', scroll)
      view.destroy()
      current.current.attach(slot, null, doc.id)
    }
  }, [doc.id, doc.epoch, slot])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({effects: compartments.current.options.reconfigure(editorOptions(settings, doc))})
  }, [doc.id, doc.epoch, doc.readOnly, doc.rtl, doc.size, settings])

  useLayoutEffect(() => {
    viewRef.current?.dispatch({effects: compartments.current.interface.reconfigure(editorInterface(t))})
  }, [doc.id, doc.epoch, t])

  useEffect(() => {
    const view = viewRef.current
    let alive = true
    const mode = modeFor(doc, settings.languages)
    const apply = extension => {
      if (!alive) return
      view.dispatch({effects: compartments.current.mode.reconfigure(extension)})
      const lines = doc.positions?.[slot]?.folds?.filter(number => number <= view.state.doc.lines) ?? []
      if (!lines.length || Array.isArray(extension) && !extension.length) return
      const last = view.state.doc.line(Math.max(...lines))
      ensureSyntaxTree(view.state, last.to, 60)
      const effects = lines.flatMap(number => {
        const line = view.state.doc.line(number)
        const range = foldable(view.state, line.from, line.to)
        return range ? [foldEffect.of(range)] : []
      })
      if (effects.length) view.dispatch({effects})
    }
    if (doc.size > 2 * 1024 * 1024 || !mode) apply([])
    else if (mode.load) mode.load().then(apply).catch(() => apply([]))
    else apply(customMode(mode))
    return () => { alive = false }
  }, [doc.id, doc.epoch, doc.name, doc.language, doc.size, settings.languages, slot])

  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view) return
    const format = view.state.field(formatField)
    if (view.state.doc.toString() !== doc.text) syncEditor(view, {from: 0, to: view.state.doc.length, insert: doc.text}, doc)
    else if (format.eol !== doc.eol || format.mixed !== doc.mixed || format.version !== (doc.formatVersion ?? 0)) syncEditor(view, undefined, doc)
  }, [doc.id, doc.text, doc.eol, doc.mixed, doc.formatVersion])

  useEffect(() => { setEditorBookmarks(viewRef.current, doc.bookmarks) }, [doc.id, doc.bookmarks])
  useEffect(() => { markSearch(viewRef.current, matches, matchIndex) }, [doc.id, doc.epoch, matches, matchIndex])

  return <div ref={host} className="editor-surface" onFocusCapture={() => activate(slot)} aria-label={t('Editor pane {number}', {number: slot === 'main' ? 1 : 2})} />
}

export function insertAtSelections(view, transform) {
  if (!view || view.state.readOnly) return
  let index = 0
  view.dispatch(view.state.changeByRange(range => {
    const text = transform(view.state.sliceDoc(range.from, range.to), index++)
    return {changes: {from: range.from, to: range.to, insert: text}, range: EditorSelection.range(range.from, range.from + text.length)}
  }))
  focusEditor(view)
}
