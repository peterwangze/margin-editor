import {useEffect, useRef, useState} from 'react'
import {Dialog} from './panels'

const options = [
  ['trim', 'Trim trailing spaces and tabs'],
  ['noBreak', 'Replace no-break spaces with spaces'],
  ['zeroWidth', 'Remove zero-width spaces (U+200B)'],
]
const emptyOptions = {trim: false, noBreak: false, zeroWidth: false}
const count = value => value.toLocaleString()

export function TextInspector({snapshot, close}) {
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
      <label>Inspect<select data-focus value={scope} onChange={event => selectScope(event.target.value)}>
        {scopes.selection && <option value="selection">Selected text</option>}
        <option value="document">{documentLabel}</option>
      </select></label>
      {stats ? <><dl className="inspect-metrics">
        <div><dt>Words</dt><dd>{count(stats.wordCount)}</dd></div>
        <div><dt>Characters</dt><dd title="Unicode grapheme clusters, including spaces and line breaks">{count(stats.characterCount)}</dd></div>
        <div><dt>Tabs</dt><dd>{count(stats.tabs)}</dd></div>
      </dl>
      <div className="inspect-inventory" aria-label="Hidden and unusual characters">
        {stats.characters.length ? <ul>{stats.characters.map(item => <li key={item.code}><code>{item.code}</code> <span>{item.name}</span> <strong>×{count(item.count)}</strong></li>)}</ul>
          : <p className="form-detail">No unusual characters found.</p>}
      </div></> : !error && <p className="form-detail" role="status">Counting text…</p>}
      <fieldset className="inspect-options" disabled={readOnly}>
        <legend>Cleanup options</legend>
        {options.map(([key, label]) => <label className="checkbox" key={key}><input type="checkbox" checked={chosen[key]} onChange={event => toggle(key, event.target.checked)} />{label}</label>)}
      </fieldset>
      <p className="form-detail">{readOnly ? 'This text is read-only.' : partialLastLine ? 'A line that continues on the next page is never trimmed here.' : 'Changes stay in the editor until you save. Line endings and joiners are preserved.'}</p>
      {planning && !error && !plan && <p className="form-detail" role="status">Preparing preview…</p>}
      {plan && <div className="inspect-preview" aria-label="Cleanup preview">
        <p role="status">{plan.limited ? 'Too many changes to apply at once. Inspect a smaller selection.' : plan.changedLines ? `${count(plan.changedLines)} changed line${plan.changedLines === 1 ? '' : 's'}${plan.changedLines > plan.preview.length ? ` · First ${plan.preview.length} shown` : ''}` : 'No changes in this scope.'}</p>
        {!plan.limited && plan.preview.map(({line, before, after}) => <div className="inspect-change" key={line}>
          <span>{documentLabel === 'Loaded page' ? 'Page line' : 'Line'} {count(line)}</span>
          <div><small>Before</small><code dir="auto">{before || '(empty)'}</code></div>
          <div><small>After</small><code dir="auto">{after || '(empty)'}</code></div>
        </div>)}
      </div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="outline-button" onClick={close}>Cancel</button><button className="primary-button" onClick={apply} disabled={readOnly || !plan?.changes.length}>Apply cleanup</button></div>
    </div>
  </Dialog>
}
