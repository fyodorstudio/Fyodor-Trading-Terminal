import { FX_PAIRS } from "@/app/config/fxPairs";
import { parseNumericValue } from "@/app/lib/format";
import type {
  CentralBankSnapshot,
  DashboardCurrencySnapshot,
  DashboardInflationCard,
  DashboardRateCard,
  DashboardSortMode,
  StrengthCurrencyRank,
  StrengthSuggestionSortMode,
  SuggestedStrengthPair,
} from "@/app/types";

function unresolvedLabel(metric: string, value: number | null): string | null {
  return value == null ? metric : null;
}

export function adaptDashboardCurrencies(snapshots: CentralBankSnapshot[]): DashboardCurrencySnapshot[] {
  return snapshots.map((snapshot) => {
    const currentPolicyRate = parseNumericValue(snapshot.currentPolicyRate ?? "");
    const previousPolicyRate = parseNumericValue(snapshot.previousPolicyRate ?? "");
    const currentInflationRate = parseNumericValue(snapshot.currentInflationRate ?? "");
    const previousInflationRate = parseNumericValue(snapshot.previousInflationRate ?? "");

    return {
      currency: snapshot.currency,
      countryCode: snapshot.countryCode,
      bankName: snapshot.bankName,
      flag: snapshot.flag,
      currentPolicyRate,
      previousPolicyRate,
      currentInflationRate,
      previousInflationRate,
      sourceStatus: snapshot.status,
      unresolvedFields: [
        unresolvedLabel("current policy rate", currentPolicyRate),
        unresolvedLabel("previous policy rate", previousPolicyRate),
        unresolvedLabel("current inflation", currentInflationRate),
        unresolvedLabel("previous inflation", previousInflationRate),
      ].filter(Boolean) as string[],
    };
  });
}

function buildCurrencyMap(currencies: DashboardCurrencySnapshot[]) {
  return new Map(currencies.map((item) => [item.currency, item]));
}

function sortResolved<T extends { status: "ok" | "partial" | "missing" }>(
  items: T[],
  mode: DashboardSortMode,
  pickAbsolute: (item: T) => number | null,
): T[] {
  const resolved = items.filter((item) => item.status !== "missing");
  const unresolved = items.filter((item) => item.status === "missing");

  const ordered = [...resolved];
  if (mode !== "default") {
    ordered.sort((left, right) => {
      const a = pickAbsolute(left) ?? -1;
      const b = pickAbsolute(right) ?? -1;
      return mode === "absDesc" ? b - a : a - b;
    });
  }

  return [...ordered, ...unresolved];
}

export function deriveDashboardRateCards(
  currencies: DashboardCurrencySnapshot[],
  excludedCurrencies: Set<string>,
  sortMode: DashboardSortMode,
): DashboardRateCard[] {
  const byCurrency = buildCurrencyMap(currencies);
  const cards = FX_PAIRS.filter(
    (pair) => !excludedCurrencies.has(pair.base) && !excludedCurrencies.has(pair.quote),
  ).map<DashboardRateCard>((pair) => {
    const base = byCurrency.get(pair.base);
    const quote = byCurrency.get(pair.quote);

    const currentGap =
      base?.currentPolicyRate != null && quote?.currentPolicyRate != null
        ? base.currentPolicyRate - quote.currentPolicyRate
        : null;
    const previousGap =
      base?.previousPolicyRate != null && quote?.previousPolicyRate != null
        ? base.previousPolicyRate - quote.previousPolicyRate
        : null;
    const trend = currentGap != null && previousGap != null ? currentGap - previousGap : null;

    let status: DashboardRateCard["status"] = "ok";
    if (currentGap == null && previousGap == null) {
      status = "missing";
    } else if (currentGap == null || previousGap == null || trend == null) {
      status = "partial";
    }

    return {
      pair,
      currentGap,
      previousGap,
      trend,
      isWidening: trend == null ? null : trend > 0,
      status,
    };
  });

  return sortResolved(cards, sortMode, (item) => (item.currentGap == null ? null : Math.abs(item.currentGap)));
}

export function deriveDashboardInflationCards(
  currencies: DashboardCurrencySnapshot[],
  excludedCurrencies: Set<string>,
  sortMode: DashboardSortMode,
): DashboardInflationCard[] {
  const byCurrency = buildCurrencyMap(currencies);
  const cards = FX_PAIRS.filter(
    (pair) => !excludedCurrencies.has(pair.base) && !excludedCurrencies.has(pair.quote),
  ).map<DashboardInflationCard>((pair) => {
    const base = byCurrency.get(pair.base);
    const quote = byCurrency.get(pair.quote);
    const bias =
      base?.currentInflationRate != null && quote?.currentInflationRate != null
        ? base.currentInflationRate - quote.currentInflationRate
        : null;

    return {
      pair,
      bias,
      status: bias == null ? "missing" : "ok",
    };
  });

  return sortResolved(cards, sortMode, (item) => (item.bias == null ? null : Math.abs(item.bias)));
}

export function deriveStrengthCurrencyRanks(currencies: DashboardCurrencySnapshot[]): {
  ranks: StrengthCurrencyRank[];
  excluded: DashboardCurrencySnapshot[];
} {
  const excluded = currencies.filter(
    (item) => item.currentPolicyRate == null || item.currentInflationRate == null,
  );
  const resolved = currencies.filter(
    (item) => item.currentPolicyRate != null && item.currentInflationRate != null,
  );

  if (resolved.length === 0) {
    return { ranks: [], excluded };
  }

  const rates = resolved.map((item) => item.currentPolicyRate!);
  const inflation = resolved.map((item) => item.currentInflationRate!);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const minInflation = Math.min(...inflation);
  const maxInflation = Math.max(...inflation);

  const ranks = resolved
    .map<StrengthCurrencyRank>((item) => {
      const rateScore =
        maxRate === minRate ? 5 : 10 * ((item.currentPolicyRate! - minRate) / (maxRate - minRate));
      const inflationScore =
        maxInflation === minInflation
          ? 5
          : 10 * ((item.currentInflationRate! - minInflation) / (maxInflation - minInflation));
      const score = 0.6 * rateScore + 0.4 * inflationScore;

      return {
        currency: item.currency,
        countryCode: item.countryCode,
        score: Number(score.toFixed(1)),
        rateScore: Number(rateScore.toFixed(1)),
        inflationScore: Number(inflationScore.toFixed(1)),
        currentPolicyRate: item.currentPolicyRate!,
        currentInflationRate: item.currentInflationRate!,
      };
    })
    .sort((left, right) => right.score - left.score);

  return { ranks, excluded };
}

export function deriveStrengthSuggestions(
  ranks: StrengthCurrencyRank[],
  excludedCurrencies: Set<string>,
  sortMode: StrengthSuggestionSortMode,
): SuggestedStrengthPair[] {
  const suggestions: SuggestedStrengthPair[] = [];

  for (let i = 0; i < ranks.length; i += 1) {
    for (let j = i + 1; j < ranks.length; j += 1) {
      const strong = ranks[i];
      const weak = ranks[j];
      if (excludedCurrencies.has(strong.currency) || excludedCurrencies.has(weak.currency)) {
        continue;
      }
      suggestions.push({
        strong,
        weak,
        spread: Number((strong.score - weak.score).toFixed(1)),
      });
    }
  }

  return suggestions.sort((left, right) =>
    sortMode === "spreadDesc" ? right.spread - left.spread : left.spread - right.spread,
  );
}
