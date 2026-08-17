import { FX_PAIRS } from "@/app/config/fxPairs";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";

export type PairMatrixFactorId = "policy" | "inflation" | "labor" | "retail" | "pmi" | "sentiment" | "trade" | "other";

export interface PairMatrixFactorDefinition {
  id: PairMatrixFactorId;
  label: string;
  helpText: string;
  includeAny: string[];
  excludeAny?: string[];
}

export interface PairMatrixDeltaRead {
  label: string;
  title: string;
  available: boolean;
}

export interface PairMatrixSeriesSnapshot {
  seriesKey: string;
  factor: PairMatrixFactorDefinition;
  event: CalendarEvent;
  actualLabel: string;
  forecastLabel: string;
  previousLabel: string;
  surprise: PairMatrixDeltaRead;
  momentum: PairMatrixDeltaRead;
}

export interface PairMatrixCurrencyTimeline {
  currency: string;
  entries: PairMatrixSeriesSnapshot[];
}

export interface PairMatrixTimelineSnapshot {
  during: PairMatrixCurrencyTimeline[];
  before: PairMatrixCurrencyTimeline[];
}

export interface PairMatrixCandleRange {
  firstOpen: number;
  lastOpen: number;
  close: number;
  candleCount: number;
}

export interface PairMatrixTimeInterval {
  from: number;
  toExclusive: number;
}

export interface PairMatrixRangePixelBounds {
  left: number;
  right: number;
}

export const PAIR_MATRIX_BEFORE_DEFAULT_DAYS = 90;
export const PAIR_MATRIX_BEFORE_MAX_DAYS = 400;
export const PAIR_MATRIX_BEFORE_STORAGE_KEY = "fyodor_pair_matrix_before_days_v1";

export const PAIR_MATRIX_FACTORS: PairMatrixFactorDefinition[] = [
  {
    id: "policy",
    label: "Policy rate",
    helpText: "S compares the announced rate with forecast; M compares it with the previous rate. These values do not capture statement guidance, voting detail, or the expected future rate path.",
    includeAny: ["interest rate decision", "rate decision", "official cash rate", "cash rate", "bank rate", "refinancing rate", "deposit facility rate", "overnight rate", "policy rate", "federal funds rate"],
    excludeAny: ["minutes", "speech", "speaks", "testimony", "auction"],
  },
  {
    id: "inflation",
    label: "Inflation",
    helpText: "CPI, PCE, and producer-price releases describe inflation at different stages. S shows hotter or cooler inflation versus forecast and M shows change from the previous reading. Hotter inflation is not automatically currency-positive; its effect depends on policy expectations, growth, and what price already reflects.",
    includeAny: ["core cpi", "cpi", "hicp", "cpih", "consumer price", "core pce", "pce price", "inflation rate", "ppi", "producer price"],
    excludeAny: ["import price", "export price", "expectation", "expected inflation"],
  },
  {
    id: "labor",
    label: "Labor",
    helpText: "Read each exact labor series on its own terms. Higher employment or wages and lower unemployment or claims can indicate firmer conditions, but Pair Matrix does not convert them into a directional score.",
    includeAny: ["nonfarm payroll", "payroll employment", "employment change", "employment rate", "unemployment", "jobless claims", "initial claims", "continuing claims", "claimant count", "wage", "earnings", "labor cash earnings", "labour cash earnings"],
  },
  {
    id: "retail",
    label: "Retail sales",
    helpText: "Retail releases describe consumer-demand momentum. S is actual minus forecast and M is actual minus previous, with each exact broker series retained independently.",
    includeAny: ["retail sales", "retail control", "electronic card retail", "consumer spending", "card spending"],
  },
  {
    id: "pmi",
    label: "PMI / activity",
    helpText: "GDP measures realized economic output, while PMI and ISM are activity surveys with their own scales. Treat each exact series independently; S and M remain raw arithmetic rather than strength labels.",
    includeAny: ["gdp", "gross domestic product", "pmi", "purchasing managers index", "ism manufacturing", "ism services", "ism non-manufacturing"],
  },
  {
    id: "sentiment",
    label: "Sentiment",
    helpText: "Sentiment and confidence surveys use different scales. Compare each exact series with its own forecast and previous value; do not compare absolute levels across unlike surveys.",
    includeAny: ["consumer confidence", "consumer sentiment", "economic sentiment", "business confidence", "business climate", "confidence", "sentiment", "z wirtschaftliche", "zew economic sentiment", "ifo business climate"],
    excludeAny: ["inflation expectation"],
  },
  {
    id: "trade",
    label: "Trade / current account",
    helpText: "Trade and current-account series may use different currencies and magnitude scales. S and M preserve the loaded row's scale and do not normalize across countries.",
    includeAny: ["trade balance", "current account", "goods trade balance", "merchandise trade", "terms of trade"],
  },
];

