import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { captureDateWindow, projectDateWindow, type ChartDateWindow } from './chart-viewport'
import { createFutureTimeline } from './future-timeline'
import { timeframeToSeconds } from '../chart-drawings/position-drawing-geometry'
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
  hasOlderData,
  isLoadingOlderData,
  onRequestOlderData,
  renderChartOverlay,
}: MarketCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scope: clock } = useDisplayClock()
  const initialClock = useRef(clock)
  const initialAppearanceRef = useRef(appearance)
  const initialTimeDisplayRef = useRef(timeDisplay)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null)
  const futureTimelineRef = useRef<ReturnType<typeof createFutureTimeline> | null>(null)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null)
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<'Candlestick', Time> | null>(null)
  const fittedKeyRef = useRef<string | null>(null)
  const prevBarsRef = useRef<OhlcBar[]>([])
  const historyPagingArmedRef = useRef(false)
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

  useEffect(() => {
    historyStateRef.current = { hasOlderData, isLoadingOlderData }
    requestOlderDataRef.current = onRequestOlderData
  }, [hasOlderData, isLoadingOlderData, onRequestOlderData])

  useEffect(() => {
    historyPagingArmedRef.current = false
  }, [fitContentKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const initialAppearance = initialAppearanceRef.current
    const chart = createChart(container, lightweightChartOptions(initialAppearance, initialTimeDisplayRef.current, true, initialClock.current))
    fittedKeyRef.current = null
    prevBarsRef.current = []
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
      priceScaleId: '', visible: false, lineVisible: false, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false,
    })
    futureTimelineRef.current = createFutureTimeline(timeSeries)

    chartRef.current = chart
    seriesRef.current = series
    setChartApi(chart)
    setSeriesApi(series)

    const handleLogicalRangeChange = (range: { from: number; to: number } | null) => {
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
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange)
      seriesRef.current = null
      futureTimelineRef.current = null
      chartRef.current = null
      setChartApi(null)
      setSeriesApi(null)
      chart.remove()
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const currentLogicalRange = chart.timeScale().getVisibleLogicalRange()
    const barSpacingChanged = prevBarSpacingRef.current !== appearance.barSpacing
    prevBarSpacingRef.current = appearance.barSpacing

    chart.applyOptions(lightweightChartOptions(appearance, timeDisplay, false, clock))
    if (barSpacingChanged) {
      chart.applyOptions({ timeScale: { barSpacing: appearance.barSpacing } })
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
        chart.timeScale().setVisibleLogicalRange(currentLogicalRange)
      } catch {
        // Ignored if range cannot be set in current state
      }
    }
  }, [appearance, theme, timeDisplay, clock])

  useEffect(() => {
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

    const previousRange = chart.timeScale().getVisibleLogicalRange()
    const brokerChanged = viewportBrokerRef.current !== clock.brokerId
    if (brokerChanged) {
      viewportBrokerRef.current = clock.brokerId
      dateWindowRef.current = null
      pendingWindowRef.current = false
      lastHistoryAttemptRef.current = null
      fittedKeyRef.current = null
      setMissingViewportHistory(false)
    } else if (!pendingWindowRef.current && prevBarsRef.current.length) {
      dateWindowRef.current = captureDateWindow(previousRange, prevBarsRef.current, previousStepRef.current) ?? dateWindowRef.current
    }
    const step = timeframeToSeconds(timeframe)
    const prevBars = prevBarsRef.current
    const isNewKey = fittedKeyRef.current !== fitContentKey
    // Ignore programmatic range notifications during replacement/restoration.
    applyingDataRef.current = true
    try {
      if (!bars.length) {
        series.setData([])
        futureTimelineRef.current?.clear()
        prevBarsRef.current = []
        fittedKeyRef.current = null
        return
      }
      let replaced = false
      if (isNewKey) {
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
      const futureReplaced = futureTimelineRef.current?.sync(bars, step, isNewKey, replaced)
      // Native fitContent includes whitespace. Fit actual candles explicitly.
      if (isNewKey && !dateWindowRef.current) chart.timeScale().setVisibleLogicalRange({ from: 0, to: bars.length - 1 + 8 })
      fittedKeyRef.current = fitContentKey
      prevBarsRef.current = bars
      previousStepRef.current = step
      const window = dateWindowRef.current
      if (window && (replaced || futureReplaced || pendingWindowRef.current)) {
        const range = projectDateWindow(window, bars, step)
        if (range) chart.timeScale().setVisibleLogicalRange(range)
        pendingWindowRef.current = window.from < bars[0].time
        setMissingViewportHistory(pendingWindowRef.current)
      }
      // The hidden horizon is now the library's last point. Retain normal live
      // following when an incrementally appended price candle was in view.
      if (!isNewKey && !replaced && bars.length === prevBars.length + 1 && previousRange &&
        previousRange.from <= prevBars.length - 1 && previousRange.to >= prevBars.length - 1) {
        chart.timeScale().setVisibleLogicalRange({ from: previousRange.from + 1, to: previousRange.to + 1 })
      }
    } finally { applyingDataRef.current = false }
  }, [bars, fitContentKey, onDataApplied, precision, timeframe, clock.brokerId])

  useEffect(() => {
    if (!pendingWindowRef.current || !bars.length || !hasOlderData || isLoadingOlderData) return
    const attempt = `${fitContentKey}:${bars[0].time}`
    // No-progress/failed replies must not create an automatic retry loop.
    if (lastHistoryAttemptRef.current === attempt) return
    lastHistoryAttemptRef.current = attempt
    onRequestOlderData()
  }, [bars, fitContentKey, hasOlderData, isLoadingOlderData, onRequestOlderData])

  const isPanningRef = useRef(false)
  const lastClientYRef = useRef<number | null>(null)
  const stopPanRef = useRef<(() => void) | null>(null)
  useEffect(() => () => { stopPanRef.current?.() }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    historyPagingArmedRef.current = true
    if (event.button !== 0 || activeDrawingTool) return

    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
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

  const handleDoubleClick = () => {
    pendingWindowRef.current = false
    dateWindowRef.current = null
    setMissingViewportHistory(false)
    chartRef.current?.priceScale('right').applyOptions({ autoScale: true })
    if (bars.length) chartRef.current?.timeScale().setVisibleLogicalRange({ from: 0, to: bars.length - 1 + 8 })
  }

  return (
    <div className="market-chart-host" onPointerDownCapture={(event) => {
      const target = event.target as Element
      if (event.button === 0 && selectedDrawingId && !target.closest('.drawing-object, .drawing-text-foreign-object, .trade-level-handle, .trade-arrow-handle, .price-alert-handle')) {
        onSelectDrawing(null)
      }
    }}>
      <div
        ref={containerRef}
        className="market-chart-canvas"
        aria-label="Candlestick chart"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onWheel={() => { historyPagingArmedRef.current = true }}
      />
      {missingViewportHistory && bars.length > 0 && !isLoadingOlderData && <div className="chart-viewport-notice" role="status">
        <span>{hasOlderData ? 'Older history could not reach the selected dates.' : 'MT5 history does not cover the selected dates.'}</span>
        {hasOlderData && <button type="button" onClick={onRequestOlderData}>Retry history</button>}
      </div>}
      {chartApi && seriesApi && renderChartOverlay?.(chartApi, seriesApi)}
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
    </div>
  )
}

export const MarketCandlestickChart = memo(MarketCandlestickChartComponent)
