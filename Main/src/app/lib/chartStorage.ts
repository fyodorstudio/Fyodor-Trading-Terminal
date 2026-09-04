import {
  mergeChartCandles,
  normalizeHistoryCacheEntry,
  summarizeChartCache,
  type ChartCacheSummary,
  type HistoryCacheEntry,
} from "@/app/lib/chartView";
import type { BridgeCandle, Timeframe } from "@/app/types";

const FAVORITES_KEY = "fyodor-main-chart-favorites";
const CHART_HISTORY_CACHE_KEY = "fyodor-main-chart-history-cache-v1";
const CHART_HISTORY_CONFIG_VERSION = 1;
const MAX_CHART_HISTORY_CANDLES = 5000;
const sessionHistoryCache = new Map<string, BridgeCandle[]>();

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getChartHistoryCacheKey(symbol: string, timeframe: Timeframe) {
  return `${CHART_HISTORY_CACHE_KEY}:${CHART_HISTORY_CONFIG_VERSION}:${symbol.toUpperCase()}:${timeframe}`;
}

export function readChartHistoryCache(symbol: string, timeframe: Timeframe): BridgeCandle[] {
  const key = getChartHistoryCacheKey(symbol, timeframe);
  const sessionCached = sessionHistoryCache.get(key);
  if (sessionCached) return sessionCached;
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const candles = normalizeHistoryCacheEntry(JSON.parse(raw) as unknown, MAX_CHART_HISTORY_CANDLES)?.candles ?? [];
    if (candles.length > 0) sessionHistoryCache.set(key, candles);
    return candles;
  } catch {
    return [];
  }
}

export function saveChartHistoryCache(symbol: string, timeframe: Timeframe, candles: BridgeCandle[]) {
  const key = getChartHistoryCacheKey(symbol, timeframe);
  const trimmed = mergeChartCandles([], candles, MAX_CHART_HISTORY_CANDLES);
  sessionHistoryCache.set(key, trimmed);
  const storage = getStorage();
  if (!storage) return;

  try {
    const payload: HistoryCacheEntry = {
      version: CHART_HISTORY_CONFIG_VERSION,
      candles: trimmed,
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

export function clearChartHistoryCache(symbol: string, timeframe: Timeframe) {
  const key = getChartHistoryCacheKey(symbol, timeframe);
  sessionHistoryCache.delete(key);
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

export function summarizeStoredChartHistory(symbol: string, timeframe: Timeframe): ChartCacheSummary {
  return summarizeChartCache(readChartHistoryCache(symbol, timeframe));
}

export function loadChartFavorites(): string[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveChartFavorites(items: string[]) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // ignore local storage failures
  }
}
