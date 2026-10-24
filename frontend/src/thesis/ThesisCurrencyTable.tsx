import { memo } from 'react'
import { currencyNewsHeading, currencyNewsItems, currencyReviewTiming, currencyUpcoming, opportunitySelectionMessage, opportunityWindow, reviewCurrencies, safeThesisLink, sharedOpportunityWindow, type OpportunityEvidence, type ThesisReview, type ThesisSource } from './thesis-model'
import { researchInstruments } from '../external-sources/research-instruments'

const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric' })
function checkpointTime(at: string | null, date: string | null) {
  return at ? `${clock.format(new Date(at))} Jakarta` : date ? `${day.format(new Date(date + 'T05:00:00Z'))} · hour unverified` : 'Unscheduled'
}
function Links({ sources }: { sources: ThesisSource[] }) {
  return <span className="thesis-sources">{sources.map((source, index) => source.kind === 'web' && safeThesisLink(source.locator)
    ? <a key={index} href={source.locator} title={source.note || undefined} target="_blank" rel="noopener noreferrer">{source.label}</a>
    : <span key={index} title={source.locator}>{source.label} (local evidence)</span>)}</span>
}

function Evidence({ evidence }: { evidence?: OpportunityEvidence | null }) {
  return evidence ? <details><summary>Investor incentives &amp; evidence</summary>
    <p>Prior expectation: {evidence.expected_baseline}</p><p>New information / continuing driver: {evidence.new_information}</p>
    <p>Remaining case: {evidence.remaining_case}</p><p>Potential buying / selling ({evidence.flow_basis}): {evidence.flow_channel}</p>
    <p>Horizon: {evidence.horizon}</p><p>Market feedback: {evidence.market_feedback}</p>
    <p>Verified {clock.format(new Date(evidence.verified_utc))} Jakarta. <Links sources={evidence.sources} /></p>
  </details> : null
}

export const ThesisCurrencyTable = memo(function ThesisCurrencyTable({ review, selectedDate }: { review?: ThesisReview; selectedDate: string }) {
  const commonWindow = sharedOpportunityWindow(review?.entry_opportunities)
  return <div className="thesis-currency-view">
    <section className="thesis-currency-opportunities" aria-label="Trade entry opportunity">
      <h3>TRADE ENTRY OPPORTUNITY</h3>
      {review && <p className="thesis-currency-cutoff">{currencyReviewTiming(review)}</p>}
      {review?.entry_opportunities?.length ? <ol>{review.entry_opportunities.map(item => {
        const direction = review.currency_views?.find(view => view.currency === item.currency)?.direction
        return <li key={item.currency} data-thesis-opportunity={item.currency}>
          <strong>{item.currency} · {direction?.verdict}</strong>
          {item.stage && <p>{item.stage === 'active' ? 'Active opportunity' : 'Conditional opportunity'} · {item.activation}</p>}
          <p>{item.summary}</p>
          <p>{!commonWindow && <>{opportunityWindow(item)}. </>}{item.timing_note}</p>
          <p>Reassess if: {item.invalidation}</p>
          {direction && <Links sources={direction.sources} />}
          <Evidence evidence={item.evidence} />
        </li>
      })}</ol> : !review?.commodity_opportunities?.length && <p className="thesis-unassessed">{opportunitySelectionMessage(review)}</p>}
      {!!review?.commodity_opportunities?.length && <><h3>COMMODITY OPPORTUNITIES</h3><ol>{review.commodity_opportunities.map(item => <li key={item.instrument} data-thesis-commodity={item.instrument}>
        <strong>{researchInstruments[item.instrument].label} · {item.verdict}</strong>
        <p>{item.stage === 'active' ? 'Active opportunity' : 'Conditional opportunity'} · {item.activation}</p>
        <p>{item.summary}</p><p>{item.symbol} · {item.provider} · {item.instrument_type.replaceAll('_', ' ')}. {item.contract_note}</p>
        <p>{opportunityWindow(item)}. {item.timing_note}</p><p>Reassess if: {item.invalidation}</p><Evidence evidence={item.evidence} />
        {!!item.checkpoints?.length && <ul>{item.checkpoints.map((checkpoint, index) => <li key={index}>
          Upcoming: {checkpoint.title} · {checkpointTime(checkpoint.event_at, checkpoint.event_date)}. {checkpoint.note} <Links sources={checkpoint.sources} />
        </li>)}</ul>}
      </li>)}</ol></>}
    </section>
    {review && review.format !== 'daily_news' && <p className="thesis-currency-cutoff">Older assessment retained. Fill this date to save factual news summaries.</p>}
    <table className="thesis-currency-table" aria-label="Currency fundamental backdrop">
      <colgroup><col className="currency-name-column" /><col className="currency-backdrop-column" /><col className="currency-source-column" /><col /></colgroup>
      <thead><tr><th scope="col">Currency</th><th scope="col">{currencyNewsHeading(selectedDate)}</th><th scope="col">SOURCE</th><th scope="col">UPCOMING CHECKPOINT</th></tr></thead>
      <tbody>{reviewCurrencies.map(currency => {
        const view = review?.currency_views?.find(item => item.currency === currency)
        const news = currencyNewsItems(review, currency, selectedDate)
        const checkpoints = currencyUpcoming(review, currency)
        return <tr key={currency} data-thesis-currency={currency}>
          <th scope="row">{currency}</th>
          <td>{view?.direction && <div className="thesis-currency-direction">
            <strong>{view.direction.verdict}</strong><p>{view.direction.reason}</p>
          </div>}{news.length ? <ol>{news.map((item, index) => <li key={index}>{item.summary}</li>)}</ol>
            : <span className="thesis-unassessed">{review ? view?.news_gap || 'No same-date news saved.' : 'Not filled'}</span>}
            {news.length > 0 && view?.news_gap && <p className="thesis-unassessed">{view.news_gap}</p>}</td>
          <td>{view?.direction && <p>Daily verdict: <Links sources={view.direction.sources} /></p>}{news.length ? <ol>{news.map((item, index) => <li key={index}><Links sources={item.sources} /></li>)}</ol> : '—'}</td>
          <td>{checkpoints.length ? <ol>{checkpoints.map((checkpoint, index) => <li key={index}>
            <strong>{checkpoint.title} · {checkpointTime(checkpoint.event_at, checkpoint.event_date)}</strong>
            {checkpoint.note && <> {checkpoint.note}</>} <Links sources={checkpoint.sources} />
          </li>)}</ol> : '—'}</td>
        </tr>
      })}</tbody>
    </table>
  </div>
})
