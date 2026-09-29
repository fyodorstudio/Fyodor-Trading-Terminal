import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowResultPanel } from '../criterion/arrow-result/ArrowResultPanel'
import { auditNoteKey, readAuditNotes, writeAuditNotes, type AuditNote } from '../criterion/arrow-result/audit-notes'
import reportManifest from '../criterion/report-manifest.json'
import {
  cleanPanel, researchPriceLevels, snapshotAround, validateSelection,
  type ResearchAuditData, type ResearchEpisode, type ResearchRule, type ResearchTrial,
} from '../criterion/audit-data'
import { readColorTheme, type ColorTheme } from '../appearance/color-theme/color-theme-preference'
import {
  readTimeDisplayPreference,
  saveTimeDisplayPreference,
  timeDisplayLabel,
  type TimeDisplayPreference,
} from '../appearance/time-display/time-display-preference'
import { EconomicCalendarMarkers } from '../economic-calendar/calendar-dock/EconomicCalendarMarkers'
import { EconomicCalendarPanel } from '../economic-calendar/calendar-dock/EconomicCalendarPanel'
import type { CalendarRangePreset } from '../economic-calendar/calendar-dock/calendar-display-range'
import { useMt5EconomicCalendar } from '../economic-calendar/mt5-calendar/use-mt5-economic-calendar'
import { MarketCandlestickChart } from '../market-data/candlestick-chart/MarketCandlestickChart'
import { MarketChartErrorBoundary } from '../market-data/candlestick-chart/MarketChartErrorBoundary'
import { FloatingDrawingToolbar } from '../market-data/chart-drawings/FloatingDrawingToolbar'
import type { ChartDrawingPoint } from '../market-data/chart-drawings/chart-drawing-record'
import type { ChartDrawingRecord } from '../market-data/chart-drawings/chart-drawing-record'
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
import { PlannedTradePriceLines, type ResearchChartArrow } from '../trader-notebook/chart-levels/PlannedTradePriceLines'
import type { PlannedTradeState, RegisteredTradeArrow } from '../trader-notebook/contracts/trader-notebook-types'
import { TraderNotebookPanel } from '../trader-notebook/notebook-dock/TraderNotebookPanel'
import { useRegisteredArrows } from '../trader-notebook/storage/use-registered-arrows'
import { BottomDockPanel } from '../workspace-docking/bottom-dock/BottomDockPanel'
import type { BottomDockWindow } from '../workspace-docking/bottom-dock/bottom-dock-window'
import { LeftDockPanel } from '../workspace-docking/left-dock/LeftDockPanel'
import type { LeftDockWindow } from '../workspace-docking/left-dock/left-dock-window'
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
const researchTimeDisplay: TimeDisplayPreference = { mode: 'utc', utcOffsetMinutes: 0 }
const hiddenTradePlan: PlannedTradeState = { ...defaultTradePlan, showOnChart: false }
const noDrawings: ChartDrawingRecord[] = []
const noRegisteredArrows: RegisteredTradeArrow[] = []
const noResearchArrows: ResearchChartArrow[] = []
const noOp = () => undefined

