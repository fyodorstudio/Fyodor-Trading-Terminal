import { memo } from 'react'
import { reviewCurrencies, safeThesisLink, type ThesisReview, type ThesisSource } from './thesis-model'

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

export const ThesisCurrencyTable = memo(function ThesisCurrencyTable({ review }: { review?: ThesisReview }) {
  return <div className="thesis-currency-view">
    {review && <p className="thesis-currency-cutoff">As of {clock.format(new Date(review.as_of_utc))} Jakarta
      {review.planning_as_of_utc && review.planning_as_of_utc !== review.as_of_utc && <> · Checkpoints prepared {clock.format(new Date(review.planning_as_of_utc))} Jakarta</>}
    </p>}
    <table className="thesis-currency-table" aria-label="Currency fundamental backdrop">
      <colgroup><col className="currency-name-column" /><col className="currency-backdrop-column" /><col className="currency-counterweight-column" /><col /></colgroup>
      <thead><tr><th scope="col">Currency</th><th scope="col">Current fundamental backdrop</th><th scope="col">Confidence / main counterweight</th><th scope="col">Next material checkpoint</th></tr></thead>
      <tbody>{reviewCurrencies.map(currency => {
        const view = review?.currency_views?.find(item => item.currency === currency)
        const legacy = review?.backdrop.filter(cell => cell.currency === currency).flatMap(cell => cell.evidence) ?? []
        return <tr key={currency} data-thesis-currency={currency}>
          <th scope="row">{currency}</th>
          <td>{view ? <><strong>{view.bias}</strong><p>{view.summary} <Links sources={view.sources} /></p></>
            : legacy.length ? legacy.map((item, index) => <p key={index}>{item.summary} <Links sources={item.sources} /></p>)
              : <span className="thesis-unassessed">Not assessed</span>}</td>
          <td>{view?.counterweight ?? '—'}</td>
          <td>{view?.checkpoints.length ? [...view.checkpoints].sort((a, b) => (a.event_at ?? a.event_date ?? 'z').localeCompare(b.event_at ?? b.event_date ?? 'z')).map((checkpoint, index) => <p key={index}>
            <strong>{checkpoint.title} · {checkpointTime(checkpoint.event_at, checkpoint.event_date)}</strong>
            {checkpoint.note && <> {checkpoint.note}</>} <Links sources={checkpoint.sources} />
          </p>) : '—'}</td>
        </tr>
      })}</tbody>
    </table>
  </div>
})
