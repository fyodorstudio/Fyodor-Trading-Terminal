import { memo } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { detailValue, type DetailReading, type DetailSnapshot } from './detail-model'

const sections = ['Inflation', 'Employment', 'Wages & compensation', 'Demand', 'Growth']

export const PolicyDecisionTable = memo(function PolicyDecisionTable({ data, onViewEvent }: {
  data: DetailSnapshot; onViewEvent: (reading: DetailReading) => void
}) {
  const clock = useDisplayClock()
  const history = data.policy_history
  if (!history) return <p>Decision history unavailable. Reload Detail after updating the local storage service.</p>
  const count = Math.max(1, ...data.currencies.map(currency => history.decisions[currency].length))
  return <>
    <div className="detail-history-intro">
      <strong>Rate decision history · 6 months</strong>
      <span>{history.from_date} – {history.through_date} · Older decisions to the right →</span>
      <span>Each currency has its own decision date. Rows below belong to that decision.</span>
      <span>Rate decisions populated; historical economic data not yet populated.</span>
    </div>
    <div className="detail-history-scroll" role="region" aria-label="Rate decision history, scroll right for older decisions" tabIndex={0}>
      <table className="detail-decision-table" aria-label="USD CAD fundamentals by rate decision" style={{ width: 188 + count * 246 }}>
        <colgroup><col className="detail-category-column" /><col className="detail-currency-column" />
          {Array.from({ length: count }, (_, i) => <col key={i} className="detail-decision-column" />)}</colgroup>
        <thead><tr><th className="detail-sticky-category" scope="col">Fundamentals</th><th className="detail-sticky-currency" scope="col">CUR</th>
          {Array.from({ length: count }, (_, i) => <th key={i} scope="col">{i === 0 ? 'Latest decision' : i === 1 ? 'Previous decision' : `${i} decisions earlier`}</th>)}</tr></thead>
        <tbody>{data.currencies.map((currency, row) => <tr key={currency}>
          {row === 0 && <th className="detail-sticky-category" rowSpan={data.currencies.length} scope="rowgroup">Interest rate</th>}
          <th className="detail-sticky-currency" scope="row">{currency}</th>
          {Array.from({ length: count }, (_, i) => {
            const decision = history.decisions[currency][i]
            const decisionDay = decision ? decision.at === null ? decision.date : clock.date(decision.at) : ''
            return <td key={i} data-policy-decision={decision?.value_id}>
              {decision ? <>
                <button type="button" className="detail-event-link detail-decision-date" onClick={() => onViewEvent(decision)}
                  aria-label={`Open ${currency} rate decision ${decisionDay}`}>
                  <time dateTime={decision.at === null ? decision.date : new Date(decision.at).toISOString()}
                    title={decision.at === null ? 'Publication date; hour unavailable' : clock.zone}>
                    {decision.at === null ? decision.date : clock.utc(decision.at)}
                  </time>
                </button>
                <span className="detail-policy-name">{currency === 'USD' ? 'Fed target upper bound' : 'BoC overnight target'}</span>
                <div className="detail-decision-values">
                  <div><span>Actual</span><strong>{detailValue(decision.value, '%')}</strong></div>
                  <div><span title="Captured consensus for this decision, not the next release. Missing forecasts stay blank.">Forecast</span><span>{detailValue(decision.forecast, '%')}</span></div>
                  <div><span>Previous</span><span title={decision.revised_previous !== null ? 'Revised previous reading' : 'Previous reading'}>{detailValue(decision.revised_previous ?? decision.previous, '%')}</span></div>
                </div>
                <a className="detail-decision-source" href={decision.source_url} target="_blank" rel="noreferrer">{currency === 'USD' ? 'FOMC statement' : 'BoC decision'}</a>
              </> : <span className="detail-history-empty">No captured decision</span>}
            </td>
          })}
        </tr>)}</tbody>
        {sections.map(section => <tbody key={section}>{data.currencies.map((currency, row) => <tr key={currency}>
          {row === 0 && <th className="detail-sticky-category" rowSpan={data.currencies.length} scope="rowgroup">{section}</th>}
          <th className="detail-sticky-currency" scope="row">{currency}</th>
          {Array.from({ length: count }, (_, i) => <td key={i} className="detail-history-placeholder"
            aria-label={`${currency} ${section}, decision ${i + 1}: not populated`}>—</td>)}
        </tr>)}</tbody>)}
      </table>
    </div>
    <div className="detail-history-legend">Forecast = captured consensus for that decision · — = unavailable</div>
  </>
})
