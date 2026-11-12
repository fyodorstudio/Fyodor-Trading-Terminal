import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import {
  CandlestickSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import type { ColorTheme } from '../../appearance/color-theme/color-theme-preference'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { ChartDrawingOverlay } from '../chart-drawings/ChartDrawingOverlay'
import type { ChartDrawingPoint, ChartDrawingRecord } from '../chart-drawings/chart-drawing-record'
import type { DrawingToolId } from '../chart-drawings/drawing-tool'
import type { ChartAppearance } from '../chart-settings/chart-appearance-preference'
import type { ChartTimeframe } from '../contracts/ChartTimeframe'
import type { OhlcBar } from '../contracts/OhlcBar'
import { changedRecentBarStart } from '../mt5-feed/market-snapshots'
import { lightweightChartOptions } from './lightweight-chart-options'
import { advanceDateWindow, captureDateWindow, projectDateWindow, type ChartDateWindow } from './chart-viewport'
import { createFutureTimeline } from './future-timeline'
import { createChartPriceSpace } from './chart-price-space'
import { timeframeToSeconds } from '../chart-drawings/position-drawing-geometry'
import { createVolumePane } from '../indicators/volume/volume-pane'
import type { VolumeLayer, VolumePreferences } from '../indicators/volume/volume-preferences'
import { createRsiPane } from '../indicators/rsi/rsi-pane'
import type { RsiPreferences } from '../indicators/rsi/rsi-preferences'
import { createMacroPane } from '../indicators/macro/macro-pane'
import { supportsMacro, type MacroIndicator, type MacroReading } from '../indicators/macro/macro-data'
import { createPriceViewportMemory } from './chart-price-viewport'
import type { MacroMetric } from '../indicators/macro/macro-preferences'
import { PricePaneOverlays } from './PricePaneOverlays'
import { chartDataTrace } from './chart-data-trace'
import './market-candlestick-chart.css'

type MarketCandlestickChartProps = {
  symbol?: string
  bars: OhlcBar[]
  fitContentKey: string
  precision: number
  theme: ColorTheme
  appearance: ChartAppearance
  timeDisplay: TimeDisplayPreference
  timeframe?: ChartTimeframe
  volume?: VolumePreferences
  onChangeVolumeAxis?: (target: VolumePreferences['axisTarget']) => void
  onToggleVolumeLayer?: (layer: VolumeLayer) => void
  rsi?: RsiPreferences
  macro?: MacroIndicator
  onToggleMacroMetric?: (metric: MacroMetric) => void
  onToggleMacroForecast?: (metric: MacroMetric) => void
  onToggleMacroNumbers?: (metric: MacroMetric) => void
  onChangeMacroPreferences?: (value: MacroIndicator['preferences']) => void
  onSelectMacroMetric?: (metric: MacroMetric) => void
  onInspectMacroRelease?: (reading: MacroReading) => void
  refocusRequest?: number
  activeDrawingTool: DrawingToolId | null
  drawings: ChartDrawingRecord[]
  selectedDrawingId: string | null
  onSelectDrawing: (drawingId: string | null) => void
  onCreateDrawing: (tool: DrawingToolId, points: ChartDrawingPoint[]) => string
  onUpdateDrawingPoint: (drawingId: string, pointIndex: number, point: ChartDrawingPoint, persist: boolean) => void
  onUpdateDrawingPoints?: (drawingId: string, points: ChartDrawingPoint[], persist: boolean) => void
  onUpdatePositionWidth: (drawingId: string, time: ChartDrawingPoint['time'], persist: boolean) => void
  onUpdateDrawingText?: (drawingId: string, text: string) => void
  onDeleteSelectedDrawing?: () => void
  onDeleteDrawing?: (drawingId: string) => void
  onExitDrawingMode: () => void
  onDataApplied: (barCount: number) => void
  onChartTrace?: (trace: string) => void
  hasOlderData: boolean
  isLoadingOlderData: boolean
  onRequestOlderData: () => void
  renderChartOverlay?: (
    chartApi: IChartApi,
    seriesApi: ISeriesApi<'Candlestick', Time>,
  ) => ReactNode
}

function MarketCandlestickChartComponent({
  symbol,
  bars,
  fitContentKey,
  precision,
  theme,
  appearance,
  timeDisplay,
  timeframe,
  volume,
  onChangeVolumeAxis,
  onToggleVolumeLayer,
  rsi,
  macro,
  onToggleMacroMetric,
  onToggleMacroForecast,
  onToggleMacroNumbers,
  onChangeMacroPreferences,
  onSelectMacroMetric,
  onInspectMacroRelease,
  refocusRequest = 0,
  activeDrawingTool,
  drawings,
  selectedDrawingId,
  onSelectDrawing,
  onCreateDrawing,
  onUpdateDrawingPoint,
  onUpdateDrawingPoints,
  onUpdatePositionWidth,
  onUpdateDrawingText,
  onDeleteSelectedDrawing,
  onDeleteDrawing,
  onExitDrawingMode,
  onDataApplied,
  onChartTrace,
  hasOlderData,
  isLoadingOlderData,
  onRequestOlderData,
  renderChartOverlay,
}: MarketCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scope: clock, utc: formatUtc } = useDisplayClock()
  const macroEnabled = Boolean(macro?.enabled && supportsMacro(symbol ?? ''))
  const initialClock = useRef(clock)
  const initialAppearanceRef = useRef(appearance)
  const initialTimeDisplayRef = useRef(timeDisplay)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null)
  const volumePaneRef = useRef<ReturnType<typeof createVolumePane> | null>(null)
  const rsiPaneRef = useRef<ReturnType<typeof createRsiPane> | null>(null)
  const macroPaneRef = useRef<ReturnType<typeof createMacroPane> | null>(null)
  const futureTimelineRef = useRef<ReturnType<typeof createFutureTimeline> | null>(null)
  const priceSpaceRef = useRef<ReturnType<typeof createChartPriceSpace> | null>(null)
  const lastRefocusRequest = useRef(refocusRequest)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null)
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<'Candlestick', Time> | null>(null)
  const fittedKeyRef = useRef<string | null>(null)
  const prevBarsRef = useRef<OhlcBar[]>([])
  const priceViewsRef = useRef<ReturnType<typeof createPriceViewportMemory> | null>(null)
  priceViewsRef.current ??= createPriceViewportMemory()
  const historyPagingArmedRef = useRef(false)
  const liveFollowingRef = useRef(true)
  const historyStateRef = useRef({ hasOlderData, isLoadingOlderData })
  const requestOlderDataRef = useRef(onRequestOlderData)
  const dateWindowRef = useRef<ChartDateWindow | null>(null)
  const previousStepRef = useRef(timeframeToSeconds(timeframe))
  const viewportBrokerRef = useRef(clock.brokerId)
  const applyingDataRef = useRef(false)
  const pendingWindowRef = useRef(false)
  const lastHistoryAttemptRef = useRef<string | null>(null)
  const [missingViewportHistory, setMissingViewportHistory] = useState(false)
  const prevBarSpacingRef = useRef(appearance.barSpacing)
  const tracedScopeRef = useRef<string | null>(null)
  const requestedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null)
  // Native range setters are deferred until paint. Keep the requested viewport
  // authoritative across intervening quote, clock, appearance and pane effects.
  const readLogicalRange = useCallback(() => requestedLogicalRangeRef.current ?? chartRef.current?.timeScale().getVisibleLogicalRange() ?? null, [])
  const setLogicalRange = useCallback((range: { from: number; to: number }) => {
    const scale = chartRef.current?.timeScale()
    if (!scale) return
    requestedLogicalRangeRef.current = range
    const width = scale.width?.() || containerRef.current?.clientWidth || 0
    if (width > 0) {
      // Dense intraday views must not hit the native minimum pixel spacing.
      // Keep the normal zoom-in limit, which also stays safe across resizes.
      const spacing = width / (range.to - range.from + 1)
      const minBarSpacing = spacing < 0.5 ? spacing / 2 : 0.5
      const options = scale.options?.()
      if (options?.minBarSpacing !== minBarSpacing)
        chartRef.current?.applyOptions({ timeScale: { minBarSpacing } })
    }
    scale.setVisibleLogicalRange(range)
  }, [])

  useEffect(() => {
    historyStateRef.current = { hasOlderData, isLoadingOlderData }
    requestOlderDataRef.current = onRequestOlderData
  }, [hasOlderData, isLoadingOlderData, onRequestOlderData])

  useEffect(() => {
    historyPagingArmedRef.current = false
  }, [fitContentKey])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const initialAppearance = initialAppearanceRef.current
    const chart = createChart(container, lightweightChartOptions(initialAppearance, initialTimeDisplayRef.current, true, initialClock.current))
    fittedKeyRef.current = null
    prevBarsRef.current = []
    requestedLogicalRangeRef.current = null
    const series = chart.addSeries(CandlestickSeries, {
      upColor: initialAppearance.upCandleColor,
      downColor: initialAppearance.downCandleColor,
      borderUpColor: initialAppearance.upCandleColor,
      borderDownColor: initialAppearance.downCandleColor,
      wickUpColor: initialAppearance.upCandleColor,
      wickDownColor: initialAppearance.downCandleColor,
      priceLineColor: initialAppearance.priceLineColor,
    })
    const timeSeries = chart.addSeries(LineSeries, {
      priceScaleId: 'right', lineVisible: false, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false,
    })
    const priceSpace = createChartPriceSpace(chart, series, timeSeries)
    priceSpaceRef.current = priceSpace
    futureTimelineRef.current = createFutureTimeline(timeSeries)

    chartRef.current = chart
    seriesRef.current = priceSpace.overlaySeries
    setChartApi(chart)
    setSeriesApi(priceSpace.overlaySeries)

    const handleLogicalRangeChange = (range: { from: number; to: number } | null) => {
      const requested = requestedLogicalRangeRef.current
      if (requested) {
        // Both edges must settle. Matching only the right edge used to accept
        // native zoom clamping and save its widened left edge as the new target.
        if (!range || Math.abs(range.from - requested.from) > 1e-6 || Math.abs(range.to - requested.to) > 1e-6) return
        requestedLogicalRangeRef.current = null
        return
      }
      if (range && !applyingDataRef.current && historyPagingArmedRef.current) {
        dateWindowRef.current = captureDateWindow(range, prevBarsRef.current, previousStepRef.current)
        pendingWindowRef.current = false
        setMissingViewportHistory(false)
      }
      const history = historyStateRef.current
      if (
        range
        && !applyingDataRef.current
        && range.from < 100
        && historyPagingArmedRef.current
        && history.hasOlderData
        && !history.isLoadingOlderData
      ) {
        requestOlderDataRef.current()
      }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange)

    return () => {
      macroPaneRef.current?.destroy()
      macroPaneRef.current = null
      volumePaneRef.current?.destroy()
      volumePaneRef.current = null
      rsiPaneRef.current?.destroy()
      rsiPaneRef.current = null
      priceSpaceRef.current?.destroy()
      priceSpaceRef.current = null
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange)
      seriesRef.current = null
      futureTimelineRef.current = null
      chartRef.current = null
      requestedLogicalRangeRef.current = null
      setChartApi(null)
      setSeriesApi(null)
      chart.remove()
    }
  }, [])

  useLayoutEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const currentLogicalRange = readLogicalRange()
    const barSpacingChanged = prevBarSpacingRef.current !== appearance.barSpacing
    prevBarSpacingRef.current = appearance.barSpacing

    chart.applyOptions(lightweightChartOptions(appearance, timeDisplay, false, clock))
    if (barSpacingChanged) {
      chart.applyOptions({ timeScale: { barSpacing: appearance.barSpacing } })
      const width = chart.timeScale().width?.() || containerRef.current?.clientWidth || 0
      if (currentLogicalRange && width > 0) {
        // An explicit spacing setting is a new zoom choice. Queue and save it
        // now so a timeframe click before native paint cannot revive old dates.
        const range = { from: currentLogicalRange.to - width / appearance.barSpacing + 1, to: currentLogicalRange.to }
        dateWindowRef.current = captureDateWindow(range, prevBarsRef.current, previousStepRef.current)
        pendingWindowRef.current = Boolean(dateWindowRef.current && prevBarsRef.current.length && dateWindowRef.current.from < prevBarsRef.current[0].time - previousStepRef.current / 2)
        setMissingViewportHistory(pendingWindowRef.current)
        setLogicalRange(range)
      }
    }
    seriesRef.current?.applyOptions({
      upColor: appearance.upCandleColor,
      downColor: appearance.downCandleColor,
      borderUpColor: appearance.upCandleColor,
      borderDownColor: appearance.downCandleColor,
      wickUpColor: appearance.upCandleColor,
      wickDownColor: appearance.downCandleColor,
      priceLineColor: appearance.priceLineColor,
    })

    if (!barSpacingChanged && currentLogicalRange) {
      try {
        setLogicalRange(currentLogicalRange)
      } catch {
        // Ignored if range cannot be set in current state
      }
    }
  }, [appearance, theme, timeDisplay, clock, readLogicalRange, setLogicalRange])

  useLayoutEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return

    series.applyOptions({
      priceFormat: {
        type: 'price',
        precision,
        minMove: 10 ** -precision,
      },
    })

    const previousRange = readLogicalRange()
    priceViewsRef.current?.switchScope(`${clock.brokerId}:${fitContentKey}`, clock.brokerId,
      chart.priceScale('right').getVisibleRange(), chart.priceScale('right').options().autoScale)
    const step = timeframeToSeconds(timeframe)
    const brokerChanged = viewportBrokerRef.current !== clock.brokerId
    if (brokerChanged) {
      liveFollowingRef.current = true
      viewportBrokerRef.current = clock.brokerId
      dateWindowRef.current = null
      pendingWindowRef.current = false
      lastHistoryAttemptRef.current = null
      fittedKeyRef.current = null
      setMissingViewportHistory(false)
    } else if (!dateWindowRef.current && prevBarsRef.current.length) {
      // Capture the initial view once. Only user navigation or live following
      // can replace it; a higher timeframe's minimum zoom is not a new choice.
      dateWindowRef.current = captureDateWindow(previousRange, prevBarsRef.current, previousStepRef.current) ?? dateWindowRef.current
    }
    const prevBars = prevBarsRef.current
    const isNewKey = fittedKeyRef.current !== fitContentKey
    // Ignore programmatic range notifications during replacement/restoration.
    applyingDataRef.current = true
    try {
      if (!bars.length) {
        priceSpaceRef.current?.sync(bars, true, precision)
        volumePaneRef.current?.clearData()
        rsiPaneRef.current?.clearData()
        macroPaneRef.current?.clearData()
        series.setData([])
        futureTimelineRef.current?.clear()
        prevBarsRef.current = []
        fittedKeyRef.current = null
        return
      }
      let replaced = false
      if (isNewKey) {
        macroPaneRef.current?.clearData()
        volumePaneRef.current?.clearData()
        rsiPaneRef.current?.clearData()
        replaced = true
        lastHistoryAttemptRef.current = null
        series.setData(bars)
        chart.priceScale('right').applyOptions({ autoScale: true })
        onDataApplied(bars.length)
      } else if (prevBars.length && bars[0]?.time === prevBars[0]?.time &&
        (bars.length === prevBars.length || bars.length === prevBars.length + 1) &&
        (changedRecentBarStart(bars, prevBars) ?? -1) >= bars.length - 1) {
        series.update(bars[bars.length - 1])
      } else {
        replaced = true
        series.setData(bars)
      }
      priceSpaceRef.current?.sync(bars, isNewKey, precision)
      const futureReplaced = futureTimelineRef.current?.sync(bars, step, isNewKey, replaced)
      if (isNewKey) {
        const savedPriceRange = priceViewsRef.current?.restore(bars.at(-1)!.close, precision)
        if (savedPriceRange) chart.priceScale('right').setVisibleRange(savedPriceRange)
      }
      priceViewsRef.current?.updateReference(bars.at(-1)!.close)
      // Start at recent candles using the configured pixel spacing. Fitting all
      // loaded history shrinks candles after a browser refresh; the hidden future
      // horizon must never determine the startup viewport either.
      if (isNewKey && !dateWindowRef.current) {
        const width = chart.timeScale().width?.() || containerRef.current?.clientWidth || 0
        const span = width > 0 ? width / prevBarSpacingRef.current : Math.min(120, bars.length + 7)
        const to = bars.length - 1 + 8
        setLogicalRange({ from: Math.max(0, to - span), to })
      }
      fittedKeyRef.current = fitContentKey
      prevBarsRef.current = bars
      previousStepRef.current = step
      const window = dateWindowRef.current
      if (window && (replaced || futureReplaced || pendingWindowRef.current)) {
        const range = projectDateWindow(window, bars, step)
        if (range) setLogicalRange(range)
        pendingWindowRef.current = (dateWindowRef.current ?? window).from < bars[0].time - step / 2
        setMissingViewportHistory(pendingWindowRef.current)
      }
      // The hidden horizon is now the library's last point. Retain normal live
      // following when an incrementally appended price candle was in view.
      if (liveFollowingRef.current && !isNewKey && !replaced && bars.length === prevBars.length + 1 && previousRange &&
        previousRange.from <= prevBars.length - 1 && previousRange.to >= prevBars.length - 1) {
        const followingRange = { from: previousRange.from + 1, to: previousRange.to + 1 }
        dateWindowRef.current = window ? advanceDateWindow(window, prevBars, bars, step) : captureDateWindow(followingRange, bars, step)
        setLogicalRange(followingRange)
      }
    } finally { applyingDataRef.current = false }
  }, [bars, fitContentKey, onDataApplied, precision, timeframe, clock.brokerId, readLogicalRange, setLogicalRange])

  // Apply indicator data after price data/viewport restoration. Scope changes
  // clear the old indicator above before replacing candles to avoid mixing two
  // symbol/timeframe timelines during restoration.
  useLayoutEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (!rsi?.enabled && !rsiPaneRef.current) return
    const changingPane = Boolean(rsi?.enabled) !== Boolean(rsiPaneRef.current)
    const range = changingPane || requestedLogicalRangeRef.current ? readLogicalRange() : null
    applyingDataRef.current = true
    try {
      if (!rsi?.enabled) {
        rsiPaneRef.current?.destroy()
        rsiPaneRef.current = null
      } else {
        rsiPaneRef.current ??= createRsiPane(chart)
        rsiPaneRef.current.sync(bars, `${clock.brokerId}:${fitContentKey}`, rsi, futureTimelineRef.current?.endTime())
      }
      if (range) setLogicalRange(range)
    } finally { applyingDataRef.current = false }
  }, [rsi, bars, fitContentKey, clock.brokerId, readLogicalRange, setLogicalRange])

  useLayoutEffect(() => {
    const chart = chartRef.current
    if (!chart || (!volume?.enabled && !volumePaneRef.current)) return
    const range = readLogicalRange()
    applyingDataRef.current = true
    try {
      if (!volume?.enabled) {
        volumePaneRef.current?.destroy(); volumePaneRef.current = null
      } else {
        volumePaneRef.current ??= createVolumePane(chart)
        volumePaneRef.current.sync(bars, `${clock.brokerId}:${fitContentKey}`, volume, clock, timeframeToSeconds(timeframe), {
          changeAxis: target => onChangeVolumeAxis?.(target),
          toggleLayer: layer => onToggleVolumeLayer?.(layer),
        })
      }
      if (range) setLogicalRange(range)
    } finally { applyingDataRef.current = false }
  }, [volume, bars, fitContentKey, clock, timeframe, onChangeVolumeAxis, onToggleVolumeLayer, readLogicalRange, setLogicalRange])

  useLayoutEffect(() => {
    const chart = chartRef.current
    if (!chart || (!macroEnabled && !macroPaneRef.current)) return
    const range = readLogicalRange()
    applyingDataRef.current = true
    try {
      if (!macroEnabled || !macro) {
        macroPaneRef.current?.destroy(); macroPaneRef.current = null
      } else {
        macroPaneRef.current ??= createMacroPane(chart)
        macroPaneRef.current.sync(bars, macro, timeframeToSeconds(timeframe), formatUtc, {
          toggleMetric: metric => onToggleMacroMetric?.(metric),
          toggleForecast: metric => onToggleMacroForecast?.(metric),
          toggleNumbers: metric => onToggleMacroNumbers?.(metric),
          changePreferences: onChangeMacroPreferences,
          selectMetric: metric => onSelectMacroMetric?.(metric),
          inspectRelease: onInspectMacroRelease,
        })
      }
      if (range) setLogicalRange(range)
    } finally { applyingDataRef.current = false }
  }, [macroEnabled, macro, bars, fitContentKey, timeframe, formatUtc, onToggleMacroMetric, onToggleMacroForecast, onToggleMacroNumbers, onChangeMacroPreferences, onSelectMacroMetric, onInspectMacroRelease, readLogicalRange, setLogicalRange])

  useEffect(() => {
    if (!pendingWindowRef.current || !bars.length || !hasOlderData || isLoadingOlderData) return
    const attempt = `${fitContentKey}:${bars[0].time}`
    // No-progress/failed replies must not create an automatic retry loop.
    if (lastHistoryAttemptRef.current === attempt) return
    lastHistoryAttemptRef.current = attempt
    onRequestOlderData()
  }, [bars, fitContentKey, hasOlderData, isLoadingOlderData, onRequestOlderData])

  useEffect(() => {
    if (!bars.length) { tracedScopeRef.current = null; return }
    const scope = `${clock.brokerId}:${fitContentKey}`
    if (!onChartTrace || tracedScopeRef.current === scope) return
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        const chart = chartRef.current, series = seriesRef.current
        if (!chart || !series) return
        tracedScopeRef.current = scope
        onChartTrace(chartDataTrace(chart, series, bars, scope))
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [bars, fitContentKey, clock.brokerId, onChartTrace])

  const isPanningRef = useRef(false)
  const lastClientYRef = useRef<number | null>(null)
  const stopPanRef = useRef<(() => void) | null>(null)
  useEffect(() => () => { stopPanRef.current?.() }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 0) liveFollowingRef.current = false
    requestedLogicalRangeRef.current = null
    historyPagingArmedRef.current = true
    if (event.button !== 0 || activeDrawingTool) return

    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const leftWidth = chartRef.current?.options().leftPriceScale.visible ? chartRef.current.priceScale('left').width() : 0
    if (event.clientX < rect.left + leftWidth) return
    const paneHeight = (rsi?.enabled || volume?.enabled || macroEnabled) ? chartRef.current?.paneSize(0).height : undefined
    if (paneHeight !== undefined && event.clientY - rect.top >= paneHeight) return
    // Do not intercept if clicking on the right price scale area
    if (event.clientX > rect.right - 55) return

    stopPanRef.current?.()
    isPanningRef.current = true
    lastClientYRef.current = event.clientY

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isPanningRef.current || lastClientYRef.current === null) return
      const deltaY = moveEvent.clientY - lastClientYRef.current
      if (Math.abs(deltaY) < 1) return

      const chart = chartRef.current
      const series = seriesRef.current
      if (!chart || !series) return

      const paneTop = container.getBoundingClientRect().top
      const p1 = series.coordinateToPrice(lastClientYRef.current - paneTop)
      const p2 = series.coordinateToPrice(moveEvent.clientY - paneTop)
      if (p1 !== null && p2 !== null) {
        const deltaPrice = p1 - p2
        const currentRange = chart.priceScale('right').getVisibleRange()
        if (currentRange) {
          chart.priceScale('right').applyOptions({ autoScale: false })
          chart.priceScale('right').setVisibleRange({
            from: currentRange.from + deltaPrice,
            to: currentRange.to + deltaPrice,
          })
        }
      }
      lastClientYRef.current = moveEvent.clientY
    }

    const onPointerUp = () => {
      isPanningRef.current = false
      lastClientYRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      stopPanRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    stopPanRef.current = onPointerUp
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const paneHeight = (rsi?.enabled || volume?.enabled || macroEnabled) ? chartRef.current?.paneSize(0).height : undefined
    const top = containerRef.current?.getBoundingClientRect().top ?? 0
    if (paneHeight !== undefined && event.clientY - top >= paneHeight) return
    pendingWindowRef.current = false
    dateWindowRef.current = null
    setMissingViewportHistory(false)
    chartRef.current?.priceScale('right').applyOptions({ autoScale: true })
    if (bars.length) setLogicalRange({ from: 0, to: bars.length - 1 + 8 })
  }

  useLayoutEffect(() => {
    if (lastRefocusRequest.current === refocusRequest) return
    lastRefocusRequest.current = refocusRequest
    const chart = chartRef.current
    if (!chart || !bars.length) return
    stopPanRef.current?.()
    const range = readLogicalRange()
    const span = range ? range.to - range.from : bars.length + 7
    const to = bars.length - 1 + 8
    applyingDataRef.current = true
    try {
      pendingWindowRef.current = false; dateWindowRef.current = null
      historyPagingArmedRef.current = false
      liveFollowingRef.current = true
      setMissingViewportHistory(false)
      chart.priceScale('right').applyOptions({ autoScale: true })
      setLogicalRange({ from: to - span, to })
    } finally { applyingDataRef.current = false }
  }, [refocusRequest, bars.length, readLogicalRange, setLogicalRange])

  return (
    <div className="market-chart-host" onPointerDownCapture={(event) => {
      const target = event.target as Element
      if (event.button === 0 && selectedDrawingId && !target.closest('.drawing-object, .drawing-text-foreign-object, .trade-level-handle, .trade-arrow-handle, .price-alert-handle, [data-ledger-picking="true"]')) {
        onSelectDrawing(null)
      }
    }}>
      <div
        ref={containerRef}
        className="market-chart-canvas"
        aria-label="Candlestick chart"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onWheel={() => { requestedLogicalRangeRef.current = null; historyPagingArmedRef.current = true; liveFollowingRef.current = false }}
      />
      {missingViewportHistory && bars.length > 0 && !isLoadingOlderData && <div className="chart-viewport-notice" role="status">
        <span>{hasOlderData ? 'Older history could not reach the selected dates.' : 'MT5 history does not cover the selected dates.'}</span>
        {hasOlderData && <button type="button" onClick={onRequestOlderData}>Retry history</button>}
      </div>}
      {chartApi && seriesApi && <PricePaneOverlays chartApi={chartApi} seriesApi={seriesApi} constrained={Boolean(rsi?.enabled || volume?.enabled || macroEnabled)}>
      {renderChartOverlay?.(chartApi, seriesApi)}
      {chartApi && seriesApi && (activeDrawingTool || drawings.length > 0) && (
        <ChartDrawingOverlay
          key={fitContentKey}
          chartApi={chartApi}
          seriesApi={seriesApi}
          activeTool={activeDrawingTool}
          drawings={drawings}
          bars={bars}
          selectedDrawingId={selectedDrawingId}
          timeframe={timeframe}
          symbol={symbol}
          precision={precision}
          onSelectDrawing={onSelectDrawing}
          onCreateDrawing={onCreateDrawing}
          onUpdateDrawingPoint={onUpdateDrawingPoint}
          onUpdateDrawingPoints={onUpdateDrawingPoints}
          onUpdatePositionWidth={onUpdatePositionWidth}
          onUpdateDrawingText={onUpdateDrawingText}
          onDeleteSelectedDrawing={onDeleteSelectedDrawing}
          onDeleteDrawing={onDeleteDrawing}
          onExitDrawingMode={onExitDrawingMode}
        />
      )}
      </PricePaneOverlays>}
    </div>
  )
}

export const MarketCandlestickChart = memo(MarketCandlestickChartComponent)
