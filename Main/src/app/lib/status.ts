import { isStale } from "@/app/lib/format";
import type { BridgeHealth, BridgeStatus, MarketStatusResponse } from "@/app/types";

interface CalendarStatusOptions {
  eventsCount: number;
  health: BridgeHealth;
  calendarRequestFailed?: boolean;
}

interface ChartStatusOptions {
  historyState: "loading" | "ready" | "no_data" | "error";
  marketStatus: MarketStatusResponse | null;
  streamConnected: boolean;
}

export type TrustVerdict = "yes" | "limited" | "no";
export type TrustTone = "good" | "warning" | "danger";
export type TrustReason =
  | "mt5_disconnected"
  | "bridge_unavailable"
  | "calendar_untrusted"
  | "calendar_delayed"
  | "symbol_context_missing"
  | "symbol_context_unresolved"
  | "healthy";

export interface TrustState {
  verdict: TrustVerdict;
  verdictLabel: "Yes" | "Limited" | "No";
  tone: TrustTone;
  reason: TrustReason;
  title: string;
  detail: string;
}

export function resolveCalendarStatus({
  eventsCount,
  health,
  calendarRequestFailed = false,
}: CalendarStatusOptions): BridgeStatus {
  if (calendarRequestFailed && eventsCount === 0) {
    return "error";
  }

  if (calendarRequestFailed && eventsCount > 0) {
    return "stale";
  }

  if (eventsCount === 0) {
    return health.ok ? "no_data" : "error";
  }

  if (!health.ok || isStale(health.last_calendar_ingest_at ?? null)) {
    return "stale";
  }

  return "live";
}

export function resolveChartStatus({
  historyState,
  marketStatus,
  streamConnected,
}: ChartStatusOptions): BridgeStatus {
  if (historyState === "loading") return "loading";
  if (historyState === "error") return "error";
  if (historyState === "no_data") return "no_data";

  if (!marketStatus) {
    return streamConnected ? "live" : "stale";
  }

  if (marketStatus.asset_class === "crypto") {
    return streamConnected ? "live" : "stale";
  }

  if (marketStatus.session_state === "closed") return "stale";
  if (marketStatus.session_state === "unavailable") {
    return streamConnected ? "live" : "stale";
  }

  return streamConnected ? "live" : "stale";
}

export function resolveTrustState(
  health: BridgeHealth,
  feedStatus: BridgeStatus,
  marketStatus: MarketStatusResponse | null,
): TrustState {
  if (!health.terminal_connected) {
    return {
      verdict: "no",
      verdictLabel: "No",
      tone: "danger",
      reason: "mt5_disconnected",
      title: "Can I trust the app right now? No.",
      detail: "MT5 is disconnected, so live terminal context cannot be trusted.",
    };
  }

  if (!health.ok) {
    return {
      verdict: "no",
      verdictLabel: "No",
      tone: "danger",
      reason: "bridge_unavailable",
      title: "Can I trust the app right now? No.",
      detail: "The bridge is unavailable, so health and feed checks are not reliable.",
    };
  }

  if (feedStatus === "error" || feedStatus === "no_data") {
    return {
      verdict: "no",
      verdictLabel: "No",
      tone: "danger",
      reason: "calendar_untrusted",
      title: "Can I trust the app right now? No.",
      detail: "High-impact event timing cannot be verified from the current calendar state.",
    };
  }

  if (feedStatus === "loading" || feedStatus === "stale") {
    return {
      verdict: "limited",
      verdictLabel: "Limited",
      tone: "warning",
      reason: "calendar_delayed",
      title: "Can I trust the app right now? Limited.",
      detail: "Core systems are up, but calendar timing context is still delayed or syncing.",
    };
  }

  if (!marketStatus || !marketStatus.terminal_connected) {
    return {
      verdict: "limited",
      verdictLabel: "Limited",
      tone: "warning",
      reason: "symbol_context_missing",
      title: "Can I trust the app right now? Limited.",
      detail: "Core systems are healthy, but the selected symbol context has not synchronized yet.",
    };
  }

  if (marketStatus.session_state === "unavailable") {
    return {
      verdict: "limited",
      verdictLabel: "Limited",
      tone: "warning",
      reason: "symbol_context_unresolved",
      title: "Can I trust the app right now? Limited.",
      detail: "The selected symbol is loaded, but its session state is still unresolved.",
    };
  }

  return {
    verdict: "yes",
    verdictLabel: "Yes",
    tone: "good",
    reason: "healthy",
    title: "Can I trust the app right now? Yes.",
    detail: "MT5, bridge, calendar, and selected symbol context are all healthy enough for normal review.",
  };
}
