import { describe, expect, it } from "vitest";
import { getChartConnectionLabel } from "@/app/tabs/ChartsTab";
import { getChartSessionDetail } from "@/app/lib/chartView";

describe("getChartConnectionLabel", () => {
  it("uses market and bridge specific labels", () => {
    expect(
      getChartConnectionLabel({
        historyState: "ready",
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: null,
          asset_class: null,
          session_state: "open",
          is_open: true,
          terminal_connected: true,
          checked_at: 0,
          server_time: null,
          last_tick_time: null,
          next_open_time: null,
          next_close_time: null,
          reason: null,
        },
        streamConnected: true,
      }),
    ).toBe("Market Open");

    expect(
      getChartConnectionLabel({
        historyState: "ready",
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: null,
          asset_class: null,
          session_state: "closed",
          is_open: false,
          terminal_connected: true,
          checked_at: 0,
          server_time: null,
          last_tick_time: null,
          next_open_time: null,
          next_close_time: null,
          reason: null,
        },
        streamConnected: false,
      }),
    ).toBe("Market Closed");

    expect(
      getChartConnectionLabel({
        historyState: "error",
        marketStatus: null,
        streamConnected: false,
      }),
    ).toBe("Bridge Unavailable");

    expect(
      getChartConnectionLabel({
        historyState: "ready",
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: null,
          asset_class: null,
          session_state: "open",
          is_open: true,
          terminal_connected: false,
          checked_at: 0,
          server_time: null,
          last_tick_time: null,
          next_open_time: null,
          next_close_time: null,
          reason: null,
        },
        streamConnected: false,
      }),
    ).toBe("MT5 Disconnected");
  });

  it("derives session detail only from the active market status", () => {
    expect(getChartSessionDetail(null).label).toBe("Session unavailable");

    expect(
      getChartSessionDetail({
        symbol: "EURUSD",
        symbol_path: null,
        asset_class: "forex",
        session_state: "open",
        is_open: true,
        terminal_connected: true,
        checked_at: 0,
        server_time: null,
        last_tick_time: null,
        next_open_time: null,
        next_close_time: null,
        reason: null,
      }),
    ).toMatchObject({
      label: "Scheduled session closes in N/A",
    });

    expect(
      getChartSessionDetail({
        symbol: "EURUSD",
        symbol_path: null,
        asset_class: "forex",
        session_state: "closed",
        is_open: false,
        terminal_connected: true,
        checked_at: 0,
        server_time: null,
        last_tick_time: null,
        next_open_time: null,
        next_close_time: null,
        reason: null,
      }),
    ).toMatchObject({
      label: "Scheduled session opens in N/A",
    });
  });
});
