import { LineSeries, LineType, type IChartApi, type ISeriesApi, type IPrimitivePaneRenderer, type IPanePrimitive, type Logical, type MouseEventParams, type Time } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { macroNumberLabels, macroPlot, macroValue, type MacroIndicator, type MacroReading } from './macro-data'
import { macroCatalog } from './macro-catalog'
import { claimChartClick } from '../../candlestick-chart/chart-click-selection'
import { futureTimelineSeconds } from '../../candlestick-chart/future-timeline'
import { fedSurprise } from './fed-forecast'
import { macroAxis, macroMetricAxis, macroMetricVisible, selectedMacroMetrics, type MacroAxis, type MacroMetric, type MacroPreferences } from './macro-preferences'
import { macroLayout, macroSelection, patchMacroLayout, type MacroPlacement } from './macro-layout'
import { createMacroTooltip } from './macro-tooltip'
import { createMacroLaneControls } from './macro-lane-controls'
import { createMacroReleaseMarkers, paintMacroReleaseMarker } from './macro-release-markers'
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
  const series: Record<string, ISeriesApi<'Line'>> = { ...lines, payrolls }
  const releaseMarkers = createMacroReleaseMarkers()
  let markerSource: string | null | undefined
  let markerSnapshot: { history: MacroIndicator['history']; upcoming: MacroIndicator['upcoming']; keys: string } | undefined
  let markerBars: OhlcBar[] = []
  let markerHits: { key: string; reading: MacroReading; time: Time; x: number; y: number; rx: number; ry: number }[] = []
  const colourDrafts = new Map<string, string>(), colourPreviews = new Map<string, string>()
  let colourTimer: number | null = null
  const colourFor = (key: string) => colourPreviews.get(key) ?? indicator!.preferences.series[key].color
  const stopColourTimer = () => { if (colourTimer !== null) window.clearTimeout(colourTimer); colourTimer = null }
  const clearColourPreviews = () => { stopColourTimer(); colourDrafts.clear(); colourPreviews.clear() }
  const paintColour = (key: string, color: string) => {
    if (series[key]?.options().color !== color) series[key]?.applyOptions({ color })
    if (key === 'rate' && rateDots.options().color !== color) rateDots.applyOptions({ color })
  }
  const previewColours = () => {
    colourTimer = null
    if (destroyed || !indicator) return
    for (const [key, color] of colourDrafts) {
      if (!series[key]) continue
      colourPreviews.set(key, color); paintColour(key, color)
    }
    updateLegend(); requestUpdate()
  }
  const legend = document.createElement('div'); legend.className = 'macro-legend'
  legend.setAttribute('aria-label', 'MFDI values')
  legend.title = 'Macro Factor Data Inspector · Stored actuals, latest vintages; verified official Fed upper bounds where saved. Hover a release dot for actual, forecast, previous and release time. Release dots align to their containing candle; the latest release wins within one candle. Monthly lines join released points. Each selected event has an independent scale. Overlapping heights do not imply comparable magnitudes.'
  const controls = document.createElement('div'); controls.className = 'macro-controls'
  let toggleMetric: (metric: MacroMetric) => void = () => {}, selectMetric: (metric: MacroMetric) => void = () => {}
  let toggleForecast: (metric: MacroMetric) => void = () => {}
  let toggleNumbers: (metric: MacroMetric) => void = () => {}
  const createMetricControl = (key: string) => {
    const label = macroCatalog[key].controlLabel
    const chip = document.createElement('div'); chip.className = 'macro-metric-control'
    chip.setAttribute('role', 'group'); chip.setAttribute('aria-label', label)
    const colorDot = document.createElement('span'); colorDot.className = 'macro-control-color'
    colorDot.setAttribute('aria-hidden', 'true')
    const item = document.createElement('div'); item.className = 'macro-metric-item'
    const axisButton = document.createElement('button'); axisButton.type = 'button'; axisButton.className = 'macro-metric-axis'
    axisButton.textContent = label.startsWith(`${macroCatalog[key].currency} · `) ? label : `${macroCatalog[key].currency} · ${label}`; axisButton.dataset.macroAxis = key
    axisButton.setAttribute('aria-label', `Select ${label} axis`)
    axisButton.title = `Select ${label}, then drag the plot to move it. Use the ✥ handle to move it between categories.`
    axisButton.onclick = () => { linked = false; updateLock(); selectMetric(key) }
    const dragButton = document.createElement('button'); dragButton.type = 'button'; dragButton.className = 'macro-row-drag'; dragButton.textContent = '✥'
    dragButton.dataset.macroDrag = key; dragButton.setAttribute('aria-label', `Move ${label} between categories`); dragButton.title = `Hold and drag to move ${label} to another category`
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
    const forecastButton = document.createElement('button'); forecastButton.type = 'button'; forecastButton.className = 'macro-forecast-button'
    forecastButton.dataset.macroForecast = key
    const forecastIcon = svg.cloneNode(false) as SVGElement
    const letter = document.createElementNS(svg.namespaceURI, 'text'); letter.textContent = 'F'
    letter.setAttribute('x', '7'); letter.setAttribute('y', '18'); letter.setAttribute('font-size', '17')
    letter.setAttribute('font-weight', '600'); letter.setAttribute('fill', 'currentColor'); letter.setAttribute('stroke', 'none')
    const forecastSlash = slash.cloneNode(true) as SVGElement
    forecastSlash.removeAttribute('data-eye-slash'); forecastSlash.setAttribute('data-forecast-slash', 'true')
    forecastIcon.append(letter, forecastSlash); forecastButton.append(forecastIcon)
    forecastButton.onclick = () => toggleForecast(key)
    const numbersButton = document.createElement('button'); numbersButton.type = 'button'; numbersButton.className = 'macro-numbers-button'
    numbersButton.dataset.macroNumbers = key
    const numbersIcon = forecastIcon.cloneNode(true) as SVGElement
    numbersIcon.querySelector('text')!.textContent = 'N'
    numbersIcon.querySelector('text')!.setAttribute('x', '5')
    const numbersSlash = numbersIcon.querySelector('[data-forecast-slash]')!
    numbersSlash.removeAttribute('data-forecast-slash'); numbersSlash.setAttribute('data-numbers-slash', 'true')
    numbersButton.append(numbersIcon); numbersButton.onclick = () => toggleNumbers(key)
    const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.className = 'macro-color-button'
    colorInput.setAttribute('aria-label', `Colour ${label}`); colorInput.title = `Change ${label} colour`
    const previewColour = () => {
      const color = colorInput.value
      if (destroyed || !indicator?.preferences.series[key] || !series[key] || !/^#[\da-f]{6}$/i.test(color)) return
      colourDrafts.set(key, color)
      if (colourTimer === null) colourTimer = window.setTimeout(previewColours, 80)
    }
    const changeColour = () => {
      const color = colorInput.value
      if (destroyed || !indicator?.preferences.series[key] || !series[key] || !/^#[\da-f]{6}$/i.test(color)) return
      colourDrafts.delete(key); colourPreviews.delete(key)
      if (!colourDrafts.size) stopColourTimer()
      paintColour(key, color)
      if (color === indicator.preferences.series[key].color) { updateLegend(); requestUpdate(); return }
      commitPreferences({ ...indicator.preferences, series: { ...indicator.preferences.series, [key]: { ...indicator.preferences.series[key], color } } })
    }
    colorInput.oninput = previewColour; colorInput.onchange = changeColour
    colorInput.onblur = () => { if (colourDrafts.has(key)) changeColour() }
    chip.append(axisButton, dragButton, eyeButton, forecastButton, numbersButton, colorInput); item.append(colorDot, chip); controls.append(item)
    return { key, label, item, axisButton, dragButton, eyeButton, slash, forecastButton, forecastSlash, numbersButton, numbersSlash, colorDot, colorInput }
  }
  let metricControls = ['rate', 'payrolls', 'unemployment', 'headlineCpi', 'coreCpi'].map(createMetricControl)
  const fitButton = document.createElement('button'); fitButton.type = 'button'; fitButton.textContent = 'Fit axis'
  fitButton.setAttribute('aria-label', 'Fit MFDI selected axis')
  fitButton.title = 'Fit the selected scale to the visible releases, then hold its new bounds. Other scales keep their placement.'
  const fitAllButton = document.createElement('button'); fitAllButton.type = 'button'; fitAllButton.textContent = 'Fit axis all'
  fitAllButton.setAttribute('aria-label', 'Fit all MFDI axes')
  fitAllButton.title = 'Fit every visible MFDI scale to its visible releases, then hold the new bounds.'
  const lockButton = document.createElement('button'); lockButton.type = 'button'; lockButton.className = 'macro-lock-button'
  const lockIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lockIcon.setAttribute('viewBox', '0 0 24 24'); lockIcon.setAttribute('width', '18'); lockIcon.setAttribute('height', '18')
  lockIcon.setAttribute('fill', 'none'); lockIcon.setAttribute('stroke', 'currentColor'); lockIcon.setAttribute('stroke-width', '1.8')
  lockIcon.setAttribute('stroke-linecap', 'round'); lockIcon.setAttribute('stroke-linejoin', 'round'); lockIcon.setAttribute('aria-hidden', 'true')
  const lockBody = document.createElementNS(lockIcon.namespaceURI, 'path'); lockBody.setAttribute('d', 'M5 10h14v11H5z M12 14v3')
  const lockShackle = document.createElementNS(lockIcon.namespaceURI, 'path')
  lockIcon.append(lockBody, lockShackle); lockButton.append(lockIcon)
  const flattenButton = document.createElement('button'); flattenButton.type = 'button'; flattenButton.className = 'macro-lock-button'
  flattenButton.setAttribute('aria-label', 'MFDI lane view'); flattenButton.setAttribute('aria-pressed', 'false')
  flattenButton.title = 'Switch between numerical values and straight category lanes'
  const flattenIcon = lockIcon.cloneNode(false) as SVGElement
  const bars = document.createElementNS(flattenIcon.namespaceURI, 'path'); bars.setAttribute('d', 'M3 6h18 M3 12h18 M3 18h18')
  flattenIcon.append(bars); flattenButton.append(flattenIcon)
  const seriesButton = document.createElement('button'); seriesButton.type = 'button'; seriesButton.textContent = 'Series'
  seriesButton.setAttribute('aria-label', 'MFDI series drawer'); seriesButton.setAttribute('aria-expanded', 'false')
  controls.append(fitButton, fitAllButton, lockButton, flattenButton, seriesButton)
  const readout = document.createElement('div'); readout.className = 'macro-readout'
  const note = document.createElement('div'); note.className = 'macro-note'
  legend.append(controls, readout, note)
  for (const event of ['pointerdown', 'dblclick']) legend.addEventListener(event, e => e.stopPropagation())
  chart.chartElement().appendChild(legend)
  const releaseTooltip = createMacroTooltip(chart.chartElement()), tooltip = releaseTooltip.element
  let indicator: MacroIndicator | undefined, formatRelease: (at: number) => string = String
  let inspectRelease: ((reading: MacroReading) => void) | undefined
  let plots = {} as Partial<Record<MacroMetric, ReturnType<typeof macroPlot>>>
  let forecastPlots = {} as typeof plots
  let numberLabels: Partial<Record<MacroMetric, Map<number, string>>> = {}
  let latestTime: number | undefined, hover: number | null = null, frame: number | null = null, destroyed = false
  let step = 3600
  let releaseHover: { key: string; time: Time; reading: MacroReading } | undefined
  let forecastHover: { time: Time; reading: MacroReading } | undefined
  let requestUpdate = () => {}
  let linked = false, fittingAll = false, laneMode = false
  const selectedAxisFor = (p: MacroPreferences) => macroSelection(p).find(key => macroMetricVisible(p, key)) ?? macroAxis(p)
  let changePreferences: ((value: MacroPreferences) => void) | undefined
  const applyDisplayMode = () => {
    if (!indicator) return
    for (const [key, line] of Object.entries(series)) {
      line.applyOptions({ lineVisible: !laneMode, crosshairMarkerVisible: !laneMode && !macroCatalog[key].carry,
        pointMarkersVisible: key !== 'rate' && !laneMode && indicator.preferences.series[key].pointsVisible,
        priceFormat: { type: 'custom', minMove: key === 'payrolls' ? 1 : 0.01,
          formatter: (value: number) => laneMode ? '' : macroValue(key, value, indicator?.history[key]?.at(-1)) } })
    }
    rateDots.applyOptions({ visible: !laneMode && macroMetricVisible(indicator.preferences, 'rate') && indicator.preferences.series.rate.pointsVisible, crosshairMarkerVisible: !laneMode,
      priceFormat: { type: 'custom', minMove: 0.01, formatter: (value: number) => laneMode ? '' : macroValue('rate', value) } })
  }
  const commitPreferences = (next: MacroPreferences) => {
    if (destroyed || !indicator) return
    indicator = { ...indicator, preferences: next }; laneMode = macroLayout(next).laneMode
    flattenButton.setAttribute('aria-pressed', String(laneMode)); applyDisplayMode(); updateLock(); updateLegend()
    changePreferences?.(next); requestUpdate()
  }
  const laneControls = createMacroLaneControls(chart.chartElement(), () => requestUpdate(), commitPreferences, { drawerChanged: open => {
    seriesButton.setAttribute('aria-expanded', String(open)); releaseHover = undefined; forecastHover = undefined; releaseTooltip.hide()
    if (!open) seriesButton.focus()
  }, categorySelected: () => { linked = false; updateLock() }, beforePreset: () => { saveOnExit(); return indicator?.preferences } })
  seriesButton.onclick = () => laneControls.toggleDrawer()
  seriesButton.setAttribute('aria-controls', laneControls.drawerId)
  laneControls.setRows(metricControls)
  const inPane = (event: Event) => event.target instanceof Node && pane.getHTMLElement()?.contains(event.target)
  const groupDrag = (event: PointerEvent) => { if (laneMode && inPane(event)) laneControls.startPlotDrag(event, linked) }
  const laneWheel = (event: WheelEvent) => { if (laneMode && inPane(event)) laneControls.scrollLanes(event) }
  chart.chartElement().addEventListener('pointerdown', groupDrag, true)
  chart.chartElement().addEventListener('wheel', laneWheel, { capture: true, passive: false })
  const plotY = (key: string, value: number) => laneMode ? laneControls.y(key) : series[key]?.priceToCoordinate(value) ?? null
  let outlineColor = '#888888'
  const updateForecast = () => {
    if (!releaseHover || !indicator) { releaseTooltip.hide(); return }
    const { key, reading } = releaseHover
    const meeting = key === 'rate' ? indicator.forecasts?.meetings.get(reading.releasedAt) : undefined
    const forecast = meeting ? meeting.consensus.find(row => row.provider === 'investing')?.value : reading.forecast
    releaseTooltip.show(key, reading, forecast, formatRelease)
  }
  type Bounds = { from: number; to: number }
  const bounds = new Map<MacroAxis, Bounds>()
  const placements = new Map<MacroAxis, { height: number; unitsPerPixel: number; topValue: number }>()
  let savedPlacements: Record<string, MacroPlacement> | undefined
  let restoringPlacements = false, initialPlacements = true
  let axisRestoreId: string | undefined
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
  const captureBounds = (axis: MacroAxis, id: string, resize: boolean) => {
    const scale = pane.priceScale(id), range = scale.getVisibleRange(), height = pane.getHeight()
    if (!validBounds(range) || height <= 1) return
    const key = (Object.keys(series) as MacroMetric[]).find(key => macroMetricAxis(key) === axis && plots[key]?.line.length)
    if (!key) return
    const fromY = series[key].priceToCoordinate(range.from), toY = series[key].priceToCoordinate(range.to)
    if (fromY === null || toY === null || fromY <= toY) return
    const previous = placements.get(axis)
    if (resize && previous && previous.height !== height && !scale.options().autoScale) {
      // Preserve the old value-to-pixel mapping at the pane's top. Using the
      // native endpoint coordinates also accounts for the scale's margins.
      const next = { from: previous.topValue - fromY * previous.unitsPerPixel,
        to: previous.topValue - toY * previous.unitsPerPixel }
      if (!validBounds(next)) return
      bounds.set(axis, next); scale.setVisibleRange(next)
      placements.set(axis, { ...previous, height })
    } else {
      const unitsPerPixel = (range.to - range.from) / (fromY - toY)
      placements.set(axis, { height, unitsPerPixel, topValue: range.to + toY * unitsPerPixel })
      bounds.set(axis, { ...range })
    }
  }
  const linkAxes = () => {
    if (laneMode || fittingAll || !indicator || (!linked && !macroLayout(indicator.preferences).categoryTarget)) return
    const selection = macroSelection(indicator.preferences)
    const axis = selectedAxisFor(indicator.preferences), id = axisScales.get(axis), previous = placements.get(axis)
    if (!id || !previous || previous.height !== pane.getHeight()) return
    const range = pane.priceScale(id).getVisibleRange()
    const key = (Object.keys(series) as MacroMetric[]).find(key => macroMetricAxis(key) === axis && plots[key]?.line.length)
    if (!key || !validBounds(range)) return
    const fromY = series[key].priceToCoordinate(range.from), toY = series[key].priceToCoordinate(range.to)
    if (fromY === null || toY === null || fromY <= toY) return
    const unitsPerPixel = (range.to - range.from) / (fromY - toY)
    const topValue = range.to + toY * unitsPerPixel
    const zoom = previous.unitsPerPixel / unitsPerPixel, shift = (topValue - previous.topValue) / unitsPerPixel
    if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isFinite(shift)
      || (Math.abs(zoom - 1) < 1e-10 && Math.abs(shift) < 1e-7)) return
    // Apply the selected scale's screen-space transform to the other scales.
    // Each retains its own units; all points move by the same pixels/zoom.
    for (const [otherAxis, otherId] of axisScales) {
      if (otherAxis === axis || (!linked && !selection.includes(otherAxis))) continue
      const old = placements.get(otherAxis), otherRange = pane.priceScale(otherId).getVisibleRange()
      const otherKey = (Object.keys(series) as MacroMetric[]).find(key => macroMetricAxis(key) === otherAxis && plots[key]?.line.length)
      if (!old || old.height !== previous.height || !otherKey || !validBounds(otherRange)) continue
      const lowY = series[otherKey].priceToCoordinate(otherRange.from), highY = series[otherKey].priceToCoordinate(otherRange.to)
      if (lowY === null || highY === null) continue
      const unit = old.unitsPerPixel / zoom, top = old.topValue + shift * unit
      const next = { from: top - lowY * unit, to: top - highY * unit }
      if (!validBounds(next)) continue
      bounds.set(otherAxis, next); pane.priceScale(otherId).setVisibleRange(next)
    }
    captureBounds(axis, id, false)
  }
  const persistBounds = () => {
    if (indicator) {
      const snapshot = { ...savedPlacements }
      for (const [axis, range] of bounds) { const placement = placements.get(axis); if (placement) snapshot[axis] = { ...placement, ...range } }
      const same = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-10
      const changed = Object.entries(snapshot).some(([key, p]) => { const old = savedPlacements?.[key]; return !old || !(['from', 'to', 'height', 'unitsPerPixel', 'topValue'] as const).every(field => same(p[field], old[field])) })
      if (changed) { savedPlacements = snapshot; commitPreferences(patchMacroLayout(indicator.preferences, { axisPlacements: snapshot })) }
    }
  }
  const saveOnExit = () => {
    if (destroyed) return
    for (const [axis, id] of axisScales) captureBounds(axis, id, true)
    persistBounds()
  }
  window.addEventListener('pagehide', saveOnExit)
  const bindAfterPaint = () => {
    if (destroyed || boundsFrame !== null) return
    boundsFrame = window.requestAnimationFrame(() => {
      boundsFrame = null
      if (!restoringPlacements) linkAxes()
      for (const [axis, id] of axisScales) {
        const scale = pane.priceScale(id)
        // Native initial fitting and double-click fitting settle at paint. Read
        // the fitted result once, then bind it with the public range API. Hidden
        // scales need custom ranges too; autoScale=false alone is insufficient.
        if (!scale.options().autoScale || hasReference(axis)) {
          captureBounds(axis, id, true)
        }
        applyBounds(axis, id)
      }
      fittingAll = false; restoringPlacements = false
      persistBounds()
    })
  }
  fitButton.onclick = () => {
    if (!indicator) return
    if (laneMode) { laneControls.fitAll(); return }
    const axis = selectedAxisFor(indicator.preferences), id = axisScales.get(axis)
    if (!id) return
    bounds.delete(axis)
    pane.priceScale(id).setAutoScale(true)
    bindAfterPaint()
  }
  fitAllButton.onclick = () => {
    if (!indicator) return
    if (laneMode) { laneControls.fitAll(); return }
    fittingAll = true
    for (const [axis, id] of axisScales) {
      bounds.delete(axis); pane.priceScale(id).setAutoScale(true)
    }
    bindAfterPaint()
  }
  const updateLock = () => {
    laneControls.setLinked(linked)
    lockButton.setAttribute('aria-pressed', String(linked))
    lockButton.setAttribute('aria-label', `${linked ? 'Unlink' : 'Link'} MFDI axes`)
    lockButton.title = laneMode ? (linked ? 'Linked lanes: drag the plot to move all lanes; wheel scrolls vertically. Adjust spacing in Series.' : 'Link all lanes for group dragging. Wheel scrolls vertically; adjust spacing in Series.') : linked ? 'Axes linked: drag and scale all MFDI series together. Click to adjust each independently.' : 'Link all MFDI axes to drag and scale every series together'
    lockShackle.setAttribute('d', linked ? 'M8 10V6a4 4 0 0 1 8 0v4' : 'M8 10V6a4 4 0 0 1 8 0')
  }
  lockButton.onclick = () => {
    for (const [axis, id] of axisScales) captureBounds(axis, id, true)
    linked = !linked
    if (indicator) commitPreferences(patchMacroLayout(indicator.preferences, { linked }))
  }
  updateLock()
  flattenButton.onclick = () => { if (indicator) commitPreferences(patchMacroLayout(indicator.preferences, { laneMode: !laneMode })) }
  const updateLegend = () => {
    if (!indicator) return
    const p = indicator.preferences
    const selection = macroSelection(p)
    for (const { key, label, axisButton, eyeButton, slash, forecastButton, forecastSlash, numbersButton, numbersSlash, colorDot, colorInput } of metricControls) {
      const visible = macroMetricVisible(p, key)
      colorDot.style.backgroundColor = colourFor(key)
      const inputColour = colourDrafts.get(key) ?? colourFor(key)
      if (document.activeElement !== colorInput && colorInput.value !== inputColour) colorInput.value = inputColour
      axisButton.setAttribute('aria-pressed', String(linked ? visible : selection.includes(key)))
      eyeButton.setAttribute('aria-pressed', String(visible))
      eyeButton.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label}`)
      eyeButton.title = `${visible ? 'Hide' : 'Show'} ${label}`
      slash.setAttribute('visibility', visible ? 'hidden' : 'visible')
      const forecastsVisible = p.series[key].forecastVisible
      forecastButton.setAttribute('aria-pressed', String(forecastsVisible))
      forecastButton.setAttribute('aria-label', `${forecastsVisible ? 'Hide' : 'Show'} ${label} forecasts`)
      forecastButton.title = `${forecastsVisible ? 'Hide' : 'Show'} ${label} historical forecasts. Upcoming release previews stay visible.`
      forecastSlash.setAttribute('visibility', forecastsVisible ? 'hidden' : 'visible')
      const numbersVisible = p.series[key].numbersVisible
      numbersButton.setAttribute('aria-pressed', String(numbersVisible))
      numbersButton.setAttribute('aria-label', `${numbersVisible ? 'Hide' : 'Show'} ${label} numbers`)
      numbersButton.title = `${numbersVisible ? 'Hide' : 'Show'} values above actual release dots. Numbers follow this series' eye and dot settings.`
      numbersSlash.setAttribute('visibility', numbersVisible ? 'hidden' : 'visible')
    }
    const time = hover ?? latestTime
    readout.hidden = macroLayout(p).hideLegend
    readout.replaceChildren()
    const visible = metricControls.map(({ key }) => key).filter(key => macroMetricVisible(p, key))
    for (const key of visible) {
      const reading = time === undefined ? undefined : plots[key]?.readings.get(time)
      const field = document.createElement('span'); field.className = 'macro-field'
      const swatch = document.createElement('span'); swatch.className = 'macro-swatch'; swatch.style.backgroundColor = colourFor(key)
      swatch.setAttribute('aria-hidden', 'true')
      const value = document.createElement('span')
      value.textContent = `${macroCatalog[key].label} ${reading ? macroValue(key, reading.value, reading) : '—'}`
      const date = document.createElement('span'); date.className = 'macro-release'
      date.textContent = reading ? `Released ${formatRelease(reading.releasedAt)}` : 'No known actual at this candle'
      field.append(swatch, value, date); readout.append(field)
    }
    const noPoints = visible.every(key => !plots[key]?.dots.length)
    const empty = !metricControls.length ? 'Choose currencies and add events in MFDI settings'
      : !visible.length ? 'All series hidden; use an eye to show a series'
      : visible.every(key => !indicator!.history[key]?.length) ? 'No released numeric actuals with verified chart timing'
      : noPoints ? 'No releases in loaded candles; scroll left for earlier releases' : ''
    note.textContent = [indicator.status, empty].filter(Boolean).join(' · ')
    note.hidden = !note.textContent

  }
  const onHover = (event: MouseEventParams<Time>) => {
    hover = event.point ? typeof event.time === 'number' ? event.time : NaN : null
    const hit = hitDot(event)
    releaseHover = hit ? { key: hit.key, time: hit.time, reading: hit.reading } : undefined
    forecastHover = hit?.key === 'rate' ? { time: hit.time, reading: hit.reading } : undefined
    if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; updateLegend(); updateForecast(); requestUpdate() })
  }
  chart.subscribeCrosshairMove(onHover)
  const hitDot = (event: MouseEventParams<Time>) => {
    if (!indicator || !event.point || typeof event.time !== 'number' || event.paneIndex !== pane.paneIndex()) return
    const { x, y } = event.point
    const badge = markerHits.find(hit => macroMetricVisible(indicator!.preferences, hit.key) && indicator!.preferences.series[hit.key].pointsVisible
      && ((x - hit.x) / hit.rx) ** 2 + ((y - hit.y) / hit.ry) ** 2 <= 1)
    if (badge) return { key: badge.key, time: badge.time, reading: badge.reading, distance: 0, preferred: true }
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
          const py = plotY(key, point.value)
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
    const hit = hitDot(event)
    if (hit) {
      if (inspectRelease) { claimChartClick(event); inspectRelease(hit.reading) }
      return
    }
    if (event.point) resetSelection()
  }
  const resetSelection = () => {
    if (!indicator) return
    const layout = indicator.preferences.layout
    if (linked && !layout?.categoryTarget) return
    for (const [axis, id] of axisScales) captureBounds(axis, id, true)
    linked = true
    if (layout?.categoryTarget) {
      const next = { ...layout, linked: true }; delete next.categoryTarget
      commitPreferences({ ...indicator.preferences, layout: next })
    } else commitPreferences(patchMacroLayout(indicator.preferences, { linked: true }))
  }
  const outsideClick = (event: MouseEvent) => {
    if (!(event.target instanceof Node) || chart.chartElement().contains(event.target)) return
    const target = event.target instanceof HTMLElement ? event.target : event.target.parentElement
    if (target?.closest('.macro-settings-dialog, [aria-label="MFDI indicator"]')) return
    resetSelection()
  }
  chart.chartElement().ownerDocument.addEventListener('click', outsideClick)
  chart.subscribeClick(onClick)
  // Project onto the existing future axis without registering forecast timestamps
  // or contributing forecast values to any native price scale.
  const futureCoordinates = () => {
    if (latestTime === undefined) return
    const scale = chart.timeScale(), anchor = scale.timeToIndex(latestTime as Time), lastTime = latestTime
    if (anchor === null) return
    return (time: number) => {
      if (time < lastTime + step || time > lastTime + futureTimelineSeconds) return null
      const logical = Number(anchor) + (time - lastTime) / step, left = Math.floor(logical)
      const x0 = scale.logicalToCoordinate(left as Logical), x1 = scale.logicalToCoordinate((left + 1) as Logical)
      return x0 === null || x1 === null ? null : x0 + (x1 - x0) * (logical - left)
    }
  }
  const markerCoordinate = (time: number, futureX: ReturnType<typeof futureCoordinates>) => {
    if (latestTime === undefined) return
    if (time >= latestTime + step) { const x = futureX?.(time); return x === undefined || x === null ? undefined : { x, time } }
    let lo = 0, hi = markerBars.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (markerBars[mid].time <= time) lo = mid + 1; else hi = mid }
    const bar = markerBars[lo - 1]
    if (!bar || time >= bar.time + step) return
    const x = chart.timeScale().timeToCoordinate(bar.time as Time)
    return x === null ? undefined : { x, time: bar.time }
  }
  const renderer: IPrimitivePaneRenderer = { draw(target) {
    markerHits = []
    legend.style.top = `${(pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8) + 4}px`
    legend.style.width = `${Math.max(0, chart.paneSize(pane.paneIndex()).width - 20)}px`
    legend.style.maxHeight = `${Math.max(24, pane.getHeight() - 10)}px`
    if (indicator) {
      laneControls.position(indicator.preferences, chart.paneSize(pane.paneIndex()).width, pane.getHeight(),
        legend.offsetHeight + 12 || 36, pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8)
    }
    if (!restoringPlacements) linkAxes()
    for (const [axis, id] of axisScales) {
      if (laneMode && placements.get(axis)?.height === pane.getHeight()) applyBounds(axis, id)
      if (placements.has(axis) && placements.get(axis)!.height !== pane.getHeight()) bindAfterPaint()
      else if (!pane.priceScale(id).options().autoScale) captureBounds(axis, id, false)
    }
    bindAfterPaint()
    if (indicator) {
      const futureX = futureCoordinates()
      if (laneMode) target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip()
        for (const { key } of metricControls) {
          const y = plotY(key, 0), style = indicator!.preferences.series[key]
          if (y === null || y < 0 || y > mediaSize.height || !macroMetricVisible(indicator!.preferences, key)) continue
          context.strokeStyle = colourFor(key); context.fillStyle = colourFor(key); context.lineWidth = style.lineWidth
          context.globalAlpha = 0.2; context.setLineDash([]); context.beginPath(); context.moveTo(0, y); context.lineTo(mediaSize.width, y); context.stroke()
          const points = plots[key]?.line ?? []
          const firstX = points.length ? chart.timeScale().timeToCoordinate(points[0].time) : null
          const lastX = points.length ? chart.timeScale().timeToCoordinate(points.at(-1)!.time) : null
          context.globalAlpha = 1
          if (firstX !== null && lastX !== null) { context.beginPath(); context.moveTo(firstX, y); context.lineTo(lastX, y); context.stroke() }
          if (style.pointsVisible) for (const point of plots[key]?.dots ?? []) {
            const x = chart.timeScale().timeToCoordinate(point.time)
            if (x === null || x < 0 || x > mediaSize.width) continue
            context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2); context.fill()
          }
        }
        context.restore()
      })
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip()
        for (const { key } of metricControls) {
          const style = indicator!.preferences.series[key]
          if (!macroMetricVisible(indicator!.preferences, key) || !style.forecastVisible) continue
          const points = (forecastPlots[key]?.dots ?? []).flatMap(point => {
            const x = chart.timeScale().timeToCoordinate(point.time), y = plotY(key, point.value)
            return x === null || y === null ? [] : [{ x, y }]
          })
          context.strokeStyle = colourFor(key); context.lineWidth = style.lineWidth
          context.globalAlpha = 0.6; context.setLineDash([]); context.beginPath()
          points.forEach((point, index) => { if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y) })
          context.stroke()
          const ring = (x: number, y: number, alpha: number) => {
            if (x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) return
            context.globalAlpha = alpha; context.lineWidth = 1.5; context.setLineDash([])
            context.beginPath(); context.arc(x, y, 6, 0, Math.PI * 2); context.stroke()
          }
          if (style.pointsVisible) for (const point of points) ring(point.x, point.y, 1)
        }
        context.restore()
      })
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        context.save(); context.font = '11px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'bottom'
        for (const { key } of metricControls) {
          const style = indicator!.preferences.series[key]
          if (!macroMetricVisible(indicator!.preferences, key) || !style.pointsVisible || !style.numbersVisible) continue
          context.fillStyle = colourFor(key)
          for (const point of plots[key]?.dots ?? []) {
            const x = chart.timeScale().timeToCoordinate(point.time), y = plotY(key, point.value)
            if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue
            const reading = plots[key]!.readings.get(point.time)
            if (releaseMarkers.hasActual(key, reading!.releasedAt)) continue
            const text = numberLabels[key]?.get(reading!.time) ?? macroValue(key, point.value, reading)
            const halfWidth = context.measureText(text).width / 2
            const labelX = Math.max(halfWidth + 2, Math.min(x, mediaSize.width - halfWidth - 2))
            context.fillText(text, labelX, Math.max(13, y - 9))
          }
        }
        context.restore()
      })
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        context.save(); context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip()
        const previous = new Map<string, { x: number; y: number }>()
        for (const { key } of metricControls) {
          const point = plots[key]?.line.at(-1), x = point && chart.timeScale().timeToCoordinate(point.time), y = point && plotY(key, point.value)
          if (x !== null && x !== undefined && y !== null && y !== undefined) previous.set(key, { x, y })
        }
        for (const marker of releaseMarkers.all()) {
          const { key, actual, forecast } = marker, style = indicator!.preferences.series[key]
          if (!macroMetricVisible(indicator!.preferences, key)) continue
          const value = actual?.value ?? forecast, coordinate = markerCoordinate(marker.time, futureX)
          if (!coordinate || (actual && plots[key]?.readings.get(coordinate.time)?.id !== actual.id)) continue
          const y = value === undefined ? laneMode ? plotY(key, 0) : null : plotY(key, value), { x, time } = coordinate
          if (value === undefined) previous.delete(key)
          if (y === null) continue
          const color = colourFor(key), from = previous.get(key)
          if (!actual && value !== undefined) {
            context.strokeStyle = color; context.lineWidth = style.lineWidth; context.globalAlpha = 0.25; context.setLineDash([])
            if (from) { context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(x, y); context.stroke() }
            previous.set(key, { x, y })
          }
          if (!style.pointsVisible || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue
          const text = value === undefined ? '—' : macroValue(key, value, actual ?? marker.format)
          const bounds = paintMacroReleaseMarker(context, x, y, text, color, !!actual)
          if (actual) markerHits.push({ ...bounds, key, reading: actual, time: time as Time })
        }
        context.restore()
      })
    }
    if (releaseHover && indicator) {
      const { key, time, reading } = releaseHover
      const x = chart.timeScale().timeToCoordinate(time), y = plotY(key, reading.value)
      const width = chart.paneSize(pane.paneIndex()).width
      if (!macroMetricVisible(indicator.preferences, key) || x === null || y === null || x < 0 || x > width || y < 0 || y > pane.getHeight()) releaseTooltip.hide()
      else {
        tooltip.hidden = false
        releaseTooltip.position(x, y, pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height,
          chart.chartElement().clientWidth, chart.chartElement().clientHeight)
      }
    }
    if (!indicator || !macroMetricVisible(indicator.preferences, 'rate') || !indicator.preferences.series.rate.pointsVisible) return
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save(); context.strokeStyle = outlineColor; context.lineWidth = 1.5; context.setLineDash([])
      for (const point of plots.rate?.dots ?? []) {
        const reading = plots.rate!.readings.get(point.time)!
        const primary = indicator!.forecasts?.meetings.get(reading.releasedAt)?.consensus.find(row => row.provider === 'investing')
        if (!primary || fedSurprise(reading.value, primary.value).bp <= 0) continue
        const x = chart.timeScale().timeToCoordinate(point.time), y = plotY('rate', point.value)
        if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) continue
        context.beginPath(); context.arc(x, y, 6.5, 0, Math.PI * 2); context.stroke()
      }
      if (forecastHover) {
        const x = chart.timeScale().timeToCoordinate(forecastHover.time), y = plotY('rate', forecastHover.reading.value)
        if (x === null || y === null || x < 0 || x > mediaSize.width || y < 0 || y > mediaSize.height) {
          releaseTooltip.hide()
        } else {
          const primary = indicator!.forecasts?.meetings.get(forecastHover.reading.releasedAt)?.consensus.find(row => row.provider === 'investing')
          const fy = primary ? plotY('rate', primary.value) : null
          if (fy !== null) {
            context.strokeStyle = colourFor('rate'); context.lineWidth = 1; context.setLineDash([3, 3])
            context.beginPath(); context.moveTo(x, y); context.lineTo(x, Math.max(0, Math.min(mediaSize.height, fy))); context.stroke()
            if (fy >= 0 && fy <= mediaSize.height) {
              context.setLineDash([]); context.beginPath(); context.moveTo(x - 4, fy); context.lineTo(x + 4, fy); context.stroke()
            }
          }

        }
      }
      context.restore()
    })
  } }
  const views = [{ zOrder: () => 'top' as const, renderer: () => renderer }]
  const primitive: IPanePrimitive = { paneViews: () => views, attached: params => { requestUpdate = params.requestUpdate }, detached: () => { requestUpdate = () => {} } }
  pane.attachPrimitive(primitive)
  return {
    sync(bars: OhlcBar[], next: MacroIndicator, seconds: number, format: (at: number) => string,
      callbacks: { toggleMetric: (metric: MacroMetric) => void; selectMetric: (metric: MacroMetric) => void;
        toggleForecast?: (metric: MacroMetric) => void; toggleNumbers?: (metric: MacroMetric) => void; changePreferences?: (value: MacroPreferences) => void; inspectRelease?: (reading: MacroReading) => void }) {
      if (destroyed) return
      if (!restoringPlacements) linkAxes()
      // Capture a user's drag/zoom before moving its series off the right axis.
      // Removing a scale's final source resets its native range and auto mode.
      for (const [axis, id] of axisScales) {
        const scale = pane.priceScale(id)
        if (scale.options().autoScale) bounds.delete(axis) // Explicit native fit.
        else {
          captureBounds(axis, id, true)
        }
      }
      indicator = next; formatRelease = format; toggleMetric = callbacks.toggleMetric; selectMetric = callbacks.selectMetric
      toggleForecast = callbacks.toggleForecast ?? (() => {})
      toggleNumbers = callbacks.toggleNumbers ?? (() => {})
      inspectRelease = callbacks.inspectRelease; changePreferences = callbacks.changePreferences
      laneMode = macroLayout(next.preferences).laneMode; flattenButton.setAttribute('aria-pressed', String(laneMode))
      forecastHover = undefined; releaseHover = undefined; releaseTooltip.hide()
      outlineColor = getComputedStyle(chart.chartElement()).getPropertyValue('--text-strong').trim() || '#888888'
      latestTime = bars.at(-1)?.time
      markerBars = bars
      step = seconds
      const p = next.preferences, axis = selectedAxisFor(p), keys = selectedMacroMetrics(p)
      linked = macroLayout(p).linked ?? linked
      const incomingPlacements = p.layout?.axisPlacements
      if (initialPlacements || p.layout?.axisRestoreId !== axisRestoreId) {
        initialPlacements = false; axisRestoreId = p.layout?.axisRestoreId
        bounds.clear(); placements.clear(); savedPlacements = incomingPlacements; restoringPlacements = true
        for (const [key, placement] of Object.entries(incomingPlacements ?? {})) {
          bounds.set(key, { from: placement.from, to: placement.to }); placements.set(key, { height: placement.height, unitsPerPixel: placement.unitsPerPixel, topValue: placement.topValue })
        }
      }
      if (markerSource !== next.sourceId) { releaseMarkers.clear(); markerSnapshot = undefined; markerSource = next.sourceId }
      const markerKeys = keys.join('|')
      if (!markerSnapshot || markerSnapshot.history !== next.history || markerSnapshot.upcoming !== next.upcoming || markerSnapshot.keys !== markerKeys) {
        releaseMarkers.sync(next, Date.now()); markerSnapshot = { history: next.history, upcoming: next.upcoming, keys: markerKeys }
      }
      for (const key of colourDrafts.keys()) if (!keys.includes(key)) { colourDrafts.delete(key); colourPreviews.delete(key) }
      if (!colourDrafts.size) stopColourTimer()
      if (keys.join('|') !== metricControls.map(control => control.key).join('|')) {
        for (const control of metricControls) control.item.remove()
        metricControls = keys.map(createMetricControl)
        laneControls.setRows(metricControls)
      }
      if (!keys.includes('rate')) { rateDots.setData([]); rateDots.applyOptions({ visible: false }) }
      for (const key of Object.keys(series)) if (!keys.includes(key)) { chart.removeSeries(series[key]); delete series[key] }
      for (const key of keys) if (!series[key]) series[key] = pane.addSeries(LineSeries,
        { ...base, ...(macroCatalog[key].carry ? { lineType: LineType.WithSteps, crosshairMarkerVisible: false } : {}) })
      const nextScales = new Map<MacroAxis, string>()
      plots = {}
      forecastPlots = {}
      numberLabels = {}
      for (const key of Object.keys(series) as MacroMetric[]) {
        const active = macroMetricVisible(p, key)
        const metricAxis = macroMetricAxis(key)
        const scaleId = active && metricAxis === axis ? 'right' : `macro-${metricAxis}`
        if (active) nextScales.set(metricAxis, scaleId)
        const priceFormat = { type: 'custom' as const, minMove: key === 'payrolls' ? 1 : 0.01, formatter: (value: number) => macroValue(key, value, next.history[key]?.at(-1)) }
        series[key].applyOptions({ priceScaleId: scaleId, visible: active, color: colourFor(key), priceFormat })
        series[key].applyOptions({ lineWidth: p.series[key].lineWidth,
          pointMarkersVisible: key !== 'rate' && p.series[key].pointsVisible, pointMarkersRadius: 4 })
        const plot = active ? macroPlot(bars, next.history[key] ?? [], step, macroCatalog[key].carry === true) : undefined
        plots[key] = plot
        if (active && p.series[key].numbersVisible) numberLabels[key] = macroNumberLabels(key, next.history[key] ?? [])
        if (active && p.series[key].forecastVisible)
          forecastPlots[key] = macroPlot(bars, next.forecastHistory?.[key] ?? [], step, false)
        series[key].setData(plot?.line ?? [])
        if (key === 'rate') {
          rateDots.applyOptions({ priceScaleId: scaleId, visible: active && p.series.rate.pointsVisible,
            color: colourFor('rate'), priceFormat, pointMarkersVisible: p.series.rate.pointsVisible })
          rateDots.setData(active && p.series.rate.pointsVisible ? plot?.dots ?? [] : [])
        }
        pane.priceScale(scaleId).applyOptions({ scaleMargins: { top: 0.36, bottom: 0.1 } })
      }
      axisScales = nextScales
      for (const [axis, id] of axisScales) {
        if (bounds.has(axis)) applyBounds(axis, id)
        else pane.priceScale(id).setAutoScale(true)
      }
      applyDisplayMode()
      bindAfterPaint()
      updateLegend()
    },
    clearData() {
      markerSnapshot = undefined; markerHits = []; markerBars = []
      clearColourPreviews()
      for (const item of Object.values(series)) item.setData([])
      rateDots.setData([]); plots = {}; forecastPlots = {}; hover = null; forecastHover = undefined; releaseHover = undefined; releaseTooltip.hide(); latestTime = undefined; updateLegend()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      window.removeEventListener('pagehide', saveOnExit)
      releaseMarkers.clear(); markerSnapshot = undefined; markerHits = []; markerBars = []
      clearColourPreviews()
      if (frame !== null) window.cancelAnimationFrame(frame)
      if (boundsFrame !== null) window.cancelAnimationFrame(boundsFrame)
      chart.unsubscribeCrosshairMove(onHover)
      chart.unsubscribeClick(onClick)
      chart.chartElement().ownerDocument.removeEventListener('click', outsideClick)
      chart.chartElement().removeEventListener('pointerdown', groupDrag, true)
      chart.chartElement().removeEventListener('wheel', laneWheel, true)
      laneControls.destroy(); pane.detachPrimitive(primitive); legend.remove(); releaseTooltip.destroy()
      for (const item of Object.values(series)) chart.removeSeries(item)
      chart.removeSeries(rateDots)
      chart.removePane(pane.paneIndex())
    },
  }
}
