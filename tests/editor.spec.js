import {test, expect} from '@playwright/test'
import fs from 'node:fs/promises'

const control = process.platform === 'darwin' ? 'Meta' : 'Control'
const editor = page => page.getByRole('textbox', {name: 'Document editor'}).first()
const lines = page => page.locator('.editor-pane').first().locator('.cm-line')

async function command(page, name) {
  await page.keyboard.press(`${control}+Shift+p`)
  const box = page.getByRole('textbox', {name: 'Filter command palette'})
  await box.fill(name)
  await page.getByRole('dialog').getByRole('button', {name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)}).click()
}

test.beforeEach(async ({page}) => { await page.goto('/'); await expect(editor(page)).toBeVisible() })

test('S01/S02 visual grid, responsive chrome and keyboard focus', async ({page}) => {
  await expect(page.getByRole('navigation', {name: 'Application menus'})).toBeVisible()
  await expect(page.getByRole('tab', {name: 'Untitled 1'})).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('complementary', {name: 'Explorer'})).toHaveCount(0)
  await expect(editor(page)).toBeFocused()
  await expect(page.locator('.cm-gutters')).toBeVisible()
  if (process.env.MARGIN_SCREENSHOTS) {
    await fs.mkdir('docs/screenshots', {recursive: true})
    await command(page, 'Open sample documents')
    await expect(page.getByRole('tab', {name: 'notes.txt'})).toHaveAttribute('aria-selected', 'true')
    await page.screenshot({path: 'docs/screenshots/workbench.png', animations: 'disabled'})
  }
  await page.getByRole('button', {name: 'View', exact: true}).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', {name: 'Toggle explorer'})).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', {name: 'Explorer'})).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({width: 650, height: 540})
  await expect(page.getByRole('toolbar', {name: 'Editor toolbar'}).getByRole('button', {name: 'Replace', exact: true})).toBeVisible()
  const viewport = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, width: innerWidth}))
  expect(viewport.scroll).toBe(viewport.width)
  await page.getByRole('button', {name: 'Hide Explorer'}).click()
  await expect(page.getByRole('complementary', {name: 'Explorer'})).toHaveCount(0)
})

