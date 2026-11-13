import {useEffect, useRef, useState} from 'react'
import {Search, X, PanelLeft, FileText, Check} from 'lucide-react'
import {IconButton, FileGlyph, shortcutLabel} from './chrome'
import {basename, documentTitle} from './documents'
import {emptyQuery, encodings} from '../shared/text.mjs'
import {errorMessage, interfaceLanguages, useLocale} from './i18n'

export function Dialog({label, children, close, className = '', literalLabel = false}) {
  const {t} = useLocale()
  const title = literalLabel ? label : t(label)
  const ref = useRef(null)
  useEffect(() => {
    const element = ref.current
    const previous = document.activeElement
    element.showModal()
    const input = element.querySelector('[data-focus]')
    input?.focus()
    return () => { element.close(); if (previous?.isConnected && document.activeElement === document.body) previous.focus() }
  }, [])
  return <dialog className={`dialog ${className}`} ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="dialog-inner"><div className="dialog-head"><h2>{title}</h2><IconButton icon={X} label={t('Close dialog')} onClick={close} /></div>{children}</div>
  </dialog>
}

export function Palette({mode, items, close, run}) {
  const {t, locale} = useLocale()
  const commandPalette = mode === 'Command Palette'
  const [input, setInput] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef(null)
  const terms = input.toLocaleLowerCase(locale).replace(/^>/, '').trim().split(/\s+/).filter(Boolean)
  const filtered = items.filter(item => terms.every(term => `${item.label} ${item.group ?? ''} ${item.detail ?? ''}`.toLocaleLowerCase(locale).includes(term))).slice(0, 80)
  const index = Math.min(active, filtered.length - 1)
  useEffect(() => { ref.current?.scrollIntoView({block: 'nearest'}) }, [index])
  const select = item => { if (item) { close(); run(item) } }
  const label = commandPalette ? t('Filter command palette') : t('Filter {list}', {list: t(mode).toLocaleLowerCase(locale)})
  return <Dialog label={mode} close={close} className="palette-dialog"><div className="palette-input"><Search size={18} /><input data-focus aria-label={label} placeholder={commandPalette ? t('Type a command…') : t('Type a filename…')} value={input} onChange={event => { setInput(event.target.value); setActive(0) }} onKeyDown={event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))) }
    if (event.key === 'Enter') { event.preventDefault(); select(filtered[index]) }
  }} /></div>
    <div className="palette-results">{filtered.map((item, i) => <button key={item.id} ref={i === index ? ref : null} className={i === index ? 'active' : ''} onMouseMove={() => setActive(i)} onClick={() => select(item)}><span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span><kbd>{shortcutLabel(item.key)}</kbd></button>)}{!filtered.length && <p className="panel-empty">{t('No results')}</p>}</div>
  </Dialog>
}

export function Fields({label, fields, close, submit, action = 'Apply', detail, literalLabel}) {
  const {t} = useLocale()
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(field => [field.name, field.value ?? ''])))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <Dialog label={label} close={close} literalLabel={literalLabel}>
    <form className="form" onSubmit={async event => {
      event.preventDefault()
      if (busy) return
      setBusy(true)
      try { await submit(values); close() }
      catch (error) { setError(error.message) }
      finally { setBusy(false) }
    }}>
      {detail && <p className="form-detail">{t(detail)}</p>}
      {fields.map((field, index) => {
        const set = event => setValues({...values, [field.name]: field.type === 'checkbox' ? event.target.checked : event.target.value})
        const placeholder = field.placeholder ? t(field.placeholder) : undefined
        return <label key={field.name} className={field.type === 'checkbox' ? 'checkbox' : ''}><span>{t(field.label)}</span>{field.options ? <select data-focus={!index || undefined} value={values[field.name]} onChange={set}>{field.options.map(option => <option key={option} value={option}>{t(option)}</option>)}</select>
          : field.type === 'textarea' ? <textarea rows={4} data-focus={!index || undefined} value={values[field.name]} onChange={set} placeholder={placeholder} required={field.required} />
          : <input data-focus={!index || undefined} type={field.type ?? 'text'} checked={field.type === 'checkbox' ? Boolean(values[field.name]) : undefined} value={field.type === 'checkbox' ? undefined : values[field.name]} onChange={set} placeholder={placeholder} min={field.min} max={field.max} required={field.required} />}</label>
      })}
      {error && <p className="inline-error" role="alert">{errorMessage(t, error)}</p>}
      <div className="form-actions"><button type="button" className="outline-button" onClick={close}>{t('Cancel')}</button><button type="submit" className="primary-button" disabled={busy}>{t(busy ? 'Working…' : action)}</button></div>
    </form>
  </Dialog>
}

