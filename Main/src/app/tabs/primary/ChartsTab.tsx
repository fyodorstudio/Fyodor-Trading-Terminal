import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { ChartSettingsDrawer, type ChartDrawerMode } from "@/app/components/ChartSettingsDrawer";
import { ChartStatusRail } from "@/app/components/ChartStatusRail";
import { ChartSymbolPicker } from "@/app/components/ChartSymbolPicker";
import { ChartToolStrip } from "@/app/components/ChartToolStrip";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { ChartViewport, type ChartCrosshairReadoutHandle, type ChartEventLensDockData, type ChartPairMatrixContextMarkerData, type ChartPairMatrixRangeOverlayData, type PairMatrixRangePreview } from "@/app/components/ChartViewport";
import type { ChartPairMatrixTimeLensData, PairMatrixLoadState } from "@/app/components/ChartPairMatrixTimeLens";
import type { ChartEventLensData, ChartEventReleaseRow } from "@/app/components/ChartEventLens";
import { useChartEventOverlay } from "@/app/hooks/useChartEventOverlay";
import { useChartMarketData } from "@/app/hooks/useChartMarketData";
import { fetchCalendar, fetchMacroSignalChartSignals, fetchMacroSignalTargetLadder, getPreloadedMacroSignalCurrentModel, getPreloadedMacroSignalGlobalRegistry, preloadMacroSignalCurrentModel, preloadMacroSignalGlobalRegistry, refreshMacroSignalGlobalRegistry } from "@/app/lib/bridge";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { formatUtcDisplayDate } from "@/app/lib/format";
import {
  DEFAULT_CHART_TIMEFRAME,
  getChartConnectionLabel,
  getChartPriceFormat,
  getCrosshairMode,
} from "@/app/lib/chartDisplay";
import {
  formatChartEventDisplayTime,
  filterChartEventsForOverlay,
  getFutureChartEventTimes,
  getChartEventAnchorTime,
  getChartEventCoordinateTime,
  getChartEventKey,
  getChartEventRelevantCurrencies,
} from "@/app/lib/chartEvents";
import {
  DEFAULT_CHART_PREFERENCES,
  formatChartFeedTime,
  formatChartHeaderFeedTime,
  formatCursorReadout,
  getChartDisplayCandles,
  getChartGridColor,
  getChartLayoutOptions,
  getChartSeriesAppearanceOptions,
  getChartSourceTimeOffsetSeconds,
  getChartTimeFormatters,
  loadChartPreferences,
  loadChartDisplayTimeMode,
  normalizeChartTimestampSeconds,
  saveChartPreferences,
  saveChartDisplayTimeMode,
  type ChartAppearancePreferences,
  type ChartCursorReadoutMode,
  type ChartDisplayTimeMode,
  type ChartEventOverlayPreferences,
  type ChartPreferences,
} from "@/app/lib/chartView";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import { getEventComparison } from "@/app/lib/eventReaction";
import { buildMacroFactorRows } from "@/app/lib/macroDrivers";
import { buildPairMatrixMomentumSnapshot, type PairMatrixMomentumSnapshot } from "@/app/lib/pairMatrixMomentum";
import { indexPairMatrixContextMarkers, selectPairMatrixContextMarkerGroups } from "@/app/lib/pairMatrixContextMarkers";
import { createPairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import type { PairMatrixChartGeometryRuntime } from "@/app/lib/pairMatrixChartGeometry";
import {
  buildPairMatrixTimelineFromIndex,
  calendarEventsCoverWindow,
  getPairMatrixCandleClose,
  getPairMatrixForexCurrencies,
  getPairMatrixRangePipMoveLabel,
  getPairMatrixRangePixelBounds,
  getPairMatrixTimelineWindow,
  loadPairMatrixBeforeDays,
  mergePairMatrixCalendarEvents,
  indexPairMatrixCalendar,
  normalizePairMatrixCandleRange,
  remapPairMatrixTimeInterval,
  savePairMatrixBeforeDays,
  type PairMatrixCalendarIndex,
  type PairMatrixCandleRange,
  type PairMatrixTimelineSnapshot,
  type PairMatrixTimeInterval,
} from "@/app/lib/pairMatrixSnapshot";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import type { BridgeCandle, CalendarEvent, MacroSignalChartMode, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalGlobalResponse, MarketStatusResponse, Timeframe } from "@/app/types";

const DEBUG_MAX = 60;
const REPLAY_SPEED_OPTIONS = [0.5, 1, 2, 4];
const REPLAY_STEP_OPTIONS = [1, 2, 4, 8];
const PAIR_MATRIX_HISTORY_DEBOUNCE_MS = 180;
const PAIR_MATRIX_HOVER_SETTLE_MS = 120;
const PAIR_MATRIX_HISTORY_CACHE_LIMIT = 8;
const MACRO_BIAS_VISIBILITY_KEY = "fyodor.charts.macro-bias-visible";
const MACRO_BIAS_HISTORICAL_MATCHES_KEY = "fyodor.charts.macro-bias-historical-matches";
const MACRO_BIAS_MARKETS = new Set(["AUDUSD", "EURUSD", "GBPUSD", "NZDUSD", "USDCAD", "USDCHF", "USDJPY"]);
const MACRO_BIAS_LIVE_REFRESH_MS = 30_000;

export function isMacroBiasMarketSupported(symbol: string): boolean {
  return MACRO_BIAS_MARKETS.has(symbol.toUpperCase());
}

interface PairMatrixCalendarCacheEntry {
  currencyKey: string;
  from: number;
  to: number;
  events: CalendarEvent[];
}

interface PairMatrixDerivedSnapshot {
  timeline: PairMatrixTimelineSnapshot;
  momentum: PairMatrixMomentumSnapshot;
}

interface ChartsTabProps {
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

export function resolvePairMatrixHoveredCandleUpdate(current: number | null, next: number | null, enabled: boolean): { shouldUpdate: boolean; value: number | null } {
  return { shouldUpdate: enabled && current !== next, value: next };
}

export function getChartRangeUpdateCadence(pairMatrixOpen: boolean): "animation_frame" | "settled" {
  return pairMatrixOpen ? "settled" : "animation_frame";
}

export function getMacroBiasRequestScope(args: {
  mode: MacroSignalChartMode;
  symbol: string;
  timeframe: string;
  from?: number;
  to?: number;
  calendarRevision: string;
}): string {
  return args.mode === "current"
    ? `${args.symbol}:H4:current:${args.calendarRevision}`
    : `${args.symbol}:${args.timeframe}:research_replay:${args.from ?? ""}:${args.to ?? ""}:${args.calendarRevision}`;
}

export function shouldApplyMacroBiasRefresh(
  current: MacroSignalChartSignalResponse | MacroSignalGlobalResponse | null,
  next: MacroSignalChartSignalResponse | MacroSignalGlobalResponse,
): boolean {
  if (!current) return true;
  return current.generatedAt !== next.generatedAt;
}

export function getMacroBiasReplayStatusLabel(
  summary: MacroSignalChartSignalResponse["evaluationSummary"],
): string {
  if (summary?.latestArrowAt) {
    const date = formatUtcDisplayDate(summary.latestArrowAt);
    return `Hindsight replay · last arrow ${date} · ${summary.laterUnmatchedPackageCount} later scored package${summary.laterUnmatchedPackageCount === 1 ? "" : "s"} did not match`;
  }
  if (summary && summary.evaluatedPackageCount > 0) {
    return `Hindsight replay · ${summary.evaluatedPackageCount} scored packages · none matched a frozen replay pattern`;
  }
  return "Historical replay · hindsight research";
}

export function getPairMatrixHoverSettleDelay(lastMotionMs: number, nowMs: number, settleMs = PAIR_MATRIX_HOVER_SETTLE_MS): number {
  return Math.max(0, settleMs - Math.max(0, nowMs - lastMotionMs));
}

export function getPairMatrixAnalyzeCandleRange(candleTimes: number[], candleOpen: number, timeframe: Timeframe): PairMatrixCandleRange | null {
  if (!candleTimes.includes(candleOpen)) return null;
  return normalizePairMatrixCandleRange(candleTimes, candleOpen, candleOpen, timeframe);
}

export interface ChartZoomSnapshot {
  span: number;
  rightOffset: number;
}

export function captureChartZoomSnapshot(range: { from: number; to: number } | null, lastCandleIndex: number): ChartZoomSnapshot | null {
  if (!range) return null;
  const span = range.to - range.from;
  if (!Number.isFinite(span) || span <= 1) return null;
  return {
    span,
    rightOffset: Math.min(span * 0.8, Math.max(0, range.to - lastCandleIndex)),
  };
}

export function restoreChartZoomRange(snapshot: ChartZoomSnapshot, lastCandleIndex: number): { from: number; to: number } {
  const to = lastCandleIndex + snapshot.rightOffset;
  return { from: to - snapshot.span, to };
}

export function getMacroBiasActivationCandleOpen(
  signal: MacroSignalChartSignal,
  candles: BridgeCandle[],
  sourceTimeOffsetSeconds: number,
  chartTimeframe: Timeframe = "H4",
): number | null {
  const activationTime = signal.activationTime == null
    ? null
    : getChartEventCoordinateTime(signal.activationTime, sourceTimeOffsetSeconds);
  const releaseTime = getChartEventCoordinateTime(signal.eventTime, sourceTimeOffsetSeconds);
  if (activationTime == null && chartTimeframe !== "H4") return null;
  const target = activationTime ?? releaseTime;
  if (activationTime != null) {
    let low = 0;
    let high = candles.length - 1;
    let containingIndex = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (candles[middle].time <= target) {
        containingIndex = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    if (containingIndex >= 0) {
      const candleOpen = candles[containingIndex].time;
      const nextOpen = candles[containingIndex + 1]?.time;
      const nominalClose = getPairMatrixCandleClose(candleOpen, chartTimeframe);
      const containingClose = nextOpen == null ? nominalClose : Math.min(nextOpen, nominalClose);
      if (target < containingClose) return candleOpen;
    }
  }
  const nextIndex = candles.findIndex((candle) => activationTime == null ? candle.time > target : candle.time >= target);
  return nextIndex >= 0 ? candles[nextIndex].time : null;
}

export function buildMacroBiasSeriesMarkers(
  signals: MacroSignalChartSignal[],
  candles: BridgeCandle[],
  timeframe: Timeframe,
  sourceTimeOffsetSeconds: number,
): { markers: SeriesMarker<Time>[]; signalByMarkerId: Map<string, MacroSignalChartSignal> } {
  const signalByMarkerId = new Map<string, MacroSignalChartSignal>();
  const candleByTime = new Map(candles.map((candle) => [candle.time, candle] as const));
  const markers = signals.flatMap((signal): SeriesMarker<Time>[] => {
    const chartReleaseTime = getChartEventCoordinateTime(signal.eventTime, sourceTimeOffsetSeconds);
    let low = 0;
    let high = candles.length - 1;
    let releaseIndex = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (candles[middle].time <= chartReleaseTime) {
        releaseIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    const releaseCandleOpen = releaseIndex >= 0 ? candles[releaseIndex].time : null;
    const nextOpen = releaseIndex >= 0 ? candles[releaseIndex + 1]?.time : null;
    const nominalClose = releaseCandleOpen == null ? null : getPairMatrixCandleClose(releaseCandleOpen, timeframe);
    const containingClose = nominalClose == null ? null : nextOpen == null ? nominalClose : Math.min(nextOpen, nominalClose);
    if (containingClose == null || chartReleaseTime >= containingClose || releaseCandleOpen == null) return [];

    const activationCandleOpen = getMacroBiasActivationCandleOpen(signal, candles, sourceTimeOffsetSeconds, timeframe);

    const built: SeriesMarker<Time>[] = [];
    if (activationCandleOpen == null || activationCandleOpen < releaseCandleOpen) return built;
    if (!candleByTime.has(activationCandleOpen)) return built;
    const activationMarkerId = `macro-bias-activation:${signal.id}`;
    signalByMarkerId.set(activationMarkerId, signal);
    built.push({
      id: activationMarkerId,
      time: activationCandleOpen as Time,
      position: signal.direction === "long" ? "belowBar" : "aboveBar",
      shape: signal.direction === "long" ? "arrowUp" : "arrowDown",
      color: signal.historicalReplay
        ? signal.direction === "long" ? "#2563eb" : "#7c3aed"
        : signal.direction === "long" ? "#16a34a" : "#dc2626",
      text: `${signal.direction === "long" ? "LONG BIAS" : "SHORT BIAS"}${signal.contextOverlay?.matched ? " · CONTEXT" : ""}`,
      size: 1.4,
    });
    return built;
  });
  markers.sort((left, right) => Number(left.time) - Number(right.time));
  return { markers, signalByMarkerId };
}

export function buildMacroBiasPriceLineLevels(signal: MacroSignalChartSignal) {
  const barrier = signal.marketContext?.supportResistance.directionalBarrier;
  return [
    { value: signal.entry, title: "ENTRY", color: "#64748b", lineStyle: LineStyle.Dashed },
    { value: signal.stop, title: "SL", color: "#dc2626", lineStyle: LineStyle.Solid },
    { value: signal.target, title: "TP", color: "#16a34a", lineStyle: LineStyle.Solid },
    {
      value: barrier?.level,
      title: barrier ? `H4 ${barrier.kind === "support" ? "SUP" : "RES"} ${barrier.touches}x` : "CONTEXT",
      color: "#d97706",
      lineStyle: LineStyle.Dotted,
    },
  ].filter((level): level is typeof level & { value: number } => level.value != null && Number.isFinite(level.value));
}

export interface MacroBiasActiveState {
  signal: MacroSignalChartSignal;
  remainingCandles: number | null;
  activationCandleOpen: number;
  expiryCandleOpen: number | null;
}

export function getMacroBiasActiveState(
  signals: MacroSignalChartSignal[],
  candles: BridgeCandle[],
  sourceTimeOffsetSeconds: number,
  chartTimeframe: Timeframe = "H4",
): MacroBiasActiveState | null {
  if (candles.length === 0) return null;
  const latestIndex = candles.length - 1;
  const active = signals.flatMap((signal): Array<MacroBiasActiveState & { activationIndex: number }> => {
    if (signal.outcomeStatus && signal.outcomeStatus !== "pending") return [];
    const activationCandleOpen = getMacroBiasActivationCandleOpen(signal, candles, sourceTimeOffsetSeconds, chartTimeframe);
    const activationIndex = activationCandleOpen == null ? -1 : candles.findIndex((candle) => candle.time === activationCandleOpen);
    if (activationCandleOpen == null || activationIndex < 0) return [];
    const chartCandlesPerModelCandle = ({ M1: 240, M5: 48, M15: 16, M30: 8, H1: 4, H4: 1 } as Partial<Record<Timeframe, number>>)[chartTimeframe];
    if (chartCandlesPerModelCandle == null) {
      if (latestIndex < activationIndex) return [];
      return [{ signal, activationIndex, activationCandleOpen, expiryCandleOpen: null, remainingCandles: null }];
    }
    const expiryIndex = activationIndex + signal.expiryCandles * chartCandlesPerModelCandle;
    if (latestIndex < activationIndex || latestIndex >= expiryIndex) return [];
    return [{
      signal,
      activationIndex,
      activationCandleOpen,
      expiryCandleOpen: candles[expiryIndex]?.time ?? null,
      remainingCandles: Math.ceil((expiryIndex - latestIndex) / chartCandlesPerModelCandle),
    }];
  });
  if (active.length === 0) return null;
  active.sort((left, right) => right.activationIndex - left.activationIndex || right.signal.eventTime - left.signal.eventTime);
  const { activationIndex: _activationIndex, ...state } = active[0];
  return state;
}

function getDefaultClusterEvent(cluster: { events: Array<{ event: CalendarEvent }> }): CalendarEvent | null {
  const impactRank: Record<CalendarEvent["impact"], number> = { high: 0, medium: 1, low: 2 };
  return [...cluster.events]
    .sort((left, right) => {
      const impactDelta = impactRank[left.event.impact] - impactRank[right.event.impact];
      if (impactDelta !== 0) return impactDelta;
      return left.event.time - right.event.time;
    })[0]?.event ?? null;
}

function getNearestCandleIndex(
  candles: BridgeCandle[],
  event: CalendarEvent | null,
  timeframe: Timeframe,
  sourceTimeOffsetSeconds: number,
): number | null {
  if (!event || candles.length === 0) return null;
  const chartTime = getChartEventCoordinateTime(event.time, sourceTimeOffsetSeconds);
  const lastCandle = candles[candles.length - 1];
  if (lastCandle && chartTime > lastCandle.time) return null;
  const anchorTime = getChartEventAnchorTime(chartTime, candles, timeframe) ?? chartTime;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  candles.forEach((candle, index) => {
    const distance = Math.abs(candle.time - anchorTime);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function formatSignedPriceDelta(value: number, precision: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(precision)}`;
}

function formatObservedMove(
  anchor: BridgeCandle | null,
  current: BridgeCandle | null,
  precision: number,
): { label: string; detail: string } {
  if (!anchor || !current) {
    return {
      label: "N/A",
      detail: "Replay move is unavailable because the selected event is outside the loaded candle window.",
    };
  }

  const delta = current.close - anchor.close;
  const percent = anchor.close === 0 ? null : (delta / anchor.close) * 100;
  const percentLabel = percent == null ? "N/A" : `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;

  return {
    label: `${formatSignedPriceDelta(delta, precision)} / ${percentLabel}`,
    detail: `Observed move compares the selected event candle close (${anchor.close.toFixed(precision)}) with the current replay cursor close (${current.close.toFixed(precision)}).`,
  };
}

function formatEventField(value: string, title: string): string {
  return getEventValueDisplay(value, title).display;
}

function getChartEventCurrencyLabel(symbol: string): string {
  const currencies = getChartEventRelevantCurrencies(symbol);
  if (currencies.length === 0) return symbol.toUpperCase();
  return currencies.join("/");
}

function isSameChartEventTemplate(left: CalendarEvent, right: CalendarEvent): boolean {
  return left.currency === right.currency && left.title === right.title;
}

export function ChartsTab({
  marketStatus,
  selectedSymbol,
  onSelectedSymbolChange,
  events,
  onOpenCalendarEvent,
}: ChartsTabProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_CHART_TIMEFRAME);
  const [displayTimeMode, setDisplayTimeMode] = useState<ChartDisplayTimeMode>(() => loadChartDisplayTimeMode());
  const [chartPreferences, setChartPreferences] = useState<ChartPreferences>(() => loadChartPreferences());
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [chartDrawerMode, setChartDrawerMode] = useState<ChartDrawerMode>("appearance");
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [pairMatrixOpen, setPairMatrixOpen] = useState(false);
  const [macroBiasVisible, setMacroBiasVisible] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem(MACRO_BIAS_VISIBILITY_KEY) === "true"; }
    catch { return false; }
  });
  const [macroBiasHistoricalMatchesVisible, setMacroBiasHistoricalMatchesVisible] = useState(() => {
    try { return window.localStorage.getItem(MACRO_BIAS_HISTORICAL_MATCHES_KEY) !== "false"; }
    catch { return true; }
  });
  const [macroBiasCurrentResponse, setMacroBiasCurrentResponse] = useState<MacroSignalChartSignalResponse | null>(getPreloadedMacroSignalCurrentModel);
  const [macroBiasShadowHistoryResponse, setMacroBiasShadowHistoryResponse] = useState<MacroSignalChartSignalResponse | null>(null);
  const [macroBiasGlobalResponse, setMacroBiasGlobalResponse] = useState<MacroSignalGlobalResponse | null>(getPreloadedMacroSignalGlobalRegistry);
  const [macroBiasGlobalLoading, setMacroBiasGlobalLoading] = useState(false);
  const [macroBiasGlobalError, setMacroBiasGlobalError] = useState<string | null>(null);
  const [macroBiasCurrentLoading, setMacroBiasCurrentLoading] = useState(false);
  const [macroBiasCurrentError, setMacroBiasCurrentError] = useState<string | null>(null);
  const [selectedMacroBiasId, setSelectedMacroBiasId] = useState<string | null>(null);
  const [macroBiasSignalAudits, setMacroBiasSignalAudits] = useState<Record<string, MacroSignalChartSignal>>({});
  const [pairMatrixBeforeDays, setPairMatrixBeforeDays] = useState(loadPairMatrixBeforeDays);
  const [pairMatrixCoverageAnchor, setPairMatrixCoverageAnchor] = useState<number | null>(null);
  const [pairMatrixRangeArmed, setPairMatrixRangeArmed] = useState(false);
  const [pairMatrixRangeEditing, setPairMatrixRangeEditing] = useState(false);
  const [pairMatrixRangeCancelRevision, setPairMatrixRangeCancelRevision] = useState(0);
  const [pairMatrixLockedRange, setPairMatrixLockedRange] = useState<PairMatrixCandleRange | null>(null);
  const [pairMatrixLockedInterval, setPairMatrixLockedInterval] = useState<PairMatrixTimeInterval | null>(null);
  const [pairMatrixCalendarResult, setPairMatrixCalendarResult] = useState<{
    key: string | null;
    state: PairMatrixLoadState;
    events: CalendarEvent[];
  }>({ key: null, state: "idle", events: [] });
  const [pairMatrixMarkerCalendarEvents, setPairMatrixMarkerCalendarEvents] = useState<CalendarEvent[]>([]);
  const [pairMatrixMarkerCalendarState, setPairMatrixMarkerCalendarState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [chartRangeRevision, setChartRangeRevision] = useState(0);
  const [chartLayoutRevision, setChartLayoutRevision] = useState(0);
  const [chartInteracting, setChartInteracting] = useState(false);
  const [hoveredChartEventClusterKey, setHoveredChartEventClusterKey] = useState<string | null>(null);
  const [activeChartEventClusterKey, setActiveChartEventClusterKey] = useState<string | null>(null);
  const [selectedChartEventCluster, setSelectedChartEventCluster] = useState<ChartEventOverlayCluster | null>(null);
  const [selectedChartEvent, setSelectedChartEvent] = useState<CalendarEvent | null>(null);
  const [eventLensExpanded, setEventLensExpanded] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayCursorIndex, setReplayCursorIndex] = useState<number | null>(null);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replayStepCandles, setReplayStepCandles] = useState(1);
  const timezoneMenuRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const crosshairReadoutRef = useRef<ChartCrosshairReadoutHandle | null>(null);
  const hoveredCandleChartTimeRef = useRef<number | null>(null);
  const pairMatrixHoverRuntimeRef = useRef(createPairMatrixHoverRuntime());
  const pendingPairMatrixHoverRef = useRef<number | null>(null);
  const pairMatrixHoverTimeoutRef = useRef<number | null>(null);
  const pairMatrixHoverLastMotionRef = useRef(0);
  const pairMatrixHoverEnabledRef = useRef(false);
  const pairMatrixOpenRef = useRef(false);
  const pairMatrixCoverageWindowKeyRef = useRef("");
  const chartZoomSnapshotRef = useRef<ChartZoomSnapshot | null>(null);
  const preserveZoomNextLoadRef = useRef(false);
  const skipNextFutureRefocusRef = useRef(false);
  const visibleCandleCountRef = useRef(0);
  const chartMarketIdentityRef = useRef(`${selectedSymbol}:${timeframe}`);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const macroBiasMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const macroBiasTradeLinesRef = useRef<IPriceLine[]>([]);
  const macroBiasSignalByMarkerIdRef = useRef(new Map<string, MacroSignalChartSignal>());
  const shouldRefocusRef = useRef(true);
  const futureRefocusSignatureRef = useRef("");
  const rangeAnimationFrameRef = useRef<number | null>(null);
  const rangeSettleTimeoutRef = useRef<number | null>(null);
  const pairMatrixCalendarCacheRef = useRef(new Map<string, PairMatrixCalendarCacheEntry>());
  const pairMatrixCalendarPendingRef = useRef(new Map<string, Promise<CalendarEvent[]>>());
  const pairMatrixCalendarRequestRef = useRef(0);
  const pairMatrixMarkerCalendarRequestRef = useRef(0);
  const pairMatrixGeometryListenersRef = useRef(new Set<() => void>());
  const pairMatrixGeometryFrameRef = useRef<number | null>(null);
  const pairMatrixDerivedCacheRef = useRef<{
    index: PairMatrixCalendarIndex | null;
    values: Map<string, PairMatrixDerivedSnapshot>;
  }>({ index: null, values: new Map() });
  pairMatrixHoverEnabledRef.current = pairMatrixOpen && pairMatrixLockedRange == null;
  pairMatrixOpenRef.current = pairMatrixOpen;

  const pairMatrixGeometryRuntime = useMemo<PairMatrixChartGeometryRuntime>(() => ({
    subscribe: (listener) => {
      pairMatrixGeometryListenersRef.current.add(listener);
      return () => pairMatrixGeometryListenersRef.current.delete(listener);
    },
    resolveRange: (range) => {
      const chart = chartRef.current;
      const container = containerRef.current;
      if (!chart || !container) return null;
      return getPairMatrixRangePixelBounds(
        chart.timeScale().timeToCoordinate(range.firstOpen as Time),
        chart.timeScale().timeToCoordinate(range.lastOpen as Time),
        chart.timeScale().options().barSpacing,
        container.clientWidth,
      );
    },
    resolveMarker: (candleOpens) => {
      const chart = chartRef.current;
      const width = containerRef.current?.clientWidth ?? 0;
      if (!chart || width <= 0 || candleOpens.length === 0) return null;
      const coordinates = candleOpens.flatMap((open) => {
        const coordinate = chart.timeScale().timeToCoordinate(open as Time);
        return coordinate == null || !Number.isFinite(Number(coordinate)) ? [] : [Number(coordinate)];
      });
      if (coordinates.length === 0) return null;
      const x = coordinates.reduce((sum, coordinate) => sum + coordinate, 0) / coordinates.length;
      return {
        x,
        visible: x >= -18 && x <= width + 18,
        placement: x < 220 ? "right" : x > width - 220 ? "left" : "center",
      };
    },
  }), []);

  const schedulePairMatrixGeometryUpdate = useCallback(() => {
    if (!pairMatrixOpenRef.current || pairMatrixGeometryFrameRef.current != null) return;
    pairMatrixGeometryFrameRef.current = window.requestAnimationFrame(() => {
      pairMatrixGeometryFrameRef.current = null;
      pairMatrixGeometryListenersRef.current.forEach((listener) => listener());
    });
  }, []);

  useEffect(() => () => {
    if (pairMatrixGeometryFrameRef.current != null) window.cancelAnimationFrame(pairMatrixGeometryFrameRef.current);
    pairMatrixGeometryListenersRef.current.clear();
  }, []);

  const addLog = useCallback((line: string) => {
    setDebugLines((current) => {
      const next = [...current, `[${new Date().toISOString()}] ${line}`];
      return next.slice(-DEBUG_MAX);
    });
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!timezoneMenuRef.current?.contains(target)) setTimezoneMenuOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const activeMarketStatus =
    marketStatus && marketStatus.symbol.toUpperCase() === selectedSymbol.toUpperCase() ? marketStatus : null;
  const chartSourceTimeOffsetSeconds = getChartSourceTimeOffsetSeconds(activeMarketStatus);

  const {
    symbols,
    historyState,
    visibleCandles,
    lastCandleTime,
    streamConnected,
    boundaryTime,
    chartLoadError,
    cacheSummary,
    status,
    reachedBoundary,
    clearCurrentCache,
  } = useChartMarketData({
    selectedSymbol,
    onSelectedSymbolChange,
    timeframe,
    activeMarketStatus,
    chartRef,
    addLog,
  });
  visibleCandleCountRef.current = visibleCandles.length;
  const chartMarketIdentity = `${selectedSymbol}:${timeframe}`;
  if (chartMarketIdentityRef.current !== chartMarketIdentity) {
    preserveZoomNextLoadRef.current = chartPreferences.preserveZoomOnMarketChange && chartZoomSnapshotRef.current != null;
    chartMarketIdentityRef.current = chartMarketIdentity;
  }

  const priceFormat = useMemo(
    () => getChartPriceFormat(selectedSymbol, activeMarketStatus?.asset_class ?? null),
    [selectedSymbol, activeMarketStatus?.asset_class],
  );

  const chartEventCandidates = useMemo(
    () =>
      filterChartEventsForOverlay({
        events,
        selectedSymbol,
        scope: chartPreferences.eventOverlay.scope,
        impactFilter: chartPreferences.eventOverlay.impactFilter,
        sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
        latestCandleTime: lastCandleTime,
      }),
    [
      events,
      selectedSymbol,
      chartPreferences.eventOverlay.scope,
      chartPreferences.eventOverlay.impactFilter,
      chartSourceTimeOffsetSeconds,
      lastCandleTime,
    ],
  );

  const loadedUpcomingEventCount = useMemo(
    () => chartEventCandidates.filter((candidate) => candidate.isFuture).length,
    [chartEventCandidates],
  );

  const futureChartEventTimes = useMemo(
    () =>
      chartPreferences.eventOverlay.visible
        ? getFutureChartEventTimes(
            chartEventCandidates,
            lastCandleTime,
            chartPreferences.eventOverlay.futureMarkerLimit,
          )
        : [],
    [
      chartEventCandidates,
      chartPreferences.eventOverlay.visible,
      chartPreferences.eventOverlay.futureMarkerLimit,
      lastCandleTime,
    ],
  );

  const selectedReplayAnchorIndex = useMemo(
    () => getNearestCandleIndex(visibleCandles, selectedChartEvent, timeframe, chartSourceTimeOffsetSeconds),
    [visibleCandles, selectedChartEvent, timeframe, chartSourceTimeOffsetSeconds],
  );

  const displayCandles = useMemo(
    () =>
      getChartDisplayCandles(visibleCandles, {
        dimAfterIndex: selectedChartEvent == null ? null : replayCursorIndex,
        appearance: chartPreferences.appearance,
        futureTimes: futureChartEventTimes,
      }),
    [
      visibleCandles,
      selectedChartEvent,
      replayCursorIndex,
      chartPreferences.appearance,
      futureChartEventTimes,
    ],
  );

  const refocusChart = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || visibleCandles.length === 0) return;

    const lastIndex = visibleCandles.length - 1;
    const windowBars = Math.min(Math.max(visibleCandles.length, 60), 120);
    const halfWindow = windowBars / 2;
    const futureSlots = futureChartEventTimes.length;
    const rightWindow = futureSlots > 0 ? Math.max(18, futureSlots + 8) : halfWindow;
    const leftWindow = Math.max(42, windowBars - rightWindow);

    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(-0.5, lastIndex - leftWindow),
      to: lastIndex + rightWindow,
    });

    series.priceScale().setAutoScale(true);
    window.requestAnimationFrame(() => {
      const latestClose = visibleCandles[lastIndex]?.close;
      const autoRange = series.priceScale().getVisibleRange();
      if (latestClose == null || !autoRange) return;
      const span = Math.max(autoRange.to - autoRange.from, Math.abs(latestClose) * 0.01, 1e-6);
      series.priceScale().setAutoScale(false);
      series.priceScale().setVisibleRange({
        from: latestClose - span / 2,
        to: latestClose + span / 2,
      });
    });
  }, [visibleCandles, futureChartEventTimes]);

  const focusChartAroundEvent = useCallback(
    (event: CalendarEvent): boolean => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series || visibleCandles.length === 0) return false;

      const anchorIndex = getNearestCandleIndex(visibleCandles, event, timeframe, chartSourceTimeOffsetSeconds);
      const eventChartTime = getChartEventCoordinateTime(event.time, chartSourceTimeOffsetSeconds);
      const futureEventIndex = futureChartEventTimes.findIndex((time) => time === eventChartTime);
      if (anchorIndex == null && futureEventIndex < 0) return false;

      const windowBars = Math.min(Math.max(Math.round(visibleCandles.length * 0.2), 56), 120);
      const leadBars = Math.max(18, Math.round(windowBars * 0.34));
      const logicalIndex = anchorIndex ?? visibleCandles.length + futureEventIndex;
      const from = Math.max(-0.5, logicalIndex - (windowBars - leadBars));
      const to = Math.min(visibleCandles.length + Math.max(8, futureChartEventTimes.length + 4), logicalIndex + leadBars);

      chart.timeScale().setVisibleLogicalRange({ from, to });
      series.priceScale().setAutoScale(true);
      return true;
    },
    [visibleCandles, timeframe, chartSourceTimeOffsetSeconds, futureChartEventTimes],
  );

  const handleDisplayTimeModeChange = useCallback((next: ChartDisplayTimeMode) => {
    setDisplayTimeMode(next);
    saveChartDisplayTimeMode(next);
    setTimezoneMenuOpen(false);
  }, []);

  const updateChartPreferences = useCallback((updater: (current: ChartPreferences) => ChartPreferences) => {
    setChartPreferences((current) => {
      const next = updater(current);
      saveChartPreferences(next);
      return next;
    });
  }, []);

  const updateAppearance = useCallback(
    <K extends keyof ChartAppearancePreferences,>(key: K, value: ChartAppearancePreferences[K]) => {
      updateChartPreferences((current) => ({
        ...current,
        appearance: {
          ...current.appearance,
          [key]: value,
        },
      }));
    },
    [updateChartPreferences],
  );

  const handleCursorModeChange = useCallback(
    (mode: ChartCursorReadoutMode) => {
      updateChartPreferences((current) => ({ ...current, cursorReadoutMode: mode }));
    },
    [updateChartPreferences],
  );

  const updateEventOverlay = useCallback(
    <K extends keyof ChartEventOverlayPreferences,>(key: K, value: ChartEventOverlayPreferences[K]) => {
      updateChartPreferences((current) => ({
        ...current,
        eventOverlay: {
          ...current.eventOverlay,
          [key]: value,
        },
      }));
    },
    [updateChartPreferences],
  );
  const handlePreserveZoomChange = useCallback((preserve: boolean) => {
    if (!preserve) preserveZoomNextLoadRef.current = false;
    updateChartPreferences((current) => ({ ...current, preserveZoomOnMarketChange: preserve }));
  }, [updateChartPreferences]);

  const selectedChartEventKey = selectedChartEvent ? getChartEventKey(selectedChartEvent) : null;

  useEffect(() => {
    if (!selectedChartEvent || selectedReplayAnchorIndex == null) {
      setReplayCursorIndex(null);
      setReplayPlaying(false);
      return;
    }

    setReplayCursorIndex(selectedReplayAnchorIndex);
    setReplayPlaying(false);
  }, [selectedChartEventKey, selectedReplayAnchorIndex, selectedChartEvent]);

  useEffect(() => {
    if (!replayPlaying || replayCursorIndex == null) return;
    if (replayCursorIndex >= visibleCandles.length - 1) {
      setReplayPlaying(false);
      return;
    }

    const delayMs = Math.max(120, Math.round(850 / replaySpeed));
    const id = window.setInterval(() => {
      setReplayCursorIndex((current) => {
        if (current == null) return current;
        const next = Math.min(visibleCandles.length - 1, current + 1);
        if (next >= visibleCandles.length - 1) setReplayPlaying(false);
        return next;
      });
    }, delayMs);

    return () => window.clearInterval(id);
  }, [replayPlaying, replayCursorIndex, replaySpeed, visibleCandles.length]);

  const openChartDrawer = useCallback((mode: ChartDrawerMode) => {
    setChartDrawerMode(mode);
    setHistoryPanelOpen(true);
  }, []);

  const cancelPendingPairMatrixHover = useCallback(() => {
    if (pairMatrixHoverTimeoutRef.current != null) window.clearTimeout(pairMatrixHoverTimeoutRef.current);
    pairMatrixHoverTimeoutRef.current = null;
    pendingPairMatrixHoverRef.current = null;
  }, []);

  const schedulePairMatrixHover = useCallback((next: number | null) => {
    const hoverUpdate = resolvePairMatrixHoveredCandleUpdate(hoveredCandleChartTimeRef.current, next, pairMatrixHoverEnabledRef.current);
    if (!hoverUpdate.shouldUpdate && pairMatrixHoverTimeoutRef.current == null) return;
    pendingPairMatrixHoverRef.current = next;
    pairMatrixHoverLastMotionRef.current = performance.now();
    if (pairMatrixHoverTimeoutRef.current != null) return;

    const commitWhenSettled = () => {
      const remaining = getPairMatrixHoverSettleDelay(pairMatrixHoverLastMotionRef.current, performance.now());
      if (remaining > 0) {
        pairMatrixHoverTimeoutRef.current = window.setTimeout(commitWhenSettled, remaining);
        return;
      }
      pairMatrixHoverTimeoutRef.current = null;
      const settled = pendingPairMatrixHoverRef.current;
      pendingPairMatrixHoverRef.current = null;
      if (!pairMatrixHoverEnabledRef.current || hoveredCandleChartTimeRef.current === settled) return;
      hoveredCandleChartTimeRef.current = settled;
      pairMatrixHoverRuntimeRef.current.publishAnchor(settled);
    };
    pairMatrixHoverTimeoutRef.current = window.setTimeout(commitWhenSettled, PAIR_MATRIX_HOVER_SETTLE_MS);
  }, []);

  const closeEventLens = useCallback(() => {
    setActiveChartEventClusterKey(null);
    setHoveredChartEventClusterKey(null);
    setSelectedChartEventCluster(null);
    setSelectedChartEvent(null);
    setEventLensExpanded(false);
    setReplayPlaying(false);
    setReplayCursorIndex(null);
  }, []);

  const resetReplay = useCallback(() => {
    if (selectedReplayAnchorIndex == null) return;
    setReplayCursorIndex(selectedReplayAnchorIndex);
    setReplayPlaying(false);
  }, [selectedReplayAnchorIndex]);

  const stepReplay = useCallback(() => {
    if (replayCursorIndex == null) return;
    setReplayPlaying(false);
    setReplayCursorIndex((current) =>
      current == null ? current : Math.min(visibleCandles.length - 1, current + replayStepCandles),
    );
  }, [replayCursorIndex, replayStepCandles, visibleCandles.length]);

  const toggleReplayPlayback = useCallback(() => {
    if (selectedReplayAnchorIndex == null) return;
    setReplayCursorIndex((current) =>
      current == null || current >= visibleCandles.length - 1 ? selectedReplayAnchorIndex : current,
    );
    setReplayPlaying((current) => !current);
  }, [selectedReplayAnchorIndex, visibleCandles.length]);

  const resetChartPreferences = useCallback(() => {
    setChartPreferences(DEFAULT_CHART_PREFERENCES);
    saveChartPreferences(DEFAULT_CHART_PREFERENCES);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartRef.current) return;
    const timeFormatters = getChartTimeFormatters(timeframe, displayTimeMode, chartSourceTimeOffsetSeconds);
    const appearance = chartPreferences.appearance;
    const gridColor = getChartGridColor(appearance);

    const chart = createChart(container, {
      layout: getChartLayoutOptions(appearance),
      rightPriceScale: { 
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.16 }
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 5,
        barSpacing: 10,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: timeFormatters.tickMarkFormatter,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: getCrosshairMode(chartPreferences.cursorReadoutMode),
        vertLine: { labelBackgroundColor: appearance.crosshairColor },
        horzLine: { labelBackgroundColor: appearance.crosshairColor, labelVisible: false },
      },
      localization: {
        timeFormatter: timeFormatters.timeFormatter,
      },
    });

    const series = chart.addSeries(CandlestickSeries, getChartSeriesAppearanceOptions(appearance));

    chartRef.current = chart;
    seriesRef.current = series;
    const handleChartClick = (params: MouseEventParams<Time>) => {
      const markerId = typeof params.hoveredObjectId === "string" ? params.hoveredObjectId : null;
      const signal = markerId ? macroBiasSignalByMarkerIdRef.current.get(markerId) : null;
      if (signal) setSelectedMacroBiasId(signal.id);
    };
    chart.subscribeClick(handleChartClick);

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.applyOptions({ width: rect.width, height: rect.height });
        schedulePairMatrixGeometryUpdate();
        setChartLayoutRevision((current) => current + 1);
      }
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);

    let geometryTrackingFrame: number | null = null;
    let geometryWheelTimeout: number | null = null;
    const trackGeometry = () => {
      schedulePairMatrixGeometryUpdate();
      geometryTrackingFrame = window.requestAnimationFrame(trackGeometry);
    };
    const startGeometryTracking = () => {
      if (!pairMatrixOpenRef.current || geometryTrackingFrame != null) return;
      trackGeometry();
    };
    const stopGeometryTracking = () => {
      if (geometryTrackingFrame != null) {
        window.cancelAnimationFrame(geometryTrackingFrame);
        geometryTrackingFrame = null;
      }
      schedulePairMatrixGeometryUpdate();
    };
    const handleGeometryWheel = () => {
      startGeometryTracking();
      if (geometryWheelTimeout != null) window.clearTimeout(geometryWheelTimeout);
      geometryWheelTimeout = window.setTimeout(() => {
        geometryWheelTimeout = null;
        stopGeometryTracking();
      }, 140);
    };
    container.addEventListener("pointerdown", startGeometryTracking, true);
    container.addEventListener("wheel", handleGeometryWheel, { passive: true, capture: true });
    window.addEventListener("pointerup", stopGeometryTracking, true);
    window.addEventListener("pointercancel", stopGeometryTracking, true);
    window.addEventListener("blur", stopGeometryTracking);

    return () => {
      observer.disconnect();
      container.removeEventListener("pointerdown", startGeometryTracking, true);
      container.removeEventListener("wheel", handleGeometryWheel, true);
      window.removeEventListener("pointerup", stopGeometryTracking, true);
      window.removeEventListener("pointercancel", stopGeometryTracking, true);
      window.removeEventListener("blur", stopGeometryTracking);
      if (geometryWheelTimeout != null) window.clearTimeout(geometryWheelTimeout);
      if (geometryTrackingFrame != null) window.cancelAnimationFrame(geometryTrackingFrame);
      chart.unsubscribeClick(handleChartClick);
      macroBiasMarkersRef.current?.detach();
      macroBiasMarkersRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [schedulePairMatrixGeometryUpdate]);

  const macroBiasSupported = isMacroBiasMarketSupported(selectedSymbol);
  const macroBiasCurrencies = useMemo(() => {
    const symbol = selectedSymbol.toUpperCase();
    return symbol.length === 6 ? new Set([symbol.slice(0, 3), symbol.slice(3)]) : new Set<string>();
  }, [selectedSymbol]);
  const macroBiasFrom = visibleCandles[0]?.time;
  const macroBiasTo = visibleCandles[visibleCandles.length - 1]?.time;
  const macroBiasCurrentCalendarRevision = useMemo(() => {
    if (!macroBiasSupported) return "";
    return events
      .filter((event) => macroBiasCurrencies.has(event.currency))
      .sort((left, right) => right.time - left.time || right.id - left.id)
      .slice(0, 64)
      .map((event) => `${event.id}:${event.time}:${event.actual}:${event.forecast}:${event.previous}`)
      .join("|");
  }, [events, macroBiasCurrencies, macroBiasSupported]);
  const macroBiasCurrentRequestKey = getMacroBiasRequestScope({
    mode: "current",
    symbol: selectedSymbol,
    timeframe: "H4",
    calendarRevision: macroBiasCurrentCalendarRevision,
  });
  useEffect(() => {
    if (!macroBiasSupported) {
      setMacroBiasCurrentResponse(null);
      setMacroBiasCurrentLoading(false);
      setMacroBiasCurrentError(null);
      return;
    }
    let cancelled = false;
    const globalMarket = getPreloadedMacroSignalGlobalRegistry()?.markets.find(
      (market) => market.symbol === selectedSymbol.toUpperCase(),
    ) ?? null;
    const reusableResponse = (macroBiasCurrentResponse?.supported
      && macroBiasCurrentResponse.symbol === selectedSymbol)
      ? macroBiasCurrentResponse
      : globalMarket;
    if (globalMarket && reusableResponse === globalMarket) setMacroBiasCurrentResponse(globalMarket);
    if (!reusableResponse) setMacroBiasCurrentResponse(null);
    setMacroBiasCurrentLoading(!reusableResponse);
    setMacroBiasCurrentError(null);
    const request = selectedSymbol.toUpperCase() === "EURUSD" && !macroBiasCurrentResponse && !macroBiasCurrentCalendarRevision
      ? preloadMacroSignalCurrentModel()
      : fetchMacroSignalChartSignals({ symbol: selectedSymbol, timeframe: "H4", mode: "current" });
    request
      .then((response) => {
        if (!cancelled) setMacroBiasCurrentResponse(response);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (!reusableResponse) setMacroBiasCurrentResponse(null);
          setMacroBiasCurrentError(error instanceof Error ? error.message : "Current Macro Bias model could not be loaded");
        }
      })
      .finally(() => {
        if (!cancelled) setMacroBiasCurrentLoading(false);
      });
    return () => { cancelled = true; };
  }, [macroBiasSupported, macroBiasCurrentRequestKey]);

  useEffect(() => {
    if (!macroBiasVisible) return;
    let cancelled = false;
    const cached = getPreloadedMacroSignalGlobalRegistry();
    if (cached) setMacroBiasGlobalResponse(cached);
    setMacroBiasGlobalLoading(!cached);
    setMacroBiasGlobalError(null);
    preloadMacroSignalGlobalRegistry()
      .then((response) => { if (!cancelled) setMacroBiasGlobalResponse(response); })
      .catch((error: unknown) => {
        if (!cancelled) setMacroBiasGlobalError(error instanceof Error ? error.message : "Global FMS registry could not be loaded");
      })
      .finally(() => { if (!cancelled) setMacroBiasGlobalLoading(false); });
    return () => { cancelled = true; };
  }, [macroBiasVisible]);

  useEffect(() => {
    if (!macroBiasVisible) return undefined;
    let cancelled = false;
    let requestRunning = false;
    const refreshLifecycle = () => {
      if (requestRunning) return;
      requestRunning = true;
      refreshMacroSignalGlobalRegistry()
        .then((response) => {
          if (cancelled) return;
          setMacroBiasGlobalResponse((current) => shouldApplyMacroBiasRefresh(current, response) ? response : current);
          setMacroBiasGlobalError(null);
        })
        .catch(() => { /* retain the last honest lifecycle state */ })
        .finally(() => { requestRunning = false; });
    };
    refreshLifecycle();
    const timer = window.setInterval(refreshLifecycle, MACRO_BIAS_LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [macroBiasVisible]);

  useEffect(() => {
    if (!macroBiasSupported || !macroBiasVisible || !macroBiasHistoricalMatchesVisible || historyState !== "ready" || visibleCandles.length === 0) {
      setMacroBiasShadowHistoryResponse(null);
      return;
    }
    let cancelled = false;
    setMacroBiasShadowHistoryResponse(null);
    const latestLoadedTime = macroBiasTo ?? Math.floor(Date.now() / 1_000);
    const recentFrom = Math.max(0, latestLoadedTime - 366 * 24 * 60 * 60);
    let completeHistoryApplied = false;
    const recentRequest = fetchMacroSignalChartSignals({
      symbol: selectedSymbol,
      timeframe: "H4",
      mode: "research_replay",
      from: recentFrom,
      to: latestLoadedTime,
      compact: true,
    }).then((response) => {
      if (!cancelled && !completeHistoryApplied) setMacroBiasShadowHistoryResponse(response);
    }).catch(() => { /* the complete request can still succeed */ });
    const completeRequest = fetchMacroSignalChartSignals({ symbol: selectedSymbol, timeframe: "H4", mode: "research_replay", compact: true })
      .then((response) => {
        if (!cancelled) {
          completeHistoryApplied = true;
          setMacroBiasShadowHistoryResponse(response);
        }
      })
      .catch(() => { /* retain a successful recent response */ });
    void Promise.allSettled([recentRequest, completeRequest]);
    return () => { cancelled = true; };
  }, [macroBiasHistoricalMatchesVisible, macroBiasSupported, macroBiasVisible, selectedSymbol, historyState, macroBiasTo]);

  const macroBiasResponse = macroBiasCurrentResponse;
  const macroBiasLoading = macroBiasCurrentLoading;
  const macroBiasError = macroBiasCurrentError;
  const macroBiasShadowHistoricalSignals = useMemo(() => {
    if (!macroBiasShadowHistoryResponse?.supported) return null;
    const eligiblePatternIds = new Set(
      macroBiasShadowHistoryResponse.patterns
        .filter((pattern) => pattern.currentEligible)
        .map((pattern) => pattern.id),
    );
    return macroBiasShadowHistoryResponse.signals.filter((signal) => eligiblePatternIds.has(signal.patternId));
  }, [macroBiasShadowHistoryResponse]);
  const macroBiasDisplaySignals = useMemo(() => {
    if (!macroBiasResponse?.supported) return [];
    if (!macroBiasHistoricalMatchesVisible || !macroBiasShadowHistoricalSignals) {
      return macroBiasResponse.signals;
    }
    const combined = new Map<string, MacroSignalChartSignal>();
    macroBiasShadowHistoricalSignals.forEach((signal) => combined.set(signal.id, signal));
    macroBiasResponse.signals.forEach((signal) => combined.set(signal.id, signal));
    return [...combined.values()].sort((left, right) => left.eventTime - right.eventTime || left.id.localeCompare(right.id));
  }, [macroBiasHistoricalMatchesVisible, macroBiasResponse, macroBiasShadowHistoricalSignals]);

  useEffect(() => {
    const series = seriesRef.current;
    macroBiasMarkersRef.current?.detach();
    macroBiasMarkersRef.current = null;
    macroBiasSignalByMarkerIdRef.current.clear();
    if (!series || !macroBiasVisible || !macroBiasResponse?.supported) return;
    const built = buildMacroBiasSeriesMarkers(
      macroBiasDisplaySignals,
      visibleCandles,
      timeframe,
      chartSourceTimeOffsetSeconds,
    );
    macroBiasSignalByMarkerIdRef.current = built.signalByMarkerId;
    macroBiasMarkersRef.current = createSeriesMarkers(series, built.markers);
    return () => {
      macroBiasMarkersRef.current?.detach();
      macroBiasMarkersRef.current = null;
      macroBiasSignalByMarkerIdRef.current.clear();
    };
  }, [macroBiasVisible, macroBiasResponse, macroBiasDisplaySignals, chartSourceTimeOffsetSeconds, macroBiasFrom, macroBiasTo, timeframe]);

  const selectedMacroBias = macroBiasDisplaySignals.find((signal) => signal.id === selectedMacroBiasId) ?? null;
  const selectedMacroBiasPattern = selectedMacroBias
    ? macroBiasResponse?.patterns.find((pattern) => pattern.id === selectedMacroBias.patternId) ?? null
    : null;
  const selectedMacroBiasActivationOpen = selectedMacroBias
    ? getMacroBiasActivationCandleOpen(selectedMacroBias, visibleCandles, chartSourceTimeOffsetSeconds, timeframe)
    : null;
  const selectedMacroBiasLadderKey = selectedMacroBias ? `${selectedSymbol}:${selectedMacroBias.id}` : null;
  const selectedMacroBiasAudit = selectedMacroBiasLadderKey ? macroBiasSignalAudits[selectedMacroBiasLadderKey] : undefined;
  useEffect(() => {
    if (!selectedMacroBias || !selectedMacroBiasLadderKey || selectedMacroBiasAudit) return;
    let cancelled = false;
    fetchMacroSignalTargetLadder({
      symbol: selectedSymbol,
      patternId: selectedMacroBias.patternId,
      eventTime: selectedMacroBias.eventTime,
      mode: selectedMacroBias.historicalReplay ? "research_replay" : "current",
    }).then(({ signal }) => {
      if (!cancelled) setMacroBiasSignalAudits((current) => ({ ...current, [selectedMacroBiasLadderKey]: signal }));
    }).catch(() => { /* The frozen target remains available if path research cannot load. */ });
    return () => { cancelled = true; };
  }, [selectedMacroBias, selectedMacroBiasLadderKey, selectedMacroBiasAudit, selectedSymbol]);
  const selectedMacroBiasWithTargetLadder = selectedMacroBias?.historicalReplay
    ? selectedMacroBiasAudit ?? null
    : selectedMacroBiasAudit ?? selectedMacroBias;
  useEffect(() => {
    const series = seriesRef.current;
    macroBiasTradeLinesRef.current.forEach((line) => series?.removePriceLine(line));
    macroBiasTradeLinesRef.current = [];
    if (!series || !selectedMacroBiasWithTargetLadder) return;
    macroBiasTradeLinesRef.current = buildMacroBiasPriceLineLevels(selectedMacroBiasWithTargetLadder).map((level) => series.createPriceLine({
        price: level.value,
        color: level.color,
        lineWidth: 1,
        lineStyle: level.lineStyle,
        axisLabelVisible: true,
        title: level.title,
      }));
    return () => {
      macroBiasTradeLinesRef.current.forEach((line) => series.removePriceLine(line));
      macroBiasTradeLinesRef.current = [];
    };
  }, [selectedMacroBiasWithTargetLadder]);
  const macroBiasAudit = selectedMacroBiasWithTargetLadder && selectedMacroBiasPattern && macroBiasResponse ? {
    signal: selectedMacroBiasWithTargetLadder.activationTime == null && selectedMacroBiasActivationOpen != null
      ? { ...selectedMacroBiasWithTargetLadder, activationTime: selectedMacroBiasActivationOpen - chartSourceTimeOffsetSeconds }
      : selectedMacroBiasWithTargetLadder,
    pattern: selectedMacroBiasPattern,
    symbol: macroBiasResponse.symbol,
    versionId: selectedMacroBiasPattern.sourceVersionId,
    modelId: macroBiasResponse.modelId,
    modelHash: macroBiasResponse.modelHash,
    datasetFingerprint: macroBiasResponse.datasetFingerprint,
    mode: (selectedMacroBiasWithTargetLadder.historicalReplay ? "research_replay" : "current") as MacroSignalChartMode,
    generatedAt: macroBiasResponse.generatedAt,
    onClose: () => setSelectedMacroBiasId(null),
  } : null;

  const macroBiasActiveState = useMemo(
    () => macroBiasResponse?.supported
      ? getMacroBiasActiveState(macroBiasResponse.signals, visibleCandles, chartSourceTimeOffsetSeconds, timeframe)
      : null,
    [macroBiasResponse, visibleCandles, chartSourceTimeOffsetSeconds, timeframe],
  );
  const macroBiasActivePattern = useMemo(() => macroBiasActiveState
    ? macroBiasResponse?.patterns.find((pattern) => pattern.id === macroBiasActiveState.signal.patternId) ?? null
    : null, [macroBiasActiveState, macroBiasResponse?.patterns]);
  const macroBiasRealtime = useMemo<ChartMacroBiasRealtimeCardData | null>(() => macroBiasVisible
    && macroBiasResponse?.supported
    ? {
        response: macroBiasResponse,
        activeSignal: macroBiasActiveState?.signal ?? null,
        activePattern: macroBiasActivePattern,
        remainingModelCandles: macroBiasActiveState?.remainingCandles ?? null,
        chartTimeframe: timeframe,
        historicalSignals: macroBiasShadowHistoricalSignals,
        globalResponse: macroBiasGlobalResponse,
        globalLoading: macroBiasGlobalLoading,
        globalError: macroBiasGlobalError,
      }
    : null, [
      macroBiasActivePattern,
      macroBiasActiveState,
      macroBiasGlobalError,
      macroBiasGlobalLoading,
      macroBiasGlobalResponse,
      macroBiasResponse,
      macroBiasShadowHistoricalSignals,
      macroBiasVisible,
      timeframe,
    ]);
  const macroBiasActiveLabel = macroBiasActiveState
      ? macroBiasActiveState.remainingCandles == null
        ? `Trade active · ${macroBiasActiveState.signal.direction === "long" ? "Long" : "Short"} ${selectedSymbol}`
        : `Trade active · ${macroBiasActiveState.signal.direction === "long" ? "Long" : "Short"} ${selectedSymbol} · ${macroBiasActiveState.remainingCandles} H4 left`
      : macroBiasError
        ? "FMS scanner could not be loaded"
      : macroBiasLoading
        ? "Loading FMS scanner"
        : `Scanning registered ${selectedSymbol} events`;

  const toggleMacroBias = useCallback(() => {
    setMacroBiasVisible((current) => {
      const next = !current;
      try { window.localStorage.setItem(MACRO_BIAS_VISIBILITY_KEY, String(next)); } catch { /* optional preference */ }
      if (!next) setSelectedMacroBiasId(null);
      return next;
    });
  }, []);

  const toggleMacroBiasHistoricalMatches = useCallback(() => {
    setMacroBiasHistoricalMatchesVisible((current) => {
      const next = !current;
      try { window.localStorage.setItem(MACRO_BIAS_HISTORICAL_MATCHES_KEY, String(next)); } catch { /* optional preference */ }
      if (!next) setSelectedMacroBiasId(null);
      return next;
    });
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const timeFormatters = getChartTimeFormatters(timeframe, displayTimeMode, chartSourceTimeOffsetSeconds);
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: timeFormatters.tickMarkFormatter,
      },
      localization: {
        timeFormatter: timeFormatters.timeFormatter,
      },
    });
  }, [timeframe, displayTimeMode, chartSourceTimeOffsetSeconds]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const appearance = chartPreferences.appearance;
    const gridColor = getChartGridColor(appearance);

    chart.applyOptions({
      layout: getChartLayoutOptions(appearance),
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: getCrosshairMode(chartPreferences.cursorReadoutMode),
        vertLine: { labelBackgroundColor: appearance.crosshairColor },
        horzLine: { labelBackgroundColor: appearance.crosshairColor, labelVisible: false },
      },
    });

    series.applyOptions(getChartSeriesAppearanceOptions(appearance));
  }, [chartPreferences]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.setData(displayCandles);
  }, [displayCandles]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const container = containerRef.current;
    if (!chart || !series || !container) return;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const point = param.point;
      if (!point || point.x < 0 || point.y < 0 || point.x > container.clientWidth || point.y > container.clientHeight) {
        crosshairReadoutRef.current?.update(null);
        if (pairMatrixHoverEnabledRef.current) schedulePairMatrixHover(null);
        return;
      }

      const truePrice = series.coordinateToPrice(point.y);
      const candle = param.seriesData?.get(series) as CandlestickData<Time> | undefined;
      const candlePrice = candle && typeof candle.close === "number" ? candle.close : null;
      const candleTime = candle ? normalizeChartTimestampSeconds(candle.time) : null;
      if (pairMatrixHoverEnabledRef.current) schedulePairMatrixHover(candleTime);
      const lines = formatCursorReadout({
        mode: chartPreferences.cursorReadoutMode,
        truePrice,
        candlePrice,
        precision: priceFormat.precision,
      });

      if (lines.length === 0) {
        crosshairReadoutRef.current?.update(null);
        return;
      }

      const readoutTop =
        chartPreferences.cursorReadoutMode === "nearest_candle" && candlePrice != null
          ? series.priceToCoordinate(candlePrice) ?? point.y
          : point.y;
      const clampedReadoutTop = Math.min(Math.max(readoutTop, 32), container.clientHeight - 32);

      crosshairReadoutRef.current?.update({
        lines,
        top: clampedReadoutTop,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      crosshairReadoutRef.current?.update(null);
      cancelPendingPairMatrixHover();
      hoveredCandleChartTimeRef.current = null;
      pairMatrixHoverRuntimeRef.current.publishAnchor(null);
    };
  }, [cancelPendingPairMatrixHover, chartPreferences.cursorReadoutMode, priceFormat.precision, schedulePairMatrixHover]);

  useEffect(() => cancelPendingPairMatrixHover, [cancelPendingPairMatrixHover]);

  useEffect(() => {
    if (pairMatrixOpen) return;
    cancelPendingPairMatrixHover();
    hoveredCandleChartTimeRef.current = null;
    pairMatrixHoverRuntimeRef.current.publishAnchor(null);
    pairMatrixCoverageWindowKeyRef.current = "";
    setPairMatrixCoverageAnchor(null);
  }, [cancelPendingPairMatrixHover, pairMatrixOpen]);

  useEffect(() => {
    if (!pairMatrixLockedRange) return;
    cancelPendingPairMatrixHover();
    hoveredCandleChartTimeRef.current = null;
    pairMatrixHoverRuntimeRef.current.publishAnchor(null);
  }, [cancelPendingPairMatrixHover, pairMatrixLockedRange]);

  useEffect(() => {
    cancelPendingPairMatrixHover();
    hoveredCandleChartTimeRef.current = null;
    pairMatrixHoverRuntimeRef.current.publishAnchor(null);
    pairMatrixCoverageWindowKeyRef.current = "";
    setPairMatrixCoverageAnchor(null);
    setPairMatrixLockedRange(null);
    setPairMatrixLockedInterval(null);
    setPairMatrixRangeArmed(false);
    setPairMatrixRangeEditing(false);
    setPairMatrixRangeCancelRevision((current) => current + 1);
  }, [cancelPendingPairMatrixHover, selectedSymbol]);

  useEffect(() => {
    cancelPendingPairMatrixHover();
    hoveredCandleChartTimeRef.current = null;
    pairMatrixHoverRuntimeRef.current.publishAnchor(null);
    pairMatrixCoverageWindowKeyRef.current = "";
    setPairMatrixCoverageAnchor(null);
    setPairMatrixRangeArmed(false);
    setPairMatrixRangeEditing(false);
    setPairMatrixRangeCancelRevision((current) => current + 1);
  }, [cancelPendingPairMatrixHover, timeframe]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!pairMatrixRangeArmed && !pairMatrixLockedRange)) return;
      setPairMatrixLockedRange(null);
      setPairMatrixLockedInterval(null);
      setPairMatrixRangeArmed(false);
      setPairMatrixRangeEditing(false);
      setPairMatrixRangeCancelRevision((current) => current + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pairMatrixRangeArmed, pairMatrixLockedRange]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const selecting = pairMatrixRangeArmed || pairMatrixRangeEditing;
    chart.applyOptions({ handleScroll: !selecting, handleScale: !selecting });
  }, [pairMatrixRangeArmed, pairMatrixRangeEditing]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({
      priceFormat,
    });
    shouldRefocusRef.current = true;
  }, [priceFormat, selectedSymbol, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const onRangeChange = () => {
      schedulePairMatrixGeometryUpdate();
      if (!preserveZoomNextLoadRef.current) {
        chartZoomSnapshotRef.current = captureChartZoomSnapshot(
          chart.timeScale().getVisibleLogicalRange(),
          visibleCandleCountRef.current - 1,
        );
      }
      const pairMatrixActive = pairMatrixOpenRef.current;
      const updateCadence = getChartRangeUpdateCadence(pairMatrixActive);
      if (!pairMatrixActive) setChartInteracting(true);
      if (updateCadence === "animation_frame" && rangeAnimationFrameRef.current == null) {
        rangeAnimationFrameRef.current = window.requestAnimationFrame(() => {
          rangeAnimationFrameRef.current = null;
          setChartRangeRevision((current) => current + 1);
        });
      }

      if (rangeSettleTimeoutRef.current != null) {
        window.clearTimeout(rangeSettleTimeoutRef.current);
      }
      rangeSettleTimeoutRef.current = window.setTimeout(() => {
        rangeSettleTimeoutRef.current = null;
        if (!pairMatrixOpenRef.current) setChartInteracting(false);
        setChartRangeRevision((current) => current + 1);
      }, 120);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      if (rangeAnimationFrameRef.current != null) {
        window.cancelAnimationFrame(rangeAnimationFrameRef.current);
        rangeAnimationFrameRef.current = null;
      }
      if (rangeSettleTimeoutRef.current != null) {
        window.clearTimeout(rangeSettleTimeoutRef.current);
        rangeSettleTimeoutRef.current = null;
      }
    };
  }, [schedulePairMatrixGeometryUpdate]);

  const applyPreservedChartZoom = useCallback((): boolean => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const snapshot = chartZoomSnapshotRef.current;
    if (!chart || !series || !snapshot || visibleCandles.length === 0) return false;
    chart.timeScale().setVisibleLogicalRange(restoreChartZoomRange(snapshot, visibleCandles.length - 1));
    series.priceScale().setAutoScale(true);
    return true;
  }, [visibleCandles.length]);

  useEffect(() => {
    if (historyState !== "ready" || displayCandles.length === 0 || !shouldRefocusRef.current) return;
    const id = window.setTimeout(() => {
      const preserved = preserveZoomNextLoadRef.current && applyPreservedChartZoom();
      if (!preserved) refocusChart();
      skipNextFutureRefocusRef.current = preserved;
      preserveZoomNextLoadRef.current = false;
      shouldRefocusRef.current = false;
    }, 0);
    return () => window.clearTimeout(id);
  }, [historyState, displayCandles, applyPreservedChartZoom, refocusChart]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || historyState !== "ready" || visibleCandles.length === 0 || futureChartEventTimes.length === 0) return;

    const signature = futureChartEventTimes.join(",");
    if (futureRefocusSignatureRef.current === signature) return;
    futureRefocusSignatureRef.current = signature;
    if (preserveZoomNextLoadRef.current) return;
    if (skipNextFutureRefocusRef.current) {
      skipNextFutureRefocusRef.current = false;
      return;
    }

    const range = chart.timeScale().getVisibleLogicalRange();
    const lastIndex = visibleCandles.length - 1;
    const isNearLatest = !range || range.to >= lastIndex - 2;
    if (!isNearLatest || chartInteracting) return;

    const id = window.setTimeout(refocusChart, 0);
    return () => window.clearTimeout(id);
  }, [historyState, visibleCandles.length, futureChartEventTimes, chartInteracting, refocusChart]);

  const feedLabel = lastCandleTime
    ? `Latest candle: ${formatChartHeaderFeedTime(lastCandleTime, displayTimeMode, chartSourceTimeOffsetSeconds)}`
    : "Waiting for data";
  const cacheOldestLabel = cacheSummary.oldestTime
    ? formatChartFeedTime(cacheSummary.oldestTime, displayTimeMode, chartSourceTimeOffsetSeconds)
    : "Empty";
  const cacheLatestLabel = cacheSummary.latestTime
    ? formatChartFeedTime(cacheSummary.latestTime, displayTimeMode, chartSourceTimeOffsetSeconds)
    : "Empty";
  const streamStatusLabel =
    getChartConnectionLabel({ historyState, marketStatus: activeMarketStatus, streamConnected });

  const chartEventOverlay = useChartEventOverlay({
    enabled: !pairMatrixOpen,
    chartRef,
    containerRef,
    events,
    selectedSymbol,
    visibleCandles,
    timeframe,
    displayTimeMode,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
    preferences: chartPreferences.eventOverlay,
    isInteracting: chartInteracting,
    chartRangeRevision,
    chartLayoutRevision,
  });

  const macroFactorRows = useMemo(() => {
    const currencies = getChartEventRelevantCurrencies(selectedSymbol);
    return buildMacroFactorRows({
      events,
      currencies,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
  }, [events, selectedSymbol]);

  const pairMatrixCurrencies = useMemo(() => getPairMatrixForexCurrencies(selectedSymbol), [selectedSymbol]);
  const pairMatrixCandleTimes = useMemo(
    () => pairMatrixOpen ? visibleCandles.map((candle) => candle.time) : [],
    [pairMatrixOpen, visibleCandles],
  );
  const pairMatrixCandleIndexByTime = useMemo(
    () => new Map(pairMatrixCandleTimes.map((time, index) => [time, index])),
    [pairMatrixCandleTimes],
  );
  useEffect(() => {
    if (!pairMatrixLockedInterval || pairMatrixCandleTimes.length === 0) return;
    const remapped = remapPairMatrixTimeInterval(pairMatrixCandleTimes, pairMatrixLockedInterval, timeframe);
    if (!remapped) return;
    setPairMatrixLockedRange((current) => (
      current
      && current.firstOpen === remapped.firstOpen
      && current.lastOpen === remapped.lastOpen
      && current.close === remapped.close
      && current.candleCount === remapped.candleCount
        ? current
        : remapped
    ));
  }, [pairMatrixCandleTimes, pairMatrixLockedInterval, timeframe]);
  const pairMatrixFallbackOpen = pairMatrixOpen ? lastCandleTime ?? null : null;
  const pairMatrixFallbackRange = useMemo(
    () => pairMatrixFallbackOpen == null
      ? null
      : normalizePairMatrixCandleRange(pairMatrixCandleTimes, pairMatrixFallbackOpen, pairMatrixFallbackOpen, timeframe),
    [pairMatrixCandleTimes, pairMatrixFallbackOpen, timeframe],
  );
  const pairMatrixRange = pairMatrixOpen ? pairMatrixLockedRange ?? pairMatrixFallbackRange : null;
  const pairMatrixCoverageRange = useMemo(() => {
    if (!pairMatrixOpen) return null;
    if (pairMatrixLockedRange) return pairMatrixLockedRange;
    const anchor = pairMatrixCoverageAnchor ?? pairMatrixFallbackOpen;
    return anchor == null ? null : normalizePairMatrixCandleRange(pairMatrixCandleTimes, anchor, anchor, timeframe);
  }, [pairMatrixOpen, pairMatrixLockedRange, pairMatrixCoverageAnchor, pairMatrixFallbackOpen, pairMatrixCandleTimes, timeframe]);
  const pairMatrixRangeOpenCalendarTime = pairMatrixRange == null
    ? null
    : pairMatrixRange.firstOpen - chartSourceTimeOffsetSeconds;
  const pairMatrixRangeCloseCalendarTime = pairMatrixRange == null
    ? null
    : pairMatrixRange.close - chartSourceTimeOffsetSeconds;
  const pairMatrixDuringThrough = pairMatrixRangeOpenCalendarTime == null || pairMatrixRangeCloseCalendarTime == null
    ? null
    : Math.min(
        pairMatrixRangeCloseCalendarTime - 1,
        Math.max(pairMatrixRangeOpenCalendarTime, activeMarketStatus?.checked_at ?? Math.floor(Date.now() / 1000)),
      );
  const pairMatrixCoverageOpenCalendarTime = pairMatrixCoverageRange == null
    ? null
    : pairMatrixCoverageRange.firstOpen - chartSourceTimeOffsetSeconds;
  const pairMatrixCoverageCloseCalendarTime = pairMatrixCoverageRange == null
    ? null
    : pairMatrixCoverageRange.close - chartSourceTimeOffsetSeconds;
  const pairMatrixWindow = useMemo(
    () => pairMatrixCoverageOpenCalendarTime == null || pairMatrixCoverageCloseCalendarTime == null
      ? null
      : getPairMatrixTimelineWindow(pairMatrixCoverageOpenCalendarTime, pairMatrixCoverageCloseCalendarTime, pairMatrixBeforeDays),
    [pairMatrixCoverageOpenCalendarTime, pairMatrixCoverageCloseCalendarTime, pairMatrixBeforeDays],
  );
  const pairMatrixMarkerWindow = useMemo(() => {
    if (!pairMatrixOpen || pairMatrixCandleTimes.length === 0) return null;
    const chart = chartRef.current;
    const visibleRange = chart?.timeScale().getVisibleRange();
    const firstCandle = pairMatrixCandleTimes[0];
    const lastCandle = pairMatrixCandleTimes[pairMatrixCandleTimes.length - 1];
    const visibleFrom = typeof visibleRange?.from === "number" ? visibleRange.from : pairMatrixRange?.firstOpen ?? firstCandle;
    const visibleTo = typeof visibleRange?.to === "number" ? visibleRange.to : pairMatrixRange?.close ?? getPairMatrixCandleClose(lastCandle, timeframe);
    const fromChart = Math.max(firstCandle, visibleFrom);
    const toChart = Math.min(getPairMatrixCandleClose(lastCandle, timeframe), visibleTo);
    if (toChart < fromChart) return null;
    const day = 24 * 60 * 60;
    return {
      from: Math.floor((fromChart - chartSourceTimeOffsetSeconds) / day) * day,
      to: Math.ceil((toChart - chartSourceTimeOffsetSeconds) / day) * day,
    };
  }, [pairMatrixOpen, pairMatrixCandleTimes, pairMatrixRange, timeframe, chartSourceTimeOffsetSeconds, chartRangeRevision, chartLayoutRevision]);
  const pairMatrixCurrencyKey = pairMatrixCurrencies?.join("|") ?? "unsupported";
  const pairMatrixCalendarKey = pairMatrixWindow
    ? `${pairMatrixCurrencyKey}:${pairMatrixWindow.from}:${pairMatrixWindow.to}`
    : null;
  const pairMatrixMarkerCalendarKey = pairMatrixMarkerWindow
    ? `markers:${pairMatrixCurrencyKey}:${pairMatrixMarkerWindow.from}:${pairMatrixMarkerWindow.to}`
    : null;

  useEffect(() => {
    if (!pairMatrixOpen || pairMatrixLockedRange || !pairMatrixCurrencies || pairMatrixCandleTimes.length === 0) return;
    const considerAnchor = (publishedAnchor: number | null) => {
      const anchor = publishedAnchor ?? pairMatrixFallbackOpen;
      if (anchor == null) return;
      const range = normalizePairMatrixCandleRange(pairMatrixCandleTimes, anchor, anchor, timeframe);
      if (!range) return;
      const window = getPairMatrixTimelineWindow(
        range.firstOpen - chartSourceTimeOffsetSeconds,
        range.close - chartSourceTimeOffsetSeconds,
        pairMatrixBeforeDays,
      );
      const key = `${pairMatrixCurrencyKey}:${window.from}:${window.to}`;
      if (key === pairMatrixCoverageWindowKeyRef.current) return;
      pairMatrixCoverageWindowKeyRef.current = key;
      setPairMatrixCoverageAnchor(anchor);
    };
    pairMatrixCoverageWindowKeyRef.current = pairMatrixCalendarKey ?? "";
    considerAnchor(pairMatrixHoverRuntimeRef.current.getAnchor());
    return pairMatrixHoverRuntimeRef.current.subscribe(considerAnchor);
  }, [pairMatrixOpen, pairMatrixLockedRange, pairMatrixCurrencies, pairMatrixCandleTimes, pairMatrixFallbackOpen, timeframe, chartSourceTimeOffsetSeconds, pairMatrixBeforeDays, pairMatrixCurrencyKey, pairMatrixCalendarKey]);

  useEffect(() => {
    const requestId = ++pairMatrixCalendarRequestRef.current;
    if (!pairMatrixOpen || !pairMatrixCurrencies || !pairMatrixWindow || !pairMatrixCalendarKey) {
      setPairMatrixCalendarResult({ key: pairMatrixCalendarKey, state: "idle", events: [] });
      return;
    }

    const relevantCurrentEvents = events.filter((event) => pairMatrixCurrencies.includes(event.currency));
    if (calendarEventsCoverWindow(events, pairMatrixWindow.from, pairMatrixWindow.to)) {
      setPairMatrixCalendarResult({ key: pairMatrixCalendarKey, state: "ready", events: relevantCurrentEvents });
      return;
    }

    const exactCached = pairMatrixCalendarCacheRef.current.get(pairMatrixCalendarKey);
    const coveringCachedMatch = exactCached
      ? [pairMatrixCalendarKey, exactCached] as const
      : [...pairMatrixCalendarCacheRef.current.entries()].find(
          ([, entry]) =>
            entry.currencyKey === pairMatrixCurrencyKey
            && entry.from <= pairMatrixWindow.from
            && entry.to >= pairMatrixWindow.to,
        );
    if (coveringCachedMatch) {
      const [coveringKey, coveringCached] = coveringCachedMatch;
      pairMatrixCalendarCacheRef.current.delete(coveringKey);
      pairMatrixCalendarCacheRef.current.set(pairMatrixCalendarKey, coveringCached);
      setPairMatrixCalendarResult({ key: pairMatrixCalendarKey, state: "ready", events: coveringCached.events });
      return;
    }

    setPairMatrixCalendarResult({ key: pairMatrixCalendarKey, state: "loading", events: [] });
    const timeoutId = window.setTimeout(() => {
      const countries = pairMatrixCurrencies
        .map((currency) => CURRENCY_TO_COUNTRY_CODE[currency as keyof typeof CURRENCY_TO_COUNTRY_CODE])
        .filter((country): country is string => Boolean(country));
      let pendingRequest = pairMatrixCalendarPendingRef.current.get(pairMatrixCalendarKey);
      if (!pendingRequest) {
        pendingRequest = fetchCalendar({
          from: pairMatrixWindow.from,
          to: pairMatrixWindow.to,
          impacts: ["low", "medium", "high"],
          countries,
        });
        pairMatrixCalendarPendingRef.current.set(pairMatrixCalendarKey, pendingRequest);
        void pendingRequest.finally(() => {
          if (pairMatrixCalendarPendingRef.current.get(pairMatrixCalendarKey) === pendingRequest) {
            pairMatrixCalendarPendingRef.current.delete(pairMatrixCalendarKey);
          }
        }).catch(() => undefined);
      }
      void pendingRequest
        .then((loadedEvents) => {
          const relevantLoadedEvents = loadedEvents.filter((event) => pairMatrixCurrencies.includes(event.currency));
          const overlappingEvents = [...pairMatrixCalendarCacheRef.current.values()]
            .filter(
              (entry) =>
                entry.currencyKey === pairMatrixCurrencyKey
                && entry.from <= pairMatrixWindow.to
                && entry.to >= pairMatrixWindow.from,
            )
            .flatMap((entry) => entry.events);
          const mergedEvents = mergePairMatrixCalendarEvents(relevantCurrentEvents, overlappingEvents, relevantLoadedEvents);
          pairMatrixCalendarCacheRef.current.set(pairMatrixCalendarKey, {
            currencyKey: pairMatrixCurrencyKey,
            from: pairMatrixWindow.from,
            to: pairMatrixWindow.to,
            events: mergedEvents,
          });
          while (pairMatrixCalendarCacheRef.current.size > PAIR_MATRIX_HISTORY_CACHE_LIMIT) {
            const oldestKey = pairMatrixCalendarCacheRef.current.keys().next().value as string | undefined;
            if (!oldestKey) break;
            pairMatrixCalendarCacheRef.current.delete(oldestKey);
          }
          if (pairMatrixCalendarRequestRef.current !== requestId) return;
          setPairMatrixCalendarResult({ key: pairMatrixCalendarKey, state: "ready", events: mergedEvents });
        })
        .catch(() => {
          if (pairMatrixCalendarRequestRef.current !== requestId) return;
          setPairMatrixCalendarResult({ key: pairMatrixCalendarKey, state: "error", events: [] });
        });
    }, PAIR_MATRIX_HISTORY_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    pairMatrixOpen,
    pairMatrixCurrencies,
    pairMatrixCurrencyKey,
    pairMatrixWindow?.from,
    pairMatrixWindow?.to,
    pairMatrixCalendarKey,
    events,
  ]);

  useEffect(() => {
    const requestId = ++pairMatrixMarkerCalendarRequestRef.current;
    if (!pairMatrixOpen || !pairMatrixCurrencies || !pairMatrixMarkerWindow || !pairMatrixMarkerCalendarKey) {
      setPairMatrixMarkerCalendarEvents([]);
      setPairMatrixMarkerCalendarState("idle");
      return;
    }
    const relevantCurrentEvents = events.filter((event) => pairMatrixCurrencies.includes(event.currency));
    const overlappingEntries = [...pairMatrixCalendarCacheRef.current.values()].filter(
      (entry) => entry.currencyKey === pairMatrixCurrencyKey && entry.from <= pairMatrixMarkerWindow.to && entry.to >= pairMatrixMarkerWindow.from,
    );
    const baseline = mergePairMatrixCalendarEvents(relevantCurrentEvents, ...overlappingEntries.map((entry) => entry.events));
    const coveringCached = overlappingEntries.find((entry) => entry.from <= pairMatrixMarkerWindow.from && entry.to >= pairMatrixMarkerWindow.to);
    if (calendarEventsCoverWindow(events, pairMatrixMarkerWindow.from, pairMatrixMarkerWindow.to) || coveringCached) {
      setPairMatrixMarkerCalendarEvents(coveringCached ? mergePairMatrixCalendarEvents(baseline, coveringCached.events) : baseline);
      setPairMatrixMarkerCalendarState("ready");
      return;
    }

    setPairMatrixMarkerCalendarEvents(baseline);
    setPairMatrixMarkerCalendarState("loading");
    const timeoutId = window.setTimeout(() => {
      const countries = pairMatrixCurrencies
        .map((currency) => CURRENCY_TO_COUNTRY_CODE[currency as keyof typeof CURRENCY_TO_COUNTRY_CODE])
        .filter((country): country is string => Boolean(country));
      let pendingRequest = pairMatrixCalendarPendingRef.current.get(pairMatrixMarkerCalendarKey);
      if (!pendingRequest) {
        pendingRequest = fetchCalendar({ from: pairMatrixMarkerWindow.from, to: pairMatrixMarkerWindow.to, impacts: ["low", "medium", "high"], countries });
        pairMatrixCalendarPendingRef.current.set(pairMatrixMarkerCalendarKey, pendingRequest);
        void pendingRequest.finally(() => {
          if (pairMatrixCalendarPendingRef.current.get(pairMatrixMarkerCalendarKey) === pendingRequest) pairMatrixCalendarPendingRef.current.delete(pairMatrixMarkerCalendarKey);
        }).catch(() => undefined);
      }
      void pendingRequest.then((loadedEvents) => {
        if (pairMatrixMarkerCalendarRequestRef.current !== requestId) return;
        const relevantLoaded = loadedEvents.filter((event) => pairMatrixCurrencies.includes(event.currency));
        const merged = mergePairMatrixCalendarEvents(baseline, relevantLoaded);
        pairMatrixCalendarCacheRef.current.set(pairMatrixMarkerCalendarKey, {
          currencyKey: pairMatrixCurrencyKey,
          from: pairMatrixMarkerWindow.from,
          to: pairMatrixMarkerWindow.to,
          events: merged,
        });
        while (pairMatrixCalendarCacheRef.current.size > PAIR_MATRIX_HISTORY_CACHE_LIMIT) {
          const oldestKey = pairMatrixCalendarCacheRef.current.keys().next().value as string | undefined;
          if (!oldestKey) break;
          pairMatrixCalendarCacheRef.current.delete(oldestKey);
        }
        setPairMatrixMarkerCalendarEvents(merged);
        setPairMatrixMarkerCalendarState("ready");
      }).catch(() => {
        if (pairMatrixMarkerCalendarRequestRef.current === requestId) {
          setPairMatrixMarkerCalendarEvents(baseline);
          setPairMatrixMarkerCalendarState("error");
        }
      });
    }, PAIR_MATRIX_HISTORY_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [pairMatrixOpen, pairMatrixCurrencies, pairMatrixCurrencyKey, pairMatrixMarkerWindow?.from, pairMatrixMarkerWindow?.to, pairMatrixMarkerCalendarKey, events]);

  const pairMatrixLoadState: PairMatrixLoadState =
    !pairMatrixCurrencies || pairMatrixRangeOpenCalendarTime == null
      ? "idle"
      : pairMatrixCalendarResult.key === pairMatrixCalendarKey
        ? pairMatrixCalendarResult.state
        : "loading";
  const pairMatrixCalendarIndex = useMemo(
    () => pairMatrixOpen && pairMatrixCurrencies && pairMatrixLoadState === "ready"
      ? indexPairMatrixCalendar(pairMatrixCalendarResult.events, pairMatrixCurrencies)
      : indexPairMatrixCalendar([], []),
    [pairMatrixOpen, pairMatrixCurrencies, pairMatrixLoadState, pairMatrixCalendarResult.events],
  );
  const resolvePairMatrixDerived = useCallback((rangeOpen: number | null, rangeClose: number | null, duringThrough: number | null): PairMatrixDerivedSnapshot => {
    if (
      !pairMatrixCurrencies
      || rangeOpen == null
      || rangeClose == null
      || duringThrough == null
      || pairMatrixLoadState !== "ready"
    ) {
      const timeline = { during: [], before: [] } satisfies PairMatrixTimelineSnapshot;
      return { timeline, momentum: buildPairMatrixMomentumSnapshot(timeline, pairMatrixCurrencies ?? []) };
    }

    const cache = pairMatrixDerivedCacheRef.current;
    if (cache.index !== pairMatrixCalendarIndex) {
      cache.index = pairMatrixCalendarIndex;
      cache.values.clear();
    }
    const cacheKey = `${pairMatrixCurrencies.join("|")}:${rangeOpen}:${rangeClose}:${duringThrough}:${pairMatrixBeforeDays}`;
    const cached = cache.values.get(cacheKey);
    if (cached) return cached;

    const timeline = buildPairMatrixTimelineFromIndex({
      index: pairMatrixCalendarIndex,
      currencies: pairMatrixCurrencies,
      rangeOpen,
      rangeClose,
      duringThrough,
      beforeDays: pairMatrixBeforeDays,
    });
    const derived = { timeline, momentum: buildPairMatrixMomentumSnapshot(timeline, pairMatrixCurrencies) };
    cache.values.set(cacheKey, derived);
    while (cache.values.size > 128) cache.values.delete(cache.values.keys().next().value as string);
    return derived;
  }, [pairMatrixCurrencies, pairMatrixCalendarIndex, pairMatrixBeforeDays, pairMatrixLoadState]);
  const pairMatrixDerived = useMemo(
    () => resolvePairMatrixDerived(pairMatrixRangeOpenCalendarTime, pairMatrixRangeCloseCalendarTime, pairMatrixDuringThrough),
    [resolvePairMatrixDerived, pairMatrixRangeOpenCalendarTime, pairMatrixRangeCloseCalendarTime, pairMatrixDuringThrough],
  );
  const pairMatrixTimeline = pairMatrixDerived.timeline;
  const pairMatrixMomentum = pairMatrixDerived.momentum;
  const updatePairMatrixBeforeDays = useCallback((days: number) => {
    setPairMatrixBeforeDays(days);
    savePairMatrixBeforeDays(days);
  }, []);
  const pairMatrixRangeLabel = pairMatrixRange == null
    ? "Waiting for candle"
    : `${formatChartFeedTime(pairMatrixRange.firstOpen, displayTimeMode, chartSourceTimeOffsetSeconds)} → ${formatChartFeedTime(pairMatrixRange.close, displayTimeMode, chartSourceTimeOffsetSeconds)} · ${pairMatrixRange.candleCount} ${timeframe} ${pairMatrixRange.candleCount === 1 ? "candle" : "candles"}`;
  const pairMatrixRangeMoveLabel = getPairMatrixRangePipMoveLabel(
    visibleCandles,
    pairMatrixRange,
    pairMatrixCurrencies?.[1] ?? null,
  );
  const pairMatrixRangeBasisLabel: ChartPairMatrixTimeLensData["rangeBasisLabel"] = pairMatrixLockedRange
    ? "Locked range"
    : "Latest candle";
  const pairMatrixTimeLensBaseData = useMemo<ChartPairMatrixTimeLensData>(
    () => ({
      open: pairMatrixOpen,
      supported: pairMatrixCurrencies != null,
      pairLabel: selectedSymbol,
      currencies: pairMatrixCurrencies ?? [],
      timeline: pairMatrixTimeline,
      momentum: pairMatrixMomentum,
      rangeLabel: pairMatrixRangeLabel,
      rangeMoveLabel: pairMatrixRangeMoveLabel,
      rangeOpenTimeSeconds: pairMatrixRangeOpenCalendarTime,
      rangeBasisLabel: pairMatrixRangeBasisLabel,
      loadState: pairMatrixLoadState,
      displayTimeMode,
      sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
      beforeDays: pairMatrixBeforeDays,
      rangeSelectionArmed: pairMatrixRangeArmed,
      hasLockedRange: pairMatrixLockedRange != null,
      onBeforeDaysChange: updatePairMatrixBeforeDays,
      onStartRangeSelection: () => setPairMatrixRangeArmed(true),
      onReturnToCursor: () => {
        setPairMatrixLockedRange(null);
        setPairMatrixLockedInterval(null);
        setPairMatrixRangeArmed(false);
        setPairMatrixRangeEditing(false);
        setPairMatrixRangeCancelRevision((current) => current + 1);
      },
      onToggleOpen: () => {
        if (pairMatrixOpen) {
          setPairMatrixRangeArmed(false);
          setPairMatrixRangeEditing(false);
          setPairMatrixRangeCancelRevision((current) => current + 1);
        }
        setPairMatrixOpen(!pairMatrixOpen);
      },
      onClose: () => {
        setPairMatrixOpen(false);
        setPairMatrixRangeArmed(false);
        setPairMatrixRangeEditing(false);
        setPairMatrixRangeCancelRevision((current) => current + 1);
      },
    }),
    [
      pairMatrixOpen,
      selectedSymbol,
      pairMatrixCurrencies,
      pairMatrixTimeline,
      pairMatrixMomentum,
      pairMatrixRangeLabel,
      pairMatrixRangeMoveLabel,
      pairMatrixRangeOpenCalendarTime,
      displayTimeMode,
      chartSourceTimeOffsetSeconds,
      pairMatrixRangeBasisLabel,
      pairMatrixLoadState,
      pairMatrixBeforeDays,
      pairMatrixRangeArmed,
      pairMatrixLockedRange,
      updatePairMatrixBeforeDays,
    ],
  );
  const resolvePairMatrixCursorData = useCallback((anchor: number | null): ChartPairMatrixTimeLensData => {
    if (pairMatrixLockedRange || anchor == null) return pairMatrixTimeLensBaseData;
    const range = normalizePairMatrixCandleRange(pairMatrixCandleTimes, anchor, anchor, timeframe);
    if (!range) return pairMatrixTimeLensBaseData;
    const rangeOpen = range.firstOpen - chartSourceTimeOffsetSeconds;
    const rangeClose = range.close - chartSourceTimeOffsetSeconds;
    const duringThrough = Math.min(
      rangeClose - 1,
      Math.max(rangeOpen, activeMarketStatus?.checked_at ?? Math.floor(Date.now() / 1000)),
    );
    const requiredWindow = getPairMatrixTimelineWindow(rangeOpen, rangeClose, pairMatrixBeforeDays);
    const requiredKey = `${pairMatrixCurrencyKey}:${requiredWindow.from}:${requiredWindow.to}`;
    const anchorLoadState: PairMatrixLoadState = pairMatrixCalendarKey === requiredKey && pairMatrixCalendarResult.key === requiredKey
      ? pairMatrixCalendarResult.state
      : "loading";
    const derived = anchorLoadState === "ready"
      ? resolvePairMatrixDerived(rangeOpen, rangeClose, duringThrough)
      : (() => {
          const timeline = { during: [], before: [] } satisfies PairMatrixTimelineSnapshot;
          return { timeline, momentum: buildPairMatrixMomentumSnapshot(timeline, pairMatrixCurrencies ?? []) };
        })();
    return {
      ...pairMatrixTimeLensBaseData,
      timeline: derived.timeline,
      momentum: derived.momentum,
      rangeLabel: `${formatChartFeedTime(range.firstOpen, displayTimeMode, chartSourceTimeOffsetSeconds)} → ${formatChartFeedTime(range.close, displayTimeMode, chartSourceTimeOffsetSeconds)} · ${range.candleCount} ${timeframe} ${range.candleCount === 1 ? "candle" : "candles"}`,
      rangeMoveLabel: getPairMatrixRangePipMoveLabel(visibleCandles, range, pairMatrixCurrencies?.[1] ?? null),
      rangeOpenTimeSeconds: rangeOpen,
      rangeBasisLabel: "Hovered candle",
      loadState: anchorLoadState,
    };
  }, [pairMatrixLockedRange, pairMatrixTimeLensBaseData, pairMatrixCandleTimes, timeframe, chartSourceTimeOffsetSeconds, activeMarketStatus?.checked_at, pairMatrixBeforeDays, pairMatrixCurrencyKey, pairMatrixCalendarKey, pairMatrixCalendarResult.key, pairMatrixCalendarResult.state, resolvePairMatrixDerived, pairMatrixCurrencies, displayTimeMode, visibleCandles]);
  const pairMatrixTimeLensData = useMemo<ChartPairMatrixTimeLensData>(() => ({
    ...pairMatrixTimeLensBaseData,
    cursorRuntime: {
      hover: pairMatrixHoverRuntimeRef.current,
      resolve: resolvePairMatrixCursorData,
    },
  }), [pairMatrixTimeLensBaseData, resolvePairMatrixCursorData]);

  const resolvePairMatrixCandleAtX = useCallback((x: number): { index: number; time: number } | null => {
    const chart = chartRef.current;
    if (!chart || pairMatrixCandleTimes.length === 0) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical == null) return null;
    const index = Math.min(pairMatrixCandleTimes.length - 1, Math.max(0, Math.round(Number(logical))));
    return { index, time: pairMatrixCandleTimes[index] };
  }, [pairMatrixCandleTimes]);

  const buildPairMatrixRangePreview = useCallback((range: PairMatrixCandleRange, originTime: number): PairMatrixRangePreview | null => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return null;
    const firstCenter = chart.timeScale().timeToCoordinate(range.firstOpen as Time);
    const lastCenter = chart.timeScale().timeToCoordinate(range.lastOpen as Time);
    const bounds = getPairMatrixRangePixelBounds(
      firstCenter,
      lastCenter,
      chart.timeScale().options().barSpacing,
      container.clientWidth,
    );
    if (!bounds) return null;
    return {
      key: `${range.firstOpen}:${range.lastOpen}`,
      originTime,
      range,
      bounds,
    };
  }, []);

  const resolvePairMatrixPreviewAtX = useCallback((x: number, originTime: number): PairMatrixRangePreview | null => {
    const target = resolvePairMatrixCandleAtX(x);
    const originIndex = pairMatrixCandleIndexByTime.get(originTime);
    if (!target || originIndex == null) return null;
    const fromIndex = Math.min(originIndex, target.index);
    const throughIndex = Math.max(originIndex, target.index);
    const range: PairMatrixCandleRange = {
      firstOpen: pairMatrixCandleTimes[fromIndex],
      lastOpen: pairMatrixCandleTimes[throughIndex],
      close: getPairMatrixCandleClose(pairMatrixCandleTimes[throughIndex], timeframe),
      candleCount: throughIndex - fromIndex + 1,
    };
    return buildPairMatrixRangePreview(range, originTime);
  }, [buildPairMatrixRangePreview, pairMatrixCandleIndexByTime, pairMatrixCandleTimes, resolvePairMatrixCandleAtX, timeframe]);

  const pairMatrixLockedBounds = useMemo(
    () => pairMatrixLockedRange ? buildPairMatrixRangePreview(pairMatrixLockedRange, pairMatrixLockedRange.firstOpen)?.bounds ?? null : null,
    [pairMatrixLockedRange, buildPairMatrixRangePreview, chartRangeRevision, chartLayoutRevision, pairMatrixCandleTimes],
  );
  const pairMatrixContextMarkerEvents = useMemo(
    () => pairMatrixOpen ? mergePairMatrixCalendarEvents(events, pairMatrixCalendarResult.events, pairMatrixMarkerCalendarEvents) : [],
    [pairMatrixOpen, events, pairMatrixCalendarResult.events, pairMatrixMarkerCalendarEvents],
  );
  const pairMatrixContextMarkerIndex = useMemo(() => pairMatrixOpen ? indexPairMatrixContextMarkers({
    events: pairMatrixContextMarkerEvents,
    currencies: pairMatrixCurrencies ?? [],
    candleTimes: pairMatrixCandleTimes,
    timeframe,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
  }) : [], [pairMatrixOpen, pairMatrixContextMarkerEvents, pairMatrixCurrencies, pairMatrixCandleTimes, timeframe, chartSourceTimeOffsetSeconds]);
  const pairMatrixContextMarkerGroups = useMemo(() => pairMatrixOpen ? selectPairMatrixContextMarkerGroups({
    groups: pairMatrixContextMarkerIndex,
    range: pairMatrixRange,
    contextPerSide: chartPreferences.eventOverlay.pairMatrixContextMarkersPerSide,
  }) : [], [pairMatrixOpen, pairMatrixContextMarkerIndex, pairMatrixRange, chartPreferences.eventOverlay.pairMatrixContextMarkersPerSide]);
  const mapPairMatrixMarkerViews = useCallback((groups: ReturnType<typeof selectPairMatrixContextMarkerGroups>) => {
    const chart = chartRef.current;
    const width = containerRef.current?.clientWidth ?? 0;
    if (!pairMatrixOpen || !chart || width <= 0) return [];
    return groups.flatMap((group) => {
      const x = chart.timeScale().timeToCoordinate(group.candleOpen as Time);
      if (x == null) return [];
      return [{ ...group, x, placement: x < 220 ? "right" as const : x > width - 220 ? "left" as const : "center" as const }];
    });
  }, [pairMatrixOpen, chartRangeRevision, chartLayoutRevision]);
  const pairMatrixContextMarkerViews = useMemo(
    () => mapPairMatrixMarkerViews(pairMatrixContextMarkerGroups),
    [mapPairMatrixMarkerViews, pairMatrixContextMarkerGroups],
  );
  const resolvePairMatrixCursorMarkerViews = useCallback((anchor: number | null) => {
    if (pairMatrixLockedRange || anchor == null) return pairMatrixContextMarkerViews;
    const range = normalizePairMatrixCandleRange(pairMatrixCandleTimes, anchor, anchor, timeframe);
    if (!range) return pairMatrixContextMarkerViews;
    const groups = selectPairMatrixContextMarkerGroups({
      groups: pairMatrixContextMarkerIndex,
      range,
      contextPerSide: chartPreferences.eventOverlay.pairMatrixContextMarkersPerSide,
    });
    return mapPairMatrixMarkerViews(groups);
  }, [pairMatrixLockedRange, pairMatrixContextMarkerViews, pairMatrixCandleTimes, timeframe, pairMatrixContextMarkerIndex, chartPreferences.eventOverlay.pairMatrixContextMarkersPerSide, mapPairMatrixMarkerViews]);
  const pairMatrixSelectionOriginRange = pairMatrixLockedRange ?? pairMatrixFallbackRange;

  const pairMatrixRangeOverlay = useMemo<ChartPairMatrixRangeOverlayData>(() => {
    return {
      armed: pairMatrixOpen && pairMatrixRangeArmed,
      cancelRevision: pairMatrixRangeCancelRevision,
      lockedBounds: pairMatrixOpen ? pairMatrixLockedBounds : null,
      lockedRange: pairMatrixOpen ? pairMatrixLockedRange : null,
      geometryRuntime: pairMatrixGeometryRuntime,
      startPreview: (x, edge) => {
        const target = resolvePairMatrixCandleAtX(x);
        if (!target) return null;
        const current = pairMatrixSelectionOriginRange;
        const originTime = edge === "start" && current
          ? current.lastOpen
          : edge === "end" && current
            ? current.firstOpen
            : target.time;
        return resolvePairMatrixPreviewAtX(x, originTime);
      },
      updatePreview: resolvePairMatrixPreviewAtX,
      onCommit: (range) => {
        setPairMatrixLockedRange(range);
        setPairMatrixLockedInterval({ from: range.firstOpen, toExclusive: range.close });
        setPairMatrixRangeArmed(false);
        setPairMatrixRangeEditing(false);
      },
      onCancel: () => {
        setPairMatrixRangeArmed(false);
        setPairMatrixRangeEditing(false);
      },
      onInteractionChange: setPairMatrixRangeEditing,
    };
  }, [pairMatrixOpen, pairMatrixRangeArmed, pairMatrixRangeCancelRevision, pairMatrixLockedBounds, pairMatrixLockedRange, pairMatrixSelectionOriginRange, resolvePairMatrixCandleAtX, resolvePairMatrixPreviewAtX, pairMatrixGeometryRuntime]);

  const selectChartEvent = useCallback(
    (event: CalendarEvent, cluster: ChartEventOverlayCluster | null = null) => {
      const visibleCluster =
        cluster ??
        chartEventOverlay.clusters.find((item) =>
          item.events.some(({ event: clusterEvent }) => getChartEventKey(clusterEvent) === getChartEventKey(event)),
        ) ??
        null;

      setActiveChartEventClusterKey(visibleCluster?.key ?? null);
      setSelectedChartEventCluster(visibleCluster);
      setSelectedChartEvent(event);
      setEventLensExpanded(true);
      setReplayPlaying(false);
      focusChartAroundEvent(event);
    },
    [chartEventOverlay.clusters, focusChartAroundEvent],
  );

  const handleSelectChartEventCluster = useCallback(
    (key: string) => {
      const cluster = chartEventOverlay.clusters.find((item) => item.key === key);
      const event = cluster ? getDefaultClusterEvent(cluster) : null;
      if (!event) return;
      selectChartEvent(event, cluster ?? null);
    },
    [chartEventOverlay.clusters, selectChartEvent],
  );

  const handleSelectChartEventFromTooltip = useCallback(
    (clusterKey: string, event: CalendarEvent) => {
      const cluster = chartEventOverlay.clusters.find((item) => item.key === clusterKey) ?? null;
      selectChartEvent(event, cluster);
    },
    [chartEventOverlay.clusters, selectChartEvent],
  );

  const analyzePairMatrixCandle = useCallback((candleOpen: number) => {
    const range = getPairMatrixAnalyzeCandleRange(pairMatrixCandleTimes, candleOpen, timeframe);
    if (!range) return;
    cancelPendingPairMatrixHover();
    setPairMatrixLockedRange(range);
    setPairMatrixLockedInterval({ from: range.firstOpen, toExclusive: range.close });
    setPairMatrixRangeArmed(false);
    setPairMatrixRangeEditing(false);
    setPairMatrixRangeCancelRevision((current) => current + 1);
  }, [cancelPendingPairMatrixHover, pairMatrixCandleTimes, timeframe]);

  const pairMatrixContextMarkerData = useMemo<ChartPairMatrixContextMarkerData>(() => ({
    markers: pairMatrixContextMarkerViews,
    passive: pairMatrixRangeArmed || pairMatrixRangeEditing,
    displayTimeMode,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
    loadState: pairMatrixMarkerCalendarState,
    onSelectEvent: (event) => selectChartEvent(event, null),
    onAnalyzeCandle: analyzePairMatrixCandle,
    geometryRuntime: pairMatrixGeometryRuntime,
    cursorRuntime: {
      hover: pairMatrixHoverRuntimeRef.current,
      resolve: resolvePairMatrixCursorMarkerViews,
    },
  }), [pairMatrixContextMarkerViews, pairMatrixRangeArmed, pairMatrixRangeEditing, displayTimeMode, chartSourceTimeOffsetSeconds, pairMatrixMarkerCalendarState, selectChartEvent, analyzePairMatrixCandle, resolvePairMatrixCursorMarkerViews, pairMatrixGeometryRuntime]);

  useEffect(() => {
    closeEventLens();
  }, [selectedSymbol, timeframe, chartPreferences.eventOverlay.scope, chartPreferences.eventOverlay.visible, closeEventLens]);

  const eventLensDockData = useMemo<ChartEventLensDockData>(() => {
    const overlayVisible = chartPreferences.eventOverlay.visible;
    const visibleClusterCount = chartEventOverlay.clusters.length;
    const visibleEventCount = chartEventOverlay.overlayData.visibleEventCount;
    const candidateCount = chartEventOverlay.candidatesCount;
    const currencyLabel = getChartEventCurrencyLabel(selectedSymbol);
    const impactLabel =
      chartPreferences.eventOverlay.impactFilter === "high"
        ? "high-impact"
        : chartPreferences.eventOverlay.impactFilter === "high_medium"
          ? "high/medium-impact"
          : "loaded";
    const hasVisibleEvents = visibleClusterCount > 0;
    const countLabel = `Loaded events: ${candidateCount} / Visible: ${visibleEventCount}`;

    return {
      visible: true,
      title: !overlayVisible
        ? "Event rail hidden"
        : hasVisibleEvents
        ? "Select an event marker to replay"
        : `No loaded ${impactLabel} ${currencyLabel} events in this visible range`,
      description: !overlayVisible
        ? "Turn the event rail back on to inspect loaded calendar events against price."
        : hasVisibleEvents
        ? "Use the bottom event rail dots or badges to open replay for a loaded calendar event."
        : "The chart can only show calendar rows already loaded by the local bridge. Scroll, refocus, or broaden the impact filter if you expect more markers.",
      countLabel,
      expanded: eventLensExpanded,
      canEnableEvents: !overlayVisible,
      canBroadenImpact: overlayVisible && chartPreferences.eventOverlay.impactFilter === "high",
      onToggleExpanded: () => setEventLensExpanded((current) => !current),
      onShowEvents: () => updateEventOverlay("visible", true),
      onOpenSettings: () => openChartDrawer("events"),
      onShowHighMedium: () => updateEventOverlay("impactFilter", "high_medium"),
    };
  }, [
    chartPreferences.eventOverlay.visible,
    chartPreferences.eventOverlay.impactFilter,
    chartEventOverlay.clusters.length,
    chartEventOverlay.overlayData.visibleEventCount,
    chartEventOverlay.candidatesCount,
    selectedSymbol,
    eventLensExpanded,
    openChartDrawer,
    updateEventOverlay,
  ]);

  const eventLensCoverageLabel = `Loaded events: ${chartEventOverlay.candidatesCount} / Visible: ${chartEventOverlay.overlayData.visibleEventCount}`;

  const releaseRows = useMemo<ChartEventReleaseRow[]>(() => {
    if (!selectedChartEvent) return [];

    return events
      .filter((event) => isSameChartEventTemplate(event, selectedChartEvent))
      .sort((left, right) => right.time - left.time)
      .map((event) => ({
        key: getChartEventKey(event),
        event,
        timeLabel: formatChartEventDisplayTime(event.time, displayTimeMode, chartSourceTimeOffsetSeconds),
        actualLabel: formatEventField(event.actual, event.title),
        forecastLabel: formatEventField(event.forecast, event.title),
        previousLabel: formatEventField(event.previous, event.title),
        isFuture: event.time > (lastCandleTime ?? Number.POSITIVE_INFINITY),
        replayAvailable: getNearestCandleIndex(visibleCandles, event, timeframe, chartSourceTimeOffsetSeconds) != null,
      }));
  }, [
    selectedChartEvent,
    events,
    displayTimeMode,
    chartSourceTimeOffsetSeconds,
    lastCandleTime,
    visibleCandles,
    timeframe,
  ]);

  const eventLensData = useMemo<ChartEventLensData | null>(() => {
    if (!selectedChartEvent) return null;

    const actualLabel = formatEventField(selectedChartEvent.actual, selectedChartEvent.title);
    const forecastLabel = formatEventField(selectedChartEvent.forecast, selectedChartEvent.title);
    const previousLabel = formatEventField(selectedChartEvent.previous, selectedChartEvent.title);
    const comparison = getEventComparison(selectedChartEvent);
    const surpriseLabel = comparison ? `${comparison.surprise >= 0 ? "+" : ""}${comparison.surprise.toFixed(4)}` : "N/A";
    const selectedEventIsFuture = selectedChartEvent.time > (lastCandleTime ?? Number.POSITIVE_INFINITY);
    const anchorCandle = selectedReplayAnchorIndex == null ? null : visibleCandles[selectedReplayAnchorIndex] ?? null;
    const cursorCandle = replayCursorIndex == null ? anchorCandle : visibleCandles[replayCursorIndex] ?? anchorCandle;
    const observedMove = formatObservedMove(anchorCandle, cursorCandle, priceFormat.precision);
    const replayAvailable = selectedReplayAnchorIndex != null && replayCursorIndex != null;
    const progressCurrent =
      selectedReplayAnchorIndex == null || replayCursorIndex == null
        ? 0
        : Math.max(0, replayCursorIndex - selectedReplayAnchorIndex);
    const progressTotal =
      selectedReplayAnchorIndex == null ? 0 : Math.max(0, visibleCandles.length - 1 - selectedReplayAnchorIndex);

    return {
      releaseRows,
      selectedEvent: selectedChartEvent,
      selectedEventKey: getChartEventKey(selectedChartEvent),
      selectedEventIsFuture,
      timeLabel: formatChartEventDisplayTime(selectedChartEvent.time, displayTimeMode, chartSourceTimeOffsetSeconds),
      actualLabel,
      forecastLabel,
      previousLabel,
      surpriseLabel,
      observedMoveLabel: observedMove.label,
      observedMoveDetail: observedMove.detail,
      replayAvailable,
      replayPlaying,
      replayProgressLabel: replayAvailable
        ? `${progressCurrent} / ${progressTotal} candles revealed`
        : selectedEventIsFuture
          ? "Scheduled event"
          : "Event outside loaded candles",
      replaySpeed,
      replaySpeedOptions: REPLAY_SPEED_OPTIONS,
      factorRows: macroFactorRows,
      coverageLabel: eventLensCoverageLabel,
      expanded: eventLensExpanded,
      onSelectRelease: selectChartEvent,
      onToggleExpanded: () => setEventLensExpanded((current) => !current),
      onClose: closeEventLens,
      onTogglePlayback: toggleReplayPlayback,
      onResetReplay: resetReplay,
      onStepReplay: stepReplay,
      onReplaySpeedChange: setReplaySpeed,
      onOpenCalendar: onOpenCalendarEvent,
    };
  }, [
    selectedChartEvent,
    releaseRows,
    selectedReplayAnchorIndex,
    replayCursorIndex,
    visibleCandles,
    lastCandleTime,
    priceFormat.precision,
    displayTimeMode,
    chartSourceTimeOffsetSeconds,
    replayPlaying,
    replaySpeed,
    macroFactorRows,
    eventLensCoverageLabel,
    eventLensExpanded,
    selectChartEvent,
    closeEventLens,
    toggleReplayPlayback,
    resetReplay,
    stepReplay,
    onOpenCalendarEvent,
  ]);

  const overlayCopy =
    status === "no_data"
      ? {
          title: "No Chart Data",
          description:
            chartLoadError ??
            `No candle history is available right now for ${selectedSymbol} ${timeframe}. Verify the symbol, timeframe, and MT5 history availability.`,
        }
      : {
          title: "Bridge Or MT5 Unavailable",
          description:
            chartLoadError ??
            `The app could not refresh chart data for ${selectedSymbol}. Keep the local bridge and MetaTrader 5 running, then retry.`,
        };

  return (
    <div className="workspace-page workspace-page-compact charts-tab-page flex h-[calc(100vh-98px)] min-h-[560px] flex-col overflow-hidden">
      <div className="chart-workbar">
        <div className="chart-workbar-main">
          <ChartSymbolPicker
            selectedSymbol={selectedSymbol}
            symbols={symbols}
            timeframe={timeframe}
            onSelectedSymbolChange={onSelectedSymbolChange}
            onTimeframeChange={setTimeframe}
          />

          <ChartStatusRail
            status={status}
            streamStatusLabel={streamStatusLabel}
            marketStatus={activeMarketStatus}
            lastCandleTime={lastCandleTime}
            feedLabel={feedLabel}
            displayTimeMode={displayTimeMode}
            timezoneMenuOpen={timezoneMenuOpen}
            timezoneMenuRef={timezoneMenuRef}
            onToggleTimezoneMenu={() => setTimezoneMenuOpen((current) => !current)}
            onDisplayTimeModeChange={handleDisplayTimeModeChange}
          />
        </div>

        <ChartToolStrip
          cursorReadoutMode={chartPreferences.cursorReadoutMode}
          eventOverlayVisible={chartPreferences.eventOverlay.visible}
          eventCandidateCount={chartEventOverlay.candidatesCount}
          eventVisibleCount={chartEventOverlay.overlayData.visibleEventCount}
          macroBiasVisible={macroBiasVisible}
          macroBiasCount={macroBiasDisplaySignals.length}
          macroBiasSupported={macroBiasSupported}
          macroBiasStatusLabel={macroBiasLoading
            ? "Loading FMS scanner"
            : macroBiasError
              ?? `${macroBiasResponse?.currentPatternCount ?? 0} registered setups · ${macroBiasResponse?.signals.length ?? 0} live-model signals`}
          macroBiasActiveLabel={macroBiasActiveLabel}
          eventLensExpanded={eventLensExpanded}
          pairMatrixOpen={pairMatrixOpen}
          rightPanelOpen={historyPanelOpen}
          onCursorModeChange={handleCursorModeChange}
          onRefocusChart={refocusChart}
          onOpenDrawer={openChartDrawer}
          onToggleMacroBias={toggleMacroBias}
          onToggleBottomPanel={() => {
            if (pairMatrixOpen || eventLensExpanded) {
              if (pairMatrixOpen) pairMatrixTimeLensData.onClose();
              if (eventLensExpanded) closeEventLens();
              return;
            }
            pairMatrixTimeLensData.onToggleOpen();
          }}
          onToggleRightPanel={() => setHistoryPanelOpen((current) => !current)}
        />
      </div>

      <ChartSettingsDrawer
        open={historyPanelOpen}
        mode={chartDrawerMode}
        onModeChange={setChartDrawerMode}
        onClose={() => setHistoryPanelOpen(false)}
        preferences={chartPreferences}
        onCursorModeChange={handleCursorModeChange}
        onPreserveZoomChange={handlePreserveZoomChange}
        onAppearanceChange={updateAppearance}
        onEventOverlayChange={updateEventOverlay}
        onResetAppearance={resetChartPreferences}
        replayData={{
          defaultSpeed: replaySpeed,
          stepCandles: replayStepCandles,
          speedOptions: REPLAY_SPEED_OPTIONS,
          stepOptions: REPLAY_STEP_OPTIONS,
          onDefaultSpeedChange: setReplaySpeed,
          onStepCandlesChange: setReplayStepCandles,
          futureCandleOpacity: chartPreferences.appearance.futureCandleOpacity,
          onFutureCandleOpacityChange: (value) => updateAppearance("futureCandleOpacity", value),
        }}
        cacheData={{
          selectedSymbol,
          timeframe,
          candleCount: cacheSummary.count,
          oldestLabel: cacheOldestLabel,
          latestLabel: cacheLatestLabel,
          historyState,
          streamLabel: streamConnected ? "connected" : "not streaming",
          boundaryLabel: boundaryTime
            ? formatChartFeedTime(boundaryTime, displayTimeMode, chartSourceTimeOffsetSeconds)
            : "unconfirmed",
          onClearCache: clearCurrentCache,
        }}
        debugData={{ debugLines }}
        loadedUpcomingEventCount={loadedUpcomingEventCount}
      />

      <ChartViewport
        containerRef={containerRef}
        clusters={chartEventOverlay.clusters}
        eventOverlay={chartEventOverlay.overlayData}
        hoveredClusterKey={hoveredChartEventClusterKey}
        activeClusterKey={activeChartEventClusterKey}
        onHoverCluster={setHoveredChartEventClusterKey}
        onSelectCluster={handleSelectChartEventCluster}
        onSelectEvent={handleSelectChartEventFromTooltip}
        eventLens={eventLensData}
        eventLensDock={eventLensDockData}
        pairMatrixTimeLens={pairMatrixTimeLensData}
        pairMatrixRangeOverlay={pairMatrixRangeOverlay}
        pairMatrixContextMarkers={pairMatrixContextMarkerData}
        macroBiasAudit={macroBiasAudit}
        macroBiasRealtime={macroBiasRealtime}
        macroBiasHistoricalMatchesVisible={macroBiasHistoricalMatchesVisible}
        macroBiasHistoricalMatchesCount={macroBiasShadowHistoricalSignals?.length ?? 0}
        onToggleMacroBiasHistoricalMatches={toggleMacroBiasHistoricalMatches}
        crosshairReadoutRef={crosshairReadoutRef}
        status={status}
        overlayCopy={overlayCopy}
        reachedBoundary={reachedBoundary}
      />
    </div>
  );
}
