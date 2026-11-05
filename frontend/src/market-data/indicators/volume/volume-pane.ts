import { HistogramSeries, LineSeries, LineStyle, type IChartApi, type IPrimitivePaneRenderer, type ISeriesPrimitive, type MouseEventParams, type Time } from 'lightweight-charts'
import type { ChartClockScope } from '../../../appearance/time-display/chart-clock'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createVolumeCalculator, summarizeVolumeRange, type VolumeRange } from './volume-calculation'
import { volumeClocks, type VolumePreferences } from './volume-preferences'
import './volume.css'

export function createVolumePane(chart: IChartApi) {
  const pane = chart.addPane()
  // Native pane widgets are created at paint. Reorder after that first frame,
  // including when RSI and Volume are enabled together before any paint.
  const orderFrame = window.requestAnimationFrame(() => pane.moveTo(1))
  chart.panes()[0].setStretchFactor(3); pane.setStretchFactor(1.5)
  const histogram = pane.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false })
  const average = pane.addSeries(LineSeries, { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
  pane.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.48, bottom: 0 } })
  const baseline = histogram.createPriceLine({ price: 1, color: '#787b86', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, lineVisible: false })
  let calculator = createVolumeCalculator()
  let bars: OhlcBar[] = [], data: ReturnType<typeof calculator.sync> | undefined, preferences: VolumePreferences | undefined
  let scopeKey = '', step = 3600, hover: number | null = null, frame: number | null = null, destroyed = false
  let pending: 'A' | 'B' | null = null, start: number | null = null
  const ranges: { A?: VolumeRange; B?: VolumeRange } = {}
  let formatTime: (time: number) => string = String, changeMode: (mode: VolumePreferences['mode']) => void = () => {}
  let loadOlder: () => void = () => {}
  let topMargin = 0.48
  const legend = document.createElement('div'); legend.className = 'volume-legend'
  legend.setAttribute('aria-label', 'Volume activity and push comparison')
  const controls = document.createElement('div'); controls.className = 'volume-controls'
  const title = document.createElement('strong'), readout = document.createElement('div'), comparison = document.createElement('div')
  readout.className = 'volume-readout'; comparison.className = 'volume-comparison'; comparison.setAttribute('role', 'status')
  const button = (text: string, action: () => void) => {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = text
    element.onclick = action; controls.append(element); return element
  }
  controls.append(title)
  const modeButton = button('Raw', () => { if (preferences) changeMode(preferences.mode === 'raw' ? 'relative' : 'raw') })
  const pick = (target: 'A' | 'B') => { pending = pending === target ? null : target; start = null; updateLegend() }
  const pickA = button('Select A', () => pick('A')), pickB = button('Select B', () => pick('B'))
  button('Clear', () => { delete ranges.A; delete ranges.B; pending = null; start = null; updateLegend(); repaint() })
  const olderButton = button('Load older', () => loadOlder())
  legend.append(controls, readout, comparison); chart.chartElement().append(legend)
  const find = (time: number) => {
    let lo = 0, hi = bars.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (bars[mid].time < time) lo = mid + 1; else hi = mid }
    return bars[lo]?.time === time ? lo : -1
  }
  const updateLegend = () => {
    if (!preferences || !data || destroyed) return
    title.textContent = 'Volume · Ticks'
    modeButton.textContent = preferences.mode === 'raw' ? 'Raw' : 'Relative'
    modeButton.title = 'Switch between raw ticks and same-time-of-day relative activity'
    pickA.setAttribute('aria-pressed', String(pending === 'A')); pickB.setAttribute('aria-pressed', String(pending === 'B'))
    const index = hover === null ? bars.length - 1 : find(hover), row = data.rows[index]
    const relative = row?.relative === undefined ? '—' : `${row.relative.toFixed(2)}×`
    const clockLabel = step >= 86400 ? 'prior daily bars' : `${volumeClocks[preferences.clock]} time slots`
    readout.textContent = row ? `${row.ticks === undefined ? 'Ticks unavailable' : `${row.ticks.toLocaleString()} ticks`} · ${relative} · ${row.samples}/${preferences.lookback} prior samples · ${clockLabel}${index === bars.length - 1 ? ' · latest candle' : ''}` : 'No candle at cursor'
    if (row?.relative === undefined) readout.textContent += row?.utc === null ? ' · Broker clock unavailable' : ` · Need ${preferences.minimumSamples} prior samples with a positive mean`
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
  const renderer: IPrimitivePaneRenderer = {
    draw() {
      legend.style.top = `${(pane.getHTMLElement()?.offsetTop ?? chart.paneSize(0).height + 8) + 3}px`
      const height = pane.getHeight()
      legend.style.maxHeight = `${Math.max(25, height - 12)}px`
      const nextMargin = Math.max(0.25, Math.min(0.85, (legend.offsetHeight + 10) / height))
      if (height > 0 && legend.offsetHeight > 0 && Math.abs(nextMargin - topMargin) > 0.01) {
        topMargin = nextMargin
        pane.priceScale('right').applyOptions({ scaleMargins: { top: topMargin, bottom: 0 } })
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
    sync(nextBars: OhlcBar[], scope: string, next: VolumePreferences, clock: ChartClockScope, seconds: number,
      options: { formatTime: (time: number) => string; changeMode: (mode: VolumePreferences['mode']) => void; loadOlder: () => void; hasOlder: boolean; loadingOlder: boolean }) {
      if (destroyed) return
      if (scopeKey !== scope) {
        calculator = createVolumeCalculator()
        delete ranges.A; delete ranges.B; pending = null; start = null; hover = null
      }
      scopeKey = scope; bars = nextBars; step = seconds; formatTime = options.formatTime; changeMode = options.changeMode; loadOlder = options.loadOlder
      olderButton.disabled = !options.hasOlder || options.loadingOlder; olderButton.textContent = options.loadingOlder ? 'Loading…' : 'Load older'
      const styleChanged = preferences !== next
      const modeChanged = preferences?.mode !== next.mode
      preferences = next
      data = calculator.sync(bars, next, clock, step)
      if (styleChanged) {
        histogram.applyOptions({ priceFormat: next.mode === 'raw' ? { type: 'volume' } : { type: 'custom', minMove: 0.01, formatter: (value: number) => `${value.toFixed(2)}×` } })
        baseline.applyOptions({ lineVisible: next.mode === 'relative' })
        average.applyOptions({ color: next.averageColor, lineVisible: next.mode === 'raw' && next.averageVisible })
      }
      const point = (i: number) => {
        const row = data!.rows[i], value = next.mode === 'raw' ? row.ticks : row.relative
        return value === undefined ? { time: row.time } : { time: row.time, value, color: bars[i].close >= bars[i].open ? next.upColor : next.downColor }
      }
      const mean = (i: number) => data!.rows[i].average === undefined || next.mode !== 'raw' || !next.averageVisible ? { time: bars[i].time } : { time: bars[i].time, value: data!.rows[i].average! }
      if (data.rebuilt || styleChanged || modeChanged || data.from < data.previousLength - 1 || bars.length > data.previousLength + 1) {
        histogram.setData(bars.map((_, i) => point(i))); average.setData(bars.map((_, i) => mean(i)))
      } else for (let i = data.from; i < bars.length; i++) { histogram.update(point(i)); average.update(mean(i)) }
      updateLegend()
    },
    clearData() { histogram.setData([]); average.setData([]) },
    destroy() {
      if (destroyed) return
      destroyed = true
      window.cancelAnimationFrame(orderFrame)
      if (frame !== null) window.cancelAnimationFrame(frame)
      chart.unsubscribeCrosshairMove(onHover); chart.unsubscribeClick(onClick); window.removeEventListener('keydown', onKey)
      histogram.detachPrimitive(primitive); legend.remove(); chart.removePane(pane.paneIndex())
    },
  }
}
