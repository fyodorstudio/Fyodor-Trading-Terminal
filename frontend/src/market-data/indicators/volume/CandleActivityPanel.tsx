import { useEffect, useState } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import { chartClockToUtc } from '../../../appearance/time-display/chart-clock'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'
import { bridgeRequest } from '../../../system-connectivity/bridge-status/bridge-client'
import { timeframeToSeconds } from '../../chart-drawings/position-drawing-geometry'
import type { ChartTimeframe } from '../../contracts/ChartTimeframe'
import type { OhlcBar } from '../../contracts/OhlcBar'
import './candle-activity.css'

type TickCounts = { up: number; down: number; flat: number; unknown: number; synthetic: boolean }
type CurrencyActivity = { rows: { currency: string; updates: number | null; missing: string[] }[] }
type Reading = { key: string; data?: TickCounts | CurrencyActivity; error?: string }
const count = new Intl.NumberFormat()

export function CandleTickPicker({ chart, bars, onSelect }: {
  chart: IChartApi; bars: OhlcBar[]; onSelect: (time: number) => void
}) {
  useEffect(() => {
    const pick = (event: MouseEventParams<Time>) => {
      const { point, time, paneIndex } = event
      if (chart.chartElement().dataset.ledgerPicking || !point || typeof time !== 'number' ||
          (paneIndex != null && paneIndex !== 0) || point.x < 0 || point.x >= chart.timeScale().width() ||
          point.y < 0 || point.y >= chart.paneSize(0).height) return
      if (bars.some(bar => bar.time === time)) onSelect(time)
    }
    chart.subscribeClick(pick)
    return () => chart.unsubscribeClick(pick)
  }, [chart, bars, onSelect])
  return null
}

export function CandleActivityPanel({ bars, selectedTime, onSelect, symbol, timeframe, synthetic, canRank,
  connected, generation, upColor, downColor, onClose }: {
  bars: OhlcBar[]; selectedTime: number | null; onSelect: (time: number | null) => void
  symbol: string; timeframe: ChartTimeframe; synthetic: boolean; canRank: boolean; connected: boolean; generation: number
  upColor: string; downColor: string; onClose: () => void
}) {
  const clock = useDisplayClock()
  const [showRanking, setShowRanking] = useState(false)
  const [reading, setReading] = useState<Reading | null>(null)
  const [retry, setRetry] = useState(0)
  const ranking = canRank && showRanking
  const pinned = selectedTime === null ? -1 : bars.findIndex(bar => Number(bar.time) === selectedTime)
  const index = pinned >= 0 ? pinned : bars.length - 1
  const start = bars[index]?.time
  const latest = index === bars.length - 1
  const request = start === undefined ? null : ranking
    ? `/currency-activity?timeframe=${timeframe}&start=${start}`
    : `/candle-ticks?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&start=${start}`
  const end = start === undefined ? null : chartClockToUtc((start + timeframeToSeconds(timeframe)) * 1000, clock.scope)
  const key = connected && request ? `${generation}:${request}:${retry}` : null
  const current = reading?.key === key ? reading : null

  useEffect(() => {
    if (!key || !request) return
    const controller = new AbortController()
    let timer: number | undefined
    const read = async () => {
      const started = Date.now()
      try {
        const data = await bridgeRequest<TickCounts | CurrencyActivity>(request, controller.signal)
        if (!controller.signal.aborted) setReading({ key, data })
      } catch (error) {
        if (!controller.signal.aborted) setReading({ key, error: error instanceof Error ? error.message : 'MT5 data unavailable' })
      } finally {
        // Finish one read before scheduling the next and refresh the closing candle once.
        if (!controller.signal.aborted && latest && (end === null || started < end)) {
          const delay = end === null ? 20_000 : Math.max(0, Math.min(20_000, end - Date.now() + 1000))
          timer = window.setTimeout(read, delay)
        }
      }
    }
    void read()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [key, request, latest, end])

  const ticks = current?.data && 'up' in current.data ? current.data : undefined
  const ranks = current?.data && 'rows' in current.data ? current.data.rows : undefined
  const directional = ticks ? ticks.up + ticks.down : 0
  return <aside className="candle-activity-panel" aria-label="Candle volume">
    <header><strong>Candle volume</strong><button type="button" onClick={onClose} aria-label="Close Candle volume">×</button></header>
    {canRank && <div className="candle-activity-switch" role="group" aria-label="Volume view">
      <button type="button" aria-pressed={!ranking} onClick={() => setShowRanking(false)}>Tick Delta</button>
      <button type="button" aria-pressed={ranking} onClick={() => setShowRanking(true)}>Currency Activity</button>
    </div>}
    <strong>{symbol} · {timeframe}</strong>
    <div className="candle-activity-time">{start === undefined ? 'No candles available' : clock.chart(start * 1000)}</div>
    <div className="candle-activity-switch" role="group" aria-label="Select candle">
      <button type="button" aria-label="Previous candle" disabled={index <= 0} onClick={() => onSelect(bars[index - 1].time)}>‹</button>
      <button type="button" aria-label="Next candle" disabled={latest} onClick={() => onSelect(bars[index + 1].time)}>›</button>
      <button type="button" aria-pressed={pinned < 0} onClick={() => onSelect(null)}>Latest</button>
    </div>
    <p className="candle-activity-note">Click a candle to inspect it.</p>
    {!ranking && <p className="candle-activity-note">{synthetic ? 'Synthetic basket Bid moves' : 'Bid/ask midpoint moves'} · Quote pressure</p>}
    {!connected ? <p role="status">Waiting for MT5.</p> : request && !current ? <p role="status">Reading candle data…</p> : null}
    {current?.error && <div><p role="status">{current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {ticks && <div aria-label="Tick Delta">
      {directional > 0 && <div className="candle-tick-balance" aria-hidden="true">
        <span style={{ flexGrow: ticks.up, backgroundColor: upColor }} />
        <span style={{ flexGrow: ticks.down, backgroundColor: downColor }} />
      </div>}
      <dl className="candle-tick-counts">
        <div><dt>Upticks</dt><dd>{count.format(ticks.up)}</dd></div>
        <div><dt>Downticks</dt><dd>{count.format(ticks.down)}</dd></div>
        <div><dt>Unchanged</dt><dd>{count.format(ticks.flat)}</dd></div>
        <div><dt>Tick Delta</dt><dd>{ticks.up > ticks.down ? '+' : ''}{count.format(ticks.up - ticks.down)}</dd></div>
        {ticks.unknown > 0 && <div><dt>Unclassified</dt><dd>{count.format(ticks.unknown)}</dd></div>}
      </dl>
    </div>}
    {ranks && <>
      <table><caption>Broker ticks across seven pairs</caption>
        <thead><tr><th scope="col">Currency</th><th scope="col">Updates</th></tr></thead>
        <tbody>{ranks.map(row => <tr key={row.currency}><th scope="row">{row.currency}</th>
          <td>{row.updates === null ? <span title={`Missing ${row.missing.join(', ')}`}>Unavailable</span> : count.format(row.updates)}</td></tr>)}</tbody>
      </table>
      <p className="candle-activity-note">Pair activity counts for both currencies.</p>
    </>}
  </aside>
}
