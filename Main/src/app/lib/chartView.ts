import { TickMarkType, type CandlestickData, type Time, type UTCTimestamp } from "lightweight-charts";
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
export type ChartCursorReadoutMode = "both" | "true_cursor" | "nearest_candle";
export type ChartWickMode = "match" | "neutral";

export interface ChartAppearancePreferences {
  bullishColor: string;
  bearishColor: string;
  neutralWickColor: string;
  crosshairColor: string;
  currentPriceLineColor: string;
  gridVisible: boolean;
  wickMode: ChartWickMode;
}

export interface ChartPreferences {
  version: number;
  cursorReadoutMode: ChartCursorReadoutMode;
  appearance: ChartAppearancePreferences;
}

export interface HistoryCacheEntry {
  version: number;
  candles: BridgeCandle[];
}

export interface ChartCacheSummary {
  count: number;
  oldestTime: number | null;
  latestTime: number | null;
}

export interface CursorReadoutInput {
  mode: ChartCursorReadoutMode;
  truePrice: number | null;
  candlePrice: number | null;
  precision: number;
}

export interface CursorReadoutLine {
  label: string;
  value: string;
}

export interface ChartSessionDetail {
  label: string;
  basis: string;
}

const CHART_DISPLAY_TIME_KEY = "fyodor-main-chart-display-timezone";
export const CHART_PREFERENCES_VERSION = 1;
const CHART_PREFERENCES_KEY = `fyodor-main-chart-preferences-v${CHART_PREFERENCES_VERSION}`;
const INTRADAY_TIMEFRAMES = new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4"]);

export const DEFAULT_CHART_PREFERENCES: ChartPreferences = {
  version: CHART_PREFERENCES_VERSION,
  cursorReadoutMode: "both",
  appearance: {
    bullishColor: "#10b981",
    bearishColor: "#ef4444",
    neutralWickColor: "#475569",
    crosshairColor: "#1e293b",
    currentPriceLineColor: "#ef4444",
    gridVisible: true,
    wickMode: "match",
  },
};

export function loadChartDisplayTimeMode(): ChartDisplayTimeMode {
  return loadDisplayTimezoneSelection(CHART_DISPLAY_TIME_KEY, "local");
}

export function saveChartDisplayTimeMode(mode: ChartDisplayTimeMode) {
  saveDisplayTimezoneSelection(CHART_DISPLAY_TIME_KEY, mode);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeChartAppearance(raw: unknown): ChartAppearancePreferences {
  const fallback = DEFAULT_CHART_PREFERENCES.appearance;
  if (!raw || typeof raw !== "object") return fallback;
  const row = raw as Record<string, unknown>;

  return {
    bullishColor: isHexColor(row.bullishColor) ? row.bullishColor : fallback.bullishColor,
    bearishColor: isHexColor(row.bearishColor) ? row.bearishColor : fallback.bearishColor,
    neutralWickColor: isHexColor(row.neutralWickColor) ? row.neutralWickColor : fallback.neutralWickColor,
    crosshairColor: isHexColor(row.crosshairColor) ? row.crosshairColor : fallback.crosshairColor,
    currentPriceLineColor: isHexColor(row.currentPriceLineColor)
      ? row.currentPriceLineColor
      : fallback.currentPriceLineColor,
    gridVisible: typeof row.gridVisible === "boolean" ? row.gridVisible : fallback.gridVisible,
    wickMode: row.wickMode === "neutral" || row.wickMode === "match" ? row.wickMode : fallback.wickMode,
  };
}

export function normalizeChartPreferences(raw: unknown): ChartPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_CHART_PREFERENCES;
  const row = raw as Record<string, unknown>;
  const mode = row.cursorReadoutMode;

  return {
    version: CHART_PREFERENCES_VERSION,
    cursorReadoutMode:
      mode === "true_cursor" || mode === "nearest_candle" || mode === "both"
        ? mode
        : DEFAULT_CHART_PREFERENCES.cursorReadoutMode,
    appearance: normalizeChartAppearance(row.appearance),
  };
}

export function loadChartPreferences(): ChartPreferences {
  if (typeof window === "undefined") return DEFAULT_CHART_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(CHART_PREFERENCES_KEY);
    return raw ? normalizeChartPreferences(JSON.parse(raw) as unknown) : DEFAULT_CHART_PREFERENCES;
  } catch {
    return DEFAULT_CHART_PREFERENCES;
  }
}

export function saveChartPreferences(preferences: ChartPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHART_PREFERENCES_KEY, JSON.stringify(normalizeChartPreferences(preferences)));
  } catch {
    // ignore storage failures
  }
}

function toChartTime(time: number): UTCTimestamp {
  return time as UTCTimestamp;
}

