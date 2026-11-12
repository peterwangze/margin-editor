import {EditorSelection} from '@codemirror/state'
import {undo, redo, selectAll, copyLineDown, deleteLine, moveLineUp, moveLineDown, toggleLineComment, toggleBlockComment, indentMore, indentLess} from '@codemirror/commands'
import {foldAll, unfoldAll, syntaxTree} from '@codemirror/language'
import {selectNextOccurrence} from '@codemirror/search'
import {highlightTree, classHighlighter} from '@lezer/highlight'
import {encodings} from '../shared/text.mjs'
import {basename, dirname, symbolsFor} from './documents'
import {goTo, insertAtSelections, toggleOverwrite} from './editor'
import {definitions, lineTransforms, menus, transforms} from './commands'

const field = (name, label, value, options = {}) => ({name, label, value, ...options})
const simple = {undo, redo, selectAll, selectNext: selectNextOccurrence, deleteLine, moveUp: moveLineUp, moveDown: moveLineDown, comment: toggleLineComment, blockComment: toggleBlockComment, indent: indentMore, outdent: indentLess, foldAll, unfoldAll, overwrite: toggleOverwrite}
const escapeHTML = value => value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char])

export function useCommands(ctx) {
  const {model: m, api, find, notify, setPanel, setDialog, setOutput, setCompanion, setTail, setMinimap, setSync, clip, recorded, recording, setRecording, setTheme, download, pickImport, languageNames} = ctx
  const doc = m.doc
  const setting = data => m.setSettings({...m.settings, ...data})
  const edit = callback => {
    const view = m.selectedView()
    if (view) callback(view)
  }
  const alter = callback => edit(view => { if (!view.state.readOnly) callback(view) })
  const textDialog = (label, fields, submit, detail, action) => setDialog({kind: 'fields', label, fields, submit, detail, action})
  const pick = (label, items, run) => setDialog({kind: 'palette', label, items, run})
  const getSelection = view => view.state.selection.ranges.filter(range => !range.empty).map(range => view.state.sliceDoc(range.from, range.to)).join('\n')
  const toggleView = name => setPanel(current => current === name ? '' : name)

  const rememberClip = value => { if (value) clip.current = [value, ...clip.current.filter(item => item !== value)].slice(0, 20) }
  const writeClip = async value => {
    if (api) await api.clipboard(value)
    else await navigator.clipboard.writeText(value)
    rememberClip(value)
  }
  const copy = async (cut = false) => {
    const view = m.selectedView()
    const text = view ? getSelection(view) : ''
    if (!text) return
    await writeClip(text)
    if (cut && view === m.selectedView()) insertAtSelections(view, () => '')
  }
  async function paste() {
    const view = m.selectedView()
    const value = api ? await api.clipboard() : await navigator.clipboard.readText()
    rememberClip(value)
    if (!view || view !== m.selectedView()) return
    const lines = value.replace(/\r\n?/g, '\n').split('\n')
    insertAtSelections(view, (_, index) => lines.length > 1 && lines.length === view.state.selection.ranges.length ? lines[index] : lines.join('\n'))
  }
  function applyTransform(transform, whole = false) {
    alter(view => {
      if (whole || view.state.selection.ranges.every(range => range.empty)) {
        const original = view.state.doc.toString()
        const text = transform(original)
        if (text !== original) view.dispatch({changes: {from: 0, to: original.length, insert: text}, userEvent: 'input.transform'})
      } else insertAtSelections(view, transform)
    })
  }
  function applyLines(transform) {
    alter(view => {
      const {state} = view
      const hasSelection = state.selection.ranges.some(range => !range.empty)
      const range = state.selection.main
      const from = hasSelection ? state.doc.lineAt(range.from).from : 0
      const to = hasSelection ? state.doc.lineAt(Math.max(range.from, range.to - 1)).to : state.doc.length
      const text = state.sliceDoc(from, to)
      const eof = text.endsWith('\n')
      const lines = (eof ? text.slice(0, -1) : text).split('\n')
      view.dispatch({changes: {from, to, insert: transform(lines, m.settings.tabSize).join('\n') + (eof ? '\n' : '')}, userEvent: 'input.transform'})
    })
  }
  function setFormat(encoding, eol) {
    m.amend(doc.id, item => {
      const next = {encoding: encoding ?? item.encoding, eol: eol ?? item.eol, mixed: eol ? null : item.mixed}
      if (next.encoding === item.encoding && next.eol === item.eol && next.mixed === item.mixed) return {}
      return {...next, dirty: true}
    })
  }
  function bookmark(step) {
    edit(view => {
      const line = view.state.doc.lineAt(view.state.selection.main.head).number
      const lines = doc.bookmarks ?? []
      if (!step) { m.amend(doc.id, {bookmarks: (lines.includes(line) ? lines.filter(n => n !== line) : [...lines, line]).sort((a, b) => a - b)}); return }
      if (!lines.length) { notify('No bookmarks in this document.'); return }
      const target = step > 0 ? lines.find(n => n > line) ?? lines[0] : lines.findLast(n => n < line) ?? lines.at(-1)
      goTo(view, target)
    })
  }
  function markMatches() {
    edit(view => {
      const lines = new Set(doc.bookmarks)
      for (const match of find.result.matches) if (match.from <= view.state.doc.length) lines.add(view.state.doc.lineAt(match.from).number)
      m.amend(doc.id, {bookmarks: [...lines].sort((a, b) => a - b)})
      notify(`${lines.size} bookmarked lines.`)
    })
  }
  function modifyBookmarks(remove) {
    edit(view => {
      const lines = doc.bookmarks.filter(line => line <= view.state.doc.lines).map(line => view.state.doc.line(line))
      if (!remove) return writeClip(lines.map(line => line.text).join('\n')).catch(error => notify(error.message))
      if (view.state.readOnly || !lines.length) return
      view.dispatch({changes: lines.map(line => ({from: line.from, to: Math.min(line.to + 1, view.state.doc.length)})), userEvent: 'delete.line'})
      m.amend(doc.id, {bookmarks: []})
    })
  }

  function playMacro(steps, repeats = 1) {
    alter(view => {
      if (!steps?.length) { notify('Record a macro first.'); return }
      const initial = view.state
      let state = initial
      let combined = initial.changes([])
      for (let n = 0; n < repeats; n++) for (const step of steps) {
        const anchor = state.selection.main.head
        const changes = step.changes.map(item => ({from: anchor + item.from, to: anchor + item.to, insert: item.insert}))
        if (changes.some(item => item.from < 0 || item.to > state.doc.length)) throw new Error('The macro would move beyond this document.')
        const length = state.doc.length + changes.reduce((sum, item) => sum + item.insert.length - (item.to - item.from), 0)
        const next = Math.max(0, Math.min(length, anchor + step.cursor))
        const transaction = state.update({changes, selection: {anchor: next}})
        combined = combined.compose(transaction.changes)
        state = transaction.state
      }
      view.dispatch({changes: combined, selection: state.selection, userEvent: 'input.macro', scrollIntoView: true})
    })
  }

  async function runTool(value) {
    if (!api) throw new Error('Open the desktop app to run a local tool.')
    const args = JSON.parse(value.args || '[]')
    if (!Array.isArray(args) || args.some(item => typeof item !== 'string')) throw new Error('Arguments must be a JSON array of strings.')
    const macros = {'${file}': doc.path ?? '', '${name}': doc.name, '${dir}': doc.path ? dirname(doc.path) : m.workspace ?? ''}
    const resolved = args.map(item => item.replace(/\$\{(?:file|name|dir)\}/g, token => macros[token]))
    const output = await api.run(value.executable, resolved, m.workspace ?? (doc.path ? dirname(doc.path) : null))
    setOutput({title: `${value.name || value.executable} · ${output.signal ?? `exit ${output.code}`}`, text: output.output + (output.truncated ? '\n[Output truncated]' : '')})
  }
  const toolFields = [field('name', 'Name', '', {placeholder: 'Optional'}), field('executable', 'Executable', '', {required: true}), field('args', 'Arguments (JSON)', '[]', {type: 'textarea'})]

  const actions = {
    new: () => m.create(), open: () => m.open(), openFolder: () => m.pickFolder(),
    recent: () => pick('Recent Files', m.recent.map(path => ({id: path, label: basename(path), detail: path})), item => m.openPath(item.id)),
    quick: () => pick('Quick Open', [...m.docs.map(item => ({id: item.id, label: item.name, detail: item.path, open: true})), ...m.entries.filter(item => !item.dir && !m.docs.some(doc => doc.path === item.path)).map(item => ({id: item.path, label: item.name, detail: item.path}))], item => item.open ? m.focus(item.id) : m.openPath(item.id)),
    save: () => m.save(), saveAs: () => m.save(doc.id, 'as'), saveCopy: () => m.save(doc.id, 'copy'),
    saveAll: async () => { for (const item of m.docsRef.current.filter(item => item.dirty)) if (!await m.save(item.id)) break },
    reload: () => m.reload(doc), reveal: () => api.reveal(doc.path),
    rename: () => textDialog('Rename file', [field('name', 'Filename', doc.name, {required: true})], async ({name}) => {
      const info = await api.rename(doc.path, name)
      m.amend(doc.id, {name: info.name, path: info.path, mtime: info.mtime, size: info.size})
      if (m.workspace) await m.setFolder(m.workspace)
    }),
    trash: async () => {
      if (doc.dirty) throw new Error('Save or discard your edits before moving this file to trash.')
      if (await m.confirm(`Move ${doc.name} to trash?`, doc.path, ['Move to Trash', 'Cancel']) !== 0) return
      await api.trash(doc.path)
      await m.close([doc.id])
      if (m.workspace) await m.setFolder(m.workspace)
    },
    close: () => m.close([doc.id]), closeAll: () => m.close(m.docs.map(item => item.id)), closeOthers: () => m.close(m.docs.filter(item => item.id !== doc.id && !item.pinned).map(item => item.id)), reopen: () => m.reopen(),
    print: async () => {
      document.querySelector('#print-sheet').textContent = doc.text
      if (api) await api.print()
      else window.print()
    },
    exportSession: () => download('margin-session.json', JSON.stringify(m.snapshot.current(), null, 2)),
    importSession: () => pickImport('session'),
    copy: () => copy(), cut: () => copy(true), paste,
    clipHistory: () => pick('Clipboard History', clip.current.map((value, id) => ({id, label: value.slice(0, 120), value})), item => insertAtSelections(m.selectedView(), () => item.value)),
    duplicate: () => alter(view => view.state.selection.ranges.every(range => range.empty) ? copyLineDown(view) : view.dispatch(view.state.changeByRange(range => {
      const text = view.state.sliceDoc(range.from, range.to)
      return {changes: {from: range.to, insert: text}, range: EditorSelection.range(range.to, range.to + text.length)}
    }))),
    column: () => textDialog('Column editor', [field('value', 'Insert text', ''), field('first', 'Initial number (optional)', '', {type: 'number'}), field('step', 'Increment', '1', {type: 'number'}), field('pad', 'Pad digits', '0', {type: 'number', min: 0, max: 20})], value => {
      insertAtSelections(m.selectedView(), (_, index) => value.first === '' ? value.value : `${value.value}${String(Number(value.first) + index * Number(value.step)).padStart(Number(value.pad), '0')}`)
    }, 'Use Alt+drag to select a column or add multiple cursors before inserting.'),
    readOnly: () => { if (!doc.lossy) m.amend(doc.id, {readOnly: !doc.readOnly}) },
    insertDate: () => insertAtSelections(m.selectedView(), () => new Date().toLocaleString()),
    characters: () => textDialog('Insert character', [field('code', 'Unicode code point (hex)', '00A0', {required: true})], ({code}) => {
      const clean = code.replace(/^U\+|^0x/i, '')
      if (!/^[0-9a-f]{1,6}$/i.test(clean) || !String.fromCodePoint(parseInt(clean, 16)).isWellFormed()) throw new Error('Enter a valid Unicode code point.')
      insertAtSelections(m.selectedView(), () => String.fromCodePoint(parseInt(clean, 16)))
    }),
    find: () => find.open('find'), replace: () => find.open('replace'), next: () => find.next(1), previous: () => find.next(-1), projectSearch: () => setPanel('search'),
    findOpen: () => ctx.openDocumentsSearch(),
    searchOptions: () => textDialog('Find options', [field('mode', 'Search mode', find.query.mode, {options: ['literal', 'extended', 'regex']}), field('wrap', 'Wrap around', find.query.wrap, {type: 'checkbox'}), field('dotAll', 'Dot matches newline', find.query.dotAll, {type: 'checkbox'}), field('inSelection', 'In selection', find.query.inSelection, {type: 'checkbox'})], value => { find.change(value); if (!find.show) find.setShow('find') }),
    goto: () => textDialog('Go to line', [field('line', 'Line', '1', {type: 'number', required: true, min: 1}), field('column', 'Column', '1', {type: 'number', min: 1})], ({line, column}) => goTo(m.selectedView(), Number(line), Number(column))),
    symbol: () => pick('Go to Symbol', symbolsFor(doc, m.settings.languages.find(item => item.name === doc.language)?.outline).map(item => ({id: item.line, label: item.name, detail: `Line ${item.line}`})), item => goTo(m.selectedView(), item.id)),
    bookmark: () => bookmark(0), markMatches, nextBookmark: () => bookmark(1), prevBookmark: () => bookmark(-1), copyBookmarks: () => modifyBookmarks(false), removeBookmarks: () => modifyBookmarks(true), clearBookmarks: () => m.amend(doc.id, {bookmarks: []}),
    explorer: () => toggleView('files'), outline: () => toggleView('outline'), split: () => m.changeSplit('row'), splitBelow: () => m.changeSplit('column'), clone: () => m.changeSplit(m.split || 'row', true), syncScroll: () => setSync(value => !value), minimap: () => setMinimap(value => !value),
    wrap: () => setting({wrap: !m.settings.wrap}), whitespace: () => setting({whitespace: !m.settings.whitespace}), lineNumbers: () => setting({numbers: !m.settings.numbers}),
    preview: () => setCompanion(value => value === 'markdown' ? '' : 'markdown'), diff: () => setCompanion(value => value === 'diff' ? '' : 'diff'),
    tail: () => setTail(value => value === doc.id ? null : doc.id), fullscreen: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(),
    zoomIn: () => setting({fontSize: Math.min(36, m.settings.fontSize + 1)}), zoomOut: () => setting({fontSize: Math.max(10, m.settings.fontSize - 1)}), zoomReset: () => setting({fontSize: 15}), theme: setTheme,
    convert: () => textDialog('Convert encoding', [field('encoding', 'Save as encoding', doc.encoding, {options: encodings})], ({encoding}) => setFormat(encoding), 'Save writes the new encoding after a lossless round-trip check.'),
    reinterpret: () => textDialog('Reopen with encoding', [field('encoding', 'Interpret disk bytes as', doc.encoding, {options: encodings})], ({encoding}) => m.reload(doc, encoding)),
    lf: () => setFormat(null, 'LF'), crlf: () => setFormat(null, 'CRLF'), cr: () => setFormat(null, 'CR'),
    language: () => pick('Select Language', ['Plain Text', ...languageNames, ...m.settings.languages.map(item => item.name)].map(id => ({id, label: id})), item => m.amend(doc.id, {language: item.id})),
    customLanguage: () => textDialog('Custom language', [field('name', 'Name', '', {required: true}), field('extensions', 'File extensions (space separated)', ''), field('keywords', 'Keywords', '', {type: 'textarea'}), field('comment', 'Line comment prefix', '#'), field('outline', 'Outline regex (optional)', '')], value => {
      if (value.outline) new RegExp(value.outline, 'u')
      setting({languages: [...m.settings.languages.filter(item => item.name !== value.name), value]})
      m.amend(doc.id, {language: value.name})
    }),
    importUdl: () => pickImport('udl'),
    macroRecord: () => { if (!recording) recorded.current = []; setRecording(!recording); notify(recording ? `Recorded ${recorded.current.length} actions.` : 'Recording macro…') },
    macroPlay: () => playMacro(recorded.current),
    macroSave: () => textDialog('Save macro', [field('name', 'Name', '', {required: true})], ({name}) => {
      if (!recorded.current.length) throw new Error('Record a macro first.')
      m.setMacros([...m.macros.filter(item => item.name !== name), {name, steps: [...recorded.current]}])
    }),
    macroLibrary: () => pick('Saved Macros', m.macros.map(item => ({id: item.name, label: item.name, item})), ({item}) => textDialog(item.name, [field('count', 'Repeat count', '1', {type: 'number', min: 1, max: 1000})], ({count}) => playMacro(item.steps, Number(count)), null, 'Play')),
    run: () => textDialog('Run external tool', toolFields, runTool, 'Arguments may include ${file}, ${name}, and ${dir}.', 'Run'),
    tools: () => pick('Saved External Tools', [{id: 'add', label: 'Add a tool…'}, ...m.settings.tools.map(item => ({id: item.name, label: item.name, item}))], item => {
      if (item.item) return textDialog('Run ' + item.label, toolFields.map(field => ({...field, value: item.item[field.name]})), runTool, null, 'Run')
      return textDialog('Add external tool', toolFields, value => {
        if (!value.name.trim()) throw new Error('Enter a name for the tool.')
        if (!Array.isArray(JSON.parse(value.args))) throw new Error('Arguments must be a JSON array.')
        setting({tools: [...m.settings.tools.filter(item => item.name !== value.name), value]})
      }, null, 'Save')
    }),
    exportHtml: () => edit(view => {
      const text = view.state.doc.toString()
      const chunks = []
      let cursor = 0
      highlightTree(syntaxTree(view.state), classHighlighter, (from, to, style) => { chunks.push(escapeHTML(text.slice(cursor, from)), `<span class="${style}">${escapeHTML(text.slice(from, to))}</span>`); cursor = to })
      chunks.push(escapeHTML(text.slice(cursor)))
      download(`${doc.name}.html`, `<!doctype html><meta charset="utf-8"><title>${escapeHTML(doc.name)}</title><style>body{background:#191721;color:#f2edf8;padding:2rem}pre{white-space:pre-wrap}.tok-string{color:#9ce5ba}.tok-keyword,.tok-propertyName{color:#cab2f9}.tok-number{color:#efb393}.tok-comment{color:#a3a0b0}</style><pre>${chunks.join('')}</pre>`)
    }),
    settings: () => setDialog({kind: 'settings'}),
    keybindings: () => pick('Keyboard Shortcuts', Object.entries(definitions).map(([id, [label, key]]) => ({id, label, key: m.settings.shortcuts[id] ?? key})), item => textDialog(item.label, [field('key', 'Shortcut', item.key ?? '', {placeholder: 'Mod+Shift+K'})], ({key}) => {
      const canonical = key.trim()
      if (canonical && !/^(?:(?:Mod|Alt|Shift)\+)*(?:[A-Z0-9,.=;\-/\\]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Insert|Home|End|Delete|Tab)$/.test(canonical)) throw new Error('Use Mod+Shift+K style shortcuts with an uppercase key.')
      const duplicate = Object.entries(definitions).find(([id, [, defaultKey]]) => id !== item.id && (m.settings.shortcuts[id] ?? defaultKey) === canonical)
      if (canonical && duplicate) throw new Error(`That shortcut is already assigned to ${duplicate[1][0]}.`)
      setting({shortcuts: {...m.settings.shortcuts, [item.id]: canonical}})
    })),
    about: () => setDialog({kind: 'about'}), repository: () => api ? api.openExternal('https://github.com/peterwangze/margin-editor') : window.open('https://github.com/peterwangze/margin-editor', '_blank', 'noopener,noreferrer'),
  }
  for (const [id, action] of Object.entries(simple)) actions[id] = () => (['selectAll', 'selectNext', 'foldAll', 'unfoldAll'].includes(id) ? edit : alter)(action)
  for (const [id, transform] of Object.entries(transforms)) actions[id] = () => applyTransform(transform, id === 'formatJson' || id === 'compactJson')
  for (const [id, transform] of Object.entries(lineTransforms)) actions[id] = () => applyLines(transform)
  for (const id of ['sha256', 'sha1', 'md5']) actions[id] = async () => {
    if (!api) throw new Error('Use the desktop app to calculate hashes.')
    const view = m.selectedView()
    const value = await api.hash(id, getSelection(view) || doc.text)
    setOutput({title: id.toUpperCase(), text: value})
  }
  const requiresPath = new Set(['reload', 'reveal', 'rename', 'trash', 'reinterpret', 'tail'])
  const requiresEditableSize = new Set(['save', 'saveAs', 'saveCopy', 'rename', 'readOnly', 'convert', 'lf', 'crlf', 'cr', 'diff'])
  const groups = Object.fromEntries(Object.entries(menus).flatMap(([group, ids]) => ids.map(id => [id, group])))
  return Object.fromEntries(Object.entries(definitions).map(([id, [label, key]]) => [id, {id, group: groups[id], label: id === 'macroRecord' && recording ? 'Stop macro recording' : label, key: m.settings.shortcuts[id] ?? key, action: actions[id], disabled: (requiresPath.has(id) && !doc.path) || (Boolean(doc.large) && requiresEditableSize.has(id))}]))
}
