import { useSequencePreferences } from '../usd-context/sequences/storage/sequence-preferences'
import { DisplayClockProvider } from '../appearance/time-display/DisplayClock'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { applyColorTheme, readColorTheme, type ColorTheme } from '../appearance/color-theme/color-theme-preference'
import {
  readTimeDisplayPreference,
  saveTimeDisplayPreference,
  timeDisplayLabel,
  type TimeDisplayPreference,
} from '../appearance/time-display/time-display-preference'
import { useInspector } from '../inspector'
import { ScatterPlotDock, scatterReleaseTarget, type ScatterReleaseTarget } from '../scatter-plot'
import { AlertDock } from '../alert'
import { MarketCandlestickChart } from '../market-data/candlestick-chart/MarketCandlestickChart'
import { MarketChartErrorBoundary } from '../market-data/candlestick-chart/MarketChartErrorBoundary'
import { FloatingDrawingToolbar } from '../market-data/chart-drawings/FloatingDrawingToolbar'
import {
  readDrawingToolbarVisible,
  saveDrawingToolbarVisible,
} from '../market-data/chart-drawings/drawing-toolbar-visibility'
import type { ChartDrawingPoint } from '../market-data/chart-drawings/chart-drawing-record'
import type { DrawingToolId } from '../market-data/chart-drawings/drawing-tool'
import { useChartDrawings } from '../market-data/chart-drawings/use-chart-drawings'
import { ChartSettingsPopover } from '../market-data/chart-settings/ChartSettingsPopover'
import {
  readChartAppearance,
  saveChartAppearance,
  type ChartAppearance,
} from '../market-data/chart-settings/chart-appearance-preference'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import { CandleHistoryLoadingNotice, MarketDataNotice } from '../market-data/mt5-feed/MarketDataNotice'
import { useMt5MarketData } from '../market-data/mt5-feed/use-mt5-market-data'
import { BridgeStatusProvider } from '../system-connectivity/bridge-status/BridgeStatusProvider'
import { useBridgeConnection } from '../system-connectivity/bridge-status/bridge-status-context'
import { useActivityActions } from '../system-observability/activity-log/use-activity-log'
import { useTerminalChartOverlay } from './chart-overlays/useTerminalChartOverlay'
import type { PlannedTradeState, RegisteredTradeArrow } from '../trader-notebook/contracts/trader-notebook-types'
import { TraderNotebookPanel } from '../trader-notebook/notebook-dock/TraderNotebookPanel'
import { useRegisteredArrows } from '../trader-notebook/storage/use-registered-arrows'
import { BottomDockPanel } from '../workspace-docking/bottom-dock/BottomDockPanel'
import type { BottomDockWindow } from '../workspace-docking/bottom-dock/bottom-dock-window'
import { useBottomDockSize } from '../workspace-docking/bottom-dock/useBottomDockSize'
import { LeftDockPanel } from '../workspace-docking/left-dock/LeftDockPanel'
import { useMarketWatchDock } from '../workspace-docking/left-dock/useMarketWatchDock'
import { ChartWorkspaceHeader } from './ChartWorkspaceHeader'
import { ActivityDock, InspectorDock, LiveTerminalStatusBar } from './LiveTerminalPanels'
import './terminal-shell.layout.css'
import { WorkspaceTransfer } from '../workspace-portability/WorkspaceTransfer'
import { usdPair } from '../usd-context/core/usd-pair'
import { readRaycasterVisible, saveRaycasterVisible } from '../raycaster/storage/raycaster-preferences'
import type { ComboSnapshot, ComboSource, RoofComboGroup } from '../usd-context/sequences/core/contracts'
import { RoofsDock } from '../usd-context/sequences/ui/RoofsDock'
import type { RaycasterView } from '../raycaster/ui/RaycasterBox'

const defaultTradePlan: PlannedTradeState = {
  direction: 'long',
  entryPrice: null,
  tpPrice: null,
  slPrice: null,
  showOnChart: true,
}

export function FyodorTerminalShell() {
  return <BridgeStatusProvider><FyodorTerminalWorkspace /></BridgeStatusProvider>
}

