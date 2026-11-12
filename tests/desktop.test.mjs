import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {_electron as electron, expect} from '@playwright/test'
import {encode} from '../desktop/codec.mjs'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const executablePath = process.env.MARGIN_EXECUTABLE || undefined

async function launch(profile, files = []) {
  const app = await electron.launch({executablePath, args: [...(executablePath ? [] : ['.']), ...files], env: {...process.env, MARGIN_PROFILE: profile}, timeout: 25000})
  try {
    const page = await app.firstWindow({timeout: 15000})
    await expect(page.getByRole('textbox', {name: 'Document editor'})).toBeVisible({timeout: 12000})
    return {app, page}
  } catch (error) {
    app.process().kill()
    throw error
  }
}

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
  await page.getByRole('button', {name: 'Find in Files', exact: true}).click()
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
