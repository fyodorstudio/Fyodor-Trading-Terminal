import type {
  BridgeCandle,
  BridgeHealth,
  BridgeSymbol,
  BridgeSymbolSnapshot,
  CalendarEvent,
  ImpactLevel,
  MacroSignalBacktestRun,
  MacroSignalCoverage,
  MacroSignalExpansionReport,
  MacroSignalChartMode,
  MacroSignalChartSignal,
  MacroSignalChartSignalResponse,
  MacroSignalGlobalResponse,
  MacroSignalForwardPaper,
  MacroSignalVersion,
  FmsExperiment,
  FmsFrozenCandidate,
  FmsResearchMarket,
  FmsWorkbench,
  MarketStatusResponse,
} from "@/app/types";
import { recordAppActivity } from "@/app/features/chart-shell/appActivityLog";

const DEFAULT_BRIDGE_BASE = "http://127.0.0.1:8001";

export const BRIDGE_BASE =
  (import.meta.env.VITE_MT5_BRIDGE_BASE as string | undefined)?.trim() || DEFAULT_BRIDGE_BASE;

export const BRIDGE_WS_BASE = BRIDGE_BASE.replace(/^http/i, "ws");

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeImpact(value: unknown): ImpactLevel {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeMarketSessionState(value: unknown): MarketStatusResponse["session_state"] {
  return value === "open" || value === "closed" || value === "unavailable" ? value : "unavailable";
}

export function normalizeCalendarEvent(raw: unknown): CalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = asNumber(obj.id);
  const time = asNumber(obj.time);
  if (id == null || time == null) return null;

  return {
    id,
    time,
    countryCode: asString(obj.countryCode).toUpperCase(),
    currency: asString(obj.currency).toUpperCase(),
    title: asString(obj.title),
    impact: normalizeImpact(obj.impact),
    actual: asString(obj.actual),
    forecast: asString(obj.forecast),
    previous: asString(obj.previous),
  };
}

function describeBridgeRequest(url: string, init?: RequestInit): { message: string; detail: string | null } {
  const method = (init?.method ?? "GET").toUpperCase();
  try {
    const parsed = new URL(url);
    const context = ["symbol", "tf", "market", "mode", "bars", "background"]
      .map((key) => parsed.searchParams.has(key) ? `${key}=${parsed.searchParams.get(key)}` : null)
      .filter((value): value is string => Boolean(value));
    return { message: `${method} ${parsed.pathname}`, detail: context.length ? context.join(" · ") : null };
  } catch {
    return { message: `${method} bridge request`, detail: null };
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const request = describeBridgeRequest(url, init);
  const startedAt = Date.now();
  recordAppActivity({ source: "Bridge", message: `Started ${request.message}`, detail: request.detail });
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      let detail = "";
      try {
        const text = await response.text();
        if (text) {
          const parsed = JSON.parse(text) as unknown;
          if (parsed && typeof parsed === "object") {
            const row = parsed as Record<string, unknown>;
            if (typeof row.detail === "string") detail = row.detail;
            else if (row.detail && typeof row.detail === "object") detail = JSON.stringify(row.detail);
          }
        }
      } catch {
        // ignore response parsing failures
      }
      const suffix = detail ? `: ${detail}` : "";
      throw new Error(`Bridge returned ${response.status}${suffix}`);
    }
    const payload = (await response.json()) as T;
    recordAppActivity({
      level: "success",
      source: "Bridge",
      message: `Completed ${request.message}`,
      detail: `${request.detail ? `${request.detail} · ` : ""}${Date.now() - startedAt} ms`,
    });
    return payload;
  } catch (reason: unknown) {
    const aborted = reason instanceof Error && reason.name === "AbortError";
    recordAppActivity({
      level: aborted ? "warning" : "error",
      source: "Bridge",
      message: `${aborted ? "Cancelled" : "Failed"} ${request.message}`,
      detail: `${request.detail ? `${request.detail} · ` : ""}${reason instanceof Error ? reason.message : "Unknown request error"}`,
    });
    throw reason;
  }
}

