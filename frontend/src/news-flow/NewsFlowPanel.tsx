import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { NewsConfiguration } from './NewsConfiguration'
import { newsQuery, type NewsSettings } from './model'
import { refreshNews, useNewsHistory, useNewsPage, useNewsSources } from './useNewsFlow'
import { useNewsSettings } from './settings'
import { newsDateBounds } from './date-range'
import { Headlines, HistoryStatus } from './Headlines'
import { NewsFilterChecks } from './NewsTabs'
import { NewsProviderSelector } from './NewsProviderSelector'
import { NewsDateFilter } from './NewsDateFilter'
import { NewsCopy } from './NewsCopy'
import { NewsAlarmButton } from './NewsAlarm'
import { NewsSort } from './NewsSort'
import './news-flow.css'

export const NewsFlowPanel = memo(function NewsFlowPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useNewsSettings(), [configuration, setConfiguration] = useState(false)
  const [pagination, setPagination] = useState({ scope: '', index: 0 })
  const [searching, setSearching] = useState(false), [search, setSearch] = useState(''), [searchTerm, setSearchTerm] = useState('')
  const searchInput = useRef<HTMLInputElement>(null), searchButton = useRef<HTMLButtonElement>(null)
  const [refreshError, setRefreshError] = useState(''), [refreshing, setRefreshing] = useState(false)
  const clock = useDisplayClock(), { sources, error: sourceError, reload } = useNewsSources()
  const scroll = useRef<HTMLDivElement>(null), paused = useRef(false), refreshRequest = useRef<AbortController | null>(null)
  const closeConfiguration = useCallback(() => setConfiguration(false), [])
  const bounds = useMemo(() => settings.date && settings.session ? [settings.session.start, settings.session.end] : newsDateBounds(settings.date, clock.preference), [settings.date, clock.preference, settings.session])
  const scope = newsQuery(settings, sources, 0, bounds[0], bounds[1], searchTerm)
  const pageIndex = pagination.scope === scope ? pagination.index : 0
  const query = newsQuery(settings, sources, pageIndex, bounds[0], bounds[1], searchTerm)
  const { page, previewing, pending, error, reveal } = useNewsPage(query, paused)
  const history = useNewsHistory(bounds[0], bounds[1], sources, settings.hiddenSources)
  useEffect(() => { paused.current = false; if (scroll.current) scroll.current.scrollTop = 0 }, [query])
  useEffect(() => () => refreshRequest.current?.abort(), [])
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(search.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => { if (searching) searchInput.current?.focus() }, [searching])
  const change = useCallback((value: NewsSettings) => { setSettings(value); setPagination({ scope: '', index: 0 }) }, [setSettings])
  const resize = useRef<{ x: number; width: number } | null>(null)
  async function refresh() {
    if (refreshing) return
    const controller = new AbortController(); refreshRequest.current = controller
    setRefreshing(true); setRefreshError('')
    try { await refreshNews(controller.signal); if (!controller.signal.aborted) { reload(); history.retry() } }
    catch (cause) { if (!controller.signal.aborted) setRefreshError(cause instanceof Error ? cause.message : 'Could not refresh news') }
    finally { if (!controller.signal.aborted) setRefreshing(false) }
  }
  const failures = sources.filter(source => source.error && source.collect_enabled !== 0 && source.collect_enabled !== false)
  const lastSuccess = Math.max(0, ...sources.map(source => source.last_success ?? 0))
  const feedStatus = failures.length ? `${failures.map(source => source.name).join(', ')} unavailable · retrying\n${failures.map(source => `${source.name}: ${source.error}`).join('\n')}`
    : lastSuccess ? `Updating automatically · ${clock.utc(lastSuccess)}` : 'Connecting to feeds…'
  const filterActive = settings.hiddenSources.length > 0 || settings.mode !== 'all' || !!searchTerm
  return <aside id="news-flow-panel" className="news-flow-panel" aria-label="News Flow" style={{ '--news-width': `${settings.width}px` } as CSSProperties}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="news-resize" role="separator" aria-label="Resize News Flow" aria-orientation="vertical" tabIndex={0}
      aria-valuemin={280} aria-valuemax={640} aria-valuenow={settings.width}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSettings(old => ({ ...old, width: Math.min(640, Math.max(280, old.width + (event.key === 'ArrowLeft' ? 10 : -10))) })) } }}
      onPointerDown={event => { if (event.button !== 0) return; resize.current = { x: event.clientX, width: event.currentTarget.parentElement?.getBoundingClientRect().width || settings.width }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
      onPointerMove={event => { if (resize.current) setSettings(old => ({ ...old, width: Math.min(640, Math.max(280, resize.current!.width + resize.current!.x - event.clientX)) })) }}
      onPointerUp={event => { resize.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onLostPointerCapture={() => { resize.current = null }} />
    <header className="news-header"><div className="news-tools">
      <button ref={searchButton} type="button" aria-label="Search news" title="Search headlines" aria-expanded={searching} aria-controls="news-search" data-filtered={!!searchTerm} onClick={() => { setSearching(value => !value); if (searching) { setSearch(''); setSearchTerm('') } }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>
      </button>
      <NewsAlarmButton />
      <NewsProviderSelector sources={sources} hidden={settings.hiddenSources} onChange={hiddenSources => change({ ...settings, hiddenSources })} />
      <NewsDateFilter settings={settings} zone={clock.zone} onChange={change} />
      <button type="button" aria-label="Configure News Flow" aria-haspopup="dialog" aria-expanded={configuration} aria-controls="news-configuration" onClick={() => setConfiguration(value => !value)} title="Providers and keywords">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/></svg>
      </button>
      <NewsSort settings={settings} onChange={change} />
      <NewsFilterChecks value={settings.mode} onChange={mode => change({ ...settings, mode })} controls="news-items-panel" />
      <button type="button" className="news-close" aria-label="Close News Flow" onClick={onClose} autoFocus>×</button>
    </div>
    </header>
    {configuration && <NewsConfiguration sources={sources} settings={settings} onChange={change} onSaved={reload} onClose={closeConfiguration} />}
    {searching && <div id="news-search" className="news-search" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setSearching(false); setSearch(''); setSearchTerm(''); searchButton.current?.focus() }
    }}><input ref={searchInput} type="search" aria-label="Search headlines" maxLength={500} placeholder="Search headlines…" value={search} onChange={event => setSearch(event.target.value)} />
      <button type="button" aria-label="Clear news search" disabled={!search} onClick={() => { setSearch(''); setSearchTerm(''); searchInput.current?.focus() }}>×</button></div>}
    <HistoryStatus history={history} />
    {(error || sourceError || refreshError) && <p className="news-message" role="alert">{error || sourceError || refreshError}</p>}
    {pending && <button type="button" className="news-new-items" onClick={() => { paused.current = false; if (scroll.current) scroll.current.scrollTop = 0; reveal() }}>Updated headlines · show latest</button>}
    <div id="news-items-panel" role="region" aria-label="News headlines" className="news-items" ref={scroll} onScroll={event => { paused.current = event.currentTarget.scrollTop > 60 }}>
      {!page && !error && <p className="news-message">Loading headlines…</p>}
      {page && <Headlines items={page.items} dated={!!settings.date} />}
      {page && !page.items.length && <p className="news-message">{filterActive ? 'No headlines match these filters.'
        : history.loading ? 'No saved headlines for this date yet.' : settings.date ? 'No headlines available for this date.' : 'Waiting for the first headlines.'}</p>}
    </div>
    <footer className="news-footer"><div><button type="button" aria-label="Refresh news" disabled={refreshing} onClick={() => void refresh()}>↻</button><span>{previewing ? 'Recent headlines · Loading history' : `${page?.total ?? 0} headlines${filterActive ? ' · Filtered' : ''}`}</span>
      <button type="button" disabled={!pageIndex} onClick={() => setPagination({ scope, index: pageIndex - 1 })}>Previous</button>
      <button type="button" disabled={!page || previewing || (pageIndex + 1) * 100 >= page.total} onClick={() => setPagination({ scope, index: pageIndex + 1 })}>Next</button>
      <NewsCopy query={scope} enabled={sources.length > 0} />
      <span className="news-feed-status" role="img" aria-label={feedStatus} title={feedStatus} tabIndex={0}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg>
      </span></div>
    </footer>
  </aside>
})
