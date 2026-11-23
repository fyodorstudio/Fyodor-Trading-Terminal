import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DrawingTimeline } from '../market-data/chart-drawings/drawing-coordinates'
import { timeframeToSeconds } from '../market-data/chart-drawings/position-drawing-geometry'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { bridgeRequest } from '../system-connectivity/bridge-status/bridge-client'
import { priceAlertQuote, type PriceAlert } from './price-alert-store'
import { maxTrendQuoteGapMs, trendAlertSample } from './trend-alert'
import { extendTrendAlertScale, trendScaleCovers } from './trend-alert-scale'

export type TrendAlertChart = { symbol: string; timeframe: ChartTimeframe; bars: DrawingTimeline }
type CandlePage = {
  symbol: string; timeframe: ChartTimeframe; bars: Array<{ time: number }>
  start_pos: number; next_start_pos: number; has_older: boolean; next_before?: number | null; source_generation: number
}
type CandleRequest = { symbol: string; timeframe: ChartTimeframe; through: number; time: number; synthetic: boolean }

async function readTrendCandles(request: CandleRequest, generation: number, signal: AbortSignal): Promise<TrendAlertChart | undefined> {
  const { symbol, timeframe, through, time, synthetic } = request
  const step = timeframeToSeconds(timeframe)
  const count = Math.min(5000, Math.max(3, Math.ceil((time - through) / step) + 2))
  let start = 0, before: number | null = null
  const pages: CandlePage['bars'][] = []
  while (!signal.aborted) {
    const response: CandlePage = await bridgeRequest<CandlePage>(`/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
      + `&start_pos=${start}&count=${count}&trend_alert=true${before === null ? '' : `&before=${before}`}`, signal)
    if (response.symbol !== symbol || response.timeframe !== timeframe || response.source_generation !== generation
      || response.start_pos !== start || !response.bars.length) return
    const first = response.bars[0].time
    const newer = pages.at(-1)
    if (newer && !synthetic && !response.bars.some(bar => bar.time === newer[0].time)) return
    if (first <= through) {
      const bars = [...new Set([...response.bars, ...pages.reverse().flat()].map(bar => bar.time))]
        .sort((a, b) => a - b).map(time => ({ time }))
      return { symbol, timeframe, bars }
    }
    if (!response.has_older) return
    pages.push(response.bars)
    if (synthetic) {
      if (response.next_before == null || (before !== null && response.next_before >= before)) return
      before = response.next_before
    } else {
      // Overlap pages so a newly inserted latest candle cannot leave a hole.
      const next = response.next_start_pos - 1
      if (next <= start) return
      start = next
    }
  }
}

export function useTrendAlertCandles(alerts: PriceAlert[], quotes: SymbolQuote[], brokerId: string | null, live: boolean, generation: number,
  chart: TrendAlertChart | undefined, onCandles: (chart: TrendAlertChart) => void) {
  const pending = useRef(new Map<string, AbortController>())
  const retryTimer = useRef<number | undefined>(undefined)
  const [retry, setRetry] = useState(0)
  useLayoutEffect(() => {
    const requests = pending.current
    return () => {
      for (const request of requests.values()) request.abort()
      requests.clear()
      window.clearTimeout(retryTimer.current)
      retryTimer.current = undefined
    }
  }, [brokerId, generation, live])

  useLayoutEffect(() => {
    if (live && chart) onCandles(chart)
  }, [live, chart, onCandles])

  useEffect(() => {
    if (!live || !brokerId) return
    const now = Date.now(), bySymbol = new Map(quotes.map(quote => [quote.symbol, quote]))
    const needed = new Map<string, CandleRequest>()
    for (const alert of alerts) {
      if (alert.brokerId !== brokerId || alert.status !== 'armed' || !alert.trend || !alert.trendScale) continue
      const quote = bySymbol.get(alert.symbol), sample = trendAlertSample(quote, priceAlertQuote(quote, now), now)
      if (!sample || sample.chartTime > alert.trend[1].time + maxTrendQuoteGapMs / 1000) continue
      const time = Math.min(sample.chartTime, alert.trend[1].time)
      const scale = chart?.symbol === alert.symbol && chart.timeframe === alert.trendScale.timeframe
        ? extendTrendAlertScale(alert.trendScale, chart.bars) : alert.trendScale
      if (trendScaleCovers(scale, time)) continue
      const key = `${alert.symbol}:${scale.timeframe}`, entry = needed.get(key)
      needed.set(key, { symbol: alert.symbol, timeframe: scale.timeframe, synthetic: quote?.synthetic === true,
        through: Math.min(scale.confirmedThrough, entry?.through ?? Infinity), time: Math.max(time, entry?.time ?? -Infinity) })
    }
    for (const [key, request] of needed) {
      if (pending.current.has(key)) continue
      const abort = new AbortController()
      pending.current.set(key, abort)
      // Quotes can remain identical across polls. Retry missing candles while
      // the queued quote is fresh even if the Market Watch snapshot is stable.
      const retryCandles = () => {
        if (abort.signal.aborted || retryTimer.current !== undefined) return
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = undefined
          setRetry(value => value + 1)
        }, 1000)
      }
      void readTrendCandles(request, generation, abort.signal).then(result => {
        if (abort.signal.aborted) return
        if (result) onCandles(result)
        const last = result?.bars.at(-1)
        if (!result || !last || last.time + timeframeToSeconds(request.timeframe) <= request.time
          || !result.bars.some(bar => bar.time === request.through)) retryCandles()
      }).catch(retryCandles).finally(() => {
        if (pending.current.get(key) === abort) pending.current.delete(key)
      })
    }
  }, [alerts, quotes, brokerId, live, generation, chart, onCandles, retry])
}