export async function fetchHistory(
  symbol: string,
  tf: string,
  bars = 200,
  signal?: AbortSignal,
  preferCache = false,
  background = false,
  catalogIdentity?: string,
): Promise<BridgeCandle[]> {
  const url =
    `${BRIDGE_BASE}/history?symbol=${encodeURIComponent(symbol)}` +
    `&tf=${encodeURIComponent(tf)}&bars=${encodeURIComponent(String(bars))}` +
    (preferCache ? "&prefer_cache=true" : "") +
    (background ? "&background=true" : "") +
    (catalogIdentity ? `&catalog_identity=${encodeURIComponent(catalogIdentity)}` : "");
  const payload = await fetchJson<unknown[]>(url, { signal });
  return payload
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const time = asNumber(row.time);
      const open = asNumber(row.open);
      const high = asNumber(row.high);
      const low = asNumber(row.low);
      const close = asNumber(row.close);
      const volume = asNumber(row.volume);
      if ([time, open, high, low, close, volume].some((value) => value == null)) return null;
      return {
        time: time as number,
        open: open as number,
        high: high as number,
        low: low as number,
        close: close as number,
        volume: volume as number,
      } satisfies BridgeCandle;
    })
    .filter((item): item is BridgeCandle => item !== null)
    .sort((a, b) => a.time - b.time);
}

export async function fetchHistoryRange(params: {
  symbol: string;
  tf: string;
  from: number;
  to: number;
  catalogIdentity?: string;
}): Promise<BridgeCandle[]> {
  const search = new URLSearchParams({
    symbol: params.symbol,
    tf: params.tf,
    from_: String(params.from),
    to: String(params.to),
  });
  if (params.catalogIdentity) search.set("catalog_identity", params.catalogIdentity);
  const payload = await fetchJson<unknown[]>(`${BRIDGE_BASE}/history_range?${search.toString()}`);
  return payload
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const time = asNumber(row.time);
      const open = asNumber(row.open);
      const high = asNumber(row.high);
      const low = asNumber(row.low);
      const close = asNumber(row.close);
      const volume = asNumber(row.volume);
      if ([time, open, high, low, close, volume].some((value) => value == null)) return null;
      return {
        time: time as number,
        open: open as number,
        high: high as number,
        low: low as number,
        close: close as number,
        volume: volume as number,
      } satisfies BridgeCandle;
    })
    .filter((item): item is BridgeCandle => item !== null)
    .sort((a, b) => a.time - b.time);
}

export async function fetchHistoryBoundary(params: {
  symbol: string;
  tf: string;
  catalogIdentity?: string;
}): Promise<{ oldest_time: number; approximate: boolean }> {
  const search = new URLSearchParams({
    symbol: params.symbol,
    tf: params.tf,
  });
  if (params.catalogIdentity) search.set("catalog_identity", params.catalogIdentity);
  const payload = await fetchJson<unknown>(`${BRIDGE_BASE}/history_boundary?${search.toString()}`);
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid history boundary payload");
  }
  const row = payload as Record<string, unknown>;
  const oldestTime = asNumber(row.oldest_time);
  if (oldestTime == null) {
    throw new Error("History boundary missing oldest_time");
  }
  return {
    oldest_time: oldestTime,
    approximate: row.approximate !== false,
  };
}

function normalizeBridgeSymbols(payload: unknown): BridgeSymbol[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item): BridgeSymbol | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = asString(row.name);
      if (!name) return null;
      const path = asString(row.path) || null;
      return {
        name,
        path,
        bid: asNumber(row.bid),
        ask: asNumber(row.ask),
        priceChange: asNumber(row.price_change),
        digits: asNumber(row.digits),
        quoteTime: asNumber(row.quote_time),
        visible: Boolean(row.visible),
        selected: Boolean(row.selected),
        synchronized: typeof row.synchronized === "boolean" ? row.synchronized : null,
      };
    })
    .filter((item): item is BridgeSymbol => item !== null);
}

