import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getResidentHistoryDiagnostics,
} from "@/app/features/chart-market-data/residentHistory";
import { getMacroBiasActivationCandleOpen, getMacroBiasArrowFocusRange } from "@/app/features/fms-arrow-navigation/arrowNavigation";
export { getMacroBiasActivationCandleOpen, getMacroBiasArrowFocusRange } from "@/app/features/fms-arrow-navigation/arrowNavigation";
import {
  buildMacroBiasPriceLineLevels,
  buildMacroBiasSeriesMarkers,
  getMacroBiasActiveState,
  getMacroBiasInitialLoadPlan,
  getMacroBiasReplayStatusLabel,
  getMacroBiasRequestScope,
  isMacroBiasMarketSupported,
  mergeMacroBiasSignalDetail,
  shouldApplyMacroBiasRefresh,
} from "@/app/features/fms-arrow-navigation/chartSignalPresentation";
export {
  buildMacroBiasPriceLineLevels,
  buildMacroBiasSeriesMarkers,
  getMacroBiasActiveState,
  getMacroBiasInitialLoadPlan,
  getMacroBiasReplayStatusLabel,
  getMacroBiasRequestScope,
  isMacroBiasMarketSupported,
  mergeMacroBiasSignalDetail,
  shouldApplyMacroBiasRefresh,
} from "@/app/features/fms-arrow-navigation/chartSignalPresentation";
import { useFmsArrowNavigation } from "@/app/features/fms-arrow-navigation/useFmsArrowNavigation";
import { useChartMacroBiasData } from "@/app/features/fms-arrow-navigation/useChartMacroBiasData";
import {
  captureChartZoomSnapshot,
  getResidentChartZoomSnapshot,
  restoreChartZoomRange,
  setResidentChartZoomSnapshot,
  type ChartZoomSnapshot,
} from "@/app/features/chart-viewport/viewportState";
export { captureChartZoomSnapshot, restoreChartZoomRange } from "@/app/features/chart-viewport/viewportState";
import { useChartPreferencesController } from "@/app/features/chart-viewport/useChartPreferencesController";
import { useChartDockLayout } from "@/app/features/chart-viewport/useChartDockLayout";
import { getDefaultClusterEvent, getNearestCandleIndex, useChartEventReplay } from "@/app/features/chart-events/useChartEventReplay";
import { useChartEventLensPresentation } from "@/app/features/chart-events/useChartEventLensPresentation";
import { ChartTrustStateControl } from "@/app/features/chart-shell/ChartTrustStateControl";
import {
  getChartRangeUpdateCadence,
  getPairMatrixAnalyzeCandleRange,
  getPairMatrixHoverSettleDelay,
  resolvePairMatrixHoveredCandleUpdate,
  useChartPairMatrixController,
} from "@/app/features/pair-matrix/useChartPairMatrixController";
export {
  getChartRangeUpdateCadence,
  getPairMatrixAnalyzeCandleRange,
  getPairMatrixHoverSettleDelay,
  resolvePairMatrixHoveredCandleUpdate,
} from "@/app/features/pair-matrix/useChartPairMatrixController";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { ChartSettingsDrawer } from "@/app/components/ChartSettingsDrawer";
import { ChartStatusRail } from "@/app/components/ChartStatusRail";
import { ChartSymbolPicker } from "@/app/components/ChartSymbolPicker";
import { ChartToolStrip } from "@/app/components/ChartToolStrip";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { ChartViewport, type ChartCrosshairReadoutHandle } from "@/app/components/ChartViewport";
import type { ChartEventLensDockData } from "@/app/features/chart-events/chartEventLensContracts";
import { useChartEventOverlay } from "@/app/hooks/useChartEventOverlay";
import { useChartMarketData } from "@/app/hooks/useChartMarketData";
import { fetchMacroSignalTargetLadder } from "@/app/lib/bridge";
import {
  DEFAULT_CHART_TIMEFRAME,
  getChartConnectionLabel,
  getChartPriceFormat,
  getCrosshairMode,
} from "@/app/lib/chartDisplay";
import {
  filterChartEventsForOverlay,
  getFutureChartEventTimes,
  getChartEventAnchorTime,
  getChartEventCoordinateTime,
  getChartEventKey,
  getChartEventRelevantCurrencies,
} from "@/app/lib/chartEvents";
import {
  formatChartFeedTime,
  formatChartHeaderFeedTime,
  formatCursorReadout,
  getChartDisplayCandles,
  getChartGridColor,
  getChartLayoutOptions,
  getChartSeriesAppearanceOptions,
  getChartSourceTimeOffsetSeconds,
  getChartTimeFormatters,
  normalizeChartTimestampSeconds,
  type ChartDisplayTimeMode,
} from "@/app/lib/chartView";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import { buildMacroFactorRows } from "@/app/lib/macroDrivers";
import type { BridgeCandle, BridgeHealth, BridgeStatus, CalendarEvent, MacroSignalChartMode, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalGlobalResponse, MarketStatusResponse, Timeframe } from "@/app/types";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const DEBUG_MAX = 60;
const REPLAY_SPEED_OPTIONS = [0.5, 1, 2, 4];
const REPLAY_STEP_OPTIONS = [1, 2, 4, 8];
const MACRO_BIAS_VISIBILITY_KEY = "fyodor.charts.macro-bias-visible";
const MACRO_BIAS_HISTORICAL_MATCHES_KEY = "fyodor.charts.macro-bias-historical-matches";

