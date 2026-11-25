import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { IChartApi, LogicalRange, MouseEventParams, Time } from 'lightweight-charts'
import { chartClockToUtc } from '../../../appearance/time-display/chart-clock'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'
import { bridgeRequest } from '../../../system-connectivity/bridge-status/bridge-client'
import { timeframeToSeconds } from '../../chart-drawings/position-drawing-geometry'
import type { ChartTimeframe } from '../../contracts/ChartTimeframe'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { tickDeltaColor, type TickDeltaPlotOptions, type TickDeltaPoint } from './tick-delta-pane'
import type { TickDeltaLine, TickDeltaLines, TickDeltaView } from './volume-preferences'
import { useTickDeltaHistory, type TickCounts } from './use-tick-delta-history'
import './candle-activity.css'

type CurrencyActivity = { rows: { currency: string; updates: number | null; missing: string[] }[] }
const count = new Intl.NumberFormat()
const tickDeltaLineLabels = [['up', 'Upticks'], ['down', 'Downticks'], ['delta', 'Delta']] as const

function useCandleReading<T>(request: string | null, refreshUntil?: number | null) {
  const [retry, setRetry] = useState(0)
  const key = request ? `${request}:${retry}` : null
  const [reading, setReading] = useState<{ key: string; data?: T; error?: string } | null>(null)
  useEffect(() => {
    if (!key || !request) return
    const controller = new AbortController()
    let timer: number | undefined
    const read = async () => {
      const started = Date.now()
      try {
        const data = await bridgeRequest<T>(request, controller.signal)
        if (!controller.signal.aborted) setReading({ key, data })
      } catch (error) {
        if (!controller.signal.aborted) setReading({ key, error: error instanceof Error ? error.message : 'MT5 data unavailable' })
      } finally {
        if (!controller.signal.aborted && (refreshUntil === null || (refreshUntil !== undefined && started < refreshUntil))) {
          const delay = refreshUntil === null ? 20_000 : Math.max(0, Math.min(20_000, refreshUntil - Date.now() + 1000))
          timer = window.setTimeout(read, delay)
        }
      }
    }
    void read()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [key, request, refreshUntil])
  return { current: reading?.key === key ? reading : null, retry: () => setRetry(value => value + 1) }
}

export type CandleActivityProps = {
  bars: OhlcBar[]
  symbol: string; timeframe: ChartTimeframe; synthetic: boolean; canRank: boolean; connected: boolean; generation: number
  upColor: string; downColor: string
  tickDeltaView: TickDeltaView; onTickDeltaViewChange: (view: TickDeltaView) => void
  tickDeltaLines: TickDeltaLines; onToggleTickDeltaLine: (line: TickDeltaLine) => void
  tickDeltaAxis: TickDeltaLine; onTickDeltaAxisChange: (line: TickDeltaLine) => void
}

export function CandleActivityControls({ chart, bars, symbol, timeframe, synthetic, canRank,
  connected, upColor, downColor, tickDeltaView, onTickDeltaViewChange, tickDeltaLines, onToggleTickDeltaLine,
  tickDeltaAxis, onTickDeltaAxisChange, onPlot }: CandleActivityProps & {
  chart: IChartApi
  onPlot: (rows: ReadonlyMap<number, TickDeltaPoint>, options: TickDeltaPlotOptions) => void
}) {
  const clock = useDisplayClock()
  const [showRanking, setShowRanking] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [viewport, setViewport] = useState<{ from: number; to: number } | null>(null)
  const ranking = canRank && showRanking
  const paneView = ranking ? 'currency' : tickDeltaView
  const axis = tickDeltaLines[tickDeltaAxis] ? tickDeltaAxis : tickDeltaLineLabels.find(([line]) => tickDeltaLines[line])?.[0]
  const selectTickView = (view: TickDeltaView) => {
    onTickDeltaViewChange(view)
    setShowRanking(false)
  }
  useEffect(() => {
    const scale = chart.timeScale()
    const readViewport = (range: LogicalRange | null) => {
      if (!range) return
      const from = Math.floor(range.from), to = Math.ceil(range.to)
      setViewport(current => current?.from === from && current.to === to ? current : { from, to })
    }
    const follow = (event: MouseEventParams<Time>) => setHover(event.point && typeof event.time === 'number' ? event.time : null)
    readViewport(scale.getVisibleLogicalRange())
    scale.subscribeVisibleLogicalRangeChange(readViewport)
    chart.subscribeCrosshairMove(follow)
    return () => { scale.unsubscribeVisibleLogicalRangeChange(readViewport); chart.unsubscribeCrosshairMove(follow) }
  }, [chart])

  const last = bars.at(-1)?.time
  const hoverIndex = hover === null ? -1 : bars.findIndex(bar => bar.time === hover)
  const start = hoverIndex >= 0 ? bars[hoverIndex].time : last
  const step = timeframeToSeconds(timeframe)
  const end = last === undefined ? undefined : chartClockToUtc((last + step) * 1000, clock.scope)
  const path = `symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
  const wanted = useMemo(() => {
    const from = Math.max(0, Math.min(viewport?.from ?? bars.length - 32, bars.length - 1) - 8)
    const to = Math.max(from, Math.min(bars.length - 1, (viewport?.to ?? bars.length - 1) + 3))
    const times = bars.slice(from, to).map(bar => Number(bar.time))
    if (start !== undefined && start !== last && !times.includes(start)) times.push(start)
    return times.sort((a, b) => a - b)
  }, [bars, viewport, start, last])
  const { history, save } = useTickDeltaHistory(connected && !ranking ? path : null, wanted, start ?? null, step)
  const live = useCandleReading<TickCounts>(connected && !ranking && last !== undefined ? `/candle-ticks?${path}&start=${last}` : null, end)
  const fallback = useCandleReading<TickCounts>(connected && !ranking && start !== undefined && start !== last && history.get(start) === null
    ? `/candle-ticks?${path}&start=${start}` : null)
  const rank = useCandleReading<CurrencyActivity>(connected && ranking && start !== undefined
    ? `/currency-activity?timeframe=${timeframe}&start=${start}` : null, start === last ? end : undefined)
  const recovered = fallback.current?.data
  useEffect(() => { if (start !== undefined && recovered) save(start, recovered) }, [start, recovered, save])
  const liveTicks = live.current?.data
  const first = bars[0]?.time
  const visiblePoints = useMemo(() => {
    const points = new Map<number, TickDeltaPoint>()
    if (first === undefined || last === undefined) return points
    for (const [time, counts] of history) if (counts && time >= first && time < last) points.set(time, counts)
    if (liveTicks) points.set(last, liveTicks)
    return points
  }, [history, first, last, liveTicks])
  useLayoutEffect(() => onPlot(visiblePoints, { upColor, downColor, view: paneView, lines: tickDeltaLines, axis }),
    [onPlot, visiblePoints, upColor, downColor, paneView, tickDeltaLines, axis])

  const current = ranking ? rank : start === last ? live : fallback
  const ticks = !ranking && start !== undefined ? start === last ? liveTicks : history.get(start) ?? recovered : undefined
  const ranks = ranking ? rank.current?.data?.rows : undefined
  const delta = ticks && ticks.up - ticks.down
  const activitySource = synthetic ? 'Synthetic basket Bid moves' : 'Bid/ask midpoint moves'
  const barsView = paneView === 'bars'
  const lineView = paneView === 'line'
  const showUp = barsView || (lineView && tickDeltaLines.up)
  const showDown = barsView || (lineView && tickDeltaLines.down)
  const showDelta = barsView || (lineView && tickDeltaLines.delta)
  return <section className="candle-activity-pane" aria-label="Candle volume">
    <div className="candle-activity-toolbar">
      <div className="volume-controls" role="group" aria-label="Volume view">
        <button type="button" aria-pressed={barsView} onClick={() => selectTickView('bars')}>Uptick / Downtick Bars</button>
        <button type="button" aria-pressed={lineView} onClick={() => selectTickView('line')}>Delta Line</button>
        {canRank && <button type="button" aria-pressed={ranking} onClick={() => setShowRanking(true)}>Currency Activity</button>}
      </div>
      {lineView && <div className="volume-controls tick-delta-line-controls" role="group" aria-label="Tick Delta axis and visibility">
        {tickDeltaLineLabels.map(([line, label]) => <div className="tick-delta-line-control" key={line}>
          <input type="checkbox" aria-label={`Show ${label.toLowerCase()} line`} checked={tickDeltaLines[line]}
            onChange={() => onToggleTickDeltaLine(line)} />
          <button type="button" aria-label={`Resize ${label.toLowerCase()} axis`} title="Select this line, then drag the right y-axis"
            aria-pressed={axis === line} disabled={!tickDeltaLines[line]} onClick={() => onTickDeltaAxisChange(line)}>{label}</button>
        </div>)}
      </div>}
      <span className="candle-activity-time" title={ranking ? 'Selected candle' : activitySource}>
        {start === undefined ? 'No candles available' : clock.chart(start * 1000)}
      </span>
    </div>
    {!connected ? <p role="status">Waiting for MT5.</p> : start !== undefined && !ticks && !ranks && !current.current
      ? <p role="status">Reading candle data…</p> : null}
    {current.current?.error && <div className="volume-controls"><span role="status">{current.current.error}</span><button type="button" onClick={current.retry}>Retry</button></div>}
    {ticks && delta !== undefined && (showUp || showDown || showDelta) && <dl className="candle-tick-counts" aria-label="Tick Delta">
      {showUp && <div><dt>Upticks</dt><dd style={{ color: upColor }}>{count.format(ticks.up)}</dd></div>}
      {showDown && <div><dt>Downticks</dt><dd style={{ color: downColor }}>{count.format(ticks.down)}</dd></div>}
      {barsView && <div><dt>Unchanged</dt><dd>{count.format(ticks.flat)}</dd></div>}
      {showDelta && <div><dt>Tick Delta</dt><dd style={lineView ? { color: tickDeltaColor } : undefined}>{delta > 0 ? '+' : ''}{count.format(delta)}</dd></div>}
      {barsView && ticks.unknown > 0 && <div><dt>Unclassified</dt><dd>{count.format(ticks.unknown)}</dd></div>}
    </dl>}
    {ranks && <div className="candle-currency-ranking">
      <table><caption title="Each pair’s updates count toward both currencies">Broker ticks across seven pairs</caption>
        <thead><tr>{ranks.map(row => <th key={row.currency} scope="col">{row.currency}</th>)}</tr></thead>
        <tbody><tr>{ranks.map(row => <td key={row.currency}>{row.updates === null
          ? <span title={`Missing ${row.missing.join(', ')}`}>Unavailable</span> : count.format(row.updates)}</td>)}</tr></tbody>
      </table>
    </div>}
  </section>
}
