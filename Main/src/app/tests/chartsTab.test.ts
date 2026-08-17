import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartSettingsDrawer } from "@/app/components/ChartSettingsDrawer";
import { ChartPairMatrixContextMarkers } from "@/app/components/ChartPairMatrixContextMarkers";
import { ChartPairMatrixRangeOverlay, clampPairMatrixPanelHeight } from "@/app/components/ChartViewport";
import { DEFAULT_CHART_PREFERENCES } from "@/app/lib/chartView";
import { createPairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import { captureChartZoomSnapshot, ChartsTab, getChartRangeUpdateCadence, getPairMatrixHoverSettleDelay, resolvePairMatrixHoveredCandleUpdate, restoreChartZoomRange } from "@/app/tabs/primary/ChartsTab";
import { getChartConnectionLabel } from "@/app/lib/chartDisplay";
import { getChartSessionDetail } from "@/app/lib/chartView";

describe("getChartConnectionLabel", () => {
  it("updates Pair Matrix hover once per snapped candle and never while disabled", () => {
    expect(resolvePairMatrixHoveredCandleUpdate(null, 100, false)).toEqual({ shouldUpdate: false, value: 100 });
    expect(resolvePairMatrixHoveredCandleUpdate(100, 100, true)).toEqual({ shouldUpdate: false, value: 100 });
    expect(resolvePairMatrixHoveredCandleUpdate(100, 200, true)).toEqual({ shouldUpdate: true, value: 200 });
  });
  it("defers chart-range React updates until interaction settles while Pair Matrix is open", () => {
    expect(getChartRangeUpdateCadence(false)).toBe("animation_frame");
    expect(getChartRangeUpdateCadence(true)).toBe("settled");
  });
  it("restarts the hover quiet period when raw pointer motion continues", () => {
    expect(getPairMatrixHoverSettleDelay(1_000, 1_040, 120)).toBe(80);
    expect(getPairMatrixHoverSettleDelay(1_080, 1_090, 120)).toBe(110);
    expect(getPairMatrixHoverSettleDelay(1_000, 1_121, 120)).toBe(0);
  });
  it("publishes snapped candles outside ChartsTab state and ignores duplicate anchors", () => {
    const runtime = createPairMatrixHoverRuntime();
    const published: Array<number | null> = [];
    const unsubscribe = runtime.subscribe((anchor) => published.push(anchor));
    runtime.publishAnchor(100);
    runtime.publishAnchor(100);
    runtime.publishAnchor(200);
    unsubscribe();
    runtime.publishAnchor(300);
    expect(runtime.getAnchor()).toBe(300);
    expect(published).toEqual([100, 200]);
  });
  it("preserves horizontal candle span and latest-side padding across market changes", () => {
    const snapshot = captureChartZoomSnapshot({ from: 40, to: 120 }, 100);
    expect(snapshot).toEqual({ span: 80, rightOffset: 20 });
    expect(restoreChartZoomRange(snapshot!, 500)).toEqual({ from: 440, to: 520 });
    expect(captureChartZoomSnapshot({ from: 0, to: 1 }, 1)).toBeNull();
  });
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

  it("keeps the locked range band separate from Pair Matrix context markers", () => {
    const html = renderToStaticMarkup(
      createElement(ChartPairMatrixRangeOverlay, {
        data: {
          armed: false,
          cancelRevision: 0,
          lockedBounds: { left: 100, right: 400 },
          startPreview: () => null,
          updatePreview: () => null,
          onCommit: () => {},
          onCancel: () => {},
          onInteractionChange: () => {},
        },
      }),
    );

    expect(html).toContain("Locked Pair Matrix candle range");
    expect(html).not.toContain("chart-event-dot");

    const event = { id: 1, time: 110, currency: "USD", countryCode: "US", title: "CPI y/y", impact: "high" as const, actual: "2.5", forecast: "2.4", previous: "2.3" };
    const markers = renderToStaticMarkup(createElement(ChartPairMatrixContextMarkers, {
      markers: [{
        key: "marker", candleOpen: 100, impact: "high" as const, position: "after" as const, x: 250, placement: "center" as const,
        events: [event],
        families: [{ factor: { id: "inflation" as const, label: "Inflation", helpText: "", includeAny: [] }, events: [event] }],
      }],
      passive: false,
      displayTimeMode: "local" as const,
      sourceTimeOffsetSeconds: 0,
      loadState: "ready" as const,
      onSelectEvent: () => {},
    }));
    expect(markers).toContain('data-pair-matrix-context-markers=""');
    expect(markers).toContain("1 Pair Matrix release in this candle");
    expect(markers).toContain("impact-high");
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
        onPreserveZoomChange: () => {},
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
    expect(html).toContain("Pair Matrix markers / side");
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
        onPreserveZoomChange: () => {},
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
        onPreserveZoomChange: () => {},
        onAppearanceChange: () => {},
        onEventOverlayChange: () => {},
        onResetAppearance: () => {},
      }),
    );

    expect(replayHtml).toContain("Future candle opacity");
    expect(appearanceHtml).not.toContain("Experimental");
    expect(appearanceHtml).toContain("Keep horizontal zoom when changing symbol or timeframe");
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