export async function fetchSymbolSnapshot(background = false): Promise<BridgeSymbolSnapshot | null> {
  try {
    const payload = await fetchJson<unknown>(`${BRIDGE_BASE}/symbol_snapshot${background ? "?background=true" : ""}`);
    if (!payload || typeof payload !== "object") return null;
    const row = payload as Record<string, unknown>;
    const brokerIdentity = asString(row.broker_identity).trim();
    const catalogRevision = asString(row.catalog_revision).trim();
    const catalogIdentity = asString(row.catalog_identity).trim();
    if (!brokerIdentity || !catalogRevision || !catalogIdentity) return null;
    return {
      brokerIdentity,
      catalogRevision,
      catalogIdentity,
      source: asString(row.source).trim() || "unknown",
      ageSeconds: asNumber(row.age_seconds),
      symbols: normalizeBridgeSymbols(row.symbols),
    };
  } catch {
    return null;
  }
}

export async function fetchSymbols(background = false): Promise<BridgeSymbol[]> {
  try {
    const payload = await fetchJson<unknown>(`${BRIDGE_BASE}/symbols${background ? "?background=true" : ""}`);
    return normalizeBridgeSymbols(payload);
  } catch {
    return [];
  }
}

export async function fetchHealth(): Promise<BridgeHealth> {
  try {
    const payload = await fetchJson<unknown>(`${BRIDGE_BASE}/health`);
    if (!payload || typeof payload !== "object") {
      return { ok: false, bridge_connected: false, terminal_connected: false };
    }
    const row = payload as Record<string, unknown>;
    return {
      ok: Boolean(row.ok),
      bridge_connected: true,
      terminal_connected: Boolean(row.terminal_connected),
      last_calendar_ingest_at: asNumber(row.last_calendar_ingest_at),
      calendar_events_count: asNumber(row.calendar_events_count) ?? undefined,
      last_error:
        row.last_error && typeof row.last_error === "object"
          ? {
              code: asNumber((row.last_error as Record<string, unknown>).code) ?? undefined,
              message: asString((row.last_error as Record<string, unknown>).message) || undefined,
            }
          : null,
    };
  } catch {
    return { ok: false, bridge_connected: false, terminal_connected: false };
  }
}

export async function fetchServerTime(symbol?: string): Promise<number | null> {
  try {
    const suffix = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    const payload = await fetchJson<unknown>(`${BRIDGE_BASE}/server_time${suffix}`);
    if (!payload || typeof payload !== "object") return null;
    return asNumber((payload as Record<string, unknown>).time);
  } catch {
    return null;
  }
}

export async function fetchCalendar(params: {
  from?: number | null;
  to?: number | null;
  impacts?: ImpactLevel[];
  countries?: string[];
}): Promise<CalendarEvent[]> {
  const search = new URLSearchParams();
  if (params.from != null) search.set("from_", String(params.from));
  if (params.to != null) search.set("to", String(params.to));
  if (params.impacts && params.impacts.length > 0 && params.impacts.length < 3) {
    search.set("impact", params.impacts.join(","));
  }
  if (params.countries && params.countries.length > 0) {
    search.set("country", params.countries.join(","));
  }

  const query = search.toString();
  const url = `${BRIDGE_BASE}/calendar${query ? `?${query}` : ""}`;
  const payload = await fetchJson<unknown[]>(url);
  return payload
    .map(normalizeCalendarEvent)
    .filter((item): item is CalendarEvent => item !== null)
    .sort((a, b) => a.time - b.time);
}

export async function fetchMacroSignalCoverage(): Promise<MacroSignalCoverage> {
  return fetchJson<MacroSignalCoverage>(`${BRIDGE_BASE}/research/coverage`);
}

export async function fetchMacroSignalExpansionReport(): Promise<MacroSignalExpansionReport> {
  return fetchJson<MacroSignalExpansionReport>(`${BRIDGE_BASE}/research/expansion-report`);
}

