import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { parseNumericValue } from "@/app/lib/format";
import type { BridgeCandle, CalendarEvent, CentralBankSnapshot, FxPairDefinition, Timeframe } from "@/app/types";

export type MacroDriverTimeframe = Extract<Timeframe, "W1" | "D1" | "H4">;
export type MacroTrendTone = "bullish" | "bearish" | "neutral" | "missing";

export interface MacroTrendState {
  timeframe: MacroDriverTimeframe;
  label: string;
  tone: MacroTrendTone;
  closeLabel: string;
  changeLabel: string;
  rangeLabel: string;
  coverageLabel: string;
  explanation: string;
}

export interface MacroFactorDefinition {
  id: string;
  label: string;
  keywords: string[];
}

export interface MacroFactorRow {
  factor: MacroFactorDefinition;
  currency: string;
  latestEvent: CalendarEvent | null;
  nextEvent: CalendarEvent | null;
  coverageLabel: string;
  summary: string;
}

export const MACRO_DRIVER_TIMEFRAMES: MacroDriverTimeframe[] = ["W1", "D1", "H4"];

export const MACRO_FACTOR_DEFINITIONS: MacroFactorDefinition[] = [
  { id: "policy", label: "Policy rate", keywords: ["rate decision", "interest rate", "refinancing rate", "cash rate", "policy rate"] },
  { id: "inflation", label: "Inflation", keywords: ["cpi", "pce", "ppi", "inflation", "deflator"] },
  { id: "labor", label: "Labor", keywords: ["nfp", "payroll", "unemployment", "jobless", "claims", "wage", "earnings"] },
  { id: "retail", label: "Retail sales", keywords: ["retail sales", "consumer spending"] },
  { id: "pmi", label: "PMI / activity", keywords: ["pmi", "ism", "manufacturing", "services"] },
  { id: "sentiment", label: "Sentiment", keywords: ["confidence", "sentiment", "expectations"] },
  { id: "trade", label: "Trade / current account", keywords: ["trade balance", "current account", "exports", "imports"] },
];

