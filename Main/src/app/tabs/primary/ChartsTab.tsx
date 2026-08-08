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
import { ChartViewport, type ChartCrosshairReadout, type ChartEventLensDockData } from "@/app/components/ChartViewport";
import type { ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import type { ChartEventLensData, ChartEventReleaseRow } from "@/app/components/ChartEventLens";
import { useChartEventOverlay } from "@/app/hooks/useChartEventOverlay";
import { useChartMarketData } from "@/app/hooks/useChartMarketData";
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
  getChartDisplayModeLabel,
  getChartGridColor,
  getChartLayoutOptions,
  getChartSeriesAppearanceOptions,
  getChartSourceTimeOffsetSeconds,
  getChartTimeFormatters,
  getChartSessionDetail,
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
import { MACRO_FACTOR_DEFINITIONS, buildMacroFactorRows, buildMacroFactorRowsAsOf } from "@/app/lib/macroDrivers";
import {
  buildPairMatrixViewRows,
  type PairMatrixPreferences,
} from "@/app/lib/pairMatrixDriverAlignment";
import {
  formatCurrentTimeForDisplayTimezone,
  getDisplayTimezoneOptions,
  getDisplayTimezoneShortLabel,
} from "@/app/lib/timezoneDisplay";
import type { BridgeCandle, CalendarEvent, MarketStatusResponse, Timeframe } from "@/app/types";

const DEBUG_MAX = 60;
const REPLAY_SPEED_OPTIONS = [0.5, 1, 2, 4];
const REPLAY_STEP_OPTIONS = [1, 2, 4, 8];

interface ChartsTabProps {
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  onOpenCalendarEvent: (event: CalendarEvent) => void;
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
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());
  const [crosshairReadout, setCrosshairReadout] = useState<ChartCrosshairReadout | null>(null);
  const [cursorChartTime, setCursorChartTime] = useState<number | null>(null);
  const [pairMatrixOpen, setPairMatrixOpen] = useState(false);
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
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const shouldRefocusRef = useRef(true);
  const futureRefocusSignatureRef = useRef("");
  const rangeAnimationFrameRef = useRef<number | null>(null);
  const rangeSettleTimeoutRef = useRef<number | null>(null);

  const addLog = useCallback((line: string) => {
    setDebugLines((current) => {
      const next = [...current, `[${new Date().toISOString()}] ${line}`];
      return next.slice(-DEBUG_MAX);
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setSessionNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
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

  const updatePairMatrixPreferences = useCallback(
    <K extends keyof PairMatrixPreferences,>(key: K, value: PairMatrixPreferences[K]) => {
      updateChartPreferences((current) => ({
        ...current,
        pairMatrix: {
          ...current.pairMatrix,
          [key]: value,
        },
      }));
    },
    [updateChartPreferences],
  );

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
        setCrosshairReadout(null);
        setCursorChartTime(null);
        return;
      }

      const truePrice = series.coordinateToPrice(point.y);
      const candle = param.seriesData?.get(series) as CandlestickData<Time> | undefined;
      const candlePrice = candle && typeof candle.close === "number" ? candle.close : null;
      const candleTime = candle ? normalizeChartTimestampSeconds(candle.time) : null;
      const pointerTime = normalizeChartTimestampSeconds(param.time);
      setCursorChartTime(candleTime ?? pointerTime);
      const lines = formatCursorReadout({
        mode: chartPreferences.cursorReadoutMode,
        truePrice,
        candlePrice,
        precision: priceFormat.precision,
      });

      if (lines.length === 0) {
        setCrosshairReadout(null);
        return;
      }

      const readoutTop =
        chartPreferences.cursorReadoutMode === "nearest_candle" && candlePrice != null
          ? series.priceToCoordinate(candlePrice) ?? point.y
          : point.y;
      const clampedReadoutTop = Math.min(Math.max(readoutTop, 32), container.clientHeight - 32);

      setCrosshairReadout({
        lines,
        top: clampedReadoutTop,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      setCrosshairReadout(null);
      setCursorChartTime(null);
    };
  }, [chartPreferences.cursorReadoutMode, priceFormat.precision]);

  useEffect(() => {
    setCursorChartTime(null);
  }, [selectedSymbol, timeframe]);

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
      setChartInteracting(true);
      if (rangeAnimationFrameRef.current == null) {
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
        setChartInteracting(false);
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
  }, []);

  useEffect(() => {
    if (historyState !== "ready" || displayCandles.length === 0 || !shouldRefocusRef.current) return;
    const id = window.setTimeout(() => {
      refocusChart();
      shouldRefocusRef.current = false;
    }, 0);
    return () => window.clearTimeout(id);
  }, [historyState, displayCandles, refocusChart]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || historyState !== "ready" || visibleCandles.length === 0 || futureChartEventTimes.length === 0) return;

    const signature = futureChartEventTimes.join(",");
    if (futureRefocusSignatureRef.current === signature) return;
    futureRefocusSignatureRef.current = signature;

    const range = chart.timeScale().getVisibleLogicalRange();
    const lastIndex = visibleCandles.length - 1;
    const isNearLatest = !range || range.to >= lastIndex - 2;
    if (!isNearLatest || chartInteracting) return;

    const id = window.setTimeout(refocusChart, 0);
    return () => window.clearTimeout(id);
  }, [historyState, visibleCandles.length, futureChartEventTimes, chartInteracting, refocusChart]);

  const sessionDetail = useMemo(
    () => getChartSessionDetail(activeMarketStatus, sessionNowMs),
    [activeMarketStatus, sessionNowMs],
  );

  const timezoneOptions = useMemo(() => getDisplayTimezoneOptions(new Date(sessionNowMs)), [sessionNowMs]);
  const displayModeLabel = getChartDisplayModeLabel(displayTimeMode);
  const displayModeShortLabel = getDisplayTimezoneShortLabel(displayTimeMode, new Date(sessionNowMs));
  const currentDisplayTime = formatCurrentTimeForDisplayTimezone({
    nowMs: sessionNowMs,
    selection: displayTimeMode,
    serverTimeSeconds: activeMarketStatus?.server_time ?? lastCandleTime,
    serverFetchedAtMs: activeMarketStatus?.checked_at != null ? activeMarketStatus.checked_at * 1000 : null,
  });

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
      nowSeconds: Math.floor(sessionNowMs / 1000),
    });
  }, [events, selectedSymbol, sessionNowMs]);

  const pairMatrixCurrencies = useMemo(() => getChartEventRelevantCurrencies(selectedSymbol), [selectedSymbol]);
  const pairMatrixAnchorChartTime = cursorChartTime ?? lastCandleTime ?? null;
  const pairMatrixAnchorCalendarTime =
    pairMatrixAnchorChartTime == null ? null : pairMatrixAnchorChartTime - chartSourceTimeOffsetSeconds;
  const pairMatrixRows = useMemo(
    () =>
      pairMatrixAnchorCalendarTime == null
        ? []
        : buildMacroFactorRowsAsOf({
            events,
            currencies: pairMatrixCurrencies,
            anchorTimeSeconds: pairMatrixAnchorCalendarTime,
          }),
    [events, pairMatrixCurrencies, pairMatrixAnchorCalendarTime],
  );
  const pairMatrixCoverageLabel = useMemo(() => {
    if (pairMatrixRows.length === 0) return "No anchor candle";
    const coveredRows = pairMatrixRows.filter((row) => row.latestEvent || row.nextEvent).length;
    return `${coveredRows}/${pairMatrixRows.length} factor cells loaded`;
  }, [pairMatrixRows]);
  const pairMatrixViewRows = useMemo(
    () =>
      pairMatrixAnchorChartTime == null
        ? []
        : buildPairMatrixViewRows({
            factorRows: pairMatrixRows,
            factors: MACRO_FACTOR_DEFINITIONS,
            currencies: pairMatrixCurrencies,
            selectedSymbol,
            visibleCandles,
            cursorChartTime: pairMatrixAnchorChartTime,
            sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
            preferences: chartPreferences.pairMatrix,
          }),
    [
      pairMatrixRows,
      pairMatrixCurrencies,
      selectedSymbol,
      visibleCandles,
      pairMatrixAnchorChartTime,
      chartSourceTimeOffsetSeconds,
      chartPreferences.pairMatrix,
    ],
  );
  const pairMatrixTimeLensData = useMemo<ChartPairMatrixTimeLensData>(
    () => ({
      open: pairMatrixOpen,
      pairLabel: selectedSymbol,
      currencies: pairMatrixCurrencies,
      rows: pairMatrixViewRows,
      preferences: chartPreferences.pairMatrix,
      anchorLabel:
        pairMatrixAnchorChartTime == null
          ? "Waiting for candle"
          : formatChartFeedTime(pairMatrixAnchorChartTime, displayTimeMode, chartSourceTimeOffsetSeconds),
      anchorBasisLabel: cursorChartTime == null ? "latest loaded candle" : "cursor time",
      coverageLabel: pairMatrixCoverageLabel,
      displayTimeMode,
      sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
      onPreferenceChange: updatePairMatrixPreferences,
      onToggleOpen: () => setPairMatrixOpen((current) => !current),
      onClose: () => setPairMatrixOpen(false),
    }),
    [
      pairMatrixOpen,
      selectedSymbol,
      pairMatrixCurrencies,
      pairMatrixViewRows,
      chartPreferences.pairMatrix,
      pairMatrixAnchorChartTime,
      displayTimeMode,
      chartSourceTimeOffsetSeconds,
      cursorChartTime,
      pairMatrixCoverageLabel,
      updatePairMatrixPreferences,
    ],
  );

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
            sessionLabel={sessionDetail.label}
            sessionBasis={sessionDetail.basis}
            lastCandleTime={lastCandleTime}
            feedLabel={feedLabel}
            currentDisplayTime={currentDisplayTime}
            displayModeLabel={displayModeLabel}
            displayModeShortLabel={displayModeShortLabel}
            displayTimeMode={displayTimeMode}
            timezoneOptions={timezoneOptions}
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
        crosshairReadout={crosshairReadout}
        status={status}
        overlayCopy={overlayCopy}
        reachedBoundary={reachedBoundary}
      />
    </div>
  );
}
