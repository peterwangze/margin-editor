import {useEffect, useMemo, useRef, useState} from 'react'
import {Braces, File, FileText, FileCode, FilePlus, Folder, FolderOpen, Search, Replace, Settings2, Columns2, ChevronRight, List, Save, SaveAll, Printer, Scissors, Copy, Clipboard, Undo2, Redo2, X, Plus, Pin, Terminal, ArrowUp, ArrowDown, PanelLeft, WrapText, Pilcrow} from 'lucide-react'
import {basename, documentTitle, tabFolders} from './documents'
import {errorMessage, useLocale} from './i18n'

export const primaryKey = (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+')
export const shortcutLabel = key => key?.replace('Mod+', primaryKey)

export function IconButton({icon: Icon, label, children, className = '', ...props}) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}><Icon size={17} aria-hidden="true" />{children}</button>
}

export function FileGlyph({name, size = 15}) {
  const ext = name.split('.').at(-1).toLowerCase()
  if (ext === 'json') return <Braces size={size} className="glyph json" aria-hidden="true" />
  if (ext === 'md' || ext === 'markdown') return <span className="glyph markdown" aria-hidden="true">M↓</span>
  if (['txt', 'log'].includes(ext)) return <FileText size={size} className="glyph" aria-hidden="true" />
  if (name.includes('.')) return <FileCode size={size} className="glyph code" aria-hidden="true" />
  return <File size={size} className="glyph" aria-hidden="true" />
}

const toolGroups = [
  ['core', [['new', FilePlus, 'New'], ['open', FolderOpen, 'Open'], ['save', Save, 'Save']]],
  ['history', [['undo', Undo2, 'Undo'], ['redo', Redo2, 'Redo']]],
  ['core', [['find', Search, 'Find'], ['replace', Replace, 'Replace']]],
  ['secondary', [['saveAll', SaveAll, 'Save All'], ['print', Printer, 'Print']]],
  ['secondary', [['cut', Scissors, 'Cut'], ['copy', Copy, 'Copy'], ['paste', Clipboard, 'Paste']]],
  ['secondary', [['wrap', WrapText, 'Word Wrap'], ['whitespace', Pilcrow, 'Whitespace'], ['split', Columns2, 'Split']]],
]

