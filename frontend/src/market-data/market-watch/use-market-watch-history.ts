import { useEffect, useMemo, useState } from 'react'
import type { SymbolQuote } from '../contracts/SymbolQuote'
import { maximumDailyChange, type DailySnapshot } from './daily-change'

export function useMarketWatchHistory(symbols: SymbolQuote[], date: string | null, brokerId: string | null | undefined,
  generation: number, selected: string) {
  const names = symbols.map(quote => quote.symbol).join('\0')
  const key = `${brokerId}:${generation}:${date}:${names}`
  const [result, setResult] = useState<{ key: string; snapshot: DailySnapshot | null; message: string | null }>(
    { key: '', snapshot: null, message: null })
  const [attempt, retry] = useState(0)
  useEffect(() => {
    if (!date || brokerId !== 'Pepperstone-Demo' || !names) return
    let disposed = false, timer: number | undefined, timeout: number | undefined, controller: AbortController | undefined, passes = 0
    const poll = async () => {
      const requestController = new AbortController()
      controller = requestController
      timeout = window.setTimeout(() => requestController.abort(), 20_000)
      try {
        const response = await fetch('/storage-api/market-watch/daily', { method: 'POST', signal: requestController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: brokerId, generation, symbols: names.split('\0'), selected, date }) })
        if (!response.ok) throw new Error('Historical daily candles unavailable.')
        const snapshot = await response.json() as DailySnapshot
        if (snapshot.source_id !== brokerId || snapshot.generation !== generation
          || snapshot.day !== Date.parse(`${date}T00:00:00Z`) / 1000) throw new Error('Historical daily candle source mismatch.')
        if (disposed) return
        const incomplete = names.split('\0').some(symbol => !snapshot.symbols[symbol])
        const unavailable = Object.values(snapshot.symbols).some(record => maximumDailyChange(record.open, record.high, record.low) == null)
        setResult({ key, snapshot, message: incomplete ? 'Loading remaining daily candles…'
          : unavailable ? 'Some daily candles are unavailable for this date. Retry to check again.' : null })
        if (incomplete && ++passes < 12) timer = window.setTimeout(poll, 5_000)
        else if (incomplete) setResult({ key, snapshot, message: 'Some daily candles are unavailable. Retry to load more.' })
      } catch {
        if (!disposed) setResult({ key, snapshot: null, message: 'Historical daily candles unavailable. Retry to load them.' })
      } finally { window.clearTimeout(timeout) }
    }
    void poll()
    return () => { disposed = true; controller?.abort(); window.clearTimeout(timeout); if (timer) window.clearTimeout(timer) }
  }, [date, brokerId, generation, names, key, selected, attempt])
  const snapshot = result.key === key ? result.snapshot : null
  const quotes = useMemo(() => date ? symbols.map(quote => {
    const record = snapshot?.symbols[quote.symbol]
    // History is a display projection only; live quotes keep feeding chart/alarms.
    return { ...quote, bid: 0, ask: 0, dailyHigh: null, dailyLow: null,
      dailyChange: maximumDailyChange(record?.open, record?.high, record?.low) }
  }) : symbols, [symbols, date, snapshot])
  const message = !date ? null : brokerId !== 'Pepperstone-Demo' ? 'Daily history is unavailable for this source.'
    : result.key !== key ? 'Loading daily candles…' : result.message
  return { quotes, message, retry: () => retry(value => value + 1) }
}
