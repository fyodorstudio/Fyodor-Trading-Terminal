import { LineSeries, type IChartApi, type IPrimitivePaneRenderer, type ISeriesPrimitive, type MouseEventParams, type Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createAtrCalculator } from './atr-calculation'
import type { AtrPreferences } from './atr-preferences'

export function createAtrPane(chart: IChartApi) {
  const pane = chart.addPane(true)
  chart.panes()[0].setStretchFactor(3)
  pane.setStretchFactor(1)
  const line = pane.addSeries(LineSeries, { priceLineVisible: false })
  const scaleReference = pane.addSeries(LineSeries, { lineVisible: false, lastValueVisible: false,
    crosshairMarkerVisible: false, priceLineVisible: false, autoscaleInfoProvider: () => null })
  pane.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.18, bottom: 0.1 } })
  const calculator = createAtrCalculator()
  let data: ReturnType<typeof calculator.sync> | undefined, preferences: AtrPreferences | undefined
  let referenceTime: Time | undefined, hover: number | null = null, frame: number | null = null, destroyed = false, precision = 5
  const legend = document.createElement('div')
  legend.className = 'rsi-legend'
  legend.setAttribute('aria-label', 'ATR values')
  const title = document.createElement('span'), valueLabel = document.createElement('span')
  legend.append(title, valueLabel)
  chart.chartElement().appendChild(legend)
  const updateLegend = () => {
    if (!preferences || destroyed) return
    const rows = data?.atr ?? []
    let index = rows.length - 1
    if (hover !== null) {
      let lo = 0, hi = rows.length
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(rows[mid].time) < hover) lo = mid + 1; else hi = mid }
      index = rows[lo]?.time === hover ? lo : -1
    }
    const point = rows[index]
    title.textContent = `ATR ${preferences.length} RMA`
    if (rows.length < preferences.length) title.textContent += ` · Waiting for ${preferences.length} candles`
    valueLabel.textContent = point && 'value' in point ? point.value.toFixed(precision) : '—'
  }
  const onHover = (event: MouseEventParams<Time>) => {
    hover = event.point ? typeof event.time === 'number' ? event.time : NaN : null
    if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; updateLegend() })
  }
  chart.subscribeCrosshairMove(onHover)
  const renderer: IPrimitivePaneRenderer = { draw() { legend.style.top = `${(pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8) + 4}px` } }
  const views = [{ zOrder: () => 'bottom' as const, renderer: () => renderer }]
  const primitive: ISeriesPrimitive<Time> = { paneViews: () => views }
  line.attachPrimitive(primitive)
  return {
    sync(bars: OhlcBar[], scope: string, next: AtrPreferences, horizonTime: Time | undefined, nextPrecision: number) {
      if (destroyed) return
      const range = chart.timeScale().getVisibleLogicalRange()
      const nextReferenceTime = bars.length ? horizonTime : undefined
      if (referenceTime !== nextReferenceTime) {
        referenceTime = nextReferenceTime
        scaleReference.setData(referenceTime === undefined ? [] : [{ time: referenceTime, value: 0 }])
      }
      if (preferences !== next || precision !== nextPrecision) {
        precision = nextPrecision
        line.applyOptions({ color: next.lineColor, lineWidth: next.lineWidth,
          priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
        legend.style.setProperty('--rsi-color', next.lineColor)
      }
      preferences = next
      data = calculator.sync(bars, next.length, scope)
      if (data.rebuilt || (data.from < bars.length && (data.from < data.previousLength - 1 || bars.length > data.previousLength + 1))) {
        line.setData(data.atr)
        if (range) chart.timeScale().setVisibleLogicalRange(range)
      } else {
        for (let i = data.from; i < bars.length; i++) line.update(data.atr[i])
      }
      updateLegend()
    },
    clearData() { line.setData([]); scaleReference.setData([]); referenceTime = undefined; hover = null },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (frame !== null) window.cancelAnimationFrame(frame)
      chart.unsubscribeCrosshairMove(onHover)
      line.detachPrimitive(primitive)
      legend.remove()
      chart.removeSeries(line)
      chart.removeSeries(scaleReference)
      chart.removePane(pane.paneIndex())
    },
  }
}