interface ChartsTabProps {
  currentTime: Date;
  health: BridgeHealth;
  feedStatus: BridgeStatus;
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  onOpenCalendarEvent: (event: CalendarEvent) => void;
  calendarOpen: boolean;
  calendarPanel: ReactNode;
  onCalendarOpenChange: (open: boolean) => void;
  resolvedBanks: number;
  nextHighImpact?: { title: string; currency: string; countryCode: string; time: number } | null;
  onOpenResearch: () => void;
  onOpenAppSettings: () => void;
}

export function ChartsTab({
  currentTime,
  health,
  feedStatus,
  marketStatus,
  selectedSymbol,
  onSelectedSymbolChange,
  events,
  onOpenCalendarEvent,
  calendarOpen,
  calendarPanel,
  onCalendarOpenChange,
  resolvedBanks,
  nextHighImpact,
  onOpenResearch,
  onOpenAppSettings,
}: ChartsTabProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_CHART_TIMEFRAME);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [macroBiasVisible, setMacroBiasVisible] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem(MACRO_BIAS_VISIBILITY_KEY) === "true"; }
    catch { return false; }
  });
  const [macroBiasHistoricalMatchesVisible, setMacroBiasHistoricalMatchesVisible] = useState(() => {
    try { return window.localStorage.getItem(MACRO_BIAS_HISTORICAL_MATCHES_KEY) !== "false"; }
    catch { return true; }
  });
  const [macroBiasHiddenHistoricalPatterns, setMacroBiasHiddenHistoricalPatterns] = useState<Record<string, string[]>>({});
  const [selectedMacroBiasId, setSelectedMacroBiasId] = useState<string | null>(null);
  const [macroBiasSignalAudits, setMacroBiasSignalAudits] = useState<Record<string, MacroSignalChartSignal>>({});
  const [macroBiasSignalAuditErrors, setMacroBiasSignalAuditErrors] = useState<Record<string, string>>({});
  const [macroBiasSignalAuditRetryRevision, setMacroBiasSignalAuditRetryRevision] = useState(0);
  const timezoneMenuRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const crosshairReadoutRef = useRef<ChartCrosshairReadoutHandle | null>(null);
  const pairMatrixSelectEventRef = useRef<(event: CalendarEvent) => void>(() => undefined);
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

  const clearPendingZoomPreservation = useCallback(() => {
    preserveZoomNextLoadRef.current = false;
  }, []);
  const {
    changeCursorMode: handleCursorModeChange,
    changeDefaultFocusBars: handleDefaultFocusBarsChange,
    changeDisplayTimeMode: handleDisplayTimeModeChange,
    changePreserveZoom: handlePreserveZoomChange,
    chartPreferences,
    displayTimeMode,
    drawerMode: chartDrawerMode,
    drawerOpen: historyPanelOpen,
    openDrawer: openChartDrawer,
    resetPreferences: resetChartPreferences,
    setDrawerMode: setChartDrawerMode,
    setDrawerOpen: setHistoryPanelOpen,
    setTimezoneMenuOpen,
    timezoneMenuOpen,
    updateAppearance,
    updateEventOverlay,
  } = useChartPreferencesController(clearPendingZoomPreservation);
  const { layout: chartDockLayout, resetLayout: resetChartDockLayout, setPanelRegion: setChartPanelRegion } = useChartDockLayout();

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
    symbolSnapshot,
    refreshSymbols,
    setBackgroundHistoryPaused,
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
    ensureHistoryCoverage,
  } = useChartMarketData({
    selectedSymbol,
    onSelectedSymbolChange,
    timeframe,
    activeMarketStatus,
    chartRef,
    addLog,
  });
  const selectedBrokerSymbol = symbols.find(
    (item) => item.name.toUpperCase() === selectedSymbol.toUpperCase(),
  ) ?? null;
  const residentHistoryDiagnostics = getResidentHistoryDiagnostics();
  const selectedQuoteAgeSeconds = selectedBrokerSymbol?.quoteTime == null
    ? null
    : Math.max(0, Date.now() / 1000 - selectedBrokerSymbol.quoteTime);
  visibleCandleCountRef.current = visibleCandles.length;
  const handlePairMatrixSelectEvent = useCallback((event: CalendarEvent) => {
    pairMatrixSelectEventRef.current(event);
  }, []);
  const {
    open: pairMatrixOpen,
    openRef: pairMatrixOpenRef,
    chartInteracting,
    chartLayoutRevision,
    chartRangeRevision,
    contextMarkerData: pairMatrixContextMarkerData,
    rangeOverlay: pairMatrixRangeOverlay,
    timeLensData: pairMatrixTimeLensData,
    cancelPendingHover: cancelPendingPairMatrixHover,
    resetHover: resetPairMatrixHover,
    scheduleHover: schedulePairMatrixHover,
    scheduleGeometryUpdate: schedulePairMatrixGeometryUpdate,
    notifyChartLayoutChange: notifyPairMatrixChartLayoutChange,
    notifyChartRangeChange: notifyPairMatrixChartRangeChange,
    setChartInteracting,
  } = useChartPairMatrixController({
    selectedSymbol,
    timeframe,
    events,
    visibleCandles,
    lastCandleTime,
    displayTimeMode,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
    marketCheckedAt: activeMarketStatus?.checked_at ?? null,
    contextMarkersPerSide: chartPreferences.eventOverlay.pairMatrixContextMarkersPerSide,
    chartRef,
    containerRef,
    onSelectEvent: handlePairMatrixSelectEvent,
  });
  const chartMarketIdentity = `${selectedSymbol}:${timeframe}`;
  if (chartMarketIdentityRef.current !== chartMarketIdentity) {
    const residentZoom = chartPreferences.preserveZoomOnMarketChange
      ? getResidentChartZoomSnapshot(chartMarketIdentity)
      : null;
    chartZoomSnapshotRef.current = residentZoom;
    // Suppress range events from the previous chart while the new resident
    // candle buffer is being attached. The ready effect restores this chart's
    // own viewport, or applies the normal first-open focus when none exists.
    preserveZoomNextLoadRef.current = chartPreferences.preserveZoomOnMarketChange;
    shouldRefocusRef.current = true;
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

  const {
    activeClusterKey: activeChartEventClusterKey,
    anchorIndex: selectedReplayAnchorIndex,
    close: closeEventLens,
    cursorIndex: replayCursorIndex,
    expanded: eventLensExpanded,
    hoveredClusterKey: hoveredChartEventClusterKey,
    playing: replayPlaying,
    reset: resetReplay,
    selectEvent: setSelectedChartEventState,
    selectedCluster: selectedChartEventCluster,
    selectedEvent: selectedChartEvent,
    setExpanded: setEventLensExpanded,
    setHoveredClusterKey: setHoveredChartEventClusterKey,
    setSpeed: setReplaySpeed,
    setStepCandles: setReplayStepCandles,
    speed: replaySpeed,
    step: stepReplay,
    stepCandles: replayStepCandles,
    togglePlayback: toggleReplayPlayback,
  } = useChartEventReplay({
    candles: visibleCandles,
    timeframe,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
  });

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
    const windowBars = chartPreferences.defaultFocusBars;
    const halfWindow = windowBars / 2;
    const futureSlots = futureChartEventTimes.length;
    const rightWindow = futureSlots > 0 ? Math.max(18, futureSlots + 8) : halfWindow;
    const leftWindow = Math.max(42, windowBars - rightWindow);

    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(-0.5, lastIndex - leftWindow),
      to: lastIndex + rightWindow,
    });

    series.priceScale().setAutoScale(true);
  }, [visibleCandles, futureChartEventTimes, chartPreferences.defaultFocusBars]);

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
      if (signal) setSelectedMacroBiasId((current) => current === signal.id ? null : signal.id);
    };
    chart.subscribeClick(handleChartClick);

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.applyOptions({ width: rect.width, height: rect.height });
        schedulePairMatrixGeometryUpdate();
        notifyPairMatrixChartLayoutChange();
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
  }, [notifyPairMatrixChartLayoutChange, schedulePairMatrixGeometryUpdate]);

  const macroBiasFrom = visibleCandles[0]?.time;
  const macroBiasTo = visibleCandles[visibleCandles.length - 1]?.time;
  const {
    currentError: macroBiasCurrentError,
    currentLoading: macroBiasCurrentLoading,
    displaySignals: macroBiasDisplaySignals,
    globalError: macroBiasGlobalError,
    globalLoading: macroBiasGlobalLoading,
    globalResponse: macroBiasGlobalResponse,
    historicalError: macroBiasShadowHistoryError,
    historicalPatternFilters: macroBiasHistoricalPatternFilters,
    historicalResponse: macroBiasShadowHistoryResponse,
    historicalSignals: macroBiasShadowHistoricalSignals,
    monitoringError: macroBiasMonitoringError,
    refreshedAt: macroBiasRefreshedAt,
    response: macroBiasResponse,
    supported: macroBiasSupported,
  } = useChartMacroBiasData({
    selectedSymbol,
    events,
    visible: macroBiasVisible,
    historicalMatchesVisible: macroBiasHistoricalMatchesVisible,
    hiddenHistoricalPatterns: macroBiasHiddenHistoricalPatterns,
    historyState,
    historyFrom: macroBiasFrom,
    historyTo: macroBiasTo,
    visibleCandleCount: visibleCandles.length,
  });
  const macroBiasLoading = macroBiasCurrentLoading;
  const macroBiasError = macroBiasCurrentError;

  useEffect(() => {
    setSelectedMacroBiasId(null);
  }, [selectedSymbol]);
  const toggleMacroBiasHistoricalPattern = (patternId: string) => {
    const market = selectedSymbol.toUpperCase();
    setMacroBiasHiddenHistoricalPatterns((current) => {
      const hidden = new Set(current[market] ?? []);
      if (hidden.has(patternId)) hidden.delete(patternId); else hidden.add(patternId);
      return { ...current, [market]: [...hidden] };
    });
    if (selectedMacroBias?.patternId === patternId) setSelectedMacroBiasId(null);
  };
  const setAllMacroBiasHistoricalPatterns = (visible: boolean) => {
    const market = selectedSymbol.toUpperCase();
    const hidden = visible ? [] : macroBiasHistoricalPatternFilters.map((option) => option.id);
    setMacroBiasHiddenHistoricalPatterns((current) => ({ ...current, [market]: hidden }));
    if (!visible) setSelectedMacroBiasId(null);
  };
  const macroBiasVisibleChartSignals = useMemo(() => {
    if (!selectedMacroBiasId) return macroBiasDisplaySignals;
    const selected = macroBiasDisplaySignals.find((signal) => signal.id === selectedMacroBiasId);
    return selected ? [selected] : macroBiasDisplaySignals;
  }, [macroBiasDisplaySignals, selectedMacroBiasId]);

  useEffect(() => {
    const series = seriesRef.current;
    macroBiasMarkersRef.current?.detach();
    macroBiasMarkersRef.current = null;
    macroBiasSignalByMarkerIdRef.current.clear();
    if (!series || !macroBiasVisible || !macroBiasResponse?.supported) return;
    const built = buildMacroBiasSeriesMarkers(
      macroBiasVisibleChartSignals,
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
  }, [macroBiasVisible, macroBiasResponse, macroBiasVisibleChartSignals, chartSourceTimeOffsetSeconds, macroBiasFrom, macroBiasTo, timeframe]);

  const selectedMacroBias = macroBiasDisplaySignals.find((signal) => signal.id === selectedMacroBiasId) ?? null;
  const selectedMacroBiasPattern = selectedMacroBias
    ? macroBiasResponse?.patterns.find((pattern) => pattern.id === selectedMacroBias.patternId) ?? null
    : null;
  const selectedMacroBiasActivationOpen = selectedMacroBias
    ? getMacroBiasActivationCandleOpen(selectedMacroBias, visibleCandles, chartSourceTimeOffsetSeconds, timeframe)
    : null;
  const selectedMacroBiasLadderKey = selectedMacroBias && macroBiasResponse ? [
    macroBiasResponse.modelHash,
    selectedMacroBias.historicalReplay ? "research_replay" : "current",
    selectedSymbol.toUpperCase(),
    selectedMacroBias.sourceVersionId,
    selectedMacroBias.patternId,
    selectedMacroBias.eventTime,
    selectedMacroBias.entryTimeframe ?? "H4",
    selectedMacroBias.stopAtr ?? selectedMacroBias.execution?.stopAtr ?? "",
    selectedMacroBias.targetR ?? selectedMacroBias.execution?.targetR ?? "",
    selectedMacroBias.expiryCandles,
    selectedMacroBias.managementFamily ?? selectedMacroBias.execution?.managementFamily ?? "fixed",
    selectedMacroBias.managementTriggerR ?? selectedMacroBias.execution?.managementTriggerR ?? "",
    selectedMacroBias.outcomeStatus ?? "status_absent",
    selectedMacroBias.outcomeStatus == null || selectedMacroBias.outcomeStatus === "pending" ? macroBiasResponse.generatedAt : "terminal",
  ].join(":") : null;
  const selectedMacroBiasAudit = selectedMacroBiasLadderKey ? macroBiasSignalAudits[selectedMacroBiasLadderKey] : undefined;
  useEffect(() => {
    if (!selectedMacroBias || !selectedMacroBiasLadderKey || selectedMacroBiasAudit) return;
    let cancelled = false;
    setMacroBiasSignalAuditErrors((current) => {
      if (!(selectedMacroBiasLadderKey in current)) return current;
      const next = { ...current };
      delete next[selectedMacroBiasLadderKey];
      return next;
    });
    fetchMacroSignalTargetLadder({
      symbol: selectedSymbol,
      patternId: selectedMacroBias.patternId,
      eventTime: selectedMacroBias.eventTime,
      mode: selectedMacroBias.historicalReplay ? "research_replay" : "current",
      identityScope: selectedMacroBiasLadderKey,
    }).then(({ signal }) => {
      if (!cancelled) setMacroBiasSignalAudits((current) => ({ ...current, [selectedMacroBiasLadderKey]: signal }));
    }).catch((error: unknown) => {
      if (!cancelled) setMacroBiasSignalAuditErrors((current) => ({
        ...current,
        [selectedMacroBiasLadderKey]: error instanceof Error ? error.message : "Frozen detail request failed",
      }));
    });
    return () => { cancelled = true; };
  }, [macroBiasSignalAuditRetryRevision, selectedMacroBias, selectedMacroBiasLadderKey, selectedMacroBiasAudit, selectedSymbol]);
  const selectedMacroBiasWithTargetLadder = selectedMacroBias
    ? mergeMacroBiasSignalDetail(selectedMacroBias, selectedMacroBiasAudit)
    : null;
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
    detailLoading: selectedMacroBiasAudit == null && macroBiasSignalAuditErrors[selectedMacroBiasLadderKey ?? ""] == null,
    detailError: macroBiasSignalAuditErrors[selectedMacroBiasLadderKey ?? ""] ?? null,
    onRetryDetail: () => {
      if (!selectedMacroBiasLadderKey) return;
      setMacroBiasSignalAuditErrors((current) => {
        const next = { ...current };
        delete next[selectedMacroBiasLadderKey];
        return next;
      });
      setMacroBiasSignalAudits((current) => {
        const next = { ...current };
        delete next[selectedMacroBiasLadderKey];
        return next;
      });
      setMacroBiasSignalAuditRetryRevision((current) => current + 1);
    },
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
  const dockResponse = macroBiasResponse?.supported ? macroBiasResponse : macroBiasGlobalResponse?.markets.find((market) => market.supported);
  const macroBiasRealtime = useMemo<ChartMacroBiasRealtimeCardData | null>(() => macroBiasVisible
    && dockResponse
    ? {
        response: dockResponse,
        activeSignal: macroBiasActiveState?.signal ?? null,
        activePattern: macroBiasActivePattern,
        remainingModelCandles: macroBiasActiveState?.remainingCandles ?? null,
        chartTimeframe: timeframe,
        historicalSignals: macroBiasShadowHistoricalSignals,
        globalResponse: macroBiasGlobalResponse,
        globalLoading: macroBiasGlobalLoading,
        globalError: [macroBiasCurrentError, macroBiasGlobalError, macroBiasMonitoringError].filter(Boolean).join("; ") || null,
        refreshing: macroBiasCurrentLoading || macroBiasGlobalLoading,
        refreshedAt: macroBiasRefreshedAt ?? dockResponse.generatedAt,
      }
    : null, [
      dockResponse,
      macroBiasCurrentError,
      macroBiasCurrentLoading,
      macroBiasRefreshedAt,
      macroBiasActivePattern,
      macroBiasActiveState,
      macroBiasGlobalError,
      macroBiasMonitoringError,
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

  const goToMacroBiasArrow = useFmsArrowNavigation({
    selectedSymbol,
    timeframe,
    onSelectedSymbolChange,
    setTimeframe,
    historyState,
    currentResponse: macroBiasResponse,
    currentError: macroBiasError,
    historicalResponse: macroBiasShadowHistoryResponse,
    historicalError: macroBiasShadowHistoryError,
    displayedSignals: macroBiasDisplaySignals,
    visibleCandles,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
    chartRef,
    seriesRef,
    ensureHistoryCoverage,
    addLog,
    setMacroBiasVisible,
    setHistoricalMatchesVisible: setMacroBiasHistoricalMatchesVisible,
    setHiddenHistoricalPatterns: setMacroBiasHiddenHistoricalPatterns,
    setSelectedSignalId: setSelectedMacroBiasId,
  });

  useBrowserLayoutEffect(() => {
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

  useBrowserLayoutEffect(() => {
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
        schedulePairMatrixHover(null);
        return;
      }

      const truePrice = series.coordinateToPrice(point.y);
      const candle = param.seriesData?.get(series) as CandlestickData<Time> | undefined;
      const candlePrice = candle && typeof candle.close === "number" ? candle.close : null;
      const candleTime = candle ? normalizeChartTimestampSeconds(candle.time) : null;
      schedulePairMatrixHover(candleTime);
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
      resetPairMatrixHover();
    };
  }, [chartPreferences.cursorReadoutMode, priceFormat.precision, resetPairMatrixHover, schedulePairMatrixHover]);

  useBrowserLayoutEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({
      priceFormat,
    });
  }, [priceFormat, selectedSymbol, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const onRangeChange = () => {
      schedulePairMatrixGeometryUpdate();
      if (!preserveZoomNextLoadRef.current) {
        const snapshot = captureChartZoomSnapshot(
          chart.timeScale().getVisibleLogicalRange(),
          visibleCandleCountRef.current - 1,
        );
        chartZoomSnapshotRef.current = snapshot;
        if (snapshot) setResidentChartZoomSnapshot(chartMarketIdentityRef.current, snapshot);
      }
      const pairMatrixActive = pairMatrixOpenRef.current;
      const updateCadence = getChartRangeUpdateCadence(pairMatrixActive);
      if (!pairMatrixActive) setChartInteracting(true);
      if (updateCadence === "animation_frame" && rangeAnimationFrameRef.current == null) {
        rangeAnimationFrameRef.current = window.requestAnimationFrame(() => {
          rangeAnimationFrameRef.current = null;
          notifyPairMatrixChartRangeChange();
        });
      }

      if (rangeSettleTimeoutRef.current != null) {
        window.clearTimeout(rangeSettleTimeoutRef.current);
      }
      rangeSettleTimeoutRef.current = window.setTimeout(() => {
        rangeSettleTimeoutRef.current = null;
        if (!pairMatrixOpenRef.current) setChartInteracting(false);
        notifyPairMatrixChartRangeChange();
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
  }, [notifyPairMatrixChartRangeChange, schedulePairMatrixGeometryUpdate, setChartInteracting]);

  const applyPreservedChartZoom = useCallback((): boolean => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const snapshot = chartZoomSnapshotRef.current;
    if (!chart || !series || !snapshot || visibleCandles.length === 0) return false;
    chart.timeScale().setVisibleLogicalRange(restoreChartZoomRange(snapshot, visibleCandles.length - 1));
    series.priceScale().setAutoScale(true);
    return true;
  }, [visibleCandles.length]);

  useBrowserLayoutEffect(() => {
    if (historyState !== "ready" || displayCandles.length === 0 || !shouldRefocusRef.current) return;
    const preserved = preserveZoomNextLoadRef.current && applyPreservedChartZoom();
    if (!preserved) refocusChart();
    skipNextFutureRefocusRef.current = preserved;
    preserveZoomNextLoadRef.current = false;
    shouldRefocusRef.current = false;
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

  const selectChartEvent = useCallback(
    (event: CalendarEvent, cluster: ChartEventOverlayCluster | null = null) => {
      const visibleCluster =
        cluster ??
        chartEventOverlay.clusters.find((item) =>
          item.events.some(({ event: clusterEvent }) => getChartEventKey(clusterEvent) === getChartEventKey(event)),
        ) ??
        null;

      setSelectedChartEventState(event, visibleCluster);
      focusChartAroundEvent(event);
    },
    [chartEventOverlay.clusters, focusChartAroundEvent, setSelectedChartEventState],
  );

  useEffect(() => {
    pairMatrixSelectEventRef.current = (event) => selectChartEvent(event, null);
  }, [selectChartEvent]);

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

  useEffect(() => {
    closeEventLens();
  }, [selectedSymbol, timeframe, chartPreferences.eventOverlay.scope, chartPreferences.eventOverlay.visible, closeEventLens]);

  const toggleEventLensExpanded = useCallback(() => setEventLensExpanded((current) => !current), [setEventLensExpanded]);
  const selectEventLensRelease = useCallback((event: CalendarEvent) => selectChartEvent(event), [selectChartEvent]);
  const showChartEvents = useCallback(() => updateEventOverlay("visible", true), [updateEventOverlay]);
  const showHighMediumEvents = useCallback(() => updateEventOverlay("impactFilter", "high_medium"), [updateEventOverlay]);
  const openEventSettings = useCallback(() => openChartDrawer("layers"), [openChartDrawer]);
  const { dockData: eventLensDockData, lensData: eventLensData } = useChartEventLensPresentation({
    selectedSymbol,
    eventOverlayPreferences: chartPreferences.eventOverlay,
    visibleClusterCount: chartEventOverlay.clusters.length,
    visibleEventCount: chartEventOverlay.overlayData.visibleEventCount,
    candidateCount: chartEventOverlay.candidatesCount,
    expanded: eventLensExpanded,
    onToggleExpanded: toggleEventLensExpanded,
    onShowEvents: showChartEvents,
    onOpenSettings: openEventSettings,
    onShowHighMedium: showHighMediumEvents,
    selectedEvent: selectedChartEvent,
    events,
    displayTimeMode,
    sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
    lastCandleTime,
    candles: visibleCandles,
    timeframe,
    anchorIndex: selectedReplayAnchorIndex,
    cursorIndex: replayCursorIndex,
    pricePrecision: priceFormat.precision,
    playing: replayPlaying,
    speed: replaySpeed,
    factorRows: macroFactorRows,
    onSelectRelease: selectEventLensRelease,
    onClose: closeEventLens,
    onTogglePlayback: toggleReplayPlayback,
    onResetReplay: resetReplay,
    onStepReplay: stepReplay,
    onReplaySpeedChange: setReplaySpeed,
    onOpenCalendar: onOpenCalendarEvent,
  });

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
            onRefreshSymbols={refreshSymbols}
            onMarketWatchActiveChange={setBackgroundHistoryPaused}
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

          <ChartTrustStateControl
            currentTime={currentTime}
            health={health}
            feedStatus={feedStatus}
            marketStatus={activeMarketStatus}
            selectedSymbol={selectedSymbol}
            resolvedBanks={resolvedBanks}
            nextHighImpact={nextHighImpact}
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
          calendarOpen={calendarOpen}
          rightPanelOpen={historyPanelOpen}
          onCursorModeChange={handleCursorModeChange}
          onRefocusChart={refocusChart}
          onOpenDrawer={openChartDrawer}
          onToggleMacroBias={toggleMacroBias}
          onToggleBottomPanel={() => {
            if (pairMatrixOpen || eventLensExpanded || calendarOpen) {
              if (pairMatrixOpen) pairMatrixTimeLensData.onClose();
              if (eventLensExpanded) closeEventLens();
              if (calendarOpen) onCalendarOpenChange(false);
              return;
            }
            pairMatrixTimeLensData.onToggleOpen();
          }}
          onToggleRightPanel={() => setHistoryPanelOpen((current) => !current)}
          onOpenCalendar={() => onCalendarOpenChange(true)}
          onOpenResearch={onOpenResearch}
          onOpenAppSettings={onOpenAppSettings}
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
        onDefaultFocusBarsChange={handleDefaultFocusBarsChange}
        onAppearanceChange={updateAppearance}
        onEventOverlayChange={updateEventOverlay}
        onResetAppearance={resetChartPreferences}
        displayTimeMode={displayTimeMode}
        onDisplayTimeModeChange={handleDisplayTimeModeChange}
        placement={chartDockLayout.regions.inspector === "left" ? "left" : "right"}
        onPlacementChange={(placement) => setChartPanelRegion("inspector", placement)}
        onResetPanelLayout={resetChartDockLayout}
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
        selectedData={selectedMacroBiasWithTargetLadder ? {
          kind: "FMS arrow",
          title: selectedMacroBiasWithTargetLadder.label,
          rows: [
            { field: "Arrow ID", value: selectedMacroBiasWithTargetLadder.id },
            { field: "Source version", value: selectedMacroBiasWithTargetLadder.sourceVersionId },
            { field: "Direction", value: selectedMacroBiasWithTargetLadder.direction },
            { field: "Release", value: formatChartFeedTime(selectedMacroBiasWithTargetLadder.eventTime, displayTimeMode, chartSourceTimeOffsetSeconds) },
            { field: "Activation", value: selectedMacroBiasWithTargetLadder.activationTime == null ? "Unavailable" : formatChartFeedTime(selectedMacroBiasWithTargetLadder.activationTime, displayTimeMode, chartSourceTimeOffsetSeconds) },
            { field: "Entry", value: selectedMacroBiasWithTargetLadder.entry == null ? "Unavailable" : String(selectedMacroBiasWithTargetLadder.entry) },
            { field: "Stop", value: selectedMacroBiasWithTargetLadder.stop == null ? "Unavailable" : String(selectedMacroBiasWithTargetLadder.stop) },
            { field: "Target", value: selectedMacroBiasWithTargetLadder.target == null ? "Unavailable" : String(selectedMacroBiasWithTargetLadder.target) },
            { field: "Outcome", value: selectedMacroBiasWithTargetLadder.outcomeStatus ?? "Unavailable", details: selectedMacroBiasWithTargetLadder.outcomeReason ?? "Stored arrow outcome status" },
          ],
        } : selectedChartEvent ? {
          kind: "Economic release",
          title: selectedChartEvent.title,
          rows: [
            { field: "Currency", value: selectedChartEvent.currency },
            { field: "Release", value: formatChartFeedTime(selectedChartEvent.time, displayTimeMode, chartSourceTimeOffsetSeconds) },
            { field: "Impact", value: selectedChartEvent.impact },
            { field: "Actual", value: selectedChartEvent.actual ?? "Unavailable" },
            { field: "Forecast", value: selectedChartEvent.forecast ?? "Unavailable" },
            { field: "Previous", value: selectedChartEvent.previous ?? "Unavailable" },
          ],
        } : undefined}
        layerData={{ rows: [
          { id: "fms", label: "FMS arrows", visible: macroBiasVisible, details: macroBiasSupported ? `${macroBiasDisplaySignals.length} loaded for ${selectedSymbol}` : `Unavailable for ${selectedSymbol}`, onToggle: toggleMacroBias },
          { id: "releases", label: "Economic releases", visible: chartPreferences.eventOverlay.visible, details: `${chartEventOverlay.overlayData.visibleEventCount} visible · ${chartEventOverlay.candidatesCount} loaded matches`, onToggle: () => updateEventOverlay("visible", !chartPreferences.eventOverlay.visible) },
          { id: "price-lines", label: "Selected-arrow price lines", visible: selectedMacroBiasWithTargetLadder != null, details: selectedMacroBiasWithTargetLadder ? "Entry, stop, target, and stored target ladder" : "Select an FMS arrow to show its stored levels" },
          { id: "matrix", label: "Pair Matrix context", visible: pairMatrixOpen, details: pairMatrixOpen ? "Bottom dock range and marker context shown" : "Hidden", onToggle: pairMatrixTimeLensData.onToggleOpen },
        ] }}
        cacheData={{
          selectedSymbol,
          timeframe,
          candleCount: cacheSummary.count,
          oldestLabel: cacheOldestLabel,
          latestLabel: cacheLatestLabel,
          historyState,
          streamLabel: streamConnected ? "connected" : "not streaming",
          brokerLabel: symbolSnapshot?.brokerIdentity ?? "unverified",
          catalogSourceLabel: symbolSnapshot
            ? `${symbolSnapshot.source} · ${symbolSnapshot.catalogRevision.slice(0, 12)}`
            : "unavailable",
          catalogAgeLabel: symbolSnapshot?.ageSeconds == null
            ? "unavailable"
            : `${symbolSnapshot.ageSeconds.toFixed(1)}s at last refresh`,
          quoteAgeLabel: selectedQuoteAgeSeconds == null
            ? "unavailable"
            : `${selectedQuoteAgeSeconds.toFixed(1)}s`,
          synchronizationLabel: selectedBrokerSymbol?.synchronized == null
            ? "not reported by source"
            : selectedBrokerSymbol.synchronized ? "yes" : "no",
          historyQueueLabel: `${residentHistoryDiagnostics.pendingCount} pending · ${residentHistoryDiagnostics.selectedQueueDepth} selected · ${residentHistoryDiagnostics.warmQueueDepth} warm · ${residentHistoryDiagnostics.deepQueueDepth} deep · ${residentHistoryDiagnostics.cooldownCount} cooling${residentHistoryDiagnostics.backgroundPaused ? " · paused for Market Watch" : ""}`,
          activeHistoryRequestLabel: residentHistoryDiagnostics.activeRequest
            ? `${residentHistoryDiagnostics.activeRequest.symbol} ${residentHistoryDiagnostics.activeRequest.timeframe} · ${residentHistoryDiagnostics.activeRequest.priority}`
            : "idle",
          lastHistoryFailureLabel: residentHistoryDiagnostics.lastFailure
            ? `${residentHistoryDiagnostics.lastFailure.key} · ${residentHistoryDiagnostics.lastFailure.message}`
            : residentHistoryDiagnostics.lastDurationMs == null
              ? "none this session"
              : `none · last request ${residentHistoryDiagnostics.lastDurationMs}ms`,
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
        calendarOpen={calendarOpen}
        calendarPanel={calendarPanel}
        onOpenCalendar={() => onCalendarOpenChange(true)}
        pairMatrixTimeLens={pairMatrixTimeLensData}
        pairMatrixRangeOverlay={pairMatrixRangeOverlay}
        pairMatrixContextMarkers={pairMatrixContextMarkerData}
        macroBiasAudit={macroBiasAudit}
        macroBiasRealtime={macroBiasRealtime}
        macroBiasEnabled={macroBiasVisible && macroBiasSupported}
        macroBiasLoading={macroBiasLoading}
        macroBiasHistoricalMatchesVisible={macroBiasHistoricalMatchesVisible}
        macroBiasHistoricalMatchesCount={macroBiasShadowHistoricalSignals?.length ?? 0}
        macroBiasHistoricalPatternFilters={macroBiasHistoricalPatternFilters}
        onToggleMacroBiasHistoricalMatches={toggleMacroBiasHistoricalMatches}
        onToggleMacroBiasHistoricalPattern={toggleMacroBiasHistoricalPattern}
        onSetAllMacroBiasHistoricalPatterns={setAllMacroBiasHistoricalPatterns}
        onGoToMacroBiasArrow={goToMacroBiasArrow}
        crosshairReadoutRef={crosshairReadoutRef}
        status={status}
        overlayCopy={overlayCopy}
        reachedBoundary={reachedBoundary}
      />
    </div>
  );
}
