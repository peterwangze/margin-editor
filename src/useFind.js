import {useEffect, useRef, useState} from 'react'
import {EditorView} from '@codemirror/view'
import {emptyQuery} from '../shared/text.mjs'
import {useLocale} from './i18n'

const empty = {matches: [], pending: false}

export function useFind(doc, selectedView, notify) {
  const {t, formatNumber} = useLocale()
  const [show, setShow] = useState('')
  const [query, setQuery] = useState(emptyQuery)
  const [result, setResult] = useState(empty)
  const [index, setIndex] = useState(-1)
  const [range, setRange] = useState(null)
  const input = useRef(null)
  const activeMatch = useRef(null)
  const current = useRef({})
  current.current = {selectedView, doc}

  useEffect(() => {
    if (!show || !query.needle) { setResult(empty); setIndex(-1); return }
    let worker
    let timeout
    let live = true
    setResult({matches: [], pending: true})
    const delay = setTimeout(() => {
      worker = new Worker(new URL('./search.worker.js', import.meta.url), {type: 'module'})
      timeout = setTimeout(() => { worker.terminate(); if (live) setResult({matches: [], error: 'Search timed out. Simplify the expression.'}) }, 1800)
      worker.onmessage = ({data}) => {
        clearTimeout(timeout)
        worker.terminate()
        if (!live) return
        const matches = data.matches ?? []
        setResult({...data, matches})
        const view = current.current.selectedView()
        const cursor = activeMatch.current ?? view?.state.selection.main.from ?? 0
        const candidate = matches.findIndex(match => match.from >= cursor)
        setIndex(candidate < 0 && query.wrap && matches.length ? 0 : candidate)
        activeMatch.current = null
      }
      worker.onerror = () => { clearTimeout(timeout); if (live) setResult({matches: [], error: 'The search worker could not start.'}) }
      worker.postMessage({text: doc.text, query, range: query.inSelection && range?.id === doc.id ? {from: range.from, to: Math.min(range.to, doc.text.length)} : undefined})
    }, 55)
    return () => { live = false; clearTimeout(delay); clearTimeout(timeout); worker?.terminate() }
  }, [show, query, doc.id, doc.text, range])

  const change = value => {
    if (value.inSelection) {
      const selection = selectedView()?.state.selection.main
      if (!selection || selection.empty) { notify(t('Select text before enabling In selection.')); return }
      setRange({id: doc.id, from: selection.from, to: selection.to})
    }
    setQuery({...query, ...value})
  }
  const open = (mode = 'find') => {
    const view = selectedView()
    const selection = view?.state.selection.main
    if (selection && !selection.empty && selection.to - selection.from < 512) {
      const text = view.state.sliceDoc(selection.from, selection.to)
      if (!text.includes('\n')) setQuery({...query, needle: text, mode: 'literal', inSelection: false})
    }
    setShow(mode)
    requestAnimationFrame(() => { input.current?.focus(); input.current?.select() })
  }
  const close = () => { setShow(''); selectedView()?.focus() }
  const next = step => {
    if (!show) { open('find'); return }
    const count = result.matches.length
    if (!count || result.pending) return
    const view = selectedView()
    if (!view) return
    const current = result.matches[index]
    const same = current && view.state.selection.main.from === current.from && view.state.selection.main.to === current.to
    let i = index < 0 ? step < 0 ? count - 1 : 0 : same ? index + step : index
    if (query.wrap) i = (i + count) % count
    else if (i < 0 || i >= count) return
    const match = result.matches[i]
    if (match.to > view.state.doc.length) return
    setIndex(i)
    view.dispatch({selection: {anchor: match.from, head: match.to}, effects: EditorView.scrollIntoView(match.from, {y: 'center'})})
  }
  const apply = all => {
    const view = selectedView()
    if (!view || view.state.readOnly || !result.matches.length || result.pending) return
    if (all && result.truncated) return
    const match = result.matches[Math.max(index, 0)]
    const changes = all ? result.matches : [match]
    if (changes.at(-1).to > view.state.doc.length) return
    if (query.inSelection && range?.id === doc.id) setRange({...range, to: range.to + changes.reduce((delta, item) => delta + item.insert.length - (item.to - item.from), 0)})
    activeMatch.current = match.from + match.insert.length
    view.dispatch({changes, userEvent: 'input.replace'})
    notify(t(changes.length === 1 ? 'Replaced {count} match.' : 'Replaced {count} matches.', {count: formatNumber(changes.length)}))
  }
  return {show, setShow, query, result, index, change, open, close, next, apply, input}
}
