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
assert.ok(executable && evidence && packageForm, 'Set MARGIN_EXECUTABLE, MARGIN_EVIDENCE, and MARGIN_PACKAGE_FORM')
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
const pageErrors = []
const addedLocales = {
  'zh-TW': {label: '繁體中文', settings: '設定', preference: '介面語言', system: '跟隨系統', editor: '文件編輯器', search: '尋找與取代', find: '尋找', replace: '取代', closeFind: '關閉尋找列', font: 'Margin Traditional', glyphs: '檔案與儲存'},
  ja: {label: '日本語', settings: '設定', preference: '表示言語', system: 'システム設定に従う', editor: '文書エディター', search: '検索と置換', find: '検索', replace: '置換', closeFind: '検索バーを閉じる', font: 'Margin Japanese', glyphs: '日本語を探す'},
  ko: {label: '한국어', settings: '설정', preference: '인터페이스 언어', system: '시스템 설정 따르기', editor: '문서 편집기', search: '찾기 및 바꾸기', find: '찾기', replace: '바꾸기', closeFind: '찾기 닫기', font: 'Margin Korean', glyphs: '한글 찾기'},
}

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
  console.log(`Launching ${packageForm} on ${process.platform}/${process.arch}`)
  let launchError
  child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    '--disable-background-networking',
    '--proxy-server=http://127.0.0.1:9',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
    file,
  ], {
    env: {
      ...process.env,
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
  for (let n = 0; n < 100; n++) {
    if (launchError) throw launchError
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Margin exited with ${child.exitCode ?? child.signalCode}`)
    try { if ((await fetch(`${address}/json/version`, {signal: AbortSignal.timeout(350)})).ok) break }
    catch { /* The packaged app may still be starting. */ }
    await new Promise(resolve => setTimeout(resolve, 180))
  }
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
}

async function openLanguageSettings(chinese) {
  await page.getByRole('button', {name: chinese ? '设置' : 'Settings', exact: true}).click()
  await page.getByRole('button', {name: chinese ? /^首选项…/ : /^Preferences…/}).click()
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

const watchdog = setTimeout(() => {
  stopApplication(true)
  console.error(`Packaged application validation timed out.\n${output}`)
  process.exit(1)
}, 220000)

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
    await expect(settingsLanguage(locale)).toHaveValue(locale)
    await expect(settingsLanguage(locale)).toBeFocused()
    await expect(settingsLanguage(locale).locator('option[value="system"]')).toHaveText(labels.system)
    await expectSavedLanguage(locale)
    const faceLoaded = await page.evaluate(async ({font, glyphs}) => {
      const faces = await document.fonts.load(`14px "${font}"`, glyphs)
      return faces.length === 1 && faces[0].status === 'loaded'
    }, {font: labels.font, glyphs: labels.glyphs})
    assert.ok(faceLoaded, `Offline font loads for ${locale}`)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({path: path.join(evidence, `${packageForm}-${locale}.png`), animations: 'disabled'})
    await page.setViewportSize({width: 650, height: 540})
    const overflow = await page.getByRole('dialog').evaluate(element => element.scrollWidth - element.clientWidth)
    assert.equal(overflow, 0, `Settings fits a narrow window in ${locale}`)
    await page.setViewportSize({width: 1024, height: 720})
  }
  await settingsLanguage('ko').selectOption('en')
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

  // The restart harness terminates the process. Wait for the last recovery
  // snapshot to reflect the completed save, so it cannot reopen an older draft.
  await expect.poll(async () => {
    try {
      const session = JSON.parse(await fs.readFile(path.join(profile, 'session.json'), 'utf8'))
      const saved = session.docs.find(doc => doc.name === 'offline.txt')
      return {text: saved?.text, dirty: saved?.dirty}
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
      throw error
    }
  }).toEqual({text: 'local edit\n中🙂\ncopy this', dirty: false})

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
  await launch('fr-CA')
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
  assert.deepEqual(pageErrors, [])
  await fs.writeFile(path.join(evidence, `${packageForm}.json`), JSON.stringify({
    platform: process.platform,
    arch: process.arch,
    packageForm,
    interfaceLocales: ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'],
    offline: 'Chromium used a loopback-only proxy and renderer HTTP(S) requests were blocked',
    passed: ['desktop layout', 'narrow window', 'keyboard menu focus', 'CLI open', 'Unicode edit', 'bundled Han font', 'CRLF save', 'find and replace', 'inspect and clean', 'undo and redo', 'disk byte verification', 'interface language and persistence'],
  }, null, 2) + '\n')
  console.log(`${packageForm}: layout, keyboard, CLI open, Unicode edit, save, CRLF bytes, replace, cleanup, undo and interface language persistence passed`)
} catch (error) {
  await page?.screenshot({path: path.join(evidence, `${packageForm}-failed.png`)}).catch(() => {})
  console.error(output)
  throw error
} finally {
  await shutdown()
  await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  clearTimeout(watchdog)
}

async function openAddedSettings(locale, preferences) {
  await page.getByRole('navigation').getByRole('button', {name: addedLocales[locale].settings, exact: true}).click()
  await page.getByRole('button', {name: new RegExp(`^${preferences}`)}).click()
  return settingsLanguage(locale)
}

async function verifyLocalizedFind(locale) {
  const labels = addedLocales[locale]
  await expect(page.getByRole('textbox', {name: labels.editor, exact: true})).toBeVisible()
  await page.getByRole('toolbar').getByRole('button', {name: labels.replace, exact: true}).click()
  const region = page.getByRole('region', {name: labels.search, exact: true})
  const find = region.getByRole('textbox', {name: labels.find, exact: true})
  await expect(find).toBeFocused()
  await find.fill('copy this')
  await expect(page.locator('.search-hit')).toHaveText('copy this')
  await region.getByRole('button', {name: labels.closeFind, exact: true}).click()
}
