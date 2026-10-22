import { useCallback, useEffect, useState } from 'react'
import { applyColorTheme, readColorTheme, type ColorTheme } from '../../appearance/color-theme/color-theme-preference'
import { readTimeDisplayPreference, saveTimeDisplayPreference, timeDisplayLabel, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { useInspector } from '../../inspector'
import { readDrawingToolbarVisible, saveDrawingToolbarVisible } from '../../market-data/chart-drawings/drawing-toolbar-visibility'
import type { ChartDrawingPoint } from '../../market-data/chart-drawings/chart-drawing-record'
import type { DrawingToolId } from '../../market-data/chart-drawings/drawing-tool'
import { useChartDrawings } from '../../market-data/chart-drawings/use-chart-drawings'
import { readChartAppearance, saveChartAppearance, type ChartAppearance } from '../../market-data/chart-settings/chart-appearance-preference'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import { useMt5MarketData } from '../../market-data/mt5-feed/use-mt5-market-data'
import { useBridgeConnection } from '../../system-connectivity/bridge-status/bridge-status-context'
import { useActivityActions } from '../../system-observability/activity-log/use-activity-log'
import { useTerminalChartOverlay } from '../chart-overlays/useTerminalChartOverlay'
import type { BottomDockWindow } from '../../workspace-docking/bottom-dock/bottom-dock-window'
import { useBottomDockSize } from '../../workspace-docking/bottom-dock/useBottomDockSize'
import { useMarketWatchDock } from '../../workspace-docking/left-dock/useMarketWatchDock'
import { researchRangeDates, type ResearchSeed } from '../../research/research-request'
import { forexPair } from '../../economic-calendar/forex/pairs'
import { getPipMultiplier, type PlannedTradeState, type RegisteredTradeArrow, type TradePriceField } from '../../entry-trade/contracts/entry-trade-types'
import { tradeMetrics } from '../../entry-trade/dock/plan-math'
import { useRegisteredArrows } from '../../entry-trade/storage/use-registered-arrows'

const emptyTradePlan: PlannedTradeState = { direction: 'waiting', entryPrice: null, tpPrice: null, slPrice: null, showOnChart: false }

export function useTerminalWorkspace() {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('H1')
  const [theme, setTheme] = useState<ColorTheme>(readColorTheme)
  const [chartAppearance, setChartAppearance] = useState<ChartAppearance>(readChartAppearance)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplayPreference>(readTimeDisplayPreference)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolId | null>(null)
  const [researchActive, setResearchActive] = useState(false)
  const [researchSeed, setResearchSeed] = useState<ResearchSeed | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [drawingToolbarVisible, setDrawingToolbarVisible] = useState<boolean>(readDrawingToolbarVisible)
  const [bottomDockWindow, setBottomDockWindow] = useState<BottomDockWindow | null>(() => new URLSearchParams(window.location.search).get('events') === 'alarms' ? 'alert' : null)
  const [selectedExternalKey, setSelectedExternalKey] = useState<string | null>(null)
  const [externalSelection, setExternalSelection] = useState(0)
  const dockSize = useBottomDockSize(bottomDockWindow)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const marketWatch = useMarketWatchDock()
  const { appendActivity } = useActivityActions()

  useEffect(() => {
    applyColorTheme(theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-scrollbar', chartAppearance.scrollbarStyle ?? 'adaptive')
  }, [chartAppearance.scrollbarStyle])

  const bridge = useBridgeConnection()
  const mt5Connected = bridge.connected
  const marketData = useMt5MarketData(mt5Connected, bridge.generation, selectedSymbol, timeframe)
  const activeSymbol = marketData.activeSymbol
  const bars = marketData.bars
  const brokerId = bridge.brokerId
  const researchContextKey = `${brokerId}:${timeDisplay.mode}:${timeDisplay.utcOffsetMinutes}`
  const [savedResearchContext, setSavedResearchContext] = useState(researchContextKey)
  if (savedResearchContext !== researchContextKey) {
    setSavedResearchContext(researchContextKey)
    setResearchActive(false); setResearchSeed(null); setResearchError(null)
  }
  const inspector = useInspector({ symbol: activeSymbol, bars, timeframe, timeDisplay,
    clockOffsetMs: 0, brokerId,
    brokerOffsetSeconds: bridge.brokerOffsetSeconds })
  const quote = marketData.symbols.find((item) => item.symbol === activeSymbol) ?? null
  const latestBarTime = bars.at(-1)?.time ?? 0
  const registeredArrows = useRegisteredArrows(activeSymbol, bottomDockWindow === 'entry-trade')
  const [tradePlans, setTradePlans] = useState<Record<string, PlannedTradeState>>({})
  const plannedTrade = tradePlans[activeSymbol] ?? emptyTradePlan
  const handlePlanChange = useCallback((plan: PlannedTradeState) => {
    setTradePlans(current => ({ ...current, [activeSymbol]: plan }))
  }, [activeSymbol])
  const {
    drawings,
    pairDrawingCount,
    addDrawing,
    updateDrawingPoint,
    updateDrawingPoints,
    updateDrawingText,
    updatePositionWidth,
    deleteDrawing,
    clearPairDrawings,
  } = useChartDrawings(activeSymbol, timeframe)

  const handleDeleteDrawing = useCallback((drawingId: string) => {
    deleteDrawing(drawingId)
    if (selectedDrawingId === drawingId) setSelectedDrawingId(null)
    appendActivity('Drawing', 'Drawing deleted', `${activeSymbol} ${timeframe}`)
  }, [activeSymbol, appendActivity, deleteDrawing, selectedDrawingId, timeframe])

  const selectSymbol = useCallback((symbol: string) => {
    if (symbol === selectedSymbol) return
    setSelectedSymbol(symbol)
    setResearchActive(false); setResearchError(null)
    setSelectedDrawingId(null)
    appendActivity('Market Watch', 'Symbol selected', symbol)
  }, [selectedSymbol, appendActivity])

  const selectTimeframe = useCallback((nextTimeframe: ChartTimeframe) => {
    if (nextTimeframe === timeframe) return
    setTimeframe(nextTimeframe)
    setResearchActive(false); setResearchError(null)
    setSelectedDrawingId(null)
    appendActivity('Chart', 'Timeframe selected', `${activeSymbol} ${nextTimeframe}`)
  }, [timeframe, activeSymbol, appendActivity])

  const recordChartData = useCallback(
    (barCount: number) => appendActivity('Chart', 'Candle data applied', `${activeSymbol} ${timeframe} · ${barCount} bars`),
    [activeSymbol, appendActivity, timeframe],
  )

  const changeTheme = (nextTheme: ColorTheme) => {
    setTheme(nextTheme)
    appendActivity('Appearance', 'Theme changed', nextTheme === 'light' ? 'Light' : 'Dark')
  }

  const changeChartAppearance = (nextAppearance: ChartAppearance) => {
    setChartAppearance(nextAppearance)
    saveChartAppearance(nextAppearance)
  }

  const changeTimeDisplay = (nextPreference: TimeDisplayPreference) => {
    setTimeDisplay(nextPreference)
    saveTimeDisplayPreference(nextPreference)
    appendActivity('Appearance', 'Time display changed', timeDisplayLabel(nextPreference))
  }

  const createDrawing = useCallback(
    (tool: DrawingToolId, points: ChartDrawingPoint[]) => {
      const drawingId = addDrawing(tool, points)
      appendActivity('Drawing', 'Drawing created', `${activeSymbol} ${timeframe} · ${tool}`)
      return drawingId
    },
    [activeSymbol, addDrawing, appendActivity, timeframe],
  )

  const chooseDrawingTool = (tool: DrawingToolId | null) => {
    setResearchActive(false)
    setActiveDrawingTool(tool)
    setSelectedDrawingId(null)
  }

  const selectCrosshair = () => {
    setResearchActive(false)
    setActiveDrawingTool(null)
    setSelectedDrawingId(null)
  }

  const deletePairDrawings = () => {
    clearPairDrawings()
    setSelectedDrawingId(null)
    appendActivity('Drawing', 'Pair drawings deleted', `${activeSymbol} · ${pairDrawingCount} removed across all timeframes`)
  }

  const selectBottomDock = useCallback((dock: BottomDockWindow | null) => setBottomDockWindow(dock), [])
  const toggleBottomDock = (dock: BottomDockWindow) => setBottomDockWindow(current => current === dock ? null : dock)
  const exitDrawingMode = useCallback(() => setActiveDrawingTool(null), [])
  const toggleDrawingToolbar = useCallback(() => {
    setDrawingToolbarVisible((current) => {
      const next = !current
      saveDrawingToolbarVisible(next)
      appendActivity('Drawing', next ? 'Drawing toolbar shown' : 'Drawing toolbar hidden')
      return next
    })
    setActiveDrawingTool(null)
    setResearchActive(false)
  }, [appendActivity])
  const cancelResearch = useCallback(() => setResearchActive(false), [])
  const closeResearch = useCallback(() => { setResearchSeed(null); setResearchError(null) }, [])
  const selectResearchTool = () => {
    setActiveDrawingTool(null); setSelectedDrawingId(null); setResearchError(null)
    setResearchActive(current => !current)
  }
  const selectResearchRange = useCallback((from: number, to: number) => {
    const dates = researchRangeDates(from, to, { brokerId, brokerOffsetSeconds: bridge.brokerOffsetSeconds }, timeDisplay)
    setResearchActive(false)
    if (!dates) { setResearchError('These chart dates have no verified time. Select another range.'); return }
    const pair = forexPair(activeSymbol)
    if (pair) setResearchSeed({ scope: pair, kind: 'historical', ...dates })
  }, [activeSymbol, brokerId, bridge.brokerOffsetSeconds, timeDisplay])
  const setReleaseSelection = inspector.selectRelease
  const setArrowSelection = registeredArrows.setSelectedArrowId
  const selectPinnedArrow = useCallback((id: string | null) => {
    const arrow = registeredArrows.allArrows.find(item => item.id === id)
    if (arrow && arrow.symbol !== activeSymbol) selectSymbol(arrow.symbol)
    setArrowSelection(id)
  }, [registeredArrows.allArrows, activeSymbol, selectSymbol, setArrowSelection])
  const updateArrow = registeredArrows.updateArrow
  const changeTradePrice = useCallback((field: TradePriceField, price: number) => {
    if (!Number.isFinite(price) || price <= 0) return
    const arrow = registeredArrows.selectedArrow
    if (arrow) {
      const changed = { ...arrow, [field]: price }
      const metrics = tradeMetrics(changed, getPipMultiplier(arrow.symbol, arrow.precision ?? quote?.precision ?? 5))
      updateArrow(arrow.id, { [field]: price, tpPips: metrics.tpPips, slPips: metrics.slPips, rrRatio: metrics.rrRatio })
    } else handlePlanChange({ ...plannedTrade, [field]: price, targetRr: null })
  }, [registeredArrows.selectedArrow, updateArrow, quote?.precision, handlePlanChange, plannedTrade])
  const selectChartArrow = useCallback((arrow: RegisteredTradeArrow) => {
    setArrowSelection(arrow.id); selectBottomDock('entry-trade')
  }, [setArrowSelection, selectBottomDock])
  const changeTradeTime = useCallback((id: string, time: number) => {
    const arrow = registeredArrows.symbolArrows.find(item => item.id === id)
    if (!arrow || !Number.isFinite(time) || time <= 0) return
    if (time !== arrow.time) updateArrow(id, { time })
    setArrowSelection(id); selectBottomDock('entry-trade')
  }, [registeredArrows.symbolArrows, updateArrow, setArrowSelection, selectBottomDock])
  const selectExternal = useCallback((key: string | null) => {
    setSelectedExternalKey(key); setExternalSelection(value => value + 1); selectBottomDock('external-sources')
  }, [selectBottomDock])
  const selectChartRelease = useCallback((id: string) => {
    setReleaseSelection(id); selectBottomDock('inspector')
  }, [setReleaseSelection, selectBottomDock])
  const clearChartInspection = useCallback(() => {
    setReleaseSelection(null)
    setBottomDockWindow(current => current === 'inspector' ? null : current)
  }, [setReleaseSelection])
  const renderChartOverlay = useTerminalChartOverlay({ supported: inspector.supported, markers: inspector.markers,
    arrows: registeredArrows.symbolArrows, selectedArrowId: registeredArrows.selectedArrowId,
    draftPlan: plannedTrade, onSelectArrow: selectChartArrow,
    onPriceChange: changeTradePrice, precision: quote?.precision ?? 5, dragEnabled: !activeDrawingTool && !researchActive,
    onTimeChange: changeTradeTime,
    scopeKey: `${activeSymbol}:${timeframe}:${brokerId}`,
    currencyColors: inspector.preferences.currencyColors, timeDisplay, onSelectRelease: selectChartRelease,
    onClearInspection: !activeDrawingTool && !researchActive && !researchSeed && inspector.selectedRelease ? clearChartInspection : undefined,
    researchActive, bars, timeframe, onResearchRange: selectResearchRange, onCancelResearch: cancelResearch,
    symbol: activeSymbol, onSelectExternal: selectExternal })
  const sourceState: 'error' | 'live' | 'waiting' = !bridge.reachable || marketData.marketWatchStatus === 'unavailable'
    ? 'error'
    : mt5Connected && marketData.marketWatchStatus === 'live'
      ? 'live'
      : 'waiting'
  const sourceLabel = !bridge.reachable
    ? 'Bridge unreachable'
    : mt5Connected
      ? 'MT5 broker source'
      : bridge.processRunning
        ? 'MT5 disconnected'
        : 'Waiting for MT5'
  return { timeframe, theme, chartAppearance, timeDisplay, activeDrawingTool, selectedDrawingId, setSelectedDrawingId,
    drawingToolbarVisible, bottomDockWindow, dockSize, settingsOpen, setSettingsOpen, marketWatch, appendActivity,
    bridge, marketData, activeSymbol, bars, brokerId, inspector, quote, drawings, pairDrawingCount, updateDrawingPoint,
    updateDrawingPoints, updateDrawingText, updatePositionWidth, handleDeleteDrawing, selectSymbol, selectTimeframe,
    recordChartData, changeTheme, changeChartAppearance, changeTimeDisplay, createDrawing, chooseDrawingTool,
    selectCrosshair, deletePairDrawings, toggleBottomDock, exitDrawingMode, toggleDrawingToolbar,
    renderChartOverlay, sourceState, sourceLabel, researchActive, researchSeed, researchError,
    selectResearchTool, closeResearch, selectedExternalKey, externalSelection,
    plannedTrade, handlePlanChange, latestBarTime, registeredArrows, selectPinnedArrow }
}
