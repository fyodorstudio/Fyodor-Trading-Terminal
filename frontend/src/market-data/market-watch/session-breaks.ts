import type { IChartApi, IPrimitivePaneRenderer, ISeriesApi, ISeriesPrimitive, Time, UTCTimestamp } from 'lightweight-charts'
import { chartClockToUtc, utcToChartClock, type ChartClockScope } from '../../appearance/time-display/chart-clock'
import { drawingCoordinates, type DrawingTimeline } from '../chart-drawings/drawing-coordinates'
import { timeframeToSeconds } from '../chart-drawings/position-drawing-geometry'
import type { ChartTimeframe } from '../contracts/ChartTimeframe'
import { forexSessionDay, forexSessionDayStart, forexSessions } from './forex-sessions'

export function createSessionBreaks(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>) {
  let timeline: DrawingTimeline = []
  let timeframe: ChartTimeframe | undefined
  let clock: ChartClockScope
  let refresh: (() => void) | undefined
  const days = new Map<number, number[]>()
  function breaks(day: number) {
    let values = days.get(day)
    if (!values) {
      values = [...new Set(forexSessions(day).sessions.flatMap(session =>
        session.windows.flatMap(window => [window.open, window.close])))]
        .filter(time => time >= day && time < day + forexSessionDay)
      days.set(day, values)
      if (days.size > 512) days.delete(days.keys().next().value!)
    }
    return values
  }
  const renderer: IPrimitivePaneRenderer = {
    draw(target) {
      const visible = chart.timeScale().getVisibleRange()
      if (!timeline.length || !visible || typeof visible.from !== 'number' || typeof visible.to !== 'number') return
      const from = chartClockToUtc(Math.max(visible.from, timeline[0].time) * 1000, clock)
      const end = chartClockToUtc(Math.min(visible.to, timeline[timeline.length - 1].time + timeframeToSeconds(timeframe)) * 1000, clock)
      if (from === null || end === null || from >= end) return
      const to = Math.min(end, Date.now())
      const coordinates = drawingCoordinates(chart, series, timeline, timeframe)
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        context.save()
        context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
        context.globalAlpha = 0.28
        context.lineWidth = 1
        context.beginPath()
        for (let day = forexSessionDayStart(from); day <= to; day += forexSessionDay) {
          for (const time of breaks(day)) {
            if (time < from || time > to) continue
            const at = utcToChartClock(time, clock)
            if (at === null) continue
            const x = coordinates.timeToX((at / 1000) as UTCTimestamp)
            if (x === null || x < 0 || x > mediaSize.width) continue
            context.moveTo(Math.round(x) + 0.5, 0)
            context.lineTo(Math.round(x) + 0.5, mediaSize.height)
          }
        }
        context.stroke()
        context.restore()
      })
    },
  }
  const views = [{ renderer: () => renderer, zOrder: () => 'bottom' as const }]
  const primitive: ISeriesPrimitive<Time> = {
    paneViews: () => views,
    attached: params => { refresh = params.requestUpdate },
  }
  series.attachPrimitive(primitive)
  return {
    update(bars: DrawingTimeline, frame: ChartTimeframe | undefined, scope: ChartClockScope) {
      timeline = bars
      timeframe = frame
      clock = scope
      refresh?.()
    },
    destroy() { series.detachPrimitive(primitive) },
  }
}
