import type { IChartApi, ISeriesApi, ISeriesPrimitive, IPrimitivePaneRenderer, MouseEventParams, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'
import { calculateMarketStructure } from './market-structure-calculation'
import { defaultMarketStructurePreferences, type MarketStructurePreferences } from './market-structure-preferences'
import './market-structure.css'

const signalLabels = {
  sweep: 'Sweep',
  pending: 'Pending',
  confirmed: 'Breakout confirmed',
  failed: 'Failed breakout',
  reclaim: 'Reclaim',
}

type Signal = ReturnType<typeof calculateMarketStructure>['signals'][number]
type Marker = { signal: Signal; events: Signal[]; label?: string }
type Point = { x: number; y: number }
type Bounds = Point & { width: number; height: number }
type Hit = Bounds & { marker: Marker }

function buildMarkers(signals: Signal[]) {
  const levels = new Map<string, { events: Signal[]; firstSweep?: Signal; count: number }>()
  for (const signal of signals) {
    const key = `${signal.side}:${signal.start}`
    const level = levels.get(key) ?? { events: [], count: 0 }
    level.events.push(signal)
    if (signal.kind === 'sweep') {
      level.firstSweep ??= signal
      level.count++
    }
    levels.set(key, level)
  }

  const outcomes: Marker[] = []
  const sweeps: Marker[] = []
  for (const { events, firstSweep, count } of levels.values()) {
    const latest = events[events.length - 1]
    if (latest.kind === 'pending' || latest.kind === 'confirmed') {
      outcomes.push({ signal: latest, events, label: signalLabels[latest.kind] })
    }
    if (firstSweep) {
      sweeps.push({ signal: firstSweep, events, label: count > 1 ? `Sweep ×${count}` : 'Sweep' })
    } else if (latest.kind === 'failed' || latest.kind === 'reclaim') {
      sweeps.push({ signal: latest, events })
    }
  }
  const newestFirst = (a: Marker, b: Marker) => b.signal.time - a.signal.time
  return [...outcomes.sort(newestFirst), ...sweeps.sort(newestFirst)]
}

function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x &&
    a.y < b.y + b.height + 2 && a.y + a.height + 2 > b.y
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
    const hit = point && hits.find(({ x, y, width, height }) =>
      point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height)
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
      title.textContent = `Swing ${signal.side} · ${series.priceFormatter().format(signal.price)}`
      const list = tooltip.ownerDocument.createElement('ul')
      const visibleEvents = events.slice(-10)
      for (const event of visibleEvents) {
        const row = tooltip.ownerDocument.createElement('li')
        row.textContent = `${formatter?.(event.time) ?? String(event.time)} · ${signalLabels[event.kind]}`
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
    const top = hit.y + hit.height + 8
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
          const labels: Bounds[] = []
          context.font = '600 11px sans-serif'
          context.textBaseline = 'middle'
          context.textAlign = 'left'
          for (const marker of markers) {
            const { signal, label } = marker
            if (signal.time < from || signal.time > to) continue
            const x = scale.timeToCoordinate(signal.time)
            const y = series.priceToCoordinate(signal.price)
            if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue

            const color = signal.side === 'high' ? highColor : lowColor
            context.fillStyle = color
            context.beginPath()
            context.arc(x, y, label ? 3 : 2, 0, Math.PI * 2)
            context.fill()
            hits.push({ x: x - 5, y: y - 5, width: 10, height: 10, marker })

            if (!label) continue
            const width = Math.ceil(context.measureText(label).width) + 12
            const left = Math.max(0, Math.min(x - width / 2, mediaSize.width - width))
            const direction = signal.side === 'high' ? -1 : 1
            for (let row = 0; row < 3; row++) {
              const top = y + direction * (6 + row * 20) - (direction < 0 ? 17 : 0)
              if (top < 0 || top + 17 > mediaSize.height || width > mediaSize.width) continue
              const bounds = { x: left, y: top, width, height: 17 }
              if (labels.some(other => overlaps(bounds, other))) continue

              labels.push(bounds)
              hits.push({ ...bounds, marker })
              context.fillStyle = '#172033'
              context.fillRect(left, top, width, 17)
              context.fillStyle = color
              context.fillRect(left, top, 2, 17)
              context.fillStyle = '#f8fafc'
              context.fillText(label, left + 6, top + 8.5)
              break
            }
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
        preferences.confirmationCloses !== next.confirmationCloses || preferences.atrBufferPercent !== next.atrBufferPercent) {
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
