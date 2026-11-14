import { DisplayClockProvider } from '../appearance/time-display/DisplayClock'
import { useCallback, useState, type CSSProperties } from 'react'
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
import { RecentEventsPanel } from '../recent-events/RecentEventsPanel'
import { CurrencyDetailPanel } from '../currency-details/CurrencyDetailPanel'
import { EventsDock } from '../events-alarms/EventsDock'
import { EntryTradePanel } from '../entry-trade/dock/EntryTradePanel'
import { WildcardsDock } from '../wildcards/WildcardsDock'
import { VolumeSettingsDialog } from '../market-data/indicators/volume/VolumeSettingsDialog'
import { RsiSettingsDialog } from '../market-data/indicators/rsi/RsiSettingsDialog'
import { MacroSettingsDialog } from '../market-data/indicators/macro/MacroSettingsDialog'
import { supportsMacro } from '../market-data/indicators/macro/macro-data'
import { selectMacroMetric, toggleMacroMetric, toggleMacroForecast, toggleMacroNumbers, type MacroMetric } from '../market-data/indicators/macro/macro-preferences'
import { chartEventCurrencies } from '../economic-calendar/forex/chart-event-scope'
import { LedgerProvider } from '../currency-ledger/LedgerProvider'
import { LedgerDock } from '../currency-ledger/LedgerDock'
import { HeatmapDock } from '../heatmap/HeatmapDock'
import { LedgerCandlePicker } from '../currency-ledger/LedgerCandlePicker'
import { brokerClockProfile } from '../appearance/time-display/chart-clock'
import { WildcardsProvider } from '../wildcards/WildcardsProvider'
import { useWildcards } from '../wildcards/useWildcards'
import { WildcardChartLayer } from '../wildcards/WildcardChartLayer'
import { timeframeToSeconds } from '../market-data/chart-drawings/position-drawing-geometry'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'

export function TerminalWorkspace() {
  return <WildcardsProvider><TerminalWorkspaceContent /></WildcardsProvider>
}

