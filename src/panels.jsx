import {useEffect, useRef, useState} from 'react'
import {Search, X, PanelLeft, FileText, Check} from 'lucide-react'
import {IconButton, FileGlyph, shortcutLabel} from './chrome'
import {basename} from './documents'
import {emptyQuery} from '../shared/text.mjs'

export function Dialog({label, children, close, className = ''}) {
  const ref = useRef(null)
  useEffect(() => {
    const element = ref.current
    const previous = document.activeElement
    element.showModal()
    const input = element.querySelector('[data-focus]')
    input?.focus()
    return () => { element.close(); if (previous?.isConnected && document.activeElement === document.body) previous.focus() }
  }, [])
  return <dialog className={`dialog ${className}`} ref={ref} aria-label={label} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="dialog-inner"><div className="dialog-head"><h2>{label}</h2><IconButton icon={X} label="Close dialog" onClick={close} /></div>{children}</div>
  </dialog>
}

export function Palette({mode, items, close, run}) {
  const [input, setInput] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef(null)
  const terms = input.toLowerCase().replace(/^>/, '').trim().split(/\s+/).filter(Boolean)
  const filtered = items.filter(item => terms.every(term => `${item.label} ${item.group ?? ''} ${item.detail ?? ''}`.toLowerCase().includes(term))).slice(0, 80)
  const index = Math.min(active, filtered.length - 1)
  useEffect(() => { ref.current?.scrollIntoView({block: 'nearest'}) }, [index])
  const select = item => { if (item) { close(); run(item) } }
  return <Dialog label={mode} close={close} className="palette-dialog"><div className="palette-input"><Search size={18} /><input data-focus aria-label={`Filter ${mode.toLowerCase()}`} placeholder={mode === 'Command Palette' ? 'Type a command…' : 'Type a filename…'} value={input} onChange={event => { setInput(event.target.value); setActive(0) }} onKeyDown={event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))) }
    if (event.key === 'Enter') { event.preventDefault(); select(filtered[index]) }
  }} /></div>
    <div className="palette-results">{filtered.map((item, i) => <button key={item.id} ref={i === index ? ref : null} className={i === index ? 'active' : ''} onMouseMove={() => setActive(i)} onClick={() => select(item)}><span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span><kbd>{shortcutLabel(item.key)}</kbd></button>)}{!filtered.length && <p className="panel-empty">No results</p>}</div>
  </Dialog>
}

export function Fields({label, fields, close, submit, action = 'Apply', detail}) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(field => [field.name, field.value ?? ''])))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <Dialog label={label} close={close}>
    <form className="form" onSubmit={async event => {
      event.preventDefault()
      if (busy) return
      setBusy(true)
      try { await submit(values); close() }
      catch (error) { setError(error.message) }
      finally { setBusy(false) }
    }}>
      {detail && <p className="form-detail">{detail}</p>}
      {fields.map((field, index) => {
        const set = event => setValues({...values, [field.name]: field.type === 'checkbox' ? event.target.checked : event.target.value})
        return <label key={field.name} className={field.type === 'checkbox' ? 'checkbox' : ''}><span>{field.label}</span>{field.options ? <select data-focus={!index || undefined} value={values[field.name]} onChange={set}>{field.options.map(option => <option key={option}>{option}</option>)}</select>
          : field.type === 'textarea' ? <textarea rows={4} data-focus={!index || undefined} value={values[field.name]} onChange={set} placeholder={field.placeholder} required={field.required} />
          : <input data-focus={!index || undefined} type={field.type ?? 'text'} checked={field.type === 'checkbox' ? Boolean(values[field.name]) : undefined} value={field.type === 'checkbox' ? undefined : values[field.name]} onChange={set} placeholder={field.placeholder} min={field.min} max={field.max} required={field.required} />}</label>
      })}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="outline-button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Working…' : action}</button></div>
    </form>
  </Dialog>
}

