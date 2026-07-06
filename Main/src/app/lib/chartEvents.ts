import { FX_PAIRS, MAJOR_CURRENCY_ORDER, getFxPairByName } from "@/app/config/fxPairs";
import { formatDateTimeForDisplayTimezone } from "@/app/lib/timezoneDisplay";
import type { ChartDisplayTimeMode, ChartEventOverlayScope } from "@/app/lib/chartView";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";

const NON_INTRADAY_TIMEFRAMES = new Set<Timeframe>(["D1", "W1", "MN1"]);
const MAJOR_CURRENCIES = new Set<string>(MAJOR_CURRENCY_ORDER);

export interface ChartEventCandidate {
  event: CalendarEvent;
  chartTime: number;
}

export function getChartEventKey(event: Pick<CalendarEvent, "id" | "time" | "currency" | "title">): string {
  return `${event.id}:${event.time}:${event.currency}:${event.title}`;
}

function normalizeSymbolToken(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z]/g, "");
}

export function getChartEventRelevantCurrencies(symbol: string): string[] {
  const normalized = normalizeSymbolToken(symbol);
  const directPair = getFxPairByName(symbol.toUpperCase());
  const inferredPair = directPair ?? FX_PAIRS.find((pair) => normalized.startsWith(pair.name)) ?? null;

  if (inferredPair) {
    return Array.from(new Set([inferredPair.base, inferredPair.quote]));
  }

  if (normalized.startsWith("XAUUSD")) return ["USD"];

  const base = normalized.slice(0, 3);
  const quote = normalized.slice(3, 6);
  if (MAJOR_CURRENCIES.has(base) && MAJOR_CURRENCIES.has(quote)) {
    return Array.from(new Set([base, quote]));
  }

  return [];
}

export function getChartEventCoordinateTime(eventTime: number, sourceTimeOffsetSeconds: number): number {
  return eventTime + sourceTimeOffsetSeconds;
}

export function formatChartEventDisplayTime(
  eventTime: number,
  mode: ChartDisplayTimeMode,
  sourceTimeOffsetSeconds: number,
): string {
  const timestamp = mode === "server" ? getChartEventCoordinateTime(eventTime, sourceTimeOffsetSeconds) : eventTime;
  return formatDateTimeForDisplayTimezone(timestamp, mode);
}

export function isChartEventTimeframeIntraday(timeframe: Timeframe): boolean {
  return !NON_INTRADAY_TIMEFRAMES.has(timeframe);
}

export function getChartEventAnchorTime(
  chartTime: number,
  candles: BridgeCandle[],
  timeframe: Timeframe,
): number | null {
  if (candles.length === 0) return chartTime;
  if (isChartEventTimeframeIntraday(timeframe)) return chartTime;

  let previous: BridgeCandle | null = null;
  for (const candle of candles) {
    if (candle.time > chartTime) break;
    previous = candle;
  }

  return previous?.time ?? candles[0]?.time ?? null;
}

export function filterChartEventsForOverlay({
  events,
  selectedSymbol,
  scope,
  sourceTimeOffsetSeconds,
}: {
  events: CalendarEvent[];
  selectedSymbol: string;
  scope: ChartEventOverlayScope;
  sourceTimeOffsetSeconds: number;
}): ChartEventCandidate[] {
  const relevantCurrencies = new Set(getChartEventRelevantCurrencies(selectedSymbol));

  return events
    .filter((event) => {
      if (!Number.isFinite(event.time)) return false;
      if (scope === "all") return true;
      if (scope === "high_impact") return event.impact === "high";
      return relevantCurrencies.has(event.currency) && (event.impact === "high" || event.impact === "medium");
    })
    .map((event) => ({
      event,
      chartTime: getChartEventCoordinateTime(event.time, sourceTimeOffsetSeconds),
    }))
    .sort((left, right) => left.chartTime - right.chartTime);
}
