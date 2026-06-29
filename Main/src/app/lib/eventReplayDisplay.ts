import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import {
  EVENT_REPLAY_STORAGE_KEYS,
  getStorageItem,
} from "@/app/lib/eventReplayStorage";
import { REPLAY_TIMEFRAME_OPTIONS, buildEventTemplateKey, getEventComparison } from "@/app/lib/eventReaction";
import type {
  BridgeStatus,
  CalendarEvent,
  EventTemplate,
  FxPairDefinition,
  ReplayChartTimeframe,
  SampleQuality,
} from "@/app/types";

export type EventTemplateFilter = "all" | SampleQuality;
export type EventTemplateSort = "quality" | "sample_count" | "currency" | "upcoming" | "countdown" | "recent";

export interface EventTemplateTiming {
  latestHistoricalAt: number | null;
  nextScheduledAt: number | null;
}

const QUALITY_ORDER: Record<SampleQuality, number> = { usable: 0, limited: 1, weak: 2 };

export function getInitialEventReplayPair(): FxPairDefinition {
  return getFxPairByName(getStorageItem(EVENT_REPLAY_STORAGE_KEYS.pair) ?? "EURUSD") ?? FX_PAIRS[0];
}

export function getInitialEventReplayTimeframe(): ReplayChartTimeframe {
  const saved = getStorageItem(EVENT_REPLAY_STORAGE_KEYS.replayTimeframe);
  return REPLAY_TIMEFRAME_OPTIONS.some((option) => option.id === saved) ? (saved as ReplayChartTimeframe) : "H1";
}

export function getInitialEventReplaySampleIndex(): number {
  const saved = Number(getStorageItem(EVENT_REPLAY_STORAGE_KEYS.sampleIndex) ?? "0");
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
}

export function getEventReplayStatusLabel(status: BridgeStatus): string {
  if (status === "live") return "Calendar live";
  if (status === "stale") return "Calendar stale";
  if (status === "loading") return "Loading events";
  if (status === "no_data") return "No calendar rows";
  return "Bridge unavailable";
}

function compareByQuality(left: EventTemplate, right: EventTemplate): number {
  const qualityDelta = QUALITY_ORDER[left.quality] - QUALITY_ORDER[right.quality];
  if (qualityDelta !== 0) return qualityDelta;
  if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
  return left.title.localeCompare(right.title);
}

export function getEventTemplateTimingMap(
  events: CalendarEvent[],
  nowSeconds = Math.floor(Date.now() / 1000),
): Map<string, EventTemplateTiming> {
  const timing = new Map<string, EventTemplateTiming>();

  events.forEach((event) => {
    const key = buildEventTemplateKey(event.currency, event.title);
    const current = timing.get(key) ?? { latestHistoricalAt: null, nextScheduledAt: null };

    if (event.time < nowSeconds) {
      if (getEventComparison(event) != null) {
        current.latestHistoricalAt = Math.max(current.latestHistoricalAt ?? 0, event.time);
      }
    } else {
      current.nextScheduledAt = Math.min(current.nextScheduledAt ?? Number.POSITIVE_INFINITY, event.time);
    }

    timing.set(key, current);
  });

  return timing;
}

export function sortEventTemplates(
  templates: EventTemplate[],
  sortMode: EventTemplateSort,
  timing: Map<string, EventTemplateTiming> = new Map(),
): EventTemplate[] {
  return [...templates].sort((left, right) => {
    if (sortMode === "quality") {
      return compareByQuality(left, right);
    }
    if (sortMode === "sample_count") {
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      return compareByQuality(left, right);
    }
    if (sortMode === "upcoming" || sortMode === "countdown") {
      const leftTime = timing.get(left.key)?.nextScheduledAt ?? Number.POSITIVE_INFINITY;
      const rightTime = timing.get(right.key)?.nextScheduledAt ?? Number.POSITIVE_INFINITY;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return compareByQuality(left, right);
    }
    if (sortMode === "recent") {
      const leftTime = timing.get(left.key)?.latestHistoricalAt ?? 0;
      const rightTime = timing.get(right.key)?.latestHistoricalAt ?? 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      return compareByQuality(left, right);
    }
    if (left.currency !== right.currency) return left.currency.localeCompare(right.currency);
    return left.title.localeCompare(right.title);
  });
}
