import { memo, useEffect, useRef, useState } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { currencyTierInfo, eventTiers } from '../event-tiers/event-tiers'
import { detailRefreshPrompt, detailValue, type DetailMetric, type DetailReading, type DetailSource } from './detail-model'
import { useCurrencyDetails } from './useCurrencyDetails'
import { PolicyDecisionTable } from './PolicyDecisionTable'
import './currency-details.css'

type ViewEvent = (reading: DetailReading) => void
function Publication({ at, date }: { at: number | string | null; date: string | null }) {
  const clock = useDisplayClock()
  if (at === null && !date) return <>—</>
  return <time dateTime={at === null ? date! : new Date(at).toISOString()} title={at === null ? 'Publication date; hour unavailable' : clock.zone}>
    {at === null ? date : clock.utc(new Date(at).getTime())}
  </time>
}

const MetricCell = memo(function MetricCell({ metric, publisher, onViewEvent }: {
  metric: DetailMetric; publisher: DetailSource & { allowed_hosts?: string[] }; onViewEvent: ViewEvent
}) {
  const m = metric, official = m.official_latest ? m.official : null, broker = m.broker
  const value = detailValue(official?.value ?? broker?.value, m.unit, official?.lower)
  const hosts = publisher.allowed_hosts ?? [new URL(publisher.url).hostname]
  const original = official?.sources.find(s => hosts.includes(new URL(s.url).hostname))
  const source = { label: publisher.label, url: original?.url ?? m.source_url ?? publisher.url }
  const next = m.broker_next, schedule = m.next_releases[0]
  // Do not attach an older broker vintage's previous value to a newer official observation.
  const comparable = !official || !!broker?.period && official.period === broker.period
  const previous = comparable ? broker?.revised_previous ?? broker?.previous : null
  const conflict = m.comparison === 'conflict'
  const description = `${m.definition}${official?.period ?? broker?.period ? ` · Reference ${official?.period ?? broker?.period}` : ''}`
  return <article className="detail-metric" data-detail-metric={m.id}>
    <div className="detail-reading"><span className="detail-metric-label" title={description}>{m.label}</span>
      <div className="detail-values">
        <div><span>Previous reading</span><span className="detail-number" title={broker?.revised_previous != null ? 'Revised previous reading' : 'Previous reading'}>{detailValue(previous, m.unit)}</span></div>
        <div><span>Latest actual</span><span className="detail-number"><strong title={description}>{value}</strong>{conflict && <span className="detail-conflict" role="img" aria-label="Source conflict"
          title={`Source conflict: publisher ${detailValue(m.official?.value, m.unit)}; captured value ${detailValue(broker?.value, m.unit)}.`}>⚠</span>}</span></div>
        <div><span>Next upcoming forecast</span><span className="detail-number" title="Consensus forecast for the next upcoming release">{detailValue(next?.forecast, m.unit)}</span></div>
      </div>
    </div>
    <div className="detail-field"><span>Released at</span>{broker ? <button type="button" className="detail-event-link" onClick={() => onViewEvent(broker)} aria-label={`Open released ${m.label}`}>
      <Publication at={broker.at} date={broker.date} /></button> : <Publication at={official?.released_at ?? null} date={official?.released_date ?? null} />}</div>
    <div className="detail-field"><span>Next Release</span>{next ? <button type="button" className="detail-event-link" onClick={() => onViewEvent(next)} aria-label={`Open next ${m.label}`}>
      <Publication at={next.at} date={next.date} /></button> : <Publication at={schedule?.at ?? null} date={schedule?.date ?? null} />}</div>
    <div className="detail-field"><span>Source</span><a href={source.url} target="_blank" rel="noreferrer" title={description}>{source.label}</a></div>
  </article>
})

function TierListInfo({ currencies }: { currencies: readonly string[] }) {
  return <div className="detail-tier-info">
    <table aria-label="Tier list reference"><thead><tr><th scope="col">Tier</th><th scope="col">Events</th></tr></thead>
      <tbody>{eventTiers.map(tier => <tr key={tier.id}><th scope="row">{tier.label}</th><td>{tier.events}</td></tr>)}</tbody>
    </table>
    <table aria-label="Currency tier reference"><thead><tr><th scope="col">Currency</th><th scope="col">S — essential</th><th scope="col">A — major</th><th scope="col">B — supporting</th></tr></thead>
      <tbody>{currencies.map(currency => <tr key={currency}><th scope="row">{currency}</th>{(['S', 'A', 'B'] as const).map(tier => <td key={tier}>{currencyTierInfo[currency]?.[tier] ?? '—'}</td>)}</tr>)}</tbody>
    </table>
  </div>
}

