const {contextBridge, ipcRenderer, webUtils} = require('electron')

const handlers = ['pickFiles', 'pickFolder', 'open', 'largePage', 'save', 'saveDialog', 'entries', 'changed', 'loadSession', 'storeSession', 'search', 'cancelSearch', 'replace', 'clipboard', 'print', 'reveal', 'rename', 'trash', 'run', 'hash', 'initial', 'confirm', 'titleStyle', 'openExternal', 'closeReply']
const api = Object.fromEntries(handlers.map(name => [name, (...args) => ipcRenderer.invoke(`margin:${name}`, ...args)]))
api.pathsFor = files => Array.from(files, file => webUtils.getPathForFile(file))
api.platform = process.platform
api.onOpen = callback => {
  const handler = (_event, paths) => callback(paths)
  ipcRenderer.on('margin:openPaths', handler)
  return () => ipcRenderer.removeListener('margin:openPaths', handler)
}
api.onBeforeClose = callback => {
  const handler = () => callback()
  ipcRenderer.on('margin:beforeClose', handler)
  return () => ipcRenderer.removeListener('margin:beforeClose', handler)
}
contextBridge.exposeInMainWorld('margin', api)
