import { TickMarkType, type CandlestickData } from "lightweight-charts";
import { formatCountdown, formatLocalDateTime, formatUtcDateTime, getLocalTimezoneLabel, pad } from "@/app/lib/format";
import type { BridgeCandle, MarketStatusResponse, Timeframe } from "@/app/types";

export type ChartDisplayTimeMode = "server" | "local";

export interface ChartSessionDetail {
  label: string;
  basis: string;
}

const CHART_DISPLAY_TIME_KEY = "fyodor-main-chart-display-time";

function toLocalDisplayTimestamp(timestampSeconds: number): number {
  const date = new Date(timestampSeconds * 1000);
  return (
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ) / 1000
  );
}

function shortMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
}

function shortDayMonthLabel(date: Date): string {
  return `${pad(date.getUTCDate())} ${shortMonthLabel(date)}`;
}

function shortMonthYearLabel(date: Date): string {
  return `${shortMonthLabel(date)} ${String(date.getUTCFullYear()).slice(-2)}`;
}

function formatDisplayUtcDateTime(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const day = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function loadChartDisplayTimeMode(): ChartDisplayTimeMode {
  if (typeof window === "undefined") return "server";
  const saved = window.localStorage.getItem(CHART_DISPLAY_TIME_KEY);
  return saved === "local" ? "local" : "server";
}

export function saveChartDisplayTimeMode(mode: ChartDisplayTimeMode) {
  try {
    window.localStorage.setItem(CHART_DISPLAY_TIME_KEY, mode);
  } catch {
    // ignore storage failures
  }
}

export function getChartDisplayTimestamp(timestampSeconds: number, mode: ChartDisplayTimeMode): number {
  return mode === "local" ? toLocalDisplayTimestamp(timestampSeconds) : timestampSeconds;
}

export function getChartDisplayCandles(
  candles: BridgeCandle[],
  mode: ChartDisplayTimeMode,
): CandlestickData[] {
  return candles.map((candle) => ({
    time: getChartDisplayTimestamp(candle.time, mode),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

export function formatChartHoverTime(timestampSeconds: number, mode: ChartDisplayTimeMode): string {
  if (mode === "local") {
    return `${formatDisplayUtcDateTime(timestampSeconds)} ${getLocalTimezoneLabel()}`;
  }
  return `${formatUtcDateTime(timestampSeconds)} UTC`;
}

export function formatChartFeedTime(timestampSeconds: number, mode: ChartDisplayTimeMode): string {
  return mode === "local" ? formatLocalDateTime(timestampSeconds) : formatUtcDateTime(timestampSeconds);
}

export function getChartDisplayModeLabel(mode: ChartDisplayTimeMode): string {
  return mode === "local" ? "LOCAL TIME" : "SERVER/MT5 TIME";
}

export function formatChartAxisTime(
  timestampSeconds: number,
  _timeframe: Timeframe,
  tickMarkType: TickMarkType,
): string | null {
  const date = new Date(timestampSeconds * 1000);
  if (tickMarkType === TickMarkType.Time) {
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }
  if (tickMarkType === TickMarkType.TimeWithSeconds) {
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  }
  if (tickMarkType === TickMarkType.DayOfMonth) {
    return shortDayMonthLabel(date);
  }
  if (tickMarkType === TickMarkType.Month) {
    return shortMonthYearLabel(date);
  }
  if (tickMarkType === TickMarkType.Year) {
    return String(date.getUTCFullYear());
  }
  return null;
}

export function getChartSessionDetail(
  marketStatus: MarketStatusResponse | null,
  nowMs = Date.now(),
): ChartSessionDetail {
  if (!marketStatus || marketStatus.session_state === "unavailable") {
    return {
      label: "Session unavailable",
      basis: "The bridge cannot resolve a reliable session window for this symbol right now.",
    };
  }

  if (marketStatus.asset_class === "forex" || marketStatus.asset_class === "metals") {
    if (marketStatus.session_state === "open") {
      return {
        label: `Scheduled session closes in ${formatCountdown(marketStatus.next_close_time, nowMs)}`,
        basis: "Rule-based forex/metals session window from the MT5 bridge. This is schedule-derived, not broker-specific micro-session detection.",
      };
    }
    return {
      label: `Scheduled session opens in ${formatCountdown(marketStatus.next_open_time, nowMs)}`,
      basis: "Rule-based forex/metals session window from the MT5 bridge. Weekend handling is grounded; broker-specific exceptions are not.",
    };
  }

  if (marketStatus.asset_class === "crypto") {
    return {
      label: `Daily rollover in ${formatCountdown(marketStatus.next_close_time, nowMs)}`,
      basis: "Crypto is treated as always-on and the bridge exposes the next daily UTC rollover boundary as a timing reference.",
    };
  }

  return {
    label: "Session unavailable",
    basis:
      marketStatus.reason === "session_unknown"
        ? "This asset class is inferred from tick freshness only, so the app is intentionally not presenting a precise open/close countdown."
        : "The bridge does not expose a reliable scheduled session countdown for this asset class.",
  };
}
