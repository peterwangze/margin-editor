import {createRoot} from 'react-dom/client'
import {useDeferredValue, useEffect, useRef, useState} from 'react'
import {X, AlertTriangle, ChevronDown} from 'lucide-react'
import {languages} from '@codemirror/language-data'
import {Chrome, Explorer, Tabs, FindBar, Output, FileGlyph, IconButton} from './chrome'
import {Dialog, Palette, Fields, Settings, WorkspaceSearch, Outline, LargeSearch, Projects} from './panels'
import {Companion, DocumentMap} from './Companion'
import {TextInspector} from './TextInspector'
import {EditorSurface, goTo, isOverwrite, modeFor, syncEditor} from './editor'
import {useDocuments} from './useDocuments'
import {useFind} from './useFind'
import {useCommands} from './useCommands'
import {documentFor, documentTitle, symbolsFor} from './documents'
import {errorMessage, loadInterfaceLanguage, LocaleProvider, useLocale} from './i18n'
import {definitions, eventShortcut, menus} from './commands'
import {readNotepadPreferences, readNotepadSession} from './notepad-session'
import {readNotepadShortcuts} from './notepad-shortcuts'
import {readNotepadLanguages} from './notepad-udl'
import {readNotepadProject} from './notepad-project'
import {version} from '../package.json'
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
  const {t, formatNumber} = useLocale()
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)
  const notify = message => { setNotice(String(message)); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(null), 4300) }
  const m = useDocuments(api, notify)
  const find = useFind(m.doc, m.selectedView, notify)
  const [panel, setPanel] = useState('')
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
    try { return Promise.resolve(callback()).catch(error => notify(errorMessage(t, error))) }
    catch (error) { notify(errorMessage(t, error)) }
  }
  const pickImport = type => { importType.current = type; importInput.current?.click() }

  async function importFile(file) {
    if (!file) return
    const text = await file.text()
    if (importType.current === 'notepad-project') {
      if (!api) throw new Error('Open the desktop app to load a Notepad++ project.')
      const [source] = api.pathsFor([file])
      const projects = readNotepadProject(text)
      m.setSettings(current => ({...current, projects: [...current.projects.filter(item => item.source !== source), {source, name: file.name, projects}]}))
      setPanel('projects')
      return
    }
    if (importType.current === 'notepad-shortcuts') {
      const result = readNotepadShortcuts(text, m.settings.shortcuts, definitions, t)
      m.setSettings(current => ({...current, shortcuts: result.settings}))
      notify(t(result.count === 1 ? 'Imported {count} shortcut from Notepad++.' : 'Imported {count} shortcuts from Notepad++.', {count: result.count}))
      if (result.skipped.length) setOutput({title: t('Notepad++ shortcuts import'), text: [t('Skipped entries:'), ...result.skipped].join('\n')})
      return
    }
    if (importType.current === 'notepad-preferences') {
      const settings = readNotepadPreferences(text)
      m.setSettings(current => ({...current, ...settings}))
      notify(t('Imported {count} preferences from Notepad++.', {count: Object.keys(settings).length}))
      return
    }
    if (importType.current === 'notepad-session') {
      if (!api) throw new Error('Open the desktop app to import a Notepad++ session.')
      const [path] = api.pathsFor([file])
      const session = readNotepadSession(text)
      const windowsPaths = session.views.some(view => view.files.some(item => /^[A-Z]:[\\/]/i.test(item.filename)))
      let remap = null
      if (api.platform !== 'win32' && windowsPaths) {
        const choice = await m.confirm(t('Map Windows drive paths?'), t('Choose the local directory that contains the copied drive contents.'), ['Choose Folder', 'Skip Windows Paths', 'Cancel'].map(label => t(label)))
        if (choice === 2) return
        if (choice === 0) { remap = await api.pickFolder(); if (!remap) return }
      }
      const findLanguage = name => {
        const aliases = {'normal text': 'Plain Text', 'text': 'Plain Text'}
        const key = name?.toLowerCase()
        return aliases[key] ?? [...languageNames, ...m.settings.languages.map(item => item.name)].find(value => value.toLowerCase() === key)
      }
      const result = await m.importNotepadSession(session, path, remap, findLanguage)
      notify(t(result.count === 1 ? 'Imported {count} document.' : 'Imported {count} documents.', {count: result.count}))
      if (result.skipped.length || result.recovered.length) setOutput({title: t('Notepad++ session import'), text: [
        ...(result.recovered.length ? [t('Recovered as unsaved tabs:'), ...result.recovered] : []),
        ...(result.skipped.length ? [t('Could not open:'), ...result.skipped] : []),
      ].join('\n')})
      return
    }
    if (importType.current === 'session') {
      const data = JSON.parse(text)
      if (data.version !== 1 || !Array.isArray(data.docs)) throw new Error('This is not a Margin session file.')
      if (m.docs.some(doc => doc.dirty) && await m.confirm(t('Replace the current session?'), t('Unsaved documents will be replaced by the imported session.'), [t('Import'), t('Cancel')]) !== 0) return
      const docs = data.docs.filter(doc => typeof doc.name === 'string' && typeof doc.text === 'string').map(doc => documentFor(doc.name, doc.text, {dirty: true, cursor: doc.cursor}))
      m.applySession({version: 1, docs})
      notify(t('Imported {count} documents.', {count: docs.length}))
      return
    }
    const modes = readNotepadLanguages(text)
    changeSettings({languages: [...m.settings.languages.filter(item => !modes.some(mode => mode.name === item.name)), ...modes]})
    notify(t(modes.length === 1 ? 'Imported {count} language definition.' : 'Imported {count} language definitions.', {count: modes.length}))
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
        if (doc.large) await m.readPage(doc, Number.MAX_SAFE_INTEGER)
        else await m.reload(doc, doc.encoding, true)
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
    if (other?.id === id && other.view.state.doc.eq(update.startState.doc)) syncEditor(other.view, update.changes, m.docsRef.current.find(item => item.id === id))
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
    return <section className={`editor-pane ${active ? 'active-pane' : ''}`} aria-label={t(slot === 'main' ? 'Primary editor' : 'Secondary editor')}>
      <Tabs docs={m.docs} active={doc.id} focus={id => m.focus(id, slot)} close={id => safe(() => m.close([id]))} add={() => invoke('new')} reorder={m.reorder} context={(doc, x, y) => setContext({doc, x, y})} pane={slot} />
      {active && doc.external && <div className="conflict" role="alert">
        <AlertTriangle size={15} />
        <span>{t(doc.external.missing ? 'File moved or removed on disk.' : 'File changed on disk.')}</span>
        {!doc.external.error && <>
          {!doc.large && <button className="outline-button" onClick={() => safe(compareDisk)}>{t('Compare')}</button>}
          <button className="outline-button" onClick={() => invoke('reload')}>{t('Reload')}</button>
        </>}
        {!doc.large && <button className="outline-button" onClick={() => invoke('saveAs')}>{t('Save As…')}</button>}
      </div>}
      {doc.large && <div className="page-bar">
        <span>{t(doc.readOnly ? 'Read-only' : doc.dirty ? 'Save this page to navigate' : 'Page editing')} · {t('{start}–{end} / {size} bytes', {
          start: formatNumber(doc.large.offset), end: formatNumber(doc.large.end), size: formatNumber(doc.size),
        })}</span>
        <button className="outline-button" disabled={doc.dirty || doc.large.index === 0} onClick={() => safe(() => m.readPage(doc, doc.large.index - 1))}>{t('Previous page')}</button>
        <button className="outline-button" disabled={doc.dirty} onClick={() => setDialog({
          kind: 'fields', label: 'Go to file page',
          fields: [{name: 'page', label: t('Page (1–{pages})', {pages: formatNumber(doc.large.pages)}), value: doc.large.index + 1, type: 'number', min: 1, max: doc.large.pages}],
          submit: ({page}) => m.readPage(doc, Number(page) - 1),
        })}>{formatNumber(doc.large.index + 1)} / {formatNumber(doc.large.pages)}</button>
        <button className="outline-button" disabled={doc.dirty || doc.large.index >= doc.large.pages - 1} onClick={() => safe(() => m.readPage(doc, doc.large.index + 1))}>{t('Next page')}</button>
        {active && <button className="outline-button" disabled={commands.wholeFile.disabled} onClick={() => invoke('wholeFile')}>{t('Find Across Pages…')}</button>}
      </div>}
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
    <Chrome menus={menus} commands={commands} invoke={invoke} platform={api?.platform} doc={m.doc} toggled={{wrap: m.settings.wrap, whitespace: m.settings.whitespace, split: Boolean(m.split)}} />
    <main className="workspace">
      {panel === 'files' && <Explorer docs={m.docs} active={m.doc.id} workspace={m.workspace} entries={m.entries} api={api} openPath={path => safe(() => m.openPath(path))} focusDoc={m.focus} chooseFolder={() => invoke('openFolder')} notify={notify} hide={() => setPanel('')} />}
      {panel === 'outline' && <Outline doc={deferredDoc} symbols={symbolsFor(deferredDoc, m.settings.languages.find(item => item.name === deferredDoc.language)?.outline)} navigate={line => goTo(m.selectedView(), line)} hide={() => setPanel('')} />}
      {panel === 'projects' && <Projects workspaces={m.settings.projects} hide={() => setPanel('')} importProject={() => invoke('importNotepadProject')} open={(workspace, source) => safe(async () => {
        let path = await api.resolveSessionPath(workspace.source, source)
        if (!path && api.platform !== 'win32' && /^[A-Z]:[\\/]/i.test(source)) {
          const folder = await api.pickFolder()
          if (!folder) return
          path = await api.resolveSessionPath(workspace.source, source, folder)
        }
        if (!path) throw new Error('Open this path directly to access the document.')
        await m.openPath(path)
      })} />}
      {panel === 'search' && <WorkspaceSearch api={api} workspace={m.workspace} chooseFolder={() => invoke('openFolder')} openPath={(...args) => safe(() => m.openPath(...args))} docs={m.docs} notify={notify} reload={reloadFiles} hide={() => setPanel('')} />}
      <div className="central"><div className="editing-area"><div className={`panes ${m.split}`}>{viewPane('main', m.main)}{m.split && viewPane('secondary', m.secondary)}</div>{companion && <Companion mode={companion} doc={m.doc} close={() => setCompanion('')} />}</div>{output && <Output data={output} close={() => setOutput(null)} />}
        {find.show && <FindBar query={find.query} change={find.change} replace={find.show === 'replace'} result={find.result} index={find.index} next={find.next} apply={find.apply} close={find.close} mark={() => invoke('markMatches')} options={() => invoke('searchOptions')} input={find.input} />}</div>
    </main>
    <footer className="status-bar" aria-label={t('Document status')}><div className="status-file" title={m.doc.path ?? documentTitle(m.doc, t)}>
      <FileGlyph name={m.doc.name} size={14} />
      <span>{documentTitle(m.doc, t)}</span>
      <span className={m.doc.dirty ? 'unsaved-text' : ''}>{t(m.doc.dirty ? 'Unsaved' : m.doc.readOnly ? 'Read-only' : m.doc.sample ? 'Demo' : m.doc.path ? 'Saved' : 'New')}</span>
      {recording && <span className="unsaved-text">{t('● Recording')}</span>}
      {tail === m.doc.id && <span>{t('Following')}</span>}
    </div><div className="status-controls">
      <button className="inspect-status" onClick={() => invoke('inspectText')} title={t('Inspect words, characters, and hidden symbols')} aria-label={t('Inspect & clean text')}>{t(m.doc.large ? 'Page length: {count}' : 'Length: {count}', {count: formatNumber(m.doc.text.length)})}</button>
      <span className="status-metric">{t('Lines: {count}', {count: formatNumber(status.lines)})}</span>
      <button onClick={() => invoke('goto')} title={t('Go to line')}>{t('Ln {line}, Col {column}', {line: formatNumber(status.line), column: formatNumber(status.col)})}{status.count ? t(' ({count} selected)', {count: formatNumber(status.count)}) : ''}</button>
      <button onClick={() => setDialog({kind: 'palette', label: 'Line Endings', items: ['LF', 'CRLF', 'CR'].map(label => ({id: label, label})), run: item => invoke(item.id.toLowerCase())})} title={t('Line endings')}>{m.doc.mixed ? t('Mixed ({eol})', {eol: m.doc.eol}) : m.doc.eol}</button>
      <button onClick={() => invoke('convert')} title={t('Convert encoding')}>{m.doc.encoding}</button>
      <button onClick={() => invoke('language')} title={t('Select language')}>{mode?.name ?? t('Plain Text')}</button>
      <button onClick={() => invoke('settings')} title={t('Indentation')}>{t(m.settings.spaces ? 'Spaces: {size}' : 'Tabs: {size}', {size: m.settings.tabSize})}</button>
      <button onClick={() => invoke('zoomReset')} title={t('Reset editor zoom')}>{Math.round(m.settings.fontSize / 15 * 100)}%</button>
      <button onClick={() => invoke('overwrite')} title={t('Toggle overwrite')}>{t(status.overwrite ? 'OVR' : 'INS')}</button>
    </div></footer>
    <input type="file" multiple ref={m.fileInput} hidden onChange={event => { const files = [...event.target.files]; event.target.value = ''; safe(() => m.openBrowser(files)) }} />
    <input type="file" ref={importInput} hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; safe(() => importFile(file)) }} />
    <pre id="print-sheet" />
    {notice && <div className="toast" role="status">{notice}<IconButton icon={X} label={t('Dismiss notification')} onClick={() => setNotice(null)} /></div>}
    {drag && <div className="drop-overlay">{t('Drop to open files or a folder')}</div>}
    {context && <div className="context-overlay" onPointerDown={() => setContext(null)}><div className="menu-items context-menu" style={{left: Math.min(context.x, window.innerWidth - 210), top: Math.min(context.y, window.innerHeight - 180)}} onPointerDown={event => event.stopPropagation()}>
      <button onClick={() => {m.amend(context.doc.id, {pinned: !context.doc.pinned}); setContext(null)}}>{t(context.doc.pinned ? 'Unpin tab' : 'Pin tab')}</button><button onClick={() => {safe(() => m.save(context.doc.id)); setContext(null)}}>{t('Save')}</button><button onClick={() => {safe(() => m.close([context.doc.id])); setContext(null)}}>{t('Close')}</button><button onClick={() => {safe(() => m.close(m.docs.filter(item => item.id !== context.doc.id && !item.pinned).map(item => item.id))); setContext(null)}}>{t('Close other tabs')}</button>
    </div></div>}
    {dialog?.kind === 'palette' && <Palette key={dialog.label} mode={dialog.label} items={dialog.items} close={closeDialog} run={item => safe(() => dialog.run(item))} />}
    {dialog?.kind === 'fields' && <Fields key={dialog.label} {...dialog} close={closeDialog} />}
    {dialog?.kind === 'settings' && <Settings settings={m.settings} change={changeSettings} close={closeDialog} keybindings={() => invoke('keybindings')} customLanguage={() => invoke('customLanguage')} tools={() => invoke('tools')} />}
    {dialog?.kind === 'about' && <Dialog label="About Margin" close={closeDialog}><div className="form"><p>{t('Margin is an offline desktop editor for notes, lists, logs, and other plain text.')}</p><p>{t('Version {version} · MIT', {version})}</p><button className="outline-button" onClick={() => invoke('repository')}>{t('Source and releases')}</button></div></Dialog>}
    {dialog?.kind === 'inspect-text' && <TextInspector snapshot={dialog.snapshot} close={closeDialog} />}
    {dialog?.kind === 'open-search' && <OpenSearch docs={m.docs} focus={m.focus} close={closeDialog} />}
    {dialog?.kind === 'large-search' && <LargeSearch api={api} doc={m.doc} close={closeDialog} initialQuery={find.query} jump={match => safe(async () => { await m.readPage(m.doc, match.page, match); m.selectedView()?.focus() })} />}
  </div>

  function palette() { setDialog({kind: 'palette', label: 'Command Palette', items: paletteItems, run: item => invoke(item.id)}) }
}

function OpenSearch({docs, focus, close}) {
  const {t} = useLocale()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const matches = []
  if (deferred.trim()) for (const doc of docs) {
    const lines = doc.text.slice(0, 8 * 1024 * 1024).split('\n')
    for (let i = 0; i < lines.length && matches.length < 300; i++) {
      const col = lines[i].toLowerCase().indexOf(deferred.toLowerCase())
      if (col >= 0) matches.push({id: doc.id, line: i + 1, col: col + 1, value: lines[i].slice(0, 200), name: documentTitle(doc, t)})
    }
  }
  return <Dialog label="Find in Open Documents" close={close}><div className="form"><label>{t('Search open documents')}<input value={query} data-focus onChange={event => setQuery(event.target.value)} /></label><div className="palette-results">{matches.map(match => <button key={`${match.id}:${match.line}`} onClick={() => { close(); focus(match.id, undefined, {line: match.line, column: match.col}) }}><span><strong>{match.name}:{match.line}</strong><small>{match.value}</small></span></button>)}</div></div></Dialog>
}

loadInterfaceLanguage(api).then(initial => {
  createRoot(document.getElementById('root')).render(<LocaleProvider api={api} initial={initial}><App /></LocaleProvider>)
})
