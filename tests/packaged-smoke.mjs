import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
import {once} from 'node:events'
import fs from 'node:fs/promises'
import {createServer} from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {chromium, expect} from '@playwright/test'

const executable = process.env.MARGIN_EXECUTABLE
const evidence = process.env.MARGIN_EVIDENCE
const packageForm = process.env.MARGIN_PACKAGE_FORM
const {version} = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'))
assert.ok(executable && evidence && packageForm, 'Set MARGIN_EXECUTABLE, MARGIN_EVIDENCE, and MARGIN_PACKAGE_FORM')
const portable = process.platform === 'win32' && packageForm === 'portable'
await fs.mkdir(evidence, {recursive: true})
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-packaged-'))
const profile = path.join(temp, 'profile')
await fs.mkdir(profile)
const file = path.join(temp, 'offline.txt')
await fs.writeFile(file, 'original\r\n')
let child
let exited
let output = ''
let browser
let page
let portableTemp
const pageErrors = []
const addedLocales = {
  'zh-TW': {label: '繁體中文', settings: '設定', preference: '介面語言', system: '跟隨系統', editor: '文件編輯器', search: '尋找與取代', find: '尋找', replace: '取代', closeFind: '關閉尋找列', font: 'Margin Traditional', glyphs: '檔案與儲存'},
  ja: {label: '日本語', settings: '設定', preference: '表示言語', system: 'システム設定に従う', editor: '文書エディター', search: '検索と置換', find: '検索', replace: '置換', closeFind: '検索バーを閉じる', font: 'Margin Japanese', glyphs: '日本語を探す'},
  ko: {label: '한국어', settings: '설정', preference: '인터페이스 언어', system: '시스템 설정 따르기', editor: '문서 편집기', search: '찾기 및 바꾸기', find: '찾기', replace: '바꾸기', closeFind: '찾기 닫기', font: 'Margin Korean', glyphs: '한글 찾기'},
  fr: {label: 'Français', settings: 'Paramètres', preference: 'Langue de l’interface', system: 'Langue du système', editor: 'Éditeur de documents', search: 'Rechercher et remplacer', find: 'Rechercher', replace: 'Remplacer', closeFind: 'Fermer la barre de recherche', font: 'Instrument Sans', glyphs: 'Éléments œ'},
  de: {label: 'Deutsch', settings: 'Einstellungen', preference: 'Oberflächensprache', system: 'Systemsprache verwenden', editor: 'Dokumenteditor', search: 'Suchen und ersetzen', find: 'Suchen', replace: 'Ersetzen', closeFind: 'Suche schließen', font: 'Instrument Sans', glyphs: 'Änderungen ß'},
  es: {label: 'Español', settings: 'Configuración', preference: 'Idioma de la interfaz', system: 'Usar el idioma del sistema', editor: 'Editor de documentos', search: 'Buscar y reemplazar', find: 'Buscar', replace: 'Reemplazar', closeFind: 'Cerrar la barra de búsqueda', font: 'Instrument Sans', glyphs: 'Español ¿'},
  it: {label: 'Italiano', settings: 'Impostazioni', preference: 'Lingua dell’interfaccia', system: 'Segui la lingua di sistema', editor: 'Editor di documenti', search: 'Trova e sostituisci', find: 'Trova', replace: 'Sostituisci', closeFind: 'Chiudi ricerca', replaceAll: 'Sostituisci tutto', undo: 'Annulla', font: 'Instrument Sans', glyphs: 'Già perché'},
  pt: {label: 'Português', settings: 'Configurações', preference: 'Idioma da interface', system: 'Usar idioma do sistema', editor: 'Editor de documentos', search: 'Localizar e substituir', find: 'Localizar', replace: 'Substituir', closeFind: 'Fechar barra de pesquisa', replaceAll: 'Substituir tudo', undo: 'Desfazer', font: 'Instrument Sans', glyphs: 'Edição e ação'},
  ru: {label: 'Русский', settings: 'Настройки', preference: 'Язык интерфейса', system: 'Как в системе', editor: 'Редактор документов', search: 'Поиск и замена', find: 'Найти', replace: 'Заменить', closeFind: 'Закрыть панель поиска', replaceAll: 'Заменить всё', undo: 'Отменить', font: 'Noto Sans', glyphs: 'Привет, мир! Ёж № 1'},
  ar: {label: 'العربية', settings: 'الإعدادات', preferences: 'التفضيلات…', preference: 'لغة الواجهة', system: 'اتباع لغة النظام', editor: 'محرر المستندات', search: 'بحث واستبدال', find: 'بحث', replace: 'استبدال', closeFind: 'إغلاق البحث', replaceAll: 'استبدال الكل', undo: 'تراجع', font: 'Noto Sans Arabic', glyphs: 'مُحرِّر المستندات', script: /600-6ff/i, direction: 'rtl'},
  hi: {label: 'हिन्दी', settings: 'सेटिंग्स', preferences: 'प्राथमिकताएँ…', preference: 'इंटरफ़ेस की भाषा', system: 'सिस्टम की भाषा अपनाएँ', editor: 'दस्तावेज़ संपादक', search: 'खोजें और बदलें', find: 'खोजें', replace: 'बदलें', closeFind: 'खोज पट्टी बंद करें', replaceAll: 'सभी बदलें', undo: 'पूर्ववत करें', font: 'Noto Sans Devanagari', glyphs: 'हिन्दी क्ष त्र ज्ञ', script: /900-97f/i},
  id: {label: 'Bahasa Indonesia', settings: 'Pengaturan', preferences: 'Preferensi…', preference: 'Bahasa antarmuka', system: 'Ikuti sistem', editor: 'Editor dokumen', search: 'Cari dan ganti', find: 'Cari', replace: 'Ganti', closeFind: 'Tutup bilah pencarian', replaceAll: 'Ganti semua', undo: 'Urungkan', font: 'Instrument Sans', glyphs: 'Berkas dan penyunting'},
}
const savedLines = ['local edit', '中🙂', 'copy this']

