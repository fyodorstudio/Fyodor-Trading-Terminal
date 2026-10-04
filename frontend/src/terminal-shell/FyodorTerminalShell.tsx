import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { applyColorTheme, readColorTheme, type ColorTheme } from '../appearance/color-theme/color-theme-preference'
import {
  readTimeDisplayPreference,
  saveTimeDisplayPreference,
  timeDisplayLabel,
  type TimeDisplayPreference,
} from '../appearance/time-display/time-display-preference'
import { useInspector, InspectorPanel, InspectorChartMarkers } from '../inspector'
import { MarketCandlestickChart } from '../market-data/candlestick-chart/MarketCandlestickChart'
import { MarketChartErrorBoundary } from '../market-data/candlestick-chart/MarketChartErrorBoundary'
import { FloatingDrawingToolbar } from '../market-data/chart-drawings/FloatingDrawingToolbar'
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
import { DataHeartbeatPanel } from '../system-connectivity/bridge-status/DataHeartbeatPanel'
import { useBridgeStatus } from '../system-connectivity/bridge-status/use-bridge-status'
import { ActivityLogPanel } from '../system-observability/activity-log/ActivityLogPanel'
import { useActivityLog } from '../system-observability/activity-log/use-activity-log'
import { PlannedTradePriceLines } from '../trader-notebook/chart-levels/PlannedTradePriceLines'
import type { PlannedTradeState } from '../trader-notebook/contracts/trader-notebook-types'
import { TraderNotebookPanel } from '../trader-notebook/notebook-dock/TraderNotebookPanel'
import { useRegisteredArrows } from '../trader-notebook/storage/use-registered-arrows'
import { BottomDockPanel } from '../workspace-docking/bottom-dock/BottomDockPanel'
import type { BottomDockWindow } from '../workspace-docking/bottom-dock/bottom-dock-window'
import { useBottomDockSize } from '../workspace-docking/bottom-dock/useBottomDockSize'
import { LeftDockPanel } from '../workspace-docking/left-dock/LeftDockPanel'
import { ChartWorkspaceHeader } from './ChartWorkspaceHeader'
import { TerminalStatusBar } from './TerminalStatusBar'
import './terminal-shell.layout.css'

const defaultTradePlan: PlannedTradeState = {
  direction: 'long',
  entryPrice: null,
  tpPrice: null,
  slPrice: null,
  showOnChart: true,
}

