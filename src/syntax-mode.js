import {useDeferredValue, useMemo} from 'react'
import {languages} from '@codemirror/language-data'
import {detectLanguage, languageSampleLimit} from '../shared/detect-language.mjs'

const modesByName = new Map(languages.map(mode => [mode.name, mode]))
export const languageNames = [...modesByName.keys()].sort()
export const plainTextMode = 'Plain Text'

function namedMode(name, selection, custom) {
  if (selection === plainTextMode) return null
  if (selection) return custom.find(mode => mode.name === selection) ?? modesByName.get(selection)
  if (!name) return null

  const extension = /\.([^.]+)$/.exec(name)?.[1].toLowerCase()
  const customMode = custom.find(mode => mode.extensions.split(/[ ,]+/).includes(extension))
  if (customMode) return customMode
  if (extension === 'v' || extension === 'vh') return modesByName.get('Verilog')
  return languages.find(mode => mode.filename?.test(name) || mode.extensions?.includes(extension))
}

export function useSyntaxMode(doc, custom) {
  const name = doc?.name
  const selection = doc?.language
  const mode = useMemo(() => namedMode(name, selection, custom), [name, selection, custom])
  const sample = doc && !selection && !mode && !doc.large && (doc.size ?? doc.text.length) <= 2 * 1024 * 1024
    ? doc.text.slice(0, languageSampleLimit)
    : ''
  const id = doc?.id
  const content = useMemo(() => ({id, sample}), [id, sample])
  const deferred = useDeferredValue(content)
  const prefix = sample && deferred.id === id ? deferred.sample : sample
  return useMemo(() => mode ?? (prefix ? modesByName.get(detectLanguage(prefix)) : undefined), [mode, prefix])
}
