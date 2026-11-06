import { memo } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { detailValue, type DetailReading } from '../currency-details/detail-model'
import { useLedger } from './useLedger'
import { actualImpact } from '../economic-calendar/presentation/actual-impact'

export const LedgerDetail = memo(function LedgerDetail({ onViewEvent }: { onViewEvent: (reading: DetailReading, currency: string) => void }) {
  const { scoreData: data, error, cards, selection, setSelection, at } = useLedger(), clock = useDisplayClock()
  const score = (n: number | null) => n === null ? 'Unassessed' : `${Math.round(n)}/100`
  return <div className="ledger-detail">
    <div className="ledger-detail-intro"><strong>Fundamental scorecard</strong><span>{selection.at === null ? 'Today' : 'Historical'} · {clock.utc(at)}</span>
      <span>Each currency versus its own previous reading. Click a category for the evidence.</span></div>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>{error ? 'Saved calendar evidence is preserved.' : 'Loading Ledger…'}</p> : <>
      <div className="ledger-summary">{cards.map(card => <button type="button" key={card.currency} aria-pressed={selection.currency === card.currency}
        onClick={() => setSelection(s => ({ ...s, currency: card.currency }))}><strong>{card.currency} · {score(card.score)}</strong><span>Momentum · {card.assessed}/4 scored categories</span></button>)}</div>
      {cards.some(c => c.backfilled) && <p className="ledger-notice">Backfilled evidence: earliest retained captures are used where an original release vintage is unavailable. Historical imported values may already include revisions.</p>}
      <div className="ledger-scorecard-scroll"><table className="ledger-scorecard" aria-label="Ledger category comparison"><thead><tr><th>Category</th>{cards.map(card=><th key={card.currency}>{card.currency}</th>)}</tr></thead><tbody>
        {cards[0]?.categories.map((category, index) => {
          const first = cards[0].categories[index], second = cards[1]?.categories[index]
          const advantage = first.score === null || !second || second.score === null ? 'Unassessed' : Math.abs(first.score - second.score) < .001 ? 'Balanced' : first.score > second.score ? cards[0].currency : cards[1].currency
          return <tr key={category.id}><th><button type="button" aria-expanded={selection.category === category.id}
            onClick={() => setSelection(s => ({ ...s, category: s.category === category.id ? null : category.id }))}>{category.label}</button><small>{category.id === 'inflation' ? 'Pressure · context only' : `Momentum advantage: ${advantage}`}</small></th>
            {cards.map(card => { const c = card.categories[index]; return <td key={card.currency} data-ledger-category={`${card.currency}-${c.id}`} data-selected={selection.currency === card.currency}>
              <strong>{c.id === 'inflation' ? 'Context only' : score(c.score)}</strong>
              {c.rows.filter(r => r.entry).map(r => <div key={r.metric.id} title={r.metric.definition}><span>{r.metric.id === 'usd.rate' ? 'Fed upper bound' : r.metric.label}</span><b>{detailValue(r.previous,r.metric.unit)} → <span data-mt5-impact={actualImpact(r.entry!.value,r.entry!.impact)}>{detailValue(r.entry!.value,r.metric.unit)}</span></b>
                <small>{r.direction === null ? 'Previous unavailable' : r.direction === 0 ? 'Unchanged' : c.id === 'inflation' ? r.direction > 0 ? 'Heating' : 'Cooling' : r.direction > 0 ? 'Increased' : 'Decreased'} · {r.entry!.day}{r.selected?.backfilled ? ' · backfilled' : ''}</small></div>)}
              {!c.rows.some(r => r.entry) && <small>No retained reading by cutoff</small>}
              {c.id !== 'inflation' && <small>Coverage {c.assessed}/{c.expected} scoring measures</small>}
            </td> })}</tr>
        })}
      </tbody></table></div>
      {cards.filter(c => c.currency === selection.currency).flatMap(card => card.categories.filter(c => !selection.category || c.id === selection.category).map(category => <section className="ledger-evidence" key={category.id}>
        <h3>{card.currency} · {category.label} <span>{category.id === 'inflation' ? 'Context only' : score(category.score)}</span></h3>
        {category.rows.map(row => <article key={row.metric.id} data-ledger-metric={row.metric.id}>
          <strong>{row.metric.id === 'usd.rate' ? 'Fed target upper bound' : row.metric.label}</strong><span>{row.entry ? <>{detailValue(row.previous,row.metric.unit)} → <span data-mt5-impact={actualImpact(row.entry.value,row.entry.impact)}>{detailValue(row.entry.value,row.metric.unit)}</span></> : row.change}</span>
          {row.entry ? <><small>Reference: {row.entry.period ?? 'Not supplied'} · Released: {row.entry.at === null ? `${row.entry.day} · hour unavailable` : clock.utc(row.entry.at)}</small>
            <small>Retained capture: {clock.utc(row.entry.known_at)}{row.selected?.backfilled ? ' · backfilled at this cutoff' : ''}</small>
            <small>Release consensus: {detailValue(row.entry.forecast, row.metric.unit)} · {row.entry.revised_previous === null ? 'Previous' : 'Revised previous'}: {detailValue(row.previous, row.metric.unit)}</small>
            <small>{row.score === null ? 'Context only / comparison unavailable' : `Contribution: ${Math.round(row.score)}/100 within category`}</small>
            <button type="button" onClick={() => onViewEvent(row.entry!,card.currency)}>Open release in Inspector</button></> : <small>No reading available by this cutoff.</small>}
          <a href={row.metric.source_url} target="_blank" rel="noreferrer">Original publisher</a>
        </article>)}
      </section>))}
      <details className="ledger-rules"><summary>Scoring rules · v1 (provisional)</summary>
        <p>Momentum measures change, not economic health or a probability of currency appreciation. Each scoring measure gets 100 for a favorable change, 50 for no change, and 0 for an unfavorable change versus its own captured previous reading. Lower unemployment is favorable; higher rates, employment change, quarterly GDP growth and retail growth are favorable under this simple proxy. Magnitudes and consensus surprises do not affect points.</p>
        <p>Average the available measures within each category, then give the four scored categories equal weight. Missing readings or previous values are excluded and coverage stays visible. Each country keeps its own quarterly GDP and retail/spending definition; these are directional comparisons, not comparable growth levels. Inflation, wages, monthly GDP, PMIs and other captured calendar series are context only. Inflation requires a policy/regime interpretation before assigning currency support.</p>
        <p>A new release replaces its measure’s contribution. Offscreen readings stay active. Date selection uses 11:59 PM Jakarta; event selection uses the event clock. Date-only readings enter at day end. History uses the earliest retained actual, which may already contain revisions. Later captured corrections apply only from their capture time. Imported history does not prove the publisher’s original release vintage.</p>
      </details>
    </>}
  </div>
})
