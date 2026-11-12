import {formatJsonText} from '../shared/json.mjs'

export const menus = {
  File: ['new', 'open', 'openFolder', 'recent', 'quick', '—', 'save', 'saveAs', 'saveCopy', 'saveAll', 'reload', 'rename', 'reveal', 'trash', '—', 'close', 'closeOthers', 'closeAll', 'reopen', 'print', 'exportSession', 'importSession'],
  Edit: ['undo', 'redo', '—', 'cut', 'copy', 'paste', 'clipHistory', 'selectAll', 'selectNext', '—', 'column', 'duplicate', 'deleteLine', 'moveUp', 'moveDown', 'comment', 'blockComment', 'indent', 'outdent', 'overwrite', 'readOnly', '—', 'upper', 'lower', 'titleCase', 'invertCase', 'sort', 'sortDesc', 'sortNumeric', 'unique', 'removeEmpty', 'trim', 'trimLeading', 'join', 'reverse', 'tabsToSpaces', 'spacesToTabs', 'insertDate', 'characters'],
  Search: ['find', 'replace', 'next', 'previous', 'projectSearch', 'findOpen', 'searchOptions', 'goto', 'symbol', '—', 'bookmark', 'markMatches', 'nextBookmark', 'prevBookmark', 'copyBookmarks', 'removeBookmarks', 'clearBookmarks'],
  View: ['explorer', 'outline', 'split', 'splitBelow', 'clone', 'syncScroll', 'minimap', 'wrap', 'whitespace', 'lineNumbers', 'foldAll', 'unfoldAll', 'preview', 'diff', 'tail', 'fullscreen', 'zoomIn', 'zoomOut', 'zoomReset', 'theme'],
  Encoding: ['convert', 'reinterpret', '—', 'lf', 'crlf', 'cr'],
  Language: ['language', 'customLanguage', 'importUdl', '—', 'formatJson', 'compactJson'],
  Tools: ['palette', 'macroRecord', 'macroPlay', 'macroSave', 'macroLibrary', '—', 'run', 'tools', '—', 'base64Encode', 'base64Decode', 'hexEncode', 'hexDecode', 'urlEncode', 'urlDecode', 'sha256', 'sha1', 'md5', 'exportHtml', 'settings', 'keybindings'],
  Help: ['about', 'repository'],
}

export const definitions = {
  new: ['New document', 'Mod+N'], open: ['Open files…', 'Mod+O'], openFolder: ['Open folder…', 'Mod+Shift+O'], recent: ['Recent files…'], quick: ['Quick open…', 'Mod+P'],
  save: ['Save', 'Mod+S'], saveAs: ['Save as…', 'Mod+Shift+S'], saveCopy: ['Save a copy…'], saveAll: ['Save all'], reload: ['Reload from disk'], rename: ['Rename file…'], reveal: ['Reveal in file manager'], trash: ['Move file to trash…'],
  close: ['Close tab', 'Mod+W'], closeOthers: ['Close other tabs'], closeAll: ['Close all tabs'], reopen: ['Reopen closed tab', 'Mod+Shift+T'], print: ['Print…'], exportSession: ['Export session…'], importSession: ['Import session…'],
  undo: ['Undo', 'Mod+Z'], redo: ['Redo', 'Mod+Y'], cut: ['Cut', 'Mod+X'], copy: ['Copy', 'Mod+C'], paste: ['Paste', 'Mod+V'], clipHistory: ['Clipboard history…'], selectAll: ['Select all', 'Mod+A'], selectNext: ['Add next occurrence to selection', 'Mod+Shift+D'],
  column: ['Column editor…', 'Alt+C'], duplicate: ['Duplicate line or selection', 'Mod+D'], deleteLine: ['Delete line', 'Mod+Shift+L'], moveUp: ['Move line up', 'Alt+ArrowUp'], moveDown: ['Move line down', 'Alt+ArrowDown'],
  comment: ['Toggle line comment', 'Mod+Q'], blockComment: ['Toggle block comment'], indent: ['Indent selection'], outdent: ['Outdent selection'], overwrite: ['Toggle overwrite', 'Insert'], readOnly: ['Toggle read-only'],
  upper: ['UPPERCASE', 'Mod+Shift+U'], lower: ['lowercase', 'Mod+U'], titleCase: ['Title Case'], invertCase: ['Invert Case'], sort: ['Sort lines ascending'], sortDesc: ['Sort lines descending'], sortNumeric: ['Sort lines numerically'], unique: ['Remove duplicate lines'], removeEmpty: ['Remove empty lines'], trim: ['Trim trailing whitespace'], trimLeading: ['Trim leading whitespace'], join: ['Join lines', 'Mod+J'], reverse: ['Reverse lines'], tabsToSpaces: ['Convert tabs to spaces'], spacesToTabs: ['Convert indentation to tabs'], insertDate: ['Insert date and time', 'F5'], characters: ['Insert character…'],
  find: ['Find', 'Mod+F'], replace: ['Replace', 'Mod+H'], next: ['Find next', 'F3'], previous: ['Find previous', 'Shift+F3'], projectSearch: ['Find in Files', 'Mod+Shift+F'], findOpen: ['Find in open documents'], searchOptions: ['Find options…'], goto: ['Go to line…', 'Mod+G'], symbol: ['Go to symbol…', 'Mod+Shift+G'], bookmark: ['Toggle bookmark', 'Mod+F2'], markMatches: ['Bookmark all matches'], nextBookmark: ['Next bookmark', 'F2'], prevBookmark: ['Previous bookmark', 'Shift+F2'], copyBookmarks: ['Copy bookmarked lines'], removeBookmarks: ['Remove bookmarked lines'], clearBookmarks: ['Clear bookmarks'],
  explorer: ['Toggle explorer', 'Mod+B'], outline: ['Toggle outline'], split: ['Split editor', 'Mod+\\'], splitBelow: ['Split editor below'], clone: ['Clone document to other pane'], syncScroll: ['Toggle synchronized scrolling'], minimap: ['Toggle document map'], wrap: ['Toggle word wrap'], whitespace: ['Toggle whitespace'], lineNumbers: ['Toggle line numbers'], foldAll: ['Fold all'], unfoldAll: ['Unfold all'], preview: ['Markdown preview'], diff: ['Compare with saved file'], tail: ['Toggle follow file'], fullscreen: ['Toggle full screen', 'F11'], zoomIn: ['Zoom in', 'Mod+='], zoomOut: ['Zoom out', 'Mod+-'], zoomReset: ['Reset zoom', 'Mod+0'], theme: ['Toggle Ink/Paper theme'],
  convert: ['Convert encoding…'], reinterpret: ['Reopen with encoding…'], lf: ['Convert to LF'], crlf: ['Convert to CRLF'], cr: ['Convert to CR'], language: ['Select language…'], customLanguage: ['Custom languages…'], importUdl: ['Import Notepad++ UDL…'], formatJson: ['Format JSON', 'Mod+Shift+I'], compactJson: ['Compact JSON'],
  palette: ['Command Palette', 'Mod+Shift+P'], macroRecord: ['Start/stop macro recording'], macroPlay: ['Play last macro'], macroSave: ['Save last macro…'], macroLibrary: ['Saved macros…'], run: ['Run external tool…', 'F6'], tools: ['Saved external tools…'], base64Encode: ['Encode Base64'], base64Decode: ['Decode Base64'], hexEncode: ['Encode hexadecimal'], hexDecode: ['Decode hexadecimal'], urlEncode: ['Percent-encode text'], urlDecode: ['Percent-decode text'], sha256: ['Calculate SHA-256'], sha1: ['Calculate SHA-1'], md5: ['Calculate MD5'], exportHtml: ['Export highlighted HTML…'], settings: ['Settings…', 'Mod+,'], keybindings: ['Keyboard shortcuts…'], about: ['About Margin'], repository: ['Source and releases'],
}