export function Settings({settings, change, close, keybindings, customLanguage, tools}) {
  const checks = {numbers: 'Line numbers', wrap: 'Word wrap', spaces: 'Insert spaces', whitespace: 'Show whitespace', autocomplete: 'Autocomplete', backup: 'Keep backup on save', recover: 'Restore session on launch', rtl: 'Right-to-left text'}
  return <Dialog label="Settings" close={close}>
    <div className="form settings-form"><label>Appearance<select data-focus value={settings.theme} onChange={event => change({theme: event.target.value})}><option value="dark">Ink</option><option value="light">Paper</option><option value="system">System</option></select></label>
      <div className="form-columns"><label>Editor font size<input type="number" min="10" max="36" value={settings.fontSize} onChange={event => change({fontSize: Math.min(36, Math.max(10, Number(event.target.value)))})} /></label><label>Tab width<select value={settings.tabSize} onChange={event => change({tabSize: Number(event.target.value)})}>{[1, 2, 3, 4, 6, 8].map(n => <option key={n}>{n}</option>)}</select></label></div>
      <div className="settings-checks">{Object.entries(checks).map(([name, label]) => <label className="checkbox" key={name}><span>{label}</span><input type="checkbox" checked={settings[name]} onChange={event => change({[name]: event.target.checked})} /></label>)}</div>
      <div className="settings-links"><button className="outline-button" onClick={keybindings}>Keyboard shortcuts</button><button className="outline-button" onClick={customLanguage}>Custom languages</button><button className="outline-button" onClick={tools}>Saved tools</button></div>
    </div>
  </Dialog>
}

export function Outline({doc, symbols, navigate, hide}) {
  return <aside className="sidebar" aria-label="Outline"><div className="panel-heading"><strong>Outline</strong><IconButton icon={PanelLeft} label="Hide Outline" onClick={hide} /></div><div className="panel-scroll"><div className="section-caption">{doc.name}</div>{symbols.map(item => <button className="side-row" key={`${item.line}:${item.name}`} onClick={() => navigate(item.line)}><FileText size={14} /><span>{item.name}</span><small>{item.line}</small></button>)}{!symbols.length && <p className="panel-empty">No symbols found.</p>}</div></aside>
}

