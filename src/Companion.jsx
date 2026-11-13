import {useDeferredValue, useMemo} from 'react'
import {marked} from 'marked'
import DOMPurify from 'dompurify'
import {diffLines} from 'diff'
import {X} from 'lucide-react'
import {IconButton} from './chrome'
import {useLocale} from './i18n'

export function Companion({mode, doc, close}) {
  const {t} = useLocale()
  const text = useDeferredValue(doc.text)
  const baseline = doc.external?.text ?? doc.savedText ?? (doc.dirty ? '' : text)
  const preview = useMemo(() => {
    if (text.length > 1000000 || baseline.length > 1000000) return null
    if (mode === 'markdown') return DOMPurify.sanitize(marked.parse(text, {async: false}), {FORBID_TAGS: ['img', 'form', 'style', 'iframe'], FORBID_ATTR: ['style', 'href', 'src']})
    return diffLines(baseline, text, {timeout: 500})
  }, [mode, text, baseline])
  return <aside className="companion" aria-label={t(mode === 'markdown' ? 'Markdown preview' : 'Text comparison')}><div className="panel-heading"><strong>{t(mode === 'markdown' ? 'Markdown Preview' : doc.external?.text !== undefined ? 'Compare With Disk' : 'Compare With Saved')}</strong><IconButton icon={X} label={t('Close companion')} onClick={close} /></div>
    {!preview ? <p className="panel-empty">{t('Preview is unavailable for this document size.')}</p> : mode === 'markdown' ? <article className="markdown-preview" dangerouslySetInnerHTML={{__html: preview}} /> : <pre className="diff-preview">{preview.map((part, index) => <span key={index} className={part.added ? 'diff-add' : part.removed ? 'diff-remove' : ''}>{part.value}</span>)}</pre>}
  </aside>
}

export function DocumentMap({text, navigate}) {
  const {t} = useLocale()
  const deferred = useDeferredValue(text)
  const lines = useMemo(() => deferred.slice(0, 300000).split('\n').slice(0, 280), [deferred])
  return <aside className="document-map" aria-label={t('Document map')} onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    navigate(Math.min(lines.length, Math.max(1, Math.floor((event.clientY - rect.top - 12) / 3) + 1)))
  }}><pre aria-hidden="true">{lines.join('\n')}</pre></aside>
}
