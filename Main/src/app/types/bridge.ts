export type BridgeStatus = "loading" | "live" | "no_data" | "stale" | "error";

export type MarketSessionState = "open" | "closed" | "unavailable";

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1" | "MN1";

export interface BridgeCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BridgeSymbol {
  name: string;
  path: string | null;
}

export interface BridgeHealth {
  ok: boolean;
  bridge_connected?: boolean;
  terminal_connected: boolean;
  last_calendar_ingest_at?: number | null;
  calendar_events_count?: number;
  last_error?: {
    code?: number;
    message?: string;
  } | null;
}

export interface MarketStatusResponse {
  symbol: string;
  symbol_path: string | null;
  asset_class: string | null;
  session_state: MarketSessionState;
  is_open: boolean | null;
  terminal_connected: boolean;
  checked_at: number;
  server_time: number | null;
  last_tick_time: number | null;
  next_open_time: number | null;
  next_close_time: number | null;
  reason: string | null;
}
