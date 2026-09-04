import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { CandlestickData, IChartApi } from "lightweight-charts";
import { fetchHistory, fetchHistoryBoundary, fetchHistoryRange, fetchSymbols, openChartStream } from "@/app/lib/bridge";
import {
  CHART_HISTORY_RANGE_MAX_SECONDS,
  DEFAULT_CHART_SYMBOL,
  pickInitialChartSymbol,
} from "@/app/lib/chartDisplay";
import { mergeChartCandles } from "@/app/lib/chartView";
import {
  clearChartHistoryCache,
  readChartHistoryCache,
  saveChartHistoryCache,
  summarizeStoredChartHistory,
} from "@/app/lib/chartStorage";
import { resolveChartStatus } from "@/app/lib/status";
import type { BridgeCandle, BridgeStatus, BridgeSymbol, MarketStatusResponse, Timeframe } from "@/app/types";

interface UseChartMarketDataArgs {
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  timeframe: Timeframe;
  activeMarketStatus: MarketStatusResponse | null;
  chartRef: RefObject<IChartApi | null>;
  addLog: (line: string) => void;
}

interface UseChartMarketDataResult {
  symbols: BridgeSymbol[];
  historyState: "loading" | "ready" | "no_data" | "error";
  visibleCandles: BridgeCandle[];
  lastCandleTime: number | null;
  streamConnected: boolean;
  boundaryTime: number | null;
  chartLoadError: string | null;
  cacheSummary: ReturnType<typeof summarizeStoredChartHistory>;
  status: BridgeStatus;
  reachedBoundary: boolean;
  clearCurrentCache: () => void;
}

const INITIAL_CHART_CANDLES = 1500;
const QUICK_INITIAL_CHART_CANDLES = 350;
const MIN_REFRESH_CANDLES = 12;
const CHART_CACHE_WRITE_DELAY_MS = 1500;
const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1: 60, M5: 300, M15: 900, M30: 1800,
  H1: 3600, H4: 14_400, D1: 86_400, W1: 604_800, MN1: 2_592_000,
};

export function getChartRefreshBars(cachedLatest: number | null, timeframe: Timeframe, nowSeconds: number) {
  if (cachedLatest == null) return INITIAL_CHART_CANDLES;
  const missingBars = Math.ceil(Math.max(0, nowSeconds - cachedLatest) / TIMEFRAME_SECONDS[timeframe]) + 4;
  return Math.min(INITIAL_CHART_CANDLES, Math.max(MIN_REFRESH_CANDLES, missingBars));
}

