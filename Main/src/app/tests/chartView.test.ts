import { TickMarkType } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHART_PREFERENCES,
  formatChartAxisTime,
  formatChartFeedTime,
  formatChartHoverTime,
  formatCursorReadout,
  getChartDisplayCandles,
  getChartTimeFormatters,
  loadChartPreferences,
  mergeChartCandles,
  normalizeChartPreferences,
  normalizeHistoryCacheEntry,
  normalizeChartTimestampSeconds,
  summarizeChartCache,
  validateAndSortCandles,
  getChartSessionDetail,
} from "@/app/lib/chartView";
import {
  formatDateTimeForDisplayTimezone,
  formatHoverTimezoneSuffix,
  formatUtcOffsetLabel,
} from "@/app/lib/timezoneDisplay";
import type { BridgeCandle, MarketStatusResponse } from "@/app/types";

const SAMPLE_CANDLE: BridgeCandle = {
  time: Date.UTC(2026, 1, 19, 21, 0, 0) / 1000,
  open: 1,
  high: 2,
  low: 0.5,
  close: 1.5,
  volume: 10,
};

function marketStatus(
  overrides: Partial<MarketStatusResponse> = {},
): MarketStatusResponse {
  return {
    symbol: "EURUSD",
    symbol_path: null,
    asset_class: "forex",
    session_state: "open",
    is_open: true,
    terminal_connected: true,
    checked_at: 0,
    server_time: SAMPLE_CANDLE.time,
    last_tick_time: SAMPLE_CANDLE.time,
    next_open_time: SAMPLE_CANDLE.time + 3600,
    next_close_time: SAMPLE_CANDLE.time + 7200,
    reason: "active_session",
    ...overrides,
  };
}

