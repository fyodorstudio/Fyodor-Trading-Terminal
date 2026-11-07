import { LineSeries, LineType, type IChartApi, type IPrimitivePaneRenderer, type IPanePrimitive, type Logical, type MouseEventParams, type Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { macroMetrics, macroPlot, macroValue, type MacroIndicator, type MacroReading } from './macro-data'
import { claimChartClick } from '../../candlestick-chart/chart-click-selection'
import { futureTimelineSeconds } from '../../candlestick-chart/future-timeline'
import { fedEvidenceClock, fedSurprise, type FedEvidence } from './fed-forecast'
import { macroAxis, macroMetricAxis, macroMetricVisible, type MacroAxis, type MacroMetric } from './macro-preferences'
import './macro.css'

export function createMacroPane(chart: IChartApi) {
  const pane = chart.addPane(true)
  chart.panes()[0].setStretchFactor(3); pane.setStretchFactor(1.25)
  const base = { priceLineVisible: false, lastValueVisible: false }
  const payrolls = pane.addSeries(LineSeries, base)
  const lines = {
    rate: pane.addSeries(LineSeries, { ...base, lineType: LineType.WithSteps, crosshairMarkerVisible: false }),
    unemployment: pane.addSeries(LineSeries, base),
    coreCpi: pane.addSeries(LineSeries, base),
    headlineCpi: pane.addSeries(LineSeries, base),
  }
  const rateDots = pane.addSeries(LineSeries, { ...base, lineVisible: false, pointMarkersRadius: 4 })
  const series = { ...lines, payrolls }
  const legend = document.createElement('div'); legend.className = 'macro-legend'
  legend.setAttribute('aria-label', 'MFDI values')
  legend.title = 'Macro Factor Data Inspector · Stored actuals, latest vintages; verified official Fed upper bounds where saved. Hover a Fed release dot for attributed expectations. Release dots align to their containing candle; the latest release wins within one candle. Monthly lines join released points. Only the Fed rate is held between decisions. Four independent scales; the two CPI series share Inflation. Overlapping heights do not imply comparable magnitudes.'
  const controls = document.createElement('div'); controls.className = 'macro-controls'
  let toggleMetric: (metric: MacroMetric) => void = () => {}, selectMetric: (metric: MacroMetric) => void = () => {}
  const metricControls = ([
    ['rate', 'Fed Rate (%)'], ['payrolls', 'Payroll (k)'], ['unemployment', 'Unemployment (%)'],
    ['headlineCpi', 'Headline CPI m/m (%)'], ['coreCpi', 'Core CPI m/m (%)'],
  ] as const).map(([key, label]) => {
    const chip = document.createElement('div'); chip.className = 'macro-metric-control'
    chip.setAttribute('role', 'group'); chip.setAttribute('aria-label', label)
    const colorDot = document.createElement('span'); colorDot.className = 'macro-control-color'
    colorDot.setAttribute('aria-hidden', 'true')
    const item = document.createElement('div'); item.className = 'macro-metric-item'
    const axisButton = document.createElement('button'); axisButton.type = 'button'; axisButton.className = 'macro-metric-axis'
    axisButton.textContent = label; axisButton.dataset.macroAxis = key
    axisButton.setAttribute('aria-label', `Select ${label} axis`)
    axisButton.title = `Resize ${label} on the right axis; select to reveal it if hidden.${key === 'coreCpi' || key === 'headlineCpi' ? ' Both CPI lines share the Inflation scale.' : ''}`
    axisButton.onclick = () => selectMetric(key)
    const eyeButton = document.createElement('button'); eyeButton.type = 'button'; eyeButton.className = 'macro-visibility-button'
    eyeButton.dataset.macroVisibility = key
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18')
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8')
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true')
    for (const d of ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0']) {
      const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path)
    }
    const slash = document.createElementNS(svg.namespaceURI, 'path'); slash.setAttribute('d', 'm3 3 18 18')
    slash.setAttribute('data-eye-slash', 'true'); svg.append(slash)
    eyeButton.append(svg); eyeButton.onclick = () => toggleMetric(key)
    chip.append(axisButton, eyeButton); item.append(colorDot, chip); controls.append(item)
    return { key, label, axisButton, eyeButton, slash, colorDot }
  })
  const fitButton = document.createElement('button'); fitButton.type = 'button'; fitButton.textContent = 'Fit axis'
  fitButton.setAttribute('aria-label', 'Fit MFDI selected axis')
  fitButton.title = 'Fit the selected scale to the visible releases, then hold its new bounds. Other scales keep their placement.'
  controls.append(fitButton)
  const readout = document.createElement('div'); readout.className = 'macro-readout'
  const note = document.createElement('div'); note.className = 'macro-note'
  legend.append(controls, readout, note)
  for (const event of ['pointerdown', 'dblclick']) legend.addEventListener(event, e => e.stopPropagation())
  chart.chartElement().appendChild(legend)
  const tooltip = document.createElement('div'); tooltip.className = 'macro-forecast-tooltip'; tooltip.hidden = true
  tooltip.setAttribute('role', 'tooltip'); tooltip.setAttribute('aria-label', 'Fed rate expectations')
  chart.chartElement().appendChild(tooltip)
  let indicator: MacroIndicator | undefined, formatRelease: (at: number) => string = String
  let inspectRelease: ((reading: MacroReading) => void) | undefined
  let plots = {} as Partial<Record<MacroMetric, ReturnType<typeof macroPlot>>>
  let latestTime: number | undefined, hover: number | null = null, frame: number | null = null, destroyed = false
  let step = 3600
  let forecastHover: { time: Time; reading: MacroReading } | undefined
  let requestUpdate = () => {}
  let outlineColor = '#888888'
  const tooltipField = (text: string, secondary = false) => {
    const field = document.createElement('div'); field.textContent = text
    if (secondary) field.className = 'macro-forecast-source'
    tooltip.append(field)
  }
  const tooltipSource = (evidence: FedEvidence) => {
    tooltipField(fedEvidenceClock(evidence, formatRelease), true)
    tooltip.lastElementChild!.setAttribute('title', `${evidence.url}\n${evidence.note}`)
  }
  const updateForecast = () => {
    tooltip.replaceChildren(); tooltip.hidden = !forecastHover
    if (!forecastHover) return
    const reading = forecastHover.reading, meeting = indicator?.forecasts?.meetings.get(reading.releasedAt)
    tooltipField(`Fed rate · ${formatRelease(reading.releasedAt)}`)
    tooltipField(`Actual ${macroValue('rate', reading.value)} · ${meeting?.actual ? 'Federal Reserve · target upper bound' : 'MT5 · not externally verified'}`)
    if (meeting?.actual) tooltipSource(meeting.actual)
    if (reading.brokerValue !== undefined && reading.brokerValue !== reading.value)
      tooltipField(`MT5 conflict: ${macroValue('rate', reading.brokerValue)} · plotted official ${macroValue('rate', reading.value)}; raw Inspector record preserved`)
    for (const [provider, label] of [['investing', 'Investing.com consensus'], ['trading_economics', 'Trading Economics survey consensus']] as const) {
      const evidence = meeting?.consensus.find(row => row.provider === provider)
      tooltipField(`${label}: ${evidence ? `${macroValue('rate', evidence.value)} · ${fedSurprise(reading.value, evidence.value).text}` : 'Unavailable'}`)
      if (evidence) tooltipSource(evidence)
    }
    const fedwatch = meeting?.fedwatch
    tooltipField('CME FedWatch · market probabilities')
    if (fedwatch) {
      const likely = Math.max(...fedwatch.outcomes.map(row => row.probability))
      for (const outcome of fedwatch.outcomes.filter(row => row.probability === likely))
        tooltipField(`Most likely ${outcome.lower.toFixed(2)}–${outcome.upper.toFixed(2)}% · ${outcome.probability}% probability`)
      const actualOutcome = meeting?.actual ? fedwatch.outcomes.find(row => row.lower === meeting.actual!.lower && row.upper === meeting.actual!.upper) : undefined
      tooltipField(`Actual outcome probability: ${actualOutcome ? `${actualOutcome.probability}%` : 'Unavailable'}`)
      tooltipSource(fedwatch)
    } else tooltipField('Unavailable · no verified pre-decision probability snapshot', true)
    tooltipField('Dashed: Investing.com consensus · outline: Beat. Rate surprise does not predict currency returns.', true)
    if (!meeting) tooltipField(indicator?.forecasts?.status ?? 'No saved forecast evidence for this decision', true)
    else if (indicator?.forecasts?.status.includes('unavailable')) tooltipField(`${indicator.forecasts.status} · showing last loaded evidence`, true)
  }
  type Bounds = { from: number; to: number }
  const bounds = new Map<MacroAxis, Bounds>()
  let axisScales = new Map<MacroAxis, string>(), boundsFrame: number | null = null
  const validBounds = (range: Bounds | null): range is Bounds => range !== null
    && Number.isFinite(range.from) && Number.isFinite(range.to) && range.from < range.to
  const hasReference = (axis: MacroAxis) => (Object.keys(series) as MacroMetric[]).some(key => {
    const point = plots[key]?.line.at(-1)
    return macroMetricAxis(key) === axis && point !== undefined && series[key].priceToCoordinate(point.value) !== null
  })
  const applyBounds = (axis: MacroAxis, id: string) => {
    const saved = bounds.get(axis)
    if (!saved) return
    const scale = pane.priceScale(id), current = scale.getVisibleRange()
    if (scale.options().autoScale || !current || current.from !== saved.from || current.to !== saved.to)
      scale.setVisibleRange(saved)
  }
  const bindAfterPaint = () => {
    if (destroyed || boundsFrame !== null) return
    boundsFrame = window.requestAnimationFrame(() => {
      boundsFrame = null
      for (const [axis, id] of axisScales) {
        const scale = pane.priceScale(id)
        // Native initial fitting and double-click fitting settle at paint. Read
        // the fitted result once, then bind it with the public range API. Hidden
        // scales need custom ranges too; autoScale=false alone is insufficient.
        if (!scale.options().autoScale || hasReference(axis)) {
          const range = scale.getVisibleRange()
          if (validBounds(range)) bounds.set(axis, { ...range })
        }
        applyBounds(axis, id)
      }
    })
  }
  fitButton.onclick = () => {
    if (!indicator) return
    const axis = macroAxis(indicator.preferences), id = axisScales.get(axis)
    if (!id) return
    bounds.delete(axis)
    pane.priceScale(id).setAutoScale(true)
    bindAfterPaint()
  }
  const updateLegend = () => {
    if (!indicator) return
    const p = indicator.preferences
    const selectedAxis = macroAxis(p)
    for (const { key, label, axisButton, eyeButton, slash, colorDot } of metricControls) {
      const visible = macroMetricVisible(p, key)
      colorDot.style.backgroundColor = p.series[key].color
      axisButton.setAttribute('aria-pressed', String(visible && macroMetricAxis(key) === selectedAxis))
      eyeButton.setAttribute('aria-pressed', String(visible))
      eyeButton.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label}`)
      eyeButton.title = `${visible ? 'Hide' : 'Show'} ${label}`
      slash.setAttribute('visibility', visible ? 'hidden' : 'visible')
    }
    const time = hover ?? latestTime
    readout.replaceChildren()
    const visible = metricControls.map(({ key }) => key).filter(key => macroMetricVisible(p, key))
    for (const key of visible) {
      const reading = time === undefined ? undefined : plots[key]?.readings.get(time)
      const field = document.createElement('span'); field.className = 'macro-field'
      const swatch = document.createElement('span'); swatch.className = 'macro-swatch'; swatch.style.backgroundColor = p.series[key].color
      swatch.setAttribute('aria-hidden', 'true')
      const value = document.createElement('span')
      value.textContent = `${macroMetrics[key].label} ${reading ? macroValue(key, reading.value) : '—'}`
      const date = document.createElement('span'); date.className = 'macro-release'
      date.textContent = reading ? `Released ${formatRelease(reading.releasedAt)}` : 'No known actual at this candle'
      field.append(swatch, value, date); readout.append(field)
    }
    const noPoints = visible.every(key => !plots[key]?.dots.length)
    note.textContent = `${indicator.status}${!visible.length ? ' · All series hidden; use an eye to show a series'
      : visible.every(key => !indicator!.history[key].length) ? ' · No released actuals with verified chart timing'
      : noPoints ? ' · No releases in loaded candles; scroll left for earlier releases' : ''}`
  }
  const onHover = (event: MouseEventParams<Time>) => {
    hover = event.point ? typeof event.time === 'number' ? event.time : NaN : null
    const hit = hitDot(event)
    forecastHover = hit?.key === 'rate' ? { time: hit.time, reading: hit.reading } : undefined
    if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; updateLegend(); updateForecast(); requestUpdate() })
  }
  chart.subscribeCrosshairMove(onHover)
  const hitDot = (event: MouseEventParams<Time>) => {
    if (!indicator || !event.point || typeof event.time !== 'number' || event.paneIndex !== pane.paneIndex()) return
    const { x, y } = event.point
    let hit: { key: MacroMetric; time: Time; reading: MacroReading; distance: number; preferred: boolean } | undefined
    const preferredSeries = event.hoveredInfo?.series ?? event.hoveredSeries
    for (const { key } of metricControls) {
      if (!macroMetricVisible(indicator.preferences, key) || !indicator.preferences.series[key].pointsVisible) continue
      const plot = plots[key]
      if (!plot?.dots.length) continue
      // Check the neighboring release points, not every sample or a carried
      // readout. The native time can snap to an adjacent candle in dense views.
      let lo = 0, hi = plot.dots.length
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (plot.dots[mid].time < event.time) lo = mid + 1; else hi = mid }
      for (const direction of [-1, 1]) {
        for (let index = direction < 0 ? lo - 1 : lo; index >= 0 && index < plot.dots.length; index += direction) {
          const point = plot.dots[index], px = chart.timeScale().timeToCoordinate(point.time)
          if (px === null) continue
          if ((direction < 0 && px < x - 7) || (direction > 0 && px > x + 7)) break
          const py = series[key].priceToCoordinate(point.value)
          if (py === null || py < 0 || py > pane.getHeight()) continue
          const distance = (px - x) ** 2 + (py - y) ** 2
          if (distance > 49) continue
          const reading = plot.readings.get(point.time)
          const preferred = preferredSeries === (key === 'rate' ? rateDots : series[key])
          if (reading && (!hit || distance < hit.distance || (distance === hit.distance && preferred && !hit.preferred)))
            hit = { key, time: point.time, reading, distance, preferred }
        }
      }
    }
    return hit
  }
  const onClick = (event: MouseEventParams<Time>) => {
    const hit = inspectRelease ? hitDot(event) : undefined
    if (hit) { claimChartClick(event); inspectRelease!(hit.reading) }
  }
  chart.subscribeClick(onClick)
  const renderer: IPrimitivePaneRenderer = { draw(target) {
    legend.style.top = `${(pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8) + 4}px`
    legend.style.width = `${Math.max(0, chart.paneSize(pane.paneIndex()).width - 20)}px`
    legend.style.maxHeight = `${Math.max(24, pane.getHeight() - 10)}px`
    if ([...axisScales].some(([axis, id]) => (!bounds.has(axis) || pane.priceScale(id).options().autoScale)
      && (Object.keys(series) as MacroMetric[]).some(key => macroMetricAxis(key) === axis && plots[key]?.line.length)))
      bindAfterPaint()
    if (!indicator || !macroMetricVisible(indicator.preferences, 'rate') || !indicator.preferences.series.rate.pointsVisible) return
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.strokeStyle = outlineColor; context.lineWidth = 1.5; context.setLineDash([])
      for (const point of plots.rate?.dots ?? []) {
        const reading = plots.rate!.readings.get(point.time)!
        const primary = indicator!.forecasts?.meetings.get(reading.releasedAt)?.consensus.find(row => row.provider === 'investing')
        if (!primary || fedSurprise(reading.value, primary.value).bp <= 0) continue
        const x = chart.timeScale().timeToCoordinate(point.time), y = series.rate.priceToCoordinate(point.value)
        if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue
        context.beginPath(); context.arc(x, y, 6.5, 0, Math.PI * 2); context.stroke()
      }
      if (forecastHover) {
        const x = chart.timeScale().timeToCoordinate(forecastHover.time), y = series.rate.priceToCoordinate(forecastHover.reading.value)
        if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) {
          tooltip.hidden = true
        } else {
          const primary = indicator!.forecasts?.meetings.get(forecastHover.reading.releasedAt)?.consensus.find(row => row.provider === 'investing')
          const fy = primary ? series.rate.priceToCoordinate(primary.value) : null
          if (fy !== null) {
            context.strokeStyle = indicator!.preferences.series.rate.color; context.lineWidth = 1; context.setLineDash([3, 3])
            context.beginPath(); context.moveTo(x, y); context.lineTo(x, Math.max(0, Math.min(mediaSize.height, fy))); context.stroke()
            if (fy >= 0 && fy <= mediaSize.height) {
              context.setLineDash([]); context.beginPath(); context.moveTo(x - 4, fy); context.lineTo(x + 4, fy); context.stroke()
            }
          }
          tooltip.hidden = false
          const element = chart.chartElement(), offset = pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height
          tooltip.style.maxWidth = `${Math.max(100, Math.min(440, element.clientWidth - 20))}px`
          tooltip.style.left = `${Math.max(6, Math.min(x + 12, element.clientWidth - tooltip.offsetWidth - 6))}px`
          tooltip.style.top = `${Math.max(6, Math.min(offset + y + 12, element.clientHeight - tooltip.offsetHeight - 6))}px`
        }
      }
      context.restore()
    })
  }, drawBackground(target) {
    if (!indicator || latestTime === undefined || !indicator.upcoming?.length) return
    const scale = chart.timeScale(), anchor = scale.timeToIndex(latestTime as Time)
    if (anchor === null) return
    const now = Date.now(), lastTime = latestTime
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.setLineDash([4, 4]); context.lineWidth = 1; context.globalAlpha = 0.8
      for (const scheduled of indicator!.upcoming) {
        if (scheduled.releasedAt <= now || scheduled.time < lastTime + step || scheduled.time > lastTime + futureTimelineSeconds) continue
        const metric = scheduled.metrics.find(key => macroMetricVisible(indicator!.preferences, key))
        if (!metric) continue
        const logical = Number(anchor) + (scheduled.time - lastTime) / step, left = Math.floor(logical)
        const x0 = scale.logicalToCoordinate(left as Logical), x1 = scale.logicalToCoordinate((left + 1) as Logical)
        if (x0 === null || x1 === null) continue
        const x = x0 + (x1 - x0) * (logical - left)
        if (!Number.isFinite(x) || x < 0 || x > mediaSize.width) continue
        context.strokeStyle = indicator!.preferences.series[metric].color
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, mediaSize.height); context.stroke()
      }
      context.restore()
    })
  } }
  const views = [{ zOrder: () => 'top' as const, renderer: () => renderer }]
  const primitive: IPanePrimitive = { paneViews: () => views, attached: params => { requestUpdate = params.requestUpdate }, detached: () => { requestUpdate = () => {} } }
  pane.attachPrimitive(primitive)
  return {
    sync(bars: OhlcBar[], next: MacroIndicator, seconds: number, format: (at: number) => string,
      callbacks: { toggleMetric: (metric: MacroMetric) => void; selectMetric: (metric: MacroMetric) => void; inspectRelease?: (reading: MacroReading) => void }) {
      if (destroyed) return
      // Capture a user's drag/zoom before moving its series off the right axis.
      // Removing a scale's final source resets its native range and auto mode.
      for (const [axis, id] of axisScales) {
        const scale = pane.priceScale(id)
        if (scale.options().autoScale) bounds.delete(axis) // Explicit native fit.
        else {
          const range = scale.getVisibleRange()
          if (validBounds(range)) bounds.set(axis, { ...range })
        }
      }
      indicator = next; formatRelease = format; toggleMetric = callbacks.toggleMetric; selectMetric = callbacks.selectMetric
      inspectRelease = callbacks.inspectRelease
      forecastHover = undefined; tooltip.hidden = true
      outlineColor = getComputedStyle(chart.chartElement()).getPropertyValue('--text-strong').trim() || '#888888'
      latestTime = bars.at(-1)?.time
      step = seconds
      const p = next.preferences, axis = macroAxis(p)
      const nextScales = new Map<MacroAxis, string>()
      plots = {}
      for (const key of Object.keys(series) as MacroMetric[]) {
        const active = macroMetricVisible(p, key)
        const metricAxis = macroMetricAxis(key)
        const scaleId = active && metricAxis === axis ? 'right' : `macro-${metricAxis}`
        if (active) nextScales.set(metricAxis, scaleId)
        const priceFormat = { type: 'custom' as const, minMove: key === 'payrolls' ? 1 : 0.01, formatter: (value: number) => macroValue(key, value) }
        series[key].applyOptions({ priceScaleId: scaleId, visible: active, color: p.series[key].color, priceFormat })
        series[key].applyOptions({ lineWidth: p.series[key].lineWidth,
          pointMarkersVisible: key !== 'rate' && p.series[key].pointsVisible, pointMarkersRadius: 4 })
        const plot = active ? macroPlot(bars, next.history[key], step, key === 'rate') : undefined
        plots[key] = plot
        series[key].setData(plot?.line ?? [])
        if (key === 'rate') {
          rateDots.applyOptions({ priceScaleId: scaleId, visible: active && p.series.rate.pointsVisible,
            color: p.series.rate.color, priceFormat, pointMarkersVisible: p.series.rate.pointsVisible })
          rateDots.setData(active && p.series.rate.pointsVisible ? plot?.dots ?? [] : [])
        }
        pane.priceScale(scaleId).applyOptions({ scaleMargins: { top: 0.36, bottom: 0.1 } })
      }
      axisScales = nextScales
      for (const [axis, id] of axisScales) {
        if (bounds.has(axis)) applyBounds(axis, id)
        else pane.priceScale(id).setAutoScale(true)
      }
      bindAfterPaint()
      updateLegend()
    },
    clearData() {
      for (const item of Object.values(series)) item.setData([])
      rateDots.setData([]); plots = {}; hover = null; forecastHover = undefined; tooltip.hidden = true; latestTime = undefined; updateLegend()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (frame !== null) window.cancelAnimationFrame(frame)
      if (boundsFrame !== null) window.cancelAnimationFrame(boundsFrame)
      chart.unsubscribeCrosshairMove(onHover)
      chart.unsubscribeClick(onClick)
      pane.detachPrimitive(primitive); legend.remove(); tooltip.remove()
      for (const item of Object.values(series)) chart.removeSeries(item)
      chart.removeSeries(rateDots)
      chart.removePane(pane.paneIndex())
    },
  }
}