export const PAIR_MATRIX_OTHER_FACTOR: PairMatrixFactorDefinition = {
  id: "other",
  label: "Other releases",
  helpText: "A loaded release for this pair's currencies that does not match one of the seven curated factors. Read its raw title and values on their own terms; Pair Matrix makes no directional interpretation.",
  includeAny: [],
};

const HISTORY_BUCKET_SECONDS = 90 * 24 * 60 * 60;
const FIXED_TIMEFRAME_SECONDS: Partial<Record<Timeframe, number>> = {
  M1: 60,
  M5: 5 * 60,
  M15: 15 * 60,
  M30: 30 * 60,
  H1: 60 * 60,
  H4: 4 * 60 * 60,
  D1: 24 * 60 * 60,
  W1: 7 * 24 * 60 * 60,
};

export function normalizePairMatrixSeriesTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function matchesFactor(event: CalendarEvent, factor: PairMatrixFactorDefinition): boolean {
  const title = normalizePairMatrixSeriesTitle(event.title);
  if (factor.excludeAny?.some((term) => title.includes(term))) return false;
  return factor.includeAny.some((term) => title.includes(term));
}

export function classifyPairMatrixEvent(event: CalendarEvent): PairMatrixFactorDefinition {
  return PAIR_MATRIX_FACTORS.find((factor) => matchesFactor(event, factor)) ?? PAIR_MATRIX_OTHER_FACTOR;
}

type ParsedSourceValue = {
  numeric: number;
  decimals: number;
  suffix: "percent" | "K" | "M" | "B" | "T" | null;
};