export async function fetchFmsWorkbench(market: FmsResearchMarket = "EURUSD"): Promise<FmsWorkbench> {
  return fetchJson<FmsWorkbench>(`${BRIDGE_BASE}/research/workbench?market=${market}`);
}

export async function createFmsExperiment(payload: {
  market: FmsResearchMarket;
  friendlyName: string;
  catalogId: string;
  directionSelection: "long" | "short" | "both";
  scoringPolicy: "baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality";
  cohort: { dimension: string; value: string };
  reaction: "continuation" | "contrarian";
  execution: {
    mode: "single" | "matrix";
    stopAtrValues: number[];
    targetRValues: number[];
    holdingCandles: number[];
  };
}): Promise<FmsExperiment> {
  const response = await fetch(`${BRIDGE_BASE}/research/experiments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Experiment request failed (${response.status})`);
  }
  return response.json() as Promise<FmsExperiment>;
}

export async function fetchFmsExperiment(experimentId: string): Promise<FmsExperiment> {
  return fetchJson<FmsExperiment>(`${BRIDGE_BASE}/research/experiments/${encodeURIComponent(experimentId)}`);
}

export async function fetchFmsRawCases(
  experimentId: string,
  filters: {
    page?: number;
    pageSize?: number;
    contract?: string;
    search?: string;
    direction?: string;
    inclusion?: string;
    reliability?: string;
    outcome?: string;
  } = {},
): Promise<import("@/app/types").FmsRawCasesPage> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return fetchJson<import("@/app/types").FmsRawCasesPage>(`${BRIDGE_BASE}/research/experiments/${encodeURIComponent(experimentId)}/raw-cases?${query}`);
}

export async function freezeFmsExperiment(
  experimentId: string,
  payload: { friendlyName: string; acknowledgeFailedGates: boolean },
): Promise<FmsFrozenCandidate> {
  const response = await fetch(
    `${BRIDGE_BASE}/research/experiments/${encodeURIComponent(experimentId)}/freeze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Candidate freeze failed (${response.status})`);
  }
  return response.json() as Promise<FmsFrozenCandidate>;
}

export async function fetchMacroSignalVersion(): Promise<MacroSignalVersion> {
  return fetchJson<MacroSignalVersion>(`${BRIDGE_BASE}/research/versions/current`);
}

export async function fetchMacroSignalVersions(): Promise<MacroSignalVersion[]> {
  return fetchJson<MacroSignalVersion[]>(`${BRIDGE_BASE}/research/versions`);
}

export async function fetchMacroSignalForwardPaper(versionId = "FMS-EURUSD-LABOR-H4-v2"): Promise<MacroSignalForwardPaper> {
  return fetchJson<MacroSignalForwardPaper>(
    `${BRIDGE_BASE}/research/forward?versionId=${encodeURIComponent(versionId)}`,
  );
}

const chartSignalRequests = new Map<string, Promise<MacroSignalChartSignalResponse>>();

export async function fetchMacroSignalChartSignals(params: {
  symbol: string;
  timeframe: string;
  mode: MacroSignalChartMode;
  from?: number;
  to?: number;
  refresh?: boolean;
  compact?: boolean;
  markersOnly?: boolean;
}): Promise<MacroSignalChartSignalResponse> {
  const search = new URLSearchParams({ symbol: params.symbol, tf: params.timeframe, mode: params.mode });
  if (params.from != null) search.set("from_", String(params.from));
  if (params.to != null) search.set("to", String(params.to));
  if (params.refresh) search.set("refresh", "true");
  if (params.compact) search.set("compact", "true");
  if (params.markersOnly) search.set("markers_only", "true");
  const url = `${BRIDGE_BASE}/research/chart-signals?${search.toString()}`;
  const pending = chartSignalRequests.get(url);
  if (pending) return pending;
  const request = fetchJson<MacroSignalChartSignalResponse>(url, { signal: AbortSignal.timeout(90_000) })
    .finally(() => { chartSignalRequests.delete(url); });
  chartSignalRequests.set(url, request);
  return request;
}

