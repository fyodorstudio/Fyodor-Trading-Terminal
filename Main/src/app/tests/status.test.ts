import { describe, expect, it } from "vitest";
import { resolveCalendarStatus, resolveChartStatus } from "@/app/lib/status";
import type { BridgeHealth, MarketStatusResponse } from "@/app/types";

const liveHealth: BridgeHealth = {
  ok: true,
  terminal_connected: true,
  last_calendar_ingest_at: Math.floor(Date.now() / 1000),
  calendar_events_count: 12,
  last_error: null,
};

function marketStatus(session_state: MarketStatusResponse["session_state"]): MarketStatusResponse {
  return {
    symbol: "EURUSD",
    symbol_path: "Forex Majors\\EURUSD",
    asset_class: "forex",
    session_state,
    is_open: session_state === "open" ? true : session_state === "closed" ? false : null,
    terminal_connected: true,
    checked_at: Math.floor(Date.now() / 1000),
    server_time: Math.floor(Date.now() / 1000),
    last_tick_time: Math.floor(Date.now() / 1000),
    next_open_time: Math.floor(Date.now() / 1000) + 3600,
    next_close_time: Math.floor(Date.now() / 1000) + 3600,
    reason: null,
  };
}

describe("resolveCalendarStatus", () => {
  it("keeps stored rows visible as stale when health is not ok", () => {
    expect(
      resolveCalendarStatus({
        eventsCount: 8,
        health: { ...liveHealth, ok: false, terminal_connected: false },
      }),
    ).toBe("stale");
  });

  it("reports error only when request failed and no rows exist", () => {
    expect(
      resolveCalendarStatus({
        eventsCount: 0,
        health: { ...liveHealth, ok: false, terminal_connected: false },
        calendarRequestFailed: true,
      }),
    ).toBe("error");
  });

  it("reports stale when refresh fails but previously loaded rows still exist", () => {
    expect(
      resolveCalendarStatus({
        eventsCount: 8,
        health: liveHealth,
        calendarRequestFailed: true,
      }),
    ).toBe("stale");
  });
});

describe("resolveChartStatus", () => {
  it("treats loaded history plus closed market as stale", () => {
    expect(
      resolveChartStatus({
        historyState: "ready",
        marketStatus: marketStatus("closed"),
        streamConnected: false,
      }),
    ).toBe("stale");
  });

  it("treats loaded history plus open stream as live", () => {
    expect(
      resolveChartStatus({
        historyState: "ready",
        marketStatus: marketStatus("open"),
        streamConnected: true,
      }),
    ).toBe("live");
  });
});
