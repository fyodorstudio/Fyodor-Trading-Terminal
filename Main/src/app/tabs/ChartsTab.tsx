import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { ChevronDown, ChevronRight, Search, Star, Activity, Clock, AlertTriangle, Database, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchHistory, fetchHistoryBoundary, fetchHistoryRange, fetchSymbols, openChartStream } from "@/app/lib/bridge";
import { formatUtcDateTime, formatCountdown, pad } from "@/app/lib/format";
import { resolveChartStatus } from "@/app/lib/status";
import type { BridgeCandle, BridgeStatus, BridgeSymbol, MarketStatusResponse, Timeframe } from "@/app/types";

const FAVORITES_KEY = "fyodor-main-chart-favorites";
const CHART_HISTORY_CACHE_KEY = "fyodor-main-chart-history-cache-v1";
const CHART_HISTORY_CONFIG_VERSION = 1;
const DEBUG_MAX = 60;
const DEFAULT_SYMBOL = "EURUSD";
const TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];
const PREFERRED_SYMBOLS = ["EURUSD", "USDJPY", "GBPUSD", "XAUUSD"];

type HistoryCacheEntry = {
  version: number;
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
};

const HISTORY_SECONDS: Record<Timeframe, number> = {
  M1: 60,
  M5: 5 * 60,
  M15: 15 * 60,
  M30: 30 * 60,
  H1: 60 * 60,
  H4: 4 * 60 * 60,
  D1: 24 * 60 * 60,
  W1: 7 * 24 * 60 * 60,
  MN1: 30 * 24 * 60 * 60,
};
const HISTORY_RANGE_MAX_SECONDS = 40 * 24 * 60 * 60;

export function getChartConnectionLabel(params: {
  historyState: "loading" | "ready" | "no_data" | "error";
  marketStatus: MarketStatusResponse | null;
  streamConnected: boolean;
}): string {
  if (params.historyState === "loading") return "Loading";
  if (params.marketStatus?.terminal_connected === false) return "MT5 Disconnected";
  if (params.marketStatus?.session_state === "closed") return "Market Closed";
  if (params.historyState === "error") return "Bridge Unavailable";
  if (params.historyState === "no_data") return "Bridge Unavailable";
  return params.streamConnected ? "Market Open" : "Bridge Unavailable";
}

function cacheKey(symbol: string, timeframe: Timeframe) {
  return `${CHART_HISTORY_CACHE_KEY}:${CHART_HISTORY_CONFIG_VERSION}:${symbol.toUpperCase()}:${timeframe}`;
}

function readHistoryCache(symbol: string, timeframe: Timeframe): BridgeCandle[] {
  try {
    const raw = localStorage.getItem(cacheKey(symbol, timeframe));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryCacheEntry;
    if (!parsed || parsed.version !== CHART_HISTORY_CONFIG_VERSION || !Array.isArray(parsed.candles)) return [];
    return parsed.candles
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const time = typeof row.time === "number" ? row.time : null;
        const open = typeof row.open === "number" ? row.open : null;
        const high = typeof row.high === "number" ? row.high : null;
        const low = typeof row.low === "number" ? row.low : null;
        const close = typeof row.close === "number" ? row.close : null;
        const volume = typeof row.volume === "number" ? row.volume : null;
        if ([time, open, high, low, close, volume].some((value) => value == null)) return null;
        return { time, open, high, low, close, volume } satisfies BridgeCandle;
      })
      .filter((item): item is BridgeCandle => item !== null)
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