export async function fetchMacroSignalTargetLadder(params: {
  symbol: string;
  patternId: string;
  eventTime: number;
  mode: MacroSignalChartMode;
  identityScope?: string;
}): Promise<{ signal: MacroSignalChartSignal }> {
  const search = new URLSearchParams({
    symbol: params.symbol,
    patternId: params.patternId,
    eventTime: String(params.eventTime),
    mode: params.mode,
  });
  const url = `${BRIDGE_BASE}/research/chart-signal-target-ladder?${search.toString()}`;
  const requestKey = `${url}|${params.identityScope ?? ""}`;
  const pending = targetLadderRequests.get(requestKey);
  if (pending) return pending;
  const request = fetchJson<{ signal: MacroSignalChartSignal }>(url, { signal: AbortSignal.timeout(90_000) })
    .finally(() => { targetLadderRequests.delete(requestKey); });
  targetLadderRequests.set(requestKey, request);
  return request;
}

const targetLadderRequests = new Map<string, Promise<{ signal: MacroSignalChartSignal }>>();

const globalRegistryRequests = new Map<string, Promise<MacroSignalGlobalResponse>>();

export interface FmsReviewNote {
  recordKey: string;
  context: "scheduled" | "activity";
  market: string;
  patternId: string;
  eventTime: number | null;
  signalId: string | null;
  label: FmsReviewNoteLabel;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export const FMS_REVIEW_NOTE_LABELS = ["unlabeled", "bug", "tp", "sl", "entry", "reaction", "ok", "question"] as const;
export type FmsReviewNoteLabel = typeof FMS_REVIEW_NOTE_LABELS[number];

export type FmsReviewNoteInput = Pick<FmsReviewNote, "recordKey" | "context" | "market" | "patternId" | "eventTime" | "signalId" | "label" | "note">;

function normalizeFmsReviewNote(row: FmsReviewNote): FmsReviewNote {
  return {
    ...row,
    label: FMS_REVIEW_NOTE_LABELS.includes(row.label) ? row.label : "unlabeled",
  };
}

export async function fetchFmsReviewNotes(filters: {
  label?: FmsReviewNoteLabel;
  market?: string;
  patternId?: string;
  query?: string;
  limit?: number;
} = {}): Promise<FmsReviewNote[]> {
  const search = new URLSearchParams();
  if (filters.label) search.set("label", filters.label);
  if (filters.market) search.set("market", filters.market);
  if (filters.patternId) search.set("pattern_id", filters.patternId);
  if (filters.query) search.set("q", filters.query);
  if (filters.limit != null) search.set("limit", String(filters.limit));
  const response = await fetchJson<{ rows: FmsReviewNote[] }>(`${BRIDGE_BASE}/research/review-notes${search.size ? `?${search.toString()}` : ""}`, {
    signal: AbortSignal.timeout(15_000),
  });
  return Array.isArray(response.rows) ? response.rows.map(normalizeFmsReviewNote) : [];
}

export async function saveFmsReviewNote(input: FmsReviewNoteInput): Promise<FmsReviewNote> {
  const response = await fetchJson<{ row: FmsReviewNote }>(`${BRIDGE_BASE}/research/review-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
  });
  return normalizeFmsReviewNote(response.row);
}

export async function deleteFmsReviewNote(recordKey: string): Promise<boolean> {
  const search = new URLSearchParams({ record_key: recordKey });
  const response = await fetchJson<{ deleted: boolean }>(`${BRIDGE_BASE}/research/review-notes?${search.toString()}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(15_000),
  });
  return response.deleted;
}

export async function fetchMacroSignalGlobalRegistry(options: { refresh?: boolean } = {}): Promise<MacroSignalGlobalResponse> {
  const search = new URLSearchParams({ tf: "H4" });
  if (options.refresh) search.set("refresh", "true");
  const url = `${BRIDGE_BASE}/research/chart-signals/global?${search.toString()}`;
  const pending = globalRegistryRequests.get(url);
  if (pending) return pending;
  const request = fetchJson<MacroSignalGlobalResponse>(url, { signal: AbortSignal.timeout(90_000) })
    .finally(() => { globalRegistryRequests.delete(url); });
  globalRegistryRequests.set(url, request);
  return request;
}

