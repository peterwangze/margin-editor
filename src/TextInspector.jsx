import {useEffect, useRef, useState} from 'react'
import {Dialog} from './panels'
import {errorMessage, useLocale} from './i18n'

const options = [
  ['trim', 'Trim trailing spaces and tabs'],
  ['noBreak', 'Replace no-break spaces with spaces'],
  ['zeroWidth', 'Remove zero-width spaces (U+200B)'],
]
const emptyOptions = {trim: false, noBreak: false, zeroWidth: false}

export function TextInspector({snapshot, close}) {
  const {t, formatNumber} = useLocale()
  const {scopes, documentLabel, partialLastLine, readOnly} = snapshot
  const [scope, setScope] = useState(scopes.selection ? 'selection' : 'document')
  const [chosen, setChosen] = useState(emptyOptions)
  const [stats, setStats] = useState(null)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const worker = useRef(null)
  const sequence = useRef(0)
  const statsId = useRef(0)
  const planId = useRef(0)
  const planning = chosen.trim || chosen.noBreak || chosen.zeroWidth
  useEffect(() => {
    const thread = new Worker(new URL('./inspect.worker.js', import.meta.url), {type: 'module'})
    worker.current = thread
    thread.onmessage = ({data}) => {
      if (data.id !== statsId.current && data.id !== planId.current) return
      if (data.error) setError(data.error)
      if (data.stats) setStats(data.stats)
      if (data.plan) setPlan(data.plan)
    }
    thread.onerror = () => setError('Text inspection could not start. Close this window and try again.')
    thread.postMessage({init: {text: snapshot.text, scopes, partialLastLine}})
    return () => { thread.terminate(); worker.current = null }
  }, [snapshot, scopes, partialLastLine])
  useEffect(() => {
    statsId.current = ++sequence.current
    worker.current?.postMessage({id: statsId.current, scope})
  }, [scope])
  useEffect(() => {
    planId.current = ++sequence.current
    if (planning) worker.current?.postMessage({id: planId.current, scope, options: chosen})
  }, [scope, chosen, planning])

  function selectScope(next) {
    if (next === scope) return
    statsId.current = planId.current = -1
    setStats(null)
    setPlan(null)
    setScope(next)
  }
  function toggle(key, value) {
    planId.current = -1
    setPlan(null)
    setChosen(current => ({...current, [key]: value}))
  }
  function apply() {
    if (!plan?.changes.length || readOnly) return
    try { snapshot.apply(plan.changes); close() }
    catch (failure) { setError(failure.message); setPlan(null) }
  }
  return <Dialog label="Inspect & clean text" close={close} className="inspect-dialog">
    <div className="form inspect-form">
      <label>{t('Inspect')}<select data-focus value={scope} onChange={event => selectScope(event.target.value)}>
        {scopes.selection && <option value="selection">{t('Selected text')}</option>}
        <option value="document">{t(documentLabel)}</option>
      </select></label>
      {stats ? <><dl className="inspect-metrics">
        <div><dt>{t('Words')}</dt><dd>{formatNumber(stats.wordCount)}</dd></div>
        <div><dt>{t('Characters')}</dt><dd title={t('Unicode grapheme clusters, including spaces and line breaks')}>{formatNumber(stats.characterCount)}</dd></div>
        <div><dt>{t('Tabs')}</dt><dd>{formatNumber(stats.tabs)}</dd></div>
      </dl>
      <div className="inspect-inventory" aria-label={t('Hidden and unusual characters')}>
        {stats.characters.length ? <ul>{stats.characters.map(item => <li key={item.code}><code>{item.code}</code> <span>{t(item.name)}</span> <strong>×{formatNumber(item.count)}</strong></li>)}</ul>
          : <p className="form-detail">{t('No unusual characters found.')}</p>}
      </div></> : !error && <p className="form-detail" role="status">{t('Counting text…')}</p>}
      <fieldset className="inspect-options" disabled={readOnly}>
        <legend>{t('Cleanup options')}</legend>
        {options.map(([key, label]) => <label className="checkbox" key={key}><input type="checkbox" checked={chosen[key]} onChange={event => toggle(key, event.target.checked)} />{t(label)}</label>)}
      </fieldset>
      <p className="form-detail">{t(readOnly ? 'This text is read-only.' : partialLastLine ? 'A line that continues on the next page is never trimmed here.' : 'Changes stay in the editor until you save. Line endings and joiners are preserved.')}</p>
      {planning && !error && !plan && <p className="form-detail" role="status">{t('Preparing preview…')}</p>}
      {plan && <div className="inspect-preview" aria-label={t('Cleanup preview')}>
        <p role="status">{previewStatus(t, formatNumber, plan)}</p>
        {!plan.limited && plan.preview.map(({line, before, after}) => <div className="inspect-change" key={line}>
          <span>{t(documentLabel === 'Loaded page' ? 'Page line {line}' : 'Line {line}', {line: formatNumber(line)})}</span>
          <div><small>{t('Before')}</small><code dir="auto">{before || t('(empty)')}</code></div>
          <div><small>{t('After')}</small><code dir="auto">{after || t('(empty)')}</code></div>
        </div>)}
      </div>}
      {error && <p className="inline-error" role="alert">{errorMessage(t, error)}</p>}
      <div className="form-actions"><button className="outline-button" onClick={close}>{t('Cancel')}</button><button className="primary-button" onClick={apply} disabled={readOnly || !plan?.changes.length}>{t('Apply cleanup')}</button></div>
    </div>
  </Dialog>
}

function previewStatus(t, formatNumber, {limited, changedLines, preview}) {
  if (limited) return t('Too many changes to apply at once. Inspect a smaller selection.')
  if (!changedLines) return t('No changes in this scope.')
  const count = formatNumber(changedLines)
  if (changedLines > preview.length) return t('{count} changed lines · First {shown} shown', {count, shown: formatNumber(preview.length)})
  return t(changedLines === 1 ? '{count} changed line' : '{count} changed lines', {count})
}
