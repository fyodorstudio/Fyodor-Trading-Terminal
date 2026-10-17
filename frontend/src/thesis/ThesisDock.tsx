import { memo, useCallback, useState } from 'react'
import { majorForexPairs } from '../economic-calendar/forex/pairs'
import { readThesisMonth, readThesisPair, safeThesisLink, thesisMonths, thesisPrompt, type ThesisEntry, type ThesisRow } from './thesis-model'
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
const PastRow = memo(function PastRow({ row, onCopy }: { row: ThesisRow; onCopy: (row: ThesisRow) => void }) {
  const tone = row.verdict.includes('BUY') ? 'buy' : row.verdict.includes('SELL') ? 'sell' : 'mixed'
  return <tr data-thesis-row={row.row_id}>
    <td><strong>{dayLabel(row.as_of_utc)}</strong><small>{row.as_of_precision === 'date' ? 'Publication hour unverified' : `${timeFormatter.format(new Date(row.as_of_utc))} · ${row.provenance === 'reconstruction' ? 'information cutoff' : 'assessment'}`}</small><span className="thesis-event-title">{row.title}</span>
      {row.target && <small>{row.target.event_at ? `Release: ${fullFormatter.format(new Date(row.target.event_at))}` : `Release date: ${row.target.event_date} · hour unconfirmed`}</small>}</td>
    <td className={`thesis-verdict ${tone}`}>{row.verdict}</td>
    <td className="thesis-change"><strong>{row.change ?? '—'}</strong>
      {row.comparison && <small>vs {row.comparison.verdict} · {dayLabel(row.comparison.as_of_utc)}</small>}
      {row.change_reason && <p>{row.change_reason}</p>}
    </td>
    <td><p className="thesis-prose">{row.thesis} <Sources entry={row} /></p>
      <details className="thesis-details"><summary>Details · {row.versions.length} {row.versions.length === 1 ? 'version' : 'versions'}</summary>
        <p>As of {row.as_of_precision === 'date' ? `${dayLabel(row.as_of_utc)} · date-only evidence; see cutoff note` : `${fullFormatter.format(new Date(row.as_of_utc))} Jakarta`} · {row.horizon}. Saved {fullFormatter.format(new Date(row.saved_utc))} Jakarta.</p>
        <p>{row.provenance === 'reconstruction' ? 'Retrospective reconstruction. ' : ''}{row.note}</p>
        {row.target && <p>{row.target.kind === 'highlight' ? `Highlight ${row.target.reference} · ${row.target.source_id}` : `External Source ${row.target.reference}`}</p>}
        {row.journal_id && <p>Detailed Highlight research: {row.journal_id}</p>}
        {row.versions.length > 1 && <ol aria-label="Previous thesis versions">{row.versions.slice(0, -1).reverse().map(version => <li key={version.id}>
          <strong>{version.verdict}</strong> · as of {fullFormatter.format(new Date(version.as_of_utc))} · saved {fullFormatter.format(new Date(version.saved_utc))}
          {version.change && <p>{version.change}: {version.change_reason}</p>}
          <p className="thesis-prose">{version.thesis} <Sources entry={version} /></p>{version.note && <p>{version.note}</p>}
        </li>)}</ol>}
        <button type="button" onClick={() => onCopy(row)}>Copy reassessment prompt</button>
      </details>
    </td>
  </tr>
})
function Head({ scope }: { scope: string }) {
  return <><colgroup><col className="thesis-date-column" /><col className="thesis-verdict-column" /><col className="thesis-change-column" /><col /></colgroup>
    <thead><tr><th scope="col">Date / Time</th><th scope="col">Pair bias · {scope}</th><th scope="col">Thesis change</th><th scope="col">Explanation</th></tr></thead></>
}

export const ThesisDock = memo(function ThesisDock() {
  const [scope, setScope] = useState(readThesisPair)
  const [month, setMonth] = useState(readThesisMonth)
  const [copyStatus, setCopyStatus] = useState('')
  const { data, error, refresh } = useTheses(scope, month)
  // Clipboard completion must not show a status for a pair that has since changed.
  const context = `${scope}:${month}`
  const [copyContext, setCopyContext] = useState(context)
  const copy = useCallback(async (row?: ThesisRow) => {
    try { await navigator.clipboard.writeText(thesisPrompt(scope, month, row)); setCopyContext(context); setCopyStatus('Prompt copied') }
    catch { setCopyContext(context); setCopyStatus('Could not copy prompt. Allow clipboard access and retry.') }
  }, [scope, month, context])
  return <section className="thesis-dock" aria-label="Thesis">
    <header className="thesis-header"><h2>Thesis</h2>
      <label>Pair <select aria-label="Thesis pair" value={scope} onChange={event => {
        setScope(event.target.value); setCopyStatus(''); try { localStorage.setItem('fyodor.thesis.pair.v1', event.target.value) } catch { /* Retain session choice. */ }
      }}>{majorForexPairs.map(pair => <option key={pair}>{pair}</option>)}</select></label>
      <label>Month <select aria-label="Thesis month" value={month} onChange={event => {
        setMonth(event.target.value); setCopyStatus(''); try { localStorage.setItem('fyodor.thesis.month.v1', event.target.value) } catch { /* Retain session choice. */ }
      }}>{thesisMonths.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <span className="thesis-timezone">Jakarta · AM/PM</span>
      <button type="button" onClick={() => { void copy() }}>Copy assessment prompt</button><button type="button" onClick={refresh}>Refresh</button>
      <span className="thesis-copy-status" role="status">{copyContext === context ? copyStatus : ''}</span>
    </header>
    <div className="thesis-scroll" tabIndex={0} aria-label="Monthly thesis assessments">
      {error && <p className="thesis-notice" role="alert">{error}{data ? ' Showing last loaded assessments.' : ''}</p>}
      {!data && !error && <p className="thesis-notice" role="status">Loading assessments…</p>}
      {data && <>
        <table className="thesis-table" aria-label="Past assessments"><Head scope={scope} /><tbody>
          {data.past.map(row => <PastRow key={row.row_id} row={row} onCopy={copy} />)}
          {!data.past.length && <tr><td colSpan={4} className="thesis-empty">No saved assessments for {scope} in {thesisMonths.find(item => item.value === month)?.label}.</td></tr>}
        </tbody></table>
      </>}
    </div>
  </section>
})
