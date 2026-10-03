import { useCallback, useEffect, useMemo, useState } from 'react'
import { BaselineResultPanel } from '../criterion/arrow-result/BaselineResultPanel'
import { CpiBundleResultPanel } from '../criterion/arrow-result/CpiBundleResultPanel'
import { TimelineResultPanel } from '../criterion/arrow-result/TimelineResultPanel'
import { auditNoteKey, readAuditNotes, writeAuditNotes, type AuditNote } from '../criterion/arrow-result/audit-notes'
import type { CriterionStudyId } from '../criterion/criterion-dock/CriterionPanel'
import reportManifest from '../criterion/report-manifest.json'
import bundleManifest from '../criterion/cpi-bundle-manifest.json'
import timelineManifest from '../criterion/cpi-event-timeline-manifest.json'
import {
  fetchTimelineIndex,
  fetchTimelineEpisode,
  fetchTimelineTradeLevels,
  findRowTradeLevels,
  deriveChartLevels,
  type CpiTimelineIndex,
  type CpiTimelineEpisodePayload,
  type EvaluatedTradeLevel,
  type TimelineChartLevels,
} from '../criterion/timeline/cpi-event-timeline-data'
import type { TimelineReleaseBlock, TimelineSeriesRow } from '../criterion/timeline/CpiEventTimelineTable'
import {
  availableTrials, cleanPanel, researchPriceLevels, snapshotAround, validateSelection,
  type PriorContextBars, type ResearchAuditData, type ResearchEpisode, type ResearchRule, type ResearchTrial,
} from '../criterion/audit-data'
import { deriveBundleChartArrows, deriveBundlePriceLevels, deriveNextBundleSelection,
  getBundleEpisodeInclusion, validateBundleSelection,
  type BundleEpisode, type BundleRule, type BundleSnapshot, type BundleTrial } from '../criterion/cpi-bundle-data'
