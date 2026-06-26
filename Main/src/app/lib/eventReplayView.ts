import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import { priceDeltaToPips } from "@/app/lib/eventReaction";
import type { BridgeCandle, CalendarEvent, FxPairDefinition, ReactionReplaySample, ReplayChartTimeframe } from "@/app/types";

export function formatReplayCount(value: number): string {
  return value === 1 ? "1 release" : `${value} releases`;
}

export function formatReplayPips(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pips`;
}

export function formatReplayPercent(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`;
}

export function formatReplayAxisTime(time: number, timeframe: ReplayChartTimeframe): string {
  const date = new Date(time * 1000);
  if (timeframe === "M15") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  if (timeframe === "H1" || timeframe === "H4") {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getReplayMove(
  replayWindow: { candles: BridgeCandle[]; eventIndex: number } | null,
  pair: FxPairDefinition,
): { pips: number; percent: number; label: string } | null {
  if (!replayWindow) return null;
  const eventCandle = replayWindow.candles[replayWindow.eventIndex];
  const finalCandle = replayWindow.candles[replayWindow.candles.length - 1];
  if (!eventCandle || !finalCandle || eventCandle.close === 0) return null;

  const delta = finalCandle.close - eventCandle.close;
  const pips = Number(priceDeltaToPips(delta, pair).toFixed(1));
  const percent = Number(((delta / eventCandle.close) * 100).toFixed(4));
  const label = Math.abs(pips) < 0.1 ? "mostly flat" : pips > 0 ? "higher" : "lower";
  return { pips, percent, label };
}

export function buildReplaySampleCalendarEvent(sample: ReactionReplaySample): CalendarEvent {
  const numericId = Number(sample.eventId);
  return {
    id: Number.isFinite(numericId) ? numericId : sample.eventTime,
    time: sample.eventTime,
    countryCode: getCurrencyCountryCode(sample.currency),
    currency: sample.currency,
    title: sample.title,
    impact: "high",
    actual: sample.actual,
    forecast: sample.forecast,
    previous: sample.previous,
  };
}
