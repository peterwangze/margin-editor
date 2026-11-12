import {newlines} from '../shared/text.mjs'

export const defaults = {theme: 'dark', tabSize: 2, fontSize: 15, numbers: true, spaces: true, whitespace: false, wrap: false, backup: false, autocomplete: true, indentGuides: true, recover: true, shortcuts: {}, languages: [], tools: [], rtl: false}

const samples = {
  'workspace.json': `{
  "name": "demo-workspace",
  "version": "1.0.0",
  "editor": {
    "tabSize": 2,
    "insertSpaces": true,
    "wordWrap": "off",
    "lineNumbers": "on"
  },
  "workspace": {
    "root": ".",
    "files": [
      "workspace.json",
      "welcome.md",
      "notes.txt"
    ]
  },
  "languages": [
    "json",
    "markdown",
    "text"
  ]
}
`,
  'welcome.md': `# Welcome to Margin\n\nA workbench for local text and code.\n\n- Open a file or a folder from the toolbar.\n- Use **Find** to search the current document.\n- Use **Find in Files** to preview changes across a folder.\n- Open the **Command Palette** to find any command.\n\nThis sample is editable. Save a copy to keep your changes.\n`,
  'notes.txt': 'Field notes\n\nOpen a folder to start exploring.\nChoose an encoding or line ending from the status bar.\n',
}

export function documentFor(name, text = '', extra = {}) {
  const content = newlines(text)
  return {id: crypto.randomUUID(), name, ...content, path: null, encoding: 'UTF-8', dirty: false, readOnly: false, bookmarks: [], ...extra}
}

export const demoDocuments = () => Object.entries(samples).map(([name, text]) => documentFor(name, text, {sample: true}))
export const basename = path => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
export const dirname = path => path.replace(/[\\/][^\\/]*$/, '')

export function browserSession() {
  try { return JSON.parse(localStorage.getItem('margin.session.v1')) }
  catch { return null }
}

export function symbolsFor(doc, rule) {
  const symbols = []
  let custom
  try { if (rule) custom = new RegExp(rule, 'u') }
  catch { return symbols }
  const pattern = custom ?? /^(?:\s*#{1,6}\s+(.+)|\s*(?:(?:export|default|async|public|private|static)\s+)*(?:class|function|def|fn|interface|struct|enum|type)\s+([\w$]+)|\s*"([^"]+)"\s*:|\s*<([A-Za-z_][\w:.-]*)\b|\s*(?:const|let|var)\s+([\w$]+)\s*=)/
  const lines = doc.text.split('\n')
  for (let index = 0; index < lines.length && symbols.length < 400; index++) {
    const match = lines[index].match(pattern)
    if (match) symbols.push({name: match.slice(1).find(Boolean) ?? match[0], line: index + 1})
  }
  return symbols
}
