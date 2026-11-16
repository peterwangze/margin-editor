import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {execFile} from 'node:child_process'
import {createHash} from 'node:crypto'
import {promisify} from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {_electron as electron, expect} from '@playwright/test'
import {encode} from '../desktop/codec.mjs'
import {EDIT_LIMIT, PAGE_SIZE} from '../desktop/files.mjs'
import {interfaceDirection, interfaceLocale} from '../shared/locale.mjs'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const executablePath = process.env.MARGIN_EXECUTABLE || undefined

async function launch(profile, files = [], testLocale = 'en-US') {
  const app = await electron.launch({executablePath, args: [...(executablePath ? [] : ['.']), ...files], env: {...process.env, MARGIN_PROFILE: profile, MARGIN_TEST_LOCALE: testLocale}, timeout: 25000})
  try {
    const page = await app.firstWindow({timeout: 15000})
    await expect(page.locator('.cm-content')).toBeVisible({timeout: 12000})
    return {app, page}
  } catch (error) {
    app.process().kill()
    throw error
  }
}

test('L01 defaults to the native OS language and handles a profile from 1.0', {timeout: 40000}, async t => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-system-language-'))
  await fs.writeFile(path.join(profile, 'session.json'), JSON.stringify({version: 1, docs: [], settings: {recover: false, wrap: true}}))
  const {app, page} = await launch(profile, [], '')
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(profile, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  const native = await app.evaluate(({app}) => {
    const preferred = app.getPreferredSystemLanguages()
    return preferred.length ? preferred : [app.getLocale()]
  })
  const {preference, systemLanguages} = await page.evaluate(() => window.margin.interfaceLanguage())
  assert.equal(preference, 'system')
  assert.deepEqual(systemLanguages, native)
  const expected = interfaceLocale('system', native)
  await expect(page.locator('html')).toHaveAttribute('lang', expected)
  await expect(page.locator('html')).toHaveAttribute('dir', interfaceDirection(expected))
  const editorLabels = {
    en: 'Document editor', 'zh-CN': '文档编辑器', 'zh-TW': '文件編輯器', ja: '文書エディター', ko: '문서 편집기',
    fr: 'Éditeur de documents', de: 'Dokumenteditor', es: 'Editor de documentos',
    it: 'Editor di documenti', pt: 'Editor de documentos', ru: 'Редактор документов',
    ar: 'محرر المستندات', hi: 'दस्तावेज़ संपादक', id: 'Editor dokumen',
  }
  await expect(page.getByRole('textbox', {name: editorLabels[expected]})).toBeVisible()
  if (process.platform === 'darwin') {
    for (const [locale, edit, undo, quit] of [
      ['zh-CN', '编辑', '撤销', '退出 Margin'],
      ['zh-TW', '編輯', '復原', '結束 Margin'],
      ['ja', '編集', '取り消す', 'Margin を終了'],
      ['ko', '편집', '실행 취소', 'Margin 종료'],
      ['fr', 'Édition', 'Annuler', 'Quitter Margin'],
      ['de', 'Bearbeiten', 'Rückgängig', 'Margin beenden'],
      ['es', 'Edición', 'Deshacer', 'Salir de Margin'],
      ['it', 'Modifica', 'Annulla', 'Esci da Margin'],
      ['pt', 'Editar', 'Desfazer', 'Sair do Margin'],
      ['ru', 'Правка', 'Отменить', 'Завершить работу Margin'],
      ['ar', 'تحرير', 'تراجع', 'إنهاء Margin'],
      ['hi', 'संपादन', 'पूर्ववत करें', 'Margin बंद करें'],
      ['id', 'Edit', 'Urungkan', 'Keluar dari Margin'],
    ]) {
      await page.evaluate(value => window.margin.setInterfaceLanguage(value), locale)
      const nativeMenu = await app.evaluate(({Menu}) => Menu.getApplicationMenu().items.map(item => ({
        label: item.label,
        labels: item.submenu?.items.map(subitem => subitem.label) ?? [],
      })))
      assert.ok(nativeMenu.some(item => item.label === edit && item.labels.includes(undo)), locale)
      assert.ok(nativeMenu.some(item => item.labels.includes(quit)), locale)
    }
  }
})

