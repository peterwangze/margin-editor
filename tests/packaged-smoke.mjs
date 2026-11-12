import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import fs from 'node:fs/promises'
import {createServer} from 'node:net'
import os from 'node:os'
import path from 'node:path'
import {chromium, expect} from '@playwright/test'

const executable = process.env.MARGIN_EXECUTABLE
assert.ok(executable, 'Set MARGIN_EXECUTABLE to the packaged application executable')
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
const child = spawn(executable, [`--remote-debugging-port=${port}`, file], {env: {...process.env, MARGIN_PROFILE: profile}, stdio: ['ignore', 'pipe', 'pipe']})
const exited = once(child, 'exit').catch(() => {})
let output = ''
for (const pipe of [child.stdout, child.stderr]) pipe.on('data', data => { output = (output + data).slice(-10000) })
const watchdog = setTimeout(() => {
  child.kill('SIGKILL')
  console.error(`Packaged application validation timed out.\n${output}`)
  process.exit(1)
}, 60000)
const address = `http://127.0.0.1:${port}`
let browser
try {
  console.log(`Launching packaged ${process.platform}/${process.arch} application`)
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Margin exited with ${child.exitCode ?? child.signalCode}`)
    try { if ((await fetch(`${address}/json/version`, {signal: AbortSignal.timeout(350)})).ok) break }
    catch { /* Wait for the installed app to bind its debug port. */ }
    await new Promise(resolve => setTimeout(resolve, 180))
  }
  browser = await chromium.connectOverCDP(address, {timeout: 7000})
  console.log('Connected to the packaged application')
  const context = browser.contexts()[0]
  const page = context.pages()[0] ?? await context.waitForEvent('page', {timeout: 7000})
  page.setDefaultTimeout(7000)
  await context.route(/^https?:/, route => route.abort())
  await expect(page.getByRole('tab', {name: 'offline.txt', exact: true})).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', {name: 'CRLF', exact: true})).toBeVisible()
  const editor = page.getByRole('textbox', {name: 'Document editor'})
  await editor.click()
  await page.getByRole('button', {name: 'Edit', exact: true}).click()
  await page.getByRole('button', {name: /^Select all/}).click()
  await editor.focus()
  await page.keyboard.insertText('offline edit\n中🙂')
  await page.getByRole('button', {name: 'Save', exact: true}).click()
  await expect(page.getByText('Saved offline.txt', {exact: true})).toBeVisible()
  assert.equal(await fs.readFile(file, 'utf8'), 'offline edit\r\n中🙂')
  await page.getByRole('button', {name: 'Search', exact: true}).click()
  await page.getByRole('button', {name: /^Find (?:Ctrl|⌘)/}).click()
  await page.getByRole('textbox', {name: 'Find', exact: true}).fill('中')
  await expect(page.getByText('1 of 1')).toBeVisible()
  console.log(`Packaged ${process.platform}/${process.arch}: CLI open, Unicode edit, save, CRLF bytes and search passed`)
} catch (error) {
  console.error(output)
  throw error
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  await exited
  await browser?.close().catch(() => {})
  await fs.rm(temp, {recursive: true, force: true, maxRetries: 6, retryDelay: 250})
  clearTimeout(watchdog)
}
