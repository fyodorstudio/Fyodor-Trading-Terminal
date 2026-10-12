import { useEffect, useRef, useState } from 'react'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { majorForexPairs, forexPairCurrencies } from '../economic-calendar/forex/pairs'
import { researchRequest, type ResearchSeed, type SavedReport } from './research-request'
import './research.css'

export function ResearchReportPanel({ seed, brokerId, timeDisplay, onClose }: {
  seed: ResearchSeed; brokerId: string | null; timeDisplay: TimeDisplayPreference; onClose: () => void
}) {
  const [scope, setScope] = useState(seed.scope)
  const [title, setTitle] = useState(`${seed.scope} ${seed.focus ?? 'research'} ${seed.from} to ${seed.to}`.slice(0, 120))
  const [from, setFrom] = useState(seed.from), [to, setTo] = useState(seed.to)
  const [question, setQuestion] = useState(''), [contextDays, setContextDays] = useState(90)
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState<SavedReport | null>(null)
  const [error, setError] = useState<string | null>(null), [copied, setCopied] = useState(false)
  const panel = useRef<HTMLElement>(null), controller = useRef<AbortController | null>(null)
  const pathInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = panel.current
    element?.querySelector<HTMLInputElement>('input')?.focus()
    return () => {
      controller.current?.abort()
      if (element?.contains(document.activeElement)) previous?.focus()
    }
  }, [])
  async function save() {
    if (!brokerId) { setError('Connect calendar storage before preparing a report.'); return }
    setError(null); setSaving(true)
    const abort = new AbortController(); controller.current = abort
    try {
      const request = researchRequest(seed, brokerId, timeDisplay, title, from, to, question, contextDays, scope)
      const response = await fetch('/storage-api/reports', { method: 'POST', signal: abort.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : `Report could not be saved (HTTP ${response.status}).`)
      }
      const result: SavedReport = await response.json()
      if (!abort.signal.aborted) setSaved(result)
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Report could not be saved.')
    } finally { if (!abort.signal.aborted) setSaving(false) }
  }
  async function copyPath() {
    if (!saved) return
    try { await navigator.clipboard.writeText(saved.path); setCopied(true) }
    catch { pathInput.current?.focus(); pathInput.current?.select(); setError('Copy the selected path with Ctrl+C.') }
  }
  return <aside ref={panel} className="research-panel" aria-labelledby="research-title"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><h2 id="research-title">{saved ? 'Research saved' : 'Prepare research'}</h2>
      <button type="button" aria-label="Close research" onClick={onClose}>×</button></header>
    {saved ? <>
      <p>{saved.readings} readings · {saved.context_readings} context readings</p>
      {saved.coverage_incomplete && <p>Some calendar coverage is missing; the report lists the gaps.</p>}
      <label>Saved report<input ref={pathInput} aria-label="Saved report path" readOnly value={saved.path} onFocus={event => event.currentTarget.select()} /></label>
      <footer><button type="button" onClick={copyPath}>{copied ? 'Path copied' : 'Copy path'}</button><button type="button" onClick={onClose}>Done</button></footer>
    </> : <form onSubmit={event => { event.preventDefault(); if (!saving) void save() }}>
      <fieldset disabled={saving}>
        <label>Report name<input aria-label="Report name" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} /></label>
        {seed.currency ? <label>Research scope<select aria-label="Research scope" value={scope} onChange={event => setScope(event.target.value)}>
          <option value={seed.currency}>{seed.currency}</option>
          {majorForexPairs.filter(pair => (forexPairCurrencies(pair) as readonly string[]).includes(seed.currency!)).map(pair => <option key={pair}>{pair}</option>)}
        </select></label> : <p>{scope} · all release families</p>}
        {seed.focus && <p>{seed.focus}</p>}
        <div className="research-dates"><label>From<input type="date" aria-label="Research from date" value={from} onChange={event => setFrom(event.target.value)} required /></label>
          <label>Through<input type="date" aria-label="Research through date" value={to} onChange={event => setTo(event.target.value)} required /></label></div>
        <label>Earlier context<select aria-label="Research context" value={contextDays} onChange={event => setContextDays(Number(event.target.value))}>
          {[0, 30, 90, 180, 365].map(days => <option key={days} value={days}>{days ? `${days} days` : 'Selected dates only'}</option>)}
        </select></label>
        <label>Question / notes (optional)<textarea aria-label="Research question" rows={5} maxLength={4000} value={question} onChange={event => setQuestion(event.target.value)}
          placeholder={seed.kind === 'upcoming' ? 'Explain expectations and the hike, hold and cut scenarios.' : 'What drove this move? Was it base strength or quote weakness?'} /></label>
      </fieldset>
      <p>Includes all stored releases for {scope}, regardless of chart or Alert filters. Saves the brief and complete evidence together in a named report folder.</p>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={saving || !brokerId}>{saving ? 'Saving…' : 'Prepare research'}</button></footer>
    </form>}
    {error && <p role="alert">{error}</p>}
  </aside>
}
