import { HistogramSeries, LineSeries, LineStyle, type AutoscaleInfo, type IChartApi, type IPanePrimitive, type Time, type UTCTimestamp } from 'lightweight-charts'
import type { TickDeltaView } from './volume-preferences'

export type TickDeltaPoint = { up: number; down: number }
export type TickDeltaPaneView = TickDeltaView | 'currency'
const deltaColor = '#7e57c2'

export function createTickDeltaPane(chart: IChartApi) {
  const pane = chart.addPane(true)
  const orderFrame = window.requestAnimationFrame(() => pane.moveTo(1))
  chart.panes()[0].setStretchFactor(3)
  pane.setStretchFactor(1.5)

  const options = { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'volume' as const } }
  const up = pane.addSeries(HistogramSeries, { ...options, base: 0 })
  const down = pane.addSeries(HistogramSeries, { ...options, base: 0 })
  const delta = pane.addSeries(LineSeries, {
    ...options, visible: false, lastValueVisible: true, color: deltaColor, lineWidth: 1, crosshairMarkerBackgroundColor: deltaColor,
    autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
      const info = original()
      const range = info?.priceRange
      return range ? { ...info, priceRange: { minValue: Math.min(range.minValue, 0), maxValue: Math.max(range.maxValue, 0) } } : info
    },
  })
  const zero = { price: 0, color: '#787b86', lineWidth: 1 as const, lineStyle: LineStyle.Dashed, axisLabelVisible: false }
  up.createPriceLine(zero)
  delta.createPriceLine(zero)
  pane.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.4, bottom: 0.08 } })

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
  return {
    legend,
    sync(rows: ReadonlyMap<number, TickDeltaPoint>, upColor: string, downColor: string, view: TickDeltaPaneView) {
      up.applyOptions({ color: upColor, visible: view === 'bars' })
      down.applyOptions({ color: downColor, visible: view === 'bars' })
      delta.applyOptions({ visible: view === 'line' })
      if (view === 'currency' || (previousRows === rows && previousView === view)) return
      previousRows = rows
      previousView = view
      const points = [...rows.entries()].sort(([a], [b]) => a - b)
        .map(([time, point]) => ({ time: time as UTCTimestamp, ...point }))
      if (view === 'bars') {
        up.setData(points.map(({ time, up: value }) => ({ time, value })))
        down.setData(points.map(({ time, down: value }) => ({ time, value: -value })))
      } else {
        const scale = chart.timeScale()
        const indices = points.map(({ time }) => scale.timeToIndex(time))
        delta.setData(points.map(({ time, up, down }, index) => {
          const here = indices[index], next = indices[index + 1]
          // Skip the outgoing segment when intervening price candles lack tick history.
          const gap = here != null && next != null && next > here + 1
          return { time, value: up - down, ...(gap ? { color: 'transparent' } : {}) }
        }))
      }
    },
    clearData() {
      up.setData([])
      down.setData([])
      delta.setData([])
      previousRows = undefined
    },
    destroy() {
      window.cancelAnimationFrame(orderFrame)
      pane.detachPrimitive(primitive)
      legend.remove()
      chart.removeSeries(up)
      chart.removeSeries(down)
      chart.removeSeries(delta)
      chart.removePane(pane.paneIndex())
    },
  }
}
