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

async function goToEditorPosition(page, line, column) {
  await page.getByTitle('Go to line', {exact: true}).click()
  const dialog = page.getByRole('dialog', {name: 'Go to line', exact: true})
  await dialog.getByLabel('Line', {exact: true}).fill(String(line))
  await dialog.getByLabel('Column', {exact: true}).fill(String(column))
  await dialog.getByRole('button', {name: 'Apply', exact: true}).click()
  await expect(editor(page)).toBeFocused()
}

test.beforeEach(async ({page}) => { await page.goto('/'); await expect(editor(page)).toBeVisible() })

test('L02 applies the system language and preserves editor state on language switches', async ({browser}, testInfo) => {
  const context = await browser.newContext({locale: 'zh-CN', baseURL: testInfo.project.use.baseURL, viewport: {width: 650, height: 540}})
  try {
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    const chineseEditor = page.getByRole('textbox', {name: '文档编辑器'})
    await expect(chineseEditor).toBeFocused()
    await page.keyboard.insertText('草稿 draft')
    await page.getByRole('button', {name: '设置', exact: true}).click()
    await page.getByRole('button', {name: /^首选项/}).click()
    const language = page.locator('dialog select').first()
    await expect(page.getByRole('combobox', {name: '界面语言'})).toHaveValue('system')
    await language.selectOption('en')
    await expect(page.getByRole('dialog', {name: 'Settings'})).toBeVisible()
    await expect(page.getByRole('combobox', {name: 'Interface language'})).toBeFocused()
    await language.selectOption('zh-CN')
    await expect(page.getByRole('combobox', {name: '界面语言'})).toHaveValue('zh-CN')
    await expect(page.getByRole('dialog')).toBeVisible()
    if (process.env.MARGIN_SCREENSHOTS) {
      await page.setViewportSize({width: 1024, height: 720})
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({path: 'docs/screenshots/interface-language.png', animations: 'disabled'})
    }
    await page.keyboard.press('Escape')
    await expect(chineseEditor).toContainText('草稿 draft')
    await page.getByRole('button', {name: '撤销', exact: true}).click()
    await expect(chineseEditor).not.toContainText('草稿 draft')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.getByRole('button', {name: '设置', exact: true}).click()
    await page.getByRole('button', {name: /^首选项/}).click()
    await expect(page.getByRole('combobox', {name: '界面语言'})).toHaveValue('zh-CN')
    await language.selectOption('system')
    await expect(page.getByRole('combobox', {name: '界面语言'})).toHaveValue('system')
  } finally {
    await context.close()
  }
})

test('inspect pasted text, preview an opt-in cleanup, apply and undo in one step', async ({page}) => {
  const original = 'copy\u00a0text\u200b  \nkeep 👩‍💻'
  await page.keyboard.insertText(original)
  await page.keyboard.press(`${control}+a`)
  await page.getByRole('button', {name: 'Inspect & clean text', exact: true}).click()
  const dialog = page.getByRole('dialog', {name: 'Inspect & clean text'})
  await expect(dialog.getByRole('combobox', {name: 'Inspect'})).toHaveValue('selection')
  await expect(dialog.getByText('U+00A0', {exact: true})).toBeVisible()
  await expect(dialog.getByText('U+200D', {exact: true})).toBeVisible()
  const apply = dialog.getByRole('button', {name: 'Apply cleanup'})
  await expect(apply).toBeDisabled()
  await dialog.getByRole('checkbox', {name: 'Trim trailing spaces and tabs'}).check()
  await dialog.getByRole('checkbox', {name: 'Replace no-break spaces with spaces'}).check()
  await dialog.getByRole('checkbox', {name: 'Remove zero-width spaces (U+200B)'}).check()
  await expect(dialog.getByRole('status')).toHaveText('1 changed line')
  await expect(dialog.getByText('copy[U+00A0]text[U+200B]··', {exact: true})).toBeVisible()
  await expect(dialog.getByText('copy·text', {exact: true})).toBeVisible()
  if (process.env.MARGIN_SCREENSHOTS) await page.screenshot({path: 'docs/screenshots/inspect.png', animations: 'disabled'})
  await page.setViewportSize({width: 650, height: 540})
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBe(0)
  await apply.click()
  await expect(lines(page).first()).toHaveText('copy text')
  await expect(lines(page).last()).toHaveText('keep 👩‍💻')
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press(`${control}+z`)
  await page.getByRole('button', {name: 'Inspect & clean text', exact: true}).click()
  await expect(dialog.getByText('U+200B', {exact: true})).toBeVisible()
  await expect(dialog.getByText('U+00A0', {exact: true})).toBeVisible()
  await dialog.getByRole('checkbox', {name: 'Trim trailing spaces and tabs'}).check()
  await expect(dialog.getByText('copy[U+00A0]text[U+200B]··', {exact: true})).toBeVisible()
})

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
  const toolbar = page.getByRole('toolbar', {name: 'Editor toolbar'})
  for (const [action, text] of [['New document', 'New'], ['Open files…', 'Open'], ['Save', 'Save'], ['Find', 'Find'], ['Replace', 'Replace']]) {
    const button = toolbar.getByRole('button', {name: action, exact: true})
    await expect(button).toBeInViewport({ratio: 1})
    await expect(button.getByText(text, {exact: true})).toBeVisible()
  }
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

