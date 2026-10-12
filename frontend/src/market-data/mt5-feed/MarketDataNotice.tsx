import { useEffect, useState } from 'react'
import type { FeedStatus } from './use-mt5-market-data'
import './market-data-notice.css'

type MarketDataNoticeProps = {
  status: FeedStatus
  symbol: string
  timeframe: string
  error: string | null
}

export function MarketDataNotice({ status, symbol, timeframe, error }: MarketDataNoticeProps) {
  if (status === 'live') return null
  const title = status === 'loading'
    ? `Loading ${symbol} ${timeframe}`
    : status === 'stale'
      ? `Live refresh paused for ${symbol} ${timeframe}`
      : status === 'waiting'
        ? 'Waiting for MT5'
        : `Unable to load ${symbol} ${timeframe}`
  return (
    <div className={`market-data-notice ${status}`} role="status">
      <i />
      <div>
        <strong>{title}</strong>
        <span>{error ?? (status === 'loading' ? 'Requesting broker candle history…' : 'Start MT5 and wait for the bridge to connect.')}</span>
      </div>
    </div>
  )
}

type CandleHistoryLoadingNoticeProps = {
  symbol: string
  timeframe: string
}

export function CandleHistoryLoadingNotice({ symbol, timeframe }: CandleHistoryLoadingNoticeProps) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - started)
    }, 100)
    return () => window.clearInterval(timer)
  }, [symbol, timeframe])

  const elapsedSec = (elapsedMs / 1000).toFixed(1)

  return (
    <div className="market-data-notice loading" role="status">
      <i />
      <div>
        <strong>
          Loading older candles
          <span className="market-data-elapsed-badge">{elapsedSec}s</span>
        </strong>
        <span>Requesting broker candle history for {symbol} {timeframe}…</span>
      </div>
    </div>
  )
}
