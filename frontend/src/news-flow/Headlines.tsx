import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { newsAge, newsTimestamp, delayedCollection, headlineClassification, type NewsItem, type NewsSettings } from './model'
import type { useNewsHistory } from './useNewsFlow'
import { pinNews } from './useNewsFlow'
import { useNewsSettings } from './settings'
import { useOptionalWildcards } from '../wildcards/useWildcards'
import { wildcardDay } from '../wildcards/wildcard-model'

export function Headlines({ items, dated = false, policyDetails = false, onCurrency }: { items: NewsItem[]; dated?: boolean; policyDetails?: boolean; onCurrency?: (currency: string) => void }) {
  const [settings] = useNewsSettings()
  const [now, setNow] = useState(Date.now)
  const live = !dated && items.length > 0
  useEffect(() => {
    if (!live) return
    let timer = 0
    const update = () => { setNow(Date.now()); timer = window.setTimeout(update, 15000) }
    timer = window.setTimeout(update, 15000)
    return () => window.clearTimeout(timer)
  }, [live])
  return items.map(item => <Headline key={item.id} item={item} dated={dated} settings={settings} now={now} policyDetails={policyDetails} onCurrency={onCurrency} />)
}

function Headline({ item, dated, settings, now, policyDetails, onCurrency }: { item: NewsItem; dated: boolean; settings: NewsSettings; now: number; policyDetails: boolean; onCurrency?: (currency: string) => void }) {
  const clock = useDisplayClock()
  const wildcards = useOptionalWildcards(), [pinning, setPinning] = useState(false), [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const [pin, setPin] = useState<{ original: NewsItem['pinned']; value: boolean } | null>(null)
  const pinned = pin && pin.original === item.pinned ? pin.value : !!item.pinned
  const relevance = headlineClassification(item, settings)
  const category = relevance.included ? 'included' : 'excluded'
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
  return <article data-news-category={category} style={{ '--news-category': category === 'included' ? settings.includedColor : settings.excludedColor } as CSSProperties}>
    <div className="news-row-heading"><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
      <div className="news-row-actions"><button type="button" title="Add Wildcard" aria-label={`Add Wildcard: ${item.title}`} disabled={!wildcards?.snapshot || wildcards.saving} onClick={addWildcard}>✦</button>
        <button type="button" title={pinned ? 'Remove from Priority' : 'Add to Priority'} aria-label={`${pinned ? 'Unstar' : 'Star'} headline: ${item.title}`} aria-pressed={pinned} disabled={pinning} onClick={() => void togglePin()}>{pinned ? '★' : '☆'}</button></div></div>
    <div className="news-byline"><span>{item.publisher || item.source_name}</span><span>·</span>
      <time dateTime={new Date(displayedAt).toISOString()} title={timeTitle}>
        {collected ? 'First collected ' : 'Published '}{dated ? clock.utc(displayedAt) : newsAge(displayedAt, now)}</time>
      {delayedCollection(item) && <><span>·</span><time dateTime={new Date(item.first_seen).toISOString()} title={collectionTitle}>Collected {dated ? clock.utc(item.first_seen) : newsAge(item.first_seen, now)}</time></>}
    </div>
    <div className="news-row-labels"><span>{relevance.reason}</span>
      {item.priority_reason && <span title="Detected from the headline or supplied feed text; verify when the information was available.">Expectations candidate</span>}
      {item.policy_banks?.map(bank => onCurrency ? <button type="button" className="news-policy-badge" key={bank.currency} aria-label={`Show ${bank.currency} policy`} onClick={() => onCurrency(bank.currency)}>{bank.currency} · {bank.bank}</button>
        : <span className="news-policy-badge" key={bank.currency}>{bank.currency} · {bank.bank}</span>)}
      {policyDetails && !!item.policy_banks?.length && <span className="news-stance" title="Source wording only, not a forecast or a comparison with market expectations.">
        {item.stance === 'hawkish' ? 'Hawkish wording' : item.stance === 'dovish' ? 'Dovish wording' : item.stance === 'mixed' ? 'Mixed wording' : 'Stance unclassified'}</span>}
    </div>
    {policyDetails && item.stance_evidence?.map((entry, index) => <p className="news-policy-evidence" key={index}>Source wording ({entry.origin}): “{entry.text.split(/(hawkish|dovish)/ig).map((part, partIndex) => /^(hawkish|dovish)$/i.test(part) ? <mark key={partIndex}>{part}</mark> : part)}”</p>)}
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
