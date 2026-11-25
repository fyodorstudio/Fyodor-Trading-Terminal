import { HistogramSeries, LineSeries, LineStyle, type AutoscaleInfo, type IChartApi, type IPanePrimitive, type LineData, type Time, type UTCTimestamp } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import type { TickDeltaColors, TickDeltaLine, TickDeltaLines, TickDeltaView } from './volume-preferences'

export type TickDeltaPoint = { up: number; down: number; total: number }
type TickDeltaPaneView = TickDeltaView | 'currency'
export type TickDeltaPlotOptions = TickDeltaColors & { view: TickDeltaPaneView; lines: TickDeltaLines; axis?: TickDeltaLine }
const lineAxes = ['up', 'down', 'delta', 'total'] as const
const scaleMargins = { top: 0.4, bottom: 0.08 }
type AxisRange = { from: number; to: number }

export function createTickDeltaPane(chart: IChartApi) {
  const pane = chart.addPane(true)
  const orderFrame = window.requestAnimationFrame(() => pane.moveTo(1))
  chart.panes()[0].setStretchFactor(3)
  pane.setStretchFactor(1.5)

  const options = { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'volume' as const } }
  const up = pane.addSeries(HistogramSeries, { ...options, base: 0 })
  const down = pane.addSeries(HistogramSeries, { ...options, base: 0 })
  let fitRows: ReadonlyMap<number, TickDeltaPoint> | undefined
  let fitLines: TickDeltaLines | undefined
  let cachedFit: { from: number; to: number; info: AutoscaleInfo | null } | undefined
  const lineOptions = {
    ...options, visible: false, lastValueVisible: true, lineWidth: 1 as const,
    autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
      const visible = chart.timeScale().getVisibleRange()
      if (!visible || !fitRows || !fitLines) return original()
      const from = Number(visible.from), to = Number(visible.to)
      // Automatic scales share the same bounds so equal counts line up.
      if (cachedFit?.from !== from || cachedFit.to !== to) {
        let minValue = 0, maxValue = 0, hasData = false
        for (const [time, point] of fitRows) {
          if (time < from || time > to) continue
          hasData = true
          if (fitLines.up) maxValue = Math.max(maxValue, point.up)
          if (fitLines.down) maxValue = Math.max(maxValue, point.down)
          if (fitLines.total) maxValue = Math.max(maxValue, point.total)
          if (fitLines.delta) {
            const value = point.up - point.down
            minValue = Math.min(minValue, value)
            maxValue = Math.max(maxValue, value)
          }
        }
        cachedFit = { from, to, info: hasData ? { priceRange: { minValue, maxValue } } : null }
      }
      return cachedFit.info ?? original()
    },
  }
  const upLine = pane.addSeries(LineSeries, lineOptions)
  const downLine = pane.addSeries(LineSeries, lineOptions)
  const delta = pane.addSeries(LineSeries, { ...lineOptions, lineWidth: 2, crosshairMarkerVisible: false })
  const total = pane.addSeries(LineSeries, lineOptions)
  // Point colours can differ from the connecting segments, even beside a history gap.
  const deltaDots = pane.addSeries(LineSeries, { ...lineOptions, lastValueVisible: false,
    lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 2.5, crosshairMarkerVisible: false })
  const zero = { price: 0, color: '#787b86', lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: false }
  up.createPriceLine(zero)
  const lineSeries = { up: upLine, down: downLine, delta, total }
  const zeroLines = { up: upLine.createPriceLine(zero), down: downLine.createPriceLine(zero), delta: delta.createPriceLine(zero), total: total.createPriceLine(zero) }
  pane.priceScale('right').applyOptions({ autoScale: true, scaleMargins })

  const legend = document.createElement('div')
  legend.className = 'tick-delta-legend'
  chart.chartElement().appendChild(legend)
  const views = [{ zOrder: () => 'bottom' as const, renderer: () => ({
    draw() {
      const left = chart.options().leftPriceScale.visible ? pane.priceScale('left').width() : 0
      legend.style.left = `${left}px`
      legend.style.top = `${pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8}px`
      legend.style.width = `${chart.paneSize(pane.paneIndex()).width}px`
      legend.style.maxHeight = `${pane.getHeight()}px`
    },
  }) }]
  const primitive: IPanePrimitive<Time> = { paneViews: () => views }
  pane.attachPrimitive(primitive)

  let previousRows: ReadonlyMap<number, TickDeltaPoint> | undefined
  let previousOptions: TickDeltaPlotOptions | undefined
  let previousAxis: TickDeltaLine | undefined
  let deltaPoints: LineData<UTCTimestamp>[] = []
  let dotPoints: LineData<UTCTimestamp>[] = []
  const manualRanges = new Map<TickDeltaLine, AxisRange>()
  let barsRange: AxisRange | null = null
  function selectAxis(view: TickDeltaPaneView, axis: TickDeltaLine | undefined) {
    const right = pane.priceScale('right')
    const range = right.options().autoScale ? null : right.getVisibleRange()
    if (previousOptions?.view === 'bars') barsRange = range
    if (previousAxis && range) manualRanges.set(previousAxis, range)
    else if (previousAxis) manualRanges.delete(previousAxis)

    for (const line of lineAxes) {
      const id = axis === line ? 'right' : `tick-delta-${line}`
      lineSeries[line].applyOptions({ priceScaleId: id, lastValueVisible: axis === line })
      if (line === 'delta') deltaDots.applyOptions({ priceScaleId: id })
      zeroLines[line].applyOptions({ lineVisible: axis === line })
      const scale = pane.priceScale(id)
      scale.applyOptions({ scaleMargins })
      const saved = manualRanges.get(line)
      if (saved) scale.setVisibleRange(saved)
      else scale.setAutoScale(true)
    }
    if (view === 'bars' && barsRange) right.setVisibleRange(barsRange)
    else if (!axis) right.setAutoScale(true)
  }
  function syncDeltaDots(candles: readonly OhlcBar[], divergenceColor: string) {
    let candleIndex = 0
    const next = deltaPoints.map(({ time, value }) => {
      while (candleIndex < candles.length && candles[candleIndex].time < time) candleIndex++
      const candle = candles[candleIndex]
      const divergent = candle?.time === time && !candle.closeOnly &&
        ((value > 0 && candle.close < candle.open) || (value < 0 && candle.close > candle.open))
      return { time, value, ...(divergent ? { color: divergenceColor } : {}) }
    })
    if (next.length !== dotPoints.length || next.some(({ time, value, color }, i) =>
      time !== dotPoints[i].time || value !== dotPoints[i].value || color !== dotPoints[i].color)) {
      dotPoints = next
      deltaDots.setData(dotPoints)
    }
  }
  return {
    legend,
    restoreScaleMargins() { pane.priceScale('right').applyOptions({ scaleMargins }) },
    sync(rows: ReadonlyMap<number, TickDeltaPoint>, plot: TickDeltaPlotOptions, candles: readonly OhlcBar[]) {
      const { upColor, downColor, totalTicksColor, tickDeltaColor, tickDivergenceColor, view, lines, axis } = plot
      if (fitRows !== rows || fitLines !== lines) {
        fitRows = rows
        fitLines = lines
        cachedFit = undefined
      }
      const viewChanged = previousOptions?.view !== view
      const showDelta = view === 'line' && lines.delta
      if (previousOptions !== plot) {
        const selected = view === 'line' ? axis : undefined
        if (viewChanged || previousAxis !== selected) selectAxis(view, selected)
        previousAxis = selected
        previousOptions = plot
        up.applyOptions({ color: upColor, visible: view === 'bars' })
        down.applyOptions({ color: downColor, visible: view === 'bars' })
        upLine.applyOptions({ color: upColor, crosshairMarkerBackgroundColor: upColor, visible: view === 'line' && lines.up })
        downLine.applyOptions({ color: downColor, crosshairMarkerBackgroundColor: downColor, visible: view === 'line' && lines.down })
        total.applyOptions({ color: totalTicksColor, crosshairMarkerBackgroundColor: totalTicksColor, visible: view === 'line' && lines.total })
        delta.applyOptions({ color: tickDeltaColor, visible: showDelta })
        deltaDots.applyOptions({ color: tickDeltaColor, visible: showDelta })
      }
      if (view !== 'currency' && (previousRows !== rows || viewChanged)) {
        previousRows = rows
        const points = [...rows.entries()].sort(([a], [b]) => a - b)
          .map(([time, point]) => ({ time: time as UTCTimestamp, ...point }))
        if (view === 'bars') {
          up.setData(points.map(({ time, up: value }) => ({ time, value })))
          down.setData(points.map(({ time, down: value }) => ({ time, value: -value })))
        } else {
          const scale = chart.timeScale()
          const indices = points.map(({ time }) => scale.timeToIndex(time))
          const lineData = (value: (point: TickDeltaPoint) => number) => points.map((point, index) => {
            const here = indices[index], next = indices[index + 1]
            // Skip the outgoing segment when intervening price candles lack tick history.
            const gap = here != null && next != null && next > here + 1
            return { time: point.time, value: value(point), ...(gap ? { color: 'transparent' } : {}) }
          })
          upLine.setData(lineData(point => point.up))
          downLine.setData(lineData(point => point.down))
          total.setData(lineData(point => point.total))
          deltaPoints = lineData(point => point.up - point.down)
          delta.setData(deltaPoints)
        }
      }
      if (showDelta) syncDeltaDots(candles, tickDivergenceColor)
    },
    clearData() {
      up.setData([])
      down.setData([])
      for (const line of lineAxes) lineSeries[line].setData([])
      deltaDots.setData([])
      deltaPoints = []
      dotPoints = []
      previousRows = undefined
      fitRows = undefined
      cachedFit = undefined
      barsRange = null
      manualRanges.clear()
      pane.priceScale('right').setAutoScale(true)
      for (const line of lineAxes) lineSeries[line].priceScale().setAutoScale(true)
    },
    destroy() {
      window.cancelAnimationFrame(orderFrame)
      pane.detachPrimitive(primitive)
      legend.remove()
      chart.removeSeries(up)
      chart.removeSeries(down)
      for (const line of lineAxes) chart.removeSeries(lineSeries[line])
      chart.removeSeries(deltaDots)
      chart.removePane(pane.paneIndex())
    },
  }
}
