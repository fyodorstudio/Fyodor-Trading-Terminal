import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { newsAge, newsTimestamp, delayedCollection, headlineClassification, headlineTier, headlineLabel, headlineReason, type NewsItem, type NewsSettings } from './model'
import type { useNewsHistory } from './useNewsFlow'
import { pinNews } from './useNewsFlow'
import { useNewsSettings } from './settings'
import { useOptionalWildcards } from '../wildcards/useWildcards'
import { wildcardDay } from '../wildcards/wildcard-model'

export function Headlines({ items, dated = false }: { items: NewsItem[]; dated?: boolean }) {
  const [settings] = useNewsSettings()
  const [now, setNow] = useState(Date.now)
  const live = items.length > 0
  useEffect(() => {
    if (!live) return
    let timer = 0
    const update = () => { setNow(Date.now()); timer = window.setTimeout(update, 15000) }
    timer = window.setTimeout(update, 15000)
    return () => window.clearTimeout(timer)
  }, [live])
  return items.map(item => <Headline key={item.id} item={item} dated={dated} settings={settings} now={now} />)
}

function Headline({ item, dated, settings, now }: { item: NewsItem; dated: boolean; settings: NewsSettings; now: number }) {
  const clock = useDisplayClock()
  const wildcards = useOptionalWildcards(), [pinning, setPinning] = useState(false), [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const [pin, setPin] = useState<{ original: NewsItem['pinned']; value: boolean } | null>(null)
  const pinned = pin && pin.original === item.pinned ? pin.value : !!item.pinned
  const relevance = headlineClassification(item, settings)
  const category = headlineTier({ ...item, pinned }, settings)
  const collected = item.published_at === null || item.published_at - item.first_seen >= 60000
  const displayedAt = newsTimestamp(item)
  const timeTitle = collected ? `First collected: ${clock.utc(item.first_seen)}. ${item.published_at === null ? 'Publication time unavailable.' : `Feed-supplied future publication time: ${clock.utc(item.published_at)}.`}` : clock.utc(displayedAt)
  const collectionTitle = `First collected: ${clock.utc(item.first_seen)}.${item.previous_check_at != null ? ` Previous successful check of this feed: ${clock.utc(item.previous_check_at)}. This exact item was not yet collected then.` : ' Previous check evidence unavailable.'} This does not establish when the feed first exposed it.`
  useEffect(() => () => request.current?.abort(), [])
  async function togglePin() {
    const controller = new AbortController(); request.current = controller
    setPinning(true); setError('')
    try { await pinNews(item.url, !pinned, controller.signal); if (!controller.signal.aborted) setPin({ original: item.pinned, value: !pinned }) }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not star headline') }
    finally { if (!controller.signal.aborted) setPinning(false) }
  }
  function addWildcard() {
    const at = newsTimestamp(item)
    wildcards?.openDraft({ date: wildcardDay(at), at: new Date(at).toISOString(), title: item.title.slice(0, 300), url: item.url, archived: false,
      details: `${item.title}\n${item.publisher || item.source_name}\n${collected ? item.published_at === null ? 'Collected at (publication time unavailable)' : 'Collected at (feed supplied a scheduled/future time)' : 'Feed publication time (underlying event may be earlier)'}: ${new Date(at).toISOString()}${collected && item.published_at !== null ? `\nOriginal feed timestamp: ${new Date(item.published_at).toISOString()}` : ''}\n${item.summary}` })
  }
  return <article data-news-category={category} style={{ '--news-category': category !== 'excluded' ? settings.includedColor : settings.excludedColor } as CSSProperties}>
    <div className="news-row-heading"><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
      <div className="news-row-actions"><button type="button" title="Add Wildcard" aria-label={`Add Wildcard: ${item.title}`} disabled={!wildcards?.snapshot || wildcards.saving} onClick={addWildcard}>✦</button>
        <button type="button" title={pinned ? 'Remove manual star' : 'Add to Priority 1'} aria-label={`${pinned ? 'Unstar' : 'Star'} headline: ${item.title}`} aria-pressed={pinned} disabled={pinning} onClick={() => void togglePin()}>{pinned ? '★' : '☆'}</button></div></div>
    <div className="news-byline"><span>{item.publisher || item.source_name}</span><span>·</span>
      <time dateTime={new Date(displayedAt).toISOString()} title={timeTitle}>
        {collected ? 'First collected ' : 'Published '}{dated ? clock.utc(displayedAt) : newsAge(displayedAt, now)}</time>
      {!collected && (delayedCollection(item) || settings.sortBy === 'collected') && <><span>·</span><time data-sort-time={settings.sortBy === 'collected'} dateTime={new Date(item.first_seen).toISOString()} title={collectionTitle}>Collected {dated ? clock.utc(item.first_seen) : newsAge(item.first_seen, now)}</time></>}
    </div>
    <div className="news-row-footer"><div className="news-row-labels"><span title={headlineReason(relevance.reason)}>{headlineLabel(category)} · {category === 'priority' ? pinned ? 'Manually starred' : item.relevance?.priority_reason || 'High-impact catalyst' : headlineReason(relevance.reason)}</span>
    </div><div className="news-row-age">
      <time dateTime={new Date(displayedAt).toISOString()} title={timeTitle}>{collected ? 'First collected ' : 'Published '}{newsAge(displayedAt, now)}</time>
      {!collected && (delayedCollection(item) || settings.sortBy === 'collected') && <time dateTime={new Date(item.first_seen).toISOString()} title={collectionTitle}>Collected {newsAge(item.first_seen, now)}</time>}
    </div></div>
    {error && <p role="alert">{error}</p>}
  </article>
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
