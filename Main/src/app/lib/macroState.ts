import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { deriveWatchlistEngine } from "@/app/lib/watchlistEngine";
import type { CentralBankSnapshot, FxPairDefinition, WatchlistCurrencyState, WatchlistPairRow } from "@/app/types";

export type MacroStateRegimeLabel = "policy-led" | "inflation-led" | "mixed";

export interface MacroStateMetricRow {
  label: string;
  baseValue: number | null;
  quoteValue: number | null;
  note: string;
  preferHigher: boolean;
}

export interface MacroStateResult {
  pair: FxPairDefinition;
  row: WatchlistPairRow;
  base: WatchlistCurrencyState;
  quote: WatchlistCurrencyState;
  strongerCurrency: string | null;
  weakerCurrency: string | null;
  regimeLabel: MacroStateRegimeLabel;
  regimeExplanation: string;
  leanSummary: string;
  taInterpretation: string;
  clearStateLabel: string;
  narrative: string[];
  metrics: MacroStateMetricRow[];
  cautions: string[];
}

function buildNarrative(row: WatchlistPairRow, base: WatchlistCurrencyState, quote: WatchlistCurrencyState): string[] {
  if (row.bias === "mixed") {
    return [
      `The macro gap is only ${row.pairScore.toFixed(4)}, so the engine does not see a clean enough directional backdrop yet.`,
      `${base.currency} composite score is ${(base.compositeScore ?? 0).toFixed(4)} while ${quote.currency} is ${(quote.compositeScore ?? 0).toFixed(4)}.`,
      "That is why the pair stays mixed instead of forcing a bullish-base or bullish-quote verdict.",
    ];
  }

  const stronger = row.strongerSide === base.currency ? base : quote;
  const weaker = stronger.currency === base.currency ? quote : base;
  const narrative = [
    `${stronger.currency} leads the pair with a composite score of ${(stronger.compositeScore ?? 0).toFixed(4)} versus ${(weaker.compositeScore ?? 0).toFixed(4)} for ${weaker.currency}.`,
    `That creates the current pair divergence score of ${row.pairScore.toFixed(4)} and supports the ${row.bias === "bullish_base" ? "bullish base" : "bullish quote"} verdict.`,
  ];

  if (stronger.realRateProxy != null && weaker.realRateProxy != null && stronger.realRateProxy > weaker.realRateProxy) {
    narrative.push(
      `${stronger.currency} real-rate proxy is stronger at ${stronger.realRateProxy.toFixed(2)}% versus ${weaker.realRateProxy.toFixed(2)}% for ${weaker.currency}.`,
    );
  }
  if (stronger.rateLevel != null && weaker.rateLevel != null && stronger.rateLevel > weaker.rateLevel) {
    narrative.push(
      `Rate differential still favors ${stronger.currency}: ${stronger.rateLevel.toFixed(2)}% policy rate versus ${weaker.rateLevel.toFixed(2)}% for ${weaker.currency}.`,
    );
  }
  if (stronger.rateDelta != null && weaker.rateDelta != null && stronger.rateDelta > weaker.rateDelta) {
    narrative.push(
      `${stronger.currency} policy direction is firmer: ${stronger.rateDelta >= 0 ? "+" : ""}${stronger.rateDelta.toFixed(2)}pp versus ${weaker.rateDelta >= 0 ? "+" : ""}${weaker.rateDelta.toFixed(2)}pp.`,
    );
  }
  if (stronger.inflationDelta != null && weaker.inflationDelta != null && stronger.inflationDelta < weaker.inflationDelta) {
    narrative.push(
      `${stronger.currency} inflation direction is softer: ${stronger.inflationDelta >= 0 ? "+" : ""}${stronger.inflationDelta.toFixed(2)}pp versus ${weaker.inflationDelta >= 0 ? "+" : ""}${weaker.inflationDelta.toFixed(2)}pp.`,
    );
  }

  return narrative;
}

function buildRegimeHint(row: WatchlistPairRow, base: WatchlistCurrencyState, quote: WatchlistCurrencyState): {
  label: MacroStateRegimeLabel;
  explanation: string;
} {
  if (row.bias === "mixed") {
    return {
      label: "mixed",
      explanation: "No single macro driver is dominant enough yet, so the regime hint stays mixed.",
    };
  }

  const stronger = row.strongerSide === base.currency ? base : quote;
  const weaker = stronger.currency === base.currency ? quote : base;

  let policyCount = 0;
  let inflationCount = 0;

  if (stronger.rateLevel != null && weaker.rateLevel != null && stronger.rateLevel > weaker.rateLevel) policyCount += 1;
  if (stronger.rateDelta != null && weaker.rateDelta != null && stronger.rateDelta > weaker.rateDelta) policyCount += 1;
  if (stronger.inflationLevel != null && weaker.inflationLevel != null && stronger.inflationLevel < weaker.inflationLevel) inflationCount += 1;
  if (stronger.inflationDelta != null && weaker.inflationDelta != null && stronger.inflationDelta < weaker.inflationDelta) inflationCount += 1;

  if (policyCount > inflationCount && policyCount > 0) {
    return {
      label: "policy-led",
      explanation: `${stronger.currency} is leaning ahead mostly because rate level and policy direction still favor that side more clearly than the inflation picture does.`,
    };
  }

  if (inflationCount > policyCount && inflationCount > 0) {
    return {
      label: "inflation-led",
      explanation: `${stronger.currency} is leaning ahead mostly because inflation pressure and inflation direction look cleaner on that side.`,
    };
  }

  return {
    label: "mixed",
    explanation: "Policy and inflation drivers are both contributing, so the regime hint stays mixed instead of overstating one theme.",
  };
}

