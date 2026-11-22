import type { IChartApi, ISeriesApi, ISeriesPrimitive, IPrimitivePaneRenderer, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'
import { calculateMarketStructure } from './market-structure-calculation'
import type { MarketStructurePreferences } from './market-structure-preferences'

export function createMarketStructureOverlay(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>) {
  const scale = chart.timeScale()
  let bars: OhlcBar[] = []
  let preferences: MarketStructurePreferences | undefined
  let result = calculateMarketStructure([], 1, 'close')
  let requestUpdate: (() => void) | undefined

  const renderer: IPrimitivePaneRenderer = {
    draw(target) {
      const lastTime = bars.at(-1)?.time
      const range = scale.getVisibleRange()
      if (!preferences || lastTime === undefined || !range) return
      const { highColor, lowColor, lineWidth, showUnbroken } = preferences

      target.useMediaCoordinateSpace(({ context }) => {
        const drawSegment = (segment: (typeof result.broken)[number]) => {
          const end = segment.end ?? lastTime
          if (end < (range.from as number) || segment.start > (range.to as number)) return
          const x1 = scale.timeToCoordinate(segment.start)
          const x2 = scale.timeToCoordinate(end)
          const y = series.priceToCoordinate(segment.price)
          if (x1 === null || x2 === null || y === null) return

          context.strokeStyle = segment.side === 'high' ? highColor : lowColor
          context.beginPath()
          context.moveTo(x1, y)
          context.lineTo(x2, y)
          context.stroke()
        }
        context.save()
        context.lineWidth = lineWidth
        context.setLineDash([])
        result.broken.forEach(drawSegment)
        if (showUnbroken) {
          context.setLineDash([4, 3])
          if (result.high) drawSegment(result.high)
          if (result.low) drawSegment(result.low)
        }
        context.restore()
      })
    },
  }
  const views = [{ renderer: () => renderer }]
  const primitive: ISeriesPrimitive<Time> = {
    paneViews: () => views,
    attached: params => { requestUpdate = params.requestUpdate },
  }
  series.attachPrimitive(primitive)

  return {
    sync(nextBars: OhlcBar[], next: MarketStructurePreferences) {
      const unchangedClosedBars = nextBars === bars || (nextBars.length === bars.length &&
        (changedRecentBarStart(nextBars, bars) ?? -1) >= nextBars.length - 1)
      if (!unchangedClosedBars || preferences?.swingStrength !== next.swingStrength || preferences.breakBy !== next.breakBy) {
        result = calculateMarketStructure(nextBars, next.swingStrength, next.breakBy)
      } else if (preferences === next && nextBars === bars) {
        return
      }
      bars = nextBars
      preferences = next
      requestUpdate?.()
    },
    destroy() { series.detachPrimitive(primitive) },
  }
}
