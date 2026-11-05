import { memo, useEffect, useRef, useState } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { detailRefreshPrompt, detailValue, type DetailMetric, type DetailReading, type DetailSchedule, type DetailSource } from './detail-model'
import { useCurrencyDetails } from './useCurrencyDetails'
import './currency-details.css'

function Sources({ sources }: { sources: DetailSource[] }) {
  return <span className="detail-sources">{sources.map((source, i) => <a key={source.url + i} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}</span>
}

function Publication({ at, date }: { at: number | string | null; date: string }) {
  const clock = useDisplayClock()
  return <time dateTime={at === null ? date : new Date(at).toISOString()}>{at === null ? `${date} · time unconfirmed` : clock.utc(new Date(at).getTime())}</time>
}

type ViewEvent = (reading: DetailReading) => void
function NextRelease({ metric, onViewEvent }: { metric: DetailMetric; onViewEvent: ViewEvent }) {
  const official = metric.next_releases[0]
  if (official) return <span>Next <a href={official.sources[0].url} target="_blank" rel="noreferrer"><Publication at={official.at} date={official.date} /></a> · {official.stage}</span>
  if (metric.schedule_elapsed) return <span>Next publication needs verification</span>
  if (metric.schedule_known) return <span>Next release not confirmed</span>
  const next = metric.broker_next
  return next ? <span>Next <button type="button" className="detail-event-link" onClick={() => onViewEvent(next)}><Publication at={next.at} date={next.date} /></button> · MT5 schedule</span> : <span>Next schedule not checked</span>
}

const MetricCell = memo(function MetricCell({ metric, publisher, onViewEvent }: { metric: DetailMetric; publisher: DetailSource; onViewEvent: ViewEvent }) {
  const m = metric, official = m.official_latest ? m.official : null, broker = m.broker
  const period = official?.period ?? broker?.period
  const status = m.comparison === 'conflict' ? 'Source conflict ⚠' : official ? 'Official source' : broker ? 'MT5 · not independently checked' : 'Observation unavailable'
  return <article className="detail-metric" data-detail-metric={m.id}>
    <details>
      <summary><span className="detail-metric-label">{m.label}{m.id === 'usd.rate' && !official && broker && ' · MT5 upper bound only'}</span><strong>{detailValue(official?.value ?? broker?.value, m.unit, official?.lower)}</strong></summary>
      <div className="detail-evidence">
        <p>{m.definition}</p><Sources sources={[{ ...publisher, url: m.source_url ?? publisher.url }]} />
        <p>Tier {m.tier} · {m.frequency}{official ? ` · ${official.stage}` : ''}</p>
        {m.official && <><p>Official: {detailValue(m.official.value, m.unit, m.official.lower)} · reference {m.official.period} · {m.official.stage}</p>
          <Sources sources={m.official.sources} />
          <p>Verified <Publication at={m.official.verified_at} date={m.official.released_date} /></p>
          {m.official.note && <p>{m.official.note}</p>}</>}
        {broker && <><p>MT5 actual {detailValue(broker.value, m.unit)} · reference {broker.period ?? 'unknown'}<br />
          Forecast {detailValue(broker.forecast, m.unit)} · Previous {detailValue(broker.previous, m.unit)}
          {broker.revised_previous !== null && <> · Revised previous {detailValue(broker.revised_previous, m.unit)}</>}</p>
          <p>MT5 released <Publication at={broker.at} date={broker.date} /> · captured <Publication at={broker.captured_at} date={broker.captured_at.slice(0, 10)} /></p>
          <p>Forecast provider: {m.currency} calendar via MT5; survey methodology may differ.</p>
          <button type="button" onClick={() => onViewEvent(broker)}>Open MT5 release</button>
          {broker.availability !== 'observed' && <p>Latest provider query did not return this observation.</p>}</>}
        {m.comparison === 'different_period' && <p>The official and MT5 reference periods differ. The newer period supplies the main value.</p>}
        {m.comparison === 'different_vintage' && <p>Release stage/vintage equivalence has not been verified; these values are not compared.</p>}
        {m.comparison === 'conflict' && <p>Comparable MT5 and official actuals disagree. Official leads; surprise and directional coloring are withheld.</p>}
        {m.official?.broker_reference && <p>{m.official.broker_reference.basis_note}</p>}
        {m.check && <p>Last source check <Publication at={m.check.checked_at} date={m.check.checked_at.slice(0, 10)} /> · {m.check.coverage}{m.check.coverage_note ? ` · ${m.check.coverage_note}` : ''}</p>}
        {m.next_releases.map((release, i) => <p key={i}>Scheduled {release.stage}: <Publication at={release.at} date={release.date} /> <Sources sources={release.sources} />{release.note}</p>)}
        {m.check?.schedule_checked_at && <p>Schedule checked <Publication at={m.check.schedule_checked_at} date={m.check.schedule_checked_at.slice(0, 10)} /></p>}
      </div>
    </details>
    <small>{period ? `Reference ${m.frequency === 'quarterly' ? `${period.slice(0, 4)} Q${Math.floor((Number(period.slice(5, 7)) - 1) / 3) + 1}` : m.frequency === 'monthly' ? period.slice(0, 7) : period}` : 'Reference period unavailable'}</small>
    <small className={m.comparison === 'conflict' ? 'detail-conflict' : ''}>{status} {official && <Sources sources={official.sources.slice(0, 1)} />}</small>
    {official && <small>Verified <Publication at={official.verified_at} date={official.released_date} /></small>}
    {m.check && m.check.coverage !== 'checked' && <small>{m.check.coverage}: {m.check.coverage_note}</small>}
    {official ? <small>Last <Publication at={official.released_at} date={official.released_date} /> · {official.stage}</small>
      : broker ? <small>Last <Publication at={broker.at} date={broker.date} /></small> : <small><Sources sources={[publisher]} /></small>}
    <small><NextRelease metric={m} onViewEvent={onViewEvent} /></small>
  </article>
})

function MajorReleases({ metrics, onViewEvent }: { metrics: DetailMetric[]; onViewEvent: ViewEvent }) {
  const unique = new Map<string, { metric: DetailMetric; release?: DetailSchedule; reading?: DetailReading; order: string }>()
  for (const metric of metrics) {
    if (metric.tier === 'B') continue
    const release = metric.next_releases[0], reading = !metric.schedule_known ? metric.broker_next : null
    if (!release && !reading) continue
    const order = release?.at ?? (reading?.at ? new Date(reading.at).toISOString() : `${release?.date ?? reading?.date}T23:59:59Z`)
    const key = `${metric.currency}:${metric.category}:${order}`
    if (!unique.has(key)) unique.set(key, { metric, release, reading: reading ?? undefined, order })
  }
  const rows = [...unique.values()].sort((a, b) => a.order.localeCompare(b.order)).slice(0, 3)
  return <section className="detail-major" aria-label="Next major releases"><strong>Next major releases</strong>
    {rows.length ? rows.map(({ metric, release, reading }, i) => <div key={i}><span>{metric.currency} · {metric.category} · {release?.stage ?? 'MT5 schedule'}</span>
      {release ? <a href={release.sources[0].url} target="_blank" rel="noreferrer"><Publication at={release.at} date={release.date} /></a>
        : reading && <button type="button" className="detail-event-link" onClick={() => onViewEvent(reading)}><Publication at={reading.at} date={reading.date} /></button>}</div>)
      : <p>No upcoming publication is confirmed in the saved coverage.</p>}
  </section>
}

export const CurrencyDetailPanel = memo(function CurrencyDetailPanel({ brokerId, symbol, onClose, onViewEvent }: {
  brokerId: string | null; symbol: string; onClose: () => void; onViewEvent: ViewEvent
}) {
  const { data, loading, error, currencies } = useCurrencyDetails(brokerId, symbol)
  const [expanded, setExpanded] = useState<string[]>([])
  const [copied, setCopied] = useState<{ scope: string; message: string } | null>(null)
  const copyScope = currencies.join('')
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = panel.current
    element?.querySelector('button')?.focus()
    return () => { if (element?.contains(document.activeElement)) previous?.focus() }
  }, [])
  return <aside ref={panel} id="currency-detail-panel" className="currency-detail-panel" aria-labelledby="currency-detail-title"
    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
    <header><span>{symbol}</span><h2 id="currency-detail-title">Detail</h2>
      <button type="button" aria-label="Close Detail" onClick={onClose}>×</button></header>
    <div className="detail-body">
      {!currencies.length ? <p>No currency Detail scope for {symbol}.</p> : !brokerId ? <p>Connect a broker to view Detail.</p> : <>
        {error && <p role="alert">{error}</p>}{loading && <p role="status">Loading Detail…</p>}
        {data && <>
          {!data.source_available && <p>MT5 calendar unavailable; saved official observations remain available.</p>}
          <MajorReleases metrics={data.metrics} onViewEvent={onViewEvent} />
          {data.focus.map(focus => <details className="detail-focus" key={focus.currency}><summary>{focus.currency} focus: {focus.label}</summary>
            <p>{focus.reason}</p><p>{focus.limitations}</p><p>Assessed <Publication at={focus.assessed_at} date={focus.assessed_at.slice(0, 10)} /></p><Sources sources={focus.sources} /></details>)}
          <table aria-label="Currency fundamentals comparison"><thead><tr><th scope="col">Metric</th>{currencies.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>{data.categories.map(category => {
              const open = expanded.includes(category.id)
              return <tr key={category.id}><th scope="row"><button type="button" aria-expanded={open} onClick={() => setExpanded(old => open ? old.filter(c => c !== category.id) : [...old, category.id])}>{category.label} {open ? '−' : '+'}</button></th>
                {currencies.map(currency => {
                  const metrics = data.metrics.filter(m => m.currency === currency && m.category === category.id)
                  return <td key={currency}>{metrics.slice(0, open ? undefined : category.id === 'inflation' ? 4 : 2).map(metric => <MetricCell key={metric.id} metric={metric} publisher={data.sources[metric.source]} onViewEvent={onViewEvent} />)}
                    {!open && metrics.length > (category.id === 'inflation' ? 4 : 2) && <small>Expand {category.label.toLowerCase()} for {metrics.length - (category.id === 'inflation' ? 4 : 2)} more</small>}</td>
                })}</tr>
            })}</tbody></table>
          <p className="detail-footnote">Latest available observations · independent of Events ranges. Values retain their units, reference periods and publication stages. Open a metric for source checks and MT5 comparisons.</p>
        </>}
      </>}
    </div>
    <footer><button type="button" disabled={!currencies.length} onClick={async () => {
      try { await navigator.clipboard.writeText(detailRefreshPrompt(copyScope)); setCopied({ scope: copyScope, message: 'Refresh prompt copied' }) }
      catch { setCopied({ scope: copyScope, message: 'Copy failed · retry' }) }
    }}>{copied?.scope === copyScope ? copied.message : 'Copy refresh prompt'}</button><small>Browsing reads saved data. Research runs in the agent chat.</small></footer>
  </aside>
})
