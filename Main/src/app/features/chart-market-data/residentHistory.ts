import { CHART_TIMEFRAMES } from "@/app/lib/chartDisplay";
import { fetchHistory } from "@/app/lib/bridge";
import {
  loadChartFavorites,
  readChartHistoryCache,
  saveChartHistoryCache,
} from "@/app/lib/chartStorage";
import { mergeChartCandles } from "@/app/lib/chartView";
import type { BridgeCandle, BridgeSymbol, Timeframe } from "@/app/types";
import { RESIDENT_QUICK_CANDLES } from "@/app/features/chart-market-data/historyPolicy";

export type ResidentLoadPriority = "selected" | "warm" | "deep";

interface ResidentHistoryRequest {
  key: string;
  symbol: string;
  timeframe: Timeframe;
  bars: number;
  catalogIdentity?: string;
  preferCache: boolean;
  priority: ResidentLoadPriority;
  enqueuedAt: number;
  resolve: (candles: BridgeCandle[]) => void;
  reject: (error: unknown) => void;
}

const selectedHistoryQueue: ResidentHistoryRequest[] = [];
const warmHistoryQueue: ResidentHistoryRequest[] = [];
const deepHistoryQueue: ResidentHistoryRequest[] = [];
const residentHistoryPending = new Map<string, {
  request: ResidentHistoryRequest;
  promise: Promise<BridgeCandle[]>;
}>();
let residentHistoryWorkerRunning = false;
let residentHistoryBackgroundPaused = false;
let residentWarmPlanGeneration = 0;
let residentWarmPlanKey = "";
let activeResidentHistoryRequest: ResidentHistoryRequest | null = null;
let lastResidentHistoryFailure: { key: string; message: string; failedAt: number } | null = null;
let lastResidentHistoryDurationMs: number | null = null;
const residentHistoryFailureCooldowns = new Map<string, { failures: number; retryAfter: number }>();
const recentResidentSymbols: string[] = [];
const MAX_RECENT_RESIDENT_SYMBOLS = 12;

export interface ResidentHistoryDiagnostics {
  pendingCount: number;
  selectedQueueDepth: number;
  warmQueueDepth: number;
  deepQueueDepth: number;
  backgroundPaused: boolean;
  oldestQueuedAgeSeconds: number | null;
  activeRequest: { symbol: string; timeframe: Timeframe; priority: ResidentLoadPriority } | null;
  lastFailure: { key: string; message: string; failedAt: number } | null;
  lastDurationMs: number | null;
  cooldownCount: number;
}

export function getResidentHistoryDiagnostics(now = Date.now()): ResidentHistoryDiagnostics {
  const queued = [...selectedHistoryQueue, ...warmHistoryQueue, ...deepHistoryQueue];
  const oldestQueuedAt = queued.reduce<number | null>(
    (oldest, request) => oldest == null ? request.enqueuedAt : Math.min(oldest, request.enqueuedAt),
    null,
  );
  return {
    pendingCount: residentHistoryPending.size,
    selectedQueueDepth: selectedHistoryQueue.length,
    warmQueueDepth: warmHistoryQueue.length,
    deepQueueDepth: deepHistoryQueue.length,
    backgroundPaused: residentHistoryBackgroundPaused,
    oldestQueuedAgeSeconds: oldestQueuedAt == null ? null : Math.max(0, (now - oldestQueuedAt) / 1000),
    activeRequest: activeResidentHistoryRequest ? {
      symbol: activeResidentHistoryRequest.symbol,
      timeframe: activeResidentHistoryRequest.timeframe,
      priority: activeResidentHistoryRequest.priority,
    } : null,
    lastFailure: lastResidentHistoryFailure ? { ...lastResidentHistoryFailure } : null,
    lastDurationMs: lastResidentHistoryDurationMs,
    cooldownCount: Array.from(residentHistoryFailureCooldowns.values())
      .filter((cooldown) => cooldown.retryAfter > now).length,
  };
}

