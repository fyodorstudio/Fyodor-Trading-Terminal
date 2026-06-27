import type { FxPairDefinition } from "@/app/types/fx";

export type WatchlistBiasLabel = "bullish_base" | "bullish_quote" | "mixed";

export interface WatchlistCurrencyState {
  currency: string;
  countryCode: string;
  compositeScore: number | null;
  rateLevel: number | null;
  inflationLevel: number | null;
  rateDelta: number | null;
  inflationDelta: number | null;
  realRateProxy: number | null;
  coverage: number;
  partial: boolean;
  notes: string[];
}

export interface WatchlistPairRow {
  pair: FxPairDefinition;
  rank: number;
  pairScore: number;
  bias: WatchlistBiasLabel;
  strongerSide: string | null;
  weakerSide: string | null;
  explanation: string;
  reasonTags: string[];
  coverage: number;
  partial: boolean;
  partialNote: string | null;
}

export interface WatchlistEngineResult {
  currencies: WatchlistCurrencyState[];
  topPairs: WatchlistPairRow[];
  rows: WatchlistPairRow[];
  methodology: string[];
}
