import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { parseDisplayClockInput } from '../appearance/time-display/display-clock-input'
import { NewsConfiguration } from './NewsConfiguration'
import { newsAge, newsQuery, readNewsSettings, saveNewsSettings, type NewsSettings } from './model'
import { refreshNews, useNewsPage, useNewsSources } from './useNewsFlow'
import './news-flow.css'

export const NewsFlowPanel = memo(function NewsFlowPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState(readNewsSettings), [configuration, setConfiguration] = useState(false)
  const [calendar, setCalendar] = useState(false), [pageIndex, setPageIndex] = useState(0)
  const [refreshError, setRefreshError] = useState(''), [refreshing, setRefreshing] = useState(false)
  const clock = useDisplayClock(), { sources, error: sourceError, reload } = useNewsSources()
  const scroll = useRef<HTMLDivElement>(null), paused = useRef(false), refreshRequest = useRef<AbortController | null>(null)
  const closeConfiguration = useCallback(() => setConfiguration(false), [])
  const bounds = useMemo(() => {
    if (!settings.date) return [null, null]
    const next = new Date(`${settings.date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    return [parseDisplayClockInput(`${settings.date}T00:00`, clock.preference),
      parseDisplayClockInput(`${next.toISOString().slice(0, 10)}T00:00`, clock.preference)]
  }, [settings.date, clock.preference])
  const query = newsQuery(settings, sources, pageIndex, bounds[0], bounds[1])
  const { page, pending, error, reveal } = useNewsPage(query, paused)
  useEffect(() => { saveNewsSettings(settings) }, [settings])
  useEffect(() => { paused.current = false; if (scroll.current) scroll.current.scrollTop = 0 }, [query])
  useEffect(() => () => refreshRequest.current?.abort(), [])
  const change = useCallback((value: NewsSettings) => { setSettings(value); setPageIndex(0) }, [])
  const resize = useRef<{ x: number; width: number } | null>(null)
  async function refresh() {
    if (refreshing) return
    const controller = new AbortController(); refreshRequest.current = controller
    setRefreshing(true); setRefreshError('')
    try { await refreshNews(controller.signal); if (!controller.signal.aborted) reload() }
    catch (cause) { if (!controller.signal.aborted) setRefreshError(cause instanceof Error ? cause.message : 'Could not refresh news') }
    finally { if (!controller.signal.aborted) setRefreshing(false) }
  }
  const failures = sources.filter(source => source.error)
  const lastSuccess = Math.max(0, ...sources.map(source => source.last_success ?? 0))
  const filterActive = settings.hiddenSources.length > 0 || !!settings.include || !!settings.exclude
  return <aside id="news-flow-panel" className="news-flow-panel" aria-label="News Flow" style={{ '--news-width': `${settings.width}px` } as CSSProperties}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="news-resize" role="separator" aria-label="Resize News Flow" aria-orientation="vertical" tabIndex={0}
      aria-valuemin={280} aria-valuemax={640} aria-valuenow={settings.width}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSettings(old => ({ ...old, width: Math.min(640, Math.max(280, old.width + (event.key === 'ArrowLeft' ? 10 : -10))) })) } }}
      onPointerDown={event => { if (event.button !== 0) return; resize.current = { x: event.clientX, width: event.currentTarget.parentElement?.getBoundingClientRect().width || settings.width }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
      onPointerMove={event => { if (resize.current) setSettings(old => ({ ...old, width: Math.min(640, Math.max(280, resize.current!.width + resize.current!.x - event.clientX)) })) }}
      onPointerUp={event => { resize.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onLostPointerCapture={() => { resize.current = null }} />
    <header className="news-header"><h2>News Flow</h2>
      <button type="button" aria-label="Filter news by date" aria-expanded={calendar} aria-controls="news-date-filter" aria-pressed={!!settings.date} onClick={() => setCalendar(value => !value)} title="Date filter">📅</button>
      <button type="button" aria-label="Configure News Flow" aria-haspopup="dialog" aria-expanded={configuration} aria-controls="news-configuration" aria-pressed={filterActive} onClick={() => setConfiguration(value => !value)} title="Providers and keywords">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/></svg>
      </button>
      <select aria-label="News sort order" value={settings.order} onChange={event => change({ ...settings, order: event.target.value as 'newest' | 'oldest' })}><option value="newest">Newest</option><option value="oldest">Oldest</option></select>
      <button type="button" aria-label="Close News Flow" onClick={onClose} autoFocus>×</button>
    </header>
    {configuration && <NewsConfiguration sources={sources} settings={settings} onChange={change} onSaved={reload} onClose={closeConfiguration} />}
    {(calendar || settings.date) && <div id="news-date-filter" className="news-date-filter"><label>Date<input type="date" aria-label="News publication date" value={settings.date} onChange={event => change({ ...settings, date: event.target.value })} /></label>
      <button type="button" onClick={() => { change({ ...settings, date: '' }); setCalendar(false) }}>All dates</button><small>{clock.zone}</small></div>}
    {(error || sourceError || refreshError) && <p className="news-message" role="alert">{error || sourceError || refreshError}</p>}
    {pending && <button type="button" className="news-new-items" onClick={() => { paused.current = false; if (scroll.current) scroll.current.scrollTop = 0; reveal() }}>Updated headlines · show latest</button>}
    <div className="news-items" ref={scroll} onScroll={event => { paused.current = event.currentTarget.scrollTop > 60 }}>
      {!page && !error && <p className="news-message">Loading headlines…</p>}
      {page?.items.map(item => <article key={item.id}>
        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
        {item.summary && item.summary !== item.title && <p>{item.summary}</p>}
        <div className="news-byline"><span>{item.publisher || item.source_name}</span><span>·</span><time dateTime={new Date(item.published_at ?? item.first_seen).toISOString()} title={`${item.published_at === null ? 'First collected: ' : ''}${clock.utc(item.published_at ?? item.first_seen)}`}>{item.published_at === null ? 'Collected ' : ''}{newsAge(item.published_at ?? item.first_seen)}</time></div>
      </article>)}
      {page && !page.items.length && <p className="news-message">{filterActive || settings.date ? 'No headlines match these filters.' : 'Waiting for the first headlines.'}</p>}
    </div>
    <footer className="news-footer"><div><button type="button" aria-label="Refresh news" disabled={refreshing} onClick={() => void refresh()}>↻</button><span>{page?.total ?? 0} headlines</span>
      <button type="button" disabled={!pageIndex} onClick={() => setPageIndex(value => value - 1)}>Previous</button>
      <button type="button" disabled={!page || (pageIndex + 1) * 100 >= page.total} onClick={() => setPageIndex(value => value + 1)}>Next</button></div>
      {failures.length ? <small role="status" title={failures.map(source => `${source.name}: ${source.error}`).join('\n')}>{failures.map(source => source.name).join(', ')} unavailable · retrying</small>
        : <small title={lastSuccess ? clock.utc(lastSuccess) : undefined}>{lastSuccess ? 'Updating automatically' : 'Connecting to feeds…'}</small>}
    </footer>
  </aside>
})