export function useChartMarketData({
  selectedSymbol,
  onSelectedSymbolChange,
  timeframe,
  activeMarketStatus,
  chartRef,
  addLog,
}: UseChartMarketDataArgs): UseChartMarketDataResult {
  const [symbols, setSymbols] = useState<BridgeSymbol[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "no_data" | "error">("loading");
  const [visibleCandles, setVisibleCandles] = useState<BridgeCandle[]>([]);
  const [lastCandleTime, setLastCandleTime] = useState<number | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [boundaryTime, setBoundaryTime] = useState<number | null>(null);
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);
  const [cacheRevision, setCacheRevision] = useState(0);
  const visibleRangeRef = useRef<{ from?: number; to?: number } | null>(null);
  const loadingOlderRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const boundaryCacheRef = useRef(new Map<string, number | null>());
  const initialSymbolRef = useRef(selectedSymbol);
  const pendingCacheWriteRef = useRef<{ symbol: string; timeframe: Timeframe; candles: BridgeCandle[] } | null>(null);
  const cacheWriteTimerRef = useRef<number | null>(null);

  const flushPendingCacheWrite = useCallback(() => {
    if (cacheWriteTimerRef.current != null) window.clearTimeout(cacheWriteTimerRef.current);
    cacheWriteTimerRef.current = null;
    const pending = pendingCacheWriteRef.current;
    pendingCacheWriteRef.current = null;
    if (pending) saveChartHistoryCache(pending.symbol, pending.timeframe, pending.candles);
  }, []);

  const scheduleCacheWrite = useCallback((symbol: string, tf: Timeframe, candles: BridgeCandle[]) => {
    pendingCacheWriteRef.current = { symbol, timeframe: tf, candles };
    if (cacheWriteTimerRef.current != null) return;
    cacheWriteTimerRef.current = window.setTimeout(flushPendingCacheWrite, CHART_CACHE_WRITE_DELAY_MS);
  }, [flushPendingCacheWrite]);

  useEffect(() => flushPendingCacheWrite, [flushPendingCacheWrite]);

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
          initialSymbolRef.current === DEFAULT_CHART_SYMBOL ? pickInitialChartSymbol(items) : initialSymbolRef.current,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [onSelectedSymbolChange]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const cached = readChartHistoryCache(selectedSymbol, timeframe);
    setHistoryState(cached.length > 0 ? "ready" : "loading");
    setChartLoadError(null);
    setVisibleCandles(cached);
    setLastCandleTime(cached[cached.length - 1]?.time ?? null);
    setBoundaryTime(null);
    if (cached.length > 0) {
      addLog(`loaded ${cached.length} cached candles for ${selectedSymbol} ${timeframe} while refreshing`);
    }

    const load = async () => {
      try {
        const boundaryCacheKey = `${selectedSymbol.toUpperCase()}|${timeframe}`;
        const cachedBoundary = boundaryCacheRef.current.get(boundaryCacheKey);
        if (cachedBoundary !== undefined) setBoundaryTime(cachedBoundary);

        const cachedLatest = cached[cached.length - 1]?.time;
        const refreshBars = cached.length > 0
          ? getChartRefreshBars(cachedLatest ?? null, timeframe, Date.now() / 1000)
          : QUICK_INITIAL_CHART_CANDLES;
        const refreshed = await fetchHistory(selectedSymbol, timeframe, refreshBars, controller.signal);
        if (cancelled || loadRequestIdRef.current !== requestId) return;
        let candles = cached.length > 0 ? mergeChartCandles(cached, refreshed) : refreshed;
        if (candles.length === 0) {
          if (cached.length > 0) {
            addLog(`history refresh returned no candles for ${selectedSymbol} ${timeframe}; keeping cached history visible`);
            return;
          }
          setVisibleCandles([]);
          setHistoryState("no_data");
          setLastCandleTime(null);
          setChartLoadError(`No candle history returned for ${selectedSymbol} ${timeframe}. The broker may not expose this symbol or timeframe, or MT5 has no history downloaded yet.`);
          addLog(`history returned no candles for ${selectedSymbol} ${timeframe}`);
          return;
        }

        setHistoryState("ready");
        setLastCandleTime(candles[candles.length - 1]?.time ?? null);
        setVisibleCandles(candles);
        addLog(`history loaded ${candles.length} candles for ${selectedSymbol} ${timeframe}`);
        saveChartHistoryCache(selectedSymbol, timeframe, candles);

        if (cached.length === 0 && candles.length < INITIAL_CHART_CANDLES) {
          try {
            const expanded = await fetchHistory(selectedSymbol, timeframe, INITIAL_CHART_CANDLES, controller.signal);
            if (cancelled || loadRequestIdRef.current !== requestId) return;
            if (expanded.length > 0) {
              candles = mergeChartCandles(expanded, candles);
              addLog(`history cache expanded to ${candles.length} candles for ${selectedSymbol} ${timeframe}`);
            }
          } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) {
              addLog(`expanded history deferred for ${selectedSymbol} ${timeframe}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        saveChartHistoryCache(selectedSymbol, timeframe, candles);

        if (cachedBoundary === undefined) {
          try {
            const boundary = await fetchHistoryBoundary({ symbol: selectedSymbol, tf: timeframe });
            if (cancelled || loadRequestIdRef.current !== requestId) return;
            boundaryCacheRef.current.set(boundaryCacheKey, boundary.oldest_time);
            setBoundaryTime(boundary.oldest_time);
          } catch {
            boundaryCacheRef.current.delete(boundaryCacheKey);
          }
        }
      } catch (error) {
        if (cancelled || loadRequestIdRef.current !== requestId) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : String(error);
        if (cached.length > 0) {
          setHistoryState("ready");
          setVisibleCandles(cached);
          setLastCandleTime(cached[cached.length - 1]?.time ?? null);
          setChartLoadError(`Live history refresh failed; showing ${cached.length} cached ${selectedSymbol} ${timeframe} candles.`);
          addLog(`history refresh failed for ${selectedSymbol} ${timeframe}; retained cached candles: ${message}`);
          return;
        }
        setVisibleCandles([]);
        setBoundaryTime(null);
        setHistoryState("error");
        setLastCandleTime(null);
        setChartLoadError(
          message.includes("symbol_select failed")
            ? `MT5 could not select ${selectedSymbol}. This usually means the broker does not offer this symbol under that exact name.`
            : message.includes("No data from MT5")
              ? `MT5 selected ${selectedSymbol}, but no candle history came back for ${timeframe}. The broker may not provide history for this symbol/timeframe yet.`
              : message.includes("MT5 terminal not connected")
                ? "MT5 is disconnected, so the bridge cannot fetch chart data."
                : `The bridge could not load ${selectedSymbol} ${timeframe}: ${message}`,
        );
        addLog(`history failed for ${selectedSymbol} ${timeframe}: ${message}`);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      loadingOlderRef.current = false;
      flushPendingCacheWrite();
    };
  }, [selectedSymbol, timeframe, addLog, flushPendingCacheWrite]);

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

          const start = Math.max(0, end - CHART_HISTORY_RANGE_MAX_SECONDS);
          const older = await fetchHistoryRange({ symbol: selectedSymbol, tf: timeframe, from: start, to: end });
          if (older.length === 0) break;

          const merged = mergeChartCandles(older, currentCandles);
          if (merged.length > currentCandles.length) {
            currentCandles = merged;
            currentOldest = merged[0]?.time ?? currentOldest;
            setVisibleCandles(merged);
            scheduleCacheWrite(selectedSymbol, timeframe, merged);
          } else {
            break;
          }

          if (older.length < 2 || start === 0) break;
          if (visibleRangeRef.current?.from != null && visibleRangeRef.current.from >= 20) break;
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
  }, [chartRef, selectedSymbol, timeframe, historyState, visibleCandles, addLog, scheduleCacheWrite]);

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
            scheduleCacheWrite(selectedSymbol, timeframe, next);
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
    scheduleCacheWrite,
  ]);

  const cacheSummary = useMemo(
    () => summarizeStoredChartHistory(selectedSymbol, timeframe),
    [cacheRevision, selectedSymbol, timeframe, visibleCandles.length],
  );

  const status: BridgeStatus = useMemo(
    () =>
      resolveChartStatus({
        historyState,
        marketStatus: activeMarketStatus,
        streamConnected,
      }),
    [historyState, activeMarketStatus, streamConnected],
  );

  const reachedBoundary = boundaryTime != null && visibleCandles.length > 0 && visibleCandles[0].time <= boundaryTime;

  return {
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
  };
}