export function eventShortcut(event) {
  const mod = navigator.platform.includes('Mac') ? event.metaKey : event.ctrlKey
  const key = event.code === 'Backslash' && !event.altKey ? '\\' : event.key.length === 1 ? event.key.toUpperCase() : event.key
  return [mod ? 'Mod' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', key].filter(Boolean).join('+')
}

export const transforms = {
  upper: value => value.toUpperCase(), lower: value => value.toLowerCase(), titleCase: value => value.toLowerCase().replace(/(?:^|[^\p{L}\p{N}])\p{L}/gu, part => part.toUpperCase()),
  invertCase: value => value.replace(/\p{L}/gu, part => part === part.toUpperCase() ? part.toLowerCase() : part.toUpperCase()),
  formatJson: value => formatJsonText(value, 2), compactJson: value => formatJsonText(value, 0),
  urlEncode: encodeURIComponent, urlDecode: decodeURIComponent,
  base64Encode: value => btoa(Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join('')),
  base64Decode: value => new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(value), char => char.charCodeAt(0))),
  hexEncode: value => Array.from(new TextEncoder().encode(value), byte => byte.toString(16).padStart(2, '0')).join(' '),
  hexDecode(value) {
    const input = value.replace(/\s/g, '')
    if (!/^(?:[0-9a-f]{2})*$/i.test(input)) throw new Error('Enter complete hexadecimal byte pairs.')
    return new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(input.match(/../g) ?? [], byte => Number.parseInt(byte, 16)))
  },
}

export const lineTransforms = {
  sort: lines => lines.sort((a, b) => a.localeCompare(b)), sortDesc: lines => lines.sort((a, b) => b.localeCompare(a)),
  sortNumeric: lines => lines.sort((a, b) => a.localeCompare(b, undefined, {numeric: true})), unique: lines => [...new Set(lines)],
  removeEmpty: lines => lines.filter(line => line.trim()), trim: lines => lines.map(line => line.trimEnd()),
  trimLeading: lines => lines.map(line => line.trimStart()), join: lines => [lines.map(line => line.trim()).join(' ')], reverse: lines => lines.reverse(),
  tabsToSpaces: (lines, tab) => lines.map(line => line.replace(/\t/g, ' '.repeat(tab))),
  spacesToTabs: (lines, tab) => lines.map(line => line.replace(/^ +/, prefix => '\t'.repeat(Math.floor(prefix.length / tab)) + ' '.repeat(prefix.length % tab))),
}
