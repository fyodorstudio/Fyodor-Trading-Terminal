import type {
  BridgeCandle,
  BridgeHealth,
  BridgeSymbol,
  CalendarEvent,
  ImpactLevel,
  MarketStatusResponse,
} from "@/app/types";

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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Bridge returned ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchHistory(symbol: string, tf: string, bars = 200): Promise<BridgeCandle[]> {
  const url =
    `${BRIDGE_BASE}/history?symbol=${encodeURIComponent(symbol)}` +
    `&tf=${encodeURIComponent(tf)}&bars=${encodeURIComponent(String(bars))}`;
  const payload = await fetchJson<unknown[]>(url);
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

export async function fetchSymbols(): Promise<BridgeSymbol[]> {
  try {
    const payload = await fetchJson<unknown[]>(`${BRIDGE_BASE}/symbols`);
    return payload
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const name = asString(row.name);
        if (!name) return null;
        const path = asString(row.path) || null;
        return { name, path };
      })
      .filter((item): item is BridgeSymbol => item !== null);
  } catch {
    return [];
  }
}

export async function fetchHealth(): Promise<BridgeHealth> {
  try {
    const payload = await fetchJson<unknown>(`${BRIDGE_BASE}/health`);
    if (!payload || typeof payload !== "object") {
      return { ok: false, terminal_connected: false };
    }
    const row = payload as Record<string, unknown>;
    return {
      ok: Boolean(row.ok),
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
    return { ok: false, terminal_connected: false };
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
  socket.onopen = () => handlers.onOpen?.();
  socket.onclose = () => handlers.onClose?.();
  socket.onerror = () => handlers.onError?.();
  socket.onmessage = (event) => {
    try {
      handlers.onMessage?.(JSON.parse(event.data) as unknown);
    } catch {
      handlers.onMessage?.(event.data);
    }
  };
  return socket;
}
