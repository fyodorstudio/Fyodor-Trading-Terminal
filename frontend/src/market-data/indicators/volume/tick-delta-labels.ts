import type { IChartApi, IPrimitivePaneRenderer, ISeriesApi, ISeriesPrimitive, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import type { TickDeltaPoint } from './tick-delta-pane'
import { defaultVolumePreferences, type TickDeltaLabels } from './volume-preferences'

const signed = new Intl.NumberFormat(undefined, { signDisplay: 'exceptZero' })
const emptyRows = new Map<number, TickDeltaPoint>()

export function createTickDeltaLabels(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>) {
  let rows: ReadonlyMap<number, TickDeltaPoint> = emptyRows
  let bars: readonly OhlcBar[] = []
  let options = defaultVolumePreferences.tickDeltaLabels
  let hover: number | null = null
  let refresh: (() => void) | undefined
  const renderer: IPrimitivePaneRenderer = {
    draw(target) {
      const scale = chart.timeScale()
      const range = scale.getVisibleLogicalRange()
      if (!range || options.position === 'off' || !rows.size) return
      const first = Math.max(0, Math.ceil(range.from))
      const last = Math.min(bars.length - 1, Math.floor(range.to))
      const above = options.position === 'above'
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const hoverOnly = mediaSize.width / Math.max(1, range.to - range.from) < 22
        context.save()
        context.font = '600 11px Inter, sans-serif'
        context.textBaseline = 'middle'
        context.textAlign = 'center'
        let right = 0
        for (let index = first; index <= last; index++) {
          const bar = bars[index]
          if (bar.closeOnly || (hoverOnly && bar.time !== hover)) continue
          const point = rows.get(bar.time)
          if (!point) continue
          const x = scale.timeToCoordinate(bar.time)
          const y = series.priceToCoordinate(above ? bar.high : bar.low)
          if (x === null || y === null || y < 0 || y > mediaSize.height) continue
          const delta = point.up - point.down
          const label = signed.format(delta)
          const half = context.measureText(label).width / 2
          if (x - half < right || x + half > mediaSize.width) continue
          right = x + half + 5
          context.fillStyle = delta > 0 ? options.positive : delta < 0 ? options.negative : chart.options().layout.textColor
          context.fillText(label, x, Math.max(6, Math.min(mediaSize.height - 6, y + (above ? -9 : 9))))
        }
        context.restore()
      })
    },
  }
  const views = [{ renderer: () => renderer, zOrder: () => 'top' as const }]
  const primitive: ISeriesPrimitive<Time> = {
    paneViews: () => views,
    attached: params => { refresh = params.requestUpdate },
  }
  function follow(event: MouseEventParams<Time>) {
    const next = event.point && event.point.y < chart.paneSize(0).height && typeof event.time === 'number' ? event.time : null
    if (next !== hover) { hover = next; refresh?.() }
  }
  series.attachPrimitive(primitive)
  chart.subscribeCrosshairMove(follow)
  return {
    update(nextRows: ReadonlyMap<number, TickDeltaPoint>, candles: readonly OhlcBar[], style: TickDeltaLabels) {
      rows = nextRows
      bars = candles
      options = style
      refresh?.()
    },
    destroy() {
      chart.unsubscribeCrosshairMove(follow)
      series.detachPrimitive(primitive)
    },
  }
}
