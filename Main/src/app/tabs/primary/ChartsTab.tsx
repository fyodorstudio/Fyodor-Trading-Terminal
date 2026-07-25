import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Focus,
  HardDrive,
  MousePointer2,
  Search,
  Settings2,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChartSettingsDrawer, type ChartDrawerMode } from "@/app/components/ChartSettingsDrawer";
import { fetchHistory, fetchHistoryBoundary, fetchHistoryRange, fetchSymbols, openChartStream } from "@/app/lib/bridge";
import {
  CHART_HISTORY_RANGE_MAX_SECONDS,
  CHART_TIMEFRAMES,
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
  getChartEventAnchorTime,
  getChartEventKey,
  isChartEventTimeframeIntraday,
} from "@/app/lib/chartEvents";
import {
  clearChartHistoryCache,
  loadChartFavorites,
  readChartHistoryCache,
  saveChartFavorites,
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
const CURSOR_MODE_OPTIONS: Array<{ id: ChartCursorReadoutMode; label: string; description: string }> = [
  { id: "both", label: "Both", description: "Show exact pointer price and sticky candle close." },
  { id: "true_cursor", label: "Exact", description: "Show the exact price under the pointer." },
  { id: "nearest_candle", label: "Sticky", description: "Stick the readout to the nearest candle close." },
];

type CrosshairReadout = {
  top: number;
  lines: Array<{ label: string; value: string }>;
};

interface GroupedSymbols {
  label: string;
  items: BridgeSymbol[];
}

interface ChartsTabProps {
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

interface ChartEventOverlayPoint {
  key: string;
  event: CalendarEvent;
  x: number;
  timeLabel: string;
  tooltipPlacement: "left" | "center" | "right";
}

interface ChartEventOverlayCluster {
  key: string;
  events: Array<{
    event: CalendarEvent;
    timeLabel: string;
  }>;
  x: number;
  impact: CalendarEvent["impact"];
  badgeLabel: string;
  detailLabel: string;
  tooltipPlacement: "left" | "center" | "right";
  showBadge: boolean;
}

interface ChartEventOverlayData {
  points: ChartEventOverlayPoint[];
  visibleEventCount: number;
  renderedEventCount: number;
  isCapped: boolean;
}

const CHART_EVENT_TOOLTIP_WIDTH = 300;
const CHART_EVENT_CLUSTER_DISTANCE_PX = 24;

function getChartEventImpactRank(impact: CalendarEvent["impact"]): number {
  if (impact === "high") return 0;
  if (impact === "medium") return 1;
  return 2;
}

function interpolateChartEventX(
  chart: IChartApi,
  candles: BridgeCandle[],
  targetTime: number,
): number | null {
  const timeScale = chart.timeScale();
  const exactX = timeScale.timeToCoordinate(targetTime as Time);
  if (exactX != null) return exactX;

  const nextIndex = candles.findIndex((candle) => candle.time >= targetTime);
  const previous = nextIndex > 0 ? candles[nextIndex - 1] : null;
  const next = nextIndex >= 0 ? candles[nextIndex] : null;

  if (previous && next && next.time !== previous.time) {
    const previousX = timeScale.timeToCoordinate(previous.time as Time);
    const nextX = timeScale.timeToCoordinate(next.time as Time);
    if (previousX != null && nextX != null) {
      const progress = (targetTime - previous.time) / (next.time - previous.time);
      return previousX + (nextX - previousX) * progress;
    }
  }

  return null;
}

function resolveChartEventX(
  chart: IChartApi,
  candles: BridgeCandle[],
  timeframe: Timeframe,
  chartTime: number,
): number | null {
  if (!isChartEventTimeframeIntraday(timeframe)) {
    const anchorTime = getChartEventAnchorTime(chartTime, candles, timeframe);
    return anchorTime == null ? null : chart.timeScale().timeToCoordinate(anchorTime as Time);
  }

  return interpolateChartEventX(chart, candles, chartTime);
}

function getChartEventTooltipPlacement(x: number, containerWidth: number): ChartEventOverlayPoint["tooltipPlacement"] {
  if (x < CHART_EVENT_TOOLTIP_WIDTH / 2) return "right";
  if (x > containerWidth - CHART_EVENT_TOOLTIP_WIDTH / 2) return "left";
  return "center";
}

function getDominantImpact(events: CalendarEvent[]): CalendarEvent["impact"] {
  if (events.some((event) => event.impact === "high")) return "high";
  if (events.some((event) => event.impact === "medium")) return "medium";
  return "low";
}

function getChartEventClusterBadge(events: CalendarEvent[]): string {
  if (events.length === 1) {
    const event = events[0];
    return event.impact === "high" ? `${event.currency} high` : event.currency;
  }

  const currencies = Array.from(new Set(events.map((event) => event.currency)));
  if (currencies.length === 1) return `${currencies[0]} x${events.length}`;
  return `${events.length} events`;
}

function getChartEventClusterDetail(events: CalendarEvent[]): string {
  if (events.length === 1) return events[0]?.title ?? "Loaded event";
  const highCount = events.filter((event) => event.impact === "high").length;
  const currencies = Array.from(new Set(events.map((event) => event.currency))).join(" / ");
  return highCount > 0 ? `${currencies} / ${highCount} high impact` : `${currencies} / ${events.length} loaded events`;
}

function clusterChartEventPoints(points: ChartEventOverlayPoint[], containerWidth: number): ChartEventOverlayCluster[] {
  const clusters: Array<{ points: ChartEventOverlayPoint[]; x: number }> = [];

  points.forEach((point) => {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(point.x - last.x) <= CHART_EVENT_CLUSTER_DISTANCE_PX) {
      last.points.push(point);
      last.x = last.points.reduce((sum, item) => sum + item.x, 0) / last.points.length;
      return;
    }

    clusters.push({ points: [point], x: point.x });
  });

  const crowded = clusters.length > 10;

  const mapped = clusters.map((cluster) => {
    const events = cluster.points.map((point) => point.event);
    const impact = getDominantImpact(events);
    const key = cluster.points.map((point) => point.key).join("|");
    return {
      key,
      events: cluster.points.map((point) => ({
        event: point.event,
        timeLabel: point.timeLabel,
      })),
      x: cluster.x,
      impact,
      badgeLabel: getChartEventClusterBadge(events),
      detailLabel: getChartEventClusterDetail(events),
      tooltipPlacement: getChartEventTooltipPlacement(cluster.x, containerWidth),
      showBadge: !crowded || impact === "high" || events.length > 1,
    };
  });

  const badgeClusters = mapped.map((cluster) => ({ ...cluster }));
  let lastShownIndex: number | null = null;

  badgeClusters.forEach((cluster, index) => {
    if (!cluster.showBadge) return;

    if (lastShownIndex == null) {
      lastShownIndex = index;
      return;
    }

    const previous = badgeClusters[lastShownIndex];
    const minGap = cluster.events.length > 1 || previous.events.length > 1 ? 104 : 84;
    if (Math.abs(cluster.x - previous.x) >= minGap) {
      lastShownIndex = index;
      return;
    }

    const previousScore =
      (previous.events.length > 1 ? 2 : 0) + (previous.impact === "high" ? 1 : previous.impact === "medium" ? 0.5 : 0);
    const currentScore =
      (cluster.events.length > 1 ? 2 : 0) + (cluster.impact === "high" ? 1 : cluster.impact === "medium" ? 0.5 : 0);

    if (currentScore > previousScore) {
      previous.showBadge = false;
      lastShownIndex = index;
      return;
    }

    cluster.showBadge = false;
  });

  return badgeClusters;
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
  const [favorites, setFavorites] = useState<string[]>(() => loadChartFavorites());
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [chartDrawerMode, setChartDrawerMode] = useState<ChartDrawerMode>("appearance");
  const [cacheRevision, setCacheRevision] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [lastCandleTime, setLastCandleTime] = useState<number | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [visibleCandles, setVisibleCandles] = useState<BridgeCandle[]>([]);
  const [boundaryTime, setBoundaryTime] = useState<number | null>(null);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());
  const [crosshairReadout, setCrosshairReadout] = useState<CrosshairReadout | null>(null);
  const [chartRangeRevision, setChartRangeRevision] = useState(0);
  const [chartLayoutRevision, setChartLayoutRevision] = useState(0);
  const [hoveredChartEventClusterKey, setHoveredChartEventClusterKey] = useState<string | null>(null);
  const [activeChartEventClusterKey, setActiveChartEventClusterKey] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
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
      if (!pickerRef.current?.contains(target)) setPickerOpen(false);
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
        const groups = Array.from(
          new Set(
            items.map((item) => {
              const root = item.path?.split(/[\\/]/)[0]?.trim();
              return root || "Other";
            }),
          ),
        ).sort();
        setExpandedGroups(groups.length > 0 ? [groups[0]] : []);
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

  const groupedSymbols = useMemo<GroupedSymbols[]>(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? symbols.filter((item) => item.name.toLowerCase().includes(query))
      : symbols;
    const groups = new Map<string, BridgeSymbol[]>();
    filtered.forEach((item) => {
      const group = item.path?.split(/[\\/]/)[0]?.trim() || "Other";
      const list = groups.get(group) ?? [];
      list.push(item);
      groups.set(group, list);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items }));
  }, [search, symbols]);

  const favoriteItems = useMemo(
    () =>
      favorites
        .map((name) => symbols.find((item) => item.name === name))
        .filter((item): item is BridgeSymbol => item != null),
    [favorites, symbols],
  );

  const toggleFavorite = useCallback((name: string) => {
    setFavorites((current) => {
      const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
      saveChartFavorites(next);
      return next;
    });
  }, []);

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
        <div className="chart-workbar-left">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="chart-symbol-button"
            >
              <Search className="h-4 w-4 text-gray-400" />
              <span>{selectedSymbol}</span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                >
                  <div className="p-3 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search symbols..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-gray-200"
                      />
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-auto p-2 space-y-1">
                    {favoriteItems.length > 0 && !search && (
                      <div className="mb-4">
                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Favorites</div>
                        {favoriteItems.map((item) => (
                          <button
                            key={item.name}
                            onClick={() => { onSelectedSymbolChange(item.name); setPickerOpen(false); }}
                            className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg text-sm group"
                          >
                            <span className="font-bold text-gray-700">{item.name}</span>
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          </button>
                        ))}
                      </div>
                    )}

                    {groupedSymbols.map((group) => {
                      const isOpen = search ? true : expandedGroups.includes(group.label);
                      return (
                        <div key={group.label} className="border-b border-gray-50 last:border-0">
                          <button
                            onClick={() => setExpandedGroups(prev => prev.includes(group.label) ? prev.filter(g => g !== group.label) : [...prev, group.label])}
                            className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-500 font-bold"
                          >
                            <span className="flex items-center gap-2">
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              {group.label}
                            </span>
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{group.items.length}</span>
                          </button>
                          
                          {isOpen && (
                            <div className="overflow-hidden pb-1">
                              {group.items.map((item) => (
                                <button
                                  key={item.name}
                                  onClick={() => { onSelectedSymbolChange(item.name); setPickerOpen(false); }}
                                  className="flex items-center justify-between w-full pl-8 pr-3 py-2 hover:bg-gray-50 rounded-lg text-sm"
                                >
                                  <span className="font-medium text-gray-700">{item.name}</span>
                                  <Star 
                                    className={`h-3.5 w-3.5 transition-colors ${favorites.includes(item.name) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-gray-400'}`}
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.name); }}
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {groupedSymbols.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        No symbols match your search.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="chart-timeframe-strip">
            {CHART_TIMEFRAMES.map((item) => (
              <button
                key={item}
                onClick={() => setTimeframe(item)}
                className={timeframe === item ? "chart-timeframe-button is-active" : "chart-timeframe-button"}
              >
                {item === "MN1" ? "MN" : item}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-tool-strip" aria-label="Chart tools">
          <div className="chart-readout-toggle" aria-label="Cursor readout mode">
            <MousePointer2 className="h-4 w-4 text-slate-400" />
            {CURSOR_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.description}
                className={chartPreferences.cursorReadoutMode === option.id ? "is-active" : ""}
                onClick={() => handleCursorModeChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="chart-icon-button" title="Refocus chart" aria-label="Refocus chart" onClick={refocusChart}>
            <Focus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={chartPreferences.eventOverlay.visible ? "chart-icon-button is-active" : "chart-icon-button"}
            title={`Chart events (${chartEventCandidates.length} loaded matches)`}
            aria-label="Open chart events"
            onClick={() => openChartDrawer("events")}
          >
            <CalendarDays className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="chart-icon-button"
            title="Chart appearance"
            aria-label="Open chart appearance"
            onClick={() => openChartDrawer("appearance")}
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="chart-icon-button"
            title="Data cache"
            aria-label="Open chart data cache"
            onClick={() => openChartDrawer("cache")}
          >
            <HardDrive className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="chart-status-rail">
        <div className={`chart-status-chip chart-status-${status}`}>
          <Activity className={status === "live" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
          <span>{streamStatusLabel}</span>
        </div>
        <div className="chart-status-chip" title={sessionDetail.basis}>
          <Clock className="h-4 w-4" />
          <span>{sessionDetail.label}</span>
        </div>
        <div className="chart-status-chip chart-feed-chip">
          <div className="tv-toolbar-anchor" ref={timezoneMenuRef}>
            <button
              type="button"
              onClick={() => setTimezoneMenuOpen((current) => !current)}
              title={`Chart timezone. Current mode: ${displayModeLabel}.`}
              className="chart-feed-button"
            >
              <Database className={lastCandleTime ? "h-4 w-4 text-blue-400" : "h-4 w-4 text-slate-500"} />
              <span className="chart-feed-main">{feedLabel}</span>
              <span className="chart-feed-sub">Viewer clock: {currentDisplayTime} | {displayModeShortLabel}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${timezoneMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {timezoneMenuOpen && (
              <div className="tv-popover tv-filter-popover chart-timezone-popover">
                <div className="tv-popover-head">
                  <strong>Chart timezone</strong>
                  <span>Axis labels and crosshair labels are candle timestamps. Viewer clock is only the current time in the selected display timezone.</span>
                </div>
                <div className="tv-timezone-list">
                  {timezoneOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={displayTimeMode === option.id ? "tv-option-row is-selected" : "tv-option-row"}
                      onClick={() => handleDisplayTimeModeChange(option.id)}
                    >
                      <span className="tv-option-main">
                        <Clock size={15} />
                        <span className="tv-option-label">
                          {option.label}
                          {option.isHighlighted ? <span className="tv-option-badge">Local</span> : null}
                        </span>
                      </span>
                      {displayTimeMode === option.id && <Check size={15} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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

      {/* Main Chart Section */}
      <div className="relative group min-h-0 flex-1 overflow-hidden">
        <div className="h-full p-1 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden">
          <div className="chart-canvas-frame">
            <div ref={containerRef} className="h-full w-full" />
            {chartEventOverlayClusters.length > 0 && (
              <div className="chart-event-overlay" aria-label="Loaded economic events on chart">
                {chartEventOverlayData.isCapped ? (
                  <div className="chart-event-density-note" aria-live="polite">
                    Showing {chartEventOverlayData.renderedEventCount} of {chartEventOverlayData.visibleEventCount} events in view
                  </div>
                ) : null}
                {chartEventOverlayClusters.map((cluster) => {
                  const isHovered = hoveredChartEventClusterKey === cluster.key;
                  const isActive = activeChartEventClusterKey === cluster.key;
                  const shouldShowBadge = cluster.showBadge || isHovered || isActive;
                  const markerStyle = {
                    left: cluster.x,
                  } satisfies CSSProperties;

                  return (
                    <div
                      key={cluster.key}
                      role="button"
                      tabIndex={0}
                      className={`chart-event-marker chart-event-${cluster.impact} tooltip-${cluster.tooltipPlacement} ${isActive ? "is-active" : ""}`}
                      style={markerStyle}
                      onClick={() =>
                        setActiveChartEventClusterKey((current) => (current === cluster.key ? null : cluster.key))
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setActiveChartEventClusterKey((current) => (current === cluster.key ? null : cluster.key));
                      }}
                      onMouseEnter={() => setHoveredChartEventClusterKey(cluster.key)}
                      onMouseLeave={() => setHoveredChartEventClusterKey(null)}
                      onFocus={() => setHoveredChartEventClusterKey(cluster.key)}
                      aria-label={`Open ${cluster.events.length} loaded chart event${cluster.events.length === 1 ? "" : "s"}`}
                    >
                      <span className="chart-event-line" />
                      <span className="chart-event-dot" />
                      {shouldShowBadge && (
                        <span className="chart-event-badge">
                          <strong>{cluster.badgeLabel}</strong>
                          <small>{cluster.impact}</small>
                        </span>
                      )}
                      {(isHovered || isActive) && (
                        <span className="chart-event-tooltip">
                          <span className="chart-event-tooltip-kicker">
                            {cluster.events.length} loaded event{cluster.events.length === 1 ? "" : "s"}
                          </span>
                          <strong>{cluster.detailLabel}</strong>
                          <span>Click a row to open the Economic Calendar inspector.</span>
                          <span className="chart-event-list">
                            {cluster.events.map(({ event, timeLabel }) => (
                              <span
                                key={getChartEventKey(event)}
                                role="button"
                                tabIndex={0}
                                className="chart-event-list-row"
                                onClick={(rowEvent) => {
                                  rowEvent.stopPropagation();
                                  onOpenCalendarEvent(event);
                                }}
                                onKeyDown={(rowEvent) => {
                                  if (rowEvent.key !== "Enter" && rowEvent.key !== " ") return;
                                  rowEvent.preventDefault();
                                  rowEvent.stopPropagation();
                                  onOpenCalendarEvent(event);
                                }}
                              >
                                <span>
                                  <b>{event.currency}</b>
                                  <small>{event.impact}</small>
                                </span>
                                <strong>{event.title}</strong>
                                <em>{timeLabel}</em>
                              </span>
                            ))}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {crosshairReadout && (
          <div
            className="chart-crosshair-readout"
            style={{ top: crosshairReadout.top }}
            aria-hidden="true"
          >
            {crosshairReadout.lines.map((line) => (
              <div key={line.label} className="chart-crosshair-readout-line">
                <span>{line.label}</span>
                <strong>{line.value}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="charts-history-boundary" aria-live="polite">
          <span className={`charts-history-boundary-pill ${reachedBoundary ? "is-visible" : ""}`}>
            Oldest available MT5 candle, approximate
          </span>
        </div>

        {/* Overlay for errors/no data */}
        <AnimatePresence>
          {(status === "error" || status === "no_data") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/40 backdrop-blur-xl rounded-3xl z-50 text-center p-8"
            >
              <div className="p-4 bg-red-50 rounded-full text-red-500">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{overlayCopy.title}</h3>
                <p className="text-gray-600 max-w-sm">{overlayCopy.description}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Debug Panel (Collapsible) */}
      <div className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl overflow-hidden shadow-sm">
        <div className={`flex items-center justify-between px-5 py-3 ${consoleOpen ? "border-b border-gray-100" : ""}`}>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Terminal Console
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
              {debugLines.length} logs
            </span>
          </h3>
          <div className="flex items-center gap-3">
            {consoleOpen && (
              <button
                onClick={() => void navigator.clipboard.writeText(debugLines.join("\n") || "(empty)")}
                className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
              >
                Copy Logs
              </button>
            )}
            <button
              onClick={() => setConsoleOpen((current) => !current)}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              {consoleOpen ? "Hide" : "Show"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${consoleOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        {consoleOpen && (
          <div className="h-20 overflow-auto p-3 bg-gray-50/50 font-mono text-[10px] leading-relaxed text-gray-500">
            {debugLines.length === 0 ? (
              <div className="italic">Awaiting first market event...</div>
            ) : (
              debugLines.map((line, index) => <div key={index} className="mb-1">{line}</div>)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