export function FyodorTerminalShell() {
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('H4')
  const [theme, setTheme] = useState<ColorTheme>(readColorTheme)
  const [chartAppearance, setChartAppearance] = useState<ChartAppearance>(readChartAppearance)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplayPreference>(readTimeDisplayPreference)
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolId | null>(null)
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [bottomDockWindow, setBottomDockWindow] = useState<BottomDockWindow | null>('notebook')
  const [leftDockWindow, setLeftDockWindow] = useState<LeftDockWindow>('market-watch')
  const [researchData, setResearchData] = useState<ResearchAuditData | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)
  const [researchRule, setResearchRule] = useState<ResearchRule>({
    family: 'CPI', signal: 'af', panel: cleanPanel('CPI'), cohort: 'ALL_ELIGIBLE',
    horizon: 60, stop: 1, target: 1,
  })
  const [auditSelection, setAuditSelection] = useState<{ episode: ResearchEpisode; trial: ResearchTrial } | null>(null)
  const [auditNotes, setAuditNotes] = useState<AuditNote[]>(readAuditNotes)
  const [auditNoteSaveFailed, setAuditNoteSaveFailed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { entries, appendActivity, clearActivity } = useActivityLog()

  useEffect(() => {
    if (leftDockWindow !== 'criterion' || researchData || researchError) return
    const controller = new AbortController()
    void fetch('/criterion/eurusd_cpi_nfp_v2.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Research snapshot unavailable (HTTP ${response.status})`)
        return response.json() as Promise<ResearchAuditData>
      })
      .then((payload) => {
        if (payload.schema !== 1 || payload.pair !== 'EURUSD' || payload.status !== 'HISTORICAL_EXPLORATION_ONLY'
            || payload.viewerSha256 !== reportManifest.reportSha256
            || payload.selectionPolicy !== 'NONE' || !payload.families.CPI || !payload.families.NFP) {
          throw new Error('Research snapshot does not match the approved CPI/NFP exploration contract')
        }
        setResearchData(payload)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResearchError(error instanceof Error ? error.message : 'Research snapshot could not be read')
      })
    return () => controller.abort()
  }, [leftDockWindow, researchData, researchError])

  const researchSelection = useMemo(() => {
    if (!researchData) return { summary: null, trials: [] as ResearchTrial[], error: null as string | null }
    try {
      return { ...validateSelection(researchData, researchRule), error: null }
    } catch (error) {
      return { summary: null, trials: [] as ResearchTrial[], error: error instanceof Error ? error.message : 'Research selection failed' }
    }
  }, [researchData, researchRule])
  const auditBars = useMemo(() => {
    if (!researchData || !auditSelection) return null
    try { return snapshotAround(researchData, auditSelection.episode.entryTime, researchRule.horizon) }
    catch { return null }
  }, [researchData, auditSelection, researchRule.horizon])
  const auditMode = Boolean(auditSelection && auditBars)
  const auditLevels = useMemo(() => auditSelection ? researchPriceLevels(auditSelection.episode, researchRule) : null,
    [auditSelection, researchRule])
  const currentAuditNote = auditSelection && researchData ? auditNotes.find((note) =>
    auditNoteKey(note.viewerSha256, note.family, note.signal, note.episodeId)
      === auditNoteKey(researchData.viewerSha256, researchRule.family, researchRule.signal, auditSelection.episode.id),
  ) ?? null : null
  const currentDatasetNotes = researchData ? auditNotes.filter((note) => note.viewerSha256 === researchData.viewerSha256) : []
  const researchArrows = useMemo((): ResearchChartArrow[] => {
    if (!researchData || !auditBars) return []
    const first = Number(auditBars[0]?.time)
    const last = Number(auditBars[auditBars.length - 1]?.time)
    const family = researchData.families[researchRule.family]
    return researchSelection.trials.map((trial) => family.episodes[trial[0]])
      .filter((episode) => episode.entryTime >= first && episode.entryTime <= last)
      .map((episode) => ({
        id: `research:${episode.id}`, time: episode.entryTime,
        entryPrice: episode.entryPrice,
        direction: episode[researchRule.signal].direction > 0 ? 'long' : 'short',
      }))
  }, [researchData, researchRule, researchSelection.trials, auditBars])

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
  const calendar = useMt5EconomicCalendar(
    bridge.reachable,
    bridge.health?.calendar ?? null,
    bottomDockWindow === 'calendar',
  )
  const activeSymbol = marketData.activeSymbol
  const quote = marketData.symbols.find((item) => item.symbol === activeSymbol) ?? null
  const bars = marketData.bars
  const chartBars = auditBars ?? bars
  const chartSymbol = auditMode ? 'EURUSD' : activeSymbol
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

  const [highlightedCalendarEventId, setHighlightedCalendarEventId] = useState<string | null>(null)
  const [calendarRangePreset, setCalendarRangePreset] = useState<CalendarRangePreset>('this-week')

  const handleDeleteDrawing = useCallback((drawingId: string) => {
    deleteDrawing(drawingId)
    if (selectedDrawingId === drawingId) setSelectedDrawingId(null)
    appendActivity('Drawing', 'Drawing deleted', `${activeSymbol} ${timeframe}`)
  }, [activeSymbol, appendActivity, deleteDrawing, selectedDrawingId, timeframe])

  const leaveResearchAudit = () => {
    setAuditSelection(null)
    setBottomDockWindow((current) => current === 'arrow-result' ? 'notebook' : current)
  }

  const selectSymbol = (symbol: string) => {
    if (symbol === selectedSymbol) return
    leaveResearchAudit()
    setSelectedSymbol(symbol)
    setSelectedDrawingId(null)
    appendActivity('Market Watch', 'Symbol selected', symbol)
  }

  const selectTimeframe = (nextTimeframe: ChartTimeframe) => {
    if (auditMode && nextTimeframe !== 'H1') return
    if (nextTimeframe === timeframe) return
    setTimeframe(nextTimeframe)
    setSelectedDrawingId(null)
    appendActivity('Chart', 'Timeframe selected', `${activeSymbol} ${nextTimeframe}`)
  }

  const selectResearchEpisode = (episode: ResearchEpisode, trial: ResearchTrial) => {
    if (!researchData || !researchSelection.trials.includes(trial)) return
    setSelectedSymbol('EURUSD')
    setTimeframe('H1')
    setActiveDrawingTool(null)
    setSelectedDrawingId(null)
    setAuditSelection({ episode, trial })
    setBottomDockWindow('arrow-result')
  }

  const changeResearchRule = (rule: ResearchRule) => {
    setResearchRule(rule)
    leaveResearchAudit()
  }

  const selectResearchArrow = (arrow: ResearchChartArrow) => {
    if (!researchData) return
    const family = researchData.families[researchRule.family]
    const trial = researchSelection.trials.find((item) => `research:${family.episodes[item[0]].id}` === arrow.id)
    if (trial) selectResearchEpisode(family.episodes[trial[0]], trial)
  }

  const saveAuditNote = (text: string) => {
    if (!auditSelection || !researchData) return
    const key = auditNoteKey(researchData.viewerSha256, researchRule.family, researchRule.signal, auditSelection.episode.id)
    const next = auditNotes.filter((note) => auditNoteKey(note.viewerSha256, note.family, note.signal, note.episodeId) !== key)
    if (text.trim()) next.push({
      viewerSha256: researchData.viewerSha256,
      family: researchRule.family,
      signal: researchRule.signal,
      episodeId: auditSelection.episode.id,
      releaseText: auditSelection.episode.releaseText,
      rule: researchRule,
      text,
      updatedAt: new Date().toISOString(),
    })
    setAuditNotes(next)
    setAuditNoteSaveFailed(!writeAuditNotes(next))
  }

  const openSavedAuditNote = (note: AuditNote) => {
    if (!researchData || note.viewerSha256 !== researchData.viewerSha256) return
    try {
      const { trials } = validateSelection(researchData, note.rule)
      const episode = researchData.families[note.family].episodes.find((item) => item.id === note.episodeId)
      const trial = episode && trials.find((item) => researchData.families[note.family].episodes[item[0]].id === episode.id)
      if (!episode || !trial) return
      setResearchRule(note.rule)
      setSelectedSymbol('EURUSD')
      setTimeframe('H1')
      setActiveDrawingTool(null)
      setSelectedDrawingId(null)
      setAuditSelection({ episode, trial })
      setBottomDockWindow('arrow-result')
    } catch {
      setResearchError('A saved note references a research rule that no longer reconciles to the pinned snapshot.')
    }
  }

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
  const calendarStatus = bridge.reachable
    ? calendar.source?.status ?? bridge.health?.calendar.status ?? 'waiting'
    : 'unavailable'

  return (
    <div className={`terminal-shell${bottomDockWindow ? ' bottom-dock-open' : ''}`}>
      <main className="terminal-workspace">
        <LeftDockPanel
          symbols={marketData.symbols}
          selectedSymbol={activeSymbol}
          marketWatchStatus={marketData.marketWatchStatus}
          marketWatchError={marketData.marketWatchError}
          onSelectSymbol={selectSymbol}
          activeWindow={leftDockWindow}
          onSelectWindow={setLeftDockWindow}
          criterionData={researchData}
          criterionError={researchError ?? researchSelection.error}
          criterionRule={researchRule}
          criterionSummary={researchSelection.summary}
          criterionTrials={researchSelection.trials}
          selectedResearchEpisodeId={auditSelection?.episode.id ?? null}
          savedAuditNotes={currentDatasetNotes}
          onOpenSavedAuditNote={openSavedAuditNote}
          onCriterionRuleChange={changeResearchRule}
          onSelectResearchEpisode={selectResearchEpisode}
        />

        <section className="chart-workspace" aria-label={`${chartSymbol} chart workspace`}>
          <ChartWorkspaceHeader symbol={chartSymbol} quote={quote} timeframe={timeframe} onSelectTimeframe={selectTimeframe} researchAudit={auditMode} />
          <div className="chart-frame">
            {auditMode && <div className="research-chart-banner">
              <strong>HISTORICAL RESEARCH SNAPSHOT · NOT LIVE</strong>
              <span>{auditSelection?.episode.releaseText} · EURUSD H1 · H{researchRule.horizon} after entry + up to 120 prior H1 for context</span>
              <button type="button" onClick={leaveResearchAudit}>Return to live</button>
            </div>}
            <MarketChartErrorBoundary
              symbol={chartSymbol}
              timeframe={timeframe}
              onError={(error) => appendActivity('Chart', 'Chart error caught', error.message, { severity: 'error' })}
            >
              <MarketCandlestickChart
                bars={chartBars}
                fitContentKey={auditMode ? `research:${auditSelection?.episode.id}:H${researchRule.horizon}` : `${activeSymbol}:${timeframe}`}
                precision={quote?.precision ?? 5}
                theme={theme}
                appearance={chartAppearance}
                timeDisplay={auditMode ? researchTimeDisplay : timeDisplay}
                timeframe={timeframe}
                activeDrawingTool={auditMode ? null : activeDrawingTool}
                drawings={auditMode ? noDrawings : drawings}
                selectedDrawingId={auditMode ? null : selectedDrawingId}
                onSelectDrawing={setSelectedDrawingId}
                onCreateDrawing={createDrawing}
                onUpdateDrawingPoint={updateDrawingPoint}
                onUpdateDrawingPoints={updateDrawingPoints}
                onUpdatePositionWidth={updatePositionWidth}
                onUpdateDrawingText={updateDrawingText}
                onDeleteDrawing={handleDeleteDrawing}
                onExitDrawingMode={() => setActiveDrawingTool(null)}
                onDataApplied={auditMode ? noOp : recordChartData}
                hasOlderData={!auditMode && !marketData.chartHistoryComplete}
                isLoadingOlderData={!auditMode && marketData.chartHistoryLoading}
                onRequestOlderData={auditMode ? noOp : marketData.requestOlderBars}
                renderChartOverlay={(_chartApi, seriesApi) => (
                  <>
                    <PlannedTradePriceLines
                      chartApi={_chartApi}
                      seriesApi={seriesApi}
                      arrows={auditMode ? noRegisteredArrows : registeredArrows.symbolArrows}
                      selectedArrowId={auditMode ? null : registeredArrows.selectedArrowId}
                      researchArrows={auditMode ? researchArrows : noResearchArrows}
                      selectedResearchArrowId={auditMode ? `research:${auditSelection?.episode.id}` : null}
                      researchLevels={auditMode ? auditLevels : null}
                      onSelectResearchArrow={selectResearchArrow}
                      draftPlan={auditMode ? hiddenTradePlan : plannedTrade}
                      onSelectArrow={(arrow) => {
                        registeredArrows.setSelectedArrowId(arrow.id)
                        setBottomDockWindow('notebook')
                      }}
                    />
                    {!auditMode && <EconomicCalendarMarkers
                      chartApi={_chartApi}
                      seriesApi={seriesApi}
                      symbol={activeSymbol}
                      bars={bars}
                      events={calendar.events}
                      rangePreset={calendarRangePreset}
                      timeDisplay={timeDisplay}
                      clockOffsetMs={bridge.clockOffsetMs}
                      onSelectEvent={(event) => {
                        setBottomDockWindow('calendar')
                        setHighlightedCalendarEventId(event.value_id)
                      }}
                    />}
                  </>
                )}
              />
            </MarketChartErrorBoundary>
            {!auditMode && <MarketDataNotice status={marketData.chartStatus} symbol={activeSymbol} timeframe={timeframe} error={marketData.chartError} />}
            {!auditMode && marketData.chartStatus === 'live' && marketData.chartHistoryLoading && (
              <CandleHistoryLoadingNotice symbol={activeSymbol} timeframe={timeframe} />
            )}
            {!auditMode && <FloatingDrawingToolbar
              activeTool={activeDrawingTool}
              drawingCount={totalDrawingCount}
              onSelectCrosshair={selectCrosshair}
              onToolChange={chooseDrawingTool}
              onClearAll={deleteAllDrawings}
            />}
            <div className="chart-watermark" aria-hidden="true">
              <strong>{chartSymbol}</strong>
              <span>{auditMode ? 'H1 · pinned historical export' : `${timeframe} · ${marketData.chartStatus === 'live' ? 'MT5 broker data' : 'Awaiting MT5 data'}`}</span>
            </div>
          </div>
        </section>
      </main>

      {bottomDockWindow && (
        <BottomDockPanel
          activeWindow={bottomDockWindow}
          activityCount={entries.length}
          selectedSymbol={activeSymbol}
          hasResearchSelection={auditMode}
          onSelectWindow={setBottomDockWindow}
          onClose={() => setBottomDockWindow(null)}
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
            <ActivityLogPanel
              entries={entries}
              timeDisplay={timeDisplay}
              onClear={clearActivity}
              heartbeat={(
                <DataHeartbeatPanel
                  health={bridge.health}
                  reachable={bridge.reachable}
                  lastContactAt={bridge.lastContactAt}
                  roundTripMs={bridge.roundTripMs}
                  probeStartedAt={bridge.probeStartedAt}
                />
              )}
            />
          )}
          {bottomDockWindow === 'calendar' && (
            <EconomicCalendarPanel
              events={calendar.events}
              source={calendar.source}
              error={calendar.error}
              clockOffsetMs={bridge.clockOffsetMs}
              timeDisplay={timeDisplay}
              highlightedEventId={highlightedCalendarEventId}
              rangePreset={calendarRangePreset}
              onRangePresetChange={setCalendarRangePreset}
            />
          )}
          {bottomDockWindow === 'arrow-result' && (
            <ArrowResultPanel key={`${researchRule.family}:${researchRule.signal}:${auditSelection?.episode.id ?? ''}`}
              episode={auditSelection?.episode ?? null} trial={auditSelection?.trial ?? null}
              rule={researchRule} note={currentAuditNote?.text ?? ''} notes={currentDatasetNotes}
              saveFailed={auditNoteSaveFailed} onNoteChange={saveAuditNote}
              onReturnLive={leaveResearchAudit} />
          )}
        </BottomDockPanel>
      )}

      <TerminalStatusBar
        sourceState={sourceState}
        sourceLabel={sourceLabel}
        sourceSymbolCount={marketData.symbols.length}
        selectedSymbol={activeSymbol}
        timeframe={timeframe}
        barCount={chartBars.length}
        activityCount={entries.length}
        bottomDockWindow={bottomDockWindow}
        hasResearchSelection={auditMode}
        settingsOpen={settingsOpen}
        calendarStatus={calendarStatus}
        calendarEventCount={calendar.events.length}
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
