import {createRoot} from 'react-dom/client'
import {useDeferredValue, useEffect, useRef, useState} from 'react'
import {X, AlertTriangle, ChevronDown} from 'lucide-react'
import {languages} from '@codemirror/language-data'
import {Transaction} from '@codemirror/state'
import {Chrome, Activity, Explorer, Tabs, FindBar, Output, FileGlyph, IconButton} from './chrome'
import {Dialog, Palette, Fields, Settings, WorkspaceSearch, Outline} from './panels'
import {Companion, DocumentMap} from './Companion'
import {EditorSurface, goTo, isOverwrite, modeFor, syncChange} from './editor'
import {useDocuments} from './useDocuments'
import {useFind} from './useFind'
import {useCommands} from './useCommands'
import {documentFor, symbolsFor} from './documents'
import {eventShortcut, menus} from './commands'
import '@fontsource/instrument-sans/latin-400.css'
import '@fontsource/instrument-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import './style.css'

const api = window.margin
const languageNames = languages.map(item => item.name).sort()
const noMatches = []
const cursorStart = {line: 1, col: 1, count: 0, lines: 1, overwrite: false}

function download(name, content) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], {type: 'application/octet-stream'}))
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function App() {
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)
  const notify = message => { setNotice(String(message)); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(null), 4300) }
  const m = useDocuments(api, notify)
  const find = useFind(m.doc, m.selectedView, notify)
  const [panel, setPanel] = useState('files')
  const [dialog, setDialog] = useState(null)
  const [context, setContext] = useState(null)
  const [output, setOutput] = useState(null)
  const [companion, setCompanion] = useState('')
  const [tail, setTail] = useState(null)
  const [sync, setSync] = useState(false)
  const [minimap, setMinimap] = useState(false)
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState(cursorStart)
  const [systemLight, setSystemLight] = useState(() => matchMedia('(prefers-color-scheme: light)').matches)
  const [drag, setDrag] = useState(false)
  const clip = useRef([])
  const recorded = useRef([])
  const importInput = useRef(null)
  const importType = useRef('session')
  const keyHandler = useRef(null)
  const pollHandler = useRef(null)
  const scrollGuard = useRef(false)
  const onDropFiles = event => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault(); setDrag(false)
    safe(() => api ? m.openPaths(api.pathsFor(event.dataTransfer.files).filter(Boolean)) : m.openBrowser(event.dataTransfer.files))
  }
  const light = m.settings.theme === 'light' || (m.settings.theme === 'system' && systemLight)
  const changeSettings = data => m.setSettings({...m.settings, ...data})
  const setTheme = () => changeSettings({theme: light ? 'dark' : 'light'})
  const safe = callback => {
    try { return Promise.resolve(callback()).catch(error => notify(error.message)) }
    catch (error) { notify(error.message) }
  }
  const pickImport = type => { importType.current = type; importInput.current?.click() }

  async function importFile(file) {
    if (!file) return
    const text = await file.text()
    if (importType.current === 'session') {
      const data = JSON.parse(text)
      if (data.version !== 1 || !Array.isArray(data.docs)) throw new Error('This is not a Margin session file.')
      if (m.docs.some(doc => doc.dirty) && await m.confirm('Replace the current session?', 'Unsaved documents will be replaced by the imported session.', ['Import', 'Cancel']) !== 0) return
      const docs = data.docs.filter(doc => typeof doc.name === 'string' && typeof doc.text === 'string').map(doc => documentFor(doc.name, doc.text, {dirty: true, cursor: doc.cursor}))
      m.applySession({version: 1, docs})
      notify(`Imported ${docs.length} documents.`)
      return
    }
    const xml = new DOMParser().parseFromString(text, 'application/xml')
    if (xml.querySelector('parsererror')) throw new Error('The UDL file is not valid XML.')
    const modes = [...xml.querySelectorAll('UserLang')].map(node => ({name: node.getAttribute('name'), extensions: node.getAttribute('ext') ?? '',
      keywords: [...node.querySelectorAll('Keywords')].filter(item => /^Keywords[1-8]$/.test(item.getAttribute('name'))).map(item => item.textContent).join(' '),
      comment: node.querySelector('Keywords[name="Comments"]')?.textContent.match(/(?:^|\s)00(\S+)/)?.[1] ?? ''})).filter(item => item.name)
    if (!modes.length) throw new Error('No Notepad++ UserLang entries were found.')
    changeSettings({languages: [...m.settings.languages.filter(item => !modes.some(mode => mode.name === item.name)), ...modes]})
    notify(`Imported ${modes.length} language definitions.`)
  }

  const openDocumentsSearch = () => setDialog({kind: 'open-search'})
  const commands = useCommands({model: m, api, find, notify, setPanel, setDialog, setOutput, setCompanion, setTail, setMinimap, setSync, clip, recorded, recording, setRecording, setTheme, download, pickImport, languageNames, openDocumentsSearch})
  const invoke = id => {
    if (id === 'palette') return palette()
    if (commands[id] && !commands[id].disabled) return safe(commands[id].action)
  }
  keyHandler.current = event => {
    if (event.defaultPrevented || event.isComposing || event.getModifierState('AltGraph')) return
    if (dialog || event.target.closest?.('dialog')) return
    if (event.key === 'Escape' && context) { event.preventDefault(); setContext(null); return }
    if (event.ctrlKey && event.key === 'Tab') {
      event.preventDefault()
      const index = m.docs.findIndex(doc => doc.id === m.doc.id)
      m.focus(m.docs[(index + (event.shiftKey ? -1 : 1) + m.docs.length) % m.docs.length].id)
      return
    }
    const command = Object.values(commands).find(item => item.key === eventShortcut(event))
    if (!command || command.disabled) return
    const editingField = event.target.closest?.('input, textarea, select')
    if (editingField && ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll', 'duplicate', 'overwrite', 'deleteLine'].includes(command.id)) return
    event.preventDefault()
    event.stopPropagation()
    invoke(command.id)
  }
  useEffect(() => {
    const listener = event => keyHandler.current(event)
    window.addEventListener('keydown', listener, true)
    const media = matchMedia('(prefers-color-scheme: light)')
    const update = () => setSystemLight(media.matches)
    media.addEventListener('change', update)
    return () => { window.removeEventListener('keydown', listener, true); media.removeEventListener('change', update); clearTimeout(noticeTimer.current) }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = light ? 'light' : 'dark'; api?.titleStyle(light).catch(() => {}) }, [light])
  useEffect(() => {
    const view = m.selectedView()
    if (view) onCursor(m.slot, m.doc.id, view)
  }, [m.doc.id, m.slot])

  const reloadFiles = async paths => {
    for (const doc of m.docsRef.current.filter(item => paths.includes(item.path) && !item.dirty)) await m.reload(doc, doc.encoding, true)
  }
  pollHandler.current = async () => {
    const docs = m.docsRef.current.filter(item => item.path)
    if (!docs.length) return
    for (const external of await api.changed(docs.map(({path, mtime, size}) => ({path, mtime, size})))) {
      const doc = m.docsRef.current.find(item => item.path === external.path)
      if (!doc || doc.external?.fingerprint === external.fingerprint && doc.external?.error === external.error && doc.external) continue
      if (doc.fingerprint === external.fingerprint) { m.amend(doc.id, {mtime: external.mtime, size: external.size}); continue }
      if (doc.id === tail && !doc.dirty && !external.error) {
        await m.reload(doc, doc.encoding, true)
        requestAnimationFrame(() => {
          const found = Object.values(m.views.current).find(item => item.id === doc.id)?.view
          if (found) goTo(found, found.state.doc.lines)
        })
      } else m.amend(doc.id, {external})
    }
  }
  useEffect(() => {
    if (!api) return
    let busy = false
    const poll = async () => {
      if (busy) return
      busy = true
      try { await pollHandler.current() } catch {} finally { busy = false }
    }
    const timer = setInterval(poll, 1700)
    window.addEventListener('focus', poll)
    return () => { clearInterval(timer); window.removeEventListener('focus', poll) }
  }, [])

  function onCursor(slot, id, view) {
    const {state} = view
    const pos = state.selection.main.head
    m.cursors.current.set(id, pos)
    if (slot !== m.slot) return
    const line = state.doc.lineAt(pos)
    const count = state.selection.ranges.reduce((sum, range) => sum + range.to - range.from, 0)
    setStatus({line: line.number, col: pos - line.from + 1, count, lines: state.doc.lines, overwrite: Boolean(isOverwrite(view))})
  }
  function onEdit(slot, id, update, changes, mixed, bookmarks) {
    const text = update.state.doc.toString()
    m.amend(id, item => {
      const savedText = item.savedText ?? item.text
      const savedFormat = item.savedFormat ?? [item.encoding, item.eol, item.mixed]
      return {text, savedText, savedFormat, mixed, bookmarks, dirty: text !== savedText || item.encoding !== savedFormat[0] || item.eol !== savedFormat[1] || (mixed?.join('') ?? null) !== (savedFormat[2]?.join('') ?? null)}
    })
    const other = m.views.current[slot === 'main' ? 'secondary' : 'main']
    if (other?.id === id && other.view.state.doc.eq(update.startState.doc)) other.view.dispatch({changes: update.changes, annotations: [syncChange.of(true), Transaction.addToHistory.of(false)]})
    if (recording && recorded.current.length < 1000) {
      const anchor = update.startState.selection.main.head
      recorded.current.push({changes: changes.map(item => ({...item, from: item.from - anchor, to: item.to - anchor})), cursor: update.state.selection.main.head - anchor})
    }
  }
  function onScroll(slot, scroller) {
    if (!sync || scrollGuard.current) return
    const other = m.views.current[slot === 'main' ? 'secondary' : 'main']?.view.scrollDOM
    if (!other) return
    const ratio = scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)
    scrollGuard.current = true
    other.scrollTop = ratio * Math.max(0, other.scrollHeight - other.clientHeight)
    requestAnimationFrame(() => { scrollGuard.current = false })
  }
  async function compareDisk() {
    const info = await api.open(m.doc.path, m.doc.encoding)
    if (info.binary) throw new Error('The disk file appears to be binary.')
    m.amend(m.doc.id, item => ({external: {...item.external, text: info.text}}))
    setCompanion('diff')
  }

  function viewPane(slot, id) {
    const doc = m.docs.find(item => item.id === id) ?? m.docs[0]
    const active = m.slot === slot
    return <section className={`editor-pane ${active ? 'active-pane' : ''}`} aria-label={`${slot === 'main' ? 'Primary' : 'Secondary'} editor`}>
      <Tabs docs={m.docs} active={doc.id} focus={id => m.focus(id, slot)} close={id => safe(() => m.close([id]))} add={() => invoke('new')} reorder={m.reorder} context={(doc, x, y) => setContext({doc, x, y})} pane={slot} />
      {active && find.show && <FindBar query={find.query} change={find.change} replace={find.show === 'replace'} result={find.result} index={find.index} next={find.next} apply={find.apply} close={find.close} mark={() => invoke('markMatches')} options={() => invoke('searchOptions')} input={find.input} />}
      {active && doc.external && <div className="conflict" role="alert"><AlertTriangle size={15} /><span>{doc.external.missing ? 'File moved or removed on disk.' : 'File changed on disk.'}</span>{!doc.external.error && <><button className="outline-button" onClick={() => safe(compareDisk)}>Compare</button><button className="outline-button" onClick={() => invoke('reload')}>Reload</button></>}<button className="outline-button" onClick={() => invoke('saveAs')}>Save As…</button></div>}
      <div className="editor-body"><EditorSurface doc={doc} settings={m.settings} slot={slot} attach={m.attach} onEdit={onEdit} onCursor={onCursor} activate={m.setSlot} onScroll={onScroll} matches={active && find.show ? find.result.matches : noMatches} matchIndex={active ? find.index : -1} />
        {minimap && active && <DocumentMap text={doc.text} navigate={line => goTo(m.selectedView(), line)} />}</div>
    </section>
  }

  const deferredDoc = useDeferredValue(m.doc)
  const mode = modeFor(m.doc, m.settings.languages)
  const closeDialog = () => setDialog(null)
  const paletteItems = Object.values(commands).filter(item => !item.disabled && item.id !== 'palette')
  return <div className="workbench" style={{'--editor-size': `${m.settings.fontSize}px`}} onDragOver={event => {
    if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDrag(true) }
  }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDrag(false) }} onDrop={onDropFiles}>
    <Chrome menus={menus} commands={commands} invoke={invoke} palette={() => invoke('palette')} platform={api?.platform} />
    <main className="workspace">
      <Activity panel={panel} onPanel={name => setPanel(current => current === name ? '' : name)} split={() => invoke('split')} settings={() => invoke('settings')} />
      {panel === 'files' && <Explorer docs={m.docs} active={m.doc.id} workspace={m.workspace} entries={m.entries} api={api} openPath={path => safe(() => m.openPath(path))} focusDoc={m.focus} chooseFolder={() => invoke('openFolder')} notify={notify} hide={() => setPanel('')} />}
      {panel === 'outline' && <Outline doc={deferredDoc} symbols={symbolsFor(deferredDoc, m.settings.languages.find(item => item.name === deferredDoc.language)?.outline)} navigate={line => goTo(m.selectedView(), line)} hide={() => setPanel('')} />}
      {panel === 'search' && <WorkspaceSearch api={api} workspace={m.workspace} chooseFolder={() => invoke('openFolder')} openPath={(...args) => safe(() => m.openPath(...args))} docs={m.docs} notify={notify} reload={reloadFiles} hide={() => setPanel('')} />}
      <div className="central"><div className="editing-area"><div className={`panes ${m.split}`}>{viewPane('main', m.main)}{m.split && viewPane('secondary', m.secondary)}</div>{companion && <Companion mode={companion} doc={m.doc} close={() => setCompanion('')} />}</div>{output && <Output data={output} close={() => setOutput(null)} />}</div>
    </main>
    <footer className="status-bar" aria-label="Document status"><div className="status-file" title={m.doc.path ?? m.doc.name}><FileGlyph name={m.doc.name} size={14} /><span>{m.doc.name}</span><span className={m.doc.dirty ? 'unsaved-text' : ''}>{m.doc.dirty ? 'Unsaved' : m.doc.readOnly ? 'Read-only' : m.doc.sample ? 'Demo' : m.doc.path ? 'Saved' : 'New'}</span>{recording && <span className="unsaved-text">● Recording</span>}{tail === m.doc.id && <span>Following</span>}</div><div className="status-controls">
      <button onClick={() => invoke('goto')} title="Go to line">Ln {status.line}, Col {status.col}{status.count ? ` (${status.count} selected)` : ''}</button><button onClick={() => invoke('overwrite')} title="Toggle overwrite">{status.overwrite ? 'OVR' : 'INS'}</button><button onClick={() => invoke('convert')} title="Convert encoding">{m.doc.encoding}</button><button onClick={() => setDialog({kind: 'palette', label: 'Line Endings', items: ['LF', 'CRLF', 'CR'].map(label => ({id: label, label})), run: item => invoke(item.id.toLowerCase())})} title="Line endings">{m.doc.mixed ? `Mixed (${m.doc.eol})` : m.doc.eol}</button><button onClick={() => invoke('language')} title="Select language">{mode?.name ?? 'Plain Text'}</button><button onClick={() => invoke('settings')} title="Indentation">{m.settings.spaces ? 'Spaces' : 'Tabs'}: {m.settings.tabSize}</button><button onClick={() => invoke('zoomReset')} title="Reset editor zoom">{Math.round(m.settings.fontSize / 15 * 100)}%</button>
    </div></footer>
    <input type="file" multiple ref={m.fileInput} hidden onChange={event => { const files = [...event.target.files]; event.target.value = ''; safe(() => m.openBrowser(files)) }} />
    <input type="file" ref={importInput} hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; safe(() => importFile(file)) }} />
    <pre id="print-sheet" />
    {notice && <div className="toast" role="status">{notice}<IconButton icon={X} label="Dismiss notification" onClick={() => setNotice(null)} /></div>}
    {drag && <div className="drop-overlay">Drop to open files or a folder</div>}
    {context && <div className="context-overlay" onPointerDown={() => setContext(null)}><div className="menu-items context-menu" style={{left: Math.min(context.x, window.innerWidth - 210), top: Math.min(context.y, window.innerHeight - 180)}} onPointerDown={event => event.stopPropagation()}>
      <button onClick={() => {m.amend(context.doc.id, {pinned: !context.doc.pinned}); setContext(null)}}>{context.doc.pinned ? 'Unpin tab' : 'Pin tab'}</button><button onClick={() => {safe(() => m.save(context.doc.id)); setContext(null)}}>Save</button><button onClick={() => {safe(() => m.close([context.doc.id])); setContext(null)}}>Close</button><button onClick={() => {safe(() => m.close(m.docs.filter(item => item.id !== context.doc.id && !item.pinned).map(item => item.id))); setContext(null)}}>Close other tabs</button>
    </div></div>}
    {dialog?.kind === 'palette' && <Palette key={dialog.label} mode={dialog.label} items={dialog.items} close={closeDialog} run={item => safe(() => dialog.run(item))} />}
    {dialog?.kind === 'fields' && <Fields key={dialog.label} {...dialog} close={closeDialog} />}
    {dialog?.kind === 'settings' && <Settings settings={m.settings} change={changeSettings} close={closeDialog} keybindings={() => invoke('keybindings')} customLanguage={() => invoke('customLanguage')} tools={() => invoke('tools')} />}
    {dialog?.kind === 'about' && <Dialog label="About Margin" close={closeDialog}><div className="form"><p>Margin is a desktop workbench for plain text and code.</p><p>Version 0.9.0 · MIT</p><button className="outline-button" onClick={() => invoke('repository')}>Source and releases</button></div></Dialog>}
    {dialog?.kind === 'open-search' && <OpenSearch docs={m.docs} focus={m.focus} close={closeDialog} />}
  </div>

  function palette() { setDialog({kind: 'palette', label: 'Command Palette', items: paletteItems, run: item => invoke(item.id)}) }
}

function OpenSearch({docs, focus, close}) {
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const matches = []
  if (deferred.trim()) for (const doc of docs) {
    const lines = doc.text.slice(0, 8 * 1024 * 1024).split('\n')
    for (let i = 0; i < lines.length && matches.length < 300; i++) {
      const col = lines[i].toLowerCase().indexOf(deferred.toLowerCase())
      if (col >= 0) matches.push({id: doc.id, line: i + 1, col: col + 1, value: lines[i].slice(0, 200), name: doc.name})
    }
  }
  return <Dialog label="Find in Open Documents" close={close}><div className="form"><label>Search open documents<input value={query} data-focus onChange={event => setQuery(event.target.value)} /></label><div className="palette-results">{matches.map(match => <button key={`${match.id}:${match.line}`} onClick={() => { close(); focus(match.id, undefined, {line: match.line, column: match.col}) }}><span><strong>{match.name}:{match.line}</strong><small>{match.value}</small></span></button>)}</div></div></Dialog>
}

createRoot(document.getElementById('root')).render(<App />)
