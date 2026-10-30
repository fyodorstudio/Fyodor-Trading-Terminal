import { useCallback, useEffect, useRef, useState } from 'react'
import { chartOffsetAt } from '../../appearance/time-display/chart-clock'
import type { SymbolQuote } from '../contracts/SymbolQuote'
import { retainSymbolQuotes } from './market-snapshots'

type DailyRecord = { previous_close: number | null; high: number | null; low: number | null; checked_at: number }
type DailySnapshot = { source_id: string; generation: number; day: number; observed_at: number; symbols: Record<string, DailyRecord> }

export function pepperstoneDay(now: number) {
  const offset = chartOffsetAt(now, { brokerId: 'Pepperstone-Demo', brokerOffsetSeconds: 0 })
  return offset == null ? null : Math.floor((now + offset) / 86_400_000) * 86400
}

const noQuotes: SymbolQuote[] = []
export function useDailyMarketQuotes(connected: boolean, generation: number, brokerId: string | null, selectedSymbol: string) {
  const key = `${brokerId}:${generation}`
  const cache = useRef<{ key: string; publishedKey: string; day: number | null; raw: SymbolQuote[]; quotes: SymbolQuote[];
    snapshot: DailySnapshot | null; rangeChecks: Map<string, number> }>(
    { key: '', publishedKey: '', day: null, raw: [], quotes: [], snapshot: null, rangeChecks: new Map() })
  const [result, setResult] = useState({ key: '', quotes: noQuotes })
  // Publish from transport callbacks, retaining row and array identities. No render
  // reads clocks/refs or starts another effect just to derive the quote values.
  const publish = useCallback((raw?: SymbolQuote[], snapshot?: DailySnapshot | null) => {
    const now = Date.now(), day = pepperstoneDay(now)
    const state = cache.current
    if (state.key !== key) Object.assign(state, { key, raw: [], quotes: [], snapshot: null, day, rangeChecks: new Map() })
    if (state.day !== day) Object.assign(state, { day, quotes: [], snapshot: null, rangeChecks: new Map() })
    if (raw) state.raw = retainSymbolQuotes(state.raw, raw)
    if (snapshot !== undefined) state.snapshot = snapshot
    const daily = state.snapshot
    const valid = brokerId === 'Pepperstone-Demo' && daily?.source_id === brokerId && daily.generation === generation
      && daily.day === day && now / 1000 - daily.observed_at < 30
    const old = new Map(state.quotes.map(quote => [quote.symbol, quote]))
    const next = state.raw.map(quote => {
      const record = valid ? daily.symbols[quote.symbol] : undefined, close = record?.previous_close
      const rangeValid = record && now / 1000 - record.checked_at < 30 && record.high != null && record.low != null
      const previous = record?.checked_at === state.rangeChecks.get(quote.symbol) ? old.get(quote.symbol) : undefined
      if (record) state.rangeChecks.set(quote.symbol, record.checked_at)
      return { ...quote, dailyChange: close != null && Number.isFinite(close) && close > 0 && quote.bid > 0
        ? (quote.bid / close - 1) * 100 : null,
      dailyHigh: rangeValid ? Math.max(record.high!, quote.bid, previous?.dailyHigh ?? -Infinity) : null,
      dailyLow: rangeValid ? Math.min(record.low!, quote.bid, previous?.dailyLow ?? Infinity) : null }
    })
    const quotes = retainSymbolQuotes(state.quotes, next)
    const changed = state.quotes !== quotes || state.publishedKey !== key
    state.quotes = quotes
    if (changed) { state.publishedKey = key; setResult({ key, quotes }) }
  }, [brokerId, generation, key])
  const updateQuotes = useCallback((raw: SymbolQuote[]) => publish(raw), [publish])
  const symbols = connected && result.key === key ? result.quotes : noQuotes
  const names = symbols.map(quote => quote.symbol).join('\0')
  const selected = symbols.some(quote => quote.symbol === selectedSymbol) ? selectedSymbol : symbols[0]?.symbol ?? ''
  useEffect(() => {
    if (!connected || brokerId !== 'Pepperstone-Demo' || !names) return
    let disposed = false, timer: number | undefined
    let controller: AbortController | undefined
    const pollDaily = async () => {
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 20_000)
      try {
        const response = await fetch('/storage-api/market-watch/daily', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: brokerId, generation, symbols: names.split('\0'), selected }) })
        if (!response.ok) throw new Error('Daily candles unavailable')
        const next = await response.json() as DailySnapshot
        if (!disposed && next.source_id === brokerId && next.generation === generation && next.day === pepperstoneDay(Date.now())) {
          publish(undefined, next)
        }
      } catch {
        if (!disposed) publish(undefined, null)
      } finally {
        window.clearTimeout(timeout)
        if (!disposed) timer = window.setTimeout(pollDaily, 5_000)
      }
    }
    void pollDaily()
    return () => { disposed = true; controller?.abort(); if (timer) window.clearTimeout(timer) }
  }, [brokerId, connected, generation, names, selected, publish])
  return { symbols, updateQuotes }
}
