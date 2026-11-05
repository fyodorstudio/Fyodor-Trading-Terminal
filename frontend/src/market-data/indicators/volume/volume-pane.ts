import { HistogramSeries, LineSeries, LineStyle, LineType, type AutoscaleInfo, type IChartApi, type IPrimitivePaneRenderer, type IPanePrimitive, type MouseEventParams, type Time } from 'lightweight-charts'
import { chartClockToUtc, type ChartClockScope } from '../../../appearance/time-display/chart-clock'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createVolumeCalculator } from './volume-calculation'
import type { VolumeLayer, VolumePreferences } from './volume-preferences'
import { createForexSessionLookup, forexSessionNames } from '../../market-watch/forex-sessions'
import './volume.css'

export function createVolumePane(chart: IChartApi) {
  const pane = chart.addPane(true)
  // Native pane widgets are created at paint. Reorder after that first frame,
  // including when RSI and Volume are enabled together before any paint.
  const orderFrame = window.requestAnimationFrame(() => pane.moveTo(1))
  chart.panes()[0].setStretchFactor(3); pane.setStretchFactor(1.5)
  const histogram = pane.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false })
  const average = pane.addSeries(LineSeries, { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
  const initialRightMinimumWidth = chart.options().rightPriceScale.minimumWidth ?? 0
  const initialHoveredSeriesOnTop = chart.options().hoveredSeriesOnTop
  // Hovering a histogram must not promote its solid bars over the Relative line.
  chart.applyOptions({ hoveredSeriesOnTop: false, rightPriceScale: { minimumWidth: Math.max(80, initialRightMinimumWidth) } })
  const compactRatio = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  const relativeLine = pane.addSeries(LineSeries, { priceScaleId: 'volume-relative', lineType: LineType.Simple, lineWidth: 2,
    priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: true,
    priceFormat: { type: 'custom', minMove: 0.01, formatter: (value: number) => `${Math.abs(value) >= 1000 ? compactRatio.format(value) : value.toFixed(2)}×` },
    autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
      const info = original()
      return info?.priceRange ? { ...info, priceRange: { minValue: Math.min(0, info.priceRange.minValue), maxValue: Math.max(1, info.priceRange.maxValue) } } : info
    },
  })
  pane.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.48, bottom: 0 } })
  const baseline = histogram.createPriceLine({ price: 1, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, lineVisible: false })
  const relativeBaseline = relativeLine.createPriceLine({ price: 1, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, lineVisible: true })
  let calculator = createVolumeCalculator()
  let bars: OhlcBar[] = [], data: ReturnType<typeof calculator.sync> | undefined, preferences: VolumePreferences | undefined
  let scopeKey = '', step = 3600, hover: number | null = null, frame: number | null = null, destroyed = false
  let changeAxis: (target: VolumePreferences['axisTarget']) => void = () => {}
  let toggleLayer: (layer: VolumeLayer) => void = () => {}
  const relativeOwnsAxis = (p: VolumePreferences | undefined) => !!p && p.mode === 'raw' && p.relativeLineVisible
    && (p.axisTarget === 'relative' || (!p.barsVisible && !p.averageVisible))
  let clock: ChartClockScope = { brokerId: null, brokerOffsetSeconds: 0 }
  const sessionAt = createForexSessionLookup()
  let topMargin = 0.48
  let scaleIds = ['right', 'volume-relative']
  const legend = document.createElement('div'); legend.className = 'volume-legend'
  legend.setAttribute('aria-label', 'Volume activity')
  const controls = document.createElement('div'); controls.className = 'volume-controls'
  const readout = document.createElement('div'), sessionLabel = document.createElement('div')
  const telemetry = document.createElement('div'), note = document.createElement('div')
  telemetry.className = 'volume-telemetry'; note.className = 'volume-readout-note'
  sessionLabel.className = 'volume-session'
  sessionLabel.setAttribute('aria-label', 'Automatic volume session')
  sessionLabel.title = 'Indicative sessions from the header. Hover follows chart time; otherwise this shows now. Overlaps are listed together. Broker holidays may differ.'
  const sessionNames = forexSessionNames.map((name, index) => {
    if (index) sessionLabel.append(' · ')
    const label = document.createElement('span'); label.className = 'volume-session-name'; label.textContent = name
    sessionLabel.append(label); return { name, label }
  })
  readout.className = 'volume-readout'
  const button = (text: string, action: () => void) => {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = text
    element.onclick = action; controls.append(element); return element
  }
  const axisButton = document.createElement('button'); axisButton.type = 'button'
  axisButton.setAttribute('aria-label', 'Right axis target')
  axisButton.onclick = () => { if (preferences) changeAxis(relativeOwnsAxis(preferences) ? 'volume' : 'relative') }
  controls.append(axisButton)
  const layerButtons = (['barsVisible', 'relativeLineVisible', 'averageVisible'] as const).map((layer, index) => {
    const label = ['Bars', 'Relative', 'Average'][index]
    const element = button(label, () => toggleLayer(layer))
    element.setAttribute('aria-label', `Show ${label === 'Bars' ? 'volume bars' : label === 'Relative' ? 'relative line' : 'average line'}`)
    return { layer, element }
  })
  const fields = ['ticks', 'relative', 'matches'].map(name => {
    const separator = document.createElement('span'); separator.textContent = '|'; separator.setAttribute('aria-hidden', 'true')
    const field = document.createElement('span'); field.className = `volume-readout-${name}`
    readout.append(separator, field); return field
  })
  const endSeparator = document.createElement('span'); endSeparator.textContent = '|'; endSeparator.setAttribute('aria-hidden', 'true'); readout.append(endSeparator)
  telemetry.append(readout, sessionLabel, note)
  legend.append(controls, telemetry); chart.chartElement().append(legend)
  const find = (time: number) => {
    let lo = 0, hi = bars.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (bars[mid].time < time) lo = mid + 1; else hi = mid }
    return bars[lo]?.time === time ? lo : -1
  }
  const updateLegend = () => {
    if (!preferences || !data || destroyed) return
    const relativeAxis = preferences.mode === 'relative' || relativeOwnsAxis(preferences)
    axisButton.disabled = preferences.mode !== 'raw'
    axisButton.textContent = `Axis: ${relativeAxis ? 'Relative' : 'Volume'}`
    axisButton.setAttribute('aria-pressed', String(relativeAxis))
    axisButton.title = preferences.mode === 'raw'
      ? 'Drag the right axis to resize this series. Click to switch and show the chosen layer if hidden; double-click the axis to restore automatic scaling.'
      : 'Relative bars and the Relative line share the same right × axis.'
    for (const { layer, element } of layerButtons) {
      element.disabled = layer === 'averageVisible' && preferences.mode !== 'raw'
      element.setAttribute('aria-pressed', String(preferences[layer] && !element.disabled))
      element.title = element.disabled ? 'The raw tick average is available in Raw mode' : `${preferences[layer] ? 'Hide' : 'Show'} ${element.textContent}`
    }
    const now = Date.now()
    const hoveredUtc = hover !== null && Number.isFinite(hover) ? chartClockToUtc(hover * 1000, clock) : null
    const reference = hover === null ? now : hoveredUtc
    const context = reference === null ? null : sessionAt(reference)
    const latest = data.rows.at(-1)
    const currentLoaded = latest?.utc !== null && latest?.utc !== undefined && now >= latest.utc && now < latest.utc + step * 1000
    const index = hover === null ? currentLoaded ? bars.length - 1 : -1 : find(hover), row = data.rows[index]
    fields[0].textContent = `Ticks ${row?.ticks === undefined ? '—' : row.ticks.toLocaleString('en-US')}`
    fields[1].textContent = `Relative ${row?.relative === undefined ? '—' : `${row.relative.toFixed(2)}x`}`
    fields[2].textContent = `Matches ${row ? `${row.samples}/${preferences.lookback}` : '—'}`
    for (const field of fields) field.title = field.textContent ?? ''
    note.textContent = !row ? hover === null ? 'No current candle loaded · hover a candle to inspect it' : 'No candle at cursor'
      : row.relative === undefined ? row.utc === null ? 'Broker clock unavailable' : `Need ${preferences.minimumSamples} prior matches with a positive mean` : ''
    note.hidden = !note.textContent
    const active = step >= 86400 && hover !== null ? [] : row && row.utc !== null && hover !== null
      ? forexSessionNames.filter(name => row.session.includes(name)) : context?.names ?? []
    for (const { name, label } of sessionNames) label.dataset.active = String(active.includes(name))
    sessionLabel.title = `${hover === null ? 'Now' : 'Hovered candle'} · ${step >= 86400 && hover !== null ? 'Daily bars; no intraday session assigned' : !context ? 'Session unavailable at cursor' : active.join(' + ') || 'No active session'} · Indicative regional hours; broker holidays may differ.`
  }
  const onHover = (event: MouseEventParams<Time>) => {
    hover = event.point ? typeof event.time === 'number' ? event.time : NaN : null
    if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; updateLegend() })
  }
  chart.subscribeCrosshairMove(onHover)
  // Only the idle session/readout needs wall time. Do not recalculate series,
  // trigger React renders or schedule frames while a historical candle is hovered.
  const sessionTimer = window.setInterval(() => { if (hover === null) updateLegend() }, 30_000)
  const renderer: IPrimitivePaneRenderer = {
    draw() {
      const leftWidth = chart.options().leftPriceScale.visible ? pane.priceScale('left').width() : 0
      legend.style.left = `${leftWidth + 10}px`
      legend.style.width = `${Math.max(0, chart.paneSize(pane.paneIndex()).width - 20)}px`
      legend.style.top = `${(pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8) + 3}px`
      const height = pane.getHeight()
      legend.style.maxHeight = `${Math.max(25, height - 12)}px`
      const nextMargin = Math.max(0.25, Math.min(0.85, (legend.offsetHeight + 10) / height))
      if (height > 0 && legend.offsetHeight > 0 && Math.abs(nextMargin - topMargin) > 0.01) {
        topMargin = nextMargin
        pane.priceScale('right').applyOptions({ scaleMargins: { top: topMargin, bottom: 0 } })
        for (const id of scaleIds) pane.priceScale(id).applyOptions({ scaleMargins: { top: topMargin, bottom: 0 } })
      }
    },
  }
  const views = [{ zOrder: () => 'bottom' as const, renderer: () => renderer }]
  const primitive: IPanePrimitive<Time> = { paneViews: () => views }
  pane.attachPrimitive(primitive)
  return {
    sync(nextBars: OhlcBar[], scope: string, next: VolumePreferences, nextClock: ChartClockScope, seconds: number,
      options: { changeAxis: (target: VolumePreferences['axisTarget']) => void; toggleLayer: (layer: VolumeLayer) => void }) {
      if (destroyed) return
      if (scopeKey !== scope) {
        calculator = createVolumeCalculator()
        hover = null
      }
      scopeKey = scope; bars = nextBars; step = seconds; clock = nextClock; changeAxis = options.changeAxis; toggleLayer = options.toggleLayer
      const styleChanged = preferences !== next
      const modeChanged = preferences?.mode !== next.mode
      const relativeOnRight = relativeOwnsAxis(next)
      const axisChanged = !preferences || modeChanged || relativeOnRight !== relativeOwnsAxis(preferences)
      preferences = next
      data = calculator.sync(bars, next, clock, step)
      if (styleChanged) {
        const tickScale = relativeOnRight ? 'volume-ticks' : 'right'
        histogram.applyOptions({ priceScaleId: tickScale, visible: next.barsVisible, priceFormat: next.mode === 'raw' ? { type: 'volume' } : { type: 'custom', minMove: 0.01, formatter: (value: number) => `${value.toFixed(2)}×` } })
        average.applyOptions({ priceScaleId: tickScale })
        relativeLine.applyOptions({ priceScaleId: next.mode === 'raw' && !relativeOnRight ? 'volume-relative' : 'right', color: next.relativeLineColor,
          visible: next.relativeLineVisible, lastValueVisible: next.relativeLineVisible, crosshairMarkerVisible: next.relativeLineVisible })
        if (relativeLine.seriesOrder() !== 2) relativeLine.setSeriesOrder(2)
        // Only the selected series owns the draggable right axis. The other
        // uses a hidden independent scale, without reserving a left gutter.
        if (axisChanged) pane.priceScale('right').applyOptions({ autoScale: true })
        scaleIds = [...new Set(['right', tickScale, next.mode === 'raw' && !relativeOnRight ? 'volume-relative' : 'right'])]
        for (const id of scaleIds)
          pane.priceScale(id).applyOptions({ scaleMargins: { top: topMargin, bottom: 0 } })
        baseline.applyOptions({ lineVisible: next.barsVisible && next.mode === 'relative' && !next.relativeLineVisible })
        relativeBaseline.applyOptions({ lineVisible: next.relativeLineVisible })
        average.applyOptions({ color: next.averageColor, visible: next.mode === 'raw' && next.averageVisible, lineVisible: next.mode === 'raw' && next.averageVisible })
      }
      const point = (i: number) => {
        const row = data!.rows[i], value = next.mode === 'raw' ? row.ticks : row.relative
        return value === undefined ? { time: row.time } : { time: row.time, value, color: bars[i].close >= bars[i].open ? next.upColor : next.downColor }
      }
      const mean = (i: number) => data!.rows[i].average === undefined || next.mode !== 'raw' || !next.averageVisible ? { time: bars[i].time } : { time: bars[i].time, value: data!.rows[i].average! }
      const relativePoint = (i: number) => {
        const row = data!.rows[i]
        return !next.relativeLineVisible || row.relative === undefined ? { time: row.time } : { time: row.time, value: row.relative }
      }
      if (data.rebuilt || styleChanged || modeChanged || data.from < data.previousLength - 1 || bars.length > data.previousLength + 1) {
        histogram.setData(bars.map((_, i) => point(i))); average.setData(bars.map((_, i) => mean(i))); relativeLine.setData(bars.map((_, i) => relativePoint(i)))
      } else for (let i = data.from; i < bars.length; i++) { histogram.update(point(i)); average.update(mean(i)); relativeLine.update(relativePoint(i)) }
      updateLegend()
    },
    clearData() { histogram.setData([]); average.setData([]); relativeLine.setData([]) },
    destroy() {
      if (destroyed) return
      destroyed = true
      window.cancelAnimationFrame(orderFrame)
      window.clearInterval(sessionTimer)
      if (frame !== null) window.cancelAnimationFrame(frame)
      chart.unsubscribeCrosshairMove(onHover)
      chart.applyOptions({ hoveredSeriesOnTop: initialHoveredSeriesOnTop,
        rightPriceScale: { minimumWidth: initialRightMinimumWidth } })
      pane.detachPrimitive(primitive); legend.remove()
      // Remove each series from the shared timeline before discarding its pane.
      chart.removeSeries(histogram)
      chart.removeSeries(average)
      chart.removeSeries(relativeLine)
      chart.removePane(pane.paneIndex())
    },
  }
}
