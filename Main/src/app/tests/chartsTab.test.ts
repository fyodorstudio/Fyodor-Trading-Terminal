import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartSettingsDrawer } from "@/app/components/ChartSettingsDrawer";
import { ChartPairMatrixRangeOverlay, clampPairMatrixPanelHeight } from "@/app/components/ChartViewport";
import { DEFAULT_CHART_PREFERENCES } from "@/app/lib/chartView";
import { ChartsTab } from "@/app/tabs/primary/ChartsTab";
import { getChartConnectionLabel } from "@/app/lib/chartDisplay";
import { getChartSessionDetail } from "@/app/lib/chartView";

describe("getChartConnectionLabel", () => {
  it("keeps Pair Matrix resizing within the default panel and usable-chart bounds", () => {
    expect(clampPairMatrixPanelHeight(500, 900)).toBe(500);
    expect(clampPairMatrixPanelHeight(100, 900)).toBe(240);
    expect(clampPairMatrixPanelHeight(900, 900)).toBe(680);
  });

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
    expect(html).toContain("Open chart diagnostics");
    expect(html).toContain("Event Lens");
    expect(html).toContain("Open Event Lens details");
    expect(html).toContain("Open Pair Matrix Time Lens");
    expect(html).not.toContain(">Details<");
    expect(html).not.toContain("Loaded broker/MT5 rows only");
    expect(html).not.toContain("No loaded high-impact EUR/USD events in this visible range");
    expect(html).not.toContain("Loaded events:");
    expect(html).not.toContain("Events settings");
    expect(html).not.toContain("Show high + medium");
    expect(html).not.toContain(">History<");
    expect(html).not.toContain("Terminal Console");
  });

  it("renders scored-release ticks on the locked range band without duplicating the chart event rail", () => {
    const html = renderToStaticMarkup(
      createElement(ChartPairMatrixRangeOverlay, {
        data: {
          armed: false,
          cancelRevision: 0,
          lockedBounds: { left: 100, right: 400 },
          releaseRail: [
            { x: 150, count: 1, titles: ["GDP q/q"], currencies: ["USD"] },
            { x: 250, count: 2, titles: ["CPI y/y", "Retail Sales m/m"], currencies: ["EUR", "USD"] },
          ],
          startPreview: () => null,
          updatePreview: () => null,
          onCommit: () => {},
          onCancel: () => {},
          onInteractionChange: () => {},
        },
      }),
    );

    expect(html).toContain("Locked Pair Matrix candle range");
    expect(html).toContain("1 scored Pair Matrix release in this candle");
    expect(html).toContain("2 scored Pair Matrix releases in this candle");
    expect(html).toContain("×2");
    expect(html).not.toContain("chart-event-dot");
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
        replayData: {
          defaultSpeed: 1,
          stepCandles: 1,
          futureCandleOpacity: 0.6,
          speedOptions: [0.5, 1, 2, 4],
          stepOptions: [1, 2, 4, 8],
          onDefaultSpeedChange: () => {},
          onStepCandlesChange: () => {},
          onFutureCandleOpacityChange: () => {},
        },
      }),
    );

    expect(html).toContain("Events");
    expect(html).toContain("Show event rail");
    expect(html).toContain("Current chart settings summary");
    expect(html).toContain("Surface");
    expect(html).toContain("Replay");
    expect(html).toContain("Impact");
    expect(html).toContain("High only");
    expect(html).toContain("High + medium");
    expect(html).toContain("Max markers");
    expect(html).toContain("Loaded upcoming events");
    expect(html).toContain("Show next scheduled");
    expect(html).toContain("Selected pair");
    expect(html).toContain("All currencies");

    const replayHtml = renderToStaticMarkup(
      createElement(ChartSettingsDrawer, {
        open: true,
        mode: "replay",
        onModeChange: () => {},
        onClose: () => {},
        preferences: DEFAULT_CHART_PREFERENCES,
        onCursorModeChange: () => {},
        onAppearanceChange: () => {},
        onEventOverlayChange: () => {},
        onResetAppearance: () => {},
        replayData: {
          defaultSpeed: 1,
          stepCandles: 1,
          futureCandleOpacity: 0.6,
          speedOptions: [0.5, 1, 2, 4],
          stepOptions: [1, 2, 4, 8],
          onDefaultSpeedChange: () => {},
          onStepCandlesChange: () => {},
          onFutureCandleOpacityChange: () => {},
        },
      }),
    );
    const appearanceHtml = renderToStaticMarkup(
      createElement(ChartSettingsDrawer, {
        open: true,
        mode: "appearance",
        onModeChange: () => {},
        onClose: () => {},
        preferences: DEFAULT_CHART_PREFERENCES,
        onCursorModeChange: () => {},
        onAppearanceChange: () => {},
        onEventOverlayChange: () => {},
        onResetAppearance: () => {},
      }),
    );

    expect(replayHtml).toContain("Future candle opacity");
    expect(appearanceHtml).not.toContain("Experimental");
    expect(appearanceHtml).not.toContain("Pair compare");
    expect(appearanceHtml).not.toContain("Macro surprise");
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
