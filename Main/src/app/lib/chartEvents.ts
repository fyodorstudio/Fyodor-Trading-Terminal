import { FX_PAIRS, MAJOR_CURRENCY_ORDER, getFxPairByName } from "@/app/config/fxPairs";
import { formatDateTimeForDisplayTimezone } from "@/app/lib/timezoneDisplay";
import type { ChartDisplayTimeMode, ChartEventOverlayImpactFilter, ChartEventOverlayScope } from "@/app/lib/chartView";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";

const NON_INTRADAY_TIMEFRAMES = new Set<Timeframe>(["D1", "W1", "MN1"]);
const MAJOR_CURRENCIES = new Set<string>(MAJOR_CURRENCY_ORDER);

export interface ChartEventCandidate {
  event: CalendarEvent;
  chartTime: number;
  isFuture: boolean;
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
  impactFilter,
  sourceTimeOffsetSeconds,
  latestCandleTime,
}: {
  events: CalendarEvent[];
  selectedSymbol: string;
  scope: ChartEventOverlayScope;
  impactFilter: ChartEventOverlayImpactFilter;
  sourceTimeOffsetSeconds: number;
  latestCandleTime?: number | null;
}): ChartEventCandidate[] {
  const relevantCurrencies = new Set(getChartEventRelevantCurrencies(selectedSymbol));
  const latestTime = latestCandleTime ?? Number.POSITIVE_INFINITY;

  return events
    .filter((event) => {
      if (!Number.isFinite(event.time)) return false;
      if (scope === "relevant" && !relevantCurrencies.has(event.currency)) return false;
      if (impactFilter === "all") return true;
      if (impactFilter === "high_medium") return event.impact === "high" || event.impact === "medium";
      return event.impact === "high";
    })
    .map((event) => ({
      event,
      chartTime: getChartEventCoordinateTime(event.time, sourceTimeOffsetSeconds),
      isFuture: event.time > latestTime,
    }))
    .sort((left, right) => left.chartTime - right.chartTime);
}

function lowerBoundByChartTime(candidates: ChartEventCandidate[], target: number): number {
  let low = 0;
  let high = candidates.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (candidates[mid].chartTime < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function upperBoundByChartTime(candidates: ChartEventCandidate[], target: number): number {
  let low = 0;
  let high = candidates.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (candidates[mid].chartTime <= target) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function sliceChartEventsByTime(
  candidates: ChartEventCandidate[],
  from: number,
  to: number,
): ChartEventCandidate[] {
  if (candidates.length === 0 || to < from) return [];
  return candidates.slice(lowerBoundByChartTime(candidates, from), upperBoundByChartTime(candidates, to));
}

export function getFutureChartEventTimes(
  candidates: ChartEventCandidate[],
  latestCandleTime: number | null,
  maxEvents = 8,
): number[] {
  if (latestCandleTime == null || maxEvents <= 0) return [];
  const times: number[] = [];
  const seen = new Set<number>();

  for (const candidate of candidates) {
    if (times.length >= maxEvents) break;
    if (!candidate.isFuture) continue;
    const time = candidate.chartTime;
    if (seen.has(time)) continue;
    seen.add(time);
    times.push(time);
  }

  return times;
}
