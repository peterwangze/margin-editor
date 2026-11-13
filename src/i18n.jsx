import {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react'
import {interfaceLocale, languagePreference} from '../shared/locale.mjs'
import appChinese from './locales/app.zh-CN.js'
import chromeChinese from './locales/chrome.zh-CN.js'
import commandsChinese from './locales/commands.zh-CN.js'
import panelsChinese from './locales/panels.zh-CN.js'

export {interfaceLanguages} from '../shared/locale.mjs'

const translations = {
  'zh-CN': {...chromeChinese, ...commandsChinese, ...panelsChinese, ...appChinese},
}
const LocaleContext = createContext(null)
const storageKey = 'margin.ui-language'

export function translate(locale, message, parameters = {}) {
  const dictionary = translations[locale]
  const text = dictionary && Object.hasOwn(dictionary, message) ? dictionary[message] : message
  return text.replace(/\{([A-Za-z]\w*)\}/g, (token, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : token)
}

const errorPatterns = [
  [/^Some characters cannot be represented in (.+)\. Choose another encoding\.$/, 'Some characters cannot be represented in {value}. Choose another encoding.'],
  [/^File exceeds the (\d+) MiB read limit\.$/, 'File exceeds the {value} MiB read limit.'],
  [/^Workspace worker stopped \(([^)]+)\)\.$/, 'Workspace worker stopped ({value}).'],
  [/^(.+) changed since preview\. Run Preview Replace again\.$/s, '{value} changed since preview. Run Preview Replace again.'],
  [/^Cannot safely replace in (.+)\.$/s, 'Cannot safely replace in {value}.'],
]

export function errorMessage(t, error) {
  const message = String(error?.message ?? error ?? '').replace(/^Error invoking remote method 'margin:[\w]+': Error: /, '')
  for (const [pattern, key] of errorPatterns) {
    const match = pattern.exec(message)
    if (match) return t(key, {value: match[1]})
  }
  return t(message)
}

const browserLanguages = () => navigator.languages?.length ? navigator.languages : [navigator.language]

export function LocaleProvider({api, initial, children}) {
  const [preference, updatePreference] = useState(initial.preference)
  const [systemLanguages, setSystemLanguages] = useState(initial.systemLanguages)
  const [saveFailed, setSaveFailed] = useState(false)
  const revision = useRef(0)
  const locale = interfaceLocale(preference, systemLanguages)
  const formatNumber = useMemo(() => new Intl.NumberFormat(locale).format, [locale])
  const t = useMemo(() => (message, parameters) => translate(locale, message, parameters), [locale])

  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => {
    let active = true
    let generation = 0
    async function refresh() {
      const current = ++generation
      try {
        const languages = api ? await api.systemLanguages() : browserLanguages()
        if (active && current === generation) setSystemLanguages(languages)
      } catch { /* Retain the last successful reading. */ }
    }
    window.addEventListener('languagechange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.removeEventListener('languagechange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [api])

  function setPreference(value) {
    const next = languagePreference(value)
    const current = ++revision.current
    updatePreference(next)
    setSaveFailed(false)
    async function save() {
      try {
        if (api) await api.setInterfaceLanguage(next)
        else localStorage.setItem(storageKey, next)
      } catch {
        if (current === revision.current) setSaveFailed(true)
      }
    }
    void save()
  }

  const languageError = saveFailed ? t('The interface language could not be saved. Choose it again to retry.') : ''
  return <LocaleContext.Provider value={{t, locale, preference, setPreference, formatNumber, languageError}}>{children}</LocaleContext.Provider>
}

export async function loadInterfaceLanguage(api) {
  try {
    if (api) return await api.interfaceLanguage()
    return {preference: languagePreference(localStorage.getItem(storageKey)), systemLanguages: browserLanguages()}
  } catch {
    return {preference: 'system', systemLanguages: browserLanguages()}
  }
}

export function useLocale() {
  return useContext(LocaleContext)
}
