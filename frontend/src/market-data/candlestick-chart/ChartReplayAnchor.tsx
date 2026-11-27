import { useEffect } from 'react'
import type { IChartApi, IPrimitivePaneRenderer, ISeriesApi, ISeriesPrimitive, MouseEventParams, Time, UTCTimestamp } from 'lightweight-charts'
import type { OhlcBar } from '../contracts/OhlcBar'
import { claimChartClick } from './chart-click-selection'

export type ReplayAnchorSelection = {
  anchor: number | null
  onPick?: (time: number) => boolean
  onCancel: () => void
}

export function ChartReplayAnchor({ chart, series, bars, anchor, onPick, onCancel }: ReplayAnchorSelection & {
  chart: IChartApi; series: ISeriesApi<'Candlestick', Time>; bars: readonly OhlcBar[]
}) {
  useEffect(() => {
    if (!onPick) return
    function pick(event: MouseEventParams<Time>) {
      const { point, time, paneIndex } = event
      const scale = chart.timeScale()
      if (!point || typeof time !== 'number' || (paneIndex != null && paneIndex !== 0)
        || point.x < 0 || point.x >= scale.width() || point.y < 0 || point.y >= chart.paneSize(0).height) return
      const index = scale.timeToIndex(time)
      const candle = index === null ? undefined : bars[index]
      if (candle?.time === time && !candle.closeOnly && onPick?.(time)) claimChartClick(event)
    }
    function cancel(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
    chart.subscribeClick(pick)
    window.addEventListener('keydown', cancel, true)
    return () => { chart.unsubscribeClick(pick); window.removeEventListener('keydown', cancel, true) }
  }, [chart, bars, onPick, onCancel])

  useEffect(() => {
    if (anchor === null) return
    const renderer: IPrimitivePaneRenderer = {
      draw(target) {
        const x = chart.timeScale().timeToCoordinate(anchor as UTCTimestamp)
        if (x === null) return
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          if (x < 0 || x > mediaSize.width) return
          context.save()
          context.strokeStyle = getComputedStyle(chart.chartElement()).getPropertyValue('--accent').trim() || '#6689df'
          context.setLineDash([4, 4])
          context.beginPath()
          context.moveTo(Math.round(x) + 0.5, 0)
          context.lineTo(Math.round(x) + 0.5, mediaSize.height)
          context.stroke()
          context.restore()
        })
      },
    }
    const primitive: ISeriesPrimitive<Time> = { paneViews: () => [{ renderer: () => renderer }] }
    series.attachPrimitive(primitive)
    return () => series.detachPrimitive(primitive)
  }, [anchor, chart, series])
  return null
}
