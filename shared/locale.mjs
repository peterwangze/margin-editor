export const interfaceLanguages = [
  {value: 'en', label: 'English'},
  {value: 'zh-CN', label: '简体中文'},
  {value: 'zh-TW', label: '繁體中文'},
  {value: 'ja', label: '日本語'},
  {value: 'ko', label: '한국어'},
  {value: 'fr', label: 'Français'},
  {value: 'de', label: 'Deutsch'},
  {value: 'es', label: 'Español'},
  {value: 'it', label: 'Italiano'},
  {value: 'pt', label: 'Português'},
  {value: 'ru', label: 'Русский'},
  {value: 'ar', label: 'العربية', direction: 'rtl'},
  {value: 'hi', label: 'हिन्दी'},
  {value: 'id', label: 'Bahasa Indonesia'},
]

const supported = new Set(interfaceLanguages.map(({value}) => value))
const languageVariants = interfaceLanguages.map(({value}) => ({value, locale: new Intl.Locale(value).maximize()}))

export function interfaceDirection(locale) {
  return interfaceLanguages.find(({value}) => value === locale)?.direction ?? 'ltr'
}

export function languagePreference(value) {
  return supported.has(value) ? value : 'system'
}

export function interfaceLocale(preference, preferredLanguages = []) {
  if (supported.has(preference)) return preference
  for (const language of preferredLanguages) {
    if (typeof language !== 'string') continue
    let candidate
    try {
      candidate = new Intl.Locale(language.split(/[.@]/, 1)[0].replaceAll('_', '-'))
    } catch {
      continue
    }
    if (supported.has(candidate.baseName)) return candidate.baseName
    const maximized = candidate.maximize()
    const compatible = languageVariants.filter(({locale}) => locale.language === maximized.language && locale.script === maximized.script)
    const match = compatible.find(({locale}) => locale.region === maximized.region) ?? compatible[0]
    if (match) return match.value
  }
  return 'en'
}