export function Settings({settings, change, close, keybindings, customLanguage, tools}) {
  const {t, preference, setPreference, languageError} = useLocale()
  const checks = {numbers: 'Line numbers', wrap: 'Word wrap', spaces: 'Insert spaces', whitespace: 'Show whitespace', autocomplete: 'Autocomplete', backup: 'Keep backup on save', recover: 'Restore session on launch', rtl: 'Right-to-left text'}
  return <Dialog label="Settings" close={close}>
    <div className="form settings-form">
      <label>{t('Interface language')}<select data-focus value={preference} onChange={event => setPreference(event.target.value)}>
        <option value="system">{t('Follow system')}</option>
        {interfaceLanguages.map(({value, label}) => <option key={value} value={value} lang={value}>{label}</option>)}
      </select></label>
      {languageError && <p role="alert" className="inline-error">{languageError}</p>}
      <label>{t('Appearance')}<select value={settings.theme} onChange={event => change({theme: event.target.value})}><option value="dark">{t('Ink')}</option><option value="light">{t('Paper')}</option><option value="system">{t('System')}</option></select></label>
      <div className="form-columns"><label>{t('Editor font size')}<input type="number" min="10" max="36" value={settings.fontSize} onChange={event => change({fontSize: Math.min(36, Math.max(10, Number(event.target.value)))})} /></label><label>{t('Tab width')}<select value={settings.tabSize} onChange={event => change({tabSize: Number(event.target.value)})}>{Array.from({length: 32}, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label></div>
      <div className="form-columns"><label>{t('New document encoding')}<select value={settings.newEncoding} onChange={event => change({newEncoding: event.target.value})}>{[...new Set([...encodings, settings.newEncoding])].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label><label>{t('New document line endings')}<select value={settings.newEol} onChange={event => change({newEol: event.target.value})}>{['LF', 'CRLF', 'CR'].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <div className="settings-checks">{Object.entries(checks).map(([name, label]) => <label className="checkbox" key={name}><span>{t(label)}</span><input type="checkbox" checked={settings[name]} onChange={event => change({[name]: event.target.checked})} /></label>)}</div>
      <div className="settings-links"><button className="outline-button" onClick={keybindings}>{t('Keyboard shortcuts')}</button><button className="outline-button" onClick={customLanguage}>{t('Custom languages')}</button><button className="outline-button" onClick={tools}>{t('Saved tools')}</button></div>
    </div>
  </Dialog>
}

export function Outline({doc, symbols, navigate, hide}) {
  const {t, formatNumber} = useLocale()
  return <aside className="sidebar" aria-label={t('Outline')}><div className="panel-heading"><strong>{t('Outline')}</strong><IconButton icon={PanelLeft} label={t('Hide Outline')} onClick={hide} /></div><div className="panel-scroll"><div className="section-caption">{documentTitle(doc, t)}</div>{symbols.map(item => <button className="side-row" key={`${item.line}:${item.name}`} onClick={() => navigate(item.line)}><FileText size={14} /><span>{item.name}</span><small>{formatNumber(item.line)}</small></button>)}{!symbols.length && <p className="panel-empty">{t('No symbols found.')}</p>}</div></aside>
}

function ProjectEntries({entries, open}) {
  return entries.map((entry, index) => entry.children
    ? <details key={index} open><summary>{entry.name}</summary><div className="tree-children"><ProjectEntries entries={entry.children} open={open} /></div></details>
    : <button key={index} type="button" className="side-row" title={entry.path} onClick={() => open(entry.path)}><FileGlyph name={entry.name} /><span>{entry.name}</span></button>)
}

export function Projects({workspaces, hide, importProject, open}) {
  const {t} = useLocale()
  return <aside className="sidebar" aria-label={t('Project panel')}><div className="panel-heading"><strong>{t('Projects')}</strong><IconButton icon={PanelLeft} label={t('Hide project panel')} onClick={hide} /></div>
    <div className="panel-scroll"><button className="side-row quiet" onClick={importProject}>{t('Open Notepad++ project…')}</button>{workspaces.map(workspace => <details key={workspace.source} open><summary title={workspace.source}>{workspace.name}</summary><ProjectEntries entries={workspace.projects} open={path => open(workspace, path)} /></details>)}</div>
  </aside>
}

export function LargeSearch({api, doc, close, jump, initialQuery}) {
  const {t, formatNumber} = useLocale()
  const [query, setQuery] = useState(() => ({...emptyQuery, needle: initialQuery.needle, mode: initialQuery.mode === 'extended' ? 'extended' : 'literal', whole: initialQuery.whole, caseSensitive: initialQuery.caseSensitive}))
  const [result, setResult] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => { api.cancelLargeSearch().catch(() => {}) }, [api])
  const change = value => { setQuery({...query, ...value}); setResult(null); setError('') }
  const submit = async event => {
    event.preventDefault()
    if (pending || !query.needle) return
    setPending(true); setError(''); setResult(null)
    try { setResult(await api.largeSearch(doc.path, doc.encoding, doc.fingerprint, query)) }
    catch (error) { setError(error.message) }
    finally { setPending(false) }
  }
  return <Dialog label="Find Across All Pages" close={close}>
    <form className="form" onSubmit={submit}>
      <label>{t('Find')}<input data-focus value={query.needle} disabled={pending} onChange={event => change({needle: event.target.value})} /></label>
      <div className="form-columns"><label>{t('Mode')}<select value={query.mode} disabled={pending} onChange={event => change({mode: event.target.value})}><option value="literal">{t('Normal')}</option><option value="extended">{t('Extended')}</option></select></label><div>
        <label className="checkbox">{t('Match case')}<input type="checkbox" checked={query.caseSensitive} disabled={pending} onChange={event => change({caseSensitive: event.target.checked})} /></label>
        <label className="checkbox">{t('Whole word')}<input type="checkbox" checked={query.whole} disabled={pending} onChange={event => change({whole: event.target.checked})} /></label>
      </div></div>
      <div className="form-actions"><button className="primary-button" type="submit" disabled={pending || !query.needle}>{t(pending ? 'Searching…' : 'Find All')}</button></div>
      {error && <p className="inline-error" role="alert">{errorMessage(t, error)}</p>}
      {result && <><p className="section-caption" role="status">{t('{count} matches', {count: formatNumber(result.matches.length) + (result.truncated ? '+' : '')})}</p><div className="palette-results">{result.matches.map((match, index) => <button type="button" key={index} onClick={() => { close(); jump(match) }}><span><strong>{t(match.crossesPage ? 'Page {page} · spans pages' : 'Page {page}', {page: formatNumber(match.page + 1)})}</strong><small>{match.preview}</small></span></button>)}</div></>}
    </form>
  </Dialog>
}

export function WorkspaceSearch({workspace, chooseFolder, api, openPath, docs, notify, reload, hide}) {
  const {t, formatNumber} = useLocale()
  const [query, setQuery] = useState(emptyQuery)
  const [filter, setFilter] = useState('*')
  const [depth, setDepth] = useState(12)
  const [result, setResult] = useState(null)
  const [checked, setChecked] = useState(new Set())
  const [running, setRunning] = useState('')
  const [error, setError] = useState(null)
  const queryRef = useRef(0)
  const [previousWorkspace, setPreviousWorkspace] = useState(workspace)
  if (previousWorkspace !== workspace) { setPreviousWorkspace(workspace); setResult(null); setError(null) }
  useEffect(() => () => { queryRef.current++; api?.cancelSearch().catch(() => {}) }, [api, workspace])
  function reset() { queryRef.current++; setResult(null); setError(null); if (running === 'search') api?.cancelSearch().catch(() => {}); setRunning('') }
  function change(key, value) { reset(); setQuery({...query, [key]: value}) }
  async function start(preview) {
    if (!api || !workspace) return
    const token = ++queryRef.current
    setRunning('search'); setResult(null); setError(null)
    try {
      const result = await api.search(workspace, query, {glob: filter, depth: Number(depth), preview})
      if (token !== queryRef.current) return
      setResult({...result, preview})
      setChecked(new Set(result.files.map(item => item.path)))
    } catch (error) { if (token === queryRef.current) setError({message: error.message}) }
    finally { if (token === queryRef.current) setRunning('') }
  }
  async function apply() {
    const selected = [...checked]
    setError(null)
    if (docs.some(doc => doc.dirty && selected.includes(doc.path))) { setError({message: 'Save or close changed documents before applying the preview.'}); return }
    setRunning('replace')
    try {
      const response = await api.confirm(t('Replace in selected files?'), t('{count} files will be updated on disk. Review each selected file before continuing.', {count: formatNumber(selected.length)}), [t('Replace Files'), t('Cancel')])
      if (response !== 0) return
      const update = await api.replace(result.token, selected)
      setResult(null)
      await reload(update.saved)
      notify(t(update.saved.length === 1 ? 'Updated {count} file.' : 'Updated {count} files.', {count: formatNumber(update.saved.length)}))
      if (update.failed) setError({message: update.error, file: update.failed})
    } catch (error) { setResult(null); setError({message: error.message}) }
    finally { setRunning('') }
  }
  return <aside className="sidebar workspace-search" aria-label={t('Workspace search')}><div className="panel-heading"><strong>{t('Find in Files')}</strong><IconButton icon={PanelLeft} label={t('Hide workspace search')} onClick={hide} /></div>
    <div className="search-fields"><button className="outline-button root-button" title={workspace ?? ''} onClick={chooseFolder}>{workspace ? basename(workspace) : t('Choose Folder…')}</button>
      <form className="form" onSubmit={event => { event.preventDefault(); start(false) }}><label>{t('Find in files')}<input value={query.needle} onChange={event => change('needle', event.target.value)} disabled={running === 'replace'} /></label><label>{t('Replace in files')}<input value={query.replacement} onChange={event => change('replacement', event.target.value)} disabled={running === 'replace'} /></label>
        <div className="form-columns"><label>{t('Files')}<input value={filter} placeholder="*.txt, *.md" onChange={event => { reset(); setFilter(event.target.value) }} disabled={running === 'replace'} /></label><label>{t('Depth')}<input type="number" min="0" max="64" value={depth} onChange={event => { reset(); setDepth(event.target.value) }} disabled={running === 'replace'} /></label></div>
        <div className="form-columns"><label>{t('Mode')}<select value={query.mode} onChange={event => change('mode', event.target.value)} disabled={running === 'replace'}><option value="literal">{t('Normal')}</option><option value="extended">{t('Extended')}</option><option value="regex">{t('Regex')}</option></select></label><div className="settings-checks"><label className="checkbox"><span>{t('Match case')}</span><input type="checkbox" checked={query.caseSensitive} onChange={event => change('caseSensitive', event.target.checked)} disabled={running === 'replace'} /></label><label className="checkbox"><span>{t('Whole word')}</span><input type="checkbox" checked={query.whole} onChange={event => change('whole', event.target.checked)} disabled={running === 'replace'} /></label></div></div>
        <div className="search-actions"><button type="submit" className="primary-button" disabled={!workspace || !query.needle || Boolean(running)}>{t('Find')}</button><button type="button" className="outline-button" disabled={!workspace || !query.needle || Boolean(running)} onClick={() => start(true)}>{t('Preview Replace')}</button>{running === 'search' && <button className="text-button" type="button" onClick={reset}>{t('Cancel')}</button>}</div>
      </form>
      {result?.token && <button className="primary-button" disabled={!checked.size || Boolean(running)} onClick={apply}><Check size={14} />{t('Apply to {count} files', {count: formatNumber(checked.size)})}</button>}
      {error && <p role="alert" className="inline-error">{error.file ? t('{file}: {error}', {file: error.file, error: errorMessage(t, error)}) : errorMessage(t, error)}</p>}
      {!api && <p className="panel-empty">{t('Open the desktop app to search a folder.')}</p>}
    </div>
    <div className="panel-scroll result-list" aria-label={t('Workspace results')} aria-busy={Boolean(running)}>
      {running === 'search' && <p className="panel-empty" role="status">{t('Searching…')}</p>}
      {result && <p className="section-caption" role="status">{t(result.skipped ? '{count} matches in {files} files · {skipped} skipped' : '{count} matches in {files} files', {count: formatNumber(result.total) + (result.truncated ? '+' : ''), files: formatNumber(result.files.length), skipped: formatNumber(result.skipped ?? 0)})}</p>}
      {result?.files.map(item => <details key={item.path} open><summary>{result.preview && <input aria-label={t('Include {file}', {file: item.name})} type="checkbox" checked={checked.has(item.path)} onClick={event => event.stopPropagation()} onChange={() => { const next = new Set(checked); if (next.has(item.path)) next.delete(item.path); else next.add(item.path); setChecked(next) }} />}<FileGlyph name={item.name} /><span>{item.name}</span><small>{formatNumber(item.results.length)}</small></summary>
        {item.results.map((match, index) => <button className="side-row result-row" key={index} title={result.preview ? `${match.before} → ${match.after}` : match.text} onClick={() => openPath(item.path, match.line, match.col)}><small>{formatNumber(match.line)}:{formatNumber(match.col)}</small><span>{result.preview ? <><del>{match.before}</del><span className="replacement">{match.after || '∅'}</span></> : match.text}</span></button>)}
      </details>)}
    </div>
  </aside>
}
