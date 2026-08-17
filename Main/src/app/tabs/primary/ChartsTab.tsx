import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { ChartSettingsDrawer, type ChartDrawerMode } from "@/app/components/ChartSettingsDrawer";
import { ChartStatusRail } from "@/app/components/ChartStatusRail";
import { ChartSymbolPicker } from "@/app/components/ChartSymbolPicker";
import { ChartToolStrip } from "@/app/components/ChartToolStrip";
import { ChartViewport, type ChartCrosshairReadoutHandle, type ChartEventLensDockData, type ChartPairMatrixContextMarkerData, type ChartPairMatrixRangeOverlayData, type PairMatrixRangePreview } from "@/app/components/ChartViewport";
import type { ChartPairMatrixTimeLensData, PairMatrixLoadState } from "@/app/components/ChartPairMatrixTimeLens";
import type { ChartEventLensData, ChartEventReleaseRow } from "@/app/components/ChartEventLens";
import { useChartEventOverlay } from "@/app/hooks/useChartEventOverlay";
import { useChartMarketData } from "@/app/hooks/useChartMarketData";
import { fetchCalendar } from "@/app/lib/bridge";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import {
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
import type { BridgeCandle, CalendarEvent, MarketStatusResponse, Timeframe } from "@/app/types";

const DEBUG_MAX = 60;
const REPLAY_SPEED_OPTIONS = [0.5, 1, 2, 4];
const REPLAY_STEP_OPTIONS = [1, 2, 4, 8];
const PAIR_MATRIX_HISTORY_DEBOUNCE_MS = 180;
const PAIR_MATRIX_HOVER_SETTLE_MS = 120;
const PAIR_MATRIX_HISTORY_CACHE_LIMIT = 8;

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
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [displayTimeMode, setDisplayTimeMode] = useState<ChartDisplayTimeMode>(() => loadChartDisplayTimeMode());
  const [chartPreferences, setChartPreferences] = useState<ChartPreferences>(() => loadChartPreferences());
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [chartDrawerMode, setChartDrawerMode] = useState<ChartDrawerMode>("appearance");
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [pairMatrixOpen, setPairMatrixOpen] = useState(false);
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

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [schedulePairMatrixGeometryUpdate]);

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
    ? `Latest candle: ${formatChartFeedTime(lastCandleTime, displayTimeMode, chartSourceTimeOffsetSeconds)}`
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
          onCursorModeChange={handleCursorModeChange}
          onRefocusChart={refocusChart}
          onOpenDrawer={openChartDrawer}
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
        crosshairReadoutRef={crosshairReadoutRef}
        status={status}
        overlayCopy={overlayCopy}
        reachedBoundary={reachedBoundary}
      />
    </div>
  );
}
