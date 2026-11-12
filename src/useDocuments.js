import {useEffect, useRef, useState} from 'react'
import {demoDocuments, documentFor, defaults, basename, dirname, browserSession} from './documents'
import {withNewlines} from '../shared/text.mjs'

export function useDocuments(api, notify) {
  const [docs, setDocs] = useState(demoDocuments)
  const docsRef = useRef(docs)
  const [main, setMain] = useState(docs[0].id)
  const [secondary, setSecondary] = useState(null)
  const [slot, setSlot] = useState('main')
  const [split, setSplit] = useState('')
  const [workspace, setWorkspace] = useState(null)
  const [entries, setEntries] = useState([])
  const [recent, setRecent] = useState([])
  const [settings, setSettings] = useState(defaults)
  const [macros, setMacros] = useState([])
  const [ready, setReady] = useState(false)
  const saving = useRef(new Set())
  const closed = useRef([])
  const fileInput = useRef(null)
  const views = useRef({})
  const cursors = useRef(new Map())
  const waiting = useRef(null)
  const openRequests = useRef(null)
  const snapshot = useRef(null)
  const lastPersistError = useRef('')

  const active = (slot === 'secondary' && split ? secondary : main)
  const doc = docs.find(doc => doc.id === active) ?? docs[0]
  const current = () => docsRef.current.find(item => item.id === active) ?? docsRef.current[0]
  const commit = operation => {
    docsRef.current = operation(docsRef.current)
    setDocs(docsRef.current)
  }
  const amend = (id, value) => commit(docs => docs.map(doc => doc.id === id ? {...doc, ...(typeof value === 'function' ? value(doc) : value)} : doc))
  const selectedView = () => views.current[slot]?.view ?? views.current.main?.view
  function focus(id, target = slot, location) {
    if (target === 'secondary' && !split) target = 'main'
    waiting.current = {id, target, ...location}
    if (target === 'main') setMain(id)
    else setSecondary(id)
    setSlot(target)
    if (views.current[target]?.id === id) {
      const view = views.current[target].view
      jumpWaiting(view, id, target)
    }
  }

  function jumpWaiting(view, id, target) {
    const task = waiting.current
    if (task?.id !== id || task.target !== target) return false
    waiting.current = null
    if (task.line) {
      const line = view.state.doc.line(Math.min(Math.max(task.line, 1), view.state.doc.lines))
      view.dispatch({selection: {anchor: line.from + Math.max(0, Math.min(line.length, (task.column ?? 1) - 1))}, scrollIntoView: true})
    }
    view.focus()
    return true
  }

  const attach = (key, view, id) => {
    if (!view) { delete views.current[key]; return }
    views.current[key] = {view, id}
    if (!jumpWaiting(view, id, key) && key === slot && (!document.activeElement || document.activeElement === document.body)) view.focus()
  }

  function add(doc, location) {
    commit(items => [...items, doc])
    focus(doc.id, slot, location)
    return doc
  }

  function create() {
    let n = 1
    while (docsRef.current.some(doc => doc.name === `Untitled ${n}`)) n++
    add(documentFor(`Untitled ${n}`))
  }

  const remember = path => setRecent(items => [path, ...items.filter(item => item !== path)].slice(0, 40))
  const setFolder = async path => {
    setEntries(await api.entries(path))
    setWorkspace(path)
  }

  const pickFolder = async () => {
    if (!api) { notify('Open the desktop app to browse a folder.'); return }
    const path = await api.pickFolder()
    if (path) await setFolder(path)
  }

  async function openPath(path, line, column) {
    if (!api) return
    const result = await api.open(path)
    if (result.directory) { await setFolder(result.directory); return }
    if (result.binary && !result.large) throw new Error(`${result.name} contains NUL bytes and appears to be binary.`)
    const existing = docsRef.current.find(doc => doc.path === result.path)
    const location = line ? {line, column} : undefined
    if (existing) focus(existing.id, slot, location)
    else add(documentFor(result.name, result.text, {...result, readOnly: Boolean(result.lossy || result.large)}), location)
    if (result.lossy && !result.large) notify('Opened read-only. Reopen with another encoding to edit the original bytes.')
    remember(result.path)
  }

  async function openPaths(paths) {
    for (const item of paths) {
      try { await openPath(item.path ?? item, item.line, item.column) }
      catch (error) { notify(error.message) }
    }
  }

  const open = async () => api ? openPaths(await api.pickFiles()) : fileInput.current?.click()
  async function openBrowser(files) {
    for (const file of files) add(documentFor(file.name, await file.text()))
  }

  async function confirm(message, detail, buttons = ['Continue', 'Cancel']) {
    if (api) return api.confirm(message, detail, buttons)
    return window.confirm(`${message}\n\n${detail}`) ? 0 : buttons.length - 1
  }

  async function save(id = active, kind = 'normal') {
    const doc = docsRef.current.find(item => item.id === id)
    if (!doc || saving.current.has(id)) return false
    if (doc.large) throw new Error('Large-file pages are read-only.')
    saving.current.add(id)
    try {
      if (!api) {
        if (doc.encoding !== 'UTF-8' && doc.encoding !== 'UTF-8 BOM') throw new Error('Use the desktop app to save this encoding.')
        const uri = URL.createObjectURL(new Blob([doc.encoding === 'UTF-8 BOM' ? '\ufeff' : '', withNewlines(doc)], {type: 'text/plain;charset=utf-8'}))
        const a = document.createElement('a'); a.href = uri; a.download = doc.name; a.click()
        setTimeout(() => URL.revokeObjectURL(uri), 1000)
        if (kind !== 'copy') amend(id, item => ({dirty: item.text !== doc.text, savedText: doc.text}))
        notify('Downloaded ' + doc.name)
        return true
      }
      let file = doc.path
      let expected = doc.fingerprint
      if (!file || kind !== 'normal') {
        file = await api.saveDialog(doc.path ?? doc.name)
        if (!file) return false
        if (docsRef.current.some(item => item.id !== id && item.path === file)) throw new Error('That file is already open in another tab.')
        expected = file === doc.path ? doc.fingerprint : 'confirmed-dialog'
      } else if (doc.lossy) throw new Error('Reopen with the correct encoding before saving this file.')
      if (doc.lossy) throw new Error('Reopen with the correct encoding before saving a copy.')
      if (kind === 'normal' && file === doc.path && !doc.dirty) { notify(`${doc.name} is already saved.`); return true }
      const info = await api.save(file, {text: doc.text, encoding: doc.encoding, eol: doc.eol, mixed: doc.mixed}, expected, settings.backup)
      if (kind !== 'copy') amend(id, item => ({...info, dirty: item.text !== doc.text || item.encoding !== doc.encoding || item.eol !== doc.eol || item.mixed !== doc.mixed,
        savedText: doc.text, savedFormat: [doc.encoding, doc.eol, doc.mixed], external: null, sample: false}))
      remember(info.path)
      if (workspace && dirname(info.path) === workspace) setEntries(await api.entries(workspace))
      notify(`Saved ${info.name}`)
      return true
    } finally { saving.current.delete(id) }
  }

  async function reload(doc, encoding, force = false) {
    if (!doc?.path) return
    if (doc.dirty && !force && await confirm('Discard unsaved changes?', doc.name, ['Reload', 'Cancel']) !== 0) return
    const result = await api.open(doc.path, encoding)
    if (result.binary && !result.large) throw new Error('That encoding produced NUL bytes. Choose another encoding.')
    amend(doc.id, {...result, large: result.large ?? null, savedText: result.text, savedFormat: [result.encoding, result.eol, result.mixed], dirty: false, external: null, readOnly: Boolean(result.lossy || result.large)})
    if (result.lossy && !result.large) notify('This encoding could not decode the file losslessly. Opened read-only.')
  }

  async function readPage(doc, index) {
    if (!doc?.large) return
    const result = await api.largePage(doc.path, doc.encoding, index)
    amend(doc.id, {...result, savedText: result.text, bookmarks: [], external: null})
    cursors.current.delete(doc.id)
    requestAnimationFrame(() => {
      for (const {view, id} of Object.values(views.current)) if (id === doc.id) {
        view.dispatch({selection: {anchor: 0}, scrollIntoView: true})
        view.scrollDOM.scrollTop = 0
      }
    })
  }

  async function close(ids) {
    for (const id of ids) {
      if (saving.current.has(id)) return
      const doc = docsRef.current.find(item => item.id === id)
      if (!doc) continue
      if (doc.dirty) {
        const options = api ? ['Save', 'Discard', 'Cancel'] : ['Discard', 'Cancel']
        const choice = await confirm(`Save changes to ${doc.name}?`, 'Unsaved changes will be removed from this session if you discard them.', options)
        if (choice === options.length - 1) return
        if (api && choice === 0 && !await save(id)) return
      }
      const before = docsRef.current
      const index = before.findIndex(item => item.id === id)
      const next = before.filter(item => item.id !== id)
      if (!next.length) next.push(documentFor('Untitled 1'))
      const fallback = next[Math.min(index, next.length - 1)].id
      closed.current = [{...doc, dirty: false}, ...closed.current].slice(0, 20)
      commit(() => next)
      setMain(value => value === id ? fallback : value)
      setSecondary(value => value === id ? fallback : value)
    }
  }

  function reopen() {
    const item = closed.current.shift()
    if (item?.path) return openPath(item.path)
    if (item) add({...item, id: crypto.randomUUID(), dirty: Boolean(item.text)})
  }

  function reorder(from, to) {
    if (from === to) return
    commit(items => {
      const source = items.find(item => item.id === from)
      const index = items.findIndex(item => item.id === to)
      if (!source || index < 0) return items
      const next = items.filter(item => item.id !== from)
      next.splice(index, 0, source)
      return next
    })
  }

  function changeSplit(orientation, clone = false) {
    if (split === orientation && !clone) { setSplit(''); setSlot('main'); return }
    setSplit(orientation)
    setSecondary(clone ? doc.id : docs.find(item => item.id !== doc.id)?.id ?? doc.id)
  }

  function applySession(value) {
    if (!value || value.version !== 1) return
    const restored = Array.isArray(value.docs) ? value.docs.filter(doc => typeof doc.id === 'string' && typeof doc.name === 'string' && typeof doc.text === 'string') : []
    if (value.settings && typeof value.settings === 'object') setSettings({...defaults, ...value.settings})
    if (Array.isArray(value.macros)) setMacros(value.macros)
    if (Array.isArray(value.recent)) setRecent(value.recent)
    if (value.settings?.recover === false) return
    if (restored.length) {
      commit(() => restored)
      setMain(restored.find(item => item.id === value.main)?.id ?? restored[0].id)
      setSecondary(restored.find(item => item.id === value.secondary)?.id ?? restored[0].id)
      setSplit(['row', 'column'].includes(value.split) ? value.split : '')
    }
    if (api && typeof value.workspace === 'string') setFolder(value.workspace).catch(() => {})
  }

  snapshot.current = () => ({version: 1, docs: settings.recover ? docsRef.current.map(doc => ({...doc, cursor: cursors.current.get(doc.id) ?? doc.cursor, savedText: doc.savedText === doc.text ? undefined : doc.savedText})) : [], main, secondary, split, workspace, settings, recent, macros})
  const persist = () => {
    const value = snapshot.current()
    if (api) return api.storeSession(value)
    localStorage.setItem('margin.session.v1', JSON.stringify(value))
  }
  openRequests.current = openPaths
  useEffect(() => {
    let live = true
    let unsubscribe
    async function start() {
      try { const value = api ? await api.loadSession() : browserSession(); if (live) applySession(value) }
      catch (error) { notify(`Session recovery failed: ${error.message}`) }
      if (!live) return
      setReady(true)
      if (api) {
        unsubscribe = api.onOpen(paths => openRequests.current(paths))
        const paths = await api.initial()
        if (live) await openRequests.current(paths)
      }
    }
    start().catch(error => notify(error.message))
    const close = api?.onBeforeClose(async () => {
      try {
        if (!snapshot.current().settings.recover && docsRef.current.some(doc => doc.dirty) && await confirm('Quit with unsaved documents?', 'Session recovery is off. Save your files before closing if you want to keep them.', ['Quit', 'Cancel']) !== 0) return api.closeReply(false)
        await persist()
        await api.closeReply(true)
      } catch (error) { notify(error.message); await api.closeReply(false) }
    })
    const unload = () => { if (!api) { try { persist() } catch {} } }
    window.addEventListener('beforeunload', unload)
    return () => { live = false; unsubscribe?.(); close?.(); window.removeEventListener('beforeunload', unload) }
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(async () => {
      try { await persist(); lastPersistError.current = '' }
      catch (error) { if (lastPersistError.current !== error.message) notify(`Recovery snapshot: ${error.message}`); lastPersistError.current = error.message }
    }, 425)
    return () => clearTimeout(timer)
  }, [ready, docs, main, secondary, split, workspace, settings, recent, macros])

  return {docs, docsRef, main, secondary, slot, setSlot, split, workspace, entries, recent, settings, setSettings, macros, setMacros, doc, current, commit, amend, attach, views, cursors, selectedView, focus, add, create, open, openBrowser, openPath, openPaths, setFolder, pickFolder, save, reload, readPage, confirm, close, reopen, reorder, changeSplit, fileInput, snapshot, applySession}
}