function parseSourceValue(raw: string): ParsedSourceValue | null {
  const normalized = raw.trim().replace(/,/g, "");
  const match = normalized.match(/^([+-]?\d+(?:\.(\d+))?)\s*(%|[kmbt])?$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  const suffixToken = match[3]?.toUpperCase() ?? null;
  return { numeric, decimals: match[2]?.length ?? 0, suffix: suffixToken === "%" ? "percent" : suffixToken as ParsedSourceValue["suffix"] };
}

export function comparePairMatrixSourceValues(leftRaw: string, rightRaw: string): -1 | 0 | 1 | null {
  const left = parseSourceValue(leftRaw);
  const right = parseSourceValue(rightRaw);
  if (!left || !right) return null;
  if (left.suffix && right.suffix && left.suffix !== right.suffix) return null;
  if (left.numeric === right.numeric) return 0;
  return left.numeric > right.numeric ? 1 : -1;
}

function titleHasExplicitPercentBasis(title: string): boolean {
  const normalized = normalizePairMatrixSeriesTitle(title);
  return /\b(m m|y y|q q|mom|yoy|qoq|annual rate|inflation rate|unemployment rate|employment rate)\b/.test(normalized)
    || ["interest rate decision", "rate decision", "official cash rate", "cash rate", "bank rate", "refinancing rate", "deposit facility rate", "overnight rate", "policy rate", "federal funds rate"].some((term) => normalized.includes(term));
}

function getSeriesUnit(title: string, values: Array<ParsedSourceValue | null>): ParsedSourceValue["suffix"] {
  const explicit = values.map((value) => value?.suffix ?? null).filter((suffix): suffix is NonNullable<ParsedSourceValue["suffix"]> => suffix != null);
  if (explicit.includes("percent")) return "percent";
  const distinct = Array.from(new Set(explicit));
  if (distinct.length === 1) return distinct[0];
  return titleHasExplicitPercentBasis(title) ? "percent" : null;
}

function formatSourceLabel(raw: string, parsed: ParsedSourceValue | null, unit: ParsedSourceValue["suffix"]): string {
  const trimmed = raw.trim();
  if (!trimmed) return "-";
  if (!parsed || parsed.suffix) return trimmed;
  return unit === "percent" ? `${trimmed}%` : trimmed;
}

function formatDeltaNumber(value: number, decimals: number): string {
  if (Math.abs(value) < 10 ** -(Math.max(0, decimals) + 2)) return "0";
  const magnitude = Math.abs(value).toFixed(Math.min(6, Math.max(0, decimals))).replace(/\.?0+$/, "");
  return `${value > 0 ? "+" : "-"}${magnitude}`;
}

function buildDeltaRead(params: {
  leftRaw: string;
  rightRaw: string;
  leftLabel: string;
  rightLabel: string;
  name: "Surprise" | "Momentum";
  unit: ParsedSourceValue["suffix"];
}): PairMatrixDeltaRead {
  const left = parseSourceValue(params.leftRaw);
  const right = parseSourceValue(params.rightRaw);
  const incompatibleExplicitUnits = left?.suffix && right?.suffix && left.suffix !== right.suffix;
  const previousWarning = params.name === "Momentum" ? " Broker Previous may already contain a revision." : "";
  if (!left || !right || incompatibleExplicitUnits) {
    return {
      label: "-",
      available: false,
      title: `${params.name} unavailable: ${params.leftLabel} ${params.leftRaw.trim() || "missing"} minus ${params.rightLabel} ${params.rightRaw.trim() || "missing"} cannot be calculated safely.${previousWarning}`,
    };
  }
  const delta = left.numeric - right.numeric;
  const suffix = params.unit === "percent" ? "pp" : params.unit ?? "";
  const label = `${formatDeltaNumber(delta, Math.max(left.decimals, right.decimals))}${suffix}`;
  const unitNote = params.unit === "percent"
    ? "Percentage basis is explicit in the source value or series title, so the difference is shown in percentage points."
    : params.unit
      ? `The source ${params.unit} scale is preserved.`
      : "No unit is inferred; the signed difference stays in the broker row's raw scale.";
  return { label, available: true, title: `${params.name}: ${params.leftLabel} ${params.leftRaw.trim()} - ${params.rightLabel} ${params.rightRaw.trim()} = ${label}. ${unitNote}${previousWarning}` };
}

export function buildPairMatrixSeriesSnapshot(event: CalendarEvent): PairMatrixSeriesSnapshot {
  const actual = parseSourceValue(event.actual);
  const forecast = parseSourceValue(event.forecast);
  const previous = parseSourceValue(event.previous);
  const unit = getSeriesUnit(event.title, [actual, forecast, previous]);
  return {
    seriesKey: `${event.currency}:${normalizePairMatrixSeriesTitle(event.title)}`,
    factor: classifyPairMatrixEvent(event),
    event,
    actualLabel: formatSourceLabel(event.actual, actual, unit),
    forecastLabel: formatSourceLabel(event.forecast, forecast, unit),
    previousLabel: formatSourceLabel(event.previous, previous, unit),
    surprise: buildDeltaRead({ leftRaw: event.actual, rightRaw: event.forecast, leftLabel: "Actual", rightLabel: "Forecast", name: "Surprise", unit }),
    momentum: buildDeltaRead({ leftRaw: event.actual, rightRaw: event.previous, leftLabel: "Actual", rightLabel: "Previous", name: "Momentum", unit }),
  };
}

function eventKey(event: CalendarEvent): string {
  return `${event.time}:${event.currency}:${normalizePairMatrixSeriesTitle(event.title)}`;
}

export function mergePairMatrixCalendarEvents(...groups: CalendarEvent[][]): CalendarEvent[] {
  const byKey = new Map<string, CalendarEvent>();
  groups.flat().forEach((event) => byKey.set(eventKey(event), event));
  return [...byKey.values()].sort((left, right) => left.time - right.time || left.title.localeCompare(right.title) || left.id - right.id);
}

export function getPairMatrixForexCurrencies(symbol: string): [string, string] | null {
  const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const pair = FX_PAIRS.find((candidate) => normalized.startsWith(candidate.name));
  return pair ? [pair.base, pair.quote] : null;
}

export function getPairMatrixCandleClose(openTime: number, timeframe: Timeframe): number {
  const fixedSeconds = FIXED_TIMEFRAME_SECONDS[timeframe];
  if (fixedSeconds) return openTime + fixedSeconds;
  const date = new Date(openTime * 1000);
  date.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

function nearestCandleIndex(candleTimes: number[], target: number): number {
  if (candleTimes.length === 0) return -1;
  let bestIndex = 0;
  let bestDistance = Math.abs(candleTimes[0] - target);
  for (let index = 1; index < candleTimes.length; index += 1) {
    const distance = Math.abs(candleTimes[index] - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function normalizePairMatrixCandleRange(candleTimes: number[], firstTarget: number, secondTarget: number, timeframe: Timeframe): PairMatrixCandleRange | null {
  const firstIndex = nearestCandleIndex(candleTimes, firstTarget);
  const secondIndex = nearestCandleIndex(candleTimes, secondTarget);
  if (firstIndex < 0 || secondIndex < 0) return null;
  const fromIndex = Math.min(firstIndex, secondIndex);
  const throughIndex = Math.max(firstIndex, secondIndex);
  return {
    firstOpen: candleTimes[fromIndex],
    lastOpen: candleTimes[throughIndex],
    close: getPairMatrixCandleClose(candleTimes[throughIndex], timeframe),
    candleCount: throughIndex - fromIndex + 1,
  };
}

export function remapPairMatrixTimeInterval(
  candleTimes: number[],
  interval: PairMatrixTimeInterval,
  timeframe: Timeframe,
): PairMatrixCandleRange | null {
  if (candleTimes.length === 0 || interval.toExclusive <= interval.from) return null;
  const included = candleTimes.filter((open) => (
    open < interval.toExclusive && getPairMatrixCandleClose(open, timeframe) > interval.from
  ));
  if (included.length === 0) return null;
  const firstOpen = included[0];
  const lastOpen = included[included.length - 1];
  return {
    firstOpen,
    lastOpen,
    close: getPairMatrixCandleClose(lastOpen, timeframe),
    candleCount: included.length,
  };
}

export function getPairMatrixRangePipMoveLabel(
  candles: readonly BridgeCandle[],
  range: PairMatrixCandleRange | null,
  quoteCurrency: string | null,
): string | null {
  if (!range || !quoteCurrency) return null;
  const first = candles.find((candle) => candle.time === range.firstOpen);
  const last = candles.find((candle) => candle.time === range.lastOpen);
  if (!first || !last) return null;
  const pipSize = quoteCurrency.toUpperCase() === "JPY" ? 0.01 : 0.0001;
  const pips = (last.close - first.open) / pipSize;
  if (!Number.isFinite(pips)) return null;
  const normalized = Math.abs(pips) < 0.05 ? 0 : pips;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(1)} pips`;
}

export function getPairMatrixRangePixelBounds(
  firstCandleCenter: number | null,
  lastCandleCenter: number | null,
  barSpacing: number,
  plotWidth: number,
): PairMatrixRangePixelBounds | null {
  if (firstCandleCenter == null || lastCandleCenter == null || !Number.isFinite(barSpacing) || !Number.isFinite(plotWidth) || plotWidth <= 0) return null;
  const halfSpacing = Math.max(1, barSpacing / 2);
  const rawLeft = Math.min(firstCandleCenter, lastCandleCenter) - halfSpacing;
  const rawRight = Math.max(firstCandleCenter, lastCandleCenter) + halfSpacing;
  const left = Math.max(0, Math.min(plotWidth, rawLeft));
  const right = Math.max(0, Math.min(plotWidth, rawRight));
  if (right <= left) return null;
  return { left, right };
}

export function normalizePairMatrixBeforeDays(value: unknown): number {
  if (value == null || (typeof value === "string" && value.trim() === "")) return PAIR_MATRIX_BEFORE_DEFAULT_DAYS;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return PAIR_MATRIX_BEFORE_DEFAULT_DAYS;
  return Math.min(PAIR_MATRIX_BEFORE_MAX_DAYS, Math.max(1, Math.round(numeric)));
}

export function loadPairMatrixBeforeDays(): number {
  if (typeof window === "undefined") return PAIR_MATRIX_BEFORE_DEFAULT_DAYS;
  try {
    return normalizePairMatrixBeforeDays(window.localStorage.getItem(PAIR_MATRIX_BEFORE_STORAGE_KEY));
  } catch {
    return PAIR_MATRIX_BEFORE_DEFAULT_DAYS;
  }
}

export function savePairMatrixBeforeDays(value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAIR_MATRIX_BEFORE_STORAGE_KEY, String(normalizePairMatrixBeforeDays(value)));
  } catch {
    // Storage can be unavailable in restricted browser contexts; the in-memory value still works.
  }
}

export function getPairMatrixTimelineWindow(rangeOpen: number, rangeClose: number, lookbackDays: number): { bucketStart: number; from: number; to: number } {
  const desiredFrom = Math.max(0, rangeOpen - normalizePairMatrixBeforeDays(lookbackDays) * 24 * 60 * 60);
  const bucketStart = Math.floor(desiredFrom / HISTORY_BUCKET_SECONDS) * HISTORY_BUCKET_SECONDS;
  const bucketEnd = Math.ceil(rangeClose / HISTORY_BUCKET_SECONDS) * HISTORY_BUCKET_SECONDS;
  return { bucketStart, from: bucketStart, to: Math.max(rangeClose, bucketEnd - 1) };
}

export function calendarEventsCoverWindow(events: CalendarEvent[], from: number, through: number): boolean {
  if (events.length === 0) return false;
  let oldest = Number.POSITIVE_INFINITY;
  let newest = Number.NEGATIVE_INFINITY;
  events.forEach((event) => {
    oldest = Math.min(oldest, event.time);
    newest = Math.max(newest, event.time);
  });
  return oldest <= from && newest >= through;
}

export interface PairMatrixCalendarIndex {
  currencies: Map<string, { events: CalendarEvent[]; series: Map<string, CalendarEvent[]> }>;
}

function lowerBoundEvents(events: readonly CalendarEvent[], target: number): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (events[mid].time < target) low = mid + 1; else high = mid;
  }
  return low;
}

function upperBoundEvents(events: readonly CalendarEvent[], target: number): number {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (events[mid].time <= target) low = mid + 1; else high = mid;
  }
  return low;
}

export function indexPairMatrixCalendar(events: CalendarEvent[], currencies: readonly string[]): PairMatrixCalendarIndex {
  const currencySet = new Set(currencies);
  const indexed = new Map<string, { events: CalendarEvent[]; series: Map<string, CalendarEvent[]> }>();
  currencies.forEach((currency) => indexed.set(currency, { events: [], series: new Map() }));
  mergePairMatrixCalendarEvents(events).forEach((event) => {
    if (!currencySet.has(event.currency)) return;
    const currency = indexed.get(event.currency)!;
    currency.events.push(event);
    const key = normalizePairMatrixSeriesTitle(event.title);
    const series = currency.series.get(key) ?? [];
    series.push(event);
    currency.series.set(key, series);
  });
  return { currencies: indexed };
}

export function buildPairMatrixTimelineFromIndex(params: {
  index: PairMatrixCalendarIndex;
  currencies: readonly string[];
  rangeOpen: number;
  rangeClose: number;
  duringThrough: number;
  beforeDays: number;
}): PairMatrixTimelineSnapshot {
  const beforeFrom = params.rangeOpen - normalizePairMatrixBeforeDays(params.beforeDays) * 24 * 60 * 60;
  const duringThrough = Math.min(params.duringThrough, params.rangeClose - 1);
  return {
    during: params.currencies.map((currency) => {
      const events = params.index.currencies.get(currency)?.events ?? [];
      return {
        currency,
        entries: events
          .slice(lowerBoundEvents(events, params.rangeOpen), upperBoundEvents(events, duringThrough))
          .map(buildPairMatrixSeriesSnapshot),
      };
    }),
    before: params.currencies.map((currency) => {
      const series = params.index.currencies.get(currency)?.series ?? new Map<string, CalendarEvent[]>();
      const latest: CalendarEvent[] = [];
      series.forEach((events) => {
        const candidate = events[lowerBoundEvents(events, params.rangeOpen) - 1];
        if (candidate && candidate.time >= beforeFrom) latest.push(candidate);
      });
      return {
        currency,
        entries: latest
          .sort((left, right) => right.time - left.time || left.title.localeCompare(right.title) || left.id - right.id)
          .map(buildPairMatrixSeriesSnapshot),
      };
    }),
  };
}

export function buildPairMatrixTimeline(params: {
  events: CalendarEvent[];
  currencies: readonly string[];
  rangeOpen: number;
  rangeClose: number;
  duringThrough: number;
  beforeDays: number;
}): PairMatrixTimelineSnapshot {
  return buildPairMatrixTimelineFromIndex({ ...params, index: indexPairMatrixCalendar(params.events, params.currencies) });
}