export function recordResidentChartSelection(symbol: string) {
  const normalized = symbol.toUpperCase();
  const priorIndex = recentResidentSymbols.indexOf(normalized);
  if (priorIndex >= 0) recentResidentSymbols.splice(priorIndex, 1);
  recentResidentSymbols.unshift(normalized);
  if (recentResidentSymbols.length > MAX_RECENT_RESIDENT_SYMBOLS) {
    recentResidentSymbols.splice(MAX_RECENT_RESIDENT_SYMBOLS);
  }
}

function residentHistoryRequestKey(
  symbol: string,
  timeframe: Timeframe,
  bars: number,
  catalogIdentity?: string,
): string {
  return `${catalogIdentity ?? "legacy"}:${symbol.toUpperCase()}:${timeframe}:${bars}`;
}

function hasRunnableResidentHistoryRequest(): boolean {
  return selectedHistoryQueue.length > 0
    || (!residentHistoryBackgroundPaused && (warmHistoryQueue.length > 0 || deepHistoryQueue.length > 0));
}

function takeNextResidentHistoryRequest(): ResidentHistoryRequest | undefined {
  return selectedHistoryQueue.shift()
    ?? (residentHistoryBackgroundPaused ? undefined : warmHistoryQueue.shift() ?? deepHistoryQueue.shift());
}

async function drainResidentHistoryQueue() {
  if (residentHistoryWorkerRunning) return;
  residentHistoryWorkerRunning = true;
  try {
    while (hasRunnableResidentHistoryRequest()) {
      const request = takeNextResidentHistoryRequest();
      if (!request) break;
      activeResidentHistoryRequest = request;
      const startedAt = Date.now();
      try {
        const refreshed = await fetchHistory(
          request.symbol,
          request.timeframe,
          request.bars,
          AbortSignal.timeout(request.priority === "selected" ? 30_000 : 4_000),
          request.preferCache,
          request.priority !== "selected",
          request.catalogIdentity,
        );
        const resident = mergeChartCandles(
          readChartHistoryCache(request.symbol, request.timeframe, request.catalogIdentity),
          refreshed,
        );
        if (resident.length > 0) {
          saveChartHistoryCache(request.symbol, request.timeframe, resident, request.catalogIdentity);
        }
        residentHistoryFailureCooldowns.delete(request.key);
        request.resolve(resident);
      } catch (error) {
        lastResidentHistoryFailure = {
          key: request.key,
          message: error instanceof Error ? error.message : String(error),
          failedAt: Date.now(),
        };
        if (request.priority !== "selected") {
          const priorFailures = residentHistoryFailureCooldowns.get(request.key)?.failures ?? 0;
          const failures = priorFailures + 1;
          residentHistoryFailureCooldowns.set(request.key, {
            failures,
            retryAfter: Date.now() + Math.min(300_000, 5_000 * (2 ** Math.min(6, failures - 1))),
          });
        }
        request.reject(error);
      } finally {
        lastResidentHistoryDurationMs = Date.now() - startedAt;
        activeResidentHistoryRequest = null;
        residentHistoryPending.delete(request.key);
      }
    }
  } finally {
    residentHistoryWorkerRunning = false;
    if (hasRunnableResidentHistoryRequest()) void drainResidentHistoryQueue();
  }
}

export function setResidentHistoryBackgroundPaused(paused: boolean) {
  residentHistoryBackgroundPaused = paused;
  if (!paused) void drainResidentHistoryQueue();
}

export function loadResidentChartHistory(
  symbol: string,
  timeframe: Timeframe,
  bars: number,
  priority: ResidentLoadPriority,
  preferCache = true,
  catalogIdentity?: string,
): Promise<BridgeCandle[]> {
  const key = `${residentHistoryRequestKey(symbol, timeframe, bars, catalogIdentity)}:${preferCache ? "cache" : "terminal"}`;
  const existing = residentHistoryPending.get(key);
  if (existing) {
    if (priority === "selected" && existing.request.priority !== "selected") {
      const queuedIndex = existing.request.priority === "warm"
        ? warmHistoryQueue.indexOf(existing.request)
        : deepHistoryQueue.indexOf(existing.request);
      const queue = existing.request.priority === "warm" ? warmHistoryQueue : deepHistoryQueue;
      existing.request.priority = "selected";
      if (queuedIndex >= 0) {
        queue.splice(queuedIndex, 1);
        selectedHistoryQueue.unshift(existing.request);
      }
    }
    return existing.promise;
  }

  let resolveRequest!: (candles: BridgeCandle[]) => void;
  let rejectRequest!: (error: unknown) => void;
  const promise = new Promise<BridgeCandle[]>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  const request: ResidentHistoryRequest = {
    key,
    symbol,
    timeframe,
    bars,
    catalogIdentity,
    preferCache,
    priority,
    enqueuedAt: Date.now(),
    resolve: resolveRequest,
    reject: rejectRequest,
  };
  residentHistoryPending.set(key, { request, promise });
  if (priority === "selected") selectedHistoryQueue.unshift(request);
  else if (priority === "warm") warmHistoryQueue.push(request);
  else deepHistoryQueue.push(request);
  void drainResidentHistoryQueue();
  return promise;
}

