import { useMemo, useRef, useState } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { newsDateBounds } from './date-range'
import { Headlines, HistoryStatus } from './Headlines'
import type { NewsSource, NewsMode } from './model'
import { useNewsHistory, useNewsPage } from './useNewsFlow'
import { useNewsSettings } from './settings'
import { NewsFilterTabs } from './NewsTabs'

export function ProviderBrowser({ sources, selectedId, date, onDateChange, priority = false }: { sources: NewsSource[]; selectedId?: string; date: string; onDateChange: (date: string) => void; priority?: boolean }) {
  const [paging, setPaging] = useState({ scope: '', offset: 0 }), [mode, setMode] = useState<NewsMode>('all')
  const [settings] = useNewsSettings()
  const scope = `${selectedId}:${date}:${mode}:${priority}`
  const offset = paging.scope === scope ? paging.offset : 0
  const paused = useRef(false), clock = useDisplayClock()
  const bounds = useMemo(() => newsDateBounds(date, clock.preference), [date, clock.preference])
  const source = sources.find(entry => entry.id === selectedId)
  const visible = priority ? sources.filter(source => !settings.hiddenSources.includes(source.id)) : source ? [source] : []
  const query = new URLSearchParams({ order: 'newest', limit: '100', offset: String(offset), mode: priority ? 'all' : mode,
    include: !priority && mode !== 'all' ? settings.include : '', exclude: !priority && mode !== 'all' ? settings.exclude : '' })
  if (priority) query.set('priority', 'true')
  for (const entry of visible) query.append('source', entry.id)
  if (!visible.length) query.append('source', '__none__')
  if (bounds[0] !== null && bounds[1] !== null) { query.set('start', String(bounds[0])); query.set('end', String(bounds[1])) }
  const { page, error } = useNewsPage(query.toString(), paused)
  const history = useNewsHistory(bounds[0], bounds[1], visible, [])
  return <section className="news-provider-browser" aria-label="Browse provider headlines">
    <div className="news-browse-controls">
      <label>Date<input type="date" aria-label="Provider publication date" value={date} onChange={event => onDateChange(event.target.value)} /></label>
      <button type="button" aria-pressed={!date} onClick={() => onDateChange('')}>Recent</button>
      <small>{clock.zone}</small>
    </div>
    {priority ? <p>Starred headlines and expectations candidates from visible providers. Verify event timing in the source; older items are dated snapshots. Include/Exclude colours remain visible.</p>
      : <NewsFilterTabs value={mode} onChange={setMode} controls="news-provider-items" />}
    <HistoryStatus history={history} />
    {source?.error && <p className="news-message" role="status">{source.name} · {source.retry_at ? `${source.error.includes('429') ? 'Rate-limited' : 'Unavailable'} · next check ${clock.utc(source.retry_at)}` : source.error}</p>}
    {error && <p className="news-message" role="alert">{error}</p>}
    <div id="news-provider-items" role="tabpanel" aria-label={priority ? 'Priority headlines' : undefined} aria-labelledby={priority ? undefined : `news-provider-items-${mode}-tab`} className="news-items">
      {!page && !error && <p className="news-message">Loading headlines…</p>}
      {page && <Headlines items={page.items} dated={!!date} />}
      {page && !page.items.length && <p className="news-message">{history.loading ? 'Searching this date…' : date ? 'No headlines found for this date. Historical coverage may be incomplete.' : 'Waiting for headlines.'}</p>}
    </div>
    <footer className="news-footer"><div><span>{page?.total ?? 0} headlines</span>
      <button type="button" disabled={!offset} onClick={() => setPaging({ scope, offset: Math.max(0, offset - 100) })}>Previous</button>
      <button type="button" disabled={!page || offset + 100 >= page.total} onClick={() => setPaging({ scope, offset: offset + 100 })}>Next</button>
      {date && <button type="button" disabled={history.loading} onClick={history.retry}>Retry search</button>}
    </div></footer>
  </section>
}