export function FyodorTerminalShell() {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('H4')
  const [theme, setTheme] = useState<ColorTheme>(readColorTheme)
  const [chartAppearance, setChartAppearance] = useState<ChartAppearance>(readChartAppearance)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplayPreference>(readTimeDisplayPreference)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolId | null>(null)
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [bottomDockWindow, setBottomDockWindow] = useState<BottomDockWindow | null>('notebook')
  const dockSize = useBottomDockSize(bottomDockWindow)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { entries, appendActivity, clearActivity } = useActivityLog()

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

  const bridge = useBridgeStatus()
  const mt5Connected = bridge.health?.mt5.connected === true
  const marketData = useMt5MarketData(mt5Connected, bridge.health?.mt5.generation ?? 0, selectedSymbol, timeframe)
  const activeSymbol = marketData.activeSymbol
  const bars = marketData.bars
  const inspector = useInspector({ symbol: activeSymbol, bars, timeframe, timeDisplay,
    clockOffsetMs: bridge.clockOffsetMs, brokerId: bridge.health?.mt5.account_server ?? null,
    brokerOffsetSeconds: bridge.health?.calendar.server_utc_offset_seconds ?? 0 })
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

  const selectSymbol = (symbol: string) => {
    if (symbol === selectedSymbol) return
    setSelectedSymbol(symbol)
    setSelectedDrawingId(null)
    appendActivity('Market Watch', 'Symbol selected', symbol)
  }

  const selectTimeframe = (nextTimeframe: ChartTimeframe) => {
    if (nextTimeframe === timeframe) return
    setTimeframe(nextTimeframe)
    setSelectedDrawingId(null)
    appendActivity('Chart', 'Timeframe selected', `${activeSymbol} ${nextTimeframe}`)
  }

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

  const toggleBottomDock = (window: BottomDockWindow) => {
    setBottomDockWindow((current) => current === window ? null : window)
  }

  const sourceState = !bridge.reachable || marketData.marketWatchStatus === 'unavailable'
    ? 'error'
    : mt5Connected && marketData.marketWatchStatus === 'live'
      ? 'live'
      : 'waiting'
  const sourceLabel = !bridge.reachable
    ? 'Bridge unreachable'
    : mt5Connected
      ? 'MT5 broker source'
      : bridge.health?.mt5.process_running
        ? 'MT5 disconnected'
        : 'Waiting for MT5'
  return (
    <div className={`terminal-shell${bottomDockWindow ? ' bottom-dock-open' : ''}`}
      style={{ '--bottom-dock-height': `${dockSize.height}px` } as CSSProperties}>
      <main className="terminal-workspace">
        <LeftDockPanel
          symbols={marketData.symbols}
          selectedSymbol={activeSymbol}
          marketWatchStatus={marketData.marketWatchStatus}
          marketWatchError={marketData.marketWatchError}
          onSelectSymbol={selectSymbol}
        />

        <section className="chart-workspace" aria-label={`${activeSymbol} chart workspace`}>
          <ChartWorkspaceHeader
            symbol={activeSymbol}
            quote={quote}
            timeframe={timeframe}
            onSelectTimeframe={selectTimeframe}
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
                onExitDrawingMode={() => setActiveDrawingTool(null)}
                onDataApplied={recordChartData}
                hasOlderData={!marketData.chartHistoryComplete}
                isLoadingOlderData={marketData.chartHistoryLoading}
                onRequestOlderData={marketData.requestOlderBars}
                renderChartOverlay={(_chartApi, seriesApi) => (
                  <>
                    <PlannedTradePriceLines
                      chartApi={_chartApi}
                      seriesApi={seriesApi}
                      arrows={registeredArrows.symbolArrows}
                      selectedArrowId={registeredArrows.selectedArrowId}
                      draftPlan={plannedTrade}
                      onSelectArrow={(arrow) => {
                        registeredArrows.setSelectedArrowId(arrow.id)
                        setBottomDockWindow('notebook')
                      }}
                    />
                    {inspector.supported && <InspectorChartMarkers chartApi={_chartApi} markers={inspector.markers}
                      timeDisplay={timeDisplay} onSelectRelease={(id) => {
                        inspector.selectRelease(id)
                        setBottomDockWindow('inspector')
                      }} />}
                  </>
                )}
              />
            </MarketChartErrorBoundary>
            <MarketDataNotice status={marketData.chartStatus} symbol={activeSymbol} timeframe={timeframe} error={marketData.chartError} />
            {marketData.chartStatus === 'live' && marketData.chartHistoryLoading && (
              <CandleHistoryLoadingNotice symbol={activeSymbol} timeframe={timeframe} />
            )}
            <FloatingDrawingToolbar
              activeTool={activeDrawingTool}
              drawingCount={totalDrawingCount}
              onSelectCrosshair={selectCrosshair}
              onToolChange={chooseDrawingTool}
              onClearAll={deleteAllDrawings}
            />
            <div className="chart-watermark" aria-hidden="true">
              <strong>{activeSymbol}</strong>
              <span>{`${timeframe} Â· ${marketData.chartStatus === 'live' ? 'MT5 broker data' : 'Awaiting MT5 data'}`}</span>
            </div>
          </div>
        </section>
      </main>

      {bottomDockWindow && (
        <BottomDockPanel
          activeWindow={bottomDockWindow}
          activityCount={entries.length}
          selectedSymbol={activeSymbol}
          onSelectWindow={setBottomDockWindow}
          onClose={() => setBottomDockWindow(null)}
          resizeHandle={dockSize.resizeHandle}
        >
          {bottomDockWindow === 'notebook' && (
            <TraderNotebookPanel
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
            <ActivityLogPanel
              entries={entries}
              timeDisplay={timeDisplay}
              onClear={clearActivity}
              renderHeartbeat={(actions) => (
                <DataHeartbeatPanel
                  health={bridge.health}
                  reachable={bridge.reachable}
                  lastContactAt={bridge.lastContactAt}
                  roundTripMs={bridge.roundTripMs}
                  probeStartedAt={bridge.probeStartedAt}
                  clockExtra={actions}
                />
              )}
            />
          )}
          {bottomDockWindow === 'inspector' && <InspectorPanel view={inspector} symbol={activeSymbol}
            source={bridge.health?.calendar ?? null} error={null} timeDisplay={timeDisplay} />}
        </BottomDockPanel>
      )}

      <TerminalStatusBar
        sourceState={sourceState}
        sourceLabel={sourceLabel}
        sourceSymbolCount={marketData.symbols.length}
        selectedSymbol={activeSymbol}
        timeframe={timeframe}
        barCount={bars.length}
        activityCount={entries.length}
        bottomDockWindow={bottomDockWindow}
        settingsOpen={settingsOpen}
        timeDisplay={timeDisplay}
        onToggleBottomDock={toggleBottomDock}
        onThemeChanged={changeTheme}
        onToggleSettings={() => setSettingsOpen((current) => !current)}
      />

      {settingsOpen && (
        <ChartSettingsPopover
          appearance={chartAppearance}
          timeDisplay={timeDisplay}
          onChange={changeChartAppearance}
          onTimeDisplayChange={changeTimeDisplay}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
