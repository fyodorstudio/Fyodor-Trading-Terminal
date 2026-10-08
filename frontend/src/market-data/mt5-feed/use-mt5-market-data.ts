import { useCallback, useEffect, useRef, useState } from 'react'
import type { UTCTimestamp } from 'lightweight-charts'
import { BridgeRequestError, bridgeRequest } from '../../system-connectivity/bridge-status/bridge-client'
import { useActivityActions } from '../../system-observability/activity-log/use-activity-log'
import { replaceRecentBars, retainSymbolQuotes } from './market-snapshots'
import type { ChartTimeframe } from '../contracts/ChartTimeframe'
import type { OhlcBar } from '../contracts/OhlcBar'
import type { SymbolQuote } from '../contracts/SymbolQuote'

type MarketWatchResponse = {
  symbols: Array<{
    symbol: string
    description: string
    bid: number
    ask: number
    daily_change: number
    precision: number
  }>
  observed_at: number
  duration_ms: number
}

type OhlcResponse = {
  symbol: string
  timeframe: ChartTimeframe
  bars: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    tick_volume: number
  }>
  start_pos: number
  next_start_pos: number
  has_older: boolean
  observed_at: number
  duration_ms: number
  source_generation: number
}

type ChartHistoryState = {
  key: string | null
  loading: boolean
  complete: boolean
}

export type FeedStatus = 'waiting' | 'loading' | 'live' | 'stale' | 'unavailable'

export type Mt5MarketData = {
  activeSymbol: string
  symbols: SymbolQuote[]
  bars: OhlcBar[]
  marketWatchStatus: FeedStatus
  chartStatus: FeedStatus
  marketWatchError: string | null
  chartError: string | null
  chartHistoryLoading: boolean
  chartHistoryComplete: boolean
  requestOlderBars: () => void
}

function toBars(response: OhlcResponse): OhlcBar[] {
  return response.bars.map((bar) => ({
    time: bar.time as UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }))
}

function mergeBars(older: OhlcBar[], current: OhlcBar[]) {
  const byTime = new Map<number, OhlcBar>()
  for (const bar of older) byTime.set(bar.time as number, bar)
  for (const bar of current) byTime.set(bar.time as number, bar)
  return [...byTime.values()].sort((left, right) => (left.time as number) - (right.time as number))
}

