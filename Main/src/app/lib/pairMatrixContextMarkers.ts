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

export type PairMatrixContextMarkerIndexGroup = Omit<PairMatrixContextMarkerGroup, "position">;

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

export function indexPairMatrixContextMarkers(params: {
  events: readonly CalendarEvent[];
  currencies: readonly string[];
  candleTimes: readonly number[];
  timeframe: Timeframe;
  sourceTimeOffsetSeconds: number;
}): PairMatrixContextMarkerIndexGroup[] {
  if (params.currencies.length === 0 || params.candleTimes.length === 0) return [];
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
    const eventsByFactor = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const factorId = classifyPairMatrixEvent(event).id;
      const matches = eventsByFactor.get(factorId) ?? [];
      matches.push(event);
      eventsByFactor.set(factorId, matches);
    });
    const families = FACTOR_ORDER.flatMap((factor) => {
      const matches = eventsByFactor.get(factor.id);
      return matches ? [{ factor, events: matches }] : [];
    });
    return {
      key: `${candleOpen}:${events.map((event) => `${event.id}:${event.time}`).join("|")}`,
      candleOpen,
      impact: events.reduce((dominant, event) => IMPACT_RANK[event.impact] < IMPACT_RANK[dominant] ? event.impact : dominant, "low" as CalendarEvent["impact"]),
      events,
      families,
    } satisfies PairMatrixContextMarkerIndexGroup;
  });

  return groups;
}

function lowerBoundGroups(groups: readonly PairMatrixContextMarkerIndexGroup[], target: number): number {
  let low = 0;
  let high = groups.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (groups[mid].candleOpen < target) low = mid + 1; else high = mid;
  }
  return low;
}

export function selectPairMatrixContextMarkerGroups(params: {
  groups: readonly PairMatrixContextMarkerIndexGroup[];
  range: PairMatrixCandleRange | null;
  contextPerSide: number;
}): PairMatrixContextMarkerGroup[] {
  if (!params.range || params.groups.length === 0) return [];
  const start = lowerBoundGroups(params.groups, params.range.firstOpen);
  const afterStart = lowerBoundGroups(params.groups, params.range.lastOpen + 1);

  const limit = Math.max(0, Math.round(params.contextPerSide));
  const before = limit === 0 ? [] : params.groups.slice(Math.max(0, start - limit), start).map((group) => ({ ...group, position: "before" as const }));
  const during = params.groups.slice(start, afterStart).map((group) => ({ ...group, position: "during" as const }));
  const after = limit === 0 ? [] : params.groups.slice(afterStart, afterStart + limit).map((group) => ({ ...group, position: "after" as const }));
  return [...before, ...during, ...after];
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
  return selectPairMatrixContextMarkerGroups({ groups: indexPairMatrixContextMarkers(params), range: params.range, contextPerSide: params.contextPerSide });
}
