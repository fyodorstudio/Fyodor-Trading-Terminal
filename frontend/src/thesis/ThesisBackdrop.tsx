import { memo, useState } from 'react'
import { backdropCategories, reviewCurrencies, safeThesisLink, thesisDay, type ThesisReviewEntry } from './thesis-model'

const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric' })

export const ThesisBackdrop = memo(function ThesisBackdrop({ review, pairs }: { review: ThesisReviewEntry; pairs: string[] }) {
  const [selection, setSelection] = useState(pairs[0] ?? (review.scope === 'ALL' ? 'ALL' : review.scope))
  const currencies = selection === 'ALL' ? reviewCurrencies.filter(currency => review.backdrop.some(cell => cell.currency === currency)) : [selection.slice(0, 3), selection.slice(3)]
  return <details className="thesis-backdrop" data-review-backdrop={review.id}>
    <summary>Fundamental backdrop · Sources</summary>
    <label>Show currencies <select aria-label="Backdrop currencies" value={selection} onChange={event => setSelection(event.target.value)}>
      {[...new Set([...pairs, ...(review.scope !== 'ALL' ? [review.scope] : [])])].map(pair => <option key={pair}>{pair}</option>)}
      <option value="ALL">All reviewed currencies</option>
    </select></label>
    <div className="thesis-backdrop-scroll"><table aria-label="Fundamental backdrop — recent and prior" className="thesis-backdrop-table">
      <thead><tr><th scope="col">Category</th>{currencies.map(currency => <th scope="col" key={currency}>{currency}</th>)}</tr></thead>
      <tbody>{backdropCategories.map(category => <tr key={category.key}><th scope="row">{category.label}</th>{currencies.map(currency => {
        const cell = review.backdrop.find(cell => cell.currency === currency && cell.category === category.key)
        return <td key={currency}>{cell?.evidence.map((item, index) => {
          const age = item.published_on ? Math.round((Date.parse(thesisDay(review.as_of_utc)) - Date.parse(item.published_on)) / 86400000) : null
          return <div className="thesis-backdrop-evidence" key={index}>
            <small>{item.published_on ? `${date.format(new Date(item.published_on + 'T05:00:00Z'))} · ${age === 0 ? 'same day' : `${age} days earlier`}` : item.publication_note}</small>
            <p>{item.summary}</p>
            <span className="thesis-sources">{item.sources.map((source, index) => source.kind === 'web' && safeThesisLink(source.locator)
              ? <a key={index} href={source.locator} title={source.note || undefined} target="_blank" rel="noopener noreferrer">{source.label}</a>
              : <span key={index} title={source.locator}>{source.label} (local evidence)</span>)}</span>
            <small>Source checked {clock.format(new Date(item.verified_utc))} Jakarta</small>
          </div>
        })}{cell?.gap && <p className="thesis-backdrop-gap">{cell.gap}</p>}</td>
      })}</tr>)}</tbody>
    </table></div>
    {review.limitations && <p>{review.limitations}</p>}
  </details>
})