function formatPercent(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPrice(value: number | null): string {
  if (value == null) return "N/A";
  if (Math.abs(value) >= 100) return value.toFixed(2);
  return value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRangePosition(close: number, lows: number[], highs: number[]): number | null {
  const low = Math.min(...lows);
  const high = Math.max(...highs);
  const width = high - low;
  if (!Number.isFinite(width) || width <= 0) return null;
  return ((close - low) / width) * 100;
}

export function buildMacroTrendState(timeframe: MacroDriverTimeframe, candles: BridgeCandle[]): MacroTrendState {
  const requiredCandles = timeframe === "W1" ? 26 : timeframe === "D1" ? 80 : 60;
  if (candles.length < requiredCandles) {
    return {
      timeframe,
      label: "Not enough candles",
      tone: "missing",
      closeLabel: "N/A",
      changeLabel: "N/A",
      rangeLabel: "N/A",
      coverageLabel: `${candles.length}/${requiredCandles} candles`,
      explanation: "The bridge has not loaded enough MT5 candle history to classify this timeframe honestly.",
    };
  }

  const latest = candles[candles.length - 1];
  const lookback = timeframe === "W1" ? 12 : timeframe === "D1" ? 20 : 30;
  const priorWindow = candles.slice(Math.max(0, candles.length - lookback - 1), -1);
  const recentWindow = candles.slice(Math.max(0, candles.length - lookback));
  const priorHigh = Math.max(...priorWindow.map((item) => item.high));
  const priorLow = Math.min(...priorWindow.map((item) => item.low));
  const rangePosition = getRangePosition(latest.close, recentWindow.map((item) => item.low), recentWindow.map((item) => item.high));
  const movingAverage = average(candles.slice(-Math.min(50, candles.length)).map((item) => item.close));
  const firstClose = recentWindow[0]?.close ?? latest.close;
  const changePercent = firstClose === 0 ? null : ((latest.close - firstClose) / firstClose) * 100;
  const aboveAverage = movingAverage != null && latest.close >= movingAverage;
  const breakoutUp = latest.close > priorHigh;
  const breakoutDown = latest.close < priorLow;
  const upperRange = rangePosition != null && rangePosition >= 70;
  const lowerRange = rangePosition != null && rangePosition <= 30;

  if (breakoutUp || (aboveAverage && upperRange)) {
    return {
      timeframe,
      label: breakoutUp ? "Breakout pressure" : "Uptrend pressure",
      tone: "bullish",
      closeLabel: formatPrice(latest.close),
      changeLabel: formatPercent(changePercent),
      rangeLabel: rangePosition == null ? "Range unknown" : `${rangePosition.toFixed(0)}% of range`,
      coverageLabel: `${candles.length} candles`,
      explanation: `${timeframe} is trading near the upper part of its recent range and above its local average. Treat this as trend pressure, then confirm with event context and lower-timeframe acceptance.`,
    };
  }

  if (breakoutDown || (!aboveAverage && lowerRange)) {
    return {
      timeframe,
      label: breakoutDown ? "Breakdown pressure" : "Downtrend pressure",
      tone: "bearish",
      closeLabel: formatPrice(latest.close),
      changeLabel: formatPercent(changePercent),
      rangeLabel: rangePosition == null ? "Range unknown" : `${rangePosition.toFixed(0)}% of range`,
      coverageLabel: `${candles.length} candles`,
      explanation: `${timeframe} is trading near the lower part of its recent range and below its local average. Treat this as downside pressure, then confirm with event context and lower-timeframe acceptance.`,
    };
  }

  return {
    timeframe,
    label: "Range / mixed",
    tone: "neutral",
    closeLabel: formatPrice(latest.close),
    changeLabel: formatPercent(changePercent),
    rangeLabel: rangePosition == null ? "Range unknown" : `${rangePosition.toFixed(0)}% of range`,
    coverageLabel: `${candles.length} candles`,
    explanation: `${timeframe} is not giving a clean breakout or breakdown read. Treat macro explanations as context until price leaves the range with acceptance.`,
  };
}

function titleMatches(title: string, keywords: string[]): boolean {
  const normalized = title.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function summarizeEvent(event: CalendarEvent | null): string {
  if (!event) return "No matching release loaded.";
  const actual = getEventValueDisplay(event.actual, event.title).display;
  const forecast = getEventValueDisplay(event.forecast, event.title).display;
  const previous = getEventValueDisplay(event.previous, event.title).display;
  return `${event.title}: actual ${actual}, forecast ${forecast}, previous ${previous}`;
}

export function buildMacroFactorRows(params: {
  events: CalendarEvent[];
  currencies: string[];
  nowSeconds: number;
}): MacroFactorRow[] {
  return params.currencies.flatMap((currency) =>
    MACRO_FACTOR_DEFINITIONS.map((factor) => {
      const matches = params.events
        .filter((event) => event.currency === currency && titleMatches(event.title, factor.keywords))
        .sort((left, right) => left.time - right.time);
      const latestEvent = [...matches].reverse().find((event) => event.time < params.nowSeconds) ?? null;
      const nextEvent = matches.find((event) => event.time >= params.nowSeconds) ?? null;
      const coverageLabel = latestEvent && nextEvent ? "Current + scheduled" : latestEvent ? "Latest only" : nextEvent ? "Scheduled only" : "Missing";

      return {
        factor,
        currency,
        latestEvent,
        nextEvent,
        coverageLabel,
        summary: summarizeEvent(latestEvent),
      };
    }),
  );
}

export function findSnapshot(currency: string, snapshots: CentralBankSnapshot[]): CentralBankSnapshot | null {
  return snapshots.find((snapshot) => snapshot.currency === currency) ?? null;
}

export function formatSnapshotValue(value: string | null): string {
  const parsed = parseNumericValue(value ?? "");
  return parsed == null ? "N/A" : `${parsed.toFixed(2)}%`;
}

export function getInstrumentCurrencies(pair: FxPairDefinition): string[] {
  return pair.base === "XAU" ? ["USD"] : [pair.base, pair.quote];
}