function stopApplication(force = false) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore', timeout: 7000})
    } else {
      process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM')
    }
  } catch (error) {
    if (error.code !== 'ESRCH') child.kill('SIGKILL')
  }
}

async function launch(systemLocale = 'zh-CN') {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const {port} = server.address()
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  const address = `http://127.0.0.1:${port}`
  console.log(`Launching ${packageForm} on ${process.platform}/${process.arch} with system locale ${systemLocale}`)
  let launchError
  // A forced shutdown can leave the NSIS extraction behind. Give each launch its own temporary directory.
  if (portable) portableTemp = await fs.mkdtemp(path.join(temp, 'portable-runtime-'))
  child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    '--disable-background-networking',
    '--proxy-server=http://127.0.0.1:9',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
    file,
  ], {
    env: {
      ...process.env,
      ...(portableTemp ? {TEMP: portableTemp, TMP: portableTemp} : {}),
      MARGIN_PROFILE: profile,
      MARGIN_TEST_LOCALE: systemLocale,
      HTTPS_PROXY: 'http://127.0.0.1:9',
      HTTP_PROXY: 'http://127.0.0.1:9',
      NO_PROXY: 'localhost,127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  })
  exited = once(child, 'exit').catch(() => {})
  child.on('error', error => { launchError = error })
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', data => { output = (output + data).slice(-10000) })
  const startupBudget = portable ? 50000 : 22000
  const deadline = Date.now() + startupBudget
  let ready = false
  while (Date.now() < deadline) {
    if (launchError) throw launchError
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Margin exited with ${child.exitCode ?? child.signalCode}`)
    try {
      ready = (await fetch(`${address}/json/version`, {signal: AbortSignal.timeout(350)})).ok
      if (ready) break
    }
    catch { /* The packaged app may still be starting. */ }
    await delay(180)
  }
  assert.ok(ready, `${packageForm} did not start within ${startupBudget / 1000}s with system locale ${systemLocale}`)
  browser = await chromium.connectOverCDP(address, {timeout: 7000})
  const context = browser.contexts()[0]
  await context.route(/^https?:/, route => route.abort())
  page = context.pages()[0] ?? await context.waitForEvent('page', {timeout: 7000})
  page.setDefaultTimeout(7000)
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.setViewportSize({width: 1024, height: 720})
}

async function shutdown() {
  // Electron may defer SIGTERM while its renderer saves a recovery snapshot.
  stopApplication()
  if (child?.pid) {
    const done = exited.then(() => true)
    if (!await Promise.race([done, delay(1500, false, {ref: false})])) {
      stopApplication(true)
      assert.ok(await Promise.race([done, delay(3000, false, {ref: false})]), 'Could not stop the packaged application')
    }
  }
  if (browser) await Promise.race([browser.close().catch(() => {}), delay(1000, undefined, {ref: false})])
  child = undefined
  browser = undefined
  page = undefined
  if (portableTemp) {
    assert.equal(path.dirname(portableTemp), temp)
    await fs.rm(portableTemp, {recursive: true, force: true, maxRetries: 8, retryDelay: 250})
    portableTemp = undefined
  }
}

async function openLanguageSettings(chinese) {
  await page.getByRole('button', {name: chinese ? '设置' : 'Settings', exact: true}).press('Enter')
  await page.getByRole('button', {name: chinese ? /^首选项…/ : /^Preferences…/}).press('Enter')
  const settings = page.getByRole('dialog', {name: chinese ? '设置' : 'Settings', exact: true})
  return settings.getByRole('combobox', {name: chinese ? '界面语言' : 'Interface language', exact: true})
}

function settingsLanguage(locale) {
  const labels = addedLocales[locale]
  const dialog = page.getByRole('dialog', {name: labels.settings, exact: true})
  return dialog.getByRole('combobox', {name: labels.preference, exact: true})
}

async function expectSavedLanguage(preference) {
  await expect.poll(async () => {
    try { return JSON.parse(await fs.readFile(path.join(profile, 'ui-language.json'), 'utf8')).preference }
    catch (error) { if (error.code === 'ENOENT') return null; throw error }
  }).toBe(preference)
}

async function expectCleanRecoverySnapshot() {
  // The restart harness terminates the process, so wait until recovery no longer contains the prior draft.
  await expect.poll(async () => {
    try {
      const session = JSON.parse(await fs.readFile(path.join(profile, 'session.json'), 'utf8'))
      const saved = session.docs.find(doc => doc.name === 'offline.txt')
      return {text: saved?.text, dirty: saved?.dirty, rtl: session.settings?.rtl ?? false}
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
      throw error
    }
  }).toEqual({text: savedLines.join('\n'), dirty: false, rtl: false})
}

const watchdog = setTimeout(() => {
  stopApplication(true)
  console.error(`Packaged application validation timed out.\n${output}`)
  process.exit(1)
}, portable ? 420000 : 220000)

try {
  await launch()
  const html = page.locator('html')
  const chineseEditor = page.getByRole('textbox', {name: '文档编辑器'})
  const chineseFile = page.getByRole('button', {name: '文件', exact: true})
  const englishFile = page.getByRole('button', {name: 'File', exact: true})
  await expect(html).toHaveAttribute('lang', 'zh-CN')
  await expect(chineseFile).toBeVisible()
  await expect(chineseEditor).toHaveText('original')
  await chineseEditor.focus()
  await page.keyboard.press('Home')
  await page.keyboard.insertText('未保存的草稿 ')
  const chinesePreference = await openLanguageSettings(true)
  await expect(chinesePreference).toHaveValue('system')
  await expect(chinesePreference.locator('option[value="system"]')).toHaveText('跟随系统')
  await expect(chinesePreference.locator('option[value="en"]')).toHaveText('English')
  await expect(chinesePreference.locator('option[value="zh-CN"]')).toHaveText('简体中文')
  for (const [locale, labels] of Object.entries(addedLocales)) {
    await expect(chinesePreference.locator(`option[value="${locale}"]`)).toHaveText(labels.label)
  }
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({path: path.join(evidence, `${packageForm}-language.png`), animations: 'disabled'})
  await page.setViewportSize({width: 650, height: 540})
  const settingsDialog = page.getByRole('dialog', {name: '设置', exact: true})
  assert.equal(await settingsDialog.evaluate(element => element.scrollWidth - element.clientWidth), 0, 'Chinese settings fit a narrow window')
  await page.setViewportSize({width: 1024, height: 720})

  await chinesePreference.focus()
  await chinesePreference.selectOption('en')
  const englishPreference = page.getByRole('combobox', {name: 'Interface language', exact: true})
  await expect(html).toHaveAttribute('lang', 'en')
  await expect(englishPreference).toHaveValue('en')
  await expect(englishPreference).toBeFocused()
  await englishPreference.selectOption('zh-CN')
  await expect(html).toHaveAttribute('lang', 'zh-CN')
  await expect(chinesePreference).toHaveValue('zh-CN')
  await expect(chinesePreference).toBeFocused()
  await chinesePreference.selectOption('system')
  await expect(html).toHaveAttribute('lang', 'zh-CN')
  await expect(chinesePreference).toHaveValue('system')
  await page.keyboard.press('Escape')
  await expect(chineseEditor).toHaveText('未保存的草稿 original')
  const chineseToolbar = page.getByRole('toolbar', {name: '编辑工具栏'})
  await chineseToolbar.getByRole('button', {name: '撤销', exact: true}).click()
  await expect(chineseEditor).toHaveText('original')
  await chineseToolbar.getByRole('button', {name: '替换', exact: true}).click()
  const chineseFind = page.getByRole('region', {name: '查找与替换'})
  await chineseFind.getByRole('textbox', {name: '查找', exact: true}).fill('original')
  await expect(chineseFind.getByRole('status')).toHaveText('第 1 项，共 1 项')
  await page.screenshot({path: path.join(evidence, `${packageForm}-chinese.png`), animations: 'disabled'})
  await chineseFind.getByRole('button', {name: '关闭查找栏'}).click()
  await chineseEditor.focus()
  await page.keyboard.press('Home')
  await page.keyboard.insertText('草稿 ')
  await openLanguageSettings(true)
  for (const [locale, labels] of Object.entries(addedLocales)) {
    await page.locator('dialog select').first().selectOption(locale)
    await expect(html).toHaveAttribute('lang', locale)
    await expect(html).toHaveAttribute('dir', labels.direction ?? 'ltr')
    await expect(settingsLanguage(locale)).toHaveValue(locale)
    await expect(settingsLanguage(locale)).toBeFocused()
    await expect(settingsLanguage(locale).locator('option[value="system"]')).toHaveText(labels.system)
    await expectSavedLanguage(locale)
    const faceLoaded = await page.evaluate(async ({font, glyphs}) => {
      const faces = await document.fonts.load(`14px "${font}"`, glyphs)
      return faces.length === 1 && faces[0].status === 'loaded'
    }, {font: labels.font, glyphs: labels.glyphs})
    assert.ok(faceLoaded, `Offline font loads for ${locale}`)
    if (locale === 'ru') {
      const cyrillicFacesLoaded = await page.evaluate(async glyphs => {
        const [semibold, monospace] = await Promise.all([
          document.fonts.load('600 14px "Noto Sans"', glyphs),
          document.fonts.load('15px "IBM Plex Mono"', glyphs),
        ])
        const loadedCyrillic = faces => faces.some(face => face.status === 'loaded' && /400-45f/i.test(face.unicodeRange))
        return loadedCyrillic(semibold) && loadedCyrillic(monospace)
      }, labels.glyphs)
      assert.ok(cyrillicFacesLoaded, 'Bundled Cyrillic interface and editor fonts load offline')
    }
    if (labels.script) {
      const faces = await page.evaluate(async ({font, glyphs}) => {
        const weights = await Promise.all([400, 600].map(weight => document.fonts.load(`${weight} 14px "${font}"`, glyphs)))
        return weights.flat().map(face => ({status: face.status, weight: face.weight, range: face.unicodeRange}))
      }, {font: labels.font, glyphs: labels.glyphs})
      for (const weight of ['400', '600']) {
        assert.ok(faces.some(face => face.status === 'loaded' && face.weight === weight && labels.script.test(face.range)),
          `Bundled ${labels.font} weight ${weight} loads offline`)
      }
      await expect(page.locator('.cm-editor')).toHaveCSS('font-family', new RegExp(labels.font))
    }
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({path: path.join(evidence, `${packageForm}-${locale}.png`), animations: 'disabled'})
    await page.setViewportSize({width: 650, height: 540})
    const dialog = page.getByRole('dialog')
    const overflow = await dialog.evaluate(element => element.scrollWidth - element.clientWidth)
    assert.equal(overflow, 0, `Settings fits a narrow window in ${locale}`)
    const checkboxWidths = await dialog.getByRole('checkbox').evaluateAll(boxes => boxes.map(box => box.getBoundingClientRect().width))
    assert.ok(checkboxWidths.length > 0 && checkboxWidths.every(width => width >= 12), `Settings checkboxes have room in ${locale}`)
    await page.setViewportSize({width: 1024, height: 720})
  }
  await settingsLanguage('id').selectOption('en')
  await expect(englishPreference).toHaveValue('en')
  await page.keyboard.press('Escape')
  await expect(englishFile).toBeVisible()

  const menu = page.getByRole('navigation', {name: 'Application menus'})
  const toolbar = page.getByRole('toolbar', {name: 'Editor toolbar'})
  const editor = page.getByRole('textbox', {name: 'Document editor'})
  const tab = page.getByRole('tab', {name: 'offline.txt', exact: true})
  const status = page.getByLabel('Document status')
  await expect(editor).toHaveText('草稿 original')
  await toolbar.getByRole('button', {name: 'Undo', exact: true}).click()
  await expect(editor).toHaveText('original')
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', {name: 'CRLF', exact: true})).toBeVisible()
  await expect(page.getByRole('button', {name: 'UTF-8', exact: true})).toBeVisible()
  await expect(page.getByRole('complementary', {name: 'Explorer'})).toHaveCount(0)
  await expect(editor).toBeVisible()
  const boxes = await Promise.all([menu, toolbar, tab, editor, status].map(element => element.boundingBox()))
  assert.ok(boxes.every(Boolean), 'Menus, tools, tabs, document and status bar are visible')
  for (let index = 1; index < boxes.length; index++) {
    assert.ok(boxes[index - 1].y < boxes[index].y, 'Menus, tools, tabs, document and status bar appear in document order')
  }
  await page.screenshot({path: path.join(evidence, `${packageForm}-editor.png`), animations: 'disabled'})
  await page.setViewportSize({width: 650, height: 540})
  await expect(toolbar.getByRole('button', {name: 'Replace', exact: true})).toBeVisible()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'No horizontal window overflow')
  await verifyAboutVersion()
  await menu.getByRole('button', {name: 'View', exact: true}).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', {name: 'Toggle explorer'})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu.getByRole('button', {name: 'View', exact: true})).toBeFocused()
  await page.setViewportSize({width: 1024, height: 720})

  await editor.click()
  await menu.getByRole('button', {name: 'Edit', exact: true}).click()
  await page.getByRole('button', {name: /^Select all/}).click()
  await editor.focus()
  await page.keyboard.insertText('offline edit\n中🙂\ncopy\u200b this  ')
  const hanFaceLoaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('15px "Margin Han"', '中文')
    return faces.length === 1 && faces[0].status === 'loaded'
  })
  assert.ok(hanFaceLoaded, 'Bundled Han font loads from the installed application')
  await toolbar.getByRole('button', {name: 'Save', exact: true}).click()
  await expect(page.getByText('Saved offline.txt', {exact: true})).toBeVisible()
  assert.equal(await fs.readFile(file, 'utf8'), 'offline edit\r\n中🙂\r\ncopy\u200b this  ')
  await toolbar.getByRole('button', {name: 'Replace', exact: true}).click()
  const findInput = page.getByRole('textbox', {name: 'Find', exact: true})
  const replaceInput = page.getByRole('textbox', {name: 'Replace', exact: true})
  await expect(findInput).toBeFocused()
  await findInput.fill('offline')
  await replaceInput.fill('local')
  await expect(findInput).toHaveValue('offline')
  await expect(replaceInput).toHaveValue('local')
  await expect(page.getByText('1 of 1')).toBeVisible()
  await page.screenshot({path: path.join(evidence, `${packageForm}-replace.png`), animations: 'disabled'})
  await page.getByRole('button', {name: 'Replace All'}).click()
  await page.getByRole('button', {name: 'Close find'}).click()
  const lines = page.locator('.cm-line')
  await expect(lines.nth(0)).toHaveText('local edit')
  await expect(lines.nth(1)).toHaveText('中🙂')
  await status.getByRole('button', {name: 'Inspect & clean text', exact: true}).click()
  const inspector = page.getByRole('dialog', {name: 'Inspect & clean text'})
  await expect(inspector.getByText('U+200B', {exact: true})).toBeVisible()
  await expect(inspector.getByRole('button', {name: 'Apply cleanup'})).toBeDisabled()
  await inspector.getByRole('checkbox', {name: 'Trim trailing spaces and tabs'}).check()
  await inspector.getByRole('checkbox', {name: 'Remove zero-width spaces (U+200B)'}).check()
  await expect(inspector.getByRole('status')).toHaveText('1 changed line')
  await page.screenshot({path: path.join(evidence, `${packageForm}-inspect.png`), animations: 'disabled'})
  await inspector.getByRole('button', {name: 'Apply cleanup'}).click()
  await expect(lines).toHaveText(['local edit', '中🙂', 'copy this'])
  await toolbar.getByRole('button', {name: 'Undo', exact: true}).click()
  await status.getByRole('button', {name: 'Inspect & clean text', exact: true}).click()
  await expect(inspector.getByText('U+200B', {exact: true})).toBeVisible()
  await inspector.getByRole('button', {name: 'Cancel', exact: true}).click()
  await toolbar.getByRole('button', {name: 'Redo', exact: true}).click()
  await expect(lines).toHaveText(['local edit', '中🙂', 'copy this'])
  await toolbar.getByRole('button', {name: 'Save', exact: true}).click()
  await expect(page.getByText('Saved offline.txt', {exact: true})).toBeVisible()
  assert.equal(await fs.readFile(file, 'utf8'), 'local edit\r\n中🙂\r\ncopy this')

  const keywordContrast = await verifySyntaxHighlighting(toolbar, editor, status)
  await tab.press('Enter')
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expectCleanRecoverySnapshot()

  await (await openLanguageSettings(false)).selectOption('zh-TW')
  await expectSavedLanguage('zh-TW')
  await page.keyboard.press('Escape')
  await shutdown()
  await launch('ja-JP')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW')
  await expect(page.locator('.cm-line')).toHaveText(['local edit', '中🙂', 'copy this'])
  await verifyLocalizedFind('zh-TW')
  const traditional = await openAddedSettings('zh-TW', '偏好設定…')
  await expect(traditional).toHaveValue('zh-TW')
  await traditional.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(settingsLanguage('ja')).toHaveValue('system')
  await expectSavedLanguage('system')
  await page.keyboard.press('Escape')
  await verifyLocalizedFind('ja')
  await shutdown()
  await launch('ko-KR')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await verifyLocalizedFind('ko')
  const korean = await openAddedSettings('ko', '환경 설정…')
  await expect(korean).toHaveValue('system')
  await korean.selectOption('ja')
  await expectSavedLanguage('ja')
  await shutdown()
  await launch('nl-NL')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  const japanese = await openAddedSettings('ja', '環境設定…')
  await expect(japanese).toHaveValue('ja')
  await japanese.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('combobox', {name: 'Interface language', exact: true})).toHaveValue('system')
  await expectSavedLanguage('system')
  await shutdown()
  await launch('zh-Hant-HK')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW')
  await expect(page.getByRole('textbox', {name: addedLocales['zh-TW'].editor, exact: true})).toBeVisible()
  await shutdown()
  await launch('fr-CA')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await verifyNarrowLocalizedFind('fr')
  const french = await openAddedSettings('fr', 'Préférences…')
  await expect(french).toHaveValue('system')
  await french.selectOption('de')
  await expectSavedLanguage('de')
  await shutdown()
  await launch('es-MX')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('.cm-line')).toHaveText(['local edit', '中🙂', 'copy this'])
  await verifyNarrowLocalizedFind('de')
  const german = await openAddedSettings('de', 'Einstellungen…')
  await expect(german).toHaveValue('de')
  await german.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(settingsLanguage('es')).toHaveValue('system')
  await expectSavedLanguage('system')
  await page.keyboard.press('Escape')
  await verifyNarrowLocalizedFind('es')
  await shutdown()
  await launch('de-CH')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('textbox', {name: addedLocales.de.editor, exact: true})).toBeVisible()
  await (await openAddedSettings('de', 'Einstellungen…')).selectOption('ru')
  await expectSavedLanguage('ru')
  await shutdown()
  await launch('it-IT')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.locator('.cm-line')).toHaveText(['local edit', '中🙂', 'copy this'])
  await verifyNarrowLocalizedFind('ru', 'Привет, мир! Ёж № 1')
  await expect(page.locator('.toast')).toContainText('Заменено совпадений: 1.')
  const russian = await openAddedSettings('ru', 'Параметры…')
  await expect(russian).toHaveValue('ru')
  await russian.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')
  await expect(page.locator('.toast')).toHaveCount(0)
  await expect(settingsLanguage('it')).toHaveValue('system')
  await expectSavedLanguage('system')
  await page.keyboard.press('Escape')
  await verifyNarrowLocalizedFind('it', 'Perché è già qui')
  await shutdown()
  await launch('pt-PT')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt')
  await verifyNarrowLocalizedFind('pt', 'Edição e ação')
  await shutdown()
  await launch('pt-BR')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt')
  await expect(page.getByRole('textbox', {name: addedLocales.pt.editor, exact: true})).toBeVisible()
  await shutdown()
  await launch('ru-RU')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.getByRole('textbox', {name: addedLocales.ru.editor, exact: true})).toBeVisible()
  await shutdown()
  await launch('ar-EG')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await verifyRtlMenu()
  const mixedArabic = 'مرحبا Margin 42'
  await verifyNarrowLocalizedFind('ar', mixedArabic, () => verifyRtlSettings(mixedArabic))
  const arabic = await openAddedSettings('ar')
  await expect(arabic).toHaveValue('ar')
  await expectSavedLanguage('ar')
  await shutdown()
  await launch('hi-IN')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const persistedArabic = await openAddedSettings('ar')
  await expect(persistedArabic).toHaveValue('ar')
  await persistedArabic.selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(settingsLanguage('hi')).toHaveValue('system')
  await expect(settingsLanguage('hi')).toBeFocused()
  await expectSavedLanguage('system')
  await page.keyboard.press('Escape')
  await verifyNarrowLocalizedFind('hi', 'हिन्दी पाठ Margin 42')
  await shutdown()
  await launch('id-ID')
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  const indonesian = await openAddedSettings('id')
  await expect(indonesian).toHaveValue('system')
  await page.keyboard.press('Escape')
  await verifyNarrowLocalizedFind('id', 'Teks baru Margin 42')
  assert.deepEqual(pageErrors, [])
  await fs.writeFile(path.join(evidence, `${packageForm}.json`), JSON.stringify({
    platform: process.platform,
    arch: process.arch,
    packageForm,
    version,
    interfaceLocales: ['en', 'zh-CN', ...Object.keys(addedLocales)],
    keywordContrast,
    offline: 'Chromium used a loopback-only proxy and renderer HTTP(S) requests were blocked',
    passed: ['desktop layout', 'narrow window', 'installed version display', 'keyboard menu focus', 'CLI open', 'Unicode edit', 'bundled Han font', 'bundled Cyrillic fonts', 'bundled Arabic and Devanagari fonts', 'CRLF save', 'find and replace', 'localized replacement and undo', 'inspect and clean', 'undo and redo', 'disk byte verification', 'interface language and persistence', 'rtl interface and document direction', 'automatic syntax detection', 'syntax keyword contrast', 'scope keyword matching'],
  }, null, 2) + '\n')
  console.log(`${packageForm}: layout, version display, keyboard, CLI open, Unicode edit, save, CRLF bytes, replace, cleanup, undo, interface language persistence, RTL and syntax passed`)
} catch (error) {
  await page?.screenshot({path: path.join(evidence, `${packageForm}-failed.png`)}).catch(() => {})
  console.error(output)
  throw error
} finally {
  await shutdown()
  await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  clearTimeout(watchdog)
}

async function openAddedSettings(locale, preferences = addedLocales[locale].preferences) {
  await page.getByRole('navigation').getByRole('button', {name: addedLocales[locale].settings, exact: true}).click()
  await page.getByRole('button', {name: new RegExp(`^${preferences}`)}).click()
  return settingsLanguage(locale)
}

async function verifyLocalizedFind(locale, beforeClose) {
  const labels = addedLocales[locale]
  await expect(page.getByRole('textbox', {name: labels.editor, exact: true})).toBeVisible()
  await page.getByRole('toolbar').getByRole('button', {name: labels.replace, exact: true}).click()
  const region = page.getByRole('region', {name: labels.search, exact: true})
  const find = region.getByRole('textbox', {name: labels.find, exact: true})
  await expect(find).toBeFocused()
  await find.fill('copy this')
  await expect(page.locator('.search-hit')).toHaveText('copy this')
  await beforeClose?.(region)
  await region.getByRole('button', {name: labels.closeFind, exact: true}).click()
}

async function assertHorizontalOrder(first, second, description) {
  const [left, right] = await Promise.all([first.boundingBox(), second.boundingBox()])
  assert.ok(left && right && left.x + left.width <= right.x + 1, description)
}

async function verifyTitleVersion() {
  const button = page.locator('.title-bar .title-version')
  const token = button.locator('bdi')
  await expect(button).toHaveRole('button')
  await expect(button).toBeVisible()
  await expect(button).toHaveText(`v${version}`)
  await expect(token).toHaveCSS('direction', 'ltr')
  await expect(token).toBeInViewport({ratio: 1})
  return button
}

async function verifyAboutVersion() {
  const button = await verifyTitleVersion()
  await expect(button).toHaveAccessibleName(`About Margin v${version}`)
  await button.click()
  const about = page.getByRole('dialog', {name: 'About Margin', exact: true})
  await expect(about.getByText(`Version ${version} · MIT`, {exact: true})).toBeVisible()
  await expect(about.getByRole('button', {name: 'Check for updates', exact: true})).toBeEnabled()
  await expect(about.getByRole('button', {name: 'View latest release', exact: true})).toBeEnabled()
  await expect(about.getByRole('button', {name: 'Star on GitHub', exact: true})).toBeEnabled()
  await page.screenshot({path: path.join(evidence, `${packageForm}-version.png`), animations: 'disabled'})
  await page.keyboard.press('Escape')
  await expect(about).toBeHidden()
}

async function verifySyntaxHighlighting(toolbar, editor, status) {
  const samples = [
    {mode: 'Verilog', keyword: 'module', identifier: 'gates', source: 'module gates(input lhs, input rhs, output result);\n  assign result = lhs & rhs;\nendmodule'},
    {mode: 'Python', keyword: 'def', identifier: 'value', source: 'def doubled(value):\n    return value * 2'},
  ]
  const syntax = status.getByTitle('Select language', {exact: true})
  const canvas = page.locator('.editor-surface')
  const syntaxTokens = canvas.locator('.cm-line span:not(.cm-matchingScopeKeyword, .cm-nonmatchingScopeKeyword)')
  const appearance = page.getByRole('dialog', {name: 'Settings', exact: true}).getByRole('combobox', {name: 'Appearance', exact: true})
  const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a'
  const selectSyntax = async name => {
    await syntax.press('Enter')
    await page.getByRole('dialog').getByRole('button', {name, exact: true}).press('Enter')
  }
  await toolbar.getByRole('button', {name: 'New document', exact: true}).press('Enter')
  await expect(page.getByRole('tab', {selected: true})).toHaveText(/^Untitled \d+$/)
  await expect(syntax).toHaveText('Plain Text')
  await editor.focus()
  const prose = 'The module is ready. Please review the notes.'
  await page.keyboard.insertText(prose)
  await expect(canvas.locator('.cm-line')).toHaveText(prose)
  await expect(syntax).toHaveText('Plain Text')

  await openLanguageSettings(false)
  const originalTheme = await appearance.inputValue()
  await page.keyboard.press('Escape')
  const contrasts = {}
  for (const sample of samples) {
    const name = sample.mode.toLowerCase()
    const keyword = syntaxTokens.filter({hasText: new RegExp(`^${sample.keyword}$`)})
    await editor.focus()
    await page.keyboard.press(selectAll)
    await page.keyboard.insertText(sample.source)
    await expect(syntax).toHaveText(sample.mode)
    await expect(keyword).toBeVisible()

    contrasts[name] = {}
    for (const theme of ['light', 'dark']) {
      await openLanguageSettings(false)
      await appearance.selectOption(theme)
      await page.keyboard.press('Escape')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const style = await keyword.evaluate((element, identifier) => {
        const rgb = color => color.match(/[\d.]+/g).map(Number)
        const weights = [0.2126, 0.7152, 0.0722]
        const luminance = color => rgb(color).slice(0, 3).reduce((sum, value, index) => {
          const channel = value / 255
          const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
          return sum + linear * weights[index]
        }, 0)
        const line = element.closest('.cm-line')
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
        const word = new RegExp(`\\b${identifier}\\b`)
        let identifierNode = walker.nextNode()
        while (identifierNode && !word.test(identifierNode.textContent)) identifierNode = walker.nextNode()
        if (!identifierNode) throw new Error(`Cannot find sample identifier ${identifier}`)
        const keywordStyle = getComputedStyle(element)
        const identifierStyle = getComputedStyle(identifierNode.parentElement)
        const lineBackground = getComputedStyle(line).backgroundColor
        const background = rgb(lineBackground)[3] === 0
          ? getComputedStyle(element.closest('.editor-surface')).backgroundColor
          : lineBackground
        const [red, green, blue] = rgb(keywordStyle.color)
        const [lighter, darker] = [luminance(keywordStyle.color), luminance(background)].sort((a, b) => b - a)
        return {
          blue: blue > green && green > red,
          distinct: keywordStyle.color !== identifierStyle.color,
          heavier: Number(keywordStyle.fontWeight) > Number(identifierStyle.fontWeight),
          contrast: (lighter + 0.05) / (darker + 0.05),
        }
      }, sample.identifier)
      assert.ok(style.blue && style.distinct && style.heavier, `${sample.mode} keywords stand out in the ${theme} theme`)
      assert.ok(style.contrast >= 4.5, `${sample.mode} keyword contrast is at least 4.5:1 in the ${theme} theme`)
      contrasts[name][theme] = Number(style.contrast.toFixed(2))
      await canvas.screenshot({path: path.join(evidence, `${packageForm}-${name}-${theme}.png`), animations: 'disabled'})
    }
  }

  await selectSyntax('Plain Text')
  await editor.focus()
  await page.keyboard.press('End')
  await page.keyboard.insertText('\n# Manual mode')
  await expect(canvas.locator('.cm-line').last()).toHaveText('# Manual mode')
  await expect(syntax).toHaveText('Plain Text')
  const pythonKeyword = syntaxTokens.filter({hasText: /^def$/})
  await expect(pythonKeyword).toHaveCount(0)
  await selectSyntax('Automatic')
  await expect(syntax).toHaveText('Python')
  await expect(pythonKeyword).toBeVisible()

  await verifyScopeKeywordMatching(editor, canvas, syntax, selectAll)

  await openLanguageSettings(false)
  await appearance.selectOption(originalTheme)
  await page.keyboard.press('Escape')
  await editor.focus()
  await page.keyboard.press(selectAll)
  await page.keyboard.press('Backspace')
  await expect(page.locator('.tab.selected .dirty-mark')).toHaveCount(0)
  await page.locator('.tab.selected').getByRole('button', {name: /^Close Untitled \d+$/}).press('Enter')
  return contrasts
}

async function verifyScopeKeywordMatching(editor, canvas, syntax, selectAll) {
  const matched = '.cm-matchingScopeKeyword'
  const unmatched = '.cm-nonmatchingScopeKeyword'
  const lines = canvas.locator('.cm-line')
  const replaceText = async text => {
    await editor.focus()
    await page.keyboard.press(selectAll)
    await page.keyboard.insertText(text)
  }
  const goTo = async (line, column) => {
    await page.getByTitle('Go to line', {exact: true}).press('Enter')
    const dialog = page.getByRole('dialog', {name: 'Go to line', exact: true})
    await dialog.getByLabel('Line', {exact: true}).fill(String(line))
    await dialog.getByLabel('Column', {exact: true}).fill(String(column))
    await dialog.getByRole('button', {name: 'Apply', exact: true}).press('Enter')
    await expect(editor).toBeFocused()
  }
  const verilog = [
    'module demo;',
    '  initial begin',
    '    $display("end begin");',
    '    // begin end',
    '    if (ready) begin',
    '      payload = 1;',
    '    end',
    '  end',
    'endmodule',
  ]
  await replaceText(verilog.join('\n'))
  await expect(syntax).toHaveText('Verilog')
  await goTo(7, verilog[6].indexOf('end') + 2)
  await expect(lines.nth(4).locator(matched)).toHaveText('begin')
  await expect(lines.nth(6).locator(matched)).toHaveText('end')
  await expect(canvas.locator(matched)).toHaveCount(2)
  await expect(lines.nth(4).locator(matched)).toHaveCSS('outline-style', 'solid')
  await canvas.screenshot({path: path.join(evidence, `${packageForm}-scope-match.png`), animations: 'disabled'})

  for (const [row, word] of [[2, 'end'], [3, 'begin']]) {
    await goTo(row + 1, verilog[row].indexOf(word) + 2)
    await expect(canvas.locator(matched)).toHaveCount(0)
    await expect(canvas.locator(unmatched)).toHaveCount(0)
  }
  await goTo(5, verilog[4].indexOf('(') + 2)
  const brackets = canvas.locator('.cm-matchingBracket')
  await expect(brackets).toHaveText(['(', ')'])
  await expect(brackets.first()).toHaveCSS('outline-style', 'solid')

  await goTo(8, 3)
  for (let offset = 0; offset < 'end'.length; offset++) await page.keyboard.press('Delete')
  await expect(lines.nth(7)).toHaveText('')
  await goTo(2, verilog[1].indexOf('begin') + 2)
  const missing = lines.nth(1).locator(unmatched)
  await expect(missing).toHaveText('begin')
  await expect(missing).toHaveCSS('outline-style', 'dashed')
  await canvas.screenshot({path: path.join(evidence, `${packageForm}-scope-missing.png`), animations: 'disabled'})

  await goTo(8, 3)
  await page.keyboard.insertText('end')
  await goTo(2, verilog[1].indexOf('begin') + 2)
  await expect(lines.nth(1).locator(matched)).toHaveText('begin')
  await expect(lines.nth(7).locator(matched)).toHaveText('end')
  await expect(canvas.locator(unmatched)).toHaveCount(0)

  await replaceText('#!/bin/sh\nif true; then\n  echo ready\nfi')
  await expect(syntax).toHaveText('Shell')
  await goTo(2, 2)
  await expect(canvas.locator(matched)).toHaveText(['if', 'fi'])
  await expect(canvas.locator(unmatched)).toHaveCount(0)
}

async function verifyRtlMenu() {
  await page.setViewportSize({width: 650, height: 540})
  await verifyTitleVersion()
  const menu = page.getByRole('navigation')
  const headers = menu.locator('.menu-group > button')
  const fileHeader = menu.getByRole('button', {name: 'ملف', exact: true})
  const helpHeader = menu.getByRole('button', {name: 'مساعدة', exact: true})
  await expect(menu).toHaveCSS('direction', 'rtl')
  await expect(headers.first()).toHaveText('ملف')
  await expect(headers.last()).toHaveText('مساعدة')
  const order = await headers.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().left))
  assert.ok(order.length > 2 && order.every((x, index) => index === 0 || x < order[index - 1]), 'Arabic menu headers run from right to left')
  await assertHorizontalOrder(helpHeader, fileHeader, 'Help appears to the left of File in Arabic')
  await fileHeader.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(headers.nth(1)).toBeFocused()
  await assertHorizontalOrder(headers.nth(1), fileHeader, 'ArrowLeft focuses the next header to the left')
  await page.keyboard.press('ArrowRight')
  await expect(fileHeader).toBeFocused()
  for (const header of [fileHeader, helpHeader]) {
    await header.press('Enter')
    const dropdown = menu.locator('.menu-items')
    await expect(dropdown).toBeVisible()
    const fits = await dropdown.evaluate(element => {
      const {left, right} = element.getBoundingClientRect()
      return left >= -1 && right <= innerWidth + 1
    })
    assert.ok(fits, `Arabic dropdown ${await header.textContent()} fits the 650px window`)
    await page.keyboard.press('Escape')
    await expect(header).toBeFocused()
  }
}

async function verifyRtlSettings(mixedText) {
  const html = page.locator('html')
  const editor = page.locator('.cm-editor')
  const lines = editor.locator('.cm-line')
  const expected = [...savedLines.slice(0, -1), mixedText]
  const arabic = await openAddedSettings('ar')
  const dialog = page.getByRole('dialog', {name: addedLocales.ar.settings, exact: true})
  await expect(arabic).toHaveValue('system')
  await expect(dialog).toHaveCSS('direction', 'rtl')
  await assertHorizontalOrder(dialog.locator('.dialog-head button'), dialog.getByRole('heading'),
    'The Settings heading is to the right of its close button in Arabic')
  const rtlText = dialog.getByRole('checkbox', {name: 'النص من اليمين إلى اليسار', exact: true})
  await expect(rtlText).not.toBeChecked()
  await expect(editor).toHaveAttribute('dir', 'ltr')
  await expect(editor.locator('.cm-content')).toHaveCSS('direction', 'ltr')
  await rtlText.check()
  await expect(html).toHaveAttribute('dir', 'rtl')
  await expect(editor).toHaveAttribute('dir', 'rtl')
  await expect(editor.locator('.cm-content')).toHaveCSS('direction', 'rtl')
  await expect(lines).toHaveText(expected)

  await arabic.focus()
  await arabic.selectOption('en')
  const englishDialog = page.getByRole('dialog', {name: 'Settings', exact: true})
  const english = englishDialog.getByRole('combobox', {name: 'Interface language', exact: true})
  await expect(html).toHaveAttribute('lang', 'en')
  await expect(html).toHaveAttribute('dir', 'ltr')
  await expect(english).toBeFocused()
  await expect(englishDialog).toHaveCSS('direction', 'ltr')
  await assertHorizontalOrder(englishDialog.getByRole('heading'), englishDialog.locator('.dialog-head button'),
    'The Settings heading returns to the left of its close button in English')
  await expect(editor.locator('.cm-content')).toHaveCSS('direction', 'rtl')
  await expect(lines).toHaveText(expected)
  await englishDialog.getByRole('checkbox', {name: 'Right-to-left text', exact: true}).uncheck()
  await expect(editor).toHaveAttribute('dir', 'ltr')
  await expect(editor.locator('.cm-content')).toHaveCSS('direction', 'ltr')

  await english.focus()
  await english.selectOption('ar')
  await expect(html).toHaveAttribute('dir', 'rtl')
  await expect(arabic).toBeFocused()
  await expect(rtlText).not.toBeChecked()
  await expect(editor).toHaveAttribute('dir', 'ltr')
  await expect(lines).toHaveText(expected)
  await page.keyboard.press('Escape')
}

async function verifyNarrowLocalizedFind(locale, replacement, afterReplace) {
  const labels = addedLocales[locale]
  await page.evaluate(() => document.fonts.ready)
  await page.setViewportSize({width: 650, height: 540})
  await verifyLocalizedFind(locale, async region => {
    const menu = page.getByRole('navigation')
    for (const width of [1024, 901, 760, 650]) {
      await page.setViewportSize({width, height: 540})
      for (const [element, label] of [[menu, 'menu'], [region, 'find bar']]) {
        const overflow = await element.evaluate(node => {
          const rect = node.getBoundingClientRect()
          const left = Math.max(rect.left, 0)
          const right = Math.min(rect.right, innerWidth)
          const children = [...node.children].map(child => child.getBoundingClientRect())
          return Math.max(node.scrollWidth - node.clientWidth, ...children.flatMap(child => [left - child.left, child.right - right]))
        })
        assert.ok(overflow <= 1, `The ${label} fits a ${width}px window in ${locale} (${overflow}px overflow)`)
      }
    }
    const find = region.getByRole('textbox', {name: labels.find, exact: true})
    if (labels.direction === 'rtl') {
      await expect(region).toHaveCSS('direction', 'rtl')
      await expect(region.locator('.toggle-group button')).toHaveCSS('direction', 'ltr')
      await assertHorizontalOrder(find, region.locator('label[for="find-value"]'), 'The Find label is to the right of its input in Arabic')
      await expect(find).toHaveCSS('direction', 'ltr')
    }
    const replaceAll = replacement && region.getByRole('button', {name: labels.replaceAll, exact: true})
    if (replaceAll) {
      const input = region.getByRole('textbox', {name: labels.replace, exact: true})
      await input.fill(replacement)
      await expect(replaceAll).toBeEnabled()
      if (labels.direction === 'rtl') {
        await expect(input).toHaveCSS('direction', 'rtl')
        await replaceAll.click()
        await expect(page.locator('.cm-line').last()).toHaveText(replacement)
        await find.fill(replacement)
        await expect(find).toHaveCSS('direction', 'rtl')
        await expect(page.locator('.search-hit')).toHaveText(replacement)
      }
    }
    await page.screenshot({path: path.join(evidence, `${packageForm}-find-${locale}.png`), animations: 'disabled'})
    if (replaceAll && labels.direction !== 'rtl') await replaceAll.click()
  })
  if (replacement) {
    const lastLine = page.locator('.cm-line').last()
    await expect(lastLine).toHaveText(replacement)
    await afterReplace?.()
    await page.getByRole('toolbar').getByRole('button', {name: labels.undo, exact: true}).click()
    await expect(lastLine).toHaveText('copy this')
    await expectCleanRecoverySnapshot()
  }
  await page.setViewportSize({width: 1024, height: 720})
}
