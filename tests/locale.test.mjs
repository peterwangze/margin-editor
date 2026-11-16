import test from 'node:test'
import assert from 'node:assert/strict'
import {interfaceDirection, interfaceLanguages, interfaceLocale, languagePreference} from '../shared/locale.mjs'
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
import italian from '../src/locales/it.js'
import portuguese from '../src/locales/pt.js'
import russian from '../src/locales/ru.js'
import arabic from '../src/locales/ar.js'
import hindi from '../src/locales/hi.js'
import indonesian from '../src/locales/id.js'

test('interface language honors explicit choices and ordered OS preferences', () => {
  assert.equal(interfaceLocale('en', ['zh-Hans-CN']), 'en')
  assert.equal(interfaceLocale('zh-CN', ['en-US']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['nl-NL', 'zh-Hans-SG', 'en-US']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['en-GB', 'zh-CN']), 'en')
  assert.equal(interfaceLocale('system', ['zh_CN.UTF-8']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['zh-Hant-CN', 'zh-TW', 'de-DE']), 'zh-TW')
  assert.equal(interfaceLocale('system', ['zh-HK', 'zh-CN']), 'zh-TW')
  assert.equal(interfaceLocale('system', ['zh_MO.UTF-8']), 'zh-TW')
  assert.equal(interfaceLocale('system', ['zh-Hans-TW']), 'zh-CN')
  assert.equal(interfaceLocale('system', ['nl-NL', 'ja-JP', 'ko-KR']), 'ja')
  assert.equal(interfaceLocale('system', ['ko_KR.UTF-8', 'en']), 'ko')
  assert.equal(interfaceLocale('system', ['fr-CA', 'de-DE', 'en']), 'fr')
  assert.equal(interfaceLocale('system', ['nl-NL', 'de_CH.UTF-8', 'fr-FR']), 'de')
  assert.equal(interfaceLocale('system', ['es-MX', 'en-US']), 'es')
  assert.equal(interfaceLocale('system', ['es-419']), 'es')
  assert.equal(interfaceLocale('system', ['nl-NL', 'it-IT', 'en-US']), 'it')
  assert.equal(interfaceLocale('system', ['it-CH']), 'it')
  assert.equal(interfaceLocale('system', ['pt-BR', 'pt-PT', 'en-US']), 'pt')
  assert.equal(interfaceLocale('system', ['pt_PT.UTF-8']), 'pt')
  assert.equal(interfaceLocale('system', ['ru-RU', 'en-US']), 'ru')
  assert.equal(interfaceLocale('system', ['ar-EG', 'en-US']), 'ar')
  assert.equal(interfaceLocale('system', ['ar-MA', 'fr-FR']), 'ar')
  assert.equal(interfaceLocale('system', ['hi_IN.UTF-8', 'en-IN']), 'hi')
  assert.equal(interfaceLocale('system', ['nl-NL', 'id-ID', 'en-US']), 'id')
  assert.equal(interfaceLocale('system', ['in-ID']), 'id')
  assert.equal(interfaceLocale('system', [null, '', 'nl-NL']), 'en')
  for (const {value} of interfaceLanguages) {
    assert.equal(interfaceLocale(value, ['en-US', 'zh-CN']), value)
    assert.equal(interfaceDirection(value), value === 'ar' ? 'rtl' : 'ltr')
  }
  assert.equal(languagePreference('unknown'), 'system')
})

test('all translated locales cover the same messages and preserve named placeholders', () => {
  const parameters = value => [...value.matchAll(/\{([A-Za-z]\w*)\}/g)].map(match => match[1]).sort()
  const simplified = {...chrome, ...commands, ...panels, ...app}
  const keys = Object.keys(simplified).sort()
  for (const [locale, dictionary] of Object.entries({
    'zh-CN': simplified, 'zh-TW': traditional, ja: japanese, ko: korean, fr: french, de: german, es: spanish,
    it: italian, pt: portuguese, ru: russian, ar: arabic, hi: hindi, id: indonesian,
  })) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, `${locale} message coverage`)
    for (const [source, translation] of Object.entries(dictionary)) {
      assert.notEqual(translation.trim(), '', `${locale}: ${source}`)
      assert.deepEqual(parameters(translation), parameters(source), `${locale}: ${source}`)
    }
  }
})