export function Chrome({menus, commands, invoke, platform, doc, toggled, version}) {
  const {t, direction} = useLocale()
  const [open, setOpen] = useState(null)
  const menuRef = useRef(null)
  const menuNames = Object.keys(menus)
  const title = documentTitle(doc, t)
  const aboutLabel = t('About Margin')
  useEffect(() => {
    if (!open) return
    const outside = event => { if (!menuRef.current?.contains(event.target)) setOpen(null) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function navigate(event) {
    const headers = [...menuRef.current.querySelectorAll('.menu-group > button')]
    const header = event.target.closest('.menu-group')?.querySelector('button')
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(null); header?.focus(); return }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const visualStep = event.key === 'ArrowLeft' ? -1 : 1
      const step = direction === 'rtl' ? -visualStep : visualStep
      const index = (headers.indexOf(header) + step + headers.length) % headers.length
      if (open) setOpen(menuNames[index])
      headers[index]?.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && header) {
      event.preventDefault()
      setOpen(menuNames[headers.indexOf(header)])
      requestAnimationFrame(() => {
        const commands = header.parentElement.querySelectorAll('.menu-items button:not(:disabled)')
        commands[event.key === 'ArrowUp' ? commands.length - 1 : 0]?.focus()
      })
      return
    }
    const items = [...menuRef.current.querySelectorAll('.menu-items button:not(:disabled)')]
    if (!items.length) return
    event.preventDefault()
    const index = items.indexOf(document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (Math.max(-1, index) + (event.key === 'ArrowDown' ? 1 : index === -1 ? items.length : -1) + items.length) % items.length
    items[next]?.focus()
  }
  const run = id => { setOpen(null); invoke(id) }
  return <>
    <header className={`title-bar ${platform === 'darwin' ? 'mac' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">M</span>
        <span className="window-name" title={doc.path ?? title}>{doc.dirty && <span className="title-dirty" aria-label={t('Unsaved')}>● </span>}<bdi>{title}</bdi> <span className="brand-caption">— <bdi>Margin</bdi></span></span>
        <button type="button" className="title-version" title={aboutLabel} aria-label={`${aboutLabel} v${version}`} aria-haspopup="dialog" onClick={() => invoke('about')}>
          <bdi dir="ltr">v{version}</bdi>
        </button>
      </div>
    </header>
    <nav className="menu-bar" aria-label={t('Application menus')} ref={menuRef} onKeyDown={navigate}>
      {Object.entries(menus).map(([name, ids]) => <div className="menu-group" key={name}>
        <button type="button" aria-expanded={open === name} onClick={() => setOpen(open === name ? null : name)} onMouseEnter={() => { if (open) setOpen(name) }}>{t(name)}</button>
        {open === name && <div className="menu-items" aria-label={t('{name} commands', {name: t(name)})}>
          {ids.map((id, i) => id === '—' ? <hr key={i} /> : <button type="button" key={id} disabled={commands[id]?.disabled} onClick={() => run(id)}><span>{commands[id]?.label}</span><kbd dir="ltr">{shortcutLabel(commands[id]?.key)}</kbd></button>)}
        </div>}
      </div>)}
    </nav>
    <div className="toolbar" role="toolbar" aria-label={t('Editor toolbar')}>
      {toolGroups.map(([kind, group]) => <div className={`tool-group tool-${kind}`} key={group[0][0]}>{group.map(([id, Icon, text]) => <IconButton key={id} className={`tool-${kind}`} icon={Icon} label={commands[id].label} title={[commands[id].label, shortcutLabel(commands[id].key)].filter(Boolean).join(' · ')} disabled={commands[id].disabled} aria-pressed={toggled[id]} onClick={() => invoke(id)}><span>{t(text)}</span></IconButton>)}</div>)}
    </div>
  </>
}

function TreeEntry({item, api, openPath, notify, t}) {
  const [children, setChildren] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const toggle = async () => {
    if (!item.dir) return openPath(item.path)
    if (expanded) { setExpanded(false); return }
    try { setChildren(await api.entries(item.path)); setExpanded(true) }
    catch (error) { notify(errorMessage(t, error)) }
  }
  const FolderIcon = expanded ? FolderOpen : Folder
  return <div className="tree-item"><button type="button" className="side-row" onClick={toggle} title={item.path} aria-expanded={item.dir ? expanded : undefined}>{item.dir ? <><FolderIcon size={15} /><span><bdi>{item.name}</bdi></span></> : <><FileGlyph name={item.name} /><span><bdi>{item.name}</bdi></span></>}</button>{expanded && <div className="tree-children">{children.map(child => <TreeEntry key={child.path} item={child} api={api} openPath={openPath} notify={notify} t={t} />)}</div>}</div>
}

export function Explorer({docs, active, workspace, entries, api, openPath, focusDoc, chooseFolder, notify, hide}) {
  const {t} = useLocale()
  return <aside className="sidebar" aria-label={t('Explorer')}>
    <div className="panel-heading"><strong>{t('Explorer')}</strong><IconButton icon={PanelLeft} label={t('Hide Explorer')} onClick={hide} /></div>
    <div className="panel-scroll">
      <details open><summary><ChevronRight size={14} />{t('Open Editors')}</summary>
        {docs.map(doc => {
          const title = documentTitle(doc, t)
          return <button className={`side-row ${doc.id === active ? 'active' : ''}`} key={doc.id} onClick={() => focusDoc(doc.id)} title={doc.path ?? title}><FileGlyph name={doc.name} /><span dir="auto">{title}</span>{doc.dirty && <span className="dirty-mark" title={t('Unsaved')} />}</button>
        })}
      </details>
      <details open><summary><ChevronRight size={14} />{workspace ? basename(workspace) : t('Folder')}</summary>
        {workspace ? entries.map(item => <TreeEntry key={item.path} item={item} api={api} openPath={openPath} notify={notify} t={t} />) : docs.filter(doc => doc.sample).map(doc => <button key={doc.id} className="side-row" onClick={() => focusDoc(doc.id)}><FileGlyph name={doc.name} /><span>{documentTitle(doc, t)}</span></button>)}
        <button className="side-row quiet" onClick={chooseFolder}><FolderOpen size={15} /><span>{t('Open Folder…')}</span></button>
      </details>
    </div>
  </aside>
}

export function Tabs({docs, active, focus, close, add, list, reorder, context, pane}) {
  const {t} = useLocale()
  const activeTab = useRef(null)
  const scroll = useRef(null)
  const folders = useMemo(() => tabFolders(docs), [docs])
  useEffect(() => {
    const reveal = () => activeTab.current?.scrollIntoView({block: 'nearest', inline: 'nearest'})
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(scroll.current)
    if (activeTab.current) observer.observe(activeTab.current)
    return () => observer.disconnect()
  }, [active, t])
  return <div className="tabs" aria-label={pane === 'main' ? t('main documents') : t('secondary documents')}>
    <div className="tab-scroll" role="tablist" ref={scroll}>
      {docs.map(doc => {
        const title = documentTitle(doc, t)
        return <div key={doc.id} className={`tab ${doc.id === active ? 'selected' : ''}`} ref={doc.id === active ? activeTab : null} draggable onDragStart={event => event.dataTransfer.setData('application/x-margin-tab', doc.id)} onDragOver={event => event.preventDefault()} onDrop={event => {
          const id = event.dataTransfer.getData('application/x-margin-tab')
          if (id) { event.preventDefault(); event.stopPropagation(); reorder(id, doc.id) }
        }} onAuxClick={event => { if (event.button === 1) { event.preventDefault(); close(doc.id) } }} onContextMenu={event => { event.preventDefault(); context(doc, event.clientX, event.clientY) }}>
          <button type="button" className="tab-name" role="tab" aria-selected={doc.id === active} title={doc.path ?? title} onClick={() => focus(doc.id)}><FileGlyph name={doc.name} /><span className="tab-caption" dir="auto">{title}</span>{folders.has(doc.id) && <bdi className="tab-folder">{folders.get(doc.id)}</bdi>}{doc.pinned && <Pin size={12} />}{doc.dirty && <span className="dirty-mark" aria-label={t('Unsaved')} />}</button>
          <IconButton icon={X} className="tab-close" label={t('Close {name}', {name: title})} onClick={() => close(doc.id)} />
        </div>
      })}
    </div>
    <IconButton icon={Plus} label={t('New tab')} onClick={add} />
    {docs.length > 1 && <IconButton icon={List} className="tab-list" label={t('Open documents…')} aria-haspopup="dialog" onClick={list} />}
  </div>
}

export function FindBar({find, paged, mark, options}) {
  const {query, change, show, result, index, next, apply, close, input, scopeUnavailable, canReplace} = find
  const {t, formatNumber} = useLocale()
  const hasMatches = result.matches.length > 0 && !result.pending && !scopeUnavailable
  const total = `${formatNumber(result.matches.length)}${result.truncated ? '+' : ''}`
  const count = !query.needle || scopeUnavailable ? '' : result.pending ? t('Searching…') : result.error ? t('Search error') : !hasMatches ? t('No matches')
    : index < 0 ? t('{count} matches', {count: total})
    : t('{current} of {total}{more}', {current: formatNumber(index + 1), total: formatNumber(result.matches.length), more: result.truncated ? '+' : ''})
  return <section className="findbar" aria-label={t('Find and replace')} onKeyDown={event => { if (event.key === 'Escape') close() }}>
    <div className="find-row">
      <label htmlFor="find-value">{t('Find')}</label><input ref={input} id="find-value" dir="auto" value={query.needle} onChange={event => change({needle: event.target.value})} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); next(event.shiftKey ? -1 : 1) } }} autoComplete="off" />
      <div className="find-arrows"><IconButton className="outline-button" icon={ArrowUp} label={t('Previous match')} disabled={!hasMatches} onClick={() => next(-1)} /><IconButton className="outline-button" icon={ArrowDown} label={t('Next match')} disabled={!hasMatches} onClick={() => next(1)} /></div>
      <span className="find-count" role="status">{count}</span>
      <IconButton icon={Settings2} label={t('Search options')} onClick={options} /><IconButton icon={X} label={t('Close find')} onClick={close} />
    </div>
    <div className="find-options-row">
      <label className="find-check"><input type="checkbox" checked={query.caseSensitive} onChange={event => change({caseSensitive: event.target.checked})} /><span>{t('Match case')}</span></label><label className="find-check"><input type="checkbox" checked={query.whole} onChange={event => change({whole: event.target.checked})} /><span>{t('Whole word')}</span></label>
      <div className="toggle-group"><button type="button" dir="ltr" title={t('Regular expression')} aria-label={t('Regular expression')} aria-pressed={query.mode === 'regex'} onClick={() => change({mode: query.mode === 'regex' ? 'literal' : 'regex'})}>.*</button></div>
      <label className="find-check find-scope"><input type="checkbox" checked={query.inSelection} onChange={event => change({inSelection: event.target.checked})} /><span>{t('In selection')}</span></label>
      {!query.inSelection && <span className="find-scope-label">{t(paged ? 'Loaded page' : 'Whole document')}</span>}
    </div>
    {scopeUnavailable && <div className="find-scope-warning"><span role="alert">{t('Select text to set the search range.')}</span><button className="outline-button" onClick={() => change({inSelection: true})}>{t('Use selection')}</button></div>}
    {show === 'replace' && <div className="find-row replace-row"><label htmlFor="replace-value">{t('Replace')}</label><input id="replace-value" dir="auto" value={query.replacement} onChange={event => change({replacement: event.target.value})} /><button className="outline-button" disabled={!hasMatches || !canReplace || index < 0} onClick={() => apply(false)}>{t('Replace')}</button><button className="outline-button" disabled={!hasMatches || !canReplace || result.truncated} onClick={() => apply(true)}>{t('Replace All')}</button><button className="text-button" disabled={!hasMatches} onClick={mark}>{t('Bookmark')}</button></div>}
    {result.error && <p className="inline-error" role="alert">{errorMessage(t, result.error)}</p>}
  </section>
}

export function Output({data, close}) {
  const {t} = useLocale()
  return <section className="output" aria-label={t('Output')}><div className="panel-heading"><Terminal size={16} /><strong>{data.title}</strong><span className="toolbar-fill" /><IconButton icon={X} label={t('Close output')} onClick={close} /></div><pre dir="auto">{data.text}</pre></section>
}