export function buildResidentChartWarmPlan(
  symbols: readonly BridgeSymbol[],
  selectedSymbol: string,
  timeframe: Timeframe,
  favorites: readonly string[] = [],
  recentlyUsed: readonly string[] = [],
): Array<{ symbol: string; timeframe: Timeframe }> {
  const selected = selectedSymbol.toUpperCase();
  const favoriteSet = new Set(favorites.map((symbol) => symbol.toUpperCase()));
  const recentSet = new Set(recentlyUsed.map((symbol) => symbol.toUpperCase()));
  const selectedTimeframes = CHART_TIMEFRAMES.map((candidate) => ({
    symbol: selected,
    timeframe: candidate,
  }));
  const activeTimeframe = (symbol: BridgeSymbol) => ({ symbol: symbol.name, timeframe });
  const requests = [
    ...selectedTimeframes,
    ...symbols.filter((symbol) => favoriteSet.has(symbol.name.toUpperCase())).map(activeTimeframe),
    ...symbols.filter((symbol) => symbol.visible || symbol.selected).map(activeTimeframe),
    ...symbols.filter((symbol) => recentSet.has(symbol.name.toUpperCase())).map(activeTimeframe),
    ...symbols.map(activeTimeframe),
  ];
  const seen = new Set<string>();
  return requests.filter((request) => {
    const key = `${request.symbol.toUpperCase()}:${request.timeframe}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function warmResidentCharts(
  symbols: readonly BridgeSymbol[],
  selectedSymbol: string,
  timeframe: Timeframe,
  catalogIdentity?: string,
) {
  const favorites = loadChartFavorites();
  recordResidentChartSelection(selectedSymbol);
  const plan = buildResidentChartWarmPlan(symbols, selectedSymbol, timeframe, favorites, recentResidentSymbols);
  const planKey = [
    selectedSymbol.toUpperCase(),
    timeframe,
    favorites.join("|"),
    symbols.map((symbol) => `${symbol.name}:${symbol.visible ? 1 : 0}:${symbol.selected ? 1 : 0}`).join("|"),
    catalogIdentity ?? "legacy",
  ].join("::");
  if (planKey === residentWarmPlanKey) return;
  residentWarmPlanKey = planKey;
  const generation = ++residentWarmPlanGeneration;

  void (async () => {
    for (const request of plan) {
      if (generation !== residentWarmPlanGeneration) return;
      if (readChartHistoryCache(request.symbol, request.timeframe, catalogIdentity).length > 0) continue;
      const requestKey = `${residentHistoryRequestKey(request.symbol, request.timeframe, RESIDENT_QUICK_CANDLES, catalogIdentity)}:cache`;
      const cooldown = residentHistoryFailureCooldowns.get(requestKey);
      if (cooldown && cooldown.retryAfter > Date.now()) continue;
      try {
        // Awaiting each request keeps the pending queue bounded. Foreground
        // selection can still promote the one matching in-flight request.
        await loadResidentChartHistory(
          request.symbol,
          request.timeframe,
          RESIDENT_QUICK_CANDLES,
          "warm",
          true,
          catalogIdentity,
        );
      } catch {
        // Some broker symbols do not expose every timeframe. They remain
        // available for an explicit foreground attempt when selected.
      }
    }
  })();
}
