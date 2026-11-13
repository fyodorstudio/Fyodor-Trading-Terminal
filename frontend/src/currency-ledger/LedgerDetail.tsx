import { memo } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { detailValue, type DetailReading } from '../currency-details/detail-model'
import { useLedger } from './useLedger'
import { actualImpact } from '../economic-calendar/presentation/actual-impact'

export const LedgerDetail = memo(function LedgerDetail({ onViewEvent }: { onViewEvent: (reading: DetailReading, currency: string) => void }) {
  const { detailData: data, error, developments, selection, setSelection, at } = useLedger(), clock = useDisplayClock()
  return <div className="ledger-detail">
    <div className="ledger-detail-intro"><strong>Recent developments</strong><span>{selection.at === null ? 'Today' : 'Historical'} · {clock.utc(at)}</span>
      <span>Latest retained readings by category. Click a currency and category for release details.</span></div>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>{error ? 'Saved calendar evidence is preserved.' : 'Loading Ledger…'}</p> : <>
      <div className="ledger-summary">{developments.map(card => <button type="button" key={card.currency} aria-pressed={selection.currency === card.currency}
        onClick={() => setSelection(s => ({ ...s, currency: card.currency }))}><strong>{card.currency}</strong></button>)}</div>
      {developments.some(c => c.backfilled) && <p className="ledger-notice">Backfilled evidence: earliest retained captures are used where an original release vintage is unavailable. Historical imported values may already include revisions.</p>}
      <div className="ledger-categories-scroll"><table className="ledger-categories" aria-label="Currency developments by category"><thead><tr><th>Category</th>{developments.map(card=><th key={card.currency}>{card.currency}</th>)}</tr></thead><tbody>
        {developments[0]?.categories.map((category, index) => {
          return <tr key={category.id}><th><button type="button" aria-expanded={selection.category === category.id}
            onClick={() => setSelection(s => ({ ...s, category: s.category === category.id ? null : category.id }))}>{category.label}</button></th>
            {developments.map(card => { const c = card.categories[index]; return <td key={card.currency} data-ledger-category={`${card.currency}-${c.id}`} data-selected={selection.currency === card.currency}>
              {c.rows.filter(r => r.entry).map(r => <div key={r.metric.id} title={r.metric.definition}><span>{r.metric.id === 'usd.rate' ? 'Fed upper bound' : r.metric.label}</span><b>{detailValue(r.previous,r.metric.unit)} → <span data-mt5-impact={actualImpact(r.entry!.value,r.entry!.impact)}>{detailValue(r.entry!.value,r.metric.unit)}</span></b>
                <small>{r.direction === null ? 'Previous unavailable' : r.direction === 0 ? 'Unchanged' : r.direction > 0 ? 'Increased' : 'Decreased'} · {r.entry!.day}{r.selected?.backfilled ? ' · backfilled' : ''}</small></div>)}
              {!c.rows.some(r => r.entry) && <small>No retained reading by cutoff</small>}
            </td> })}</tr>
        })}
      </tbody></table></div>
      {developments.filter(c => c.currency === selection.currency).flatMap(card => card.categories.filter(c => !selection.category || c.id === selection.category).map(category => <section className="ledger-evidence" key={category.id}>
        <h3>{card.currency} · {category.label}</h3>
        {category.rows.map(row => <article key={row.metric.id} data-ledger-metric={row.metric.id}>
          <strong>{row.metric.id === 'usd.rate' ? 'Fed target upper bound' : row.metric.label}</strong><span>{row.entry ? <>{detailValue(row.previous,row.metric.unit)} → <span data-mt5-impact={actualImpact(row.entry.value,row.entry.impact)}>{detailValue(row.entry.value,row.metric.unit)}</span></> : row.change}</span>
          {row.entry ? <><small>Reference: {row.entry.period ?? 'Not supplied'} · Released: {row.entry.at === null ? `${row.entry.day} · hour unavailable` : clock.utc(row.entry.at)}</small>
            <small>Retained capture: {clock.utc(row.entry.known_at)}{row.selected?.backfilled ? ' · backfilled at this cutoff' : ''}</small>
            <small>Release consensus: {detailValue(row.entry.forecast, row.metric.unit)} · {row.entry.revised_previous === null ? 'Previous' : 'Revised previous'}: {detailValue(row.previous, row.metric.unit)}</small>
            <button type="button" onClick={() => onViewEvent(row.entry!,card.currency)}>Open release in Inspector</button></> : <small>No reading available by this cutoff.</small>}
          <a href={row.metric.source_url} target="_blank" rel="noreferrer">Original publisher</a>
        </article>)}
      </section>))}
      <details className="ledger-history-notes"><summary>About reading history</summary>
        <p>Each measure keeps its latest available reference period until a newer period is released. Previous uses the captured revised previous value when available. Changes describe the reading, with no currency ranking or directional assessment.</p>
        <p>Date selection uses day end in Jakarta; Today uses the current time. Date-only readings enter at day end. Earliest retained captures may already include revisions; later captured corrections apply only from their capture time.</p>
      </details>
    </>}
  </div>
})
