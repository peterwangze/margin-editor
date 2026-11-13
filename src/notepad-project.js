export function readNotepadProject(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  const root = xml.querySelector('NotepadPlus')
  if (xml.querySelector('parsererror') || !root) throw new Error('Choose a valid Notepad++ project XML file.')
  let count = 0
  const parse = (node, depth = 0) => {
    if (++count > 5000 || depth > 30) throw new Error('This project exceeds 5,000 entries or 30 levels of folders.')
    const name = node.getAttribute('name')?.trim()
    if (!name) return []
    if (node.tagName === 'File') return [{path: name, name: name.split(/[\\/]/).at(-1)}]
    if (node.tagName !== 'Folder' && node.tagName !== 'Project') return []
    return [{name, children: [...node.children].flatMap(child => parse(child, depth + 1))}]
  }
  const projects = [...root.querySelectorAll(':scope > Project')].flatMap(node => parse(node))
  if (!projects.length) throw new Error('No Notepad++ Project entries were found.')
  return projects
}
