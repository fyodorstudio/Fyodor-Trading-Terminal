import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { newsAge, type NewsItem } from './model'
import type { useNewsHistory } from './useNewsFlow'

export function Headlines({ items, dated = false }: { items: NewsItem[]; dated?: boolean }) {
  const clock = useDisplayClock()
  return items.map(item => <article key={item.id}>
    <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
    <div className="news-byline"><span>{item.publisher || item.source_name}</span><span>·</span>
      <time dateTime={new Date(item.published_at ?? item.first_seen).toISOString()} title={`${item.published_at === null ? 'First collected: ' : ''}${clock.utc(item.published_at ?? item.first_seen)}`}>
        {item.published_at === null ? 'Collected ' : ''}{dated ? clock.utc(item.published_at ?? item.first_seen) : newsAge(item.published_at ?? item.first_seen)}</time></div>
  </article>)
}

export function HistoryStatus({ history }: { history: ReturnType<typeof useNewsHistory> }) {
  return <>
    {history.loading && <p className="news-message" role="status">Searching historical headlines…</p>}
    {history.error && <p className="news-message" role="alert">Historical search: {history.error}. Cached headlines remain available.</p>}
    {history.result && <div className="news-history-status" role="status">
      {(history.result.searched > 0 || history.result.cached > 0) && <p>Historical results may be incomplete.</p>}
      {!!history.result.unsupported.length && <p>Historical lookup unavailable; cached headlines only: {history.result.unsupported.join(', ')}.</p>}
      {history.result.errors.map(message => <p key={message}>Historical search: {message}</p>)}
    </div>}
  </>
}
