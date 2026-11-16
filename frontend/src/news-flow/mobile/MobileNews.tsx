import { useEffect, useRef, useState } from 'react'
import { newsQuery, newsTimestamp, delayedCollection, headlineClassification, headlineTier } from '../model'
import { useNewsSettings } from '../settings'
import { useNewsPage, useNewsSources } from '../useNewsFlow'
import { NewsProviderSelector } from '../NewsProviderSelector'
import { NewsFilterTabs } from '../NewsTabs'
import { NewsCopy } from '../NewsCopy'
import { NewsSort } from '../NewsSort'

export function MobileNews() {
  const [settings, change] = useNewsSettings(), { sources, error: sourceError } = useNewsSources()
  const [search, setSearch] = useState(''), [term, setTerm] = useState(''), [date, setDate] = useState(''), [index, setIndex] = useState(0)
  const scroll = useRef<HTMLDivElement>(null), paused = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function loadProfile() {
      try {
        const response = await fetch('/storage-api/news-flow/phone-profile', { signal: controller.signal })
        if (!response.ok) throw new Error('Profile unavailable')
        const profile = await response.json()
        if (controller.signal.aborted || typeof profile.include !== 'string' || typeof profile.exclude !== 'string' || !Array.isArray(profile.hidden)) return
        // Share keyword edits; only seed provider visibility once so the phone
        // retains its own browsing filters without changing desktop alerts.
        const seeded = window.localStorage.getItem('fyodor.news-phone.seeded')
        change(old => ({ ...old, include: profile.include, exclude: profile.exclude, marketRelevance: profile.market_relevance !== false, hiddenSources: seeded ? old.hiddenSources : profile.hidden }))
        window.localStorage.setItem('fyodor.news-phone.seeded', '1')
      } catch { /* Reader still works with its previous keyword profile. */ }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(loadProfile, 30000) }
    }
    void loadProfile()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [change])
  useEffect(() => { const timer = window.setTimeout(() => setTerm(search.trim()), 200); return () => window.clearTimeout(timer) }, [search])
  let start: number | null = null, end: number | null = null
  if (date) {
    const [year, month, day] = date.split('-').map(Number)
    start = new Date(year, month - 1, day).getTime(); end = new Date(year, month - 1, day + 1).getTime()
  }
  const scope = newsQuery(settings, sources, 0, start, end, term)
  const [previousScope, setPreviousScope] = useState(scope)
  if (previousScope !== scope) { setPreviousScope(scope); setIndex(0) }
  const query = newsQuery(settings, sources, index, start, end, term)
  const { page, error, pending, reveal } = useNewsPage(query, paused)
  useEffect(() => { paused.current = false; if (scroll.current) scroll.current.scrollTop = 0 }, [query])
  return <main className="news-mobile">
    <header><h1>News Flow</h1><span>PC feed · read only</span></header>
    <section className="news-mobile-controls" aria-label="News filters">
      <NewsFilterTabs value={settings.mode} onChange={mode => change({ ...settings, mode })} controls="phone-news-items" />
      <div><NewsProviderSelector sources={sources} hidden={settings.hiddenSources} onChange={hiddenSources => change({ ...settings, hiddenSources })} />
        <label>Date<input aria-label="Phone news date" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        {date && <button type="button" onClick={() => setDate('')}>Clear date</button>}
        <NewsCopy query={scope} enabled={sources.length > 0} id="phone-news-copy" /></div>
      <NewsSort settings={settings} onChange={change} />
      <input type="search" aria-label="Search phone headlines" placeholder="Search headlines…" value={search} onChange={event => setSearch(event.target.value)} maxLength={500} />
      <small>Calendar: publication date · Phone timezone. Searches use headlines already collected on your PC.</small>
    </section>
    {(error || sourceError) && <p role="alert">{error || sourceError}</p>}
    {pending && <button className="news-new-items" type="button" onClick={() => { paused.current = false; if (scroll.current) scroll.current.scrollTop = 0; reveal() }}>Updated headlines · show latest</button>}
    <div id="phone-news-items" role="tabpanel" aria-labelledby={`phone-news-items-${settings.mode}-tab`} className="news-items" ref={scroll} onScroll={event => { paused.current = event.currentTarget.scrollTop > 60 }}>
      {!page && !error && <p>Connecting to your PC…</p>}
      {page?.items.map(item => {
        const relevance = headlineClassification(item, settings)
        const tier = headlineTier(item, settings)
        const at = newsTimestamp(item)
        const collected = item.published_at === null || at !== item.published_at
        return <article key={item.id} data-news-category={tier} style={{ borderLeftColor: tier !== 'excluded' ? settings.includedColor : settings.excludedColor }}>
          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
          <p>{item.publisher || item.source_name} · {collected ? 'First collected ' : 'Published '}<time dateTime={new Date(at).toISOString()}>{new Date(at).toLocaleString()}</time>
            {!collected && (delayedCollection(item) || settings.sortBy === 'collected') && <> · Collected <time data-sort-time={settings.sortBy === 'collected'} dateTime={new Date(item.first_seen).toISOString()}>{new Date(item.first_seen).toLocaleString()}</time></>}</p>
          <small>{tier === 'priority' ? `Priority · ${item.relevance?.priority_reason || 'Manually starred'}` : relevance.reason}</small>
        </article>
      })}
      {page && !page.items.length && <p>No collected headlines match this view.</p>}
    </div>
    <footer><button type="button" disabled={!index} onClick={() => setIndex(value => value - 1)}>Previous</button>
      <span>{page?.total ?? 0} headlines</span><button type="button" disabled={!page || (index + 1) * 100 >= page.total} onClick={() => setIndex(value => value + 1)}>Next</button></footer>
  </main>
}
