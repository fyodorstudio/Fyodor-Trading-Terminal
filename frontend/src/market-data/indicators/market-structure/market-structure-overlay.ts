import type { IChartApi, ISeriesApi, ISeriesPrimitive, IPrimitivePaneRenderer, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'
import { calculateMarketStructure } from './market-structure-calculation'
import { defaultMarketStructurePreferences, type MarketStructurePreferences } from './market-structure-preferences'

const signalLabels = {
  sweep: 'Sweep',
  pending: 'Pending',
  confirmed: 'Breakout confirmed',
  failed: 'Failed breakout',
  reclaim: 'Reclaim',
}

type LabelBounds = { x: number; y: number; width: number }

export function createMarketStructureOverlay(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>) {
  const scale = chart.timeScale()
  let bars: OhlcBar[] = []
  let preferences: MarketStructurePreferences | undefined
  let result = calculateMarketStructure([], defaultMarketStructurePreferences)
  let requestUpdate: (() => void) | undefined

  const renderer: IPrimitivePaneRenderer = {
    draw(target) {
      const lastTime = bars.at(-1)?.time
      const range = scale.getVisibleRange()
      if (!preferences || lastTime === undefined || !range) return
      const { highColor, lowColor, lineWidth, showUnbroken, showLabels } = preferences
      const from = Number(range.from)
      const to = Number(range.to)

      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const drawSegment = (segment: (typeof result.broken)[number]) => {
          const end = segment.end ?? lastTime
          if (end < from || segment.start > to) return
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
        context.setLineDash([4, 3])
        if (showUnbroken) {
          if (result.high) drawSegment(result.high)
          if (result.low) drawSegment(result.low)
        } else {
          result.pending.forEach(drawSegment)
        }
        if (showLabels) {
          const labels: LabelBounds[] = []
          context.font = '600 11px sans-serif'
          context.textBaseline = 'middle'
          context.textAlign = 'left'
          for (let i = result.signals.length - 1; i >= 0; i--) {
            const signal = result.signals[i]
            if (signal.time > to) continue
            if (signal.time < from) break
            const x = scale.timeToCoordinate(signal.time)
            const y = series.priceToCoordinate(signal.price)
            if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue

            const color = signal.side === 'high' ? highColor : lowColor
            context.fillStyle = color
            context.beginPath()
            context.arc(x, y, 3, 0, Math.PI * 2)
            context.fill()

            const text = signalLabels[signal.kind]
            const width = Math.ceil(context.measureText(text).width) + 12
            const left = Math.max(0, Math.min(x - width / 2, mediaSize.width - width))
            const direction = signal.side === 'high' ? -1 : 1
            for (let row = 0; row < 3; row++) {
              const top = y + direction * (6 + row * 20) - (direction < 0 ? 17 : 0)
              if (top < 0 || top + 17 > mediaSize.height || width > mediaSize.width) continue
              if (labels.some(label => left < label.x + label.width + 3 && left + width + 3 > label.x &&
                top < label.y + 19 && top + 19 > label.y)) continue

              labels.push({ x: left, y: top, width })
              context.fillStyle = '#172033'
              context.fillRect(left, top, width, 17)
              context.fillStyle = color
              context.fillRect(left, top, 2, 17)
              context.fillStyle = '#f8fafc'
              context.fillText(text, left + 6, top + 8.5)
              break
            }
          }
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
      if (!unchangedClosedBars || preferences?.swingStrength !== next.swingStrength || preferences.breakBy !== next.breakBy ||
        preferences.confirmationCloses !== next.confirmationCloses || preferences.atrBufferPercent !== next.atrBufferPercent) {
        result = calculateMarketStructure(nextBars, next)
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
