import { thesisDay, type CurrencyNews, type ThesisReviewEntry } from './thesis-model'

const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
export const assessmentTime = (at: string) => `${time.format(new Date(at))} Jakarta`
export function newsSourceTime(item: CurrencyNews) {
  return `${item.published_at ? `Published ${assessmentTime(item.published_at)}` : 'Publication hour unverified'} · checked ${assessmentTime(item.verified_utc)}`
}

// Corrections replace their cutoff's interpretation. Assessment clocks do not
// establish the exact time the market turned or the catalyst was published.
export function currencyDirectionTimeline(reviews: ThesisReviewEntry[], selected: ThesisReviewEntry | undefined, currency: string) {
  if (!selected || selected.provenance === 'reconstruction') return []
  const cutoffs = new Map<number, ThesisReviewEntry>()
  for (const review of reviews) {
    if (review.format !== 'daily_news' || review.provenance !== 'assessment'
      || thesisDay(review.as_of_utc) !== thesisDay(selected.as_of_utc)
      || Date.parse(review.as_of_utc) > Date.parse(selected.as_of_utc)
      || !review.currency_views?.find(view => view.currency === currency)?.direction) continue
    const cutoff = Date.parse(review.as_of_utc)
    const previous = cutoffs.get(cutoff)
    if (!previous || Date.parse(review.saved_utc) > Date.parse(previous.saved_utc)) cutoffs.set(cutoff, review)
  }
  cutoffs.set(Date.parse(selected.as_of_utc), selected)
  const changes: { at: string; direction: NonNullable<NonNullable<ThesisReviewEntry['currency_views']>[number]['direction']> }[] = []
  for (const review of [...cutoffs.values()].sort((a, b) => Date.parse(a.as_of_utc) - Date.parse(b.as_of_utc))) {
    const direction = review.currency_views?.find(view => view.currency === currency)?.direction
    const prior = changes.at(-1)?.direction
    if (direction && (direction.verdict !== prior?.verdict || direction.intensity !== prior?.intensity || direction.basis !== prior?.basis)) changes.push({ at: review.as_of_utc, direction })
  }
  return changes.length > 1 ? changes : []
}
