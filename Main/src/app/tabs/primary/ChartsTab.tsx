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
import { ChartViewport, type ChartCrosshairReadout } from "@/app/components/ChartViewport";
import { fetchHistory, fetchHistoryBoundary, fetchHistoryRange, fetchSymbols, openChartStream } from "@/app/lib/bridge";
import {
  CHART_HISTORY_RANGE_MAX_SECONDS,
  DEFAULT_CHART_SYMBOL,
  getChartConnectionLabel,
  getChartPriceFormat,
  getCrosshairMode,
  pickInitialChartSymbol,
} from "@/app/lib/chartDisplay";
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
  mergeChartCandles,
  saveChartPreferences,
  saveChartDisplayTimeMode,
  type ChartAppearancePreferences,
  type ChartCursorReadoutMode,
  type ChartDisplayTimeMode,
  type ChartEventOverlayPreferences,
  type ChartPreferences,
} from "@/app/lib/chartView";
import {
  filterChartEventsForOverlay,
  formatChartEventDisplayTime,
  getChartEventKey,
} from "@/app/lib/chartEvents";
import {
  clusterChartEventPoints,
  getChartEventImpactRank,
  getChartEventTooltipPlacement,
  resolveChartEventX,
  type ChartEventOverlayCluster,
  type ChartEventOverlayPoint,
} from "@/app/lib/chartEventOverlay";
import {
  clearChartHistoryCache,
  readChartHistoryCache,
  saveChartHistoryCache,
  summarizeStoredChartHistory,
} from "@/app/lib/chartStorage";
import { resolveChartStatus } from "@/app/lib/status";
import {
  formatCurrentTimeForDisplayTimezone,
  getDisplayTimezoneOptions,
  getDisplayTimezoneShortLabel,
} from "@/app/lib/timezoneDisplay";
import type { BridgeCandle, BridgeStatus, BridgeSymbol, CalendarEvent, MarketStatusResponse, Timeframe } from "@/app/types";

const DEBUG_MAX = 60;

interface ChartsTabProps {
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

interface ChartEventOverlayData {
  points: ChartEventOverlayPoint[];
  visibleEventCount: number;
  renderedEventCount: number;
  isCapped: boolean;
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
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "no_data" | "error">("loading");
  const [symbols, setSymbols] = useState<BridgeSymbol[]>([]);
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [chartDrawerMode, setChartDrawerMode] = useState<ChartDrawerMode>("appearance");
  const [cacheRevision, setCacheRevision] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [lastCandleTime, setLastCandleTime] = useState<number | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [visibleCandles, setVisibleCandles] = useState<BridgeCandle[]>([]);
  const [boundaryTime, setBoundaryTime] = useState<number | null>(null);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());
  const [crosshairReadout, setCrosshairReadout] = useState<ChartCrosshairReadout | null>(null);
  const [chartRangeRevision, setChartRangeRevision] = useState(0);
  const [chartLayoutRevision, setChartLayoutRevision] = useState(0);
  const [hoveredChartEventClusterKey, setHoveredChartEventClusterKey] = useState<string | null>(null);
  const [activeChartEventClusterKey, setActiveChartEventClusterKey] = useState<string | null>(null);
  const timezoneMenuRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const visibleRangeRef = useRef<{ from?: number; to?: number } | null>(null);
  const loadingOlderRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const boundaryCacheRef = useRef(new Map<string, number | null>());
  const shouldRefocusRef = useRef(true);

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

  const priceFormat = useMemo(
    () => getChartPriceFormat(selectedSymbol, activeMarketStatus?.asset_class ?? null),
    [selectedSymbol, activeMarketStatus?.asset_class],
  );

  const displayCandles = useMemo(
    () => getChartDisplayCandles(visibleCandles),
    [visibleCandles],
  );

