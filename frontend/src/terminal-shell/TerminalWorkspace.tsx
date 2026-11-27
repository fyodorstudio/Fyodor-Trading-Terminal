import { DisplayClockProvider } from '../appearance/time-display/DisplayClock'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { MarketCandlestickChart } from '../market-data/candlestick-chart/MarketCandlestickChart'
import { ChartReplayDock } from '../market-data/candlestick-chart/ChartReplayDock'
import { useChartReplay } from '../market-data/candlestick-chart/use-chart-replay'
import { MarketChartErrorBoundary } from '../market-data/candlestick-chart/MarketChartErrorBoundary'
import { FloatingDrawingToolbar } from '../market-data/chart-drawings/FloatingDrawingToolbar'
import { ChartSettingsPopover } from '../market-data/chart-settings/ChartSettingsPopover'
import { CandleHistoryLoadingNotice, MarketDataNotice } from '../market-data/mt5-feed/MarketDataNotice'
import { BottomDockPanel } from '../workspace-docking/bottom-dock/BottomDockPanel'
import { LeftDockPanel, type LeftDockTab } from '../workspace-docking/left-dock/LeftDockPanel'
import { ChartWorkspaceHeader } from './ChartWorkspaceHeader'
import { ActivityDock, InspectorDock, LiveTerminalStatusBar } from './LiveTerminalPanels'
import { useTerminalWorkspace } from './runtime/useTerminalWorkspace'
import './terminal-shell.layout.css'
import { RecentEventsPanel } from '../recent-events/RecentEventsPanel'
import { CurrencyDetailPanel } from '../currency-details/CurrencyDetailPanel'
import { EventsDock } from '../events-alarms/EventsDock'
import { EntryTradePanel } from '../entry-trade/dock/EntryTradePanel'
import { WildcardsDock } from '../wildcards/WildcardsDock'
import { NewsFlowPanel } from '../news-flow/NewsFlowPanel'
import { NewsSoundAlerts } from '../news-flow/NewsSoundAlerts'
import { PriceAlertDeliveryNotice } from '../price-alerts/PriceAlertDeliveryNotice'
import { heatmapNewsSelection } from '../news-flow/date-range'
import { selectNewsDate } from '../news-flow/settings'
import { VolumeSettingsDialog } from '../market-data/indicators/volume/VolumeSettingsDialog'
import { VolumeProfileSettingsDialog } from '../market-data/indicators/volume-profile/VolumeProfileSettingsDialog'
import { ProfileAlertMonitor } from '../market-data/indicators/volume-profile/ProfileAlertMonitor'
import { VolumeProfileAlertsDock } from '../market-data/indicators/volume-profile/VolumeProfileAlertsDock'
import { useProfileAlerts } from '../market-data/indicators/volume-profile/use-profile-alerts'
import type { ProfileAlert } from '../market-data/indicators/volume-profile/volume-profile-alerts'
import type { ProfileWindow } from '../market-data/indicators/volume-profile/volume-profile'
import { readVolumeProfilePreferences, saveVolumeProfilePreferences, type VolumeProfilePreferences } from '../market-data/indicators/volume-profile/volume-profile-preferences'
import { AtrSettingsDialog } from '../market-data/indicators/atr/AtrSettingsDialog'
import { MarketStructureSettingsDialog } from '../market-data/indicators/market-structure/MarketStructureSettingsDialog'
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
  const [volumeProfileEnabled, setVolumeProfileEnabled] = useState(false)
  const [volumeProfileSettingsOpen, setVolumeProfileSettingsOpen] = useState(false)
  const [volumeProfile, setVolumeProfile] = useState(readVolumeProfilePreferences)
  useEffect(() => { saveVolumeProfilePreferences(volumeProfile) }, [volumeProfile])
  const changeVolumeProfile = useCallback((patch: Partial<VolumeProfilePreferences>) =>
    setVolumeProfile(current => ({ ...current, ...patch })), [])
  const closeVolumeProfileSettings = useCallback(() => setVolumeProfileSettingsOpen(false), [])
  const [rankingTarget, setRankingTarget] = useState<HTMLDivElement | null>(null)
  const { marketStructure, changeMarketStructure, toggleMarketStructure, marketStructureSettingsOpen, setMarketStructureSettingsOpen,
    atr, changeAtr, toggleAtr, atrSettingsOpen, setAtrSettingsOpen, volume, changeVolume, changeTickDeltaView, toggleTickDeltaLine, changeTickDeltaAxis, toggleVolume, volumeSettingsOpen, setVolumeSettingsOpen, rsi, changeRsi, toggleRsi, rsiSettingsOpen, setRsiSettingsOpen,
    macro, toggleMacro, macroPreferences, changeMacro, macroSettingsOpen, setMacroSettingsOpen,
    timeframe, theme, chartAppearance, timeDisplay, activeDrawingTool, selectedDrawingId, setSelectedDrawingId,
    drawingToolbarVisible, eventIconMode, cycleEventIcons, bottomDockWindow, dockSize, settingsOpen, setSettingsOpen, marketWatch, appendActivity,
    bridge, marketData, activeSymbol, bars, brokerId, inspector, quote, drawings, pairDrawingCount,
    updateDrawingPoint, updateDrawingPoints, updateDrawingText, updatePositionWidth, handleDeleteDrawing, changeTrendDrag,
    selectSymbol, selectTimeframe, recordChartData, changeTheme, changeChartAppearance, changeTimeDisplay,
    createDrawing, chooseDrawingTool, selectCrosshair, deletePairDrawings, toggleBottomDock, exitDrawingMode,
    toggleDrawingToolbar, renderChartOverlay, sourceState, sourceLabel,
    recentEventsOpen, toggleRecentEvents, closeRecentEvents, alertFocus, viewReleaseInAlert,
    rankingOpen, toggleRanking, closeRanking, newsOpen, toggleNews, closeNews, openNews, detailOpen, toggleDetail, closeDetail, openDetail, viewLedgerEvent, viewMacroRelease, returnToLedger,
    plannedTrade, handlePlanChange, latestBarTime, registeredArrows, selectPinnedArrow, priceAlerts, leftDockTab, setLeftDockTab } = useTerminalWorkspace()
  const brokerOffsetSeconds = bridge.brokerOffsetSeconds
  const replay = useChartReplay(bottomDockWindow === 'replay', `${brokerId}:${bridge.generation}:${activeSymbol}:${timeframe}`,
    bars, timeframeToSeconds(timeframe), brokerOffsetSeconds)
  const replaying = replay.end !== null
  const pauseReplay = replay.pause
  const inspectMacroRelease = useCallback((reading: Parameters<typeof viewMacroRelease>[0]) => {
    pauseReplay()
    viewMacroRelease(reading)
  }, [pauseReplay, viewMacroRelease])
  const recordVpAlert = useCallback((message: string) => appendActivity('Chart', 'Volume Profile alert', message), [appendActivity])
  const vpAlerts = useProfileAlerts(brokerId, recordVpAlert)
  const [vpAlertFixed, setVpAlertFixed] = useState<{ symbol: string; range: ProfileWindow } | null>(null)
  const fixedAlert = vpAlertFixed?.symbol === activeSymbol ? vpAlertFixed.range : undefined
  const selectLeftDockTab = (tab: LeftDockTab) => { setVpAlertFixed(null); setLeftDockTab(tab) }
  const armFromProfile = (range?: ProfileWindow) => {
    setVpAlertFixed(range ? { symbol: activeSymbol, range } : null)
    setLeftDockTab('vp-alerts')
    marketWatch.open()
  }
  const vpGroups = new Map<string, ProfileAlert[]>()
  for (const rule of vpAlerts.alerts) {
    if (!rule.armed) continue
    const key = rule.fixed ? `${rule.symbol}:${rule.fixed.from}:${rule.fixed.to}` : `${rule.symbol}:${rule.lookbackMinutes}`
    const group = vpGroups.get(key) ?? []
    group.push(rule)
    vpGroups.set(key, group)
  }
  const hasDailyCloseHistory = quote?.synthetic === true && timeframe === 'D1' && replay.bars.some(bar => bar.closeOnly)
  const tickActivityOpen = volume.enabled && (quote?.synthetic === true || volume.mode === 'tick-delta')
  const [sessionCursorTime, setSessionCursorTime] = useState<number | null>(null)
  const [heatmapStarted, setHeatmapStarted] = useState(false)
  if ((bottomDockWindow === 'heatmap' || rankingOpen) && !heatmapStarted) setHeatmapStarted(true)
  const showHeatmapNews = useCallback((date: string) => {
    const selection = heatmapNewsSelection(date, { brokerId, brokerOffsetSeconds })
    if (selection) { selectNewsDate(selection); openNews() }
  }, [brokerId, brokerOffsetSeconds, openNews])
  const searchMarketWatch = marketWatch.search
  const openHeatmapInstrument = useCallback((rowId: string) => {
    if (rowId.startsWith('symbol:')) selectSymbol(rowId.slice(7))
    else if (rowId.startsWith('basket:')) {
      setLeftDockTab('market-watch')
      searchMarketWatch(rowId.slice(7))
    }
  }, [selectSymbol, setLeftDockTab, searchMarketWatch])
  const ledgerCurrencies = chartEventCurrencies(activeSymbol)
  const ledgerSupported = ledgerCurrencies.length === 2
  const openLedgerDetail = useCallback(() => { openDetail() }, [openDetail])
  const pickerScope = !replaying && !replay.picking && (ledgerSupported || detailOpen) && (bottomDockWindow === 'ledger' || detailOpen) && bars.length && brokerClockProfile(brokerId) && !activeDrawingTool && !wildcards.placing && !wildcards.editor
    ? `${brokerId}:${activeSymbol}:${timeframe}` : null
  const wildcardIconsVisible = eventIconMode === 'wildcards' || eventIconMode === 'all'
  const renderChartWithLedger = useCallback((chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) => <>
    {renderChartOverlay?.(chartApi, seriesApi)}
    <LedgerCandlePicker chartApi={chartApi} bars={bars} />
    <WildcardChartLayer chartApi={chartApi} seriesApi={seriesApi} bars={bars} step={timeframeToSeconds(timeframe)} visible={wildcardIconsVisible} context={`${brokerId}:${activeSymbol}:${timeframe}`} />
  </>, [renderChartOverlay, bars, timeframe, wildcardIconsVisible, brokerId, activeSymbol])
  const closeRsiSettings = useCallback(() => setRsiSettingsOpen(false), [setRsiSettingsOpen])
  const closeAtrSettings = useCallback(() => setAtrSettingsOpen(false), [setAtrSettingsOpen])
  const closeMarketStructureSettings = useCallback(() => setMarketStructureSettingsOpen(false), [setMarketStructureSettingsOpen])
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
    <NewsSoundAlerts />
    <PriceAlertDeliveryNotice controller={priceAlerts} />
    {bridge.connected && marketData.marketWatchStatus === 'live' && [...vpGroups].map(([key, rules]) =>
      <ProfileAlertMonitor key={`${brokerId}:${bridge.generation}:${key}`} rules={rules}
        quote={marketData.symbols.find(item => item.symbol === rules[0].symbol)}
        generation={bridge.generation} offset={brokerOffsetSeconds} onEvents={vpAlerts.onEvents} />)}
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
          onSelectTab={selectLeftDockTab}
          priceAlerts={priceAlerts}
          onCreatePriceAlert={() => chooseDrawingTool('price-alert')}
          armedVpAlerts={vpAlerts.alerts.filter(alert => alert.armed).length}
          vpAlerts={<VolumeProfileAlertsDock key={`${activeSymbol}:${fixedAlert?.from}:${fixedAlert?.to}:${volumeProfile.lookbackMinutes}`}
            controller={vpAlerts} symbol={activeSymbol} lookback={volumeProfile.lookbackMinutes}
            fixed={fixedAlert} canArm={Boolean(brokerId && bridge.connected)} onSelectSymbol={selectSymbol} />}
        />

        <section className="chart-workspace" aria-label={`${activeSymbol} chart workspace`}>
          <ChartWorkspaceHeader
            sessionCursorTime={chartAppearance.showSessionCursor ? sessionCursorTime : null}
            marketWatch={marketWatch}
            symbol={activeSymbol}
            quote={quote}
            timeframe={timeframe}
            onSelectTimeframe={selectTimeframe}
            onRefocus={() => setRefocusRequest(request => request + 1)}
            refocusDisabled={!bars.length}
            volumeProfileEnabled={volumeProfileEnabled}
            onToggleVolumeProfile={() => setVolumeProfileEnabled(value => !value)}
            onOpenVolumeProfileSettings={() => setVolumeProfileSettingsOpen(true)}
            marketStructure={marketStructure}
            onChangeMarketStructure={changes => changeMarketStructure({ ...marketStructure, ...changes })}
            onToggleMarketStructure={toggleMarketStructure}
            onOpenMarketStructureSettings={() => setMarketStructureSettingsOpen(true)}
            atrEnabled={atr.enabled}
            onToggleAtr={toggleAtr}
            onOpenAtrSettings={() => setAtrSettingsOpen(true)}
            volumeEnabled={volume.enabled}
            onToggleVolume={toggleVolume}
            onOpenVolumeSettings={() => setVolumeSettingsOpen(true)}
            rsiEnabled={rsi.enabled}
            onToggleRsi={toggleRsi}
            onOpenRsiSettings={() => setRsiSettingsOpen(true)}
            macroEnabled={macro.enabled}
            onToggleMacro={toggleMacro}
            onOpenMacroSettings={() => setMacroSettingsOpen(true)}
            eventIconMode={eventIconMode}
            onCycleEventIcons={cycleEventIcons}
            drawingToolbarVisible={drawingToolbarVisible}
            onToggleDrawingToolbar={toggleDrawingToolbar}
            recentEventsOpen={recentEventsOpen}
            onToggleRecentEvents={toggleRecentEvents}
            rankingOpen={rankingOpen}
            onToggleRanking={toggleRanking}
            newsOpen={newsOpen}
            onToggleNews={toggleNews}
            detailOpen={detailOpen}
            onToggleDetail={toggleDetail}
          />
          <div className="chart-workspace-row">
            <div className="chart-frame">
              {vpAlerts.notice && <div className="vp-alert-notice" role="status">{vpAlerts.notice}
                <button type="button" onClick={vpAlerts.dismissNotice} aria-label="Dismiss VP alert">×</button></div>}
              <MarketChartErrorBoundary
                symbol={activeSymbol}
                timeframe={timeframe}
                onError={(error) => appendActivity('Chart', 'Chart error caught', error.message, { severity: 'error' })}
              >
                <MarketCandlestickChart
                  symbol={activeSymbol}
                  bars={replay.bars}
                  replayEnd={replay.end}
                  replaySeekRevision={replay.seekRevision}
                  onReplayStep={replaying && !replay.picking ? replay.stepBy : undefined}
                  replayAnchor={replay.picking || replay.anchor !== null ? {
                    anchor: replay.anchor, onPick: replay.picking ? replay.pickAnchor : undefined, onCancel: replay.cancelPicking,
                  } : undefined}
                  fitContentKey={`${activeSymbol}:${timeframe}`}
                  precision={quote?.precision ?? 5}
                  theme={theme}
                  appearance={chartAppearance}
                  onSessionCursor={chartAppearance.showSessionCursor ? setSessionCursorTime : undefined}
                  timeDisplay={timeDisplay}
                  timeframe={timeframe}
                  hasDailyCloseHistory={hasDailyCloseHistory}
                  volume={quote?.synthetic || volume.mode === 'tick-delta' ? undefined : volume}
                  tickDeltaLabels={volume.tickDeltaLabels}
                  tickDelta={tickActivityOpen || volume.tickDeltaLabels.position !== 'off' ? {
                    showPane: tickActivityOpen,
                    tickDeltaView: volume.tickDeltaView, onTickDeltaViewChange: changeTickDeltaView,
                    tickDeltaLines: volume.tickDeltaLines, onToggleTickDeltaLine: toggleTickDeltaLine,
                    tickDeltaAxis: volume.tickDeltaAxis, onTickDeltaAxisChange: changeTickDeltaAxis,
                    symbol: activeSymbol, timeframe, synthetic: quote?.synthetic === true, canRank: brokerId === 'Pepperstone-Demo',
                    connected: bridge.connected, generation: bridge.generation, upColor: volume.upColor, downColor: volume.downColor,
                    totalTicksColor: volume.totalTicksColor, tickDeltaColor: volume.tickDeltaColor,
                    redCandleDivergenceColor: volume.redCandleDivergenceColor, greenCandleDivergenceColor: volume.greenCandleDivergenceColor,
                    tickDeltaDotsVisible: volume.tickDeltaDotsVisible, totalTicksDotsVisible: volume.totalTicksDotsVisible,
                  } : undefined}
                  volumeProfile={volumeProfileEnabled ? {
                    symbol: activeSymbol, scope: `${brokerId}:${bridge.generation}:${activeSymbol}`, generation: bridge.generation, precision: quote?.precision ?? 5,
                    connected: bridge.connected, brokerOffset: brokerOffsetSeconds, replayEnd: replay.end, replaySeekRevision: replay.seekRevision,
                    drawingActive: Boolean(activeDrawingTool || wildcards.placing || wildcards.editor || replay.picking),
                    onStartDrawing: () => { selectCrosshair(); wildcards.setPlacing(false) },
                    preferences: volumeProfile, onChangePreferences: changeVolumeProfile,
                    onArmProfile: !replaying && bridge.connected ? armFromProfile : undefined,
                  } : undefined}
                  marketStructure={marketStructure}
                  atr={atr}
                  onChangeVolumeAxis={changeVolumeAxis}
                  onToggleVolumeLayer={toggleVolumeLayer}
                  rsi={rsi}
                  macro={macro}
                  onToggleMacroMetric={toggleMacroSeries}
                  onToggleMacroForecast={toggleMacroForecastSeries}
                  onToggleMacroNumbers={toggleMacroNumberSeries}
                  onChangeMacroPreferences={changeMacro}
                  onSelectMacroMetric={selectMacroSeries}
                  onInspectMacroRelease={inspectMacroRelease}
                  refocusRequest={refocusRequest}
                  activeDrawingTool={replaying || replay.picking ? null : activeDrawingTool}
                  drawings={drawings}
                  selectedDrawingId={selectedDrawingId}
                  onSelectDrawing={setSelectedDrawingId}
                  onCreateDrawing={createDrawing}
                  onUpdateDrawingPoint={updateDrawingPoint}
                  onUpdateDrawingPoints={updateDrawingPoints}
                  onDrawingDragChange={changeTrendDrag}
                  onUpdatePositionWidth={updatePositionWidth}
                  onUpdateDrawingText={updateDrawingText}
                  onDeleteDrawing={handleDeleteDrawing}
                  onExitDrawingMode={exitDrawingMode}
                  onDataApplied={recordChartData}
                  onChartTrace={recordChartTrace}
                  hasOlderData={!marketData.chartHistoryComplete}
                  isLoadingOlderData={marketData.chartHistoryLoading}
                  onRequestOlderData={marketData.requestOlderBars}
                  renderChartOverlay={replaying || replay.picking ? undefined : renderChartWithLedger}
                />
              </MarketChartErrorBoundary>
              <MarketDataNotice status={marketData.chartStatus} symbol={activeSymbol} timeframe={timeframe} error={marketData.chartError} />
              {marketData.chartStatus === 'live' && marketData.chartHistoryLoading && (
                <CandleHistoryLoadingNotice symbol={activeSymbol} timeframe={timeframe} />
              )}
              {drawingToolbarVisible && !replaying && (
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
                <span>{timeframe} · {replaying ? 'Replay' : quote?.synthetic ? 'Synthetic index'
                  : marketData.chartStatus === 'live' ? 'MT5 broker data' : 'Awaiting MT5 data'}</span>
              </div>
            </div>
            {recentEventsOpen && <RecentEventsPanel brokerId={brokerId} symbol={activeSymbol} onClose={closeRecentEvents} />}
            {rankingOpen && <aside id="heatmap-ranking-panel" className="heatmap-ranking-slot" aria-label="Heatmap Ranking" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();closeRanking()}}}>
              <header><strong>Heatmap Ranking</strong><button type="button" aria-label="Close Heatmap Ranking" autoFocus onClick={closeRanking}>×</button></header>
              <div ref={setRankingTarget}/>
            </aside>}
            {detailOpen && <CurrencyDetailPanel brokerId={brokerId} symbol={activeSymbol} onClose={closeDetail} />}
            {newsOpen && <NewsFlowPanel onClose={closeNews} />}
          </div>
        </section>
      </main>

      {(bottomDockWindow || heatmapStarted) && (
        <BottomDockPanel
          resizeHandle={dockSize.resizeHandle}
          hidden={!bottomDockWindow}
        >
          {heatmapStarted && <div className="heatmap-slot" hidden={bottomDockWindow !== 'heatmap'}>
            <HeatmapDock symbols={marketData.symbols} broker={brokerId} generation={bridge.generation} active={bottomDockWindow === 'heatmap' || rankingOpen} dockActive={bottomDockWindow === 'heatmap'} rankingTarget={rankingTarget} onCloseRanking={closeRanking} onOpenNews={showHeatmapNews} onOpenRow={openHeatmapInstrument} connected={bridge.connected} />
          </div>}
          {bottomDockWindow === 'wildcards' && <WildcardsDock />}
          {bottomDockWindow === 'replay' && <ChartReplayDock source={bars} replay={replay}
            historyLoading={marketData.chartHistoryLoading} hasEarlier={!marketData.chartHistoryComplete}
            loadEarlier={marketData.requestOlderBars} onPickStart={() => {
              selectCrosshair(); wildcards.setPlacing(false); replay.startPicking()
            }} />}
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
        sourceSymbolCount={marketData.brokerSymbols.length}
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
      {volumeSettingsOpen && <VolumeSettingsDialog preferences={volume} synthetic={quote?.synthetic} onSave={changeVolume} onClose={closeVolumeSettings} />}
      {volumeProfileSettingsOpen && <VolumeProfileSettingsDialog preferences={volumeProfile} preloadTimeout={chartAppearance.vpPreloadTimeout}
        symbol={activeSymbol} connected={bridge.connected} brokerOffset={brokerOffsetSeconds}
        onSave={setVolumeProfile} onClose={closeVolumeProfileSettings} />}
      {marketStructureSettingsOpen && <MarketStructureSettingsDialog preferences={marketStructure} onSave={changeMarketStructure} onClose={closeMarketStructureSettings} />}
      {atrSettingsOpen && <AtrSettingsDialog preferences={atr} onSave={changeAtr} onClose={closeAtrSettings} />}
      {macroSettingsOpen && supportsMacro(activeSymbol) && <MacroSettingsDialog preferences={macroPreferences} onSave={changeMacro} onClose={closeMacroSettings} />}
      {rsiSettingsOpen && <RsiSettingsDialog preferences={rsi} onSave={changeRsi} onClose={closeRsiSettings} />}
    </div>
    </LedgerProvider>
    </DisplayClockProvider>
  )
}
