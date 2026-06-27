import type { CalendarEvent } from "@/app/types/calendar";
import type { EventQualityFamily, EventQualitySummary } from "@/app/types/eventQuality";
import type { FxPairDefinition } from "@/app/types/fx";

export type EventReactionMode = "event-first" | "asset-first";
export type ReactionWindow = "15m" | "1h" | "4h" | "1d";
export type ReactionBucket = "beat" | "inline" | "miss" | "small_beat" | "large_beat" | "small_miss" | "large_miss";
export type SampleQuality = "weak" | "limited" | "usable";
export type ReplayChartTimeframe = "M15" | "H1" | "H4" | "D1";
export type EventComparisonBasis = "forecast" | "previous";

export interface EventTemplate {
  key: string;
  currency: string;
  title: string;
  family: EventQualityFamily;
  familyLabel: string;
  sampleCount: number;
  usableSampleCount: number;
  quality: SampleQuality;
}

export interface ReactionSample {
  eventId: string;
  eventTime: number;
  actual: number;
  forecast: number;
  comparisonBasis: EventComparisonBasis;
  comparisonValue: number;
  surprise: number;
  bucket: ReactionBucket;
  windows: Partial<
    Record<
      ReactionWindow,
      {
        percent: number;
        pips: number;
      }
    >
  >;
}

export interface ReactionStats {
  sampleSize: number;
  averageReturn: number | null;
  medianReturn: number | null;
  medianAbsoluteReturn: number | null;
  standardDeviation: number | null;
  averagePips: number | null;
  medianPips: number | null;
  medianAbsolutePips: number | null;
  standardDeviationPips: number | null;
}

export interface ReactionBucketStats {
  bucket: ReactionBucket;
  label: string;
  windows: Record<ReactionWindow, ReactionStats>;
}

export interface ReactionStudyRow {
  key: string;
  label: string;
  currency: string;
  family?: EventQualityFamily;
  familyLabel?: string;
  quality: SampleQuality;
  sampleCount: number;
  rankMetric: number | null;
  summaryWindows: Record<ReactionWindow, ReactionStats>;
  bucketStats: ReactionBucketStats[];
  note: string | null;
}

export interface ReactionStudySummary {
  mode: EventReactionMode;
  selectedPair?: FxPairDefinition | null;
  selectedTemplate?: EventTemplate | null;
  rows: ReactionStudyRow[];
  beatCount: number;
  inlineCount: number;
  missCount: number;
  usableSampleCount: number;
  note: string | null;
}

export interface ReactionReplaySample {
  eventId: string;
  eventTime: number;
  currency: string;
  title: string;
  actual: string;
  forecast: string;
  previous: string;
  comparisonBasis: EventComparisonBasis;
  comparisonLabel: string;
  comparisonValue: number;
  surprise: number;
}

export interface EventToolsStudy {
  selectedTemplate: EventTemplate | null;
  selectedPair: FxPairDefinition | null;
  selectedUpcomingEvent: CalendarEvent | null;
  pairRanking: ReactionStudyRow[];
  selectedRow: ReactionStudyRow | null;
  replaySamples: ReactionReplaySample[];
  eventEnvironment: EventQualitySummary | null;
}