  const refocusChart = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || visibleCandles.length === 0) return;

    const lastIndex = visibleCandles.length - 1;
    const windowBars = Math.min(Math.max(visibleCandles.length, 60), 120);
    const halfWindow = windowBars / 2;

    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(-0.5, lastIndex - halfWindow),
      to: lastIndex + halfWindow,
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
  }, [visibleCandles]);

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

  const openChartDrawer = useCallback((mode: ChartDrawerMode) => {
    setChartDrawerMode(mode);
    setHistoryPanelOpen(true);
  }, []);

  const resetChartPreferences = useCallback(() => {
    setChartPreferences(DEFAULT_CHART_PREFERENCES);
    saveChartPreferences(DEFAULT_CHART_PREFERENCES);
  }, []);

  const clearCurrentCache = useCallback(() => {
    clearChartHistoryCache(selectedSymbol, timeframe);
    setCacheRevision((current) => current + 1);
    addLog(`cleared local chart cache for ${selectedSymbol} ${timeframe}`);
  }, [addLog, selectedSymbol, timeframe]);

  useEffect(() => {
    let cancelled = false;
    void fetchSymbols().then((items) => {
      if (cancelled) return;
      setSymbols(items);
      if (items.length > 0) {
        onSelectedSymbolChange(
          selectedSymbol === DEFAULT_CHART_SYMBOL ? pickInitialChartSymbol(items) : selectedSymbol,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [onSelectedSymbolChange]);

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
        scaleMargins: { top: 0.1, bottom: 0.2 }
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
        return;
      }

      const truePrice = series.coordinateToPrice(point.y);
      const candle = param.seriesData?.get(series) as CandlestickData<Time> | undefined;
      const candlePrice = candle && typeof candle.close === "number" ? candle.close : null;
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
    };
  }, [chartPreferences.cursorReadoutMode, priceFormat.precision]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({
      priceFormat,
    });

    let cancelled = false;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setHistoryState("loading");
    setChartLoadError(null);
    setVisibleCandles([]);
    setBoundaryTime(null);
    shouldRefocusRef.current = true;

    const load = async () => {
      try {
        const boundaryCacheKey = `${selectedSymbol.toUpperCase()}|${timeframe}`;
        const cached = readChartHistoryCache(selectedSymbol, timeframe);
        if (cached.length > 0) {
          setVisibleCandles(cached);
          setLastCandleTime(cached[cached.length - 1]?.time ?? null);
          setHistoryState("ready");
          addLog(`loaded ${cached.length} cached candles for ${selectedSymbol} ${timeframe} while refreshing`);
        }
        const cachedBoundary = boundaryCacheRef.current.get(boundaryCacheKey) ?? null;
        let boundaryTimeValue = cachedBoundary;
        if (boundaryTimeValue == null) {
          try {
            const boundary = await fetchHistoryBoundary({ symbol: selectedSymbol, tf: timeframe });
            boundaryTimeValue = boundary.oldest_time;
            boundaryCacheRef.current.set(boundaryCacheKey, boundaryTimeValue);
          } catch {
            boundaryTimeValue = null;
            boundaryCacheRef.current.delete(boundaryCacheKey);
          }
        }
        if (cancelled || loadRequestIdRef.current !== requestId) return;

        const candles = await fetchHistory(selectedSymbol, timeframe, 5000);
        if (cancelled || loadRequestIdRef.current !== requestId) return;
        if (candles.length === 0) {
          if (cached.length > 0) {
            setBoundaryTime(boundaryTimeValue);
            addLog(`history refresh returned no candles for ${selectedSymbol} ${timeframe}; keeping cached history visible`);
            return;
          }
          setVisibleCandles([]);
          setBoundaryTime(boundaryTimeValue);
          setHistoryState("no_data");
          setLastCandleTime(null);
          setChartLoadError(`No candle history returned for ${selectedSymbol} ${timeframe}. The broker may not expose this symbol or timeframe, or MT5 has no history downloaded yet.`);
          addLog(`history returned no candles for ${selectedSymbol} ${timeframe}`);
          return;
        }

        setHistoryState("ready");
        setLastCandleTime(candles[candles.length - 1]?.time ?? null);
        setVisibleCandles(candles);
        setBoundaryTime(boundaryTimeValue);
        saveChartHistoryCache(selectedSymbol, timeframe, candles);
        addLog(`history loaded ${candles.length} candles for ${selectedSymbol} ${timeframe}`);
      } catch (error) {
        if (cancelled || loadRequestIdRef.current !== requestId) return;
        setVisibleCandles([]);
        setBoundaryTime(null);
        setHistoryState("error");
        setLastCandleTime(null);
        const message = error instanceof Error ? error.message : String(error);
        setChartLoadError(
          message.includes("symbol_select failed")
            ? `MT5 could not select ${selectedSymbol}. This usually means the broker does not offer this symbol under that exact name.`
            : message.includes("No data from MT5")
              ? `MT5 selected ${selectedSymbol}, but no candle history came back for ${timeframe}. The broker may not provide history for this symbol/timeframe yet.`
              : message.includes("MT5 terminal not connected")
                ? "MT5 is disconnected, so the bridge cannot fetch chart data."
                : `The bridge could not load ${selectedSymbol} ${timeframe}: ${message}`,
        );
        addLog(
          `history failed for ${selectedSymbol} ${timeframe}: ${message}`,
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
      loadingOlderRef.current = false;
    };
  }, [selectedSymbol, timeframe, addLog, activeMarketStatus?.asset_class, priceFormat]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const onRangeChange = async (range: { from?: number; to?: number } | null) => {
      visibleRangeRef.current = range;
      setChartRangeRevision((current) => current + 1);
      if (!range || historyState !== "ready" || loadingOlderRef.current) return;
      const oldestTime = visibleCandles[0]?.time;
      if (!oldestTime || range.from == null) return;

      const shouldLoadMore = range.from < 20;
      if (!shouldLoadMore) return;

      loadingOlderRef.current = true;
      try {
        let currentCandles = visibleCandles;
        let currentOldest = oldestTime;
        const maxChainLoads = 10;

        for (let chain = 0; chain < maxChainLoads; chain += 1) {
          const end = currentOldest - 1;
          if (end <= 0) break;

          const start = Math.max(0, end - CHART_HISTORY_RANGE_MAX_SECONDS);
          const older = await fetchHistoryRange({ symbol: selectedSymbol, tf: timeframe, from: start, to: end });
          if (older.length === 0) {
            break;
          }

          const merged = mergeChartCandles(older, currentCandles);
          if (merged.length > currentCandles.length) {
            currentCandles = merged;
            currentOldest = merged[0]?.time ?? currentOldest;
            setVisibleCandles(merged);
            saveChartHistoryCache(selectedSymbol, timeframe, merged);
          } else {
            break;
          }

          if (older.length < 2 || start === 0) {
            break;
          }
          if (visibleRangeRef.current?.from != null && visibleRangeRef.current.from >= 20) {
            break;
          }
        }
      } catch (error) {
        addLog(
          `older history load failed for ${selectedSymbol} ${timeframe}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        loadingOlderRef.current = false;
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
  }, [selectedSymbol, timeframe, historyState, visibleCandles, addLog]);

  const marketClassLabel =
    activeMarketStatus?.asset_class === "crypto"
      ? "crypto"
      : activeMarketStatus?.asset_class === "metals"
        ? "metals"
        : activeMarketStatus?.asset_class === "forex"
          ? "forex"
          : "market";
  const marketOpenLogLine = `market open for ${selectedSymbol}; streaming live ${marketClassLabel} candles`;

  useEffect(() => {
    setStreamConnected(false);
    if (historyState !== "ready") return;
    if (activeMarketStatus?.session_state === "closed" && activeMarketStatus.asset_class !== "crypto") {
      addLog(`market closed for ${selectedSymbol}; keeping last known candles on screen`);
      return;
    }

    const socket = openChartStream(selectedSymbol, timeframe, {
      onOpen: () => {
        setStreamConnected(true);
        addLog("WebSocket connected");
        if (activeMarketStatus?.session_state !== "closed" || activeMarketStatus.asset_class === "crypto") {
          addLog(marketOpenLogLine);
        }
      },
      onClose: () => {
        setStreamConnected(false);
        addLog("WebSocket closed");
      },
      onError: () => {
        setStreamConnected(false);
        addLog("WebSocket error");
      },
      onMessage: (payload) => {
        if (!payload || typeof payload !== "object") return;
        const message = payload as {
          type?: string;
          message?: string;
          candle?: CandlestickData;
        };
        if (
          (message.type === "candle_update" || message.type === "candle_new") &&
          message.candle &&
          typeof message.candle.time === "number"
        ) {
          const nextCandle = {
            time: message.candle.time,
            open: message.candle.open,
            high: message.candle.high,
            low: message.candle.low,
            close: message.candle.close,
            volume: 0,
          } satisfies BridgeCandle;
          setVisibleCandles((current) => {
            const next = mergeChartCandles(current, [nextCandle]);
            saveChartHistoryCache(selectedSymbol, timeframe, next);
            return next;
          });
          setLastCandleTime(nextCandle.time);
          setStreamConnected(true);
        }
        if (message.type === "status" && message.message === "mt5_not_connected") {
          setStreamConnected(false);
          addLog("bridge reported MT5 not connected; keeping last known candles visible");
        }
        if (message.type === "status" && message.message === "no_data") {
          setStreamConnected(false);
          addLog("bridge stream reported no live update; chart remains on last known candles");
        }
      },
    });

    return () => socket.close();
  }, [
    selectedSymbol,
    timeframe,
    historyState,
    activeMarketStatus?.session_state,
    activeMarketStatus?.asset_class,
    marketOpenLogLine,
    addLog,
  ]);

  useEffect(() => {
    if (historyState !== "ready" || displayCandles.length === 0 || !shouldRefocusRef.current) return;
    const id = window.setTimeout(() => {
      refocusChart();
      shouldRefocusRef.current = false;
    }, 0);
    return () => window.clearTimeout(id);
  }, [historyState, displayCandles, refocusChart]);

  const status: BridgeStatus = useMemo(
    () =>
      resolveChartStatus({
        historyState,
        marketStatus: activeMarketStatus,
        streamConnected,
      }),
    [historyState, activeMarketStatus, streamConnected],
  );

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
  const cacheSummary = useMemo(
    () => summarizeStoredChartHistory(selectedSymbol, timeframe),
    [cacheRevision, selectedSymbol, timeframe, visibleCandles.length],
  );
  const cacheOldestLabel = cacheSummary.oldestTime
    ? formatChartFeedTime(cacheSummary.oldestTime, displayTimeMode, chartSourceTimeOffsetSeconds)
    : "Empty";
  const cacheLatestLabel = cacheSummary.latestTime
    ? formatChartFeedTime(cacheSummary.latestTime, displayTimeMode, chartSourceTimeOffsetSeconds)
    : "Empty";
  const streamStatusLabel =
    getChartConnectionLabel({ historyState, marketStatus: activeMarketStatus, streamConnected });

  const chartEventCandidates = useMemo(
    () =>
      filterChartEventsForOverlay({
        events,
        selectedSymbol,
        scope: chartPreferences.eventOverlay.scope,
        impactFilter: chartPreferences.eventOverlay.impactFilter,
        sourceTimeOffsetSeconds: chartSourceTimeOffsetSeconds,
      }),
    [
      events,
      selectedSymbol,
      chartPreferences.eventOverlay.scope,
      chartPreferences.eventOverlay.impactFilter,
      chartSourceTimeOffsetSeconds,
    ],
  );

  const chartEventOverlayData = useMemo<ChartEventOverlayData>(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container || !chartPreferences.eventOverlay.visible || visibleCandles.length === 0) {
      return { points: [], visibleEventCount: 0, renderedEventCount: 0, isCapped: false };
    }

    const width = container.clientWidth;
    if (width <= 0) {
      return { points: [], visibleEventCount: 0, renderedEventCount: 0, isCapped: false };
    }

    const visibleRange = chart.timeScale().getVisibleRange();
    const firstCandle = visibleCandles[0];
    const lastCandle = visibleCandles[visibleCandles.length - 1];
    const fallbackFrom = firstCandle?.time ?? 0;
    const fallbackTo = lastCandle?.time ?? fallbackFrom;
    const visibleFrom = typeof visibleRange?.from === "number" ? visibleRange.from : fallbackFrom;
    const visibleTo = typeof visibleRange?.to === "number" ? visibleRange.to : fallbackTo;
    const candleSpacing =
      visibleCandles.length > 1
        ? Math.max(60, Math.abs((lastCandle.time - firstCandle.time) / Math.max(1, visibleCandles.length - 1)))
        : 3600;
    const rangeBuffer = candleSpacing * 2;
    const rangeMidpoint = (visibleFrom + visibleTo) / 2;
    const maxMarkers = chartPreferences.eventOverlay.maxMarkers;
    const visibleCandidates = chartEventCandidates.filter(
      (candidate) => candidate.chartTime >= visibleFrom - rangeBuffer && candidate.chartTime <= visibleTo + rangeBuffer,
    );
    const cappedCandidates =
      visibleCandidates.length <= maxMarkers
        ? visibleCandidates
        : [...visibleCandidates]
            .sort((left, right) => {
              const impactDelta = getChartEventImpactRank(left.event.impact) - getChartEventImpactRank(right.event.impact);
              if (impactDelta !== 0) return impactDelta;
              return Math.abs(left.chartTime - rangeMidpoint) - Math.abs(right.chartTime - rangeMidpoint);
            })
            .slice(0, maxMarkers)
            .sort((left, right) => left.chartTime - right.chartTime);

    const points = cappedCandidates
      .map((candidate) => {
        const x = resolveChartEventX(chart, visibleCandles, timeframe, candidate.chartTime);
        if (x == null || x < -24 || x > width + 24) return null;

        return {
          key: getChartEventKey(candidate.event),
          event: candidate.event,
          x,
          timeLabel: formatChartEventDisplayTime(
            candidate.event.time,
            displayTimeMode,
            chartSourceTimeOffsetSeconds,
          ),
          tooltipPlacement: getChartEventTooltipPlacement(x, width),
        };
      })
      .filter((point): point is ChartEventOverlayPoint => point != null)
      .sort((left, right) => left.x - right.x);

    return {
      points,
      visibleEventCount: visibleCandidates.length,
      renderedEventCount: cappedCandidates.length,
      isCapped: visibleCandidates.length > cappedCandidates.length,
    };
  }, [
    chartEventCandidates,
    chartPreferences.eventOverlay.visible,
    chartPreferences.eventOverlay.maxMarkers,
    visibleCandles,
    timeframe,
    displayTimeMode,
    chartSourceTimeOffsetSeconds,
    chartRangeRevision,
    chartLayoutRevision,
  ]);

  const chartEventOverlayClusters = useMemo<ChartEventOverlayCluster[]>(() => {
    const container = containerRef.current;
    return clusterChartEventPoints(chartEventOverlayData.points, container?.clientWidth ?? 0);
  }, [chartEventOverlayData.points]);

  useEffect(() => {
    setActiveChartEventClusterKey(null);
    setHoveredChartEventClusterKey(null);
  }, [selectedSymbol, timeframe, chartPreferences.eventOverlay.scope, chartPreferences.eventOverlay.visible]);

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

  const reachedBoundary = boundaryTime != null && visibleCandles.length > 0 && visibleCandles[0].time <= boundaryTime;

  return (
    <div className="workspace-page workspace-page-compact charts-tab-page flex h-[calc(100vh-98px)] min-h-[560px] flex-col overflow-hidden">
      <div className="chart-workbar">
        <ChartSymbolPicker
          selectedSymbol={selectedSymbol}
          symbols={symbols}
          timeframe={timeframe}
          onSelectedSymbolChange={onSelectedSymbolChange}
          onTimeframeChange={setTimeframe}
        />

        <ChartToolStrip
          cursorReadoutMode={chartPreferences.cursorReadoutMode}
          eventOverlayVisible={chartPreferences.eventOverlay.visible}
          eventCandidateCount={chartEventCandidates.length}
          onCursorModeChange={handleCursorModeChange}
          onRefocusChart={refocusChart}
          onOpenDrawer={openChartDrawer}
        />
      </div>

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
      />

      <ChartViewport
        containerRef={containerRef}
        clusters={chartEventOverlayClusters}
        eventOverlay={chartEventOverlayData}
        hoveredClusterKey={hoveredChartEventClusterKey}
        activeClusterKey={activeChartEventClusterKey}
        onHoverCluster={setHoveredChartEventClusterKey}
        onToggleCluster={(key) => setActiveChartEventClusterKey((current) => (current === key ? null : key))}
        onOpenCalendarEvent={onOpenCalendarEvent}
        crosshairReadout={crosshairReadout}
        status={status}
        overlayCopy={overlayCopy}
        reachedBoundary={reachedBoundary}
        consoleOpen={consoleOpen}
        debugLines={debugLines}
        onToggleConsole={() => setConsoleOpen((current) => !current)}
      />
    </div>
  );
}