function buildLeanSummary(row: WatchlistPairRow): string {
  if (row.bias === "bullish_base") {
    return `The current macro backdrop supports long-side ideas in ${row.pair.name} more than short-side ideas.`;
  }
  if (row.bias === "bullish_quote") {
    return `The current macro backdrop supports short-side ideas in ${row.pair.name} more than long-side ideas.`;
  }
  return `${row.pair.name} does not provide a clean enough directional backdrop yet, so macro should not add conviction on its own.`;
}

function buildTaInterpretation(row: WatchlistPairRow): string {
  if (row.bias === "bullish_base") {
    return "If your TradingView plan is long, macro is aligned. If your plan is short, you are leaning against the current macro backdrop.";
  }
  if (row.bias === "bullish_quote") {
    return "If your TradingView plan is short, macro is aligned. If your plan is long, you are leaning against the current macro backdrop.";
  }
  return "Treat this as a neutral backdrop check: let chart structure lead because macro is still too mixed to help much.";
}

export function deriveMacroState(snapshots: CentralBankSnapshot[], pairName?: string | null): MacroStateResult {
  const watchlist = deriveWatchlistEngine(snapshots);
  const fallbackPair = watchlist.rows[0]?.pair ?? FX_PAIRS[0];
  const resolvedPair = getFxPairByName(pairName ?? "") ?? fallbackPair;
  const row = watchlist.rows.find((item) => item.pair.name === resolvedPair.name) ?? watchlist.rows[0];

  if (!row) {
    throw new Error("Macro State requires at least one FX pair row.");
  }

  const base = watchlist.currencies.find((item) => item.currency === row.pair.base);
  const quote = watchlist.currencies.find((item) => item.currency === row.pair.quote);

  if (!base || !quote) {
    throw new Error(`Macro State could not resolve currencies for ${row.pair.name}.`);
  }

  const regime = buildRegimeHint(row, base, quote);

  return {
    pair: row.pair,
    row,
    base,
    quote,
    strongerCurrency: row.strongerSide,
    weakerCurrency: row.weakerSide,
    regimeLabel: regime.label,
    regimeExplanation: regime.explanation,
    leanSummary: buildLeanSummary(row),
    taInterpretation: buildTaInterpretation(row),
    clearStateLabel: row.bias === "mixed" ? "Mixed backdrop" : "Clearer backdrop",
    narrative: buildNarrative(row, base, quote),
    metrics: [
      {
        label: "Composite score",
        baseValue: base.compositeScore,
        quoteValue: quote.compositeScore,
        preferHigher: true,
        note: "Higher composite score means the currency side carries the cleaner macro backdrop right now.",
      },
      {
        label: "Policy rate",
        baseValue: base.rateLevel,
        quoteValue: quote.rateLevel,
        preferHigher: true,
        note: "Higher policy rate can keep the differential in that currency's favor.",
      },
      {
        label: "Policy direction",
        baseValue: base.rateDelta,
        quoteValue: quote.rateDelta,
        preferHigher: true,
        note: "Positive change versus previous implies firmer policy direction.",
      },
      {
        label: "Current inflation",
        baseValue: base.inflationLevel,
        quoteValue: quote.inflationLevel,
        preferHigher: false,
        note: "Lower current inflation can support the currency through a cleaner real-rate profile.",
      },
      {
        label: "Inflation direction",
        baseValue: base.inflationDelta,
        quoteValue: quote.inflationDelta,
        preferHigher: false,
        note: "Lower inflation direction is treated as softer and can support real-rate quality.",
      },
      {
        label: "Real-rate proxy",
        baseValue: base.realRateProxy,
        quoteValue: quote.realRateProxy,
        preferHigher: true,
        note: "Rate minus inflation. Higher generally supports the stronger side.",
      },
      {
        label: "Coverage",
        baseValue: base.coverage * 100,
        quoteValue: quote.coverage * 100,
        preferHigher: true,
        note: "Coverage shows how much of the intended macro input set is available for each side.",
      },
    ],
    cautions: [
      "No hold, cut, or hike probabilities are being estimated here.",
      "No market-implied policy-path pricing is available from the current data stack.",
      "No crowding, positioning, or options-risk view is included.",
      "No broader risk-regime confirmation is possible beyond the current macro inputs already in the app.",
      "This is a backdrop read only. It does not create a timing edge by itself.",
    ],
  };
}