export const CurrencyDetailPanel = memo(function CurrencyDetailPanel({ brokerId, symbol, onClose, onViewEvent }: {
  brokerId: string | null; symbol: string; onClose: () => void; onViewEvent: ViewEvent
}) {
  const { data, loading, error, currencies } = useCurrencyDetails(brokerId, symbol)
  const [info, setInfo] = useState(false)
  const [copied, setCopied] = useState<{ scope: string; message: string } | null>(null)
  const copyScope = currencies.join('')
  const decisionHistory = currencies.length === 2 && currencies.includes('USD') && currencies.includes('CAD')
  const panel = useRef<HTMLElement>(null)
  const infoButton = useRef<HTMLButtonElement>(null)
  const wasInfo = useRef(false)
  const closeInfo = () => setInfo(false)
  useEffect(() => {
    if (info) panel.current?.querySelector<HTMLButtonElement>('[aria-label="Close Tier List Info"]')?.focus()
    else if (wasInfo.current) infoButton.current?.focus()
    wasInfo.current = info
  }, [info])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = panel.current
    element?.querySelector('button')?.focus()
    return () => { if (element?.contains(document.activeElement)) previous?.focus() }
  }, [])
  return <aside ref={panel} id="currency-detail-panel" className="currency-detail-panel" aria-labelledby="currency-detail-title"
    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); if (info) closeInfo(); else onClose() } }}>
    <header><span>{symbol}</span><h2 id="currency-detail-title">{info ? 'Tier List Info' : 'Detail'}</h2>
      {!info && <button ref={infoButton} type="button" onClick={() => setInfo(true)}>Tier List Info</button>}
      <button type="button" aria-label={info ? 'Close Tier List Info' : 'Close Detail'} onClick={info ? closeInfo : onClose}>×</button></header>
    <div className={`detail-body${decisionHistory ? ' detail-history-body' : ''}`} hidden={info}>
      {!currencies.length ? <p>No currency Detail scope for {symbol}.</p> : !brokerId ? <p>Connect a broker to view Detail.</p> : <>
        {error && <p role="alert">{error}</p>}{loading && <p role="status">Loading Detail…</p>}
        {data && (decisionHistory
          ? <PolicyDecisionTable key={copyScope} data={data} onViewEvent={onViewEvent} />
          : <table className="detail-comparison" aria-label="Currency fundamentals comparison"><thead><tr>{currencies.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
          {eventTiers.map(tier => {
            const columns = currencies.map(currency => data.metrics.filter(m => m.currency === currency && m.tier === tier.id))
            const count = Math.max(1, ...columns.map(column => column.length))
            return <tbody key={tier.id} data-detail-tier={tier.id}>
              <tr className="detail-tier-heading"><th scope="rowgroup" colSpan={currencies.length}>{tier.label}</th></tr>
              {Array.from({ length: count }, (_, index) => <tr key={index}>
              {columns.map((column, i) => <td key={currencies[i]}>{column[index]
                ? <MetricCell metric={column[index]} publisher={data.sources[column[index].source]} onViewEvent={onViewEvent} />
                : <div className="detail-empty" aria-label={`No further ${tier.label} metrics for ${currencies[i]}`}>—</div>}</td>)}
            </tr>)}</tbody>
          })}</table>)}
      </>}
    </div>
    {info && <div className="detail-body"><TierListInfo currencies={currencies} /></div>}
    {!info && <footer><button type="button" disabled={!currencies.length} onClick={async () => {
      try { await navigator.clipboard.writeText(detailRefreshPrompt(copyScope)); setCopied({ scope: copyScope, message: 'Refresh prompt copied' }) }
      catch { setCopied({ scope: copyScope, message: 'Copy failed · retry' }) }
    }}>{copied?.scope === copyScope ? copied.message : 'Copy refresh prompt'}</button></footer>}
  </aside>
})
