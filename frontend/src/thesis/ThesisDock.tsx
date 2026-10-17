import { memo, useCallback, useEffect, useState } from 'react'
import { majorForexPairs } from '../economic-calendar/forex/pairs'
import { readThesisPair, safeThesisLink, thesisMonth, thesisPrompt, type PendingThesis, type ThesisEntry, type ThesisRow, type ThesisTarget } from './thesis-model'
import { useTheses } from './useTheses'
import './thesis.css'

const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', weekday: 'short' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
const fullFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
function dayLabel(value: string) {
  const parts = dayFormatter.formatToParts(new Date(value.length === 10 ? value + 'T05:00:00Z' : value))
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('month')} ${part('day')}, ${part('weekday')}`
}
function Sources({ entry }: { entry: ThesisEntry }) {
  return <span className="thesis-sources">{entry.sources.map((source, index) => source.kind === 'web' && safeThesisLink(source.locator)
    ? <a key={index} href={source.locator} target="_blank" rel="noopener noreferrer" title={source.note || undefined}>{source.label}</a>
    : <span key={index} title={source.locator}>{source.label} (local evidence)</span>)}</span>
}
const PastRow = memo(function PastRow({ row, onCopy }: { row: ThesisRow; onCopy: (row: ThesisRow | PendingThesis) => void }) {
  const tone = row.verdict.includes('BUY') ? 'buy' : row.verdict.includes('SELL') ? 'sell' : 'mixed'
  return <tr data-thesis-row={row.row_id}>
    <td><strong>{dayLabel(row.as_of_utc)}</strong><small>{timeFormatter.format(new Date(row.as_of_utc))} · assessment</small><span className="thesis-event-title">{row.title}</span>
      {row.target && <small>{row.target.event_at ? `Release: ${fullFormatter.format(new Date(row.target.event_at))}` : `Release date: ${row.target.event_date} · hour unconfirmed`}</small>}</td>
    <td className={`thesis-verdict ${tone}`}>{row.verdict}</td>
    <td><p className="thesis-prose">{row.thesis} <Sources entry={row} /></p>
      <details className="thesis-details"><summary>Details · {row.versions.length} {row.versions.length === 1 ? 'version' : 'versions'}</summary>
        <p>As of {fullFormatter.format(new Date(row.as_of_utc))} Jakarta · {row.horizon}. Saved {fullFormatter.format(new Date(row.saved_utc))} Jakarta.</p>
        <p>{row.provenance === 'reconstruction' ? 'Retrospective reconstruction. ' : ''}{row.note}</p>
        {row.target && <p>{row.target.kind === 'highlight' ? `Highlight ${row.target.reference} · ${row.target.source_id}` : `External Source ${row.target.reference}`}</p>}
        {row.journal_id && <p>Detailed Highlight research: {row.journal_id}</p>}
        {row.versions.length > 1 && <ol aria-label="Previous thesis versions">{row.versions.slice(0, -1).reverse().map(version => <li key={version.id}>
          <strong>{version.verdict}</strong> · as of {fullFormatter.format(new Date(version.as_of_utc))} · saved {fullFormatter.format(new Date(version.saved_utc))}
          <p className="thesis-prose">{version.thesis} <Sources entry={version} /></p>{version.note && <p>{version.note}</p>}
        </li>)}</ol>}
        <button type="button" onClick={() => onCopy(row)}>Copy reassessment prompt</button>
      </details>
    </td>
  </tr>
})
function PendingStatus({ target }: { target: ThesisTarget }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!target.event_at) return
    let timer: number | undefined
    const check = () => {
      const delay = Date.parse(target.event_at!) - Date.now()
      if (delay < 0) { setNow(Date.now()); return }
      timer = window.setTimeout(check, Math.min(delay + 1, 2_147_483_647))
    }
    check()
    return () => window.clearTimeout(timer)
  }, [target])
  return <small>{target.event_at ? Date.parse(target.event_at) > now ? 'Upcoming' : 'Awaiting assessment' : 'Hour unconfirmed · awaiting assessment'}</small>
}
const PendingRow = memo(function PendingRow({ row, onCopy }: { row: PendingThesis; onCopy: (row: ThesisRow | PendingThesis) => void }) {
  return <tr data-thesis-pending={row.key}>
    <td><strong>{dayLabel(row.target.event_at ?? row.date)}</strong><small>{row.target.event_at ? timeFormatter.format(new Date(row.target.event_at)) : 'Hour unconfirmed'}</small>
      <span className="thesis-event-title">{row.title}</span><small>{row.stage}</small><PendingStatus target={row.target} />
      <button className="thesis-copy-release" type="button" onClick={() => onCopy(row)}>Copy release prompt</button></td>
    <td aria-label="Verdict pending" /><td aria-label="Thesis pending" />
  </tr>
})
function Head({ scope }: { scope: string }) {
  return <><colgroup><col className="thesis-date-column" /><col className="thesis-verdict-column" /><col /></colgroup>
    <thead><tr><th scope="col">Date / Event</th><th scope="col">{scope}</th><th scope="col">Thesis I would give</th></tr></thead></>
}

export const ThesisDock = memo(function ThesisDock({ brokerId }: { brokerId: string | null }) {
  const [scope, setScope] = useState(readThesisPair)
  const [copyStatus, setCopyStatus] = useState('')
  const { data, error, refresh } = useTheses(scope, brokerId)
  // Clipboard completion must not show a status for a pair that has since changed.
  const [copyContext, setCopyContext] = useState(scope)
  const copy = useCallback(async (row?: PendingThesis | ThesisRow) => {
    try { await navigator.clipboard.writeText(thesisPrompt(scope, thesisMonth, brokerId, row)); setCopyContext(scope); setCopyStatus('Prompt copied') }
    catch { setCopyContext(scope); setCopyStatus('Could not copy prompt. Allow clipboard access and retry.') }
  }, [scope, brokerId])
  return <section className="thesis-dock" aria-label="Thesis">
    <header className="thesis-header"><h2>Thesis</h2>
      <label>Pair <select aria-label="Thesis pair" value={scope} onChange={event => {
        setScope(event.target.value); setCopyStatus(''); try { localStorage.setItem('fyodor.thesis.pair.v1', event.target.value) } catch { /* Retain session choice. */ }
      }}>{majorForexPairs.map(pair => <option key={pair}>{pair}</option>)}</select></label>
      <label>Month <select aria-label="Thesis month" value={thesisMonth} onChange={() => {}}><option value={thesisMonth}>JUL 2026</option></select></label>
      <span className="thesis-timezone">Jakarta · AM/PM</span>
      <button type="button" onClick={() => { void copy() }}>Copy assessment prompt</button><button type="button" onClick={refresh}>Refresh</button>
      <span className="thesis-copy-status" role="status">{copyContext === scope ? copyStatus : ''}</span>
    </header>
    <div className="thesis-scroll" tabIndex={0} aria-label="Monthly thesis assessments">
      {error && <p className="thesis-notice" role="alert">{error}{data ? ' Showing last loaded assessments; pending events may be stale.' : ''}</p>}
      {!brokerId && <p className="thesis-notice">MT5 Highlight rows need a connected broker identity. Saved theses and External Source pins remain available.</p>}
      {!data && !error && <p className="thesis-notice" role="status">Loading July assessments…</p>}
      {data && <>
        {data.past.some(row => row.provenance === 'reconstruction') && <p className="thesis-notice">Historical rows marked as reconstructions were researched retrospectively. The seeded July 1–15 table uses a 1:00 PM Jakarta cutoff, not contemporaneously saved calls. Sources and limitations are in each row’s details.</p>}
        <table className="thesis-table" aria-label="Past assessments"><caption>Past assessments <span>Newest first</span></caption><Head scope={scope} /><tbody>
          {data.past.map(row => <PastRow key={row.row_id} row={row} onCopy={copy} />)}
          {!data.past.length && <tr><td colSpan={3} className="thesis-empty">No saved assessments for {scope} in July.</td></tr>}
        </tbody></table>
        <table className="thesis-table" aria-label="Upcoming highlighted events"><caption>Upcoming highlighted events <span>Earliest first · elapsed rows await assessment</span></caption><Head scope={scope} /><tbody>
          {data.pending.map(row => <PendingRow key={row.key} row={row} onCopy={copy} />)}
          {!data.pending.length && <tr><td colSpan={3} className="thesis-empty">No unassessed active Highlights dated in July for {scope}.</td></tr>}
        </tbody></table>
        <p className="thesis-notice">Upcoming rows follow active pins for this pair and month. Unscheduled watches have no assigned month. Release time alone never fills a thesis; invoke the copied prompt to assess and save.</p>
      </>}
    </div>
  </section>
})