describe("chartView helpers", () => {
  it("keeps canonical candle timestamps unchanged", () => {
    const display = getChartDisplayCandles([SAMPLE_CANDLE]);
    expect(display[0]?.time).toBe(SAMPLE_CANDLE.time);
  });

  it("formats x-axis labels by tick mark type for server and offset modes", () => {
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "H1", TickMarkType.Time, "server")).toBe("21:00");
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "H4", TickMarkType.DayOfMonth, "server")).toBe("19 Feb");
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "W1", TickMarkType.Month, "server")).toBe("Feb 26");
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "D1", TickMarkType.Time, "server")).toBe("19 Feb");
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "H1", TickMarkType.Time, "utc-offset:120")).toBe("23:00");
  });

  it("normalizes all lightweight-chart time shapes used by formatters", () => {
    expect(normalizeChartTimestampSeconds(SAMPLE_CANDLE.time)).toBe(SAMPLE_CANDLE.time);
    expect(normalizeChartTimestampSeconds(String(SAMPLE_CANDLE.time))).toBe(SAMPLE_CANDLE.time);
    expect(normalizeChartTimestampSeconds({ year: 2026, month: 2, day: 19 })).toBe(
      Date.UTC(2026, 1, 19, 0, 0, 0) / 1000,
    );
    expect(normalizeChartTimestampSeconds({ nope: true })).toBeNull();
  });

  it("builds shared chart time formatters for axis and crosshair labels", () => {
    const formatters = getChartTimeFormatters("M15", "server");
    expect(formatters.tickMarkFormatter(SAMPLE_CANDLE.time, TickMarkType.Time)).toBe("21:00");
    expect(formatters.timeFormatter(SAMPLE_CANDLE.time)).toBe("19 Feb 2026 21:00 MT5/Server");
  });

  it("normalizes chart preferences and falls back safely without browser storage", () => {
    expect(loadChartPreferences()).toEqual(DEFAULT_CHART_PREFERENCES);
    expect(
      normalizeChartPreferences({
        cursorReadoutMode: "nearest_candle",
        appearance: {
          bullishColor: "#00ff00",
          bearishColor: "nope",
          gridVisible: false,
          wickMode: "neutral",
        },
      }),
    ).toMatchObject({
      cursorReadoutMode: "nearest_candle",
      appearance: {
        bullishColor: "#00ff00",
        bearishColor: DEFAULT_CHART_PREFERENCES.appearance.bearishColor,
        gridVisible: false,
        wickMode: "neutral",
      },
    });
  });

  it("formats cursor readout labels for all supported modes", () => {
    expect(formatCursorReadout({ mode: "true_cursor", truePrice: 1.23456, candlePrice: 1.2, precision: 4 })).toEqual([
      { label: "Cursor", value: "1.2346" },
    ]);
    expect(formatCursorReadout({ mode: "nearest_candle", truePrice: 1.23456, candlePrice: 1.2, precision: 4 })).toEqual([
      { label: "Candle", value: "1.2000" },
    ]);
    expect(formatCursorReadout({ mode: "both", truePrice: 1.23456, candlePrice: 1.2, precision: 2 })).toEqual([
      { label: "Cursor", value: "1.23" },
      { label: "Candle", value: "1.20" },
    ]);
  });

  it("validates, sorts, dedupes, and summarizes cached candles", () => {
    const later = { ...SAMPLE_CANDLE, time: SAMPLE_CANDLE.time + 60, close: 1.7 };
    const malformed = { ...SAMPLE_CANDLE, time: "bad" };
    const candles = validateAndSortCandles([later, malformed, SAMPLE_CANDLE, { ...SAMPLE_CANDLE, close: 1.6 }]);

    expect(candles).toHaveLength(2);
    expect(candles[0]?.close).toBe(1.6);
    expect(candles[1]?.time).toBe(later.time);
    expect(summarizeChartCache(candles)).toEqual({
      count: 2,
      oldestTime: SAMPLE_CANDLE.time,
      latestTime: later.time,
    });
    expect(mergeChartCandles([SAMPLE_CANDLE], [later])).toHaveLength(2);
    expect(normalizeHistoryCacheEntry({ version: 1, candles: [malformed] })).toBeNull();
  });

  it("formats hover and feed labels for local, server, and fixed UTC offset modes", () => {
    expect(formatChartFeedTime(SAMPLE_CANDLE.time, "server")).toBe("19 Feb 2026 21:00");
    expect(formatChartHoverTime(SAMPLE_CANDLE.time, "server")).toBe("19 Feb 2026 21:00 MT5/Server");
    expect(formatChartFeedTime(SAMPLE_CANDLE.time, "local")).toBe(formatDateTimeForDisplayTimezone(SAMPLE_CANDLE.time, "local"));
    expect(formatChartHoverTime(SAMPLE_CANDLE.time, "local")).toBe(
      `${formatDateTimeForDisplayTimezone(SAMPLE_CANDLE.time, "local")} ${formatHoverTimezoneSuffix("local")}`,
    );
    expect(formatChartHoverTime(SAMPLE_CANDLE.time, "utc-offset:345")).toBe(
      `20 Feb 2026 02:45 ${formatUtcOffsetLabel(345)}`,
    );
  });

  it("returns honest session wording for forex, crypto, and unavailable states", () => {
    expect(getChartSessionDetail(marketStatus(), SAMPLE_CANDLE.time * 1000)).toMatchObject({
      label: "Scheduled session closes in 2h 00m 00s",
    });

    expect(
      getChartSessionDetail(
        marketStatus({
          asset_class: "crypto",
          next_close_time: SAMPLE_CANDLE.time + 1800,
        }),
        SAMPLE_CANDLE.time * 1000,
      ),
    ).toMatchObject({
      label: "Daily rollover in 30m 00s",
    });

    expect(
      getChartSessionDetail(
        marketStatus({
          asset_class: "other",
          session_state: "unavailable",
          is_open: null,
          next_open_time: null,
          next_close_time: null,
          reason: "session_unknown",
        }),
      ),
    ).toMatchObject({
      label: "Session unavailable",
    });
  });
});
