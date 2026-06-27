import type { BridgeCandle } from "@/app/types/bridge";
import type { CalendarEvent } from "@/app/types/calendar";
import type { FxPairDefinition } from "@/app/types/fx";

export type StrengthSuggestionSortMode = "spreadDesc" | "spreadAsc";

export interface StrengthCurrencyRank {
  currency: string;
  countryCode: string;
  score: number;
  rateScore: number;
  inflationScore: number;
  currentPolicyRate: number;
  currentInflationRate: number;
}

export interface SuggestedStrengthPair {
  strong: StrengthCurrencyRank;
  weak: StrengthCurrencyRank;
  spread: number;
}

export interface StrengthPairCandleSet {
  d1: BridgeCandle[];
  h4: BridgeCandle[];
}

export interface StrengthIngredientBreakdown {
  value: number;
  weight: number;
  contribution: number;
  coverage: number;
  label: string;
  evidence?: string[];
}

export interface StrengthBoardCurrency {
  currency: string;
  countryCode: string;
  compositeScore: number;
  state: "strong" | "mixed" | "weak";
  stateLabel: string;
  summary: string;
  tags: string[];
  evidence: string[];
  eventRefs: CalendarEvent[];
  partial: boolean;
  coverage: number;
  price: StrengthIngredientBreakdown;
  event: StrengthIngredientBreakdown;
  structural: StrengthIngredientBreakdown;
}

export interface StrengthShortlistItem {
  pair: FxPairDefinition;
  score: number;
  label: "Open first" | "Backup watchlist" | "Skip for now";
  strongerCurrency: string;
  weakerCurrency: string;
  summary: string;
  caution: string | null;
  directionAgreement: boolean;
  eventSensitiveSoon: boolean;
  partial: boolean;
  reasonTags: string[];
  evidence: string[];
  eventRefs: CalendarEvent[];
  gap: number;
}

export interface StrengthMeterResult {
  currencies: StrengthBoardCurrency[];
  shortlist: StrengthShortlistItem[];
  lowerPriority: StrengthShortlistItem[];
  partialCurrencies: string[];
  methodology: string[];
}