export async function fetchMacroSignalGlobalStartupRegistry(): Promise<MacroSignalGlobalResponse> {
  return fetchJson<MacroSignalGlobalResponse>(`${BRIDGE_BASE}/research/chart-signals/startup?tf=H4`, {
    signal: AbortSignal.timeout(4_000),
  });
}

let preloadedMacroSignalGlobalRegistry: MacroSignalGlobalResponse | null = null;
let preloadedMacroSignalGlobalPromise: Promise<MacroSignalGlobalResponse> | null = null;
let preloadedMacroSignalGlobalFetched = false;
let preloadedMacroSignalGlobalHydrated = false;
let preloadedMacroSignalGlobalStartupPromise: Promise<MacroSignalGlobalResponse> | null = null;
const GLOBAL_REGISTRY_STORAGE_KEY = "fyodor.fms.global-registry.v2";
const LEGACY_GLOBAL_REGISTRY_STORAGE_KEY = "fyodor.fms.global-registry.v1";

function isMacroSignalGlobalResponse(value: unknown): value is MacroSignalGlobalResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MacroSignalGlobalResponse>;
  return typeof candidate.modelId === "string"
    && typeof candidate.modelHash === "string"
    && typeof candidate.generatedAt === "number"
    && Array.isArray(candidate.markets)
    && candidate.markets.every((market) => Boolean(
      market && typeof market === "object" && typeof market.symbol === "string"
      && Array.isArray(market.patterns) && Array.isArray(market.signals),
    ));
}

export function isCompleteStartupRegistry(value: unknown): value is MacroSignalGlobalResponse {
  if (!isMacroSignalGlobalResponse(value)) return false;
  const candidate = value as MacroSignalGlobalResponse;
  const registrySymbols = candidate.registrySymbols;
  if (!candidate.startupProjection || !Array.isArray(registrySymbols) || registrySymbols.length === 0) return false;
  const marketSymbols = candidate.markets.map((market) => market.symbol).sort();
  return registrySymbols.length === marketSymbols.length
    && [...registrySymbols].sort().every((symbol, index) => symbol === marketSymbols[index]);
}

