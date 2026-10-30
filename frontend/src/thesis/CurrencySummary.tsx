import { memo, useEffect, useId, useState } from 'react'
import { currencyAssessmentStatus, currencyEvidenceAge, currencyUntil, validCurrencySummary, type CurrencySummarySnapshot } from './currency-summary-model'
import './currency-summary.css'

const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

export const CurrencySummary = memo(function CurrencySummary() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('fyodor.fundamentals.collapsed.v1') === 'true' } catch { return false }
  })
  const contentId = useId()
  const [snapshot, setSnapshot] = useState<CurrencySummarySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined, revision: string | null = null
    async function pollCurrencySummary() {
      try {
        const params = revision ? `?after_revision=${encodeURIComponent(revision)}` : ''
        const response = await fetch(`/storage-api/theses/summary${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Restart calendar storage to enable the summary.' : 'Summary refresh failed.')
        const data = await response.json()
        if (controller.signal.aborted) return
        if (data.unchanged ? data.schema !== 1 || data.revision !== revision || !revision : !validCurrencySummary(data)) throw new Error('Invalid currency summary response.')
        if (!data.unchanged) {
          revision = data.revision
          setSnapshot(previous => previous?.revision === revision ? previous : data)
        }
        setError(null)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Summary unavailable.')
      }
      if (!controller.signal.aborted) timer = window.setTimeout(pollCurrencySummary, 5000)
    }
    void pollCurrencySummary()
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    return () => { controller.abort(); window.clearTimeout(timer); window.clearInterval(tick) }
  }, [])

  return <section className="currency-summary" aria-label="Currency fundamental summary">
    <h2><button type="button" aria-expanded={!collapsed} aria-controls={contentId} onClick={() => {
      setCollapsed(!collapsed)
      try { localStorage.setItem('fyodor.fundamentals.collapsed.v1', String(!collapsed)) } catch { /* Retain session choice. */ }
    }}><span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> Fundamentals</button></h2>
    <div id={contentId} hidden={collapsed}>
    <p>{snapshot?.as_of_utc ? `${clock.format(new Date(snapshot.as_of_utc))} Jakarta · Last Assessed` : snapshot ? 'No current Thesis saved.' : 'Loading saved Thesis…'}</p>
    {error && <p role="alert">{error}{snapshot && ' Showing the last loaded snapshot.'}</p>}
    {snapshot && <table aria-label="Currency verdicts"><thead><tr><th scope="col" title="Age of the latest dated development referenced by the assessment. Full evidence and offsets are in Thesis.">Evidence age</th><th scope="col">CUR</th><th scope="col">VERDICT</th><th scope="col">Checkpoint</th></tr></thead>
      <tbody>{snapshot.rows.map(row => {
        const until = currencyUntil(row.reassessment, now, row.reassessment_gap)
        const status = row.verdict && row.basis === 'standalone' ? currencyAssessmentStatus(row, now) : null
        return <tr key={row.currency} data-currency-summary={row.currency} className={until.due ? 'currency-review-due' : undefined}
          title={row.verified_utc ? `Direction checked ${clock.format(new Date(row.verified_utc))} Jakarta` : undefined}>
          <td title={row.evidence_anchor ? `${row.evidence_anchor.title}. ${row.evidence_anchor.note} Fundamentals assessed ${clock.format(new Date(row.verified_utc!))} Jakarta.` : 'No dated evidence anchor saved. The assessment time does not establish evidence freshness.'}>{row.verdict ? currencyEvidenceAge(row.evidence_anchor, now) : '—'}</td>
          <th scope="row">{row.currency}</th><td title={row.basis === 'standalone' ? `${status ? status.detail+' ' : ''}Standalone fundamental pressure · ${row.horizon}. ${row.stage_note || ''} Intensity is qualitative, not a probability or a guaranteed move.` : row.verdict ? 'Legacy verdict has not been reassessed as standalone currency fundamentals.' : row.reassessment_gap || undefined}>{!row.verdict ? 'Not assessed' : row.basis !== 'standalone' ? 'Legacy view' : `${row.intensity![0].toUpperCase()}${row.intensity!.slice(1)} ${row.verdict === 'POTENTIAL STRENGTHENING' ? 'strengthening' : 'weakening'}`}{status && <span className="currency-assessment-marker" aria-label={status.label} title={status.detail}> *</span>}</td>
          <td title={row.reassessment ? `${row.reassessment.title} · ${row.reassessment.event_at ? clock.format(new Date(row.reassessment.event_at)) + ' Jakarta' : row.reassessment.event_date + ' · hour unknown'}. ${row.reassessment.note}` : row.reassessment_gap}>{row.verdict || row.reassessment_gap ? until.label : '—'}</td>
        </tr>
      })}</tbody></table>}
    </div>
  </section>
})
