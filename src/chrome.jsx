import {useEffect, useRef, useState} from 'react'
import {Braces, File, FileText, FileCode, FilePlus, Folder, FolderOpen, Search, Replace, Settings2, Columns2, ChevronRight, Save, SaveAll, Printer, Scissors, Copy, Clipboard, Undo2, Redo2, X, Plus, Pin, Terminal, ArrowUp, ArrowDown, PanelLeft, WrapText, Pilcrow} from 'lucide-react'
import {basename} from './documents'

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
  [['new', FilePlus, 'New'], ['open', FolderOpen, 'Open'], ['save', Save, 'Save'], ['saveAll', SaveAll, 'Save All'], ['print', Printer, 'Print']],
  [['cut', Scissors, 'Cut'], ['copy', Copy, 'Copy'], ['paste', Clipboard, 'Paste']],
  [['undo', Undo2, 'Undo'], ['redo', Redo2, 'Redo']],
  [['find', Search, 'Find'], ['replace', Replace, 'Replace']],
  [['wrap', WrapText, 'Word Wrap'], ['whitespace', Pilcrow, 'Whitespace'], ['split', Columns2, 'Split']],
]

export function Chrome({menus, commands, invoke, platform, doc, toggled}) {
  const [open, setOpen] = useState(null)
  const menuRef = useRef(null)
  const menuNames = Object.keys(menus)
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
      const index = (headers.indexOf(header) + (event.key === 'ArrowLeft' ? -1 : 1) + headers.length) % headers.length
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
    <header className={`title-bar ${platform === 'darwin' ? 'mac' : ''}`}><div className="brand"><span className="brand-mark" aria-hidden="true">M</span><span className="window-name" title={doc.path ?? doc.name}>{doc.dirty && <span className="title-dirty" aria-label="Unsaved">● </span>}{doc.name} <span className="brand-caption">— Margin</span></span></div></header>
    <nav className="menu-bar" aria-label="Application menus" ref={menuRef} onKeyDown={navigate}>
      {Object.entries(menus).map(([name, ids]) => <div className="menu-group" key={name}>
        <button type="button" aria-expanded={open === name} onClick={() => setOpen(open === name ? null : name)} onMouseEnter={() => { if (open) setOpen(name) }}>{name}</button>
        {open === name && <div className="menu-items" aria-label={`${name} commands`}>
          {ids.map((id, i) => id === '—' ? <hr key={i} /> : <button type="button" key={id} disabled={commands[id]?.disabled} onClick={() => run(id)}><span>{commands[id]?.label}</span><kbd>{shortcutLabel(commands[id]?.key)}</kbd></button>)}
        </div>}
      </div>)}
    </nav>
    <div className="toolbar" role="toolbar" aria-label="Editor toolbar">
      {toolGroups.map(group => <div className="tool-group" key={group[0][0]}>{group.map(([id, Icon, text]) => <IconButton key={id} icon={Icon} label={commands[id].label} title={[commands[id].label, shortcutLabel(commands[id].key)].filter(Boolean).join(' · ')} disabled={commands[id].disabled} aria-pressed={toggled[id]} onClick={() => invoke(id)}><span>{text}</span></IconButton>)}</div>)}
    </div>
  </>
}

function TreeEntry({item, api, openPath, notify}) {
  const [children, setChildren] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const toggle = async () => {
    if (!item.dir) return openPath(item.path)
    if (expanded) { setExpanded(false); return }
    try { setChildren(await api.entries(item.path)); setExpanded(true) }
    catch (error) { notify(error.message) }
  }
  const FolderIcon = expanded ? FolderOpen : Folder
  return <div className="tree-item"><button type="button" className="side-row" onClick={toggle} title={item.path} aria-expanded={item.dir ? expanded : undefined}>{item.dir ? <><FolderIcon size={15} /><span>{item.name}</span></> : <><FileGlyph name={item.name} /><span>{item.name}</span></>}</button>{expanded && <div className="tree-children">{children.map(child => <TreeEntry key={child.path} item={child} api={api} openPath={openPath} notify={notify} />)}</div>}</div>
}

export function Explorer({docs, active, workspace, entries, api, openPath, focusDoc, chooseFolder, notify, hide}) {
  return <aside className="sidebar" aria-label="Explorer">
    <div className="panel-heading"><strong>Explorer</strong><IconButton icon={PanelLeft} label="Hide Explorer" onClick={hide} /></div>
    <div className="panel-scroll">
      <details open><summary><ChevronRight size={14} />Open Editors</summary>
        {docs.map(doc => <button className={`side-row ${doc.id === active ? 'active' : ''}`} key={doc.id} onClick={() => focusDoc(doc.id)} title={doc.path ?? doc.name}><FileGlyph name={doc.name} /><span>{doc.name}</span>{doc.dirty && <span className="dirty-mark" title="Unsaved" />}</button>)}
      </details>
      <details open><summary><ChevronRight size={14} />{workspace ? basename(workspace) : 'Folder'}</summary>
        {workspace ? entries.map(item => <TreeEntry key={item.path} item={item} api={api} openPath={openPath} notify={notify} />) : docs.filter(doc => doc.sample).map(doc => <button key={doc.id} className="side-row" onClick={() => focusDoc(doc.id)}><FileGlyph name={doc.name} /><span>{doc.name}</span></button>)}
        <button className="side-row quiet" onClick={chooseFolder}><FolderOpen size={15} /><span>Open Folder…</span></button>
      </details>
    </div>
  </aside>
}