function hydrateMacroSignalGlobalRegistry(): void {
  if (preloadedMacroSignalGlobalHydrated) return;
  preloadedMacroSignalGlobalHydrated = true;
  if (typeof window === "undefined") return;
  try {
    // v1 could retain the multi-megabyte authoritative payload and consume the
    // quota needed by its bounded replacement. It is only a disposable cache.
    window.localStorage.removeItem(LEGACY_GLOBAL_REGISTRY_STORAGE_KEY);
    const raw = window.localStorage.getItem(GLOBAL_REGISTRY_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (isCompleteStartupRegistry(parsed)) preloadedMacroSignalGlobalRegistry = parsed;
  } catch {
    // A corrupt or over-quota acceleration snapshot must never block the live registry.
  }
}

function rememberMacroSignalGlobalRegistry(response: MacroSignalGlobalResponse, complete = true): MacroSignalGlobalResponse {
  if (complete || !preloadedMacroSignalGlobalFetched) preloadedMacroSignalGlobalRegistry = response;
  if (complete) preloadedMacroSignalGlobalFetched = true;
  if (typeof window !== "undefined" && isCompleteStartupRegistry(response)) {
    try {
      window.localStorage.removeItem(LEGACY_GLOBAL_REGISTRY_STORAGE_KEY);
      window.localStorage.setItem(GLOBAL_REGISTRY_STORAGE_KEY, JSON.stringify(response));
    } catch { /* startup acceleration remains optional */ }
  } else if (complete && typeof window !== "undefined") {
    // The authoritative registry is intentionally too large for startup storage.
    // Ask the bridge for its bounded projection after the durable global snapshot is current.
    void fetchMacroSignalGlobalStartupRegistry().then((startup) => {
      if (!isCompleteStartupRegistry(startup)) return;
      try {
        window.localStorage.removeItem(LEGACY_GLOBAL_REGISTRY_STORAGE_KEY);
        window.localStorage.setItem(GLOBAL_REGISTRY_STORAGE_KEY, JSON.stringify(startup));
      }
      catch { /* startup acceleration remains optional */ }
    }).catch(() => undefined);
  }
  return complete || !preloadedMacroSignalGlobalFetched ? response : preloadedMacroSignalGlobalRegistry ?? response;
}

export function getPreloadedMacroSignalGlobalRegistry(): MacroSignalGlobalResponse | null {
  hydrateMacroSignalGlobalRegistry();
  return preloadedMacroSignalGlobalRegistry;
}

export function preloadMacroSignalGlobalStartupRegistry(): Promise<MacroSignalGlobalResponse> {
  hydrateMacroSignalGlobalRegistry();
  if (preloadedMacroSignalGlobalRegistry) return Promise.resolve(preloadedMacroSignalGlobalRegistry);
  if (preloadedMacroSignalGlobalStartupPromise) return preloadedMacroSignalGlobalStartupPromise;
  preloadedMacroSignalGlobalStartupPromise = fetchMacroSignalGlobalStartupRegistry()
    .then((response) => {
      if (!isCompleteStartupRegistry(response)) throw new Error("Bridge returned an incomplete FMS startup registry");
      return rememberMacroSignalGlobalRegistry(response, false);
    })
    .finally(() => { preloadedMacroSignalGlobalStartupPromise = null; });
  return preloadedMacroSignalGlobalStartupPromise;
}

export function preloadMacroSignalGlobalRegistry(): Promise<MacroSignalGlobalResponse> {
  hydrateMacroSignalGlobalRegistry();
  if (preloadedMacroSignalGlobalPromise) return preloadedMacroSignalGlobalPromise;
  if (preloadedMacroSignalGlobalFetched && preloadedMacroSignalGlobalRegistry) return Promise.resolve(preloadedMacroSignalGlobalRegistry);
  const fallback = preloadedMacroSignalGlobalRegistry;
  preloadedMacroSignalGlobalPromise = fetchMacroSignalGlobalRegistry()
    .then(rememberMacroSignalGlobalRegistry)
    .catch((error: unknown) => {
      if (fallback) return fallback;
      throw error;
    }).finally(() => {
    preloadedMacroSignalGlobalPromise = null;
  });
  return preloadedMacroSignalGlobalPromise;
}

export async function refreshMacroSignalGlobalRegistry(): Promise<MacroSignalGlobalResponse> {
  if (preloadedMacroSignalGlobalPromise) return preloadedMacroSignalGlobalPromise;
  preloadedMacroSignalGlobalPromise = fetchMacroSignalGlobalRegistry({ refresh: true }).then(rememberMacroSignalGlobalRegistry).finally(() => {
    preloadedMacroSignalGlobalPromise = null;
  });
  return preloadedMacroSignalGlobalPromise;
}

let preloadedMacroSignalCurrentModel: MacroSignalChartSignalResponse | null = null;
let preloadedMacroSignalCurrentPromise: Promise<MacroSignalChartSignalResponse> | null = null;

export function getPreloadedMacroSignalCurrentModel(): MacroSignalChartSignalResponse | null {
  return preloadedMacroSignalCurrentModel;
}

export function preloadMacroSignalCurrentModel(): Promise<MacroSignalChartSignalResponse> {
  if (preloadedMacroSignalCurrentModel) return Promise.resolve(preloadedMacroSignalCurrentModel);
  if (preloadedMacroSignalCurrentPromise) return preloadedMacroSignalCurrentPromise;
  preloadedMacroSignalCurrentPromise = fetchMacroSignalChartSignals({
    symbol: "EURUSD",
    timeframe: "H4",
    mode: "current",
  }).then((response) => {
    preloadedMacroSignalCurrentModel = response;
    return response;
  }).finally(() => {
    preloadedMacroSignalCurrentPromise = null;
  });
  return preloadedMacroSignalCurrentPromise;
}

export async function fetchLatestMacroSignalBacktest(versionId = "FMS-EURUSD-LABOR-H4-v2"): Promise<MacroSignalBacktestRun | null> {
  try {
    return await fetchJson<MacroSignalBacktestRun>(
      `${BRIDGE_BASE}/research/backtests/latest?versionId=${encodeURIComponent(versionId)}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("returned 404")) return null;
    throw error;
  }
}

export async function fetchMacroSignalBacktest(runId: string): Promise<MacroSignalBacktestRun> {
  return fetchJson<MacroSignalBacktestRun>(
    `${BRIDGE_BASE}/research/backtests/${encodeURIComponent(runId)}`,
  );
}

export async function startMacroSignalBacktest(versionId = "FMS-EURUSD-LABOR-H4-v2"): Promise<MacroSignalBacktestRun> {
  const response = await fetch(`${BRIDGE_BASE}/research/backtests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId }),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: unknown };
      detail = typeof payload.detail === "string" ? payload.detail : "";
    } catch {
      // The generic status below remains honest when the bridge returns a non-JSON error.
    }
    throw new Error(`Bridge returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as MacroSignalBacktestRun;
}

export async function fetchMarketStatus(symbol: string): Promise<MarketStatusResponse> {
  const url = `${BRIDGE_BASE}/market_status?symbol=${encodeURIComponent(symbol)}`;

  try {
    const payload = await fetchJson<unknown>(url);
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid market status payload");
    }

    const row = payload as Record<string, unknown>;

    return {
      symbol: asString(row.symbol) || symbol,
      symbol_path: asString(row.symbol_path) || null,
      asset_class: asString(row.asset_class) || null,
      session_state: normalizeMarketSessionState(row.session_state),
      is_open: typeof row.is_open === "boolean" ? row.is_open : null,
      terminal_connected: Boolean(row.terminal_connected),
      checked_at: asNumber(row.checked_at) ?? Math.floor(Date.now() / 1000),
      server_time: asNumber(row.server_time),
      last_tick_time: asNumber(row.last_tick_time),
      next_open_time: asNumber(row.next_open_time),
      next_close_time: asNumber(row.next_close_time),
      reason: asString(row.reason) || null,
    };
  } catch {
    return {
      symbol,
      symbol_path: null,
      asset_class: null,
      session_state: "unavailable",
      is_open: null,
      terminal_connected: false,
      checked_at: Math.floor(Date.now() / 1000),
      server_time: null,
      last_tick_time: null,
      next_open_time: null,
      next_close_time: null,
      reason: "bridge_unavailable",
    };
  }
}

export function openChartStream(
  symbol: string,
  timeframe: string,
  handlers: {
    onOpen?: () => void;
    onClose?: () => void;
    onError?: () => void;
    onMessage?: (payload: unknown) => void;
  },
): WebSocket {
  const url =
    `${BRIDGE_WS_BASE}/stream?symbol=${encodeURIComponent(symbol)}` +
    `&tf=${encodeURIComponent(timeframe)}`;

  const socket = new WebSocket(url);
  const streamDetail = `${symbol} · ${timeframe}`;
  recordAppActivity({ source: "Chart stream", message: "Connecting", detail: streamDetail });
  socket.onopen = () => {
    recordAppActivity({ level: "success", source: "Chart stream", message: "Connected", detail: streamDetail });
    handlers.onOpen?.();
  };
  socket.onclose = () => {
    recordAppActivity({ source: "Chart stream", message: "Closed", detail: streamDetail });
    handlers.onClose?.();
  };
  socket.onerror = () => {
    recordAppActivity({ level: "error", source: "Chart stream", message: "Connection error", detail: streamDetail });
    handlers.onError?.();
  };
  socket.onmessage = (event) => {
    try {
      handlers.onMessage?.(JSON.parse(event.data) as unknown);
    } catch {
      handlers.onMessage?.(event.data);
    }
  };
  return socket;
}
