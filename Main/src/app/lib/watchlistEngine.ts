import { CURRENCY_TO_COUNTRY_CODE, FX_PAIRS, MAJOR_CURRENCY_ORDER } from "@/app/config/fxPairs";
import { parseNumericValue } from "@/app/lib/format";
import type {
  CentralBankSnapshot,
  WatchlistBiasLabel,
  WatchlistCurrencyState,
  WatchlistEngineResult,
  WatchlistPairRow,
} from "@/app/types";

const REAL_RATE_WEIGHT = 0.35;
const RATE_LEVEL_WEIGHT = 0.3;
const RATE_DELTA_WEIGHT = 0.2;
const INFLATION_DELTA_WEIGHT = 0.15;
const MIXED_THRESHOLD = 0.035;
const TOP_PAIR_COUNT = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toCoverage(parts: Array<number | null>): number {
  const resolved = parts.filter((part) => part != null).length;
  return Number((resolved / parts.length).toFixed(2));
}

function percentileRank(values: number[], value: number): number {
  if (values.length <= 1) return 0.5;
  const sorted = [...values].sort((left, right) => left - right);
  const firstGreaterOrEqual = sorted.findIndex((item) => item >= value);
  const resolvedIndex = firstGreaterOrEqual === -1 ? sorted.length - 1 : firstGreaterOrEqual;
  return resolvedIndex / (sorted.length - 1);
}

function normalizeSigned(values: number[], value: number): number {
  if (values.length === 0) return 0;
  const maxAbs = Math.max(...values.map((item) => Math.abs(item)), 0);
  if (maxAbs === 0) return 0;
  return clamp(value / maxAbs, -1, 1);
}

function buildNotes(params: {
  currency: string;
  rateLevel: number | null;
  inflationLevel: number | null;
  rateDelta: number | null;
  inflationDelta: number | null;
  realRateProxy: number | null;
}): string[] {
  const notes: string[] = [];
  if (params.realRateProxy != null) {
    notes.push(`${params.currency} real-rate proxy ${params.realRateProxy.toFixed(2)}%.`);
  }
  if (params.rateDelta != null && params.rateDelta !== 0) {
    notes.push(`${params.currency} policy moved ${params.rateDelta > 0 ? "up" : "down"} versus previous.`);
  }
  if (params.inflationDelta != null && params.inflationDelta !== 0) {
    notes.push(`${params.currency} inflation is ${params.inflationDelta > 0 ? "higher" : "lower"} versus previous.`);
  }
  if (notes.length === 0 && params.rateLevel != null && params.inflationLevel != null) {
    notes.push(`${params.currency} has current policy and inflation inputs but no directional change.`);
  }
  return notes;
}

function deriveCurrencyStates(snapshots: CentralBankSnapshot[]): WatchlistCurrencyState[] {
  const snapshotByCurrency = new Map(snapshots.map((snapshot) => [snapshot.currency, snapshot]));

  const states = MAJOR_CURRENCY_ORDER.map((currency) => {
    const snapshot = snapshotByCurrency.get(currency);
    const rateLevel = parseNumericValue(snapshot?.currentPolicyRate ?? "");
    const inflationLevel = parseNumericValue(snapshot?.currentInflationRate ?? "");
    const previousRate = parseNumericValue(snapshot?.previousPolicyRate ?? "");
    const previousInflation = parseNumericValue(snapshot?.previousInflationRate ?? "");
    const rateDelta = rateLevel != null && previousRate != null ? rateLevel - previousRate : null;
    const inflationDelta =
      inflationLevel != null && previousInflation != null ? inflationLevel - previousInflation : null;
    const realRateProxy = rateLevel != null && inflationLevel != null ? rateLevel - inflationLevel : null;

    return {
      currency,
      countryCode: CURRENCY_TO_COUNTRY_CODE[currency],
      compositeScore: null,
      rateLevel,
      inflationLevel,
      rateDelta,
      inflationDelta,
      realRateProxy,
      coverage: toCoverage([rateLevel, inflationLevel, rateDelta, inflationDelta, realRateProxy]),
      partial: false,
      notes: buildNotes({ currency, rateLevel, inflationLevel, rateDelta, inflationDelta, realRateProxy }),
    } satisfies WatchlistCurrencyState;
  });

  const realRateValues = states.flatMap((state) => (state.realRateProxy != null ? [state.realRateProxy] : []));
  const rateLevelValues = states.flatMap((state) => (state.rateLevel != null ? [state.rateLevel] : []));
  const rateDeltaValues = states.flatMap((state) => (state.rateDelta != null ? [state.rateDelta] : []));
  const inflationDeltaValues = states.flatMap((state) => (state.inflationDelta != null ? [state.inflationDelta] : []));

  return states.map((state) => {
    let weightedTotal = 0;
    let totalWeight = 0;

    if (state.realRateProxy != null) {
      weightedTotal += percentileRank(realRateValues, state.realRateProxy) * REAL_RATE_WEIGHT;
      totalWeight += REAL_RATE_WEIGHT;
    }
    if (state.rateLevel != null) {
      weightedTotal += percentileRank(rateLevelValues, state.rateLevel) * RATE_LEVEL_WEIGHT;
      totalWeight += RATE_LEVEL_WEIGHT;
    }
    if (state.rateDelta != null) {
      const normalized = normalizeSigned(rateDeltaValues, state.rateDelta);
      weightedTotal += ((normalized + 1) / 2) * RATE_DELTA_WEIGHT;
      totalWeight += RATE_DELTA_WEIGHT;
    }
    if (state.inflationDelta != null) {
      const normalized = normalizeSigned(inflationDeltaValues, state.inflationDelta);
      weightedTotal += ((normalized + 1) / 2) * INFLATION_DELTA_WEIGHT;
      totalWeight += INFLATION_DELTA_WEIGHT;
    }

    const compositeScore = totalWeight > 0 ? Number((weightedTotal / totalWeight).toFixed(4)) : null;
    const partial = state.coverage < 1;

    return {
      ...state,
      compositeScore,
      partial,
    };
  });
}