function saveHistoryCache(symbol: string, timeframe: Timeframe, candles: BridgeCandle[]) {
  try {
    const trimmed = candles.slice(-5000);
    const payload: HistoryCacheEntry = {
      version: CHART_HISTORY_CONFIG_VERSION,
      candles: trimmed,
    };
    localStorage.setItem(cacheKey(symbol, timeframe), JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

function mergeCandles(left: BridgeCandle[], right: BridgeCandle[]): BridgeCandle[] {
  const map = new Map<number, BridgeCandle>();
  [...left, ...right].forEach((candle) => map.set(candle.time, candle));
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function stepSeconds(timeframe: Timeframe): number {
  return HISTORY_SECONDS[timeframe] ?? 60 * 60;
}

function formatChartAxisTime(time: number, timeframe: Timeframe): string {
  const date = new Date(time * 1000);
  if (timeframe === "M1" || timeframe === "M5" || timeframe === "M15" || timeframe === "M30" || timeframe === "H1" || timeframe === "H4") {
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }
  if (timeframe === "D1") {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatChartHoverTime(time: number): string {
  return formatUtcDateTime(time);
}

function getChartPriceFormat(symbol: string, assetClass: string | null) {
  const normalized = symbol.toUpperCase();
  if (assetClass === "metals" || normalized.startsWith("XAU") || normalized.startsWith("XAG")) {
    return { type: "price" as const, precision: 2, minMove: 0.01 };
  }
  if (normalized.includes("JPY")) {
    return { type: "price" as const, precision: 3, minMove: 0.001 };
  }
  if (assetClass === "crypto") {
    return { type: "price" as const, precision: 2, minMove: 0.01 };
  }
  return { type: "price" as const, precision: 5, minMove: 0.00001 };
}

export function getChartSessionDetail(marketStatus: MarketStatusResponse | null): string {
  if (!marketStatus || marketStatus.session_state === "unavailable") {
    return "Session unavailable";
  }
  if (marketStatus.session_state === "open") {
    return `Est. closes in ${formatCountdown(marketStatus.next_close_time)}`;
  }
  return `Est. opens in ${formatCountdown(marketStatus.next_open_time)}`;
}

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // ignore local storage failures
  }
}

function pickInitialSymbol(symbols: BridgeSymbol[]): string {
  for (const preferred of PREFERRED_SYMBOLS) {
    const found = symbols.find((symbol) => symbol.name.toUpperCase() === preferred);
    if (found) return found.name;
  }
  return symbols[0]?.name ?? DEFAULT_SYMBOL;
}

interface GroupedSymbols {
  label: string;
  items: BridgeSymbol[];
}

interface ChartsTabProps {
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
}

export function ChartsTab({ marketStatus, selectedSymbol, onSelectedSymbolChange }: ChartsTabProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("H1");
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "no_data" | "error">("loading");
  const [symbols, setSymbols] = useState<BridgeSymbol[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [lastCandleTime, setLastCandleTime] = useState<number | null>(null);
  const [loadingText, setLoadingText] = useState("Loading chart data...");
  const [streamConnected, setStreamConnected] = useState(false);
  const [visibleCandles, setVisibleCandles] = useState<BridgeCandle[]>([]);
  const [boundaryTime, setBoundaryTime] = useState<number | null>(null);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const historyPanelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const visibleRangeRef = useRef<{ from?: number; to?: number } | null>(null);
  const loadingOlderRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const boundaryCacheRef = useRef(new Map<string, number | null>());

  const addLog = useCallback((line: string) => {
    setDebugLines((current) => {
      const next = [...current, `[${new Date().toISOString()}] ${line}`];
      return next.slice(-DEBUG_MAX);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSymbols().then((items) => {
      if (cancelled) return;
      setSymbols(items);
      if (items.length > 0) {
        onSelectedSymbolChange(
          selectedSymbol === DEFAULT_SYMBOL ? pickInitialSymbol(items) : selectedSymbol,
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

    const chart = createChart(container, {
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#64748b",
        fontFamily: "Inter, system-ui, sans-serif",
      },
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
        tickMarkFormatter: (time) => formatChartAxisTime(Number(time), "H1"),
      },
      grid: {
        vertLines: { color: "rgba(100, 116, 139, 0.05)" },
        horzLines: { color: "rgba(100, 116, 139, 0.05)" },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: "#1e293b" },
        horzLine: { labelBackgroundColor: "#1e293b" },
      },
      localization: {
        timeFormatter: (time) => formatChartHoverTime(Number(time)),
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.applyOptions({ width: rect.width, height: rect.height });
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
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => formatChartAxisTime(Number(time), timeframe),
      },
      localization: {
        timeFormatter: (time) => formatChartHoverTime(Number(time)),
      },
    });
  }, [timeframe]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    series.applyOptions({
      priceFormat: getChartPriceFormat(selectedSymbol, activeMarketStatus?.asset_class ?? null),
    });

    let cancelled = false;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setHistoryState("loading");
    setChartLoadError(null);
    setVisibleCandles([]);
    setBoundaryTime(null);
    setLoadingText(`Loading ${selectedSymbol} ${timeframe}...`);
    series.setData([]);

    const load = async () => {
      try {
        const boundaryCacheKey = `${selectedSymbol.toUpperCase()}|${timeframe}`;
        const cached = readHistoryCache(selectedSymbol, timeframe);
        if (cached.length > 0) {
          series.setData(cached as CandlestickData[]);
          chart.timeScale().fitContent();
          setVisibleCandles(cached);
          setLastCandleTime(cached[cached.length - 1]?.time ?? null);
          setHistoryState("ready");
          setLoadingText(`Refreshing ${selectedSymbol} ${timeframe}...`);
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
          series.setData([]);
          setVisibleCandles([]);
          setBoundaryTime(boundaryTimeValue);
          setHistoryState("no_data");
          setLastCandleTime(null);
          setChartLoadError(`No candle history returned for ${selectedSymbol} ${timeframe}. The broker may not expose this symbol or timeframe, or MT5 has no history downloaded yet.`);
          addLog(`history returned no candles for ${selectedSymbol} ${timeframe}`);
          return;
        }

        series.setData(candles as CandlestickData[]);
        chart.timeScale().fitContent();
        setHistoryState("ready");
        setLastCandleTime(candles[candles.length - 1]?.time ?? null);
        setVisibleCandles(candles);
        setBoundaryTime(boundaryTimeValue);
        saveHistoryCache(selectedSymbol, timeframe, candles);
        addLog(`history loaded ${candles.length} candles for ${selectedSymbol} ${timeframe}`);
      } catch (error) {
        if (cancelled || loadRequestIdRef.current !== requestId) return;
        series.setData([]);
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
  }, [selectedSymbol, timeframe, addLog]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const onRangeChange = async (range: { from?: number; to?: number } | null) => {
      visibleRangeRef.current = range;
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

          const start = Math.max(0, end - HISTORY_RANGE_MAX_SECONDS);
          const older = await fetchHistoryRange({ symbol: selectedSymbol, tf: timeframe, from: start, to: end });
          if (older.length === 0) {
            break;
          }

          const merged = mergeCandles(older, currentCandles);
          if (merged.length > currentCandles.length) {
            currentCandles = merged;
            currentOldest = merged[0]?.time ?? currentOldest;
            setVisibleCandles(merged);
            seriesRef.current?.setData(merged as CandlestickData[]);
            saveHistoryCache(selectedSymbol, timeframe, merged);
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

  const activeMarketStatus =
    marketStatus && marketStatus.symbol.toUpperCase() === selectedSymbol.toUpperCase() ? marketStatus : null;

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
          seriesRef.current?.update(nextCandle);
          setVisibleCandles((current) => {
            const next = mergeCandles(current, [nextCandle]);
            saveHistoryCache(selectedSymbol, timeframe, next);
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
      saveFavorites(next);
      return next;
    });
  }, []);

  const sessionDetail = useMemo(() => getChartSessionDetail(activeMarketStatus), [activeMarketStatus]);

  const streamStatusLabel =
    getChartConnectionLabel({ historyState, marketStatus: activeMarketStatus, streamConnected });

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
    <div className="flex flex-col gap-6 max-w-[1460px] mx-auto pb-12">
      {/* Chart Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm relative z-50">
        <div className="flex items-center gap-6">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold text-gray-900 shadow-sm"
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

          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            {TIMEFRAMES.map((item) => (
              <button
                key={item}
                onClick={() => setTimeframe(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeframe === item ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {item === "MN1" ? "MN" : item}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setHistoryPanelOpen(true)}
            className="charts-history-button"
          >
            History
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-full">
            <Activity className={`h-4 w-4 ${status === 'live' ? 'text-green-500 animate-pulse' : status === 'loading' ? 'text-blue-500 animate-pulse' : status === 'stale' ? 'text-amber-500' : 'text-gray-400'}`} />
            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{streamStatusLabel}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-full">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{sessionDetail}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-full">
            <Database className={`h-4 w-4 ${lastCandleTime ? 'text-blue-400' : 'text-gray-500'}`} />
            <span className="text-xs font-bold text-gray-300 whitespace-nowrap">
              {lastCandleTime ? `Feed: ${formatUtcDateTime(lastCandleTime)}` : 'Waiting for data'}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {historyPanelOpen && (
          <div className="charts-history-overlay" onClick={() => setHistoryPanelOpen(false)}>
            <motion.aside
              ref={historyPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Chart history settings"
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="charts-history-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="charts-history-head">
                <div>
                  <h2>History settings</h2>
                  <p>Native MT5 candles, loaded in chunks and cached locally.</p>
                </div>
                <button type="button" className="charts-history-close" onClick={() => setHistoryPanelOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="charts-history-body">
                <section className="charts-history-section">
                  <h3>How it works</h3>
                  <ul className="charts-history-list">
                    <li>The chart requests candles from the bridge using the selected timeframe.</li>
                    <li>Older candles load automatically as you pan left until MT5 stops returning more data.</li>
                  </ul>
                </section>

                <section className="charts-history-section">
                  <h3>Notes</h3>
                  <ul className="charts-history-list">
                    <li>Historical depth still depends on what MT5 already has available for that symbol and timeframe.</li>
                    <li>The oldest badge appears only when the bridge confirms the MT5 boundary.</li>
                    <li>Older history is loaded in small safe slices so the bridge stays stable.</li>
                  </ul>
                </section>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Chart Section */}
      <div className="relative group">
        <div className="p-1 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden">
          <div ref={containerRef} className="h-[600px] w-full" />
        </div>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Terminal Console
          </h3>
          <button
            onClick={() => void navigator.clipboard.writeText(debugLines.join("\n") || "(empty)")}
            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
          >
            Copy Logs
          </button>
        </div>
        <div className="h-32 overflow-auto p-4 bg-gray-50/50 font-mono text-[10px] leading-relaxed text-gray-500">
          {debugLines.length === 0 ? (
            <div className="italic">Awaiting first market event...</div>
          ) : (
            debugLines.map((line, index) => <div key={index} className="mb-1">{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