function TerminalWorkspaceContent() {
  const wildcards = useWildcards()
  const [refocusRequest, setRefocusRequest] = useState(0)
  const [rankingTarget, setRankingTarget] = useState<HTMLDivElement | null>(null)
    const { volume, changeVolume, toggleVolume, volumeSettingsOpen, setVolumeSettingsOpen, rsi, changeRsi, toggleRsi, rsiSettingsOpen, setRsiSettingsOpen,
    macro, toggleMacro, macroPreferences, changeMacro, macroSettingsOpen, setMacroSettingsOpen,
    timeframe, theme, chartAppearance, timeDisplay, activeDrawingTool, selectedDrawingId, setSelectedDrawingId,
    drawingToolbarVisible, eventIconsVisible, toggleEventIcons, bottomDockWindow, dockSize, settingsOpen, setSettingsOpen, marketWatch, appendActivity,
    bridge, marketData, activeSymbol, bars, brokerId, inspector, quote, drawings, pairDrawingCount,
    updateDrawingPoint, updateDrawingPoints, updateDrawingText, updatePositionWidth, handleDeleteDrawing,
    selectSymbol, selectTimeframe, recordChartData, changeTheme, changeChartAppearance, changeTimeDisplay,
    createDrawing, chooseDrawingTool, selectCrosshair, deletePairDrawings, toggleBottomDock, exitDrawingMode,
    toggleDrawingToolbar, renderChartOverlay, sourceState, sourceLabel,
    recentEventsOpen, toggleRecentEvents, closeRecentEvents, alertFocus, viewReleaseInAlert,
    rankingOpen, toggleRanking, closeRanking, detailOpen, toggleDetail, closeDetail, openDetail, viewLedgerEvent, viewMacroRelease, returnToLedger,
    plannedTrade, handlePlanChange, latestBarTime, registeredArrows, selectPinnedArrow, priceAlerts, leftDockTab, setLeftDockTab } = useTerminalWorkspace()
  const [heatmapStarted, setHeatmapStarted] = useState(false)
  if ((bottomDockWindow === 'heatmap' || rankingOpen) && !heatmapStarted) setHeatmapStarted(true)
  const brokerOffsetSeconds = bridge.brokerOffsetSeconds
  const ledgerCurrencies = chartEventCurrencies(activeSymbol)
  const ledgerSupported = ledgerCurrencies.length === 2
  const openLedgerDetail = useCallback(() => { openDetail() }, [openDetail])
  const pickerScope = (ledgerSupported || detailOpen) && (bottomDockWindow === 'ledger' || detailOpen) && bars.length && brokerClockProfile(brokerId) && !activeDrawingTool && !wildcards.placing && !wildcards.editor
    ? `${brokerId}:${activeSymbol}:${timeframe}` : null
  const renderChartWithLedger = useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    {renderChartOverlay?.(chartApi, seriesApi)}
    <LedgerCandlePicker chartApi={chartApi} bars={bars} />
    <WildcardChartLayer chartApi={chartApi} seriesApi={seriesApi} bars={bars} step={timeframeToSeconds(timeframe)} visible={eventIconsVisible} context={`${brokerId}:${activeSymbol}:${timeframe}`} />
  </>, [renderChartOverlay, bars, timeframe, eventIconsVisible, brokerId, activeSymbol])
  const closeRsiSettings = useCallback(() => setRsiSettingsOpen(false), [setRsiSettingsOpen])
  const closeVolumeSettings = useCallback(() => setVolumeSettingsOpen(false), [setVolumeSettingsOpen])
  const closeMacroSettings = useCallback(() => setMacroSettingsOpen(false), [setMacroSettingsOpen])
  const toggleMacroSeries = useCallback((metric: MacroMetric) => changeMacro(toggleMacroMetric(macroPreferences, metric)), [macroPreferences, changeMacro])
  const toggleMacroForecastSeries = useCallback((metric: MacroMetric) => changeMacro(toggleMacroForecast(macroPreferences, metric)), [macroPreferences, changeMacro])
  const toggleMacroNumberSeries = useCallback((metric: MacroMetric) => changeMacro(toggleMacroNumbers(macroPreferences, metric)), [macroPreferences, changeMacro])
  const selectMacroSeries = useCallback((metric: MacroMetric) => changeMacro(selectMacroMetric(macroPreferences, metric)), [macroPreferences, changeMacro])
  const changeVolumeAxis = useCallback((axisTarget: typeof volume.axisTarget) => changeVolume({ ...volume, axisTarget,
    ...(volume.mode === 'raw' && axisTarget === 'relative' ? { relativeLineVisible: true } : {}),
    ...(volume.mode === 'raw' && axisTarget === 'volume' && !volume.barsVisible && !volume.averageVisible ? { barsVisible: true } : {}),
  }), [volume, changeVolume])
  const toggleVolumeLayer = useCallback((layer: 'barsVisible' | 'relativeLineVisible' | 'averageVisible') => changeVolume({ ...volume, [layer]: !volume[layer] }), [volume, changeVolume])
  const recordChartTrace = useCallback((trace: string) => appendActivity('Chart', 'Timeframe trace', trace), [appendActivity])
  return (
    <DisplayClockProvider brokerId={brokerId} brokerOffsetSeconds={brokerOffsetSeconds} preference={timeDisplay}>
    <LedgerProvider broker={brokerId} enabled={ledgerCurrencies.length > 0 && (detailOpen || bottomDockWindow === 'ledger')} pickerScope={pickerScope} currencies={ledgerCurrencies}>
    <div className={`terminal-shell${bottomDockWindow ? ' bottom-dock-open' : ''}`}
      style={{ '--bottom-dock-height': `${dockSize.height}px` } as CSSProperties}>
      <main className={`terminal-workspace${marketWatch.collapsed ? ' market-watch-collapsed' : ''}`}>
        <LeftDockPanel
          marketWatch={marketWatch}
          symbols={marketData.symbols}
          selectedSymbol={activeSymbol}
          brokerId={brokerId}
          generation={bridge.generation}
          marketWatchStatus={marketData.marketWatchStatus}
          marketWatchError={marketData.marketWatchError}
          onSelectSymbol={selectSymbol}
          activeTab={leftDockTab}
          onSelectTab={setLeftDockTab}
          priceAlerts={priceAlerts}
          onCreatePriceAlert={() => chooseDrawingTool('price-alert')}
        />

        <section className="chart-workspace" aria-label={`${activeSymbol} chart workspace`}>
          <ChartWorkspaceHeader
            marketWatch={marketWatch}
            symbol={activeSymbol}
            quote={quote}
            timeframe={timeframe}
            onSelectTimeframe={selectTimeframe}
            onRefocus={() => setRefocusRequest(request => request + 1)}
            refocusDisabled={!bars.length}
            volumeEnabled={volume.enabled}
            onToggleVolume={toggleVolume}
            onOpenVolumeSettings={() => setVolumeSettingsOpen(true)}
            rsiEnabled={rsi.enabled}
            onToggleRsi={toggleRsi}
            onOpenRsiSettings={() => setRsiSettingsOpen(true)}
            macroEnabled={macro.enabled}
            onToggleMacro={toggleMacro}
            onOpenMacroSettings={() => setMacroSettingsOpen(true)}
            eventIconsVisible={eventIconsVisible}
            onToggleEventIcons={toggleEventIcons}
            drawingToolbarVisible={drawingToolbarVisible}
            onToggleDrawingToolbar={toggleDrawingToolbar}
            recentEventsOpen={recentEventsOpen}
            onToggleRecentEvents={toggleRecentEvents}
            rankingOpen={rankingOpen}
            onToggleRanking={toggleRanking}
            detailOpen={detailOpen}
            onToggleDetail={toggleDetail}
          />
          <div className="chart-workspace-row">
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
                  volume={volume}
                  onChangeVolumeAxis={changeVolumeAxis}
                  onToggleVolumeLayer={toggleVolumeLayer}
                  rsi={rsi}
                  macro={macro}
                  onToggleMacroMetric={toggleMacroSeries}
                  onToggleMacroForecast={toggleMacroForecastSeries}
                  onToggleMacroNumbers={toggleMacroNumberSeries}
                  onChangeMacroPreferences={changeMacro}
                  onSelectMacroMetric={selectMacroSeries}
                  onInspectMacroRelease={viewMacroRelease}
                  refocusRequest={refocusRequest}
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
                  onChartTrace={recordChartTrace}
                  hasOlderData={!marketData.chartHistoryComplete}
                  isLoadingOlderData={marketData.chartHistoryLoading}
                  onRequestOlderData={marketData.requestOlderBars}
                  renderChartOverlay={renderChartWithLedger}
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
                onSelectCrosshair={() => { wildcards.setPlacing(false); selectCrosshair() }}
                onToolChange={tool => { wildcards.setPlacing(false); chooseDrawingTool(tool) }}
                wildcardActive={wildcards.placing}
                wildcardDisabled={!wildcards.snapshot || !bars.length || !brokerClockProfile(brokerId)}
                onAddWildcard={() => { selectCrosshair(); wildcards.setPlacing(value => !value) }}
                onClearPair={deletePairDrawings}

                priceAlertDisabled={!brokerId || !quote || !priceAlerts.live}
              />
              )}
              <div className="chart-watermark" aria-hidden="true">
                <strong>{activeSymbol}</strong>
                <span>{`${timeframe} · ${marketData.chartStatus === 'live' ? 'MT5 broker data' : 'Awaiting MT5 data'}`}</span>
              </div>
            </div>
            {recentEventsOpen && <RecentEventsPanel brokerId={brokerId} symbol={activeSymbol} onClose={closeRecentEvents} />}
            {rankingOpen && <aside id="heatmap-ranking-panel" className="heatmap-ranking-slot" aria-label="Heatmap Ranking" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();closeRanking()}}}>
              <header><strong>Heatmap Ranking</strong><button type="button" aria-label="Close Heatmap Ranking" autoFocus onClick={closeRanking}>×</button></header>
              <div ref={setRankingTarget}/>
            </aside>}
            {detailOpen && <CurrencyDetailPanel brokerId={brokerId} symbol={activeSymbol} onClose={closeDetail} />}
          </div>
        </section>
      </main>

      {(bottomDockWindow || heatmapStarted) && (
        <BottomDockPanel
          resizeHandle={dockSize.resizeHandle}
          hidden={!bottomDockWindow}
        >
          {heatmapStarted && <div className="heatmap-slot" hidden={bottomDockWindow !== 'heatmap'}>
            <HeatmapDock symbols={marketData.symbols} broker={brokerId} generation={bridge.generation} active={bottomDockWindow === 'heatmap' || rankingOpen} dockActive={bottomDockWindow === 'heatmap'} rankingTarget={rankingTarget} onCloseRanking={closeRanking} connected={bridge.connected} />
          </div>}
          {bottomDockWindow === 'wildcards' && <WildcardsDock />}
          {bottomDockWindow === 'ledger' && <LedgerDock supported={ledgerSupported} broker={brokerId} onOpenDetail={openLedgerDetail} onViewEvent={viewLedgerEvent} />}
          {bottomDockWindow === 'activity' && (
            <ActivityDock timeDisplay={timeDisplay} />
          )}
          {bottomDockWindow === 'alert' && <EventsDock brokerId={brokerId} focus={alertFocus} />}
          {bottomDockWindow === 'entry-trade' && <EntryTradePanel selectedSymbol={activeSymbol} quote={quote} quotes={marketData.symbols}
            saveStatus={registeredArrows.saveStatus} onArchiveArrow={registeredArrows.archiveArrow} importError={registeredArrows.importError} latestBarTime={latestBarTime} plan={plannedTrade} registeredArrows={registeredArrows.allArrows}
            selectedArrowId={registeredArrows.selectedArrowId} onPlanChange={handlePlanChange}
            onSelectArrowId={selectPinnedArrow} onRegisterArrow={registeredArrows.addArrow}
            onDeleteArrow={registeredArrows.deleteArrow} onUpdateArrow={registeredArrows.updateArrow} />}
          {bottomDockWindow === 'inspector' && <InspectorDock view={inspector} symbol={activeSymbol}
            timeDisplay={timeDisplay} onViewInAlert={viewReleaseInAlert}
            onReturnToLedger={returnToLedger}
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
      {volumeSettingsOpen && <VolumeSettingsDialog preferences={volume} onSave={changeVolume} onClose={closeVolumeSettings} />}
      {macroSettingsOpen && supportsMacro(activeSymbol) && <MacroSettingsDialog preferences={macroPreferences} onSave={changeMacro} onClose={closeMacroSettings} />}
      {rsiSettingsOpen && <RsiSettingsDialog preferences={rsi} onSave={changeRsi} onClose={closeRsiSettings} />}
    </div>
    </LedgerProvider>
    </DisplayClockProvider>
  )
}
