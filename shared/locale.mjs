export const interfaceLanguages = [
  {value: 'en', label: 'English'},
  {value: 'zh-CN', label: '简体中文'},
]

const supported = new Set(interfaceLanguages.map(({value}) => value))
const languageVariants = interfaceLanguages.map(({value}) => ({value, locale: new Intl.Locale(value).maximize()}))

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
