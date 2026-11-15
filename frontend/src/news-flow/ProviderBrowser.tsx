import { useMemo, useRef, useState } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { newsDateBounds } from './date-range'
import { Headlines, HistoryStatus } from './Headlines'
import type { NewsSource, NewsMode } from './model'
import { useNewsHistory, useNewsPage } from './useNewsFlow'
import { useNewsSettings } from './settings'
import { NewsFilterTabs, NewsTabs } from './NewsTabs'

export function ProviderBrowser({ sources, selectedId, date, onDateChange, priority = false }: { sources: NewsSource[]; selectedId?: string; date: string; onDateChange: (date: string) => void; priority?: boolean }) {
  const [paging, setPaging] = useState({ scope: '', offset: 0 }), [mode, setMode] = useState<NewsMode>('all')
  const [organizer, setOrganizer] = useState('all'), [currency, setCurrency] = useState('all')
  const [settings] = useNewsSettings()
  const scope = `${selectedId}:${date}:${mode}:${priority}:${organizer}:${currency}:${settings.hiddenSources.join(',')}`
  const offset = paging.scope === scope ? paging.offset : 0
  const paused = useRef(false), clock = useDisplayClock()
  const bounds = useMemo(() => newsDateBounds(date, clock.preference), [date, clock.preference])
  const source = sources.find(entry => entry.id === selectedId)
  const visible = priority ? sources.filter(source => !settings.hiddenSources.includes(source.id)) : source ? [source] : []
  const query = new URLSearchParams({ order: 'newest', limit: '100', offset: String(offset), mode: priority ? 'all' : mode,
    include: !priority && mode !== 'all' ? settings.include : '', exclude: !priority && mode !== 'all' ? settings.exclude : '' })
  if (priority) { query.set('priority', 'true'); query.set('organizer', organizer); query.set('currency', currency) }
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
    {priority ? <>
      <NewsTabs label="Priority organization" value={organizer} onChange={setOrganizer} controls="news-provider-items"
        items={[{ id: 'all', label: 'All' }, { id: 'central-banks', label: 'Central banks' }, { id: 'expectations', label: 'Expectations' }, { id: 'starred', label: 'Starred' }]} />
      <div className="news-currency-filters" role="group" aria-label="Policy currency filters">
        {['all', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'].map(code => <button type="button" key={code} aria-label={`Filter policy currency ${code}`} aria-pressed={currency === code}
          onClick={() => setCurrency(code)}>{code === 'all' ? 'All currencies' : code}</button>)}
      </div>
      <p>Policy, expectations and your stars from selected providers, independent of keyword inclusion. Currency filters identify central-bank coverage. Stance labels quote source wording; unclassified means no clear wording in the supplied text. Verify timing and context at the source.</p>
    </>
      : <NewsFilterTabs value={mode} onChange={setMode} controls="news-provider-items" />}
    <HistoryStatus history={history} />
    {source?.error && <p className="news-message" role="status">{source.name} · {source.retry_at ? `${source.error.includes('429') ? 'Rate-limited' : 'Unavailable'} · next check ${clock.utc(source.retry_at)}` : source.error}</p>}
    {error && <p className="news-message" role="alert">{error}</p>}
    <div id="news-provider-items" role="tabpanel" aria-labelledby={`news-provider-items-${priority ? organizer : mode}-tab`} className="news-items">
      {!page && !error && <p className="news-message">Loading headlines…</p>}
      {page && <Headlines items={page.items} dated={!!date} policyDetails={priority} onCurrency={priority ? setCurrency : undefined} />}
      {page && !page.items.length && <p className="news-message">{history.loading ? 'Searching this date…' : date ? 'No headlines found for this date. Historical coverage may be incomplete.' : 'Waiting for headlines.'}</p>}
    </div>
    <footer className="news-footer"><div><span>{page?.total ?? 0} headlines</span>
      <button type="button" disabled={!offset} onClick={() => setPaging({ scope, offset: Math.max(0, offset - 100) })}>Previous</button>
      <button type="button" disabled={!page || offset + 100 >= page.total} onClick={() => setPaging({ scope, offset: offset + 100 })}>Next</button>
      {date && <button type="button" disabled={history.loading} onClick={history.retry}>Retry search</button>}
    </div></footer>
  </section>
}
