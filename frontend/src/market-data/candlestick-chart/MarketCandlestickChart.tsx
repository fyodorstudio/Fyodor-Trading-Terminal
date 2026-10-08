import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import {
  CandlestickSeries,
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
import { lightweightChartOptions } from './lightweight-chart-options'
import './market-candlestick-chart.css'

type MarketCandlestickChartProps = {
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
  const [chartApi, setChartApi] = useState<IChartApi | null>(null)
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<'Candlestick', Time> | null>(null)
  const fittedKeyRef = useRef<string | null>(null)
  const prevBarsRef = useRef<OhlcBar[]>([])
  const historyPagingArmedRef = useRef(false)
  const historyStateRef = useRef({ hasOlderData, isLoadingOlderData })
  const requestOlderDataRef = useRef(onRequestOlderData)
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
    const series = chart.addSeries(CandlestickSeries, {
      upColor: initialAppearance.upCandleColor,
      downColor: initialAppearance.downCandleColor,
      borderUpColor: initialAppearance.upCandleColor,
      borderDownColor: initialAppearance.downCandleColor,
      wickUpColor: initialAppearance.upCandleColor,
      wickDownColor: initialAppearance.downCandleColor,
      priceLineColor: initialAppearance.priceLineColor,
    })

    chartRef.current = chart
    seriesRef.current = series
    setChartApi(chart)
    setSeriesApi(series)

    const handleLogicalRangeChange = (range: { from: number; to: number } | null) => {
      const history = historyStateRef.current
      if (
        range
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

    if (bars.length === 0) {
      series.setData([])
      prevBarsRef.current = []
      fittedKeyRef.current = null
      return
    }

    const prevBars = prevBarsRef.current
    const isNewKey = fittedKeyRef.current !== fitContentKey

    if (isNewKey) {
      series.setData(bars)
      chart.priceScale('right').applyOptions({ autoScale: true })
      chart.timeScale().fitContent()

      fittedKeyRef.current = fitContentKey
      prevBarsRef.current = bars
      onDataApplied(bars.length)
      return
    }

    // Check if older history was prepended (history demand-paging)
    if (prevBars.length > 0 && bars.length > prevBars.length) {
      const prependedCount = bars.length - prevBars.length
      if (bars[prependedCount]?.time === prevBars[0]?.time) {
        const prevLogical = chart.timeScale().getVisibleLogicalRange()
        series.setData(bars)
        if (prevLogical) {
          try {
            chart.timeScale().setVisibleLogicalRange({
              from: prevLogical.from + prependedCount,
              to: prevLogical.to + prependedCount,
            })
          } catch {
            // Best effort logical range restoration
          }
        }
        prevBarsRef.current = bars
        return
      }
    }

    // Check if single bar was appended or latest live bar was updated
    if (
      prevBars.length > 0 &&
      bars[0]?.time === prevBars[0]?.time &&
      (bars.length === prevBars.length || bars.length === prevBars.length + 1)
    ) {
      const latestBar = bars[bars.length - 1]
      series.update(latestBar)
      prevBarsRef.current = bars
      return
    }

    // Otherwise, full dataset update with safe range preservation
    const preserveRange = chart.timeScale().getVisibleRange()
    series.setData(bars)
    if (preserveRange && preserveRange.from !== null && preserveRange.to !== null) {
      try {
        chart.timeScale().setVisibleRange(preserveRange)
      } catch {
        // Safe fallback
      }
    }
    prevBarsRef.current = bars
  }, [bars, fitContentKey, onDataApplied, precision])

  const isPanningRef = useRef(false)
  const lastClientYRef = useRef<number | null>(null)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    historyPagingArmedRef.current = true
    if (event.button !== 0 || activeDrawingTool) return

    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    // Do not intercept if clicking on the right price scale area
    if (event.clientX > rect.right - 55) return

    isPanningRef.current = true
    lastClientYRef.current = event.clientY

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isPanningRef.current || lastClientYRef.current === null) return
      const deltaY = moveEvent.clientY - lastClientYRef.current
      if (Math.abs(deltaY) < 1) return

      const chart = chartRef.current
      const series = seriesRef.current
      if (!chart || !series) return

      const p1 = series.coordinateToPrice(lastClientYRef.current)
      const p2 = series.coordinateToPrice(moveEvent.clientY)
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
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  const handleDoubleClick = () => {
    chartRef.current?.priceScale('right').applyOptions({ autoScale: true })
    chartRef.current?.timeScale().fitContent()
  }

  return (
    <div className="market-chart-host">
      <div
        ref={containerRef}
        className="market-chart-canvas"
        aria-label="Candlestick chart"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onWheel={() => { historyPagingArmedRef.current = true }}
      />
      {chartApi && seriesApi && renderChartOverlay?.(chartApi, seriesApi)}
      {chartApi && seriesApi && (activeDrawingTool || drawings.length > 0) && (
        <ChartDrawingOverlay
          key={activeDrawingTool ?? 'chart-navigation'}
          chartApi={chartApi}
          seriesApi={seriesApi}
          activeTool={activeDrawingTool}
          drawings={drawings}
          selectedDrawingId={selectedDrawingId}
          timeframe={timeframe}
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
