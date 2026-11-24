import { HistogramSeries, LineStyle, type IChartApi, type IPanePrimitive, type Time, type UTCTimestamp } from 'lightweight-charts'

export type TickDeltaPoint = { up: number; down: number }

export function createTickDeltaPane(chart: IChartApi) {
  const pane = chart.addPane(true)
  const orderFrame = window.requestAnimationFrame(() => pane.moveTo(1))
  chart.panes()[0].setStretchFactor(3)
  pane.setStretchFactor(1.5)

  const options = { priceLineVisible: false, lastValueVisible: false, base: 0, priceFormat: { type: 'volume' as const } }
  const up = pane.addSeries(HistogramSeries, options)
  const down = pane.addSeries(HistogramSeries, options)
  up.createPriceLine({ price: 0, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false })
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
  return {
    legend,
    sync(rows: ReadonlyMap<number, TickDeltaPoint>, upColor: string, downColor: string, showHistogram: boolean) {
      up.applyOptions({ color: upColor, visible: showHistogram })
      down.applyOptions({ color: downColor, visible: showHistogram })
      if (previousRows === rows) return
      previousRows = rows
      const points = [...rows.entries()].sort(([a], [b]) => a - b)
      up.setData(points.map(([time, point]) => ({ time: time as UTCTimestamp, value: point.up })))
      down.setData(points.map(([time, point]) => ({ time: time as UTCTimestamp, value: -point.down })))
    },
    clearData() {
      up.setData([])
      down.setData([])
      previousRows = undefined
    },
    destroy() {
      window.cancelAnimationFrame(orderFrame)
      pane.detachPrimitive(primitive)
      legend.remove()
      chart.removeSeries(up)
      chart.removeSeries(down)
      chart.removePane(pane.paneIndex())
    },
  }
}