test('I02/I03 actual input, regex, replace, undo and session reload', async ({page}) => {
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  await page.getByRole('button', {name: 'New document', exact: true}).click()
  await expect(page.getByRole('tab', {name: 'Untitled 2'})).toHaveAttribute('aria-selected', 'true')
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

test('I03 executes a Notepad++ Boost pattern and named replacement in the editor worker', async ({page}) => {
  await page.keyboard.insertText('label: value')
  await page.keyboard.press(`${control}+h`)
  await page.getByRole('textbox', {name: 'Find', exact: true}).fill('^label: \\K(?<word>value)')
  await page.getByRole('button', {name: 'Regular expression'}).click()
  await page.getByRole('textbox', {name: 'Replace', exact: true}).fill('\\U$+{word}\\E')
  await expect(page.getByText('1 of 1')).toBeVisible()
  await page.getByRole('button', {name: 'Replace All'}).click()
  await expect(lines(page)).toHaveText(['label: VALUE'])
})

test('I04/I08 split and clone edit, macro replay and Markdown preview', async ({page}) => {
  await command(page, 'Open sample documents')
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
  await page.getByRole('button', {name: /^Preferences/}).click()
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
  await command(page, 'Open sample documents')
  await page.getByRole('toolbar', {name: 'Editor toolbar'}).getByRole('button', {name: 'Replace', exact: true}).click()
  await page.getByRole('textbox', {name: 'Find', exact: true}).fill('offline')
  await page.getByRole('textbox', {name: 'Replace', exact: true}).fill('local')
  await expect(page.getByText('1 of 1')).toBeVisible()
  await expect(page.locator('.active-hit')).toHaveText('offline')
  const find = await page.getByRole('region', {name: 'Find and replace'}).boundingBox()
  const document = await editor(page).boundingBox()
  expect(find.y).toBeGreaterThan(document.y)
  if (process.env.MARGIN_SCREENSHOTS) await page.screenshot({path: 'docs/screenshots/find.png', animations: 'disabled'})
  await page.keyboard.press(`${control}+Shift+p`)
  await page.getByRole('textbox', {name: 'Filter command palette'}).fill('format json')
  await expect(page.getByRole('dialog').getByRole('button', {name: /Format JSON/})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('I09 imports Notepad++ preferences and applies default encoding to new documents', async ({page}) => {
  await page.getByRole('button', {name: 'Settings', exact: true}).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', {name: 'Import Notepad++ preferences…'}).click()
  await (await chooser).setFiles({name: 'config.xml', mimeType: 'text/xml', buffer: Buffer.from(`<NotepadPlus><GUIConfigs>
    <GUIConfig name="DarkMode" enable="yes"/>
    <GUIConfig name="TabSetting" replaceBySpace="no" size="5"/>
    <GUIConfig name="ScintillaPrimaryView" lineNumberMargin="hide" Wrap="yes"/>
    <GUIConfig name="NewDocDefaultSettings" format="0" encoding="3" codepage="-1"/>
    </GUIConfigs></NotepadPlus>`)})
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', {name: 'Tabs: 5', exact: true})).toBeVisible()
  await expect(page.getByRole('button', {name: 'Toggle word wrap', exact: true})).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', {name: 'New document', exact: true}).click()
  await expect(page.getByRole('button', {name: 'UTF-16 LE', exact: true})).toBeVisible()
  await expect(page.getByRole('button', {name: 'CRLF', exact: true})).toBeVisible()
})

test('I09 imports a remapped Notepad++ shortcut and reports conflicts', async ({page}) => {
  await page.getByRole('button', {name: 'Settings', exact: true}).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', {name: 'Import Notepad++ shortcuts…'}).click()
  await (await chooser).setFiles({name: 'shortcuts.xml', mimeType: 'text/xml', buffer: Buffer.from(`<NotepadPlus><InternalCommands>
    <Shortcut id="43001" Ctrl="yes" Alt="no" Shift="yes" Key="75"/>
    <Shortcut id="43003" Ctrl="yes" Alt="no" Shift="no" Key="79"/>
    </InternalCommands></NotepadPlus>`)})
  await expect(page.getByText('Imported 1 shortcut from Notepad++.')).toBeVisible()
  await expect(page.getByText(/Mod\+O is used by Open files/)).toBeVisible()
  await editor(page).focus()
  await page.keyboard.press(`${control}+Shift+k`)
  await expect(page.getByRole('textbox', {name: 'Find', exact: true})).toBeFocused()
})

test('I06 imports UDL keyword colors, comments, operators, delimiters and folds', async ({page}) => {
  await page.getByRole('button', {name: 'Language', exact: true}).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', {name: 'Import Notepad++ UDL…'}).click()
  await (await chooser).setFiles({name: 'fixture.xml', mimeType: 'text/xml', buffer: Buffer.from(`<NotepadPlus><UserLang name="Fixture DSL" ext="fixture">
    <Settings><Global caseIgnored="yes"/><Prefix Keywords2="yes"/></Settings>
    <KeywordLists><Keywords name="Keywords1">START</Keywords><Keywords name="Keywords2">pre</Keywords>
    <Keywords name="Comments">00// 01 02 03/* 04*/</Keywords><Keywords name="Operators1">=&gt;</Keywords>
    <Keywords name="Delimiters">00[ 01 02] 03 04 05</Keywords>
    <Keywords name="Folders in code1, open">START</Keywords><Keywords name="Folders in code1, close">END</Keywords></KeywordLists>
    <Styles><WordsStyle name="KEYWORDS1" fgColor="123456"/><WordsStyle name="KEYWORDS2" fgColor="365487"/>
    <WordsStyle name="OPERATORS" fgColor="234567"/><WordsStyle name="DELIMITERS1" fgColor="345678"/></Styles>
    </UserLang></NotepadPlus>`)})
  await expect(page.getByText('Imported 1 language definition.')).toBeVisible()
  await command(page, 'Select language')
  await page.getByRole('textbox', {name: 'Filter select language'}).fill('Fixture DSL')
  await page.getByRole('button', {name: 'Fixture DSL', exact: true}).click()
  await editor(page).focus()
  await page.keyboard.insertText('start\npreValue => [a value]\n/* comment\ncontinues */\nEND')
  await expect(page.locator('.cm-line span').filter({hasText: /^start$/})).toHaveCSS('color', 'rgb(18, 52, 86)')
  await expect(page.locator('.cm-line span').filter({hasText: /^preValue$/})).toHaveCSS('color', 'rgb(54, 84, 135)')
  await expect(page.locator('.cm-line span').filter({hasText: /^=>$/})).toHaveCSS('color', 'rgb(35, 69, 103)')
  await expect(page.locator('.cm-line span').filter({hasText: /^\[a value\]$/})).toHaveCSS('color', 'rgb(52, 86, 120)')
  await expect(page.locator('.cm-line span').filter({hasText: /continues \*\//})).toHaveCSS('font-style', 'italic')
  await command(page, 'Fold all')
  await expect(page.locator('.cm-foldPlaceholder')).toBeVisible()
})
