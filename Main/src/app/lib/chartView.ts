import { TickMarkType, type CandlestickData } from "lightweight-charts";
import { formatCountdown } from "@/app/lib/format";
import {
  formatDateTimeForDisplayTimezone,
  formatDayMonthForDisplayTimezone,
  formatHoverTimezoneSuffix,
  formatMonthYearForDisplayTimezone,
  formatTimeForDisplayTimezone,
  formatYearForDisplayTimezone,
  loadDisplayTimezoneSelection,
  saveDisplayTimezoneSelection,
  type DisplayTimezoneSelection,
} from "@/app/lib/timezoneDisplay";
import type { BridgeCandle, MarketStatusResponse, Timeframe } from "@/app/types";

export type ChartDisplayTimeMode = DisplayTimezoneSelection;

export interface ChartSessionDetail {
  label: string;
  basis: string;
}

const CHART_DISPLAY_TIME_KEY = "fyodor-main-chart-display-timezone";

export function loadChartDisplayTimeMode(): ChartDisplayTimeMode {
  return loadDisplayTimezoneSelection(CHART_DISPLAY_TIME_KEY, "local");
}

export function saveChartDisplayTimeMode(mode: ChartDisplayTimeMode) {
  saveDisplayTimezoneSelection(CHART_DISPLAY_TIME_KEY, mode);
}

export function getChartDisplayCandles(candles: BridgeCandle[]): CandlestickData[] {
  return candles.map((candle) => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

export function formatChartHoverTime(timestampSeconds: number, mode: ChartDisplayTimeMode): string {
  return `${formatDateTimeForDisplayTimezone(timestampSeconds, mode)} ${formatHoverTimezoneSuffix(mode)}`;
}

export function formatChartFeedTime(timestampSeconds: number, mode: ChartDisplayTimeMode): string {
  return formatDateTimeForDisplayTimezone(timestampSeconds, mode);
}

export function getChartDisplayModeLabel(mode: ChartDisplayTimeMode): string {
  if (mode === "local") return "LOCAL TIME";
  if (mode === "server") return "MT5 / SERVER";
  return formatHoverTimezoneSuffix(mode);
}

export function formatChartAxisTime(
  timestampSeconds: number,
  _timeframe: Timeframe,
  tickMarkType: TickMarkType,
  mode: ChartDisplayTimeMode,
): string | null {
  if (tickMarkType === TickMarkType.Time) {
    return formatTimeForDisplayTimezone(timestampSeconds, mode);
  }
  if (tickMarkType === TickMarkType.TimeWithSeconds) {
    return formatTimeForDisplayTimezone(timestampSeconds, mode, true);
  }
  if (tickMarkType === TickMarkType.DayOfMonth) {
    return formatDayMonthForDisplayTimezone(timestampSeconds, mode);
  }
  if (tickMarkType === TickMarkType.Month) {
    return formatMonthYearForDisplayTimezone(timestampSeconds, mode);
  }
  if (tickMarkType === TickMarkType.Year) {
    return formatYearForDisplayTimezone(timestampSeconds, mode);
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
