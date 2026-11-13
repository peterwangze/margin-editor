const commands = new Map(Object.entries({
  41001: 'new', 41002: 'open', 41003: 'close', 41004: 'closeAll', 41005: 'closeOthers', 41006: 'save', 41007: 'saveAll',
  41008: 'saveAs', 41010: 'print', 41014: 'reload', 41015: 'saveCopy', 41019: 'reveal', 41021: 'reopen', 41022: 'openFolder',
  42001: 'cut', 42002: 'copy', 42003: 'undo', 42004: 'redo', 42005: 'paste', 42007: 'selectAll', 42010: 'duplicate', 42016: 'upper', 42017: 'lower',
  43001: 'find', 43002: 'next', 43003: 'replace', 43004: 'goto', 43005: 'bookmark', 43006: 'nextBookmark', 43007: 'prevBookmark',
  43008: 'clearBookmarks', 43010: 'previous', 43013: 'projectSearch',
  44019: 'whitespace', 44022: 'wrap', 44032: 'fullscreen', 44095: 'nextTab', 44096: 'previousTab',
}))

const virtualKeys = {9: 'Tab', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 45: 'Insert', 46: 'Delete', 186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 220: '\\'}

function readKey(node) {
  const code = Number(node.getAttribute('Key'))
  if (code === 0) return ''
  const key = virtualKeys[code] ?? (code >= 112 && code <= 123 ? `F${code - 111}` : (code >= 48 && code <= 57 || code >= 65 && code <= 90) ? String.fromCharCode(code) : undefined)
  if (!key) return undefined
  return [node.getAttribute('Ctrl') === 'yes' && 'Mod', node.getAttribute('Alt') === 'yes' && 'Alt', node.getAttribute('Shift') === 'yes' && 'Shift', key].filter(Boolean).join('+')
}

export function readNotepadShortcuts(text, current, definitions, t) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  const root = xml.querySelector('NotepadPlus > InternalCommands')
  if (xml.querySelector('parsererror') || !root) throw new Error('Choose a valid Notepad++ shortcuts.xml file.')
  const settings = {...current}
  const skipped = []
  let count = 0
  for (const node of root.querySelectorAll(':scope > Shortcut')) {
    const id = commands.get(node.getAttribute('id'))
    const key = readKey(node)
    if (!id || key === undefined) { skipped.push(t('Command {id}', {id: node.getAttribute('id') ?? '?'})); continue }
    const conflict = Object.keys(definitions).find(other => other !== id && (settings[other] ?? definitions[other][1]) === key)
    if (key && conflict) {
      skipped.push(t('{command} · {key} is used by {conflict}', {command: t(definitions[id][0]), key, conflict: t(definitions[conflict][0])}))
      continue
    }
    settings[id] = key
    count++
  }
  for (const group of ['Macros', 'UserDefinedCommands', 'PluginCommands', 'ScintillaKeys']) {
    const nodes = xml.querySelector(`NotepadPlus > ${group}`)
    if (nodes?.children.length) skipped.push(t('{group} ({count} entries)', {group, count: nodes.children.length}))
  }
  return {settings, count, skipped}
}
