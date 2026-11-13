import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
import {once} from 'node:events'
import fs from 'node:fs/promises'
import {createServer} from 'node:net'
import os from 'node:os'
import path from 'node:path'
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
const server = createServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const {port} = server.address()
await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
const child = spawn(executable, [
  `--remote-debugging-port=${port}`,
  '--disable-background-networking',
  '--proxy-server=http://127.0.0.1:9',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
  file,
], {
  env: {...process.env, MARGIN_PROFILE: profile, HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9', NO_PROXY: 'localhost,127.0.0.1'},
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
})
const exited = once(child, 'exit').catch(() => {})
let output = ''
let launchError
child.on('error', error => { launchError = error })
for (const pipe of [child.stdout, child.stderr]) pipe.on('data', data => { output = (output + data).slice(-10000) })

function stopApplication() {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore', timeout: 7000})
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
  } catch (error) {
    if (error.code !== 'ESRCH') child.kill('SIGKILL')
  }
}

const watchdog = setTimeout(() => {
  stopApplication()
  console.error(`Packaged application validation timed out.\n${output}`)
  process.exit(1)
}, 75000)
const address = `http://127.0.0.1:${port}`
let browser
let page
try {
  console.log(`Launching ${packageForm} on ${process.platform}/${process.arch}`)
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
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.setViewportSize({width: 1024, height: 720})
  const menu = page.getByRole('navigation', {name: 'Application menus'})
  const toolbar = page.getByRole('toolbar', {name: 'Editor toolbar'})
  const editor = page.getByRole('textbox', {name: 'Document editor'})
  const tab = page.getByRole('tab', {name: 'offline.txt', exact: true})
  const status = page.getByLabel('Document status')
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
  await toolbar.getByRole('button', {name: 'Save', exact: true}).click()
  await expect(page.getByText('Saved offline.txt', {exact: true})).toBeVisible()
  assert.equal(await fs.readFile(file, 'utf8'), 'offline edit\r\n中🙂\r\ncopy\u200b this  ')
  await toolbar.getByRole('button', {name: 'Replace', exact: true}).click()
  await page.getByRole('textbox', {name: 'Find', exact: true}).fill('offline')
  await page.getByRole('textbox', {name: 'Replace', exact: true}).fill('local')
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
  assert.deepEqual(pageErrors, [])
  await fs.writeFile(path.join(evidence, `${packageForm}.json`), JSON.stringify({
    platform: process.platform,
    arch: process.arch,
    packageForm,
    offline: 'Chromium used a loopback-only proxy and renderer HTTP(S) requests were blocked',
    passed: ['desktop layout', 'narrow window', 'keyboard menu focus', 'CLI open', 'Unicode edit', 'CRLF save', 'find and replace', 'inspect and clean', 'undo and redo', 'disk byte verification'],
  }, null, 2) + '\n')
  console.log(`${packageForm}: layout, keyboard, CLI open, Unicode edit, save, CRLF bytes, replace, cleanup and undo passed`)
} catch (error) {
  await page?.screenshot({path: path.join(evidence, `${packageForm}-failed.png`)}).catch(() => {})
  console.error(output)
  throw error
} finally {
  await browser?.close().catch(() => {})
  stopApplication()
  if (child.pid) await exited
  await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  clearTimeout(watchdog)
}
