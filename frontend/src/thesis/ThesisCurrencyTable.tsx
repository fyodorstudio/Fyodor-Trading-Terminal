import { memo } from 'react'
import { currencyNewsHeading, currencyNewsItems, currencyUpcoming, reviewCurrencies, safeThesisLink, type ThesisReview, type ThesisSource } from './thesis-model'

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

export const ThesisCurrencyTable = memo(function ThesisCurrencyTable({ review, selectedDate }: { review?: ThesisReview; selectedDate: string }) {
  return <div className="thesis-currency-view">
    {review && <p className="thesis-currency-cutoff">As of {clock.format(new Date(review.as_of_utc))} Jakarta
      {review.planning_as_of_utc && review.planning_as_of_utc !== review.as_of_utc && <> · Checkpoints prepared {clock.format(new Date(review.planning_as_of_utc))} Jakarta</>}
    </p>}
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
          <td>{news.length ? <ol>{news.map((item, index) => <li key={index}>{item.summary}</li>)}</ol>
            : <span className="thesis-unassessed">{review ? view?.news_gap || 'No same-date news saved.' : 'Not filled'}</span>}
            {news.length > 0 && view?.news_gap && <p className="thesis-unassessed">{view.news_gap}</p>}</td>
          <td>{news.length ? <ol>{news.map((item, index) => <li key={index}><Links sources={item.sources} /></li>)}</ol> : '—'}</td>
          <td>{checkpoints.length ? <ol>{checkpoints.map((checkpoint, index) => <li key={index}>
            <strong>{checkpoint.title} · {checkpointTime(checkpoint.event_at, checkpoint.event_date)}</strong>
            {checkpoint.note && <> {checkpoint.note}</>} <Links sources={checkpoint.sources} />
          </li>)}</ol> : '—'}</td>
        </tr>
      })}</tbody>
    </table>
  </div>
})
