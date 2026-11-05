import { HistogramSeries, LineSeries, LineStyle, LineType, type AutoscaleInfo, type IChartApi, type IPrimitivePaneRenderer, type ISeriesPrimitive, type MouseEventParams, type Time } from 'lightweight-charts'
import { chartClockToUtc, type ChartClockScope } from '../../../appearance/time-display/chart-clock'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createVolumeCalculator, summarizeVolumeRange, type VolumeRange } from './volume-calculation'
import type { VolumePreferences } from './volume-preferences'
import { createForexSessionLookup } from '../../market-watch/forex-sessions'
import './volume.css'

export function createVolumePane(chart: IChartApi) {
  const pane = chart.addPane()
  // Native pane widgets are created at paint. Reorder after that first frame,
  // including when RSI and Volume are enabled together before any paint.
  const orderFrame = window.requestAnimationFrame(() => pane.moveTo(1))
  chart.panes()[0].setStretchFactor(3); pane.setStretchFactor(1.5)
  const histogram = pane.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false })
  const average = pane.addSeries(LineSeries, { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
  const initialLeftVisibility = chart.options().leftPriceScale.visible
  const initialLeftMinimumWidth = chart.options().leftPriceScale.minimumWidth ?? 0
  const compactRatio = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  const relativeLine = pane.addSeries(LineSeries, { priceScaleId: 'left', lineType: LineType.Simple, lineWidth: 2,
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
  let pending: 'A' | 'B' | null = null, start: number | null = null
  const ranges: { A?: VolumeRange; B?: VolumeRange } = {}
  let formatTime: (time: number) => string = String, changeMode: (mode: VolumePreferences['mode']) => void = () => {}
  let loadOlder: () => void = () => {}
  let clock: ChartClockScope = { brokerId: null, brokerOffsetSeconds: 0 }
  const sessionAt = createForexSessionLookup()
  let topMargin = 0.48
  const legend = document.createElement('div'); legend.className = 'volume-legend'
  legend.setAttribute('aria-label', 'Volume activity and push comparison')
  const controls = document.createElement('div'); controls.className = 'volume-controls'
  const buttons = document.createElement('div'); buttons.className = 'volume-pane-controls'
  const title = document.createElement('strong'), readout = document.createElement('div'), comparison = document.createElement('div'), sessionLabel = document.createElement('div')
  sessionLabel.className = 'volume-session'
  sessionLabel.setAttribute('aria-label', 'Automatic volume session')
  sessionLabel.title = 'Indicative sessions from the header. Hover follows chart time; otherwise this shows now. Overlaps are listed together. Broker holidays may differ.'
  readout.className = 'volume-readout'; comparison.className = 'volume-comparison'; comparison.setAttribute('role', 'status')
  const button = (text: string, action: () => void) => {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = text
    element.onclick = action; buttons.append(element); return element
  }
  controls.append(title, buttons)
  const modeButton = button('Raw', () => { if (preferences) changeMode(preferences.mode === 'raw' ? 'relative' : 'raw') })
  const pick = (target: 'A' | 'B') => { pending = pending === target ? null : target; start = null; updateLegend() }
  const pickA = button('Select A', () => pick('A')), pickB = button('Select B', () => pick('B'))
  button('Clear', () => { delete ranges.A; delete ranges.B; pending = null; start = null; updateLegend(); repaint() })
  const olderButton = button('Load older', () => loadOlder())
  legend.append(controls, sessionLabel, readout, comparison); chart.chartElement().append(legend)
  const find = (time: number) => {
    let lo = 0, hi = bars.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (bars[mid].time < time) lo = mid + 1; else hi = mid }
    return bars[lo]?.time === time ? lo : -1
  }
  const updateLegend = () => {
    if (!preferences || !data || destroyed) return
    title.textContent = 'Volume · Ticks'
    modeButton.textContent = preferences.mode === 'raw' ? 'Raw' : 'Relative'
    modeButton.title = 'Switch between raw ticks and activity relative to matching earlier sessions'
    pickA.setAttribute('aria-pressed', String(pending === 'A')); pickB.setAttribute('aria-pressed', String(pending === 'B'))
    const now = Date.now()
    const hoveredUtc = hover !== null && Number.isFinite(hover) ? chartClockToUtc(hover * 1000, clock) : null
    const reference = hover === null ? now : hoveredUtc
    const context = reference === null ? null : sessionAt(reference)
    sessionLabel.textContent = context ? `${context.key || 'No active session'}${context.names.length > 1 ? ' · overlap' : ''} · ${hover === null ? 'now' : 'hovered candle'}` : 'Session unavailable at cursor'
    const latest = data.rows.at(-1)
    const currentLoaded = latest?.utc !== null && latest?.utc !== undefined && now >= latest.utc && now < latest.utc + step * 1000
    const index = hover === null ? currentLoaded ? bars.length - 1 : -1 : find(hover), row = data.rows[index]
    const relative = row?.relative === undefined ? 'Relative unavailable' : `${row.relative.toFixed(2)}× normal`
    readout.textContent = row ? `${row.ticks === undefined ? 'Ticks unavailable' : `${row.ticks.toLocaleString()} ticks`} · ${relative} · ${row.samples}/${preferences.lookback} prior matches${step >= 86400 ? ' · daily bars' : ` · ${row.session}`}` : hover === null ? 'No current candle loaded · hover a candle to inspect it' : 'No candle at cursor'
    if (row && row.relative === undefined) readout.textContent += row.utc === null ? ' · Broker clock unavailable' : ` · Need ${preferences.minimumSamples} prior matches with a positive mean`
    const lines: string[] = []
    if (pending) lines.push(`${pending}: click ${start === null ? 'the first' : 'the last'} candle of the push in the Volume pane. Esc cancels.`)
    const summary = (name: 'A' | 'B') => {
      const range = ranges[name]
      if (!range) return null
      const result = summarizeVolumeRange(bars, data!.rows, range, step, Date.now())
      lines.push(`${name}: ${result.candles} closed bars · ${result.minutes} min · ${result.ticks === undefined ? 'ticks unavailable' : `${result.ticks.toLocaleString()} ticks`} · avg ${result.averageRelative === undefined ? `— (${result.relativeCount}/${result.candles} baselines)` : `${result.averageRelative.toFixed(2)}×`}${result.excluded ? ' · unfinished candle excluded' : ''}`)
      return result
    }
    const a = summary('A'), b = summary('B')
    if (a && b && a.averageRelative !== undefined && b.averageRelative !== undefined && a.averageRelative > 0)
      lines.push(`B vs A: ${((b.averageRelative / a.averageRelative - 1) * 100).toFixed(1)}% average relative activity${b.high !== undefined && a.high !== undefined ? ` · ${b.high > a.high ? 'higher' : b.high < a.high ? 'lower' : 'equal'} price high` : ''}`)
    comparison.textContent = lines.join('\n')
    comparison.title = (['A', 'B'] as const).filter(name => ranges[name]).map(name => `${name}: ${formatTime(ranges[name]!.from)} → ${formatTime(ranges[name]!.to)}`).join('\n')
  }
  const repaint = () => { histogram.applyOptions({}) }
  const onHover = (event: MouseEventParams<Time>) => {
    hover = event.point ? typeof event.time === 'number' ? event.time : NaN : null
    if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; updateLegend() })
  }
  const onClick = (event: MouseEventParams<Time>) => {
    if (!pending || event.paneIndex !== pane.paneIndex() || typeof event.time !== 'number' || find(event.time) < 0) return
    if (start === null) start = event.time
    else { ranges[pending] = { from: Math.min(start, event.time), to: Math.max(start, event.time) }; pending = null; start = null; repaint() }
    updateLegend()
  }
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && pending) { pending = null; start = null; updateLegend() } }
  chart.subscribeCrosshairMove(onHover); chart.subscribeClick(onClick); window.addEventListener('keydown', onKey)
  // Only the idle session/readout needs wall time. Do not recalculate series,
  // trigger React renders or schedule frames while a historical candle is hovered.
  const sessionTimer = window.setInterval(() => { if (hover === null) updateLegend() }, 30_000)
  const renderer: IPrimitivePaneRenderer = {
    draw() {
      const leftWidth = chart.options().leftPriceScale.visible ? pane.priceScale('left').width() : 0
      legend.style.left = `${leftWidth + 10}px`
      legend.style.maxWidth = `${Math.max(0, chart.paneSize(pane.paneIndex()).width - 20)}px`
      legend.style.top = `${(pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8) + 3}px`
      const height = pane.getHeight()
      legend.style.maxHeight = `${Math.max(25, height - 12)}px`
      const nextMargin = Math.max(0.25, Math.min(0.85, (legend.offsetHeight + 10) / height))
      if (height > 0 && legend.offsetHeight > 0 && Math.abs(nextMargin - topMargin) > 0.01) {
        topMargin = nextMargin
        pane.priceScale('right').applyOptions({ scaleMargins: { top: topMargin, bottom: 0 } })
        if (preferences?.relativeLineVisible && preferences.mode === 'raw') pane.priceScale('left').applyOptions({ scaleMargins: { top: topMargin, bottom: 0 } })
      }
    },
    drawBackground(target) {
      const scale = chart.timeScale()
      for (const name of ['A', 'B'] as const) {
        const range = ranges[name]
        if (!range) continue
        const left = scale.timeToCoordinate(range.from as Time), right = scale.timeToCoordinate(range.to as Time)
        if (left === null || right === null) continue
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          context.save(); context.fillStyle = name === 'A' ? '#2980d9' : '#c08020'; context.globalAlpha = 0.16
          const half = scale.options().barSpacing / 2
          context.fillRect(left - half, 0, right - left + half * 2, mediaSize.height); context.restore()
        })
      }
    },
  }
  const primitive: ISeriesPrimitive<Time> = { paneViews: () => [{ zOrder: () => 'bottom', renderer: () => renderer }] }
  histogram.attachPrimitive(primitive)
  return {
    sync(nextBars: OhlcBar[], scope: string, next: VolumePreferences, nextClock: ChartClockScope, seconds: number,
      options: { formatTime: (time: number) => string; changeMode: (mode: VolumePreferences['mode']) => void; loadOlder: () => void; hasOlder: boolean; loadingOlder: boolean }) {
      if (destroyed) return
      if (scopeKey !== scope) {
        calculator = createVolumeCalculator()
        delete ranges.A; delete ranges.B; pending = null; start = null; hover = null
      }
      scopeKey = scope; bars = nextBars; step = seconds; clock = nextClock; formatTime = options.formatTime; changeMode = options.changeMode; loadOlder = options.loadOlder
      olderButton.disabled = !options.hasOlder || options.loadingOlder; olderButton.textContent = options.loadingOlder ? 'Loading…' : 'Load older'
      const styleChanged = preferences !== next
      const modeChanged = preferences?.mode !== next.mode
      preferences = next
      data = calculator.sync(bars, next, clock, step)
      if (styleChanged) {
        buttons.hidden = !next.paneControlsVisible
        if (buttons.hidden) { pending = null; start = null }
        histogram.applyOptions({ priceFormat: next.mode === 'raw' ? { type: 'volume' } : { type: 'custom', minMove: 0.01, formatter: (value: number) => `${value.toFixed(2)}×` } })
        relativeLine.applyOptions({ priceScaleId: next.mode === 'raw' ? 'left' : 'right', color: next.relativeLineColor,
          visible: next.relativeLineVisible, lastValueVisible: next.relativeLineVisible, crosshairMarkerVisible: next.relativeLineVisible })
        // Keep the extra axis width stable as history clears/reloads and candle
        // values change, so native layout cannot shift the saved date window.
        const separateScale = next.mode === 'raw' && next.relativeLineVisible
        chart.applyOptions({ leftPriceScale: { visible: separateScale ? true : initialLeftVisibility,
          minimumWidth: separateScale ? Math.max(80, initialLeftMinimumWidth) : initialLeftMinimumWidth } })
        pane.priceScale('left').applyOptions({ autoScale: true, scaleMargins: { top: topMargin, bottom: 0 } })
        baseline.applyOptions({ lineVisible: next.mode === 'relative' && !next.relativeLineVisible })
        relativeBaseline.applyOptions({ lineVisible: next.relativeLineVisible })
        average.applyOptions({ color: next.averageColor, lineVisible: next.mode === 'raw' && next.averageVisible })
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
      chart.unsubscribeCrosshairMove(onHover); chart.unsubscribeClick(onClick); window.removeEventListener('keydown', onKey)
      chart.applyOptions({ leftPriceScale: { visible: initialLeftVisibility, minimumWidth: initialLeftMinimumWidth } })
      histogram.detachPrimitive(primitive); legend.remove(); chart.removePane(pane.paneIndex())
    },
  }
}
