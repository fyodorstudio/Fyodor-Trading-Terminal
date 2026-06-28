import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import {
  EVENT_REPLAY_STORAGE_KEYS,
  getStorageItem,
} from "@/app/lib/eventReplayStorage";
import { REPLAY_TIMEFRAME_OPTIONS } from "@/app/lib/eventReaction";
import type {
  BridgeStatus,
  EventTemplate,
  FxPairDefinition,
  ReplayChartTimeframe,
  SampleQuality,
} from "@/app/types";

export type EventTemplateFilter = "all" | SampleQuality;
export type EventTemplateSort = "quality" | "sample_count" | "currency";

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

export function sortEventTemplates(templates: EventTemplate[], sortMode: EventTemplateSort): EventTemplate[] {
  return [...templates].sort((left, right) => {
    if (sortMode === "quality") {
      const qualityDelta = QUALITY_ORDER[left.quality] - QUALITY_ORDER[right.quality];
      if (qualityDelta !== 0) return qualityDelta;
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      return left.title.localeCompare(right.title);
    }
    if (sortMode === "sample_count") {
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      const qualityDelta = QUALITY_ORDER[left.quality] - QUALITY_ORDER[right.quality];
      if (qualityDelta !== 0) return qualityDelta;
      return left.title.localeCompare(right.title);
    }
    if (left.currency !== right.currency) return left.currency.localeCompare(right.currency);
    return left.title.localeCompare(right.title);
  });
}
