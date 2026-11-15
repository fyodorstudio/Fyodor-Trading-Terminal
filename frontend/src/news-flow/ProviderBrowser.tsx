import { useMemo, useRef, useState } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { newsDateBounds } from './date-range'
import { Headlines, HistoryStatus } from './Headlines'
import type { NewsSource } from './model'
import { useNewsHistory, useNewsPage } from './useNewsFlow'

export function ProviderBrowser({ sources, selectedId, onSelect, date, onDateChange }: { sources: NewsSource[]; selectedId: string; onSelect: (id: string) => void; date: string; onDateChange: (date: string) => void }) {
  const [offset, setOffset] = useState(0)
  const paused = useRef(false), clock = useDisplayClock()
  const bounds = useMemo(() => newsDateBounds(date, clock.preference), [date, clock.preference])
  const source = sources.find(entry => entry.id === selectedId)
  const query = new URLSearchParams({ source: source?.id ?? '__none__', order: 'newest', limit: '100', offset: String(offset) })
  if (bounds[0] !== null && bounds[1] !== null) { query.set('start', String(bounds[0])); query.set('end', String(bounds[1])) }
  const { page, error } = useNewsPage(query.toString(), paused)
  const history = useNewsHistory(bounds[0], bounds[1], source ? [source] : [], [])
  return <section className="news-provider-browser" aria-label="Browse provider headlines">
    <div className="news-browse-controls">
      <label>Provider<select aria-label="Browse news provider" value={source?.id ?? ''} onChange={event => { onSelect(event.target.value); setOffset(0) }}>
        {!sources.length && <option value="">Loading providers…</option>}
        {sources.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select></label>
      <label>Date<input type="date" aria-label="Provider publication date" value={date} onChange={event => { onDateChange(event.target.value); setOffset(0) }} /></label>
      <button type="button" aria-pressed={!date} onClick={() => { onDateChange(''); setOffset(0) }}>Recent</button>
      <small>{clock.zone}</small>
    </div>
    <HistoryStatus history={history} />
    {source?.error && <p className="news-message" role="status">{source.name} unavailable · {source.error}</p>}
    {error && <p className="news-message" role="alert">{error}</p>}
    <div className="news-items">
      {!page && !error && <p className="news-message">Loading headlines…</p>}
      {page && <Headlines items={page.items} dated={!!date} />}
      {page && !page.items.length && <p className="news-message">{history.loading ? 'Searching this date…' : date ? 'No headlines found for this date. Historical coverage may be incomplete.' : 'Waiting for headlines.'}</p>}
    </div>
    <footer className="news-footer"><div><span>{page?.total ?? 0} headlines · provider view ignores keyword filters</span>
      <button type="button" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 100))}>Previous</button>
      <button type="button" disabled={!page || offset + 100 >= page.total} onClick={() => setOffset(value => value + 100)}>Next</button>
      {date && <button type="button" disabled={history.loading} onClick={history.retry}>Retry search</button>}
    </div></footer>
  </section>
}
