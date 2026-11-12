const {app, BrowserWindow, Menu, ipcMain, dialog, shell, clipboard, protocol, net} = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const {pathToFileURL} = require('node:url')
const {Worker} = require('node:worker_threads')
const {spawn} = require('node:child_process')
const {createHash, randomUUID} = require('node:crypto')

if (process.env.MARGIN_PROFILE) app.setPath('userData', path.resolve(process.env.MARGIN_PROFILE))
const dist = path.join(__dirname, '../dist')
const page = 'margin://local/index.html'
protocol.registerSchemesAsPrivileged([{scheme: 'margin', privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true}}])
let window
let searchJob
let applying = false
let plan
let queued = []
let hasRenderer = false
let sessionQueue = Promise.resolve()
let closing = false
let closeAllowed = false
const files = import('./files.mjs')

function argumentsFor(argv, cwd) {
  const args = argv.slice(process.defaultApp ? 2 : 1)
  let literal = false
  let line = 0, column = 1
  const out = []
  for (const arg of args) {
    if (!literal && arg === '--') { literal = true; continue }
    if (!literal && /^-n\d+$/.test(arg)) { line = Number(arg.slice(2)); continue }
    if (!literal && /^-c\d+$/.test(arg)) { column = Number(arg.slice(2)); continue }
    if (literal || !arg.startsWith('-')) out.push({path: path.resolve(cwd, arg)})
  }
  return out.map(file => ({...file, line, column}))
}

function deliver(paths) {
  if (hasRenderer && window && !window.isDestroyed()) window.webContents.send('margin:openPaths', paths)
  else queued.push(...paths)
}

function worker(action, args, timeout) {
  const instance = new Worker(path.join(__dirname, 'worker.mjs'), {workerData: {action, args}})
  let cancel
  const promise = new Promise((resolve, reject) => {
    const finish = (callback, value, terminate = true) => {
      clearTimeout(timer)
      if (terminate) instance.terminate()
      callback(value)
    }
    cancel = () => finish(reject, new Error('Search cancelled.'))
    const timer = timeout ? setTimeout(() => finish(reject, new Error('Search timed out. Narrow the pattern or directory.')), timeout) : null
    instance.once('message', ({result, error}) => error ? finish(reject, new Error(error)) : finish(resolve, result, action !== 'apply'))
    instance.once('error', error => finish(reject, error))
    instance.once('exit', code => finish(reject, new Error(`Workspace worker stopped (${code}).`), false))
  })
  return {promise, cancel}
}

function runTool(executable, args, cwd) {
  if (!executable.trim() || !Array.isArray(args) || args.some(value => typeof value !== 'string')) throw new Error('Provide an executable and an array of arguments.')
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {cwd: cwd || undefined, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe']})
    let output = ''
    let truncated = false
    const collect = chunk => {
      if (output.length >= 256000) { truncated = true; return }
      output += chunk.slice(0, 256000 - output.length)
      truncated ||= output.length === 256000
    }
    child.stdout.setEncoding('utf8').on('data', collect)
    child.stderr.setEncoding('utf8').on('data', collect)
    const timer = setTimeout(() => child.kill(), 30000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({output, code, signal, truncated}) })
  })
}

async function createWindow() {
  hasRenderer = false
  closing = false
  closeAllowed = false
  const mac = process.platform === 'darwin'
  window = new BrowserWindow({width: 1280, height: 832, minWidth: 650, minHeight: 430, show: false,
    backgroundColor: '#191721', titleBarStyle: 'hidden',
    ...(mac ? {trafficLightPosition: {x: 13, y: 12}} : {titleBarOverlay: {color: '#191721', symbolColor: '#f0edf6', height: 36}}),
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false},
  })
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.webContents.session.setPermissionCheckHandler(() => false)
  window.once('ready-to-show', () => window?.show())
  window.on('close', event => {
    if (closeAllowed || !hasRenderer || window.webContents.isCrashed()) return
    event.preventDefault()
    if (!closing) { closing = true; window.webContents.send('margin:beforeClose') }
  })
  window.on('closed', () => { hasRenderer = false; window = null; searchJob?.cancel() })
  await window.loadURL(page)
}

