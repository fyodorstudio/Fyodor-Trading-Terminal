import { TickMarkType } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHART_PREFERENCES,
  formatChartAxisTime,
  formatChartFeedTime,
  formatChartHoverTime,
  formatCursorReadout,
  getChartDisplayCandles,
  getChartSourceTimeOffsetSeconds,
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
import {
  filterChartEventsForOverlay,
  formatChartEventDisplayTime,
  getChartEventAnchorTime,
  getChartEventCoordinateTime,
  getChartEventRelevantCurrencies,
} from "@/app/lib/chartEvents";
import type { BridgeCandle, CalendarEvent, MarketStatusResponse } from "@/app/types";

const SAMPLE_CANDLE: BridgeCandle = {
  time: Date.UTC(2026, 1, 19, 21, 0, 0) / 1000,
  open: 1,
  high: 2,
  low: 0.5,
  close: 1.5,
  volume: 10,
};

const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 1,
    time: SAMPLE_CANDLE.time,
    countryCode: "US",
    currency: "USD",
    title: "Nonfarm Payrolls",
    impact: "high",
    actual: "200K",
    forecast: "180K",
    previous: "170K",
  },
  {
    id: 2,
    time: SAMPLE_CANDLE.time + 3600,
    countryCode: "EU",
    currency: "EUR",
    title: "CPI y/y",
    impact: "medium",
    actual: "2.1%",
    forecast: "2.0%",
    previous: "1.9%",
  },
  {
    id: 3,
    time: SAMPLE_CANDLE.time + 7200,
    countryCode: "JP",
    currency: "JPY",
    title: "Retail Sales",
    impact: "low",
    actual: "0.1%",
    forecast: "0.2%",
    previous: "0.0%",
  },
];

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
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "H1", TickMarkType.Time, "utc-offset:120", 3 * 60 * 60)).toBe("20:00");
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
    const formatters = getChartTimeFormatters("M15", "server", 3 * 60 * 60);
    expect(formatters.tickMarkFormatter(SAMPLE_CANDLE.time, TickMarkType.Time)).toBe("21:00");
    expect(formatters.timeFormatter(SAMPLE_CANDLE.time)).toBe("19 Feb 2026 21:00 MT5/Server");

    const viewerFormatters = getChartTimeFormatters("M15", "utc-offset:420", 3 * 60 * 60);
    expect(viewerFormatters.tickMarkFormatter(SAMPLE_CANDLE.time, TickMarkType.Time)).toBe("01:00");
  });

  it("normalizes chart preferences and falls back safely without browser storage", () => {
    expect(loadChartPreferences()).toEqual(DEFAULT_CHART_PREFERENCES);
    expect(
      normalizeChartPreferences({
        cursorReadoutMode: "nearest_candle",
        appearance: {
          backgroundColor: "#101010",
          gridColor: "#202020",
          textColor: "#303030",
          bullishColor: "#00ff00",
          bearishColor: "nope",
          gridVisible: false,
          wickMode: "neutral",
        },
      }),
    ).toMatchObject({
      cursorReadoutMode: "nearest_candle",
      appearance: {
        backgroundColor: "#101010",
        gridColor: "#202020",
        textColor: "#303030",
        bullishColor: "#00ff00",
        bearishColor: DEFAULT_CHART_PREFERENCES.appearance.bearishColor,
        gridVisible: false,
        wickMode: "neutral",
      },
    });
    expect(
      normalizeChartPreferences({
        cursorReadoutMode: "true_cursor",
        eventOverlay: {
          visible: false,
          scope: "high_impact",
          impactFilter: "all",
          maxMarkers: 80,
        },
        appearance: {
          bullishColor: "#00ff00",
        },
      }),
    ).toMatchObject({
      cursorReadoutMode: "both",
      eventOverlay: {
        visible: false,
        scope: "all",
        impactFilter: "all",
        maxMarkers: 80,
      },
      appearance: {
        backgroundColor: DEFAULT_CHART_PREFERENCES.appearance.backgroundColor,
        gridColor: DEFAULT_CHART_PREFERENCES.appearance.gridColor,
        textColor: DEFAULT_CHART_PREFERENCES.appearance.textColor,
      },
    });
    expect(normalizeChartPreferences({ cursorReadoutMode: "both" }).eventOverlay).toEqual(
      DEFAULT_CHART_PREFERENCES.eventOverlay,
    );
  });

  it("filters chart event overlays by selected symbol and scope", () => {
    expect(getChartEventRelevantCurrencies("EURUSD")).toEqual(["EUR", "USD"]);
    expect(getChartEventRelevantCurrencies("XAUUSD")).toEqual(["USD"]);

    expect(
      filterChartEventsForOverlay({
        events: CALENDAR_EVENTS,
        selectedSymbol: "EURUSD",
        scope: "relevant",
        impactFilter: "high",
        sourceTimeOffsetSeconds: 0,
      }).map((candidate) => candidate.event.currency),
    ).toEqual(["USD"]);

    expect(
      filterChartEventsForOverlay({
        events: CALENDAR_EVENTS,
        selectedSymbol: "EURUSD",
        scope: "relevant",
        impactFilter: "high_medium",
        sourceTimeOffsetSeconds: 0,
      }).map((candidate) => candidate.event.currency),
    ).toEqual(["USD", "EUR"]);

    expect(
      filterChartEventsForOverlay({
        events: CALENDAR_EVENTS,
        selectedSymbol: "EURUSD",
        scope: "all",
        impactFilter: "all",
        sourceTimeOffsetSeconds: 0,
      }).map((candidate) => candidate.event.currency),
    ).toEqual(["USD", "EUR", "JPY"]);
  });

  it("maps calendar event timestamps into chart coordinates without losing display truth", () => {
    expect(getChartEventCoordinateTime(SAMPLE_CANDLE.time, 3 * 60 * 60)).toBe(SAMPLE_CANDLE.time + 3 * 60 * 60);
    expect(formatChartEventDisplayTime(SAMPLE_CANDLE.time, "utc-offset:420", 3 * 60 * 60)).toBe(
      formatDateTimeForDisplayTimezone(SAMPLE_CANDLE.time, "utc-offset:420"),
    );
    expect(formatChartEventDisplayTime(SAMPLE_CANDLE.time, "server", 3 * 60 * 60)).toBe(
      formatDateTimeForDisplayTimezone(SAMPLE_CANDLE.time + 3 * 60 * 60, "server"),
    );
    expect(
      getChartEventAnchorTime(
        SAMPLE_CANDLE.time + 60 * 60,
        [SAMPLE_CANDLE, { ...SAMPLE_CANDLE, time: SAMPLE_CANDLE.time + 24 * 60 * 60 }],
        "D1",
      ),
    ).toBe(SAMPLE_CANDLE.time);
  });

  it("formats cursor readout labels for all supported modes", () => {
    expect(formatCursorReadout({ mode: "true_cursor", truePrice: 1.23456, candlePrice: 1.2, precision: 4 })).toEqual([
      { label: "Crosshair", value: "1.2346" },
    ]);
    expect(formatCursorReadout({ mode: "nearest_candle", truePrice: 1.23456, candlePrice: 1.2, precision: 4 })).toEqual([
      { label: "Sticky", value: "1.2000" },
    ]);
    expect(formatCursorReadout({ mode: "both", truePrice: 1.23456, candlePrice: 1.2, precision: 2 })).toEqual([
      { label: "Crosshair", value: "1.23" },
      { label: "Sticky", value: "1.20" },
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
    expect(formatChartFeedTime(SAMPLE_CANDLE.time, "server", 3 * 60 * 60)).toBe("19 Feb 2026 21:00");
    expect(formatChartHoverTime(SAMPLE_CANDLE.time, "utc-offset:345", 3 * 60 * 60)).toBe(
      `19 Feb 2026 23:45 ${formatUtcOffsetLabel(345)}`,
    );
    expect(
      getChartSourceTimeOffsetSeconds(
        marketStatus({
          checked_at: SAMPLE_CANDLE.time,
          server_time: SAMPLE_CANDLE.time + 3 * 60 * 60 + 20,
        }),
      ),
    ).toBe(3 * 60 * 60);
    expect(
      getChartSourceTimeOffsetSeconds(
        marketStatus({
          checked_at: SAMPLE_CANDLE.time,
          server_time: SAMPLE_CANDLE.time + 24 * 60 * 60,
        }),
      ),
    ).toBe(0);
    expect(getChartSourceTimeOffsetSeconds(null)).toBe(0);
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
