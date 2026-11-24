import type { IChartApi, ISeriesApi, ISeriesPrimitive, IPrimitivePaneRenderer, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'
import { calculateMarketStructure } from './market-structure-calculation'
import {
  defaultMarketStructurePreferences, marketStructureMarkerLabels, type MarketStructurePreferences,
} from './market-structure-preferences'
import './market-structure.css'

type Signal = ReturnType<typeof calculateMarketStructure>['signals'][number]
type Marker = { signal: Signal; events: Signal[] }
type Point = { x: number; y: number }
type Hit = Point & { marker: Marker }

const markerKind = (signal: Signal) => signal.kind === 'invalidated' ? 'failed' : signal.kind

function buildMarkers(signals: Signal[]) {
  const levels = new Map<string, { events: Signal[]; firstSweep?: Signal }>()
  for (const signal of signals) {
    const key = `${signal.side}:${signal.start}`
    const level = levels.get(key) ?? { events: [] }
    level.events.push(signal)
    if (signal.kind === 'sweep') level.firstSweep ??= signal
    levels.set(key, level)
  }

  const outcomes: Marker[] = []
  const sweeps: Marker[] = []
  for (const { events, firstSweep } of levels.values()) {
    const latest = events[events.length - 1]
    if (latest.kind === 'pending' || latest.kind === 'confirmed' || latest.kind === 'invalidated') {
      outcomes.push({ signal: latest, events })
    }
    if (firstSweep) {
      sweeps.push({ signal: firstSweep, events })
    } else if (latest.kind === 'failed' || latest.kind === 'reclaim') {
      sweeps.push({ signal: latest, events })
    }
  }
  const newestFirst = (a: Marker, b: Marker) => b.signal.time - a.signal.time
  return [...outcomes.sort(newestFirst), ...sweeps.sort(newestFirst)]
}

export function createMarketStructureOverlay(chart: IChartApi, series: ISeriesApi<'Candlestick', Time>) {
  const scale = chart.timeScale()
  const container = chart.chartElement()
  const tooltip = container.ownerDocument.createElement('div')
  tooltip.className = 'market-structure-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  container.append(tooltip)
  let bars: OhlcBar[] = []
  let preferences: MarketStructurePreferences | undefined
  let result = calculateMarketStructure([], defaultMarketStructurePreferences)
  let markers: Marker[] = []
  const hits: Hit[] = []
  let pointer: Point | undefined
  let hovered: Signal[] | undefined
  let formatTime: ((time: Time) => string) | undefined
  let requestUpdate: (() => void) | undefined

  function refreshTooltip() {
    const point = pointer
    let hit: Hit | undefined
    if (point) {
      let closest = 7
      for (const candidate of hits) {
        const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y)
        if (distance <= closest) {
          hit = candidate
          closest = distance
        }
      }
    }
    if (!hit) {
      tooltip.hidden = true
      return
    }
    const { signal, events } = hit.marker
    const formatter = chart.options().localization.timeFormatter
    if (hovered !== events || formatTime !== formatter) {
      hovered = events
      formatTime = formatter
      const title = tooltip.ownerDocument.createElement('strong')
      const sweeps = events.filter(event => event.kind === 'sweep').length
      const sweepCount = sweeps > 1 ? ` · ${sweeps} sweeps` : ''
      title.textContent = `Swing ${signal.side} · ${series.priceFormatter().format(signal.price)}${sweepCount}`
      const list = tooltip.ownerDocument.createElement('ul')
      const visibleEvents = events.slice(-10)
      for (const event of visibleEvents) {
        const row = tooltip.ownerDocument.createElement('li')
        row.textContent = `${formatter?.(event.time) ?? String(event.time)} · ${marketStructureMarkerLabels[markerKind(event)]}`
        list.append(row)
      }
      if (events.length > visibleEvents.length) {
        const row = tooltip.ownerDocument.createElement('li')
        row.textContent = `${events.length - visibleEvents.length} earlier events`
        list.prepend(row)
      }
      tooltip.replaceChildren(title, list)
    }
    tooltip.hidden = false
    const anchorX = hit.x + chart.priceScale('left').width()
    const maxLeft = container.clientWidth - tooltip.offsetWidth - 6
    const top = hit.y + 13
    tooltip.style.left = `${Math.max(6, Math.min(anchorX, maxLeft))}px`
    tooltip.style.top = `${Math.max(6, top + tooltip.offsetHeight <= chart.paneSize(0).height
      ? top : hit.y - tooltip.offsetHeight - 8)}px`
  }

  const onHover = (param: MouseEventParams<Time>) => {
    pointer = param.paneIndex === 0 ? param.point : undefined
    refreshTooltip()
  }
  chart.subscribeCrosshairMove(onHover)

  const renderer: IPrimitivePaneRenderer = {
    draw(target) {
      hits.length = 0
      const lastTime = bars.at(-1)?.time
      const range = scale.getVisibleRange()
      if (!preferences || lastTime === undefined || !range) {
        refreshTooltip()
        return
      }
      const { highColor, lowColor, lineWidth, showDashedLines, showSolidLines, showUnbroken, showMarkers, markerColors, extendLines } = preferences
      const from = Number(range.from)
      const to = Number(range.to)

      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const drawSegment = (segment: (typeof result.broken)[number]) => {
          const end = extendLines ? lastTime : segment.end ?? lastTime
          if (end < from || segment.start > to) return
          const y = series.priceToCoordinate(segment.price)
          if (y === null || y < 0 || y > mediaSize.height) return
          const x1 = scale.timeToCoordinate(segment.start)
          const x2 = scale.timeToCoordinate(end)
          if (x1 === null || x2 === null) return

          context.strokeStyle = segment.side === 'high' ? highColor : lowColor
          context.beginPath()
          context.moveTo(x1, y)
          context.lineTo(x2, y)
          context.stroke()
        }
        context.save()
        context.lineWidth = lineWidth
        if (showDashedLines) {
          context.setLineDash([4, 3])
          result.replacedTestedLevels.forEach(drawSegment)
          for (const level of [result.high, result.low]) {
            if (level && (showUnbroken || result.pending.includes(level) || result.activeTestedLevels.includes(level))) {
              drawSegment(level)
            }
          }
        }
        if (showSolidLines) {
          context.setLineDash([])
          result.broken.forEach(drawSegment)
        }
        if (preferences?.showAutoTrendlines) {
          for (const line of result.trendlines) {
            const start = bars[line.startIndex].time
            const end = bars[line.endIndex].time
            if (end < from || start > to) continue
            const x1 = scale.timeToCoordinate(start)
            const x2 = scale.timeToCoordinate(end)
            const y1 = series.priceToCoordinate(line.startPrice)
            const y2 = series.priceToCoordinate(line.endPrice)
            if (x1 === null || x2 === null || y1 === null || y2 === null) continue

            context.strokeStyle = line.side === 'high' ? highColor : lowColor
            context.setLineDash(line.broken ? [] : [8, 4])
            context.beginPath()
            context.moveTo(x1, y1)
            context.lineTo(x2, y2)
            context.stroke()
          }
        }
        if (showMarkers) {
          // Paint newer outcomes above older sweep markers when they overlap.
          for (let i = markers.length - 1; i >= 0; i--) {
            const marker = markers[i]
            const { signal } = marker
            if (signal.time < from || signal.time > to) continue
            const x = scale.timeToCoordinate(signal.time)
            const y = series.priceToCoordinate(signal.price)
            if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue

            context.fillStyle = markerColors[markerKind(signal)]
            context.beginPath()
            context.arc(x, y, 3.5, 0, Math.PI * 2)
            context.fill()
            hits.push({ x, y, marker })
          }
        }
        context.restore()
      })
      refreshTooltip()
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
      if (!unchangedClosedBars || preferences?.swingStrength !== next.swingStrength ||
        preferences.confirmationCloses !== next.confirmationCloses || preferences.atrBufferPercent !== next.atrBufferPercent ||
        preferences.failureWindow !== next.failureWindow || preferences.showAutoTrendlines !== next.showAutoTrendlines) {
        result = calculateMarketStructure(nextBars, next)
        markers = buildMarkers(result.signals)
      } else if (preferences === next && nextBars === bars) {
        return
      }
      bars = nextBars
      preferences = next
      requestUpdate?.()
    },
    destroy() {
      chart.unsubscribeCrosshairMove(onHover)
      series.detachPrimitive(primitive)
      tooltip.remove()
    },
  }
}
