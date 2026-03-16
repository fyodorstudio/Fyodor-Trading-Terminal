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

  if (marketStatus.session_state === "closed") return "stale";
  if (marketStatus.session_state === "unavailable") {
    return streamConnected ? "live" : "stale";
  }

  return streamConnected ? "live" : "stale";
}
