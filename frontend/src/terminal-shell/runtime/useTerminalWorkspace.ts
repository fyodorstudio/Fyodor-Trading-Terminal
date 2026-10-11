import { useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyColorTheme, readColorTheme, type ColorTheme } from '../../appearance/color-theme/color-theme-preference'
import { readTimeDisplayPreference, saveTimeDisplayPreference, timeDisplayLabel, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { useInspector } from '../../inspector'
import { scatterReleaseTarget, type ScatterReleaseTarget } from '../../scatter-plot'
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
import type { PlannedTradeState, RegisteredTradeArrow } from '../../trader-notebook/contracts/trader-notebook-types'
import { useRegisteredArrows } from '../../trader-notebook/storage/use-registered-arrows'
import type { BottomDockWindow } from '../../workspace-docking/bottom-dock/bottom-dock-window'
import { useBottomDockSize } from '../../workspace-docking/bottom-dock/useBottomDockSize'
import { useMarketWatchDock } from '../../workspace-docking/left-dock/useMarketWatchDock'
import { usdPair } from '../../scoring-system/context/usd/usd-pair'
import { readRaycasterVisible, saveRaycasterVisible } from '../../raycaster/storage/raycaster-preferences'
import type { ComboSnapshot, ComboSource, RoofComboGroup } from '../../scoring-system/relationships/contracts'
import type { RaycasterView } from '../../raycaster/ui/RaycasterBox'
import { fundamentalSettingsEvent, type FundamentalSettingsRequest } from '../../fundamental-tools/runtime/settings-navigation'
import { r1Family } from '../../scoring-system/r1/profiles'
import { usdScoringFamilies } from '../../scoring-system/scoring-catalog'

const defaultTradePlan: PlannedTradeState = {
  direction: 'long',
  entryPrice: null,
  tpPrice: null,
  slPrice: null,
  showOnChart: true,
}

export function useTerminalWorkspace() {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('H1')
  const [theme, setTheme] = useState<ColorTheme>(readColorTheme)
  const [chartAppearance, setChartAppearance] = useState<ChartAppearance>(readChartAppearance)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplayPreference>(readTimeDisplayPreference)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolId | null>(null)
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [drawingToolbarVisible, setDrawingToolbarVisible] = useState<boolean>(readDrawingToolbarVisible)
  const [raycasterVisible, setRaycasterVisible] = useState(readRaycasterVisible)
  const [raycasterView, setRaycasterView] = useState<RaycasterView>('r1')
  const [comboSelection, setComboSelection] = useState<{ combo: ComboSnapshot; symbol: string; broker: string | null } | null>(null)
  const [roofGroupSelection, setRoofGroupSelection] = useState<{ group: RoofComboGroup; symbol: string; broker: string | null; timeframe: ChartTimeframe } | null>(null)
  const [roofsPage, setRoofsPage] = useState<'overview' | 'details'>('overview')
  const roofsOverviewScroll = useRef(0)
  const restoreOverviewScroll = useCallback(() => roofsOverviewScroll.current, [])
  const rememberOverviewScroll = useCallback((position: number) => { roofsOverviewScroll.current = position }, [])
  const [bottomDockWindow, setBottomDockWindow] = useState<BottomDockWindow | null>(null)
  const [scoringFamily, setScoringFamily] = useState('claims')
  const [scoringModel,setScoringModel]=useState<'legacy'|'r1'>('legacy')
  useEffect(() => {
    const open = (event: Event) => {
      const request = (event as CustomEvent<FundamentalSettingsRequest>).detail
      const requested = request?.family
      if (requested && (r1Family(requested)||usdScoringFamilies.some(f => f.id === requested))) setScoringFamily(requested)
      if(request?.model)setScoringModel(request.model)
      setBottomDockWindow(current => request?.toggle && current === 'fundamental-settings' ? null : 'fundamental-settings')
    }
    window.addEventListener(fundamentalSettingsEvent, open)
    return () => window.removeEventListener(fundamentalSettingsEvent, open)
  }, [])
  const [scatterTarget, setScatterTarget] = useState<ScatterReleaseTarget | null>(null)
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

  // Planned trade state for the active symbol
  const [prevSymbolForPlan, setPrevSymbolForPlan] = useState(selectedSymbol)
  const [plannedTrade, setPlannedTrade] = useState<PlannedTradeState>(() => {
    const saved = localStorage.getItem(`trader_plan_${selectedSymbol}`)
    if (saved) {
      try {
        return JSON.parse(saved) as PlannedTradeState
      } catch {
        // fallback
      }
    }
    return defaultTradePlan
  })

  if (selectedSymbol !== prevSymbolForPlan) {
    setPrevSymbolForPlan(selectedSymbol)
    const saved = localStorage.getItem(`trader_plan_${selectedSymbol}`)
    if (saved) {
      try {
        setPlannedTrade(JSON.parse(saved) as PlannedTradeState)
      } catch {
        setPlannedTrade(defaultTradePlan)
      }
    } else {
      setPlannedTrade(defaultTradePlan)
    }
  }

  const handlePlanChange = (nextPlan: PlannedTradeState) => {
    setPlannedTrade(nextPlan)
    localStorage.setItem(`trader_plan_${selectedSymbol}`, JSON.stringify(nextPlan))
  }

  const bridge = useBridgeConnection()
  const mt5Connected = bridge.connected
  const marketData = useMt5MarketData(mt5Connected, bridge.generation, selectedSymbol, timeframe)
  const activeSymbol = marketData.activeSymbol
  const bars = marketData.bars
  const brokerId = bridge.brokerId
  const selectedCombo = comboSelection?.symbol === activeSymbol && comboSelection.broker === brokerId ? comboSelection.combo : null
  const selectedRoofGroup = roofGroupSelection?.symbol === activeSymbol && roofGroupSelection.broker === brokerId &&
    roofGroupSelection.timeframe === timeframe ? roofGroupSelection.group : null
  const closeCombo = useCallback(() => { setComboSelection(null); setRaycasterView('context'); setRoofsPage('overview') }, [])
  // A captured roof belongs to one symbol/broker; do not resurrect it on return.
  if (comboSelection && !selectedCombo) setComboSelection(null)
  if (roofGroupSelection && !selectedRoofGroup) setRoofGroupSelection(null)
  if (!selectedCombo && raycasterView === 'combo') setRaycasterView('context')
  const inspector = useInspector({ symbol: activeSymbol, bars, timeframe, timeDisplay,
    detailOpen: bottomDockWindow === 'inspector',
    clockOffsetMs: 0, brokerId,
    brokerOffsetSeconds: bridge.brokerOffsetSeconds })
  const quote = marketData.symbols.find((item) => item.symbol === activeSymbol) ?? null
  const latestBarTime = bars.length > 0 ? (bars[bars.length - 1].time as number) : 0
  const registeredArrows = useRegisteredArrows(activeSymbol)

  const {
    drawings,
    totalDrawingCount,
    addDrawing,
    updateDrawingPoint,
    updateDrawingPoints,
    updateDrawingText,
    updatePositionWidth,
    deleteDrawing,
    clearAllDrawings,
  } = useChartDrawings(activeSymbol, timeframe)

  const handleDeleteDrawing = useCallback((drawingId: string) => {
    deleteDrawing(drawingId)
    if (selectedDrawingId === drawingId) setSelectedDrawingId(null)
    appendActivity('Drawing', 'Drawing deleted', `${activeSymbol} ${timeframe}`)
  }, [activeSymbol, appendActivity, deleteDrawing, selectedDrawingId, timeframe])

  const selectSymbol = useCallback((symbol: string) => {
    if (symbol === selectedSymbol) return
    setSelectedSymbol(symbol)
    setSelectedDrawingId(null)
    appendActivity('Market Watch', 'Symbol selected', symbol)
  }, [selectedSymbol, appendActivity])

  const selectTimeframe = useCallback((nextTimeframe: ChartTimeframe) => {
    if (nextTimeframe === timeframe) return
    setTimeframe(nextTimeframe)
    setSelectedDrawingId(null)
    appendActivity('Chart', 'Timeframe selected', `${activeSymbol} ${nextTimeframe}`)
  }, [timeframe, activeSymbol, appendActivity])

  const recordChartData = useCallback(
    (barCount: number) => appendActivity('Chart', 'Candle data applied', `${activeSymbol} ${timeframe} Â· ${barCount} bars`),
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
      appendActivity('Drawing', 'Drawing created', `${activeSymbol} ${timeframe} Â· ${tool}`)
      return drawingId
    },
    [activeSymbol, addDrawing, appendActivity, timeframe],
  )

  const chooseDrawingTool = (tool: DrawingToolId | null) => {
    setActiveDrawingTool(tool)
    setSelectedDrawingId(null)
  }

  const selectCrosshair = () => {
    setActiveDrawingTool(null)
    setSelectedDrawingId(null)
  }

  const deleteAllDrawings = () => {
    clearAllDrawings()
    setSelectedDrawingId(null)
    appendActivity('Drawing', 'All drawings deleted', `${totalDrawingCount} removed`)
  }

  const selectBottomDock = useCallback((window: BottomDockWindow | null) => {
    setScatterTarget(null)
    setBottomDockWindow(window)
  }, [])
  const toggleBottomDock = (window: BottomDockWindow) => {
    setScatterTarget(null)
    setBottomDockWindow((current) => current === window ? null : window)
  }

  const exitDrawingMode = useCallback(() => setActiveDrawingTool(null), [])
  const toggleDrawingToolbar = useCallback(() => {
    setDrawingToolbarVisible((current) => {
      const next = !current
      saveDrawingToolbarVisible(next)
      appendActivity('Drawing', next ? 'Drawing toolbar shown' : 'Drawing toolbar hidden')
      return next
    })
    setActiveDrawingTool(null)
  }, [appendActivity])
  const setArrowSelection = registeredArrows.setSelectedArrowId
  const selectChartArrow = useCallback((arrow: RegisteredTradeArrow) => {
    setArrowSelection(arrow.id); selectBottomDock('notebook')
  }, [setArrowSelection, selectBottomDock])
  const setReleaseSelection = inspector.selectRelease
  const selectChartRelease = useCallback((id: string) => {
    setReleaseSelection(id); selectBottomDock('inspector')
  }, [setReleaseSelection, selectBottomDock])
  const closeRaycaster = useCallback(() => { setRaycasterVisible(false); saveRaycasterVisible(false) }, [])
  const openComboRaycaster = useCallback(() => {
    setRaycasterView('combo'); setRaycasterVisible(true); saveRaycasterVisible(true)
  }, [])
  const toggleRaycaster = useCallback(() => {
    setRaycasterVisible(current => { saveRaycasterVisible(!current); return !current })
    setActiveDrawingTool(null)
  }, [])
  const brokerOffsetSeconds = bridge.brokerOffsetSeconds
  const selectCombo = useCallback((combo: ComboSnapshot) => {
    setRoofGroupSelection(null); setRoofsPage('details'); roofsOverviewScroll.current = 0
    setComboSelection({ combo, symbol: activeSymbol, broker: brokerId }); selectBottomDock('roofs')
  }, [activeSymbol, brokerId, selectBottomDock])
  const openRoofGroup = useCallback((group: RoofComboGroup) => {
    setRoofGroupSelection({ group, symbol: activeSymbol, broker: brokerId, timeframe })
    setRoofsPage('overview'); roofsOverviewScroll.current = 0; selectBottomDock('roofs')
  }, [activeSymbol, brokerId, timeframe, selectBottomDock])
  const selectGroupCombo = useCallback((combo: ComboSnapshot) => {
    setComboSelection({ combo, symbol: activeSymbol, broker: brokerId }); setRoofsPage('details')
  }, [activeSymbol, brokerId])
  const showRoofOverview = useCallback(() => setRoofsPage('overview'), [])
  const inspectorPreferences = inspector.preferences
  const inspectPublication = inspector.inspectPublication
  const openComboRelease = useCallback((source: ComboSource) => {
    inspectPublication(source.sourceId, source.chartAt); selectBottomDock('inspector')
  }, [inspectPublication, selectBottomDock])
  const clearChartInspection = useCallback(() => {
    setReleaseSelection(null)
    setBottomDockWindow(current => current === 'inspector' ? null : current)
  }, [setReleaseSelection])
  const openScatter = useCallback((release: Parameters<typeof scatterReleaseTarget>[0]) => {
    const target = scatterReleaseTarget(release, inspector.brokerId, inspector.now)
    if (target) { setScatterTarget(inspector.preferences.detailView==='r1'?{...target,calculation:'r1'}:target); setBottomDockWindow('scatter-plot') }
  }, [inspector.brokerId, inspector.now,inspector.preferences.detailView])
  const contextViews = useSequencePreferences()
  const roofsSupported = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(activeSymbol)
  const contextVisible = raycasterVisible || !!selectedCombo || !!selectedRoofGroup || !!contextViews.ribbon || (roofsSupported && contextViews.roofs)
  const raycasterSupported = !!usdPair(activeSymbol)
  const publicationEvents = useMemo(() => inspector.allReleases.flatMap(release => release.events), [inspector.allReleases])
  const publication = useMemo(() => ({ release: inspector.selectedRelease, brokerId, events: publicationEvents,
    timeDisplay }), [inspector.selectedRelease, brokerId, publicationEvents, timeDisplay])
  const raycaster = useMemo(() => contextVisible && raycasterSupported ?
    { boxVisible: raycasterVisible, symbol: activeSymbol, timeframe, brokerId, brokerOffsetSeconds, clockOffsetMs: 0,
      timeDisplay, onClose: closeRaycaster, bars: inspector.markerBars, markers: inspector.markers, onSelectCombo: selectCombo,
      onOpenRoofGroup: openRoofGroup, activeRoofGroupCandleAt: selectedRoofGroup?.candleAt,
      symbols: inspectorPreferences.symbols, selectedCombo, onClearCombo: closeCombo, view: raycasterView, onViewChange: setRaycasterView, publication,
      onOpenComboSource: openComboRelease, currencyColors: inspectorPreferences.currencyColors } : null,
    [contextVisible, raycasterVisible, raycasterSupported, activeSymbol, timeframe, brokerId, brokerOffsetSeconds,
      timeDisplay, closeRaycaster, inspector.markerBars, inspector.markers, selectCombo, openRoofGroup, selectedRoofGroup, selectedCombo, closeCombo, openComboRelease, inspectorPreferences.currencyColors, inspectorPreferences.symbols, raycasterView, publication])
  const renderChartOverlay = useTerminalChartOverlay({ arrows: registeredArrows.symbolArrows,
    selectedArrowId: registeredArrows.selectedArrowId, draftPlan: plannedTrade, onSelectArrow: selectChartArrow,
    supported: inspector.supported, markers: inspector.markers, currencyColors: inspector.preferences.currencyColors,
    timeDisplay, onSelectRelease: selectChartRelease, raycaster,
    onClearInspection: !activeDrawingTool && (inspector.selectedRelease || inspector.inspectingPublication) ? clearChartInspection : undefined })

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
  return { selectedSymbol, timeframe, theme, chartAppearance, timeDisplay, activeDrawingTool, selectedDrawingId, setSelectedDrawingId, drawingToolbarVisible, raycasterVisible, roofsPage, restoreOverviewScroll, rememberOverviewScroll, bottomDockWindow, scoringFamily, setScoringFamily, scoringModel, setScoringModel, scatterTarget, dockSize, settingsOpen, setSettingsOpen, marketWatch, appendActivity, plannedTrade, handlePlanChange, bridge, marketData, activeSymbol, bars, brokerId, selectedCombo, selectedRoofGroup, inspector, quote, latestBarTime, registeredArrows, drawings, totalDrawingCount, updateDrawingPoint, updateDrawingPoints, updateDrawingText, updatePositionWidth, handleDeleteDrawing, selectSymbol, selectTimeframe, recordChartData, changeTheme, changeChartAppearance, changeTimeDisplay, createDrawing, chooseDrawingTool, selectCrosshair, deleteAllDrawings, toggleBottomDock, exitDrawingMode, toggleDrawingToolbar, openComboRaycaster, toggleRaycaster, brokerOffsetSeconds, selectGroupCombo, showRoofOverview, openComboRelease, openScatter, raycasterSupported, publicationEvents, renderChartOverlay, sourceState, sourceLabel }
}
