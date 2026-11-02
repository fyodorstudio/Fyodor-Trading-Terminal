import { memo, useEffect, useId, useState } from 'react'
import { forexPair } from '../economic-calendar/forex/pairs'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { recommendationState, validRecommendedPairs, type RecommendedPairsSnapshot } from './recommended-pairs-model'
import './recommended-pairs.css'

const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
export const RecommendedPairs = memo(function RecommendedPairs({ symbols, onSelectSymbol }: {
  symbols: SymbolQuote[]; onSelectSymbol: (symbol: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('fyodor.recommended-pairs.collapsed.v1') === 'true' } catch { return false }
  })
  const id = useId()
  const [snapshot, setSnapshot] = useState<RecommendedPairsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined, revision: string | null = null
    async function pollRecommendedPairs() {
      try {
        const response = await fetch(`/storage-api/theses/recommended-pairs${revision ? `?after_revision=${encodeURIComponent(revision)}` : ''}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Recommended pairs unavailable.')
        const data = await response.json()
        if (controller.signal.aborted) return
        if (data.unchanged ? data.schema !== 1 || !revision || data.revision !== revision : !validRecommendedPairs(data)) throw new Error('Invalid recommended pairs response.')
        if (!data.unchanged) {
          revision = data.revision
          setSnapshot(previous => previous?.revision === data.revision ? previous : data)
        }
        setError(null)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Recommended pairs unavailable.')
      }
      if (!controller.signal.aborted) timer = window.setTimeout(pollRecommendedPairs, 5000)
    }
    void pollRecommendedPairs()
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { controller.abort(); window.clearTimeout(timer); window.clearInterval(tick) }
  }, [])
  const ordered = [...(snapshot?.items ?? [])].sort((a,b) => Number(recommendationState(b,now) === 'Current') - Number(recommendationState(a,now) === 'Current'))
  return <section className="recommended-pairs" aria-label="Recommended pairs">
    <h2><button type="button" aria-expanded={!collapsed} aria-controls={id} onClick={() => {
      setCollapsed(!collapsed)
      try { localStorage.setItem('fyodor.recommended-pairs.collapsed.v1', String(!collapsed)) } catch { /* Keep session preference. */ }
    }}><span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> Recommended Pairs</button></h2>
    <div id={id} hidden={collapsed} className="recommended-pairs-content">
      {error && <p role="alert">{error} {snapshot && 'Last loaded comparisons may be outdated.'}</p>}
      {!snapshot ? <p>Loading saved comparisons…</p> : !ordered.length ? <p>No researched pair recommendations saved.</p> : ordered.slice(0,3).map(item => {
        const symbol = symbols.find(s => forexPair(s.symbol) === item.pair)?.symbol
        const state = recommendationState(item,now)
        return <article key={item.id} data-recommended-pair={item.pair}>
          <h3><button type="button" disabled={!symbol} onClick={() => symbol && onSelectSymbol(symbol)} title={symbol ? `Open ${symbol} chart` : 'Pair unavailable in the connected broker catalog'}>{item.pair}</button> · {item.verdict}{item.intensity && ` · ${item.intensity[0].toUpperCase()}${item.intensity.slice(1)}`}</h3>
          <p className="recommended-pair-state">{error ? 'Reassessment due · connection unavailable' : state}</p>
          <p>Assessed {clock.format(new Date(item.as_of_utc))} Jakarta</p>
          <p>Window: {clock.formatRange(new Date(item.starts_at),new Date(item.until_utc))} Jakarta · {item.checkpoint}</p>
          <p>{item.reason}</p>
          <p><strong>Opposition:</strong> {item.strongest_opposition}</p>
          <p><strong>Invalidation:</strong> {item.invalidation}</p>
          {item.evidence.map(side => <p key={side.assessment_id} title={side.reason}><strong>{side.currency} evidence:</strong> {side.sources.map((source,n) => <span key={source.locator}>{n > 0 && ' · '}<a href={source.locator} target="_blank" rel="noreferrer" title={source.note}>{source.label}</a></span>)}</p>)}
        </article>
      })}
    </div>
  </section>
})