import { applyColorTheme, readColorTheme, type ColorTheme } from '../appearance/color-theme/color-theme-preference'
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
  const [criterionStudy, setCriterionStudy] = useState<CriterionStudyId>('timeline')
  const [bundleData, setBundleData] = useState<BundleSnapshot | null>(null)
  const [bundleError, setBundleError] = useState<string | null>(null)
  const [bundleRule, setBundleRule] = useState<BundleRule>({
    comparison: 'CANDIDATE_1_HEADLINE_MM', panel: 'FULL_PANEL', horizon: 60, stop: 1, target: 1,
  })
  const [bundleSelection, setBundleSelection] = useState<{ episode: BundleEpisode; trial: BundleTrial | null } | null>(null)
  const [researchRule, setResearchRule] = useState<ResearchRule>({
    family: 'CPI', signal: 'af', panel: cleanPanel('CPI'), cohort: 'ALL_ELIGIBLE',
    horizon: 60, stop: 1, target: 1,
  })
  const [auditSelection, setAuditSelection] = useState<{ episode: ResearchEpisode; trial: ResearchTrial | null } | null>(null)
  const [priorContextBars, setPriorContextBars] = useState<PriorContextBars>(240)
  const [auditRuleError, setAuditRuleError] = useState<string | null>(null)
  const [auditNotes, setAuditNotes] = useState<AuditNote[]>(readAuditNotes)
  const [auditNoteSaveFailed, setAuditNoteSaveFailed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { entries, appendActivity, clearActivity } = useActivityLog()

  // Timeline states
  const [timelineIndex, setTimelineIndex] = useState<CpiTimelineIndex | null>(null)
  const [timelineIndexLoading, setTimelineIndexLoading] = useState(false)
  const [timelineIndexError, setTimelineIndexError] = useState<string | null>(null)
  const [timelineIndexRetryToken, setTimelineIndexRetryToken] = useState(0)

  const [selectedTimelineEpisodeId, setSelectedTimelineEpisodeId] = useState<string | null>(null)
  const [timelineEpisodePayload, setTimelineEpisodePayload] = useState<CpiTimelineEpisodePayload | null>(null)
  const [timelineEpisodeLoading, setTimelineEpisodeLoading] = useState(false)
  const [timelineEpisodeError, setTimelineEpisodeError] = useState<string | null>(null)
  const [timelineEpisodeRetryToken, setTimelineEpisodeRetryToken] = useState(0)

  const [timelineTradeLevels, setTimelineTradeLevels] = useState<Record<string, EvaluatedTradeLevel> | null>(null)
  const [selectedTimelineRowKey, setSelectedTimelineRowKey] = useState<string | null>(null)
  const [selectedTimelineLevels, setSelectedTimelineLevels] = useState<TimelineChartLevels | null>(null)

  const handleRetryTimelineIndex = useCallback(() => {
    setTimelineIndexError(null)
    setTimelineIndexRetryToken((count) => count + 1)
  }, [])

  const handleRetryTimelineEpisode = useCallback(() => {
    setTimelineEpisodeError(null)
    setTimelineEpisodeRetryToken((count) => count + 1)
  }, [])

  useEffect(() => {
    applyColorTheme(theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-scrollbar', chartAppearance.scrollbarStyle ?? 'adaptive')
  }, [chartAppearance.scrollbarStyle])

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

  useEffect(() => {
    if (leftDockWindow !== 'criterion' || criterionStudy !== 'timeline') return
    if (timelineIndex && timelineTradeLevels) return
    if (timelineIndexError) return

    let cancelled = false
    const controller = new AbortController()

    queueMicrotask(() => {
      if (!cancelled && !controller.signal.aborted) {
        setTimelineIndexLoading(true)
      }
    })

    Promise.all([
      fetchTimelineIndex(controller.signal),
      fetchTimelineTradeLevels(controller.signal),
    ])
      .then(([idx, levels]) => {
        if (cancelled || controller.signal.aborted) return
        setTimelineIndex(idx)
        setTimelineTradeLevels(levels)
        setTimelineIndexLoading(false)
        setTimelineIndexError(null)
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return
        setTimelineIndexError(err instanceof Error ? err.message : 'Failed to load timeline index')
        setTimelineIndexLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      setTimelineIndexLoading(false)
    }
  }, [leftDockWindow, criterionStudy, timelineIndex, timelineTradeLevels, timelineIndexError, timelineIndexRetryToken])

  useEffect(() => {
    if (!selectedTimelineEpisodeId || criterionStudy !== 'timeline') {
      queueMicrotask(() => {
        setTimelineEpisodePayload(null)
        setSelectedTimelineRowKey(null)
        setSelectedTimelineLevels(null)
        setTimelineEpisodeLoading(false)
        setTimelineEpisodeError(null)
      })
      return
    }

    if (timelineEpisodeError) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const targetEpisodeId = selectedTimelineEpisodeId

    queueMicrotask(() => {
      if (!cancelled && !controller.signal.aborted) {
        // Clear previous episode payload, selected row and levels immediately when switching
        setTimelineEpisodePayload(null)
        setSelectedTimelineRowKey(null)
        setSelectedTimelineLevels(null)
        setTimelineEpisodeError(null)
        setTimelineEpisodeLoading(true)
      }
    })

    fetchTimelineEpisode(targetEpisodeId, controller.signal)
      .then((payload) => {
        // Ignore completions from cancelled or superseded requests,
        // including completions after response retrieval/hash verification.
        if (cancelled || controller.signal.aborted || targetEpisodeId !== selectedTimelineEpisodeId) {
          return
        }
        if (payload.episodeId !== targetEpisodeId) {
          return
        }

        setTimelineEpisodePayload(payload)
        setTimelineEpisodeLoading(false)
        setTimelineEpisodeError(null)

        // Default selection to first anchor CPI row
        const firstRow = payload.cpiBlock?.rows?.[0]
        if (firstRow) {
          const key = `${payload.cpiBlock.id}:${firstRow.series}:0`
          setSelectedTimelineRowKey(key)
          const lev = findRowTradeLevels(timelineTradeLevels, payload.episodeId, payload.cpiBlock, firstRow)
          const derived = deriveChartLevels(lev, payload.cpiBlock.entryTimestamp)
          setSelectedTimelineLevels(derived)
        } else {
          setSelectedTimelineRowKey(null)
          setSelectedTimelineLevels(null)
        }
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted || targetEpisodeId !== selectedTimelineEpisodeId) {
          return
        }
        setTimelineEpisodeError(err instanceof Error ? err.message : 'Failed to load episode payload')
        setTimelineEpisodeLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      setTimelineEpisodeLoading(false)
    }
  }, [
    selectedTimelineEpisodeId,
    criterionStudy,
    timelineTradeLevels,
    timelineEpisodeError,
    timelineEpisodeRetryToken,
  ])

  useEffect(() => {
    if (leftDockWindow !== 'criterion' || (criterionStudy !== 'bundle' && criterionStudy !== 'experimental') || !researchData || bundleData || bundleError) return
    const controller = new AbortController()
    void fetch(bundleManifest.snapshotPath, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`CPI bundle snapshot unavailable (HTTP ${response.status})`)
        const raw = await response.text()
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
        const actualHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
        if (actualHash !== bundleManifest.snapshotSha256) throw new Error('CPI bundle snapshot hash differs from its published manifest')
        return JSON.parse(raw) as BundleSnapshot
      })
      .then((payload) => {
        if (payload.schema !== 1 || payload.pair !== bundleManifest.pair || payload.study !== bundleManifest.study
            || payload.run !== bundleManifest.run || payload.status !== bundleManifest.status
            || payload.selectionPolicy !== 'NONE' || payload.sourceSha256 !== bundleManifest.sourceTrialSha256
            || !payload.episodes?.length
            || payload.candlesSha256.toLowerCase() !== researchData.candlesSha256.toLowerCase()) {
          throw new Error('CPI bundle snapshot does not match the pinned chart-audit contract')
        }
        setBundleData(payload)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setBundleError(error instanceof Error ? error.message : 'CPI bundle snapshot could not be read')
      })
    return () => controller.abort()
  }, [leftDockWindow, criterionStudy, bundleData, bundleError, researchData])

  const researchSelection = useMemo(() => {
    if (!researchData) return { summary: null, trials: [] as ResearchTrial[], error: null as string | null }
    try {
      return { ...validateSelection(researchData, researchRule), error: null }
    } catch (error) {
      return { summary: null, trials: [] as ResearchTrial[], error: error instanceof Error ? error.message : 'Research selection failed' }
    }
  }, [researchData, researchRule])
  const bundleResult = useMemo(() => {
    if (!bundleData) return { summary: null, trials: [] as BundleTrial[], error: null as string | null }
    try { return { ...validateBundleSelection(bundleData, bundleRule), error: null } }
    catch (error) { return { summary: null, trials: [] as BundleTrial[],
      error: error instanceof Error ? error.message : 'CPI bundle selection failed' } }
  }, [bundleData, bundleRule])
  const auditEpisode = auditSelection?.episode
  const legacyAuditBars = useMemo(() => {
    if (!researchData || !auditEpisode) return null
    try { return snapshotAround(researchData, auditEpisode.entryTime, researchRule.horizon, priorContextBars) }
    catch { return null }
  }, [researchData, auditEpisode, researchRule.horizon, priorContextBars])
  const bundleAuditBars = useMemo(() => {
    const entry = bundleSelection?.episode.entryTime
    if (!researchData || !entry) return null
    try { return snapshotAround(researchData, entry, bundleRule.horizon, priorContextBars) }
    catch { return null }
  }, [researchData, bundleSelection, bundleRule.horizon, priorContextBars])
  const timelineAuditBars = useMemo(() => {
    const entry = timelineEpisodePayload?.cpiBlock.entryTimestamp
    if (!researchData || !entry) return null
    try { return snapshotAround(researchData, entry, 240, priorContextBars) }
    catch { return null }
  }, [researchData, timelineEpisodePayload, priorContextBars])
  const auditBars = criterionStudy === 'timeline' ? timelineAuditBars : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleAuditBars : criterionStudy === 'baseline' ? legacyAuditBars : null
  const auditMode = Boolean(((criterionStudy === 'timeline' ? selectedTimelineEpisodeId && timelineEpisodePayload : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleSelection : criterionStudy === 'baseline' ? auditSelection : null) && auditBars))
  const auditLevels = useMemo(() => auditSelection?.trial ? researchPriceLevels(auditSelection.episode, researchRule) : null,
    [auditSelection, researchRule])
  const bundleLevels = useMemo(() => {
    if (!bundleData || !bundleSelection) return null
    if (criterionStudy === 'experimental') {
      if (!bundleSelection.trial || bundleSelection.episode.entryPrice == null || bundleSelection.episode.atr == null) return null
      return {
        entry: bundleSelection.episode.entryPrice,
        stop: bundleSelection.episode.entryPrice - bundleSelection.trial[1] * bundleRule.stop * bundleSelection.episode.atr,
        target: bundleSelection.episode.entryPrice + bundleSelection.trial[1] * bundleRule.target * bundleSelection.episode.atr,
        direction: bundleSelection.trial[1],
      }
    }
    return deriveBundlePriceLevels(bundleData, bundleRule, bundleSelection)
  }, [bundleSelection, bundleData, bundleRule, criterionStudy])
  const timelineLevels = useMemo(() => {
    if (!selectedTimelineLevels) return null
    return {
      entry: selectedTimelineLevels.entryPrice,
      stop: selectedTimelineLevels.stopPrice,
      target: selectedTimelineLevels.targetPrice,
      direction: selectedTimelineLevels.direction === 'Long' ? 1 : -1,
    }
  }, [selectedTimelineLevels])
  const activeLevels = criterionStudy === 'timeline' ? timelineLevels : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleLevels : auditLevels
  const currentAuditNote = auditSelection && researchData ? auditNotes.find((note) =>
    auditNoteKey(note.viewerSha256, note.family, note.signal, note.episodeId)
      === auditNoteKey(researchData.viewerSha256, researchRule.family, researchRule.signal, auditSelection.episode.id),
  ) ?? null : null
  const currentDatasetNotes = researchData ? auditNotes.filter((note) => note.viewerSha256 === researchData.viewerSha256) : []
  const currentBundleNotes = bundleData ? auditNotes.filter((note) => note.viewerSha256 === bundleData.sourceSha256) : []
  const currentBundleNote = bundleSelection && bundleData ? currentBundleNotes.find((note) =>
    auditNoteKey(note.viewerSha256, note.family, note.signal, note.episodeId) ===
      auditNoteKey(bundleData.sourceSha256, 'CPI_BUNDLE', bundleRule.comparison, bundleSelection.episode.id)) ?? null : null
  const currentTimelineNotes = useMemo(() => {
    return auditNotes.filter((note) => note.family === 'CPI_TIMELINE')
  }, [auditNotes])
  const currentTimelineNote = useMemo(() => {
    if (!selectedTimelineEpisodeId) return null
    return currentTimelineNotes.find((note) => note.episodeId === selectedTimelineEpisodeId) ?? null
  }, [selectedTimelineEpisodeId, currentTimelineNotes])
  const researchArrows = useMemo((): ResearchChartArrow[] => {
    if (!researchData || !legacyAuditBars) return []
    const first = Number(legacyAuditBars[0]?.time)
    const last = Number(legacyAuditBars[legacyAuditBars.length - 1]?.time)
    const family = researchData.families[researchRule.family]
    const visibleEpisodes = researchSelection.trials.map((trial) => family.episodes[trial[0]])
    if (auditSelection?.trial && !visibleEpisodes.some((episode) => episode.id === auditSelection.episode.id)) {
      visibleEpisodes.push(auditSelection.episode)
    }
    return visibleEpisodes
      .filter((episode) => episode.entryTime >= first && episode.entryTime <= last)
      .map((episode) => ({
        id: `research:${episode.id}`, time: episode.entryTime,
        entryPrice: episode.entryPrice,
        direction: episode[researchRule.signal].direction > 0 ? 'long' : 'short',
      }))
  }, [researchData, researchRule, researchSelection.trials, legacyAuditBars, auditSelection])
  const timelineArrows = useMemo((): ResearchChartArrow[] => {
    if (!timelineEpisodePayload || !selectedTimelineLevels) return []
    return [
      {
        id: `timeline:${timelineEpisodePayload.episodeId}`,
        time: selectedTimelineLevels.entryTimestamp,
        entryPrice: selectedTimelineLevels.entryPrice,
        direction: selectedTimelineLevels.direction === 'Long' ? 'long' : 'short',
      },
    ]
  }, [timelineEpisodePayload, selectedTimelineLevels])
  const bundleArrows = useMemo((): ResearchChartArrow[] => {
    if (!bundleData || !bundleAuditBars) return []
    const raw = deriveBundleChartArrows(bundleData, bundleRule, bundleAuditBars, bundleSelection, bundleResult.trials)
    if (criterionStudy === 'experimental') {
      const starArrows: ResearchChartArrow[] = raw.map((arrow) => ({ ...arrow, isStar: true }))
      if (bundleSelection?.episode.entryTime != null && bundleSelection.episode.entryPrice != null) {
        const id = `bundle:${bundleSelection.episode.id}`
        if (!starArrows.some((a) => a.id === id)) {
          starArrows.push({
            id,
            time: bundleSelection.episode.entryTime,
            entryPrice: bundleSelection.episode.entryPrice,
            direction: 'long',
            isStar: true,
          })
        }
      }
      return starArrows
    }
    return raw
  }, [bundleData, bundleResult.trials, bundleAuditBars, bundleSelection, bundleRule, criterionStudy])

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
    setSelectedTimelineEpisodeId(null)
    setTimelineEpisodePayload(null)
    setSelectedTimelineRowKey(null)
    setSelectedTimelineLevels(null)
    setAuditSelection(null)
    setBundleSelection(null)
    setAuditRuleError(null)
    setBottomDockWindow((current) => current === 'arrow-result' ? 'notebook' : current)
  }

  const selectTimelineEpisode = useCallback((episodeId: string) => {
    setSelectedTimelineEpisodeId(episodeId)
    // Clear previous episode payload, selected row and levels immediately when switching
    setTimelineEpisodePayload(null)
    setSelectedTimelineRowKey(null)
    setSelectedTimelineLevels(null)
    setTimelineEpisodeError(null)
    setTimelineEpisodeLoading(true)
    setBottomDockWindow('arrow-result')
  }, [])

  const handleSelectTimelineRow = useCallback(
    (block: TimelineReleaseBlock, row: TimelineSeriesRow, key: string) => {
      setSelectedTimelineRowKey(key)
      if (!selectedTimelineEpisodeId) return
      const lev = findRowTradeLevels(timelineTradeLevels, selectedTimelineEpisodeId, block, row)
      const derived = deriveChartLevels(lev, block.entryTimestamp)
      setSelectedTimelineLevels(derived)
    },
    [selectedTimelineEpisodeId, timelineTradeLevels]
  )

  const saveTimelineNote = useCallback(
    (text: string) => {
      // Prevent attaching notes to wrong or loading episode
      if (
        !selectedTimelineEpisodeId ||
        !timelineEpisodePayload ||
        timelineEpisodePayload.episodeId !== selectedTimelineEpisodeId
      ) {
        return
      }
      const releaseText = timelineEpisodePayload.releaseTimeText ?? 'Historical Release'
      const updated: AuditNote = {
        viewerSha256: timelineManifest.reviewedSourceManifestSha256,
        family: 'CPI_TIMELINE',
        signal: 'H240',
        episodeId: selectedTimelineEpisodeId,
        releaseText,
        rule: { horizon: 240, stop: 1, target: 1 },
        text,
        updatedAt: new Date().toISOString(),
      }
      const nextNotes = [
        ...auditNotes.filter((n) => !(n.family === 'CPI_TIMELINE' && n.episodeId === selectedTimelineEpisodeId)),
        updated,
      ]
      const ok = writeAuditNotes(nextNotes)
      if (ok) {
        setAuditNotes(nextNotes)
        setAuditNoteSaveFailed(false)
      } else {
        setAuditNoteSaveFailed(true)
      }
    },
    [selectedTimelineEpisodeId, timelineEpisodePayload, auditNotes]
  )

  const changeCriterionStudy = (study: CriterionStudyId) => {
    if (study === criterionStudy) return
    leaveResearchAudit()
    setCriterionStudy(study)
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

  const selectResearchEpisode = (episode: ResearchEpisode, trial: ResearchTrial | null) => {
    if (!researchData || !researchData.families[researchRule.family].episodes.includes(episode)) return
    if (trial && (researchData.families[researchRule.family].episodes[trial[0]] !== episode
        || !availableTrials(researchData, researchRule).includes(trial))) return
    try { snapshotAround(researchData, episode.entryTime, researchRule.horizon, priorContextBars) }
    catch { setAuditRuleError(`This episode has no complete H${researchRule.horizon} chart path.`); return }
    setSelectedSymbol('EURUSD')
    setTimeframe('H1')
    setActiveDrawingTool(null)
    setSelectedDrawingId(null)
    setAuditRuleError(null)
    setAuditSelection({ episode, trial })
    setBundleSelection(null)
    setBottomDockWindow('arrow-result')
  }

  const selectBundleEpisode = (episode: BundleEpisode, trial: BundleTrial | null) => {
    if (!bundleData || !researchData || !bundleData.episodes.includes(episode) || !episode.entryTime) return
    if (bundleData.candlesSha256.toLowerCase() !== researchData.candlesSha256.toLowerCase()) {
      setAuditRuleError('The CPI bundle and chart candle sources do not match.'); return
    }
    if (trial) {
      const idx = bundleData.episodes.indexOf(episode)
      if (idx === -1 || getBundleEpisodeInclusion(bundleData, idx, bundleRule).trial !== trial) return
    }
    try { snapshotAround(researchData, episode.entryTime, bundleRule.horizon, priorContextBars) }
    catch { setAuditRuleError(`This episode has no complete H${bundleRule.horizon} chart path.`); return }
    setSelectedSymbol('EURUSD')
    setTimeframe('H1')
    setActiveDrawingTool(null)
    setSelectedDrawingId(null)
    setAuditRuleError(null)
    setBundleSelection({ episode, trial })
    setAuditSelection(null)
    setBottomDockWindow('arrow-result')
  }

  const changeResearchRule = (rule: ResearchRule) => {
    if (researchData && auditSelection && rule.family === researchRule.family) {
      try {
        validateSelection(researchData, rule)
        snapshotAround(researchData, auditSelection.episode.entryTime, rule.horizon, priorContextBars)
        const nextTrial = availableTrials(researchData, rule).find((trial) =>
          researchData.families[rule.family].episodes[trial[0]].id === auditSelection.episode.id)
        setResearchRule(rule)
        setAuditRuleError(null)
        setAuditSelection({ episode: auditSelection.episode, trial: nextTrial ?? null })
        return
      } catch (error) {
        setAuditRuleError(error instanceof Error ? error.message : 'The requested research view is unavailable.')
        return
      }
    }
    setResearchRule(rule)
    setAuditRuleError(null)
    leaveResearchAudit()
  }

  const changeBundleRule = (rule: BundleRule) => {
    if (bundleData && researchData && bundleSelection) {
      try {
        validateBundleSelection(bundleData, rule)
        if (!bundleSelection.episode.entryTime) throw new Error('No chart entry candle for this release')
        snapshotAround(researchData, bundleSelection.episode.entryTime, rule.horizon, priorContextBars)
        const next = deriveNextBundleSelection(bundleData, rule, bundleSelection)
        setBundleRule(rule)
        setAuditRuleError(null)
        setBundleSelection(next)
        return
      } catch (error) {
        setAuditRuleError(error instanceof Error ? error.message : 'The requested CPI bundle view is unavailable.')
        return
      }
    }
    setBundleRule(rule)
    setAuditRuleError(null)
  }

  const selectResearchArrow = (arrow: ResearchChartArrow) => {
    if (criterionStudy === 'bundle' || criterionStudy === 'experimental') {
      if (!bundleData) return
      const trial = bundleResult.trials.find((item) => `bundle:${bundleData.episodes[item[0]].id}` === arrow.id)
      if (trial) selectBundleEpisode(bundleData.episodes[trial[0]], trial)
      else {
        const episode = bundleData.episodes.find((item) => `bundle:${item.id}` === arrow.id)
        if (episode) selectBundleEpisode(episode, null)
      }
      return
    }
    if (!researchData) return
    const family = researchData.families[researchRule.family]
    const trial = researchSelection.trials.find((item) => `research:${family.episodes[item[0]].id}` === arrow.id)
    if (trial) selectResearchEpisode(family.episodes[trial[0]], trial)
  }

  const saveAuditNote = (text: string) => {
    if (criterionStudy === 'bundle' || criterionStudy === 'experimental') {
      if (!bundleSelection || !bundleData) return
      const key = auditNoteKey(bundleData.sourceSha256, 'CPI_BUNDLE', bundleRule.comparison, bundleSelection.episode.id)
      const next = auditNotes.filter((note) => auditNoteKey(note.viewerSha256, note.family, note.signal, note.episodeId) !== key)
      if (text.trim()) next.push({ viewerSha256: bundleData.sourceSha256, family: 'CPI_BUNDLE',
        signal: bundleRule.comparison, episodeId: bundleSelection.episode.id,
        releaseText: bundleSelection.episode.releaseText, rule: bundleRule, text, updatedAt: new Date().toISOString() })
      setAuditNotes(next)
      setAuditNoteSaveFailed(!writeAuditNotes(next))
      return
    }
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
          criterionStudy={criterionStudy}
          onCriterionStudyChange={changeCriterionStudy}
          criterionError={researchError ?? researchSelection.error}
          criterionRule={researchRule}
          criterionSummary={researchSelection.summary}
          priorContextBars={priorContextBars}
          onPriorContextChange={setPriorContextBars}
          selectedResearchEpisodeId={auditSelection?.episode.id ?? null}
          savedAuditNotes={currentDatasetNotes}
          onCriterionRuleChange={changeResearchRule}
          onSelectResearchEpisode={selectResearchEpisode}
          bundleData={bundleData}
          bundleError={bundleError ?? researchError ?? bundleResult.error}
          bundleRule={bundleRule}
          bundleSummary={bundleResult.summary}
          selectedBundleEpisodeId={bundleSelection?.episode.id ?? null}
          bundleNotes={currentBundleNotes}
          onBundleRuleChange={changeBundleRule}
          onSelectBundleEpisode={selectBundleEpisode}
          timelineIndex={timelineIndex}
          isTimelineLoading={timelineIndexLoading}
          timelineError={timelineIndexError}
          onRetryTimeline={handleRetryTimelineIndex}
          selectedTimelineEpisodeId={selectedTimelineEpisodeId}
          onSelectTimelineEpisode={selectTimelineEpisode}
        />

        <section className="chart-workspace" aria-label={`${chartSymbol} chart workspace`}>
          <ChartWorkspaceHeader
            symbol={chartSymbol}
            quote={quote}
            timeframe={timeframe}
            onSelectTimeframe={selectTimeframe}
            researchAudit={auditMode}
            auditDetails={auditMode ? `${criterionStudy === 'timeline' ? timelineEpisodePayload?.releaseTimeText : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleSelection?.episode.releaseText : auditSelection?.episode.releaseText} · EURUSD H1 · H${criterionStudy === 'timeline' ? 240 : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleRule.horizon : researchRule.horizon} observed candles · ${priorContextBars ? `up to ${priorContextBars} prior` : 'no prior context'}` : null}
            auditStatus={auditMode ? (criterionStudy === 'timeline' ? (!selectedTimelineLevels ? 'No priced trade under this row' : null) : criterionStudy !== 'experimental' && ((criterionStudy === 'bundle') ? bundleSelection && !bundleSelection.trial : auditSelection && !auditSelection.trial) ? 'No priced trade under this rule' : null) : null}
            auditError={auditRuleError}
            onReturnLive={leaveResearchAudit}
          />
          <div className="chart-frame">
            <MarketChartErrorBoundary
              symbol={chartSymbol}
              timeframe={timeframe}
              onError={(error) => appendActivity('Chart', 'Chart error caught', error.message, { severity: 'error' })}
            >
              <MarketCandlestickChart
                bars={chartBars}
                fitContentKey={auditMode ? `research:${criterionStudy}:${criterionStudy === 'timeline' ? selectedTimelineEpisodeId : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleSelection?.episode.id : auditSelection?.episode.id}:H${criterionStudy === 'timeline' ? 240 : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleRule.horizon : researchRule.horizon}:context${priorContextBars}` : `${activeSymbol}:${timeframe}`}
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
                      researchArrows={auditMode ? (criterionStudy === 'timeline' ? timelineArrows : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? bundleArrows : researchArrows) : noResearchArrows}
                      selectedResearchArrowId={auditMode ? (criterionStudy === 'timeline' ? `timeline:${timelineEpisodePayload?.episodeId}` : (criterionStudy === 'bundle' || criterionStudy === 'experimental') ? `bundle:${bundleSelection?.episode.id}` : `research:${auditSelection?.episode.id}`) : null}
                      researchLevels={auditMode ? activeLevels : null}
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
          {bottomDockWindow === 'arrow-result' && criterionStudy === 'timeline' && (
            <TimelineResultPanel
              episodePayload={timelineEpisodePayload}
              isLoading={timelineEpisodeLoading}
              error={timelineEpisodeError}
              onRetry={handleRetryTimelineEpisode}
              selectedRowKey={selectedTimelineRowKey}
              onSelectRow={handleSelectTimelineRow}
              note={currentTimelineNote?.text ?? ''}
              notes={currentTimelineNotes}
              saveFailed={auditNoteSaveFailed}
              onNoteChange={saveTimelineNote}
              onReturnLive={leaveResearchAudit}
            />
          )}
          {bottomDockWindow === 'arrow-result' && criterionStudy === 'baseline' && (
            <BaselineResultPanel key={`${researchRule.family}:${researchRule.signal}:${auditSelection?.episode.id ?? ''}`}
              episode={auditSelection?.episode ?? null} trial={auditSelection?.trial ?? null}
              rule={researchRule} note={currentAuditNote?.text ?? ''} notes={currentDatasetNotes}
              saveFailed={auditNoteSaveFailed} onNoteChange={saveAuditNote}
              onReturnLive={leaveResearchAudit} />
          )}
          {bottomDockWindow === 'arrow-result' && (criterionStudy === 'bundle' || criterionStudy === 'experimental') && (
            <CpiBundleResultPanel key={`${bundleRule.comparison}:${bundleSelection?.episode.id ?? ''}`}
              episode={bundleSelection?.episode ?? null} trial={bundleSelection?.trial ?? null}
              rule={bundleRule} note={currentBundleNote?.text ?? ''} notes={currentBundleNotes}
              saveFailed={auditNoteSaveFailed} onNoteChange={saveAuditNote}
              onReturnLive={leaveResearchAudit}
              isExperimental={criterionStudy === 'experimental'}
              bundleData={bundleData}
              auditBars={bundleAuditBars} />
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