test('I03 keeps Replace All within the captured selection across tabs, panes and edits', async ({page}) => {
  await page.keyboard.insertText('first needle\nsecond needle')
  await goToEditorPosition(page, 1, 1)
  await page.keyboard.press('Shift+End')
  await page.keyboard.press(`${control}+h`)
  const find = page.getByRole('region', {name: 'Find and replace'})
  await find.getByRole('textbox', {name: 'Find', exact: true}).fill('needle')
  await find.getByRole('textbox', {name: 'Replace', exact: true}).fill('target')
  await find.getByRole('checkbox', {name: 'In selection'}).check()
  const replaceAll = find.getByRole('button', {name: 'Replace All', exact: true})
  await expect(find.getByText('1 of 1', {exact: true})).toBeVisible()
  await expect(replaceAll).toBeEnabled()

  await page.getByRole('button', {name: 'New tab', exact: true}).click()
  await page.keyboard.insertText('other needle\nother needle')
  const scopeRequired = find.getByText('Select text to set the search range.', {exact: true})
  await expect(scopeRequired).toBeVisible()
  await expect(find.getByRole('checkbox', {name: 'In selection'})).toBeChecked()
  await expect(replaceAll).toBeDisabled()
  await expect(lines(page)).toHaveText(['other needle', 'other needle'])

  await page.getByRole('tab', {name: /Untitled 1/}).click()
  await expect(replaceAll).toBeEnabled()
  await command(page, 'Clone document to other pane')
  await page.getByRole('region', {name: 'Secondary editor'}).getByRole('textbox', {name: 'Document editor'}).click()
  await expect(scopeRequired).toBeVisible()
  await expect(replaceAll).toBeDisabled()
  await editor(page).click()
  await expect(replaceAll).toBeEnabled()

  await goToEditorPosition(page, 1, 1)
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.insertText('F')
  await expect(scopeRequired).toBeVisible()
  await expect(replaceAll).toBeDisabled()

  await goToEditorPosition(page, 2, 1)
  await page.keyboard.press('Shift+End')
  await find.getByRole('button', {name: 'Use selection'}).click()
  await expect(replaceAll).toBeEnabled()
  await replaceAll.click()
  await expect(lines(page)).toHaveText(['First needle', 'second target'])
  await expect(scopeRequired).toHaveCount(0)
  await expect(find.getByText('No matches', {exact: true})).toBeVisible()
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

test('I06 detects Verilog, preserves an explicit choice and shares readable syntax colors', async ({page}) => {
  const syntax = page.locator('.status-controls').getByTitle('Select language', {exact: true})
  const syntaxTokens = page.locator('.cm-line span:not(.cm-matchingScopeKeyword, .cm-nonmatchingScopeKeyword)')
  const keyword = syntaxTokens.filter({hasText: /^module$/})
  const prose = 'The module is ready. Please document the endmodule keyword.'
  const source = 'module gates(input left, input right, output result);\n  assign result = left & right;\nendmodule'
  const choose = async name => {
    await syntax.click()
    await page.getByRole('dialog').getByRole('button', {name, exact: true}).click()
  }
  const keywordStyle = async token => token.evaluate(element => {
    const rgb = color => {
      if (!color.startsWith('#')) return color.match(/[\d.]+/g).map(Number)
      const hex = color.slice(1)
      return (hex.length === 3 ? [...hex].map(value => value.repeat(2)) : hex.match(/.{2}/g))
        .map(value => parseInt(value, 16))
    }
    const luminance = color => rgb(color).slice(0, 3).map(value => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const contrast = (first, second) => {
      const lightness = [luminance(first), luminance(second)].sort((a, b) => b - a)
      return (lightness[0] + 0.05) / (lightness[1] + 0.05)
    }
    const keyword = getComputedStyle(element)
    const plain = getComputedStyle(element.closest('.cm-line'))
    let background = plain.backgroundColor
    if (rgb(background)[3] === 0) background = getComputedStyle(element.closest('.editor-surface')).backgroundColor
    const [red, green, blue] = rgb(keyword.color)
    const theme = getComputedStyle(document.documentElement)
    const themeColor = name => theme.getPropertyValue(name).trim()
    const colors = ['--text', '--token-keyword', '--token-key', '--token-string', '--token-number', '--token-comment', '--token-blue', '--token-invalid']
    const backgrounds = ['--canvas', '--focus-line', '--selection']
    return {
      blue: blue > green && green > red,
      heavier: Number(keyword.fontWeight) > Number(plain.fontWeight),
      distinct: keyword.color !== plain.color,
      contrast: contrast(keyword.color, background),
      paletteContrast: Object.fromEntries(colors.map(color => [
        color, Math.min(...backgrounds.map(background => contrast(themeColor(color), themeColor(background)))),
      ])),
    }
  })
  const verifyThemes = async token => {
    await expect(token).toBeVisible()
    for (const theme of ['light', 'dark']) {
      await page.getByRole('button', {name: 'Settings', exact: true}).click()
      await page.getByRole('button', {name: /^Preferences/}).click()
      await page.getByLabel('Appearance').selectOption(theme)
      await page.getByRole('button', {name: 'Close dialog'}).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const style = await keywordStyle(token)
      expect(style).toMatchObject({blue: true, heavier: true, distinct: true})
      expect(style.contrast).toBeGreaterThanOrEqual(4.5)
      for (const [color, ratio] of Object.entries(style.paletteContrast)) {
        expect(ratio, `${color} on the ${theme} editor backgrounds`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }

  await expect(syntax).toHaveText('Plain Text')
  await page.keyboard.insertText(prose)
  await expect(lines(page)).toHaveText([prose])
  await expect(syntax).toHaveText('Plain Text')
  await page.keyboard.press(`${control}+a`)
  const header = 'module gates('
  await page.keyboard.insertText(header)
  await expect(syntax).toHaveText('Verilog')
  await page.keyboard.insertText(source.slice(header.length))
  await expect(syntax).toHaveText('Verilog')
  await verifyThemes(keyword)

  await choose('Plain Text')
  await expect(syntax).toHaveText('Plain Text')
  await expect(keyword).toHaveCount(0)
  await editor(page).focus()
  await page.keyboard.press(`${control}+a`)
  await page.keyboard.insertText(`${source}\n// manual choice`)
  await page.reload()
  await expect(lines(page).last()).toHaveText('// manual choice')
  await expect(syntax).toHaveText('Plain Text')
  await choose('Automatic')
  await expect(syntax).toHaveText('Verilog')
  await expect(keyword).toBeVisible()

  await page.locator('input[type=file]').first().setInputFiles({
    name: 'gates.sv', mimeType: 'text/plain', buffer: Buffer.from(source),
  })
  await expect(syntax).toHaveText('SystemVerilog')
  await expect(keyword).toBeVisible()

  for (const example of [
    {name: 'example.py', mode: 'Python', source: 'def answer():\n    return 42', keyword: /^def$/},
    {name: 'example.js', mode: 'JavaScript', source: 'const answer = 42;', keyword: /^const$/},
  ]) {
    await page.locator('input[type=file]').first().setInputFiles({
      name: example.name, mimeType: 'text/plain', buffer: Buffer.from(example.source),
    })
    await expect(syntax).toHaveText(example.mode)
    await verifyThemes(syntaxTokens.filter({hasText: example.keyword}))
  }
})

test('I06 matches nested scope keywords and compound closers at the caret', async ({page}) => {
  const syntax = page.locator('.status-controls').getByTitle('Select language', {exact: true})
  const matched = '.cm-matchingScopeKeyword'
  const unmatched = '.cm-nonmatchingScopeKeyword'
  const marks = page.locator(matched)
  const changeText = async source => {
    await editor(page).focus()
    await page.keyboard.press(`${control}+a`)
    await page.keyboard.insertText(source)
  }
  const rows = [
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
  await page.keyboard.insertText(rows.join('\n'))
  await expect(syntax).toHaveText('Verilog')

  await goToEditorPosition(page, 2, rows[1].indexOf('begin') + 1)
  await expect(marks).toHaveText(['begin', 'end'])
  await expect(lines(page).nth(7).locator(matched)).toHaveText('end')

  await goToEditorPosition(page, 7, rows[6].indexOf('end') + 2)
  await expect(lines(page).nth(4).locator(matched)).toHaveText('begin')
  await expect(lines(page).nth(6).locator(matched)).toHaveText('end')
  await expect(lines(page).nth(7).locator(matched)).toHaveCount(0)

  await goToEditorPosition(page, 4, rows[3].indexOf('begin') + 2)
  await expect(marks).toHaveCount(0)
  await expect(page.locator(unmatched)).toHaveCount(0)
  await goToEditorPosition(page, 1, 2)
  await expect(marks).toHaveText(['module', 'endmodule'])
  await goToEditorPosition(page, 3, rows[2].indexOf('end') + 2)
  await expect(marks).toHaveCount(0)
  await expect(page.locator(unmatched)).toHaveCount(0)

  await goToEditorPosition(page, 5, rows[4].indexOf('(') + 2)
  const brackets = page.locator('.cm-matchingBracket')
  await expect(brackets).toHaveText(['(', ')'])
  await expect(brackets.first()).toHaveCSS('outline-style', 'solid')

  await changeText('module demo;\n  initial begin\n')
  await goToEditorPosition(page, 2, rows[1].indexOf('begin') + 2)
  await expect(lines(page).nth(1).locator(unmatched)).toHaveText('begin')
  await goToEditorPosition(page, 3, 1)
  await page.keyboard.insertText('  end\nendmodule')
  await goToEditorPosition(page, 2, rows[1].indexOf('begin') + 2)
  await expect(marks).toHaveText(['begin', 'end'])
  await expect(page.locator(unmatched)).toHaveCount(0)

  await changeText('module demo;\n  end\nendmodule')
  await goToEditorPosition(page, 2, 4)
  await expect(lines(page).nth(1).locator(unmatched)).toHaveText('end')

  await changeText('#!/bin/sh\nif true; then\n  echo ready\nfi')
  await expect(syntax).toHaveText('Shell')
  await goToEditorPosition(page, 2, 2)
  await expect(marks).toHaveText(['if', 'fi'])
  await expect(page.locator(unmatched)).toHaveCount(0)

  await syntax.click()
  const picker = page.getByRole('dialog', {name: 'Select Language', exact: true})
  await picker.getByRole('textbox', {name: 'Filter select language'}).fill('VHDL')
  await picker.getByRole('button', {name: 'VHDL', exact: true}).click()
  await expect(syntax).toHaveText('VHDL')
  await changeText('process (clk)\nbegin\n  IF rising_edge(clk) THEN\n    value <= data;\n  END IF;\nend process;')
  await goToEditorPosition(page, 5, 8)
  await expect(lines(page).nth(2).locator(matched)).toHaveText('IF')
  await expect.poll(async () => (await lines(page).nth(4).locator(matched).allTextContents()).join('')).toBe('END IF')
  await expect(page.locator(unmatched)).toHaveCount(0)
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