function buildExplanation(params: {
  pairName: string;
  bias: WatchlistBiasLabel;
  strongerSide: string | null;
  weakerSide: string | null;
}): string {
  if (params.bias === "mixed" || !params.strongerSide || !params.weakerSide) {
    return `${params.pairName} does not show a strong enough macro divergence yet.`;
  }
  return `${params.strongerSide} currently carries the cleaner macro backdrop against ${params.weakerSide} in ${params.pairName}.`;
}

function buildReasonTags(params: {
  base: WatchlistCurrencyState;
  quote: WatchlistCurrencyState;
  bias: WatchlistBiasLabel;
}): string[] {
  if (params.bias === "mixed") {
    return ["macro gap still small", "wait for cleaner divergence"];
  }

  const stronger = params.bias === "bullish_base" ? params.base : params.quote;
  const weaker = stronger.currency === params.base.currency ? params.quote : params.base;
  const tags: string[] = [];

  if (
    stronger.realRateProxy != null &&
    weaker.realRateProxy != null &&
    stronger.realRateProxy > weaker.realRateProxy
  ) {
    tags.push(`${stronger.currency} real-rate proxy stronger`);
  }
  if (stronger.rateLevel != null && weaker.rateLevel != null && stronger.rateLevel > weaker.rateLevel) {
    tags.push(`rate differential still favors ${stronger.currency}`);
  }
  if (stronger.inflationDelta != null && weaker.inflationDelta != null && stronger.inflationDelta < weaker.inflationDelta) {
    tags.push(`${stronger.currency} inflation direction softer`);
  }
  if (stronger.rateDelta != null && stronger.rateDelta > 0) {
    tags.push(`${stronger.currency} policy direction firmer`);
  }

  if (tags.length === 0) {
    tags.push(`${stronger.currency} macro score stronger`);
  }

  return tags.slice(0, 3);
}

function derivePairRows(currencyStates: WatchlistCurrencyState[]): WatchlistPairRow[] {
  const stateByCurrency = new Map(currencyStates.map((state) => [state.currency, state]));

  const unsortedRows = FX_PAIRS.map((pair) => {
    const base = stateByCurrency.get(pair.base);
    const quote = stateByCurrency.get(pair.quote);
    const baseScore = base?.compositeScore ?? null;
    const quoteScore = quote?.compositeScore ?? null;
    const canCompare = baseScore != null && quoteScore != null;
    const rawGap = canCompare ? Math.abs(baseScore - quoteScore) : 0;

    let bias: WatchlistBiasLabel = "mixed";
    let strongerSide: string | null = null;
    let weakerSide: string | null = null;

    if (canCompare && rawGap >= MIXED_THRESHOLD) {
      if (baseScore > quoteScore) {
        bias = "bullish_base";
        strongerSide = pair.base;
        weakerSide = pair.quote;
      } else if (quoteScore > baseScore) {
        bias = "bullish_quote";
        strongerSide = pair.quote;
        weakerSide = pair.base;
      }
    }

    const coverage = Number((((base?.coverage ?? 0) + (quote?.coverage ?? 0)) / 2).toFixed(2));
    const partial = (base?.partial ?? true) || (quote?.partial ?? true);
    const partialNote = partial ? "One or both currencies still have partial macro inputs." : null;

    return {
      pair,
      rank: 0,
      pairScore: Number(rawGap.toFixed(4)),
      bias,
      strongerSide,
      weakerSide,
      explanation: buildExplanation({ pairName: pair.name, bias, strongerSide, weakerSide }),
      reasonTags: base && quote ? buildReasonTags({ base, quote, bias }) : ["coverage incomplete"],
      coverage,
      partial,
      partialNote,
    } satisfies WatchlistPairRow;
  });

  return unsortedRows
    .sort((left, right) => {
      if (right.pairScore !== left.pairScore) return right.pairScore - left.pairScore;
      return left.pair.name.localeCompare(right.pair.name);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export function deriveWatchlistEngine(snapshots: CentralBankSnapshot[]): WatchlistEngineResult {
  const currencies = deriveCurrencyStates(snapshots);
  const rows = derivePairRows(currencies);

  return {
    currencies,
    topPairs: rows.slice(0, TOP_PAIR_COUNT),
    rows,
    methodology: [
      "FX only. The first version ranks the major FX pairs by deterministic macro divergence.",
      "Score inputs are current policy rate, current inflation, directional change versus previous, and real-rate proxy.",
      "Events, price confirmation, and market-implied probabilities are intentionally excluded from this v1 watchlist score.",
    ],
  };
}
