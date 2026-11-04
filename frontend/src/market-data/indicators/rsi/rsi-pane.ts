import { LineSeries, LineStyle, type IChartApi, type IPriceLine, type IPrimitivePaneRenderer, type ISeriesPrimitive, type MouseEventParams, type Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createRsiCalculator } from './rsi-calculation'
import type { RsiPreferences } from './rsi-preferences'

/** One native pane shares the chart's time scale and future timeline. */
export function createRsiPane(chart: IChartApi) {
  const pane = chart.addPane()
  chart.panes()[0].setStretchFactor(3)
  pane.setStretchFactor(1)
  const options = {
    priceLineVisible: false, priceFormat: { type: 'price' as const, precision: 2, minMove: 0.01 },
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  }
  const rsi = pane.addSeries(LineSeries, options)
  const average = pane.addSeries(LineSeries, { ...options, lastValueVisible: false })
  pane.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.12, bottom: 0.06 } })
  const calculator = createRsiCalculator()
  let preferences: RsiPreferences | undefined
  let data: ReturnType<typeof calculator.sync> | undefined
  let hover: number | null = null, frame: number | null = null, destroyed = false
  const bands: IPriceLine[] = []
  const legend = document.createElement('div')
  legend.className = 'rsi-legend'
  legend.setAttribute('aria-label', 'RSI values')
  const title = document.createElement('span'), valueLabel = document.createElement('span'), averageLabel = document.createElement('span')
  legend.append(title, valueLabel, averageLabel)
  chart.chartElement().appendChild(legend)

  const updateLegend = () => {
    if (!preferences || destroyed) return
    const rows = data?.rsi ?? []
    let index = rows.length - 1
    if (hover !== null) {
      let lo = 0, hi = rows.length
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(rows[mid].time) < hover) lo = mid + 1; else hi = mid }
      index = rows[lo]?.time === hover ? lo : -1
    }
    const point = rows[index], ma = data?.average[index]
    valueLabel.textContent = preferences.lineVisible ? point && 'value' in point ? point.value.toFixed(2) : '—' : ''
    averageLabel.textContent = preferences.averageVisible && preferences.smoothing !== 'None' ? ma && 'value' in ma ? ma.value.toFixed(2) : '—' : ''
    title.textContent = `RSI ${preferences.length} ${preferences.source.toLowerCase()}`
    if (rows.length <= preferences.length) title.textContent += ` · Waiting for ${preferences.length} price changes`
  }
  const onHover = (event: MouseEventParams<Time>) => {
    hover = event.point ? typeof event.time === 'number' ? event.time : NaN : null
    if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; updateLegend() })
  }
  chart.subscribeCrosshairMove(onHover)
  const renderer: IPrimitivePaneRenderer = {
    draw() {
      // The native render lifecycle follows divider drags without a second
      // resize loop or a React render on each pointer movement.
      const top = pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8
      legend.style.top = `${top + 4}px`
    },
    drawBackground(target) {
      if (!preferences?.fillVisible || !preferences.fillOpacity) return
      const upper = rsi.priceToCoordinate(preferences.upper.value), lower = rsi.priceToCoordinate(preferences.lower.value)
      if (upper === null || lower === null) return
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        context.save()
        context.fillStyle = preferences!.fillColor
        context.globalAlpha = preferences!.fillOpacity / 100
        context.fillRect(0, Math.min(upper, lower), mediaSize.width, Math.abs(lower - upper))
        context.restore()
      })
    },
  }
  const views = [{ zOrder: () => 'bottom' as const, renderer: () => renderer }]
  const primitive: ISeriesPrimitive<Time> = { paneViews: () => views }
  rsi.attachPrimitive(primitive)
  return {
    sync(bars: OhlcBar[], scope: string, next: RsiPreferences) {
      if (destroyed) return
      const range = chart.timeScale().getVisibleLogicalRange()
      if (preferences !== next) {
        rsi.applyOptions({ color: next.lineColor, lineWidth: next.lineWidth, lineVisible: next.lineVisible,
          lastValueVisible: next.lineVisible, crosshairMarkerVisible: next.lineVisible })
        const showAverage = next.averageVisible && next.smoothing !== 'None'
        average.applyOptions({ color: next.averageColor, lineWidth: next.averageWidth, lineVisible: showAverage,
          lastValueVisible: showAverage, crosshairMarkerVisible: showAverage })
        for (const [index, band] of [next.upper, next.middle, next.lower].entries()) {
          const style = { price: band.value, color: band.color, lineWidth: 1 as const, lineStyle: LineStyle.Dashed,
            lineVisible: band.visible, axisLabelVisible: false, title: '' }
          if (bands[index]) bands[index].applyOptions(style)
          else bands.push(rsi.createPriceLine(style))
        }
        legend.style.setProperty('--rsi-color', next.lineColor)
        legend.style.setProperty('--rsi-average-color', next.averageColor)
      }
      preferences = next
      data = calculator.sync(bars, next, scope)
      if (data.rebuilt || (data.from < bars.length && (data.from < data.previousLength - 1 || bars.length > data.previousLength + 1))) {
        rsi.setData(data.rsi); average.setData(data.average)
        if (range) chart.timeScale().setVisibleLogicalRange(range)
      } else {
        for (let i = data.from; i < bars.length; i++) { rsi.update(data.rsi[i]); average.update(data.average[i]) }
      }
      updateLegend()
    },
    clearData() { rsi.setData([]); average.setData([]); hover = null },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (frame !== null) window.cancelAnimationFrame(frame)
      chart.unsubscribeCrosshairMove(onHover)
      rsi.detachPrimitive(primitive)
      legend.remove()
      chart.removePane(pane.paneIndex())
    },
  }
}