export function Tabs({docs, active, focus, close, add, reorder, context, pane}) {
  const activeTab = useRef(null)
  useEffect(() => { activeTab.current?.scrollIntoView({block: 'nearest', inline: 'nearest'}) }, [active])
  return <div className="tabs" aria-label={`${pane} documents`}>
    <div className="tab-scroll" role="tablist">
      {docs.map(doc => <div key={doc.id} className={`tab ${doc.id === active ? 'selected' : ''}`} ref={doc.id === active ? activeTab : null} draggable onDragStart={event => event.dataTransfer.setData('application/x-margin-tab', doc.id)} onDragOver={event => event.preventDefault()} onDrop={event => {
        const id = event.dataTransfer.getData('application/x-margin-tab')
        if (id) { event.preventDefault(); event.stopPropagation(); reorder(id, doc.id) }
      }} onAuxClick={event => { if (event.button === 1) { event.preventDefault(); close(doc.id) } }} onContextMenu={event => { event.preventDefault(); context(doc, event.clientX, event.clientY) }}>
        <button type="button" className="tab-name" role="tab" aria-selected={doc.id === active} title={doc.path ?? doc.name} onClick={() => focus(doc.id)}><FileGlyph name={doc.name} /><span>{doc.name}</span>{doc.pinned && <Pin size={12} />}{doc.dirty && <span className="dirty-mark" aria-label="Unsaved" />}</button>
        <IconButton icon={X} className="tab-close" label={`Close ${doc.name}`} onClick={() => close(doc.id)} />
      </div>)}
    </div>
    <IconButton icon={Plus} label="New tab" onClick={add} />
  </div>
}

export function FindBar({query, change, replace, result, index, next, apply, close, mark, options, input}) {
  return <section className="findbar" aria-label="Find and replace" onKeyDown={event => { if (event.key === 'Escape') close() }}>
    <div className="find-row">
      <label htmlFor="find-value">Find</label><input ref={input} id="find-value" value={query.needle} onChange={event => change({needle: event.target.value})} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); next(event.shiftKey ? -1 : 1) } }} autoComplete="off" />
      <label className="find-check"><input type="checkbox" checked={query.caseSensitive} onChange={event => change({caseSensitive: event.target.checked})} /><span>Match case</span></label><label className="find-check"><input type="checkbox" checked={query.whole} onChange={event => change({whole: event.target.checked})} /><span>Whole word</span></label>
      <div className="toggle-group"><button type="button" title="Regular expression" aria-label="Regular expression" aria-pressed={query.mode === 'regex'} onClick={() => change({mode: query.mode === 'regex' ? 'literal' : 'regex'})}>.*</button></div>
      <div className="find-arrows"><IconButton className="outline-button" icon={ArrowUp} label="Previous match" onClick={() => next(-1)}><span>Previous</span></IconButton><IconButton className="primary-button" icon={ArrowDown} label="Next match" onClick={() => next(1)}><span>Find Next</span></IconButton></div>
      <span className="find-count" role="status">{result.pending ? 'Searching…' : result.error ? 'Search error' : result.matches.length ? `${index < 0 ? '0' : index + 1} of ${result.matches.length}${result.truncated ? '+' : ''}` : 'No matches'}</span>
      <IconButton icon={Settings2} label="Search options" onClick={options} /><IconButton icon={X} label="Close find" onClick={close} />
    </div>
    {replace && <div className="find-row replace-row"><label htmlFor="replace-value">Replace</label><input id="replace-value" value={query.replacement} onChange={event => change({replacement: event.target.value})} /><button className="outline-button" disabled={!result.matches.length || result.pending} onClick={() => apply(false)}>Replace</button><button className="outline-button" disabled={!result.matches.length || result.truncated || result.pending} onClick={() => apply(true)}>Replace All</button><button className="text-button" disabled={!result.matches.length || result.pending} onClick={mark}>Bookmark</button></div>}
    {result.error && <p className="inline-error" role="alert">{result.error}</p>}
  </section>
}

export function Output({data, close}) {
  return <section className="output" aria-label="Output"><div className="panel-heading"><Terminal size={16} /><strong>{data.title}</strong><span className="toolbar-fill" /><IconButton icon={X} label="Close output" onClick={close} /></div><pre>{data.text}</pre></section>
}
