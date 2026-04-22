import { TickMarkType } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import {
  formatChartAxisTime,
  formatChartFeedTime,
  formatChartHoverTime,
  getChartDisplayCandles,
  getChartSessionDetail,
} from "@/app/lib/chartView";
import { formatLocalDateTime, getLocalTimezoneLabel } from "@/app/lib/format";
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
  it("keeps server timestamps unchanged and shifts local display timestamps", () => {
    const server = getChartDisplayCandles([SAMPLE_CANDLE], "server");
    const local = getChartDisplayCandles([SAMPLE_CANDLE], "local");
    const localDate = new Date(SAMPLE_CANDLE.time * 1000);
    const expectedLocalTime =
      Date.UTC(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate(),
        localDate.getHours(),
        localDate.getMinutes(),
        localDate.getSeconds(),
        localDate.getMilliseconds(),
      ) / 1000;

    expect(server[0]?.time).toBe(SAMPLE_CANDLE.time);
    expect(local[0]?.time).toBe(expectedLocalTime);
  });

  it("formats x-axis labels by tick mark type instead of forcing clock labels", () => {
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "H1", TickMarkType.Time)).toBe("21:00");
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "H4", TickMarkType.DayOfMonth)).toBe("19 Feb");
    expect(formatChartAxisTime(SAMPLE_CANDLE.time, "W1", TickMarkType.Month)).toBe("Feb 26");
  });

  it("formats hover and feed labels for both server and local time modes", () => {
    expect(formatChartFeedTime(SAMPLE_CANDLE.time, "server")).toBe("19 Feb 2026 21:00");
    expect(formatChartHoverTime(SAMPLE_CANDLE.time, "server")).toBe("19 Feb 2026 21:00 UTC");
    expect(formatChartFeedTime(SAMPLE_CANDLE.time, "local")).toBe(formatLocalDateTime(SAMPLE_CANDLE.time));
    expect(formatChartHoverTime(getChartDisplayCandles([SAMPLE_CANDLE], "local")[0]!.time as number, "local")).toBe(
      `${formatLocalDateTime(SAMPLE_CANDLE.time)} ${getLocalTimezoneLabel()}`,
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