function FyodorTerminalWorkspace() {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('H1')
  const [theme, setTheme] = useState<ColorTheme>(readColorTheme)
  const [chartAppearance, setChartAppearance] = useState<ChartAppearance>(readChartAppearance)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplayPreference>(readTimeDisplayPreference)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolId | null>(null)
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [drawingToolbarVisible, setDrawingToolbarVisible] = useState<boolean>(readDrawingToolbarVisible)
  const [raycasterVisible, setRaycasterVisible] = useState(readRaycasterVisible)
  const [raycasterView, setRaycasterView] = useState<RaycasterView>('context')
  const [comboSelection, setComboSelection] = useState<{ combo: ComboSnapshot; symbol: string; broker: string | null } | null>(null)
  const [roofGroupSelection, setRoofGroupSelection] = useState<{ group: RoofComboGroup; symbol: string; broker: string | null; timeframe: ChartTimeframe } | null>(null)
  const [roofsPage, setRoofsPage] = useState<'overview' | 'details'>('overview')
  const roofsOverviewScroll = useRef(0)
  const restoreOverviewScroll = useCallback(() => roofsOverviewScroll.current, [])
  const rememberOverviewScroll = useCallback((position: number) => { roofsOverviewScroll.current = position }, [])
  const [bottomDockWindow, setBottomDockWindow] = useState<BottomDockWindow | null>(null)
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
  }, [setReleaseSelection])
  const openScatter = useCallback((release: Parameters<typeof scatterReleaseTarget>[0]) => {
    const target = scatterReleaseTarget(release, inspector.brokerId, inspector.now)
    if (target) { setScatterTarget(target); setBottomDockWindow('scatter-plot') }
  }, [inspector.brokerId, inspector.now])
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
      selectedCombo, onClearCombo: closeCombo, view: raycasterView, onViewChange: setRaycasterView, publication,
      onOpenComboSource: openComboRelease, currencyColors: inspectorPreferences.currencyColors } : null,
    [contextVisible, raycasterVisible, raycasterSupported, activeSymbol, timeframe, brokerId, brokerOffsetSeconds,
      timeDisplay, closeRaycaster, inspector.markerBars, inspector.markers, selectCombo, openRoofGroup, selectedRoofGroup, selectedCombo, closeCombo, openComboRelease, inspectorPreferences.currencyColors, raycasterView, publication])
  const renderChartOverlay = useTerminalChartOverlay({ arrows: registeredArrows.symbolArrows,
    selectedArrowId: registeredArrows.selectedArrowId, draftPlan: plannedTrade, onSelectArrow: selectChartArrow,
    supported: inspector.supported, markers: inspector.markers, currencyColors: inspector.preferences.currencyColors,
    timeDisplay, onSelectRelease: selectChartRelease, raycaster,
    onClearInspection: !activeDrawingTool && (inspector.selectedRelease || inspector.inspectingPublication) ? clearChartInspection : undefined })

  const sourceState = !bridge.reachable || marketData.marketWatchStatus === 'unavailable'
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
  return (
    <DisplayClockProvider brokerId={brokerId} brokerOffsetSeconds={brokerOffsetSeconds} preference={timeDisplay}>
    <div className={`terminal-shell${bottomDockWindow ? ' bottom-dock-open' : ''}`}
      style={{ '--bottom-dock-height': `${dockSize.height}px` } as CSSProperties}>
      <main className={`terminal-workspace${marketWatch.collapsed ? ' market-watch-collapsed' : ''}`}>
        <LeftDockPanel
          marketWatch={marketWatch}
          symbols={marketData.symbols}
          selectedSymbol={activeSymbol}
          marketWatchStatus={marketData.marketWatchStatus}
          marketWatchError={marketData.marketWatchError}
          onSelectSymbol={selectSymbol}
        />

        <section className="chart-workspace" aria-label={`${activeSymbol} chart workspace`}>
          <ChartWorkspaceHeader
            marketWatch={marketWatch}
            symbol={activeSymbol}
            quote={quote}
            timeframe={timeframe}
            onSelectTimeframe={selectTimeframe}
            drawingToolbarVisible={drawingToolbarVisible}
            onToggleDrawingToolbar={toggleDrawingToolbar}
            raycasterVisible={raycasterVisible}
            raycasterSupported={raycasterSupported}
            onToggleRaycaster={toggleRaycaster}
            brokerId={brokerId}
            brokerOffsetSeconds={brokerOffsetSeconds}
            timeDisplay={timeDisplay}
          />
          <div className="chart-frame">
            <MarketChartErrorBoundary
              symbol={activeSymbol}
              timeframe={timeframe}
              onError={(error) => appendActivity('Chart', 'Chart error caught', error.message, { severity: 'error' })}
            >
              <MarketCandlestickChart
                bars={bars}
                fitContentKey={`${activeSymbol}:${timeframe}`}
                precision={quote?.precision ?? 5}
                theme={theme}
                appearance={chartAppearance}
                timeDisplay={timeDisplay}
                timeframe={timeframe}
                activeDrawingTool={activeDrawingTool}
                drawings={drawings}
                selectedDrawingId={selectedDrawingId}
                onSelectDrawing={setSelectedDrawingId}
                onCreateDrawing={createDrawing}
                onUpdateDrawingPoint={updateDrawingPoint}
                onUpdateDrawingPoints={updateDrawingPoints}
                onUpdatePositionWidth={updatePositionWidth}
                onUpdateDrawingText={updateDrawingText}
                onDeleteDrawing={handleDeleteDrawing}
                onExitDrawingMode={exitDrawingMode}
                onDataApplied={recordChartData}
                hasOlderData={!marketData.chartHistoryComplete}
                isLoadingOlderData={marketData.chartHistoryLoading}
                onRequestOlderData={marketData.requestOlderBars}
                renderChartOverlay={renderChartOverlay}
              />
            </MarketChartErrorBoundary>
            <MarketDataNotice status={marketData.chartStatus} symbol={activeSymbol} timeframe={timeframe} error={marketData.chartError} />
            {marketData.chartStatus === 'live' && marketData.chartHistoryLoading && (
              <CandleHistoryLoadingNotice symbol={activeSymbol} timeframe={timeframe} />
            )}
            {drawingToolbarVisible && (
              <FloatingDrawingToolbar
              activeTool={activeDrawingTool}
              drawingCount={totalDrawingCount}
              onSelectCrosshair={selectCrosshair}
              onToolChange={chooseDrawingTool}
              onClearAll={deleteAllDrawings}
            />
            )}
            <div className="chart-watermark" aria-hidden="true">
              <strong>{activeSymbol}</strong>
              <span>{`${timeframe} Â· ${marketData.chartStatus === 'live' ? 'MT5 broker data' : 'Awaiting MT5 data'}`}</span>
            </div>
          </div>
        </section>
      </main>

      {bottomDockWindow && (
        <BottomDockPanel
          resizeHandle={dockSize.resizeHandle}
        >
          {bottomDockWindow === 'notebook' && (
            <TraderNotebookPanel
              contextScope={{ brokerId, brokerOffsetSeconds, clockOffsetMs: 0 }}
              selectedSymbol={activeSymbol}
              quote={quote}
              latestBarTime={latestBarTime}
              plan={plannedTrade}
              registeredArrows={registeredArrows.symbolArrows}
              selectedArrowId={registeredArrows.selectedArrowId}
              onPlanChange={handlePlanChange}
              onSelectArrowId={registeredArrows.setSelectedArrowId}
              onRegisterArrow={(arrowData) => {
                const arrow = registeredArrows.addArrow(arrowData)
                appendActivity(
                  'Chart',
                  'Setup arrow registered',
                  `${arrow.symbol} ${arrow.direction.toUpperCase()} Â· ${arrow.rrRatio.toFixed(2)}R`,
                )
              }}
              onDeleteArrow={(id) => {
                registeredArrows.deleteArrow(id)
                appendActivity('Chart', 'Setup arrow deleted', id)
              }}
            />
          )}
          {bottomDockWindow === 'activity' && (
            <ActivityDock timeDisplay={timeDisplay} />
          )}
          {bottomDockWindow === 'inspector' && <InspectorDock view={inspector} symbol={activeSymbol}
            timeDisplay={timeDisplay}
            scatterAvailable={!!scatterReleaseTarget(inspector.selectedRelease, inspector.brokerId, inspector.now)}
            onOpenScatter={openScatter} />}
          {bottomDockWindow === 'roofs' && <RoofsDock group={selectedRoofGroup} combo={selectedCombo} page={roofsPage} symbol={activeSymbol}
            timeDisplay={timeDisplay}
            restoreOverviewScroll={restoreOverviewScroll} rememberOverviewScroll={rememberOverviewScroll} onViewDetails={selectGroupCombo} onBack={showRoofOverview}
            onOpenRaycaster={openComboRaycaster}
            onOpenRelease={openComboRelease} />}
          {bottomDockWindow === 'scatter-plot' && <ScatterPlotDock brokerId={brokerId} target={scatterTarget} />}
          {bottomDockWindow === 'alert' && <AlertDock brokerId={inspector.brokerId ?? null} preferences={inspector.preferences}
            brokerOffsetSeconds={inspector.brokerOffsetSeconds}
            timeDisplay={timeDisplay} supported={inspector.supported} />}
        </BottomDockPanel>
      )}

      <LiveTerminalStatusBar
        sourceState={sourceState}
        sourceLabel={sourceLabel}
        sourceSymbolCount={marketData.symbols.length}
        selectedSymbol={activeSymbol}
        timeframe={timeframe}
        barCount={bars.length}
        bottomDockWindow={bottomDockWindow}
        settingsOpen={settingsOpen}
        timeDisplay={timeDisplay}
        onToggleBottomDock={toggleBottomDock}
        onToggleSettings={() => setSettingsOpen((current) => !current)}
      />

      {settingsOpen && (
        <ChartSettingsPopover
          appearance={chartAppearance}
          timeDisplay={timeDisplay}
          onChange={changeChartAppearance}
          onTimeDisplayChange={changeTimeDisplay}
          onThemeChanged={changeTheme}
          onClose={() => setSettingsOpen(false)}
        ><WorkspaceTransfer /></ChartSettingsPopover>
      )}
    </div>
    </DisplayClockProvider>
  )
}
