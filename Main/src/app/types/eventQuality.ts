import type { CalendarEvent } from "@/app/types/calendar";
import type { FxPairDefinition } from "@/app/types/fx";

export type EventQualityHorizon = "24h" | "72h" | "this_week";

export type EventQualityFamily =
  | "policy"
  | "inflation"
  | "labor"
  | "gdp"
  | "activity"
  | "trade_confidence";

export interface EventQualityRow {
  id: string;
  event: CalendarEvent;
  pairSide: "base" | "quote";
  family: EventQualityFamily;
  familyLabel: string;
  familyWeight: number;
  impactMultiplier: number;
  score: number;
  countdownLabel: string;
}

export interface EventQualityBreakdown {
  family: EventQualityFamily;
  label: string;
  count: number;
  score: number;
}

export interface EventQualitySummary {
  pair: FxPairDefinition;
  horizon: EventQualityHorizon;
  startsAt: number;
  endsAt: number;
  totalScore: number;
  baseScore: number;
  quoteScore: number;
  label: "clean" | "mixed" | "dirty";
  rows: EventQualityRow[];
  breakdown: EventQualityBreakdown[];
  immediateTrigger: boolean;
  note: string | null;
}