export function getChartDisplayCandles(candles: BridgeCandle[]): CandlestickData<Time>[] {
  return candles.map((candle) => ({
    time: toChartTime(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function normalizeCandle(raw: unknown): BridgeCandle | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const time = typeof row.time === "number" && Number.isFinite(row.time) ? row.time : null;
  const open = typeof row.open === "number" && Number.isFinite(row.open) ? row.open : null;
  const high = typeof row.high === "number" && Number.isFinite(row.high) ? row.high : null;
  const low = typeof row.low === "number" && Number.isFinite(row.low) ? row.low : null;
  const close = typeof row.close === "number" && Number.isFinite(row.close) ? row.close : null;
  const volume = typeof row.volume === "number" && Number.isFinite(row.volume) ? row.volume : 0;
  if ([time, open, high, low, close].some((value) => value == null)) return null;
  if ((high as number) < (low as number)) return null;
  return { time: time as number, open: open as number, high: high as number, low: low as number, close: close as number, volume };
}

export function validateAndSortCandles(rawCandles: unknown[], maxCandles = 5000): BridgeCandle[] {
  const byTime = new Map<number, BridgeCandle>();
  rawCandles.forEach((raw) => {
    const candle = normalizeCandle(raw);
    if (candle) byTime.set(candle.time, candle);
  });
  return Array.from(byTime.values())
    .sort((left, right) => left.time - right.time)
    .slice(-maxCandles);
}

export function normalizeHistoryCacheEntry(raw: unknown, maxCandles = 5000): HistoryCacheEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.version !== 1 || !Array.isArray(row.candles)) return null;
  const candles = validateAndSortCandles(row.candles, maxCandles);
  return candles.length > 0 ? { version: 1, candles } : null;
}

export function mergeChartCandles(left: BridgeCandle[], right: BridgeCandle[], maxCandles = 5000): BridgeCandle[] {
  return validateAndSortCandles([...left, ...right], maxCandles);
}

export function summarizeChartCache(candles: BridgeCandle[]): ChartCacheSummary {
  return {
    count: candles.length,
    oldestTime: candles[0]?.time ?? null,
    latestTime: candles[candles.length - 1]?.time ?? null,
  };
}

export function formatCursorReadout(input: CursorReadoutInput): CursorReadoutLine[] {
  const formatPrice = (price: number) => price.toFixed(input.precision);
  const lines: CursorReadoutLine[] = [];

  if ((input.mode === "both" || input.mode === "true_cursor") && input.truePrice != null) {
    lines.push({ label: "Cursor", value: formatPrice(input.truePrice) });
  }

  if ((input.mode === "both" || input.mode === "nearest_candle") && input.candlePrice != null) {
    lines.push({ label: "Candle", value: formatPrice(input.candlePrice) });
  }

  return lines;
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

export function normalizeChartTimestampSeconds(
  time: unknown,
): number | null {
  if (typeof time === "number" && Number.isFinite(time)) {
    return time;
  }

  if (typeof time === "string") {
    const parsed = Number(time);
    if (Number.isFinite(parsed)) return parsed;
    const date = new Date(time);
    return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
  }

  if (time && typeof time === "object") {
    const row = time as Record<string, unknown>;
    const year = typeof row.year === "number" ? row.year : null;
    const month = typeof row.month === "number" ? row.month : null;
    const day = typeof row.day === "number" ? row.day : null;
    if (year != null && month != null && day != null) {
      return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0) / 1000);
    }
  }

  return null;
}

export function formatChartAxisTime(
  chartTime: unknown,
  timeframe: Timeframe,
  tickMarkType: TickMarkType,
  mode: ChartDisplayTimeMode,
): string {
  const timestampSeconds = normalizeChartTimestampSeconds(chartTime);
  if (timestampSeconds == null) return "";

  const intraday = INTRADAY_TIMEFRAMES.has(timeframe);

  if (intraday && tickMarkType === TickMarkType.Time) {
    return formatTimeForDisplayTimezone(timestampSeconds, mode);
  }
  if (intraday && tickMarkType === TickMarkType.TimeWithSeconds) {
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

  if (!intraday) {
    return formatDayMonthForDisplayTimezone(timestampSeconds, mode);
  }

  return formatDateTimeForDisplayTimezone(timestampSeconds, mode);
}

export function getChartTimeFormatters(timeframe: Timeframe, mode: ChartDisplayTimeMode) {
  return {
    tickMarkFormatter: (time: unknown, tickMarkType?: TickMarkType) =>
      formatChartAxisTime(time, timeframe, tickMarkType ?? TickMarkType.Time, mode),
    timeFormatter: (time: unknown) => {
      const timestampSeconds = normalizeChartTimestampSeconds(time);
      return timestampSeconds == null ? "" : formatChartHoverTime(timestampSeconds, mode);
    },
  };
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
