import { useEffect, useMemo, useState } from 'react'
import type { IChartApi, ISeriesApi, ISeriesPrimitive, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import { chartClockToUtc } from '../appearance/time-display/chart-clock'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { claimChartClick } from '../market-data/candlestick-chart/chart-click-selection'
import { useWildcards } from './useWildcards'
import { containingWildcardCandle, wildcardChartTime, type WildcardEntry } from './wildcard-model'

export function WildcardChartLayer({ chartApi, seriesApi, bars, step, visible, context }: {
  chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time>; bars: OhlcBar[]; step: number; visible: boolean; context: string
}) {
  const { snapshot, placing, setPlacing, openNew, openEntry, openDay } = useWildcards(), { scope } = useDisplayClock()
  const [positions, setPositions] = useState<{ x: number; items: WildcardEntry[] }[]>([])
  const [height, setHeight] = useState(0)
  const indexed = useMemo(() => {
    const groups = new Map<number, WildcardEntry[]>()
    for (const entry of snapshot?.items ?? []) {
      if (entry.archived) continue
      const time = wildcardChartTime(entry, scope)
      const candle = time === null ? null : containingWildcardCandle(time, bars, step)
      if (candle !== null) groups.set(candle, [...(groups.get(candle) ?? []), entry])
    }
    return [...groups].sort(([a], [b]) => a - b)
  }, [snapshot?.items, scope, bars, step])
  useEffect(() => { setPlacing(false) }, [context, setPlacing])
  useEffect(() => {
    if (!placing) return
    const chart = chartApi.chartElement(), original = chart.style.cursor
    chart.style.cursor = 'crosshair'
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setPlacing(false) } }
    const pick = (event: MouseEventParams<Time>) => {
      if (!event.point || typeof event.time !== 'number' || event.paneIndex != null && event.paneIndex !== 0
        || event.point.y < 0 || event.point.y >= chartApi.paneSize(0).height || event.point.x < 0 || event.point.x >= chartApi.timeScale().width()
        || !bars.some(bar => bar.time === event.time)) return
      const utc = chartClockToUtc(event.time * 1000, scope)
      if (utc !== null) { claimChartClick(event); openNew(utc) }
    }
    chartApi.subscribeClick(pick); window.addEventListener('keydown', cancel, true)
    return () => { chart.style.cursor = original; chartApi.unsubscribeClick(pick); window.removeEventListener('keydown', cancel, true) }
  }, [placing, chartApi, bars, scope, openNew, setPlacing])
  useEffect(() => {
    if (!visible) return
    const scale = chartApi.timeScale()
    let frame: number | null = null
    const update = () => {
      frame = null
      const next: typeof positions = []
      for (const [time, items] of indexed) {
        const x = scale.timeToCoordinate(time as Time)
        if (x === null || x < 0 || x > scale.width()) continue
        const previous = next.at(-1)
        if (previous && x - previous.x < 27) previous.items.push(...items)
        else next.push({ x, items: [...items] })
      }
      setPositions(old => old.length === next.length && old.every((position, i) => position.x === next[i].x && position.items.length === next[i].items.length && position.items.every((entry, j) => entry === next[i].items[j])) ? old : next)
      setHeight(chartApi.paneSize(0).height)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    const primitive: ISeriesPrimitive<Time> = { paneViews: () => [{ renderer: () => ({ draw: schedule }) }] }
    seriesApi.attachPrimitive(primitive); update()
    scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame !== null) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule); seriesApi.detachPrimitive(primitive) }
  }, [visible, chartApi, seriesApi, indexed])
  return <div className="wildcard-chart-layer" aria-label="Wildcard chart icons">
    {placing && <span className="wildcard-chart-hint">Click a candle to add a wildcard · Escape to cancel</span>}
    {visible && positions.map(position => <button type="button" className="wildcard-chart-icon" key={position.items[0].id} style={{ left: position.x, top: Math.max(0, height - 63) }}
      title={position.items.map(entry => `${entry.title}\n${entry.details}`).join('\n\n')} aria-label={position.items.length === 1 ? `Wildcard: ${position.items[0].title}` : `${position.items.length} wildcards`}
      onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (position.items.length === 1) openEntry(position.items[0]); else openDay(position.items[0].date, position.items) }}>✦{position.items.length > 1 ? position.items.length : ''}</button>)}
  </div>
}