export function WorkspaceSearch({workspace, chooseFolder, api, openPath, docs, notify, reload, hide}) {
  const [query, setQuery] = useState(emptyQuery)
  const [filter, setFilter] = useState('*')
  const [depth, setDepth] = useState(12)
  const [result, setResult] = useState(null)
  const [checked, setChecked] = useState(new Set())
  const [running, setRunning] = useState('')
  const [error, setError] = useState('')
  const queryRef = useRef(0)
  const [previousWorkspace, setPreviousWorkspace] = useState(workspace)
  if (previousWorkspace !== workspace) { setPreviousWorkspace(workspace); setResult(null); setError('') }
  useEffect(() => () => { queryRef.current++; api?.cancelSearch().catch(() => {}) }, [api, workspace])
  function reset() { queryRef.current++; setResult(null); setError(''); if (running === 'search') api?.cancelSearch().catch(() => {}); setRunning('') }
  function change(key, value) { reset(); setQuery({...query, [key]: value}) }
  async function start(preview) {
    if (!api || !workspace) return
    const token = ++queryRef.current
    setRunning('search'); setResult(null); setError('')
    try {
      const result = await api.search(workspace, query, {glob: filter, depth: Number(depth), preview})
      if (token !== queryRef.current) return
      setResult({...result, preview})
      setChecked(new Set(result.files.map(item => item.path)))
    } catch (error) { if (token === queryRef.current) setError(error.message) }
    finally { if (token === queryRef.current) setRunning('') }
  }
  async function apply() {
    const selected = [...checked]
    if (docs.some(doc => doc.dirty && selected.includes(doc.path))) { setError('Save or close changed documents before applying the preview.'); return }
    setRunning('replace')
    try {
      const response = await api.confirm('Replace in selected files?', `${selected.length} files will be updated on disk. Review each selected file before continuing.`, ['Replace Files', 'Cancel'])
      if (response !== 0) return
      const update = await api.replace(result.token, selected)
      setResult(null)
      await reload(update.saved)
      notify(`Updated ${update.saved.length} file${update.saved.length === 1 ? '' : 's'}.`)
      if (update.failed) setError(`${update.failed}: ${update.error}`)
    } catch (error) { setResult(null); setError(error.message) }
    finally { setRunning('') }
  }
  return <aside className="sidebar workspace-search" aria-label="Workspace search"><div className="panel-heading"><strong>Find in Files</strong><IconButton icon={PanelLeft} label="Hide workspace search" onClick={hide} /></div>
    <div className="search-fields"><button className="outline-button root-button" title={workspace ?? ''} onClick={chooseFolder}>{workspace ? basename(workspace) : 'Choose Folder…'}</button>
      <form className="form" onSubmit={event => { event.preventDefault(); start(false) }}><label>Find in files<input value={query.needle} onChange={event => change('needle', event.target.value)} disabled={running === 'replace'} /></label><label>Replace in files<input value={query.replacement} onChange={event => change('replacement', event.target.value)} disabled={running === 'replace'} /></label>
        <div className="form-columns"><label>Files<input value={filter} placeholder="*.txt, *.md" onChange={event => { reset(); setFilter(event.target.value) }} disabled={running === 'replace'} /></label><label>Depth<input type="number" min="0" max="64" value={depth} onChange={event => { reset(); setDepth(event.target.value) }} disabled={running === 'replace'} /></label></div>
        <div className="form-columns"><label>Mode<select value={query.mode} onChange={event => change('mode', event.target.value)} disabled={running === 'replace'}><option value="literal">Normal</option><option value="extended">Extended</option><option value="regex">Regex</option></select></label><div className="settings-checks"><label className="checkbox"><span>Match case</span><input type="checkbox" checked={query.caseSensitive} onChange={event => change('caseSensitive', event.target.checked)} disabled={running === 'replace'} /></label><label className="checkbox"><span>Whole word</span><input type="checkbox" checked={query.whole} onChange={event => change('whole', event.target.checked)} disabled={running === 'replace'} /></label></div></div>
        <div className="search-actions"><button type="submit" className="primary-button" disabled={!workspace || !query.needle || Boolean(running)}>Find</button><button type="button" className="outline-button" disabled={!workspace || !query.needle || Boolean(running)} onClick={() => start(true)}>Preview Replace</button>{running === 'search' && <button className="text-button" type="button" onClick={reset}>Cancel</button>}</div>
      </form>
      {result?.token && <button className="primary-button" disabled={!checked.size || Boolean(running)} onClick={apply}><Check size={14} /> Apply to {checked.size} files</button>}
      {error && <p role="alert" className="inline-error">{error}</p>}
      {!api && <p className="panel-empty">Open the desktop app to search a folder.</p>}
    </div>
    <div className="panel-scroll result-list" aria-label="Workspace results" aria-busy={Boolean(running)}>
      {running === 'search' && <p className="panel-empty" role="status">Searching…</p>}
      {result && <p className="section-caption" role="status">{result.total}{result.truncated ? '+' : ''} matches in {result.files.length} files{result.skipped ? ` · ${result.skipped} skipped` : ''}</p>}
      {result?.files.map(item => <details key={item.path} open><summary>{result.preview && <input aria-label={`Include ${item.name}`} type="checkbox" checked={checked.has(item.path)} onClick={event => event.stopPropagation()} onChange={() => { const next = new Set(checked); if (next.has(item.path)) next.delete(item.path); else next.add(item.path); setChecked(next) }} />}<FileGlyph name={item.name} /><span>{item.name}</span><small>{item.results.length}</small></summary>
        {item.results.map((match, index) => <button className="side-row result-row" key={index} title={result.preview ? `${match.before} → ${match.after}` : match.text} onClick={() => openPath(item.path, match.line, match.col)}><small>{match.line}:{match.col}</small><span>{result.preview ? <><del>{match.before}</del><span className="replacement">{match.after || '∅'}</span></> : match.text}</span></button>)}
      </details>)}
    </div>
  </aside>
}