export function useMt5MarketData(
  connected: boolean,
  sourceGeneration: number,
  selectedSymbol: string,
  timeframe: ChartTimeframe,
): Mt5MarketData {
  const { appendActivity } = useActivityActions()
  const [symbols, setSymbols] = useState<SymbolQuote[]>([])
  const [bars, setBars] = useState<OhlcBar[]>([])
  const [marketWatchStatus, setMarketWatchStatus] = useState<FeedStatus>('waiting')
  const [chartStatus, setChartStatus] = useState<FeedStatus>('waiting')
  const [marketWatchError, setMarketWatchError] = useState<string | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [marketGeneration, setMarketGeneration] = useState<number | null>(null)
  const [marketAttemptGeneration, setMarketAttemptGeneration] = useState<number | null>(null)
  const [chartDataKey, setChartDataKey] = useState<string | null>(null)
  const [chartAttemptKey, setChartAttemptKey] = useState<string | null>(null)
  const [historyState, setHistoryState] = useState<ChartHistoryState>({ key: null, loading: false, complete: false })
  const marketWasLive = useRef(false)
  const chartWasLive = useRef(false)
  const marketGenerationRef = useRef<number | null>(null)
  const chartDataKeyRef = useRef<string | null>(null)
  const barsRef = useRef<OhlcBar[]>([])
  const lastFullFetchAtRef = useRef(0)
  const historyRequestRef = useRef<() => void>(() => undefined)
  const requestOlderBars = useCallback(() => historyRequestRef.current(), [])

  useEffect(() => {
    if (!connected) return
    marketWasLive.current = false
    let disposed = false
    let timer: number | undefined
    let controller: AbortController | null = null

    const poll = async () => {
      controller = new AbortController()
      setMarketAttemptGeneration(sourceGeneration)
      setMarketWatchStatus((current) => current === 'live' ? current : 'loading')
      try {
        const response = await bridgeRequest<MarketWatchResponse>('/market-watch', controller.signal)
        if (disposed) return
        const nextSymbols = response.symbols.map((symbol) => ({
          symbol: symbol.symbol,
          description: symbol.description,
          bid: symbol.bid,
          ask: symbol.ask,
          dailyChange: symbol.daily_change,
          precision: symbol.precision,
        }))
        setSymbols(current => retainSymbolQuotes(current, nextSymbols))
        setMarketGeneration(sourceGeneration)
        marketGenerationRef.current = sourceGeneration
        setMarketWatchStatus('live')
        setMarketWatchError(null)
        if (!marketWasLive.current) {
          appendActivity('Market Watch', 'Broker symbols loaded', `${nextSymbols.length} visible symbols`, { severity: 'success' })
        }
        marketWasLive.current = true
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return
        const message = error instanceof Error ? error.message : 'Market Watch request failed'
        setMarketWatchStatus(marketGenerationRef.current === sourceGeneration ? 'stale' : 'unavailable')
        setMarketWatchError(message)
        if (marketWasLive.current) {
          appendActivity('Market Watch', 'Broker symbols stale', message, { severity: 'warning' })
        }
        marketWasLive.current = false
      } finally {
        if (!disposed) timer = window.setTimeout(poll, 2_500)
      }
    }

    void poll()
    return () => {
      disposed = true
      controller?.abort()
      if (timer) window.clearTimeout(timer)
    }
  }, [appendActivity, connected, sourceGeneration])

  const symbolsAreCurrent = connected && marketGeneration === sourceGeneration
  const currentSymbols = symbolsAreCurrent ? symbols : []
  const activeSymbol = currentSymbols.some((symbol) => symbol.symbol === selectedSymbol)
    ? selectedSymbol
    : currentSymbols[0]?.symbol ?? selectedSymbol
  const requestedChartKey = `${sourceGeneration}:${activeSymbol}:${timeframe}`

  useEffect(() => {
    if (!connected || !activeSymbol) return
    let disposed = false
    let timer: number | undefined
    let controller: AbortController | null = null
    let olderController: AbortController | null = null
    let olderLoading = false
    let hasOlder = false
    let nextHistoryStart = 0
    chartWasLive.current = false
    lastFullFetchAtRef.current = 0

    const loadOlder = async () => {
      if (disposed || olderLoading || !hasOlder || chartDataKeyRef.current !== requestedChartKey) return
      olderLoading = true
      setHistoryState({ key: requestedChartKey, loading: true, complete: false })
      olderController = new AbortController()
      const requestedStart = nextHistoryStart
      try {
        const response = await bridgeRequest<OhlcResponse>(
          `/ohlc?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${timeframe}&start_pos=${requestedStart}&count=5000`,
          olderController.signal,
        )
        if (
          disposed
          || response.symbol !== activeSymbol
          || response.timeframe !== timeframe
          || response.start_pos !== requestedStart
          || chartDataKeyRef.current !== requestedChartKey
        ) return
        const receivedBars = toBars(response)
        const nextBars = mergeBars(receivedBars, barsRef.current)
        barsRef.current = nextBars
        setBars(nextBars)
        nextHistoryStart = response.next_start_pos
        hasOlder = response.has_older
        setHistoryState({ key: requestedChartKey, loading: false, complete: !response.has_older })
        appendActivity(
          'Chart',
          response.has_older ? 'Older MT5 history loaded' : 'Beginning of MT5 history reached',
          `${activeSymbol} ${timeframe} · ${nextBars.length} bars`,
          { severity: 'success' },
        )
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return
        if (error instanceof BridgeRequestError && error.code === 'superseded') return
        setHistoryState({ key: requestedChartKey, loading: false, complete: false })
        appendActivity(
          'Chart',
          'Older MT5 history unavailable',
          error instanceof Error ? error.message : 'History request failed',
          { severity: 'warning' },
        )
      } finally {
        olderLoading = false
        olderController = null
      }
    }
    historyRequestRef.current = () => void loadOlder()

    const poll = async () => {
      controller = new AbortController()
      setChartAttemptKey(requestedChartKey)
      const firstLoad = chartDataKeyRef.current !== requestedChartKey
      const reconciliation = !firstLoad && Date.now() - lastFullFetchAtRef.current >= 60_000
      const requestedBarCount = firstLoad ? 800 : reconciliation ? 800 : 3
      try {
        const response = await bridgeRequest<OhlcResponse>(
          `/ohlc?symbol=${encodeURIComponent(activeSymbol)}&timeframe=${timeframe}&start_pos=0&count=${requestedBarCount}`,
          controller.signal,
        )
        if (disposed || response.symbol !== activeSymbol || response.timeframe !== timeframe || response.start_pos !== 0) return
        const receivedBars = toBars(response)
        const nextBars = firstLoad ? receivedBars : replaceRecentBars(barsRef.current, receivedBars)
        if (nextBars !== barsRef.current) {
          barsRef.current = nextBars
          setBars(nextBars)
        }
        if (firstLoad) {
          nextHistoryStart = response.next_start_pos
          hasOlder = response.has_older
          setHistoryState({ key: requestedChartKey, loading: false, complete: !response.has_older })
        }
        if (firstLoad || reconciliation) lastFullFetchAtRef.current = Date.now()
        setChartDataKey(requestedChartKey)
        chartDataKeyRef.current = requestedChartKey
        setChartStatus('live')
        setChartError(null)
        if (!chartWasLive.current) {
          appendActivity('Chart', 'MT5 candle history loaded', `${activeSymbol} ${timeframe} · ${nextBars.length} bars`, { severity: 'success' })
        }
        chartWasLive.current = true
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return
        if (error instanceof BridgeRequestError && error.code === 'superseded') return
        const message = error instanceof Error ? error.message : 'OHLC request failed'
        setChartStatus(chartDataKeyRef.current === requestedChartKey ? 'stale' : 'unavailable')
        setChartError(message)
        if (chartWasLive.current) {
          appendActivity('Chart', 'MT5 candle history stale', message, { severity: 'warning' })
        }
        chartWasLive.current = false
      } finally {
        if (!disposed) timer = window.setTimeout(poll, 2_000)
      }
    }

    void poll()
    return () => {
      disposed = true
      historyRequestRef.current = () => undefined
      controller?.abort()
      olderController?.abort()
      if (timer) window.clearTimeout(timer)
    }
  }, [activeSymbol, appendActivity, connected, requestedChartKey, timeframe])

  const chartIsCurrent = connected && chartDataKey === requestedChartKey
  const marketFailureIsCurrent = marketAttemptGeneration === sourceGeneration && marketWatchStatus === 'unavailable'
  const chartFailureIsCurrent = chartAttemptKey === requestedChartKey && chartStatus === 'unavailable'
  const historyIsCurrent = historyState.key === requestedChartKey

  return {
    activeSymbol,
    symbols: currentSymbols,
    bars: chartIsCurrent ? bars : [],
    marketWatchStatus: !connected ? 'waiting' : symbolsAreCurrent ? marketWatchStatus : marketFailureIsCurrent ? 'unavailable' : 'loading',
    chartStatus: !connected ? 'waiting' : chartIsCurrent ? chartStatus : chartFailureIsCurrent ? 'unavailable' : 'loading',
    marketWatchError: connected ? marketWatchError : null,
    chartError: chartIsCurrent || chartFailureIsCurrent ? chartError : null,
    chartHistoryLoading: chartIsCurrent && historyIsCurrent && historyState.loading,
    chartHistoryComplete: chartIsCurrent && historyIsCurrent && historyState.complete,
    requestOlderBars,
  }
}
