const encoder = new TextEncoder()
const newline = {LF: '\n', CRLF: '\r\n', CR: '\r'}

export function readNotepadPreferences(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  const configs = xml.querySelector('NotepadPlus > GUIConfigs')
  if (xml.querySelector('parsererror') || !configs) throw new Error('Choose a valid Notepad++ config.xml file.')
  const get = name => [...configs.children].find(node => node.tagName === 'GUIConfig' && node.getAttribute('name') === name)
  const settings = {}
  const boolean = (key, value, yes = 'yes', no = 'no') => { if (value === yes || value === no) settings[key] = value === yes }
  const tabs = get('TabSetting')
  const width = integer(tabs ?? configs, 'size')
  if (width > 0 && width <= 32) settings.tabSize = width
  boolean('spaces', tabs?.getAttribute('replaceBySpace'))
  const editor = get('ScintillaPrimaryView')
  boolean('numbers', editor?.getAttribute('lineNumberMargin'), 'show', 'hide')
  boolean('whitespace', editor?.getAttribute('whiteSpaceShow'), 'show', 'hide')
  boolean('wrap', editor?.getAttribute('Wrap'))
  boolean('recover', get('RememberLastSession')?.textContent.trim())
  const theme = get('DarkMode')?.getAttribute('enable')
  if (theme === 'yes' || theme === 'no') settings.theme = theme === 'yes' ? 'dark' : 'light'
  const backup = get('Backup')?.getAttribute('action')
  if (['0', '1', '2'].includes(backup)) settings.backup = backup !== '0'
  const completion = get('auto-completion')?.getAttribute('autoCAction')
  if (['0', '1', '2', '3'].includes(completion)) settings.autocomplete = completion !== '0'
  const newFile = get('NewDocDefaultSettings')
  const eol = {'0': 'CRLF', '1': 'CR', '2': 'LF'}[newFile?.getAttribute('format')]
  if (eol) settings.newEol = eol
  const encoding = notepadEncoding(newFile?.getAttribute('codepage') ?? null) ?? {'0': 'Windows-1252', '1': 'UTF-8 BOM', '2': 'UTF-16 BE', '3': 'UTF-16 LE', '4': 'UTF-8'}[newFile?.getAttribute('encoding')]
  if (encoding) settings.newEncoding = encoding
  if (!Object.keys(settings).length) throw new Error('No supported preferences were found in this config.xml.')
  return settings
}

function integer(node, name, fallback = 0) {
  const number = Number(node.getAttribute(name) ?? fallback)
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback
}

export function readNotepadSession(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  const session = xml.querySelector('NotepadPlus > Session')
  if (xml.querySelector('parsererror') || !session) throw new Error('Choose a valid Notepad++ session XML file.')
  const views = ['mainView', 'subView'].map(name => {
    const view = session.querySelector(`:scope > ${name}`)
    return {active: view ? integer(view, 'activeIndex') : 0, files: [...(view?.querySelectorAll(':scope > File') ?? [])].map(file => ({
      filename: file.getAttribute('filename') ?? '', backup: file.getAttribute('backupFilePath') ?? '',
      start: integer(file, 'startPos'), end: integer(file, 'endPos'), top: integer(file, 'firstVisibleLine'), horizontal: integer(file, 'xOffset'),
      encoding: file.getAttribute('encoding'), language: file.getAttribute('lang'),
      pinned: file.getAttribute('tabPinned') === 'yes', readOnly: file.getAttribute('userReadOnly') === 'yes', rtl: file.getAttribute('RTL') === 'yes',
      bookmarks: [...file.querySelectorAll(':scope > Mark[line]')].map(mark => integer(mark, 'line', -1) + 1).filter(Boolean),
      folds: [...file.querySelectorAll(':scope > Fold[line]')].map(fold => integer(fold, 'line', -1) + 1).filter(Boolean),
    }))}
  })
  if (!views.some(view => view.files.length)) throw new Error('The session contains no documents.')
  if (views[0].files.length + views[1].files.length > 500) throw new Error('Import up to 500 tabs at a time.')
  return {views, activeView: integer(session, 'activeView') === 1 ? 'secondary' : 'main'}
}

export function fromScintillaPositions(doc, requested) {
  const pending = requested.map((offset, index) => ({offset, index})).sort((a, b) => a.offset - b.offset)
  const positions = Array(requested.length).fill(doc.text.length)
  let bytes = 0
  let units = 0
  let breaks = 0
  let target = 0
  for (const char of doc.text) {
    if (target >= pending.length) break
    const width = char === '\n' ? (doc.mixed?.[breaks++] ?? newline[doc.eol] ?? '\n').length : char.codePointAt(0) < 128 ? 1 : encoder.encode(char).length
    while (target < pending.length && pending[target].offset < bytes + width) positions[pending[target++].index] = units
    bytes += width
    units += char.length
  }
  return positions
}

export function notepadEncoding(code) {
  const number = Number(code)
  if (code === null || code === '' || number < 0) return undefined
  if (number === 65001) return 'UTF-8'
  if (number === 1200) return 'UTF-16 LE'
  if (number === 1201) return 'UTF-16 BE'
  if (number === 936) return 'GBK'
  if (number === 54936) return 'GB18030'
  if (number === 950) return 'Big5'
  if (number === 932) return 'Shift_JIS'
  if (number === 949) return 'CP949'
  if (number === 20866) return 'KOI8-R'
  if (number === 21866) return 'KOI8-U'
  if (number >= 1250 && number <= 1258) return `Windows-${number}`
  if (number >= 28591 && number <= 28606 && number !== 28602 && number !== 28603) return `ISO-8859-${number - 28590}`
  if ([437, 720, 737, 775, 850, 852, 855, 857, 858, 860, 861, 862, 863, 864, 865, 866, 869].includes(number)) return `CP${number}`
  return undefined
}
