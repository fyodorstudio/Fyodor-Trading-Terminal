import { TickMarkType } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import {
  formatChartAxisTime,
  formatChartFeedTime,
  formatChartHoverTime,
  getChartDisplayCandles,
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
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "H1", TickMarkType.Time, "utc-offset:120")).toBe("23:00");
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
