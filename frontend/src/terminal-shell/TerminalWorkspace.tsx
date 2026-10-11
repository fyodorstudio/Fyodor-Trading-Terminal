import { DisplayClockProvider } from '../appearance/time-display/DisplayClock'
import { type CSSProperties } from 'react'
import { ScatterPlotDock, scatterReleaseTarget } from '../scatter-plot'
import { AlertDock } from '../alert'
import { MarketCandlestickChart } from '../market-data/candlestick-chart/MarketCandlestickChart'
import { MarketChartErrorBoundary } from '../market-data/candlestick-chart/MarketChartErrorBoundary'
import { FloatingDrawingToolbar } from '../market-data/chart-drawings/FloatingDrawingToolbar'
import { ChartSettingsPopover } from '../market-data/chart-settings/ChartSettingsPopover'
import { CandleHistoryLoadingNotice, MarketDataNotice } from '../market-data/mt5-feed/MarketDataNotice'
import { TraderNotebookPanel } from '../trader-notebook/notebook-dock/TraderNotebookPanel'
import { BottomDockPanel } from '../workspace-docking/bottom-dock/BottomDockPanel'
import { LeftDockPanel } from '../workspace-docking/left-dock/LeftDockPanel'
import { ChartWorkspaceHeader } from './ChartWorkspaceHeader'
import { ActivityDock, InspectorDock, LiveTerminalStatusBar } from './LiveTerminalPanels'
import { WorkspaceTransfer } from '../workspace-portability/WorkspaceTransfer'
import { RoofsDock } from '../usd-context/sequences/ui/RoofsDock'
import { FundamentalSettingsPanel } from '../fundamental-tools/ui/FundamentalSettingsPanel'
import { useTerminalWorkspace } from './runtime/useTerminalWorkspace'
import './terminal-shell.layout.css'

export function TerminalWorkspace() {
  const { timeframe, theme, chartAppearance, timeDisplay, activeDrawingTool, selectedDrawingId, setSelectedDrawingId, drawingToolbarVisible, raycasterVisible, roofsPage, restoreOverviewScroll, rememberOverviewScroll, bottomDockWindow, scoringFamily, setScoringFamily, scoringModel, setScoringModel, scatterTarget, dockSize, settingsOpen, setSettingsOpen, marketWatch, appendActivity, plannedTrade, handlePlanChange, bridge, marketData, activeSymbol, bars, brokerId, selectedCombo, selectedRoofGroup, inspector, quote, latestBarTime, registeredArrows, drawings, totalDrawingCount, updateDrawingPoint, updateDrawingPoints, updateDrawingText, updatePositionWidth, handleDeleteDrawing, selectSymbol, selectTimeframe, recordChartData, changeTheme, changeChartAppearance, changeTimeDisplay, createDrawing, chooseDrawingTool, selectCrosshair, deleteAllDrawings, toggleBottomDock, exitDrawingMode, toggleDrawingToolbar, openComboRaycaster, toggleRaycaster, brokerOffsetSeconds, selectGroupCombo, showRoofOverview, openComboRelease, openScatter, raycasterSupported, publicationEvents, renderChartOverlay, sourceState, sourceLabel } = useTerminalWorkspace()
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
            fundamentalSettingsActive={bottomDockWindow === 'fundamental-settings'}
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
              <span>{`${timeframe} · ${marketData.chartStatus === 'live' ? 'MT5 broker data' : 'Awaiting MT5 data'}`}</span>
            </div>
          </div>
        </section>
      </main>

      {bottomDockWindow && (
        <BottomDockPanel
          resizeHandle={dockSize.resizeHandle}
        >
          {bottomDockWindow === 'fundamental-settings' && <FundamentalSettingsPanel family={scoringFamily} onFamilyChange={setScoringFamily} model={scoringModel} onModelChange={setScoringModel}
            symbol={activeSymbol} brokerId={brokerId} timeframe={timeframe} brokerOffsetSeconds={bridge.brokerOffsetSeconds}
            release={inspector.selectedRelease} events={publicationEvents} />}
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
                  `${arrow.symbol} ${arrow.direction.toUpperCase()} · ${arrow.rrRatio.toFixed(2)}R`,
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
          {bottomDockWindow === 'alert' && <AlertDock brokerId={brokerId} brokerOffsetSeconds={brokerOffsetSeconds} timeDisplay={timeDisplay} />}
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
