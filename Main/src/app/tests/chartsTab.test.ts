import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartSettingsDrawer } from "@/app/components/ChartSettingsDrawer";
import { DEFAULT_CHART_PREFERENCES } from "@/app/lib/chartView";
import { ChartsTab } from "@/app/tabs/primary/ChartsTab";
import { getChartConnectionLabel } from "@/app/lib/chartDisplay";
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

  it("renders chart toolbar and settings drawer controls", () => {
    const html = renderToStaticMarkup(
      createElement(ChartsTab, {
        selectedSymbol: "EURUSD",
        onSelectedSymbolChange: () => {},
        events: [],
        onOpenCalendarEvent: () => {},
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: "Forex Majors\\EURUSD",
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
        },
      }),
    );

    expect(html).toContain("Cursor readout mode");
    expect(html).toContain("Crosshair");
    expect(html).toContain("Sticky");
    expect(html).toContain("Open chart appearance");
    expect(html).toContain("Open chart events");
    expect(html).toContain("Open chart data cache");
    expect(html).not.toContain(">History<");
  });

  it("renders event overlay controls inside the chart settings drawer", () => {
    const html = renderToStaticMarkup(
      createElement(ChartSettingsDrawer, {
        open: true,
        mode: "events",
        onModeChange: () => {},
        onClose: () => {},
        preferences: DEFAULT_CHART_PREFERENCES,
        onCursorModeChange: () => {},
        onAppearanceChange: () => {},
        onEventOverlayChange: () => {},
        onResetAppearance: () => {},
      }),
    );

    expect(html).toContain("Events");
    expect(html).toContain("Event Timeline");
    expect(html).toContain("Current chart settings summary");
    expect(html).toContain("Surface");
    expect(html).toContain("Cursor");
    expect(html).toContain("Show event lines on chart");
    expect(html).toContain("Impact");
    expect(html).toContain("High only");
    expect(html).toContain("High + medium");
    expect(html).toContain("Maximum markers");
    expect(html).toContain("Selected pair");
    expect(html).toContain("All currencies");
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
