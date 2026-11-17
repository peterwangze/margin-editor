import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {EditorView} from '@codemirror/view'
import {emptyQuery} from '../shared/text.mjs'
import {useLocale} from './i18n'

const empty = {matches: [], pending: false}
const pending = {matches: [], pending: true}

export function useFind(doc, selectedView, notify, slot) {
  const {t, formatNumber} = useLocale()
  const [show, setShow] = useState('')
  const [query, setQuery] = useState(emptyQuery)
  const [completed, setCompleted] = useState(null)
  const [range, setRange] = useState(null)
  const input = useRef(null)
  const focusOnOpen = useRef(false)
  const activeMatch = useRef(null)
  const current = useRef({})
  const {id, text, epoch} = doc
  const scopeUnavailable = query.inSelection &&
    (range?.id !== id || range.slot !== slot || range.text !== text || range.epoch !== epoch || range.from >= range.to)
  const request = useMemo(() => show && query.needle && !scopeUnavailable ? {
    id, text, epoch, slot, query, range: query.inSelection ? {from: range.from, to: range.to} : undefined,
  } : null, [show, query, scopeUnavailable, id, text, epoch, slot, range])
  const answer = request && completed?.request === request ? completed : null
  const result = answer?.result ?? (request ? pending : empty)
  const index = answer?.index ?? -1
  current.current = {selectedView, request}

  useLayoutEffect(() => {
    if (show && focusOnOpen.current) {
      focusOnOpen.current = false
      input.current?.focus()
      input.current?.select()
    }
  }, [show])

  useEffect(() => {
    if (!request) return
    let worker
    let timeout
    let live = true
    const finish = (data, source) => {
      clearTimeout(timeout)
      worker?.terminate()
      if (!live || current.current.request !== request) return
      const matches = data.matches ?? []
      const view = current.current.selectedView()
      const resume = activeMatch.current
      const cursor = resume && resume.source === source ? resume.position : view?.state.selection.main.from ?? 0
      const candidate = matches.findIndex(match => match.from >= cursor)
      setCompleted({request, source, result: {...data, matches}, index: candidate < 0 && request.query.wrap && matches.length ? 0 : candidate})
      activeMatch.current = null
    }
    const delay = setTimeout(() => {
      const document = current.current.selectedView()?.state.doc
      const source = document?.toString() === request.text ? document : undefined
      try {
        worker = new Worker(new URL('./search.worker.js', import.meta.url), {type: 'module'})
        timeout = setTimeout(() => finish({error: 'Search timed out. Simplify the expression.'}, source), 1800)
        worker.onmessage = ({data}) => finish(data, source)
        worker.onerror = () => finish({error: 'The search worker could not start.'}, source)
        worker.postMessage({text: request.text, query: request.query, range: request.range})
      } catch {
        finish({error: 'The search worker could not start.'}, source)
      }
    }, 55)
    return () => { live = false; clearTimeout(delay); clearTimeout(timeout); worker?.terminate() }
  }, [request])

  const change = value => {
    if (value.inSelection === true && (!query.inSelection || scopeUnavailable)) {
      const selection = selectedView()?.state.selection.main
      if (!selection || selection.empty) { notify(t('Select text before enabling In selection.')); return }
      setRange({id, slot, text, epoch, from: selection.from, to: selection.to})
    } else if (value.inSelection === false) {
      setRange(null)
    }
    current.current.request = null
    setQuery(previous => ({...previous, ...value}))
  }
  const open = (mode = 'find') => {
    const view = selectedView()
    const selection = view?.state.selection.main
    if (!show && !query.inSelection && selection && !selection.empty && selection.to - selection.from < 512) {
      const selected = view.state.sliceDoc(selection.from, selection.to)
      if (!selected.includes('\n')) setQuery(previous => ({...previous, needle: selected, mode: 'literal'}))
    }
    if (mode === show && input.current) {
      input.current.focus()
      input.current.select()
    } else {
      focusOnOpen.current = true
      setShow(mode)
    }
  }
  const close = () => { current.current.request = null; setShow(''); selectedView()?.focus() }
  const readyView = () => {
    const view = selectedView()
    if (!answer || !view || current.current.request !== request) return null
    const source = view.state.doc
    const unchanged = answer.source ? source.eq(answer.source) : source.toString() === request.text
    return unchanged ? view : null
  }
  const next = step => {
    if (!show) { open('find'); return }
    const count = result.matches.length
    const view = readyView()
    if (!view || !count) return
    const current = result.matches[index]
    const {from, to} = view.state.selection.main
    const same = current && from === current.from && to === current.to
    let i = same ? index + step : step > 0
      ? result.matches.findIndex(match => match.from >= from)
      : result.matches.findLastIndex(match => match.to <= from)
    if (i < 0 || i >= count) {
      if (!query.wrap) return
      i = step > 0 ? 0 : count - 1
    }
    const match = result.matches[i]
    setCompleted({...answer, index: i})
    view.dispatch({selection: {anchor: match.from, head: match.to}, effects: EditorView.scrollIntoView(match.from, {y: 'center'})})
  }
  const apply = all => {
    const view = readyView()
    if (!view || view.state.readOnly || !result.matches.length || (all ? result.truncated : index < 0)) return
    const changes = all ? result.matches : [result.matches[index]]
    if (changes.every(item => view.state.sliceDoc(item.from, item.to) === item.insert)) {
      if (!all) next(1)
      return
    }
    current.current.request = null
    view.dispatch({changes, userEvent: 'input.replace'})
    if (query.inSelection) {
      const delta = changes.reduce((total, item) => total + item.insert.length - (item.to - item.from), 0)
      setRange({...range, to: range.to + delta, text: view.state.doc.toString()})
    }
    activeMatch.current = {source: view.state.doc, position: changes[0].from + changes[0].insert.length}
    notify(t(changes.length === 1 ? 'Replaced {count} match.' : 'Replaced {count} matches.', {count: formatNumber(changes.length)}))
  }
  const canReplace = Boolean(readyView() && !doc.readOnly && result.matches.length)
  const currentMatches = () => readyView() ? result.matches : empty.matches
  return {show, setShow, query, result, index, scopeUnavailable, canReplace, currentMatches, change, open, close, next, apply, input}
}