test('G01 shows the installed version with a long filename and opens the About links', {timeout: 40000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-app-version-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  const file = path.join(temp, `${'working-notes-'.repeat(12)}.txt`)
  await fs.writeFile(file, 'version fixture')
  let app
  t.after(async () => {
    await app?.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  const opened = await launch(profile, [file])
  app = opened.app
  const {page} = opened
  const installed = await app.evaluate(({app, BrowserWindow, shell}) => {
    BrowserWindow.getAllWindows()[0].setSize(650, 540)
    shell.openExternal = async url => { globalThis.openedProjectUrl = url }
    return app.getVersion()
  })
  await page.setViewportSize({width: 650, height: 540})
  await expect(page.locator('.window-name')).toContainText(path.basename(file))
  const shortcut = page.getByRole('button', {name: `About Margin v${installed}`, exact: true})
  await expect(shortcut).toBeInViewport({ratio: 1})
  await expect(shortcut).toHaveText(`v${installed}`)
  await expect.poll(() => shortcut.evaluate(element => {
    const overlay = navigator.windowControlsOverlay
    const bounds = element.getBoundingClientRect()
    const area = overlay?.visible ? overlay.getTitlebarAreaRect() : {left: 0, right: innerWidth}
    return bounds.left >= Math.max(0, area.left) && bounds.right <= Math.min(innerWidth, area.right)
  })).toBe(true)
  await shortcut.click()
  const about = page.getByRole('dialog', {name: 'About Margin', exact: true})
  await expect(about.getByText(`Version ${installed} · MIT`, {exact: true})).toBeVisible()
  await about.getByRole('button', {name: 'View latest release', exact: true}).click()
  await expect.poll(() => app.evaluate(() => globalThis.openedProjectUrl))
    .toBe('https://github.com/peterwangze/margin-editor/releases/latest')
  await about.getByRole('button', {name: 'Star on GitHub', exact: true}).click()
  await expect.poll(() => app.evaluate(() => globalThis.openedProjectUrl))
    .toBe('https://github.com/peterwangze/margin-editor')
})

test('G07 checks the release, retries a failure and downloads the matching package', {timeout: 40000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-update-'))
  const profile = path.join(temp, 'profile')
  const downloads = path.join(temp, 'downloads')
  await fs.mkdir(profile)
  await fs.mkdir(downloads)
  let app
  t.after(async () => {
    await app?.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  const opened = await launch(profile)
  app = opened.app
  const {page} = opened
  const releaseApi = 'https://api.github.com/repos/peterwangze/margin-editor/releases/latest'
  const latest = '99.0.0'
  const notes = 'Find and replace now remembers the previous search.'
  const fixture = 'offline update fixture'
  const digest = 'sha256:' + createHash('sha256').update(fixture).digest('hex')
  const arch = process.arch
  const names = {
    win32: [`Margin-${latest}-win-${arch}-setup.exe`, `Margin-${latest}-win-${arch}-portable.exe`],
    darwin: [`Margin-${latest}-mac-${arch}.dmg`],
    linux: [`Margin-${latest}-linux-${arch === 'x64' ? 'x86_64' : 'arm64'}.AppImage`, `Margin-${latest}-linux-${arch === 'x64' ? 'amd64' : 'arm64'}.deb`],
  }[process.platform]
  const assets = names.map(name => ({
    name, state: 'uploaded', size: Buffer.byteLength(fixture), digest,
    browser_download_url: `https://github.com/peterwangze/margin-editor/releases/download/v${latest}/${name}`,
  }))
  const current = await app.evaluate(({app, shell}, data) => {
    app.setPath('downloads', data.downloads)
    globalThis.testUpdateMode = 'current'
    globalThis.testUpdateRequests = []
    const cdn = 'https://release-assets.githubusercontent.com/margin-test-fixture'
    globalThis.fetch = async requested => {
      const url = String(requested)
      globalThis.testUpdateRequests.push(url)
      if (globalThis.testUpdateMode === 'failure') throw new Error('Test network unavailable')
      if (url === data.releaseApi) {
        const release = {tag_name: `v${app.getVersion()}`, draft: false, prerelease: false, body: '', assets: []}
        if (globalThis.testUpdateMode === 'available') Object.assign(release, {tag_name: `v${data.latest}`, body: data.notes, assets: data.assets})
        return Response.json(release)
      }
      if (data.assets.some(asset => asset.browser_download_url === url)) return Response.redirect(cdn)
      if (url === cdn) return new Response(data.fixture)
      return new Response('', {status: 404})
    }
    shell.showItemInFolder = file => { globalThis.shownUpdate = file }
    return app.getVersion()
  }, {downloads, releaseApi, latest, notes, assets, fixture})

  const editor = page.getByRole('textbox', {name: 'Document editor', exact: true})
  await editor.focus()
  await page.keyboard.insertText('Keep this unsaved draft.')
  await page.getByRole('button', {name: `About Margin v${current}`, exact: true}).click()
  await page.getByRole('dialog').getByRole('button', {name: 'Check for updates', exact: true}).click()
  const updater = page.getByRole('dialog', {name: 'Check for updates', exact: true})
  await expect(updater.getByText('Margin is up to date.', {exact: true})).toBeVisible()
  await expect(updater.getByRole('button', {name: 'Download update'})).toHaveCount(0)
  await page.keyboard.press('Escape')

  await app.evaluate(() => { globalThis.testUpdateMode = 'failure' })
  await page.getByRole('button', {name: 'Help', exact: true}).click()
  await page.getByRole('button', {name: 'Check for updates', exact: true}).click()
  await expect(updater.getByText('Could not check for updates.', {exact: true})).toBeVisible()
  await app.evaluate(() => { globalThis.testUpdateMode = 'available' })
  await updater.getByRole('button', {name: 'Try again', exact: true}).click()
  await expect(updater.getByText('An update is available.', {exact: true})).toBeVisible()
  await expect(updater.getByText(notes, {exact: true})).toBeVisible()

  const selected = updater.getByText(new RegExp(`^(?:${names.map(name => name.replaceAll('.', '\\.')).join('|')})$`))
  await expect(selected).toBeVisible()
  const selectedName = await selected.innerText()
  assert.ok(names.includes(selectedName))
  assert.deepEqual(await app.evaluate(() => globalThis.testUpdateRequests), [releaseApi, releaseApi, releaseApi])
  await updater.getByRole('button', {name: 'Download update', exact: true}).click()
  const show = updater.getByRole('button', {name: 'Show in folder', exact: true})
  await expect(show).toBeEnabled()
  const downloaded = path.join(downloads, selectedName)
  assert.equal(await fs.readFile(downloaded, 'utf8'), fixture)
  await show.click()
  await expect.poll(() => app.evaluate(() => globalThis.shownUpdate)).toBe(downloaded)
  await page.keyboard.press('Escape')
  await expect(editor).toHaveText('Keep this unsaved draft.')
})

test('I01/I05/I07 open from CLI, edit, write encoded bytes, block external overwrite and recover after close', {timeout: 75000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-desktop-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  const file = path.join(temp, 'fixture.txt')
  await fs.writeFile(file, encode({text: 'start\n', encoding: 'UTF-16 LE', eol: 'CRLF'}))
  let app
  t.after(async () => {
    await app?.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  let page
  ;({app, page} = await launch(profile, [file]))
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const editor = page.getByRole('textbox', {name: 'Document editor'})
  await expect(page.getByRole('tab', {name: /^fixture\.txt/})).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', {name: 'UTF-16 LE', exact: true})).toBeVisible()
  await expect(page.getByRole('button', {name: 'CRLF', exact: true})).toBeVisible()
  await editor.click()
  await page.keyboard.press(`${mod}+a`)
  await page.keyboard.insertText('edited\n中🙂')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByText('Saved fixture.txt', {exact: true})).toBeVisible()
  assert.deepEqual(await fs.readFile(file), encode({text: 'edited\n中🙂', eol: 'CRLF', encoding: 'UTF-16 LE'}))
  await page.keyboard.press(`${mod}+h`)
  await page.getByRole('textbox', {name: 'Find', exact: true}).fill('中')
  await expect(page.getByText('1 of 1')).toBeVisible()
  await page.getByRole('button', {name: 'Close find'}).click()
  await fs.writeFile(file, encode({text: 'external change', eol: 'CRLF', encoding: 'UTF-16 LE'}))
  await expect(page.getByText('File changed on disk.', {exact: true})).toBeVisible({timeout: 9000})
  await editor.click()
  await page.keyboard.press(`${mod}+a`)
  await page.keyboard.insertText('keep these edits')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByText(/Reload it or save your edits under a new name/)).toBeVisible()
  assert.deepEqual(await fs.readFile(file), encode({text: 'external change', eol: 'CRLF', encoding: 'UTF-16 LE'}))
  await page.getByRole('button', {name: 'Compare', exact: true}).click()
  await expect(page.getByRole('complementary', {name: 'Text comparison'})).toContainText('external change')
  await expect(page.getByRole('complementary', {name: 'Text comparison'})).toContainText('keep these edits')
  assert.deepEqual(errors, [])
  await Promise.all([page.waitForEvent('close'), app.evaluate(({BrowserWindow}) => { setTimeout(() => BrowserWindow.getAllWindows()[0]?.close(), 20) })])
  await app.close()
  ;({app, page} = await launch(profile))
  await expect(page.locator('.cm-content')).toContainText('keep these edits')
  await expect(page.getByRole('tab', {name: /fixture.txt Unsaved/})).toBeVisible()
})

test('I03 choose folder, filter by depth, preview, select and replace on disk', {timeout: 55000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-workspace-'))
  const profile = path.join(temp, 'profile')
  const workspace = path.join(temp, 'workspace')
  const nested = path.join(workspace, 'nested')
  await fs.mkdir(profile)
  await fs.mkdir(nested, {recursive: true})
  await fs.writeFile(path.join(workspace, 'one.txt'), 'error 17\r\n')
  await fs.writeFile(path.join(nested, 'two.txt'), 'error 22\n')
  const {app, page} = await launch(profile, [workspace])
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await app.evaluate(({dialog}) => { dialog.showMessageBox = async () => ({response: 0}) })
  await page.getByRole('button', {name: 'Search', exact: true}).click()
  await page.getByRole('button', {name: /^Find in Files/}).click()
  await expect(page.getByRole('complementary', {name: 'Workspace search'})).toBeVisible()
  await expect(page.getByRole('button', {name: 'workspace', exact: true})).toBeVisible()
  await page.getByRole('textbox', {name: 'Find in files'}).fill('error (\\d+)')
  await page.getByRole('textbox', {name: 'Replace in files'}).fill('fixed $1')
  await page.getByRole('combobox', {name: 'Mode'}).selectOption('regex')
  await page.getByRole('spinbutton', {name: 'Depth'}).fill('0')
  await page.getByRole('button', {name: 'Preview Replace'}).click()
  await expect(page.getByText('1 matches in 1 files')).toBeVisible()
  await page.getByRole('spinbutton', {name: 'Depth'}).fill('2')
  await page.getByRole('button', {name: 'Preview Replace'}).click()
  await expect(page.getByText('2 matches in 2 files')).toBeVisible()
  await page.getByRole('checkbox', {name: 'Include nested/two.txt'}).uncheck()
  await page.getByRole('button', {name: 'Apply to 1 files'}).click()
  await expect(page.getByText('Updated 1 file.')).toBeVisible()
  assert.equal(await fs.readFile(path.join(workspace, 'one.txt'), 'utf8'), 'fixed 17\r\n')
  assert.equal(await fs.readFile(path.join(nested, 'two.txt'), 'utf8'), 'error 22\n')
})

test('I07 imports a Notepad++ session with two views, byte selections, bookmarks and an unsaved backup', {timeout: 45000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-import-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  await fs.writeFile(path.join(temp, 'work.txt'), 'é😀\r\nhello\r\n')
  await fs.writeFile(path.join(temp, 'backup.txt'), 'unsaved words\n')
  const session = path.join(temp, 'session.xml')
  await fs.writeFile(session, `<NotepadPlus><Session activeView="1"><mainView activeIndex="0"><File filename="work.txt" startPos="8" endPos="13" tabPinned="yes"><Mark line="1"/></File></mainView><subView activeIndex="0"><File filename="new 3" backupFilePath="backup.txt" startPos="0" endPos="7"/><File filename="absent.txt"/></subView></Session></NotepadPlus>`)
  const {app, page} = await launch(profile)
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await page.getByRole('button', {name: 'File', exact: true}).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', {name: 'Import Notepad++ session…'}).click()
  await (await chooser).setFiles(session)
  const primary = page.getByRole('region', {name: 'Primary editor'})
  const secondary = page.getByRole('region', {name: 'Secondary editor'})
  await expect(primary.getByRole('tab', {name: 'work.txt', exact: true})).toHaveAttribute('aria-selected', 'true')
  await expect(primary.locator('.bookmark-gutter-mark')).toHaveCount(1)
  await expect(secondary.getByRole('tab', {name: /new 3 \(recovered\)/})).toHaveAttribute('aria-selected', 'true')
  await expect(secondary.getByRole('textbox', {name: 'Document editor'})).toBeFocused()
  await expect(page.getByText(/Could not open:.*absent\.txt/s)).toBeVisible()
  await page.keyboard.insertText('changed')
  await expect(secondary.locator('.cm-line').first()).toHaveText('changed words')
  await primary.getByRole('tab', {name: 'work.txt', exact: true}).click()
  await page.keyboard.insertText('world')
  await expect(primary.locator('.cm-line').nth(1)).toHaveText('world')
  assert.equal(await fs.readFile(path.join(temp, 'work.txt'), 'utf8'), 'é😀\r\nhello\r\n')
  assert.equal(await fs.readFile(path.join(temp, 'backup.txt'), 'utf8'), 'unsaved words\n')
})

test('I07 opens a file through an imported Notepad++ project with virtual folders', {timeout: 45000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-project-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  await fs.mkdir(path.join(temp, 'actual'))
  await fs.writeFile(path.join(temp, 'actual', 'memo.txt'), 'document in a different folder')
  const workspace = path.join(temp, 'project.xml')
  await fs.writeFile(workspace, '<NotepadPlus><Project name="Team"><Folder name="Virtual"><File name="actual\\memo.txt"/></Folder></Project></NotepadPlus>')
  const {app, page} = await launch(profile)
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await page.getByRole('button', {name: 'View', exact: true}).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', {name: 'Open Notepad++ project…', exact: true}).click()
  await (await chooser).setFiles(workspace)
  const panel = page.getByRole('complementary', {name: 'Project panel'})
  await expect(panel.getByText('Virtual', {exact: true})).toBeVisible()
  await panel.getByRole('button', {name: 'memo.txt', exact: true}).click()
  await expect(page.getByRole('tab', {name: 'memo.txt', exact: true})).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.cm-line').first()).toHaveText('document in a different folder')
})

test('I04 opens a large-file search result on another page and saves edits to that page', {timeout: 45000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-large-ui-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  const file = path.join(temp, 'large.log')
  const block = Buffer.from(('this is a log line '.padEnd(127, '.') + '\n').repeat(PAGE_SIZE / 128))
  const handle = await fs.open(file, 'w')
  try {
    for (let i = 0; i < EDIT_LIMIT / PAGE_SIZE; i++) await handle.writeFile(block)
    await handle.writeFile('unique message here\r\n')
  } finally { await handle.close() }
  const {app, page} = await launch(profile, [file])
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await page.getByRole('button', {name: 'Find Across Pages…'}).click()
  const dialog = page.getByRole('dialog', {name: 'Find Across All Pages'})
  await dialog.getByRole('textbox', {name: 'Find'}).fill('unique')
  await dialog.getByRole('button', {name: 'Find All'}).click()
  await dialog.getByRole('button', {name: /^Page 49/}).click()
  await expect(page.locator('.cm-line').first()).toHaveText('unique message here')
  await expect(page.getByRole('textbox', {name: 'Document editor'})).toBeFocused()
  await page.keyboard.insertText('edited')
  await expect(page.locator('.cm-line').first()).toHaveText('edited message here')
  await expect(page.getByRole('button', {name: 'Previous page'})).toBeDisabled()
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByText('Saved large.log', {exact: true})).toBeVisible()
  await expect(page.getByRole('button', {name: 'Previous page'})).toBeEnabled()
  const saved = await fs.open(file, 'r')
  try {
    const tail = Buffer.alloc(21)
    await saved.read(tail, 0, tail.length, EDIT_LIMIT)
    assert.equal(tail.toString(), 'edited message here\r\n')
  } finally { await saved.close() }
})

test('I05 deleting and undoing a mixed line break restores its exact format', {timeout: 45000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-mixed-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  const file = path.join(temp, 'mixed.txt')
  await fs.writeFile(file, 'a\r\nb\nc\r\n')
  const {app, page} = await launch(profile, [file])
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await expect(page.getByRole('tab', {name: 'mixed.txt', exact: true})).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', {name: /^Ln/}).click()
  await page.getByLabel('Line', {exact: true}).fill('2')
  await page.getByLabel('Column', {exact: true}).fill('2')
  await page.getByRole('button', {name: 'Apply', exact: true}).click()
  await expect(page.getByRole('textbox', {name: 'Document editor'})).toBeFocused()
  await page.keyboard.press('Delete')
  await expect(page.locator('.cm-line')).toHaveText(['a', 'bc', ''])
  await page.keyboard.press(`${mod}+z`)
  await expect(page.locator('.cm-line')).toHaveText(['a', 'b', 'c', ''])
  await expect(page.locator('.status-file')).toHaveText('mixed.txtSaved')
  await page.keyboard.insertText('!')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByText('Saved mixed.txt', {exact: true})).toBeVisible()
  assert.equal(await fs.readFile(file, 'utf8'), 'a\r\nb!\nc\r\n')
})

test('I05 reopening with a Unicode encoding preserves the BOM and Save a Copy leaves the source alone', {timeout: 45000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-encoding-ui-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  const file = path.join(temp, 'original.txt')
  const copy = path.join(temp, 'copy.txt')
  const original = encode({encoding: 'UTF-8 BOM', text: 'begin\n', eol: 'CRLF'})
  const edited = encode({encoding: 'UTF-8 BOM', text: 'after 中\n', eol: 'CRLF'})
  await fs.writeFile(file, original)
  const {app, page} = await launch(profile, [file])
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await expect(page.getByRole('tab', {name: 'original.txt', exact: true})).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', {name: 'Encoding', exact: true}).click()
  await page.getByRole('button', {name: 'Reopen with encoding…', exact: true}).click()
  const reopen = page.getByRole('dialog', {name: 'Reopen with encoding'})
  await reopen.getByLabel('Interpret disk bytes as').selectOption('UTF-8')
  await reopen.getByRole('button', {name: 'Apply', exact: true}).click()
  await expect(reopen).toBeHidden()
  await expect(page.getByRole('button', {name: 'UTF-8 BOM', exact: true})).toBeVisible()
  const editor = page.getByRole('textbox', {name: 'Document editor'})
  await editor.click()
  await page.keyboard.press(`${mod}+a`)
  await page.keyboard.insertText('after 中\n')
  const saveCopy = async destination => {
    await app.evaluate(({dialog}, filePath) => {
      dialog.showSaveDialog = async () => ({canceled: false, filePath})
    }, destination)
    await page.getByRole('button', {name: 'File', exact: true}).click()
    await page.getByRole('button', {name: 'Save a copy…', exact: true}).click()
  }
  await saveCopy(file)
  await expect(page.getByText('Choose a different file for the copy.', {exact: true})).toBeVisible()
  assert.deepEqual(await fs.readFile(file), original)
  await saveCopy(copy)
  await expect(page.getByText('Saved copy.txt', {exact: true})).toBeVisible()
  assert.deepEqual(await fs.readFile(copy), edited)
  assert.deepEqual(await fs.readFile(file), original)
  await expect(page.getByRole('tab', {name: /original.txt Unsaved/})).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press(`${mod}+s`)
  await expect(page.getByText('Saved original.txt', {exact: true})).toBeVisible()
  assert.deepEqual(await fs.readFile(file), edited)
})

test('I07 quitting without session recovery keeps edits if Save All is canceled', {timeout: 45000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-quit-ui-'))
  const profile = path.join(temp, 'profile')
  await fs.mkdir(profile)
  await fs.writeFile(path.join(profile, 'session.json'), JSON.stringify({version: 1, settings: {recover: false}}))
  const saved = path.join(temp, 'kept.txt')
  const {app, page} = await launch(profile)
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await page.getByRole('textbox', {name: 'Document editor'}).click()
  await page.keyboard.insertText('keep my notes 中')
  await app.evaluate(({dialog, BrowserWindow}) => {
    dialog.showMessageBox = async (_window, options) => {
      if (options.buttons.join('|') !== 'Save All|Discard Changes|Cancel') throw new Error('Unexpected quit options')
      return {response: 0}
    }
    dialog.showSaveDialog = async () => ({canceled: true})
    BrowserWindow.getAllWindows()[0].close()
  })
  await expect(page.getByRole('tab', {name: /Untitled 1 Unsaved/})).toBeVisible()
  await expect(page.locator('.cm-content')).toContainText('keep my notes 中')
  await expect.poll(() => app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().length)).toBe(1)
  await Promise.all([
    page.waitForEvent('close'),
    app.evaluate(({dialog, BrowserWindow}, filePath) => {
      dialog.showSaveDialog = async () => ({canceled: false, filePath})
      setTimeout(() => BrowserWindow.getAllWindows()[0]?.close(), 40)
    }, saved),
  ])
  assert.equal(await fs.readFile(saved, 'utf8'), 'keep my notes 中')
})

test('I07 restores a scratch tab and unsaved edits after the app is force terminated', {timeout: 60000}, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-crash-recovery-'))
  const profile = path.join(temp, 'profile')
  const snapshot = path.join(profile, 'session.json')
  const filename = path.join(temp, 'notes.txt')
  const original = Buffer.from('original notes\r\n')
  await fs.mkdir(profile)
  await fs.writeFile(filename, original)
  let {app, page} = await launch(profile, [filename])
  t.after(async () => {
    await app.close().catch(() => {})
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await expect(page.getByRole('tab', {name: 'notes.txt', exact: true})).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('textbox', {name: 'Document editor'}).click()
  await page.keyboard.press(`${mod}+a`)
  await page.keyboard.insertText('unsaved notes 中')
  await page.keyboard.press(`${mod}+n`)
  await expect(page.getByRole('tab', {name: 'Untitled 2', exact: true})).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.insertText('scratch café')

  await expect.poll(async () => {
    try {
      const {docs} = JSON.parse(await fs.readFile(snapshot, 'utf8'))
      return docs.filter(doc => doc.dirty).map(doc => doc.text)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      return []
    }
  }).toEqual(['unsaved notes 中', 'scratch café'])
  const child = app.process()
  const stopped = once(child, 'exit')
  if (process.platform === 'win32') await promisify(execFile)('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true})
  // Playwright launches Electron in its own process group on POSIX.
  else assert.equal(process.kill(-child.pid, 'SIGKILL'), true)
  await stopped
  assert.deepEqual(await fs.readFile(filename), original)

  ;({app, page} = await launch(profile))
  await expect(page.getByRole('tab', {name: /Untitled 2 Unsaved/})).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', {name: 'Document editor'})).toContainText('scratch café')
  await page.getByRole('tab', {name: /notes.txt Unsaved/}).click()
  await expect(page.getByRole('textbox', {name: 'Document editor'})).toContainText('unsaved notes 中')
  assert.deepEqual(await fs.readFile(filename), original)
})

test('I07 an explicit app Quit flushes the draft and exits the native process', {timeout: 35000}, async t => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'margin-explicit-quit-'))
  const {app, page} = await launch(profile)
  const child = app.process()
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await fs.rm(profile, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  })
  await page.getByRole('textbox', {name: 'Document editor'}).click()
  await page.keyboard.insertText('keep on explicit quit')
  const exit = once(child, 'exit', {signal: AbortSignal.timeout(8000)})
  await app.evaluate(({app}) => { setTimeout(() => app.quit(), 25) })
  assert.deepEqual(await exit, [0, null])
  const session = JSON.parse(await fs.readFile(path.join(profile, 'session.json'), 'utf8'))
  assert.equal(session.docs[0].text, 'keep on explicit quit')
  assert.equal(session.docs[0].dirty, true)
})
