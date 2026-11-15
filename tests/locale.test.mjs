import test from 'node:test'
import assert from 'node:assert/strict'
import {interfaceLanguages, interfaceLocale, languagePreference} from '../shared/locale.mjs'
import app from '../src/locales/app.zh-CN.js'
import chrome from '../src/locales/chrome.zh-CN.js'
import commands from '../src/locales/commands.zh-CN.js'
import panels from '../src/locales/panels.zh-CN.js'
import traditional from '../src/locales/zh-TW.js'
import japanese from '../src/locales/ja.js'
import korean from '../src/locales/ko.js'
import french from '../src/locales/fr.js'
import german from '../src/locales/de.js'
import spanish from '../src/locales/es.js'

test('interface language honors explicit choices and ordered OS preferences', () => {
  assert.equal(interfaceLocale('en', ['zh-Hans-CN']), 'en')
  assert.equal(interfaceLocale('zh-CN', ['en-US']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['it-IT', 'zh-Hans-SG', 'en-US']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['en-GB', 'zh-CN']), 'en')
  assert.equal(interfaceLocale('system', ['zh_CN.UTF-8']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['zh-Hant-CN', 'zh-TW', 'de-DE']), 'zh-TW')
  assert.equal(interfaceLocale('system', ['zh-HK', 'zh-CN']), 'zh-TW')
  assert.equal(interfaceLocale('system', ['zh_MO.UTF-8']), 'zh-TW')
  assert.equal(interfaceLocale('system', ['zh-Hans-TW']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['it-IT', 'ja-JP', 'ko-KR']), 'ja')
  assert.equal(interfaceLocale('system', ['ko_KR.UTF-8', 'en']), 'ko')
  assert.equal(interfaceLocale('system', ['fr-CA', 'de-DE', 'en']), 'fr')
  assert.equal(interfaceLocale('system', ['it-IT', 'de_CH.UTF-8', 'fr-FR']), 'de')
  assert.equal(interfaceLocale('system', ['es-MX', 'en-US']), 'es')
  assert.equal(interfaceLocale('system', ['es-419']), 'es')
  assert.equal(interfaceLocale('system', [null, '', 'it-IT']), 'en')
  for (const {value} of interfaceLanguages) assert.equal(interfaceLocale(value, ['en-US', 'zh-CN']), value)
  assert.equal(languagePreference('unknown'), 'system')
})

test('all translated locales cover the same messages and preserve named placeholders', () => {
  const parameters = value => [...value.matchAll(/\{([A-Za-z]\w*)\}/g)].map(match => match[1]).sort()
  const simplified = {...chrome, ...commands, ...panels, ...app}
  const keys = Object.keys(simplified).sort()
  for (const [locale, dictionary] of Object.entries({
    'zh-CN': simplified, 'zh-TW': traditional, ja: japanese, ko: korean, fr: french, de: german, es: spanish,
  })) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, `${locale} message coverage`)
    for (const [source, translation] of Object.entries(dictionary)) {
      assert.notEqual(translation.trim(), '', `${locale}: ${source}`)
      assert.deepEqual(parameters(translation), parameters(source), `${locale}: ${source}`)
    }
  }
})
