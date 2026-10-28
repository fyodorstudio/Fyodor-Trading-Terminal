import { memo, useCallback, useState } from 'react'
import { majorForexPairs } from '../economic-calendar/forex/pairs'
import { readThesisAcross, readThesisDay, readThesisMonth, readThesisPair, safeThesisLink, thesisDateGroups, thesisDays, thesisMonths, thesisPrompt, type ThesisEntry, type ThesisPlannedDay, type ThesisReview, type ThesisRow } from './thesis-model'
import { useTheses } from './useTheses'
import { downloadThesisMarkdown } from './thesis-export'
import { ThesisBackdrop } from './ThesisBackdrop'
import { ThesisCurrencyTable } from './ThesisCurrencyTable'
import { useCurrencyResearch } from './useCurrencyResearch'
import { researchPrompt } from './research-prompt'
import { downloadResearchMarkdown } from './research-export'
import { LegacyResearchArchive } from './LegacyResearchArchive'
import './thesis.css'

const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', weekday: 'short' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
const fullFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
function dayLabel(value: string) {
  const parts = dayFormatter.formatToParts(new Date(value.length === 10 ? value + 'T05:00:00Z' : value))
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('month')} ${part('day')}, ${part('weekday')}`
}
function Sources({ entry }: { entry: Pick<ThesisEntry, 'sources'> }) {
  return <span className="thesis-sources">{entry.sources.map((source, index) => source.kind === 'web' && safeThesisLink(source.locator)
    ? <a key={index} href={source.locator} target="_blank" rel="noopener noreferrer" title={source.note || undefined}>{source.label}</a>
    : <span key={index} title={source.locator}>{source.label} (local evidence)</span>)}</span>
}
const PastRow = memo(function PastRow({ row, onCopy, dateSpan = 1, across = false }: { row: ThesisRow; onCopy: (row: ThesisRow) => void; dateSpan?: number; across?: boolean }) {
  const tone = row.verdict.includes('BUY') ? 'buy' : row.verdict.includes('SELL') ? 'sell' : 'mixed'
  return <tr data-thesis-row={row.row_id}>
    {dateSpan > 0 && <td rowSpan={dateSpan}><strong>{dayLabel(row.as_of_utc)}</strong>{across ? <small>{dateSpan} {dateSpan === 1 ? 'opportunity' : 'opportunities'}</small> : <><small>{row.as_of_precision === 'date' ? 'Publication hour unverified' : `${timeFormatter.format(new Date(row.as_of_utc))} · ${row.provenance === 'reconstruction' ? 'information cutoff' : 'assessment'}`}</small><span className="thesis-event-title">{row.title}</span></>}
      {!across && row.target && <small>{row.target.event_at ? `Release: ${fullFormatter.format(new Date(row.target.event_at))}` : `Release date: ${row.target.event_date} · hour unconfirmed`}</small>}</td>}
    <td className={`thesis-verdict ${tone}`}>{across && <strong className="thesis-opportunity-pair">{row.scope}</strong>}{row.verdict}{across && <><small>{row.as_of_precision === 'date' ? 'Publication hour unverified' : timeFormatter.format(new Date(row.as_of_utc))}</small><small>{row.title}</small></>}</td>
    <td className="thesis-change"><strong>{row.change ?? '—'}</strong>
      {row.comparison && <small>vs {row.comparison.verdict} · {dayLabel(row.comparison.as_of_utc)}</small>}
      {row.change_reason && <p>{row.change_reason}</p>}
    </td>
    <td><p className="thesis-prose">{row.thesis} <Sources entry={across ? { sources: row.sources.slice(0, 2) } : row} /></p>
      <details className="thesis-details"><summary>Details · {row.versions.length} {row.versions.length === 1 ? 'version' : 'versions'}</summary>
        <p>As of {row.as_of_precision === 'date' ? `${dayLabel(row.as_of_utc)} · date-only evidence; see cutoff note` : `${fullFormatter.format(new Date(row.as_of_utc))} Jakarta`} · {row.horizon}. Saved {fullFormatter.format(new Date(row.saved_utc))} Jakarta.</p>
        <p>{row.provenance === 'reconstruction' ? 'Retrospective reconstruction. ' : ''}{row.note}</p>
        {across && <p><Sources entry={row} /></p>}
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
const PlannedRow = memo(function PlannedRow({ day }: { day: ThesisPlannedDay }) {
  return <tr data-thesis-plan={day.date}>
    <td><strong>{dayLabel(day.date)}</strong></td><td /><td />
    <td>{day.events.map((event, index) => <p className="thesis-scheduled" key={index}>
      {event.title} is scheduled for {event.at ? `${fullFormatter.format(new Date(event.at))} Jakarta` : `${dayLabel(day.date)}, 2026 · time unverified`}.
      {event.note && <> {event.note}</>} <Sources entry={event} />
    </p>)}</td>
  </tr>
})
function Head({ scope }: { scope: string }) {
  return <><colgroup><col className="thesis-date-column" /><col className="thesis-verdict-column" /><col className="thesis-change-column" /><col /></colgroup>
    <thead><tr><th scope="col">Date / Time</th><th scope="col">{scope === 'ALL' ? 'Opportunity / Bias' : `Pair bias · ${scope}`}</th><th scope="col">Thesis change</th><th scope="col">Explanation</th></tr></thead></>
}

const AssessmentTable = memo(function AssessmentTable({ rows, scope, onCopy }: { rows: ThesisRow[]; scope: string; onCopy: (row: ThesisRow) => void }) {
  return <table className="thesis-table" aria-label="Past assessments"><Head scope={scope} /><tbody>
    {scope === 'ALL' ? thesisDateGroups(rows).flatMap(([, group]) => group.map((row, index) => <PastRow key={row.row_id} row={row} onCopy={onCopy} across dateSpan={index === 0 ? group.length : 0} />))
      : rows.map(row => <PastRow key={row.row_id} row={row} onCopy={onCopy} />)}
  </tbody></table>
})

const ReviewBlock = memo(function ReviewBlock({ review, onCopy }: { review: ThesisReview; onCopy: (row: ThesisRow) => void }) {
  const across = review.scope === 'ALL'
  const entries = review.opportunities.filter(row => row.verdict !== 'MIXED')
  const conditional = review.opportunities.filter(row => row.verdict === 'MIXED')
  const pairs = [...new Set(review.opportunities.map(row => row.scope))]
  function table(rows: ThesisRow[], label: string) {
    return <table className="thesis-table" aria-label={label}><Head scope={review.scope} /><tbody>
      {rows.map((row, index) => <PastRow key={row.id} row={row} onCopy={onCopy} across={across} dateSpan={across ? index === 0 ? rows.length : 0 : 1} />)}
    </tbody></table>
  }
  return <section className="thesis-review" data-thesis-review={review.id} aria-label={`Review ${fullFormatter.format(new Date(review.as_of_utc))}`}>
    <div className="thesis-review-takeaway"><strong>{fullFormatter.format(new Date(review.as_of_utc))} Jakarta</strong><p>{review.takeaway}</p></div>
    {entries.length ? table(entries, 'Entry opportunities') : <p className="thesis-notice">No directional entry opportunity selected in this review.</p>}
    {!!conditional.length && <details className="thesis-conditional"><summary>Conditional / weakened cases · {conditional.length}</summary>{table(conditional, 'Conditional opportunities')}</details>}
    <ThesisBackdrop review={review} pairs={pairs} />
    <details className="thesis-details"><summary>Review details · {review.versions.length} {review.versions.length === 1 ? 'version' : 'versions'}</summary>
      <p>Research as of {fullFormatter.format(new Date(review.as_of_utc))} Jakarta · {review.horizon}. Saved {fullFormatter.format(new Date(review.saved_utc))} Jakarta.</p>
      <p>{review.provenance === 'reconstruction' ? 'Retrospective reconstruction. ' : ''}{review.note}</p>
      {review.versions.slice(0, -1).reverse().map(version => <div key={version.id}><p>Earlier version: {version.takeaway} · saved {fullFormatter.format(new Date(version.saved_utc))} Jakarta.</p><ThesisBackdrop review={version} pairs={pairs} /></div>)}
    </details>
  </section>
})

export const ThesisDock = memo(function ThesisDock() {
  const [pair, setPair] = useState(readThesisPair)
  const [across, setAcross] = useState(readThesisAcross)
  const scope = across ? 'ALL' : pair
  const [month, setMonth] = useState(readThesisMonth)
  const [day, setDay] = useState(() => readThesisDay(month))
  const selectedDate = `${month}-${String(day).padStart(2, '0')}`
  const [range, setRange] = useState(false)
  const [from, setFrom] = useState(selectedDate)
  const [to, setTo] = useState(selectedDate)
  const rangeFrom = range ? from : selectedDate, rangeTo = range ? to : selectedDate
  const [copyStatus, setCopyStatus] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const { data, error } = useTheses(scope, month, !across)
  const research = useCurrencyResearch(rangeFrom, rangeTo, across)
  const documented = new Set(data?.reviews?.flatMap(review => review.opportunity_ids) ?? [])
  const remaining = data?.past.filter(row => !documented.has(row.id)) ?? []
  // Clipboard completion must not show a status for a pair that has since changed.
  const context = `${scope}:${month}:${across ? rangeFrom+':'+rangeTo : ''}`
  const [copyContext, setCopyContext] = useState(context)
  const copy = useCallback(async (row?: ThesisRow) => {
    try { await navigator.clipboard.writeText(across ? researchPrompt(rangeFrom, rangeTo) : thesisPrompt(scope, month, row)); setCopyContext(context); setCopyStatus('Prompt copied') }
    catch { setCopyContext(context); setCopyStatus('Could not copy prompt. Allow clipboard access and retry.') }
  }, [scope, month, context, across, rangeFrom, rangeTo])
  return <section className="thesis-dock" aria-label="Thesis">
    <header className="thesis-header"><h2>Thesis</h2>
      <button type="button" aria-pressed={across} onClick={() => {
        setAcross(!across); setCopyStatus(''); try { localStorage.setItem('fyodor.thesis.across.v1', String(!across)) } catch { /* Retain session choice. */ }
      }}>Across All Currency</button>
      {!across && <label>Pair <select aria-label="Thesis pair" value={pair} onChange={event => {
        setPair(event.target.value); setCopyStatus(''); try { localStorage.setItem('fyodor.thesis.pair.v1', event.target.value) } catch { /* Retain session choice. */ }
      }}>{majorForexPairs.map(pair => <option key={pair}>{pair}</option>)}</select></label>}
      {(!across || !range) && <label>Month <select aria-label="Thesis month" value={month} onChange={event => {
        const value = event.target.value
        setMonth(value); setDay(previous => Math.min(previous, thesisDays(value))); setCopyStatus(''); try { localStorage.setItem('fyodor.thesis.month.v1', value) } catch { /* Retain session choice. */ }
      }}>{thesisMonths.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
      {across && !range && <label>Day <select aria-label="Thesis day" value={day} onChange={event => {
        const value = Number(event.target.value); setDay(value); setCopyStatus(''); try { localStorage.setItem('fyodor.thesis.day.v1', String(value)) } catch { /* Retain session choice. */ }
      }}>{Array.from({ length: thesisDays(month) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>}
      {across && <><label><input type="checkbox" checked={range} aria-label="Thesis date range" onChange={event => {
        setRange(event.target.checked); if (event.target.checked) { setFrom(selectedDate); setTo(selectedDate) } setCopyStatus('')
      }} />Date range</label>{range && <>
        <label>From <input type="date" aria-label="Thesis from" value={from} onChange={event => { if (!event.target.value) return; setFrom(event.target.value); if (event.target.value > to) setTo(event.target.value); setCopyStatus('') }} /></label>
        <label>To <input type="date" aria-label="Thesis to" value={to} onChange={event => { if (!event.target.value) return; setTo(event.target.value); if (event.target.value < from) setFrom(event.target.value); setCopyStatus('') }} /></label>
      </>}</>}
      <span className="thesis-timezone">Jakarta · AM/PM</span>
      <button type="button" onClick={() => { void copy() }}>{across ? 'Copy research prompt' : 'Copy assessment prompt'}</button>
      <button type="button" disabled={across ? !research.data : !data} onClick={() => {
        if (across) { if (!research.data) return; setCopyContext(context); try { downloadResearchMarkdown(research.data,research.error); setCopyStatus('Markdown download requested') } catch { setCopyStatus('Could not export Markdown. Try again.') } return }
        if (!data) return
        setCopyContext(context)
        try { downloadThesisMarkdown(data, error, across ? selectedDate : undefined); setCopyStatus('Markdown download requested') }
        catch { setCopyStatus('Could not export Markdown. Try again.') }
      }}>Export Markdown</button>
      <span className="thesis-copy-status" role="status">{copyContext === context ? copyStatus : ''}</span>
    </header>
    <div className="thesis-scroll" tabIndex={0} aria-label="Monthly thesis assessments">
      {(across ? research.error : error) && <p className="thesis-notice" role="alert">{across ? research.error : error}{(across ? research.data : data) ? ' Showing last loaded assessments.' : ''}</p>}
      {across && research.data && <ThesisCurrencyTable data={research.data} />}
      {across && <details className="thesis-details" onToggle={event => setArchiveOpen(event.currentTarget.open)}><summary>Earlier daily snapshots and opportunity records</summary>{archiveOpen && <LegacyResearchArchive />}</details>}
      {!(across ? research.data : data) && !(across ? research.error : error) && <p className="thesis-notice" role="status">Loading assessments…</p>}
      {data && <>
        {data.reviews?.length ? [
          ...data.reviews.map(review => ({ at: review.as_of_utc, key: review.review_id, node: <ReviewBlock review={review} onCopy={copy} /> })),
          ...thesisDateGroups(remaining).map(([date, rows]) => ({ at: rows[0].as_of_utc, key: date, node: <AssessmentTable rows={rows} scope={scope} onCopy={copy} /> })),
        ].sort((a, b) => b.at.localeCompare(a.at)).map(block => <div key={block.key}>{block.node}</div>)
          : data.past.length ? <AssessmentTable rows={remaining} scope={scope} onCopy={copy} />
            : <table className="thesis-table" aria-label="Past assessments"><Head scope={scope} /><tbody><tr><td colSpan={4} className="thesis-empty">No saved assessments for {across ? 'Across All Currency' : scope} in {thesisMonths.find(item => item.value === month)?.label}.</td></tr></tbody></table>}
        {!across && !!data.planned?.length && <table className="thesis-table" aria-label="Unassessed dates"><Head scope={scope} /><tbody>
          {data.planned.map(day => <PlannedRow key={day.date} day={day} />)}
        </tbody></table>}
      </>}
    </div>
  </section>
})
