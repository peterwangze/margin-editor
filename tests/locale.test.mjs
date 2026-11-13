import test from 'node:test'
import assert from 'node:assert/strict'
import {interfaceLocale, languagePreference} from '../shared/locale.mjs'
import app from '../src/locales/app.zh-CN.js'
import chrome from '../src/locales/chrome.zh-CN.js'
import commands from '../src/locales/commands.zh-CN.js'
import panels from '../src/locales/panels.zh-CN.js'

test('interface language honors explicit choices and ordered OS preferences', () => {
  assert.equal(interfaceLocale('en', ['zh-Hans-CN']), 'en')
  assert.equal(interfaceLocale('zh-CN', ['en-US']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['ja-JP', 'zh-Hans-SG', 'en-US']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['en-GB', 'zh-CN']), 'en')
  assert.equal(interfaceLocale('system', ['zh_CN.UTF-8']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['zh-Hant-CN', 'zh-TW', 'de-DE']), 'en')
  assert.equal(interfaceLocale('system', [null, '', 'ja-JP']), 'en')
  assert.equal(languagePreference('unknown'), 'system')
})

test('Chinese translations preserve named placeholders', () => {
  const parameters = value => [...value.matchAll(/\{([A-Za-z]\w*)\}/g)].map(match => match[1]).sort()
  for (const dictionary of [app, chrome, commands, panels]) {
    for (const [source, translation] of Object.entries(dictionary)) {
      assert.notEqual(translation.trim(), '', source)
      assert.deepEqual(parameters(translation), parameters(source), source)
    }
  }
})
