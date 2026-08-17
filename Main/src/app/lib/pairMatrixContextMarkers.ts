import { classifyPairMatrixEvent, getPairMatrixCandleClose, PAIR_MATRIX_FACTORS, PAIR_MATRIX_OTHER_FACTOR, type PairMatrixCandleRange, type PairMatrixFactorDefinition } from "@/app/lib/pairMatrixSnapshot";
import type { CalendarEvent, Timeframe } from "@/app/types";

export interface PairMatrixContextMarkerFamily {
  factor: PairMatrixFactorDefinition;
  events: CalendarEvent[];
}

export interface PairMatrixContextMarkerGroup {
  key: string;
  candleOpen: number;
  impact: CalendarEvent["impact"];
  events: CalendarEvent[];
  families: PairMatrixContextMarkerFamily[];
  position: "before" | "during" | "after";
}

const FACTOR_ORDER = [...PAIR_MATRIX_FACTORS, PAIR_MATRIX_OTHER_FACTOR];
const IMPACT_RANK: Record<CalendarEvent["impact"], number> = { high: 0, medium: 1, low: 2 };

function findContainingCandle(candleTimes: readonly number[], chartTime: number, timeframe: Timeframe): number | null {
  let low = 0;
  let high = candleTimes.length - 1;
  let candidate = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (candleTimes[mid] <= chartTime) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (candidate < 0) return null;
  const candleOpen = candleTimes[candidate];
  return chartTime < getPairMatrixCandleClose(candleOpen, timeframe) ? candleOpen : null;
}

export function buildPairMatrixContextMarkerGroups(params: {
  events: readonly CalendarEvent[];
  currencies: readonly string[];
  candleTimes: readonly number[];
  timeframe: Timeframe;
  sourceTimeOffsetSeconds: number;
  range: PairMatrixCandleRange | null;
  contextPerSide: number;
}): PairMatrixContextMarkerGroup[] {
  if (!params.range || params.currencies.length === 0 || params.candleTimes.length === 0) return [];
  const currencies = new Set(params.currencies);
  const byCandle = new Map<number, CalendarEvent[]>();

  params.events.forEach((event) => {
    if (!currencies.has(event.currency) || !Number.isFinite(event.time)) return;
    const candleOpen = findContainingCandle(params.candleTimes, event.time + params.sourceTimeOffsetSeconds, params.timeframe);
    if (candleOpen == null) return;
    const bucket = byCandle.get(candleOpen) ?? [];
    bucket.push(event);
    byCandle.set(candleOpen, bucket);
  });

  const groups = [...byCandle.entries()].sort(([left], [right]) => left - right).map(([candleOpen, sourceEvents]) => {
    const events = [...sourceEvents].sort((left, right) => left.time - right.time || left.title.localeCompare(right.title));
    const families = FACTOR_ORDER.flatMap((factor) => {
      const matches = events.filter((event) => classifyPairMatrixEvent(event).id === factor.id);
      return matches.length > 0 ? [{ factor, events: matches }] : [];
    });
    const position = candleOpen < params.range!.firstOpen ? "before" : candleOpen > params.range!.lastOpen ? "after" : "during";
    return {
      key: `${candleOpen}:${events.map((event) => `${event.id}:${event.time}`).join("|")}`,
      candleOpen,
      impact: events.reduce((dominant, event) => IMPACT_RANK[event.impact] < IMPACT_RANK[dominant] ? event.impact : dominant, "low" as CalendarEvent["impact"]),
      events,
      families,
      position,
    } satisfies PairMatrixContextMarkerGroup;
  });

  const limit = Math.max(0, Math.round(params.contextPerSide));
  const before = limit === 0 ? [] : groups.filter((group) => group.position === "before").slice(-limit);
  const during = groups.filter((group) => group.position === "during");
  const after = groups.filter((group) => group.position === "after").slice(0, limit);
  return [...before, ...during, ...after];
}
