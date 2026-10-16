import { DisplayClockProvider } from '../appearance/time-display/DisplayClock'
import { type CSSProperties } from 'react'
import { MarketCandlestickChart } from '../market-data/candlestick-chart/MarketCandlestickChart'
import { MarketChartErrorBoundary } from '../market-data/candlestick-chart/MarketChartErrorBoundary'
import { FloatingDrawingToolbar } from '../market-data/chart-drawings/FloatingDrawingToolbar'
import { ChartSettingsPopover } from '../market-data/chart-settings/ChartSettingsPopover'
import { CandleHistoryLoadingNotice, MarketDataNotice } from '../market-data/mt5-feed/MarketDataNotice'
import { BottomDockPanel } from '../workspace-docking/bottom-dock/BottomDockPanel'
import { LeftDockPanel } from '../workspace-docking/left-dock/LeftDockPanel'
import { ChartWorkspaceHeader } from './ChartWorkspaceHeader'
import { ActivityDock, InspectorDock, LiveTerminalStatusBar } from './LiveTerminalPanels'
import { useTerminalWorkspace } from './runtime/useTerminalWorkspace'
import './terminal-shell.layout.css'
import { ResearchReportPanel } from '../research/ResearchReportPanel'
import { EventsDock } from '../events-alarms/EventsDock'
import { EntryTradePanel } from '../entry-trade/dock/EntryTradePanel'

export function TerminalWorkspace() {
  const { timeframe, theme, chartAppearance, timeDisplay, activeDrawingTool, selectedDrawingId, setSelectedDrawingId,
    drawingToolbarVisible, bottomDockWindow, dockSize, settingsOpen, setSettingsOpen, marketWatch, appendActivity,
    bridge, marketData, activeSymbol, bars, brokerId, inspector, quote, drawings, pairDrawingCount,
    updateDrawingPoint, updateDrawingPoints, updateDrawingText, updatePositionWidth, handleDeleteDrawing,
    selectSymbol, selectTimeframe, recordChartData, changeTheme, changeChartAppearance, changeTimeDisplay,
    createDrawing, chooseDrawingTool, selectCrosshair, deletePairDrawings, toggleBottomDock, exitDrawingMode,
    toggleDrawingToolbar, renderChartOverlay, sourceState, sourceLabel, researchActive, researchSeed, researchError,
    selectResearchTool, closeResearch, prepareAlertResearch, selectedExternalKey, externalSelection,
    plannedTrade, handlePlanChange, latestBarTime, registeredArrows, selectPinnedArrow } = useTerminalWorkspace()
  const brokerOffsetSeconds = bridge.brokerOffsetSeconds
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
          />
          <div className="chart-research-workspace">
            <div className="chart-frame">
              <MarketChartErrorBoundary
                symbol={activeSymbol}
                timeframe={timeframe}
                onError={(error) => appendActivity('Chart', 'Chart error caught', error.message, { severity: 'error' })}
              >
                <MarketCandlestickChart
                  symbol={activeSymbol}
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
                key={activeSymbol}
                symbol={activeSymbol}
                activeTool={activeDrawingTool}
                drawingCount={pairDrawingCount}
                onSelectCrosshair={selectCrosshair}
                onToolChange={chooseDrawingTool}
                onClearPair={deletePairDrawings}
                researchActive={researchActive}
                researchDisabled={!inspector.supported || !brokerId || !bars.length}
                onSelectResearch={selectResearchTool}
              />
              )}
              <div className="chart-watermark" aria-hidden="true">
                <strong>{activeSymbol}</strong>
                <span>{`${timeframe} · ${marketData.chartStatus === 'live' ? 'MT5 broker data' : 'Awaiting MT5 data'}`}</span>
              </div>
            </div>
            {researchSeed && <ResearchReportPanel key={JSON.stringify(researchSeed)} seed={researchSeed} brokerId={brokerId} timeDisplay={timeDisplay} onClose={closeResearch} />}
          </div>
        </section>
      </main>

      {bottomDockWindow && (
        <BottomDockPanel
          resizeHandle={dockSize.resizeHandle}
        >
          {bottomDockWindow === 'activity' && (
            <ActivityDock timeDisplay={timeDisplay} />
          )}
          {(bottomDockWindow === 'external-sources' || bottomDockWindow === 'alert') && <EventsDock key={externalSelection} brokerId={brokerId}
            brokerOffsetSeconds={brokerOffsetSeconds} focusKey={bottomDockWindow === 'external-sources' ? selectedExternalKey : null} onPrepareResearch={prepareAlertResearch} />}
          {bottomDockWindow === 'entry-trade' && <EntryTradePanel selectedSymbol={activeSymbol} quote={quote} quotes={marketData.symbols}
            saveStatus={registeredArrows.saveStatus} onArchiveArrow={registeredArrows.archiveArrow} importError={registeredArrows.importError} latestBarTime={latestBarTime} plan={plannedTrade} registeredArrows={registeredArrows.allArrows}
            selectedArrowId={registeredArrows.selectedArrowId} onPlanChange={handlePlanChange}
            onSelectArrowId={selectPinnedArrow} onRegisterArrow={registeredArrows.addArrow}
            onDeleteArrow={registeredArrows.deleteArrow} onUpdateArrow={registeredArrows.updateArrow} />}
          {bottomDockWindow === 'inspector' && <InspectorDock view={inspector} symbol={activeSymbol}
            timeDisplay={timeDisplay}
            />}
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
        />
      )}
      {researchError && <div className="research-range-hint" role="alert">{researchError}<button type="button" onClick={closeResearch}>Close</button></div>}
    </div>
    </DisplayClockProvider>
  )
}
