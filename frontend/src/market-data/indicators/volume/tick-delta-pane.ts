import { HistogramSeries, LineSeries, LineStyle, type AutoscaleInfo, type IChartApi, type IPanePrimitive, type Time, type UTCTimestamp } from 'lightweight-charts'
import type { TickDeltaLine, TickDeltaLines, TickDeltaView } from './volume-preferences'

export type TickDeltaPoint = { up: number; down: number }
type TickDeltaPaneView = TickDeltaView | 'currency'
export type TickDeltaPlotOptions = { upColor: string; downColor: string; view: TickDeltaPaneView; lines: TickDeltaLines; axis?: TickDeltaLine }
export const tickDeltaColor = '#7e57c2'
const lineAxes = ['up', 'down', 'delta'] as const
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
  const delta = pane.addSeries(LineSeries, { ...lineOptions, color: tickDeltaColor, lineWidth: 2, crosshairMarkerBackgroundColor: tickDeltaColor })
  const zero = { price: 0, color: '#787b86', lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: false }
  up.createPriceLine(zero)
  const lineSeries = { up: upLine, down: downLine, delta }
  const zeroLines = { up: upLine.createPriceLine(zero), down: downLine.createPriceLine(zero), delta: delta.createPriceLine(zero) }
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
  let previousView: TickDeltaPaneView | undefined
  let previousAxis: TickDeltaLine | undefined
  const manualRanges = new Map<TickDeltaLine, AxisRange>()
  let barsRange: AxisRange | null = null
  function selectAxis(view: TickDeltaPaneView, axis: TickDeltaLine | undefined) {
    const right = pane.priceScale('right')
    const range = right.options().autoScale ? null : right.getVisibleRange()
    if (previousView === 'bars') barsRange = range
    if (previousAxis && range) manualRanges.set(previousAxis, range)
    else if (previousAxis) manualRanges.delete(previousAxis)

    for (const line of lineAxes) {
      const id = axis === line ? 'right' : `tick-delta-${line}`
      lineSeries[line].applyOptions({ priceScaleId: id, lastValueVisible: axis === line })
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
  return {
    legend,
    restoreScaleMargins() { pane.priceScale('right').applyOptions({ scaleMargins }) },
    sync(rows: ReadonlyMap<number, TickDeltaPoint>, { upColor, downColor, view, lines, axis }: TickDeltaPlotOptions) {
      if (fitRows !== rows || fitLines !== lines) {
        fitRows = rows
        fitLines = lines
        cachedFit = undefined
      }
      const viewChanged = previousView !== view
      const selected = view === 'line' ? axis : undefined
      if (viewChanged || previousAxis !== selected) selectAxis(view, selected)
      previousAxis = selected
      previousView = view
      up.applyOptions({ color: upColor, visible: view === 'bars' })
      down.applyOptions({ color: downColor, visible: view === 'bars' })
      upLine.applyOptions({ color: upColor, crosshairMarkerBackgroundColor: upColor, visible: view === 'line' && lines.up })
      downLine.applyOptions({ color: downColor, crosshairMarkerBackgroundColor: downColor, visible: view === 'line' && lines.down })
      delta.applyOptions({ visible: view === 'line' && lines.delta })
      if (view === 'currency' || (previousRows === rows && !viewChanged)) return
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
        delta.setData(lineData(point => point.up - point.down))
      }
    },
    clearData() {
      up.setData([])
      down.setData([])
      upLine.setData([])
      downLine.setData([])
      delta.setData([])
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
      chart.removeSeries(upLine)
      chart.removeSeries(downLine)
      chart.removeSeries(delta)
      chart.removePane(pane.paneIndex())
    },
  }
}