const actions = {
  async pickFiles() { return (await dialog.showOpenDialog(window, {properties: ['openFile', 'multiSelections']})).filePaths },
  async pickFolder() { return (await dialog.showOpenDialog(window, {properties: ['openDirectory']})).filePaths[0] ?? null },
  async open(file, encoding) {
    const stat = await fs.stat(file)
    if (stat.isDirectory()) return {directory: await fs.realpath(file)}
    return (await files).readDocument(file, encoding)
  },
  async saveDialog(defaultPath) { return (await dialog.showSaveDialog(window, {defaultPath, title: 'Save document'})).filePath ?? null },
  async save(filename, document, expected, backup) {
    const f = await files
    if (expected === 'confirmed-dialog') {
      const existing = await f.existing(filename)
      expected = existing ? f.fingerprint((await f.readBytes(existing)).bytes) : null
    }
    return f.saveDocument(filename, document, expected, {backup})
  },
  async entries(dir) {
    const result = []
    const directory = await fs.opendir(dir)
    for await (const entry of directory) {
      if (entry.name === '.git' || !(entry.isFile() || entry.isDirectory())) continue
      result.push({name: entry.name, path: path.join(dir, entry.name), dir: entry.isDirectory()})
      if (result.length === 3000) break
    }
    return result.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, {numeric: true}))
  },
  async changed(checks) {
    const f = await files
    const states = await Promise.all(checks.map(async ({path: file, mtime, size}) => {
      try {
        const stat = await fs.stat(file)
        if (stat.mtimeMs === mtime && stat.size === size) return null
        return {path: file, mtime: stat.mtimeMs, size: stat.size, fingerprint: f.fingerprint((await f.readBytes(file)).bytes)}
      } catch (error) { return {path: file, missing: error.code === 'ENOENT', error: error.message} }
    }))
    return states.filter(Boolean)
  },
  async loadSession() {
    try { return JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'session.json'), 'utf8')) }
    catch (error) { if (error.code === 'ENOENT') return null; throw error }
  },
  async storeSession(session) {
    const file = path.join(app.getPath('userData'), 'session.json')
    const json = JSON.stringify(session)
    if (Buffer.byteLength(json) > 160 * 1024 * 1024) throw new Error('The session exceeds the recovery snapshot limit. Save some documents.')
    const next = sessionQueue.catch(() => {}).then(async () => (await files).atomicWrite(file, json))
    sessionQueue = next
    return next
  },
  async search(root, query, options) {
    if (applying) throw new Error('Wait for the current replacement to finish.')
    searchJob?.cancel()
    plan = null
    const job = worker('search', [root, query, options], 18000)
    searchJob = job
    try {
      const result = await job.promise
      const token = options.preview && !result.truncated ? randomUUID() : null
      if (token) plan = {token, result, query}
      return {...result, token}
    } finally { if (searchJob === job) searchJob = null }
  },
  cancelSearch() { searchJob?.cancel() },
  async replace(token, selected) {
    if (!plan || plan.token !== token || applying) throw new Error('Run Preview Replace before applying changes.')
    const {result, query} = plan
    plan = null
    applying = true
    try { return await worker('apply', [result, query, selected], 0).promise }
    finally { applying = false }
  },
  clipboard(text) { if (text !== undefined) clipboard.writeText(text); return clipboard.readText() },
  print() { return new Promise((resolve, reject) => window.webContents.print({printBackground: false}, (ok, reason) => ok || reason === 'Print job canceled' ? resolve(ok) : reject(new Error(reason)))) },
  reveal(file) { shell.showItemInFolder(file) },
  async rename(file, name) {
    if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) throw new Error('Enter a filename without a directory.')
    const dest = path.join(path.dirname(file), name)
    if (file === dest) return (await files).readDocument(file)
    await fs.link(file, dest)
    try { await fs.unlink(file) }
    catch (error) { await fs.unlink(dest).catch(() => {}); throw error }
    return (await files).readDocument(dest)
  },
  trash(file) { return shell.trashItem(file) },
  run: runTool,
  hash(algorithm, value) { return createHash(algorithm).update(value).digest('hex') },
  initial() { hasRenderer = true; return queued.splice(0) },
  closeReply(allowed) {
    closing = false
    if (allowed) { closeAllowed = true; setImmediate(() => window?.close()) }
  },
  async confirm(message, detail, buttons) {
    const {response} = await dialog.showMessageBox(window, {type: 'warning', message, detail, buttons, defaultId: 0, cancelId: buttons.length - 1, noLink: true})
    return response
  },
  titleStyle(light) { if (process.platform !== 'darwin') window.setTitleBarOverlay({color: light ? '#f6f4fa' : '#191721', symbolColor: light ? '#2a2440' : '#f0edf6', height: 36}) },
  openExternal(url) { if (url === 'https://github.com/peterwangze/margin-editor') return shell.openExternal(url) },
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  queued = argumentsFor(process.argv, process.cwd())
  app.on('open-file', (event, file) => { event.preventDefault(); deliver([{path: file}]) })
  app.on('second-instance', (_event, argv, cwd) => {
    deliver(argumentsFor(argv, cwd))
    if (!window) createWindow().catch(console.error)
    else { if (window.isMinimized()) window.restore(); window.focus() }
  })
  app.whenReady().then(async () => {
    protocol.handle('margin', request => {
      const url = new URL(request.url)
      const resource = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`)
      if (url.hostname !== 'local' || !resource.startsWith(dist + path.sep)) return new Response(null, {status: 404})
      return net.fetch(pathToFileURL(resource).href)
    })
    if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{role: 'appMenu'}, {role: 'editMenu'}, {role: 'windowMenu'}]))
    else Menu.setApplicationMenu(null)
    for (const [name, handler] of Object.entries(actions)) ipcMain.handle(`margin:${name}`, (event, ...args) => {
      if (event.sender !== window?.webContents || event.senderFrame?.url !== page) throw new Error('Invalid request origin.')
      return handler(...args)
    })
    await createWindow()
    app.on('activate', () => { if (!window) createWindow().catch(console.error) })
  }).catch(error => { console.error(error); app.exit(1) })
  app.on('before-quit', event => {
    if (applying) event.preventDefault()
  })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
