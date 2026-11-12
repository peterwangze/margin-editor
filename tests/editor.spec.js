import {test, expect} from '@playwright/test'
import fs from 'node:fs/promises'

const control = process.platform === 'darwin' ? 'Meta' : 'Control'
const editor = page => page.getByRole('textbox', {name: 'Document editor'}).first()
const lines = page => page.locator('.editor-pane').first().locator('.cm-line')

async function command(page, name) {
  await page.getByRole('button', {name: /^Command Palette/}).click()
  const box = page.getByRole('textbox', {name: 'Filter command palette'})
  await box.fill(name)
  await page.getByRole('dialog').getByRole('button', {name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)}).click()
}

test.beforeEach(async ({page}) => { await page.goto('/'); await expect(editor(page)).toBeVisible() })

test('S01/S02 visual grid, responsive chrome and keyboard focus', async ({page}) => {
  await expect(page.getByRole('navigation', {name: 'Application menus'})).toBeVisible()
  await expect(page.getByRole('tab', {name: 'workspace.json'})).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.cm-gutters')).toBeVisible()
  await expect(page.locator('.cm-content span').filter({hasText: 'demo-workspace'})).toBeVisible()
  if (process.env.MARGIN_SCREENSHOTS) {
    await fs.mkdir('docs/screenshots', {recursive: true})
    await page.screenshot({path: 'docs/screenshots/workbench.png', animations: 'disabled'})
  }
  await page.getByRole('button', {name: 'View', exact: true}).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', {name: 'Toggle explorer'})).toBeFocused()
  await page.keyboard.press('Escape')
  await page.setViewportSize({width: 650, height: 540})
  await expect(page.getByRole('button', {name: 'Command Palette'})).toBeVisible()
  const viewport = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, width: innerWidth}))
  expect(viewport.scroll).toBe(viewport.width)
  await page.getByRole('button', {name: 'Hide Explorer'}).click()
  await expect(page.getByRole('complementary', {name: 'Explorer'})).toHaveCount(0)
})

test('I02/I03 actual input, regex, replace, undo and session reload', async ({page}) => {
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  await page.getByRole('button', {name: 'New document', exact: true}).click()
  await expect(page.getByRole('tab', {name: 'Untitled 1'})).toHaveAttribute('aria-selected', 'true')
  await expect(editor(page)).toBeFocused()
  await page.keyboard.insertText('error 17\nerror 22')
  await page.keyboard.press(`${control}+h`)
  await page.getByRole('textbox', {name: 'Find', exact: true}).fill('error (\\d+)')
  await page.getByRole('button', {name: 'Regular expression'}).click()
  await page.getByRole('textbox', {name: 'Replace', exact: true}).fill('fixed $1')
  await expect(page.getByText('1 of 2')).toBeVisible()
  await page.getByRole('button', {name: 'Replace All'}).click()
  await expect(lines(page)).toHaveText(['fixed 17', 'fixed 22'])
  await page.getByRole('button', {name: 'Close find'}).click()
  await page.keyboard.press(`${control}+z`)
  await expect(lines(page)).toHaveText(['error 17', 'error 22'])
  await page.reload()
  await expect(lines(page)).toHaveText(['error 17', 'error 22'])
  expect(failures).toEqual([])
})

test('I04/I08 split and clone edit, macro replay and Markdown preview', async ({page}) => {
  await page.getByRole('tab', {name: 'welcome.md'}).click()
  await command(page, 'Markdown preview')
  await expect(page.getByRole('heading', {name: 'Welcome to Margin'})).toBeVisible()
  await page.getByRole('button', {name: 'Close companion'}).click()
  await page.keyboard.press(`${control}+n`)
  await command(page, 'Clone document to other pane')
  const secondary = page.getByRole('region', {name: 'Secondary editor'}).getByRole('textbox', {name: 'Document editor'})
  await expect(secondary).toBeVisible()
  await command(page, 'Start/stop macro recording')
  await secondary.click()
  await page.keyboard.insertText('demo ')
  await command(page, 'Stop macro recording')
  await command(page, 'Play last macro')
  await expect(page.locator('.editor-pane .cm-line')).toHaveText(['demo demo ', 'demo demo '])
})

test('I09 theme setting persists and status menus reflect EOL', async ({page}) => {
  await page.getByRole('button', {name: 'Settings', exact: true}).click()
  await page.getByLabel('Appearance').selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', {name: 'Close dialog'}).click()
  await page.getByRole('button', {name: 'LF', exact: true}).click()
  await page.getByRole('dialog').getByRole('button', {name: 'CRLF', exact: true}).click()
  await expect(page.getByRole('button', {name: 'CRLF', exact: true})).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', {name: 'CRLF', exact: true})).toBeVisible()
})

test('S03 real Find UI screenshot, result highlighting and command filtering', async ({page}) => {
  await page.keyboard.press(`${control}+h`)
  await page.getByRole('textbox', {name: 'Find', exact: true}).fill('version')
  await page.getByRole('textbox', {name: 'Replace', exact: true}).fill('revision')
  await expect(page.getByText('1 of 1')).toBeVisible()
  await expect(page.locator('.active-hit')).toHaveText('version')
  if (process.env.MARGIN_SCREENSHOTS) await page.screenshot({path: 'docs/screenshots/find.png', animations: 'disabled'})
  await page.getByRole('button', {name: /^Command Palette/}).click()
  await page.getByRole('textbox', {name: 'Filter command palette'}).fill('format json')
  await expect(page.getByRole('dialog').getByRole('button', {name: /Format JSON/})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
