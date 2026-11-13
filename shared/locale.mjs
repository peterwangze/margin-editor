export const interfaceLanguages = [
  {value: 'en', label: 'English'},
  {value: 'zh-CN', label: '简体中文'},
]

const supported = new Set(interfaceLanguages.map(({value}) => value))

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
    if (candidate.language === 'zh') {
      if (candidate.maximize().script === 'Hans') return 'zh-CN'
      continue
    }
    if (supported.has(candidate.baseName)) return candidate.baseName
    if (supported.has(candidate.language)) return candidate.language
  }
  return 'en'
}
