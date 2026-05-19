import { CURRENCY_TO_COUNTRY_CODE, FX_PAIRS, MAJOR_CURRENCY_ORDER } from "@/app/config/fxPairs";
import type { BridgeCandle } from "@/app/types";

export interface CandleStrengthPairInput {
  d1: BridgeCandle[];
  h4: BridgeCandle[];
}

export interface CandleStrengthContribution {
  pair: string;
  value: number;
  timeframe: "D1" | "H4";
}

export interface CandleStrengthCurrencyRow {
  currency: string;
  countryCode: string;
  score: number;
  state: "strong" | "mixed" | "weak";
  coverage: number;
  pairCount: number;
  averageD1: number | null;
  averageH4: number | null;
  evidence: string[];
}

export interface CurrencyCandleStrengthResult {
  rows: CandleStrengthCurrencyRow[];
  resolvedPairs: number;
  totalPairs: number;
  methodology: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getReturn(candles: BridgeCandle[], lookback: number): number | null {
  if (candles.length < lookback + 1) return null;
  const current = candles[candles.length - 1];
  const past = candles[candles.length - 1 - lookback];
  if (!current || !past || past.close === 0) return null;
  return (current.close - past.close) / past.close;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function toScore(value: number): number {
  return Number(clamp(value / 0.03, -1, 1).toFixed(4));
}

function getState(score: number): CandleStrengthCurrencyRow["state"] {
  if (score >= 0.18) return "strong";
  if (score <= -0.18) return "weak";
  return "mixed";
}

export function deriveCurrencyCandleStrength(
  candleMap: Partial<Record<string, CandleStrengthPairInput>>,
): CurrencyCandleStrengthResult {
  const d1Contributions = new Map<string, CandleStrengthContribution[]>();
  const h4Contributions = new Map<string, CandleStrengthContribution[]>();
  const coverageCounts = new Map<string, number>();

  MAJOR_CURRENCY_ORDER.forEach((currency) => {
    d1Contributions.set(currency, []);
    h4Contributions.set(currency, []);
    coverageCounts.set(currency, 0);
  });

  let resolvedPairs = 0;

  FX_PAIRS.forEach((pair) => {
    const candles = candleMap[pair.name];
    const d1Return = getReturn(candles?.d1 ?? [], 20);
    const h4Return = getReturn(candles?.h4 ?? [], 12);
    if (d1Return == null && h4Return == null) return;

    resolvedPairs += 1;
    coverageCounts.set(pair.base, (coverageCounts.get(pair.base) ?? 0) + 1);
    coverageCounts.set(pair.quote, (coverageCounts.get(pair.quote) ?? 0) + 1);

    if (d1Return != null) {
      d1Contributions.get(pair.base)?.push({ pair: pair.name, value: d1Return, timeframe: "D1" });
      d1Contributions.get(pair.quote)?.push({ pair: pair.name, value: -d1Return, timeframe: "D1" });
    }

    if (h4Return != null) {
      h4Contributions.get(pair.base)?.push({ pair: pair.name, value: h4Return, timeframe: "H4" });
      h4Contributions.get(pair.quote)?.push({ pair: pair.name, value: -h4Return, timeframe: "H4" });
    }
  });

  const rows = MAJOR_CURRENCY_ORDER.map((currency) => {
    const d1 = d1Contributions.get(currency) ?? [];
    const h4 = h4Contributions.get(currency) ?? [];
    const average = (items: CandleStrengthContribution[]) =>
      items.length > 0 ? items.reduce((sum, item) => sum + item.value, 0) / items.length : null;
    const averageD1 = average(d1);
    const averageH4 = average(h4);
    const blended = averageD1 != null && averageH4 != null ? averageD1 * 0.65 + averageH4 * 0.35 : averageD1 ?? averageH4 ?? 0;
    const score = toScore(blended);
    const strongestEvidence = [...d1, ...h4]
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
      .slice(0, 3)
      .map((item) => `${item.pair} ${item.timeframe} contributes ${formatPercent(item.value)}`);

    return {
      currency,
      countryCode: CURRENCY_TO_COUNTRY_CODE[currency],
      score,
      state: getState(score),
      coverage: Number(clamp((coverageCounts.get(currency) ?? 0) / 7, 0, 1).toFixed(2)),
      pairCount: coverageCounts.get(currency) ?? 0,
      averageD1: averageD1 == null ? null : Number(averageD1.toFixed(5)),
      averageH4: averageH4 == null ? null : Number(averageH4.toFixed(5)),
      evidence: strongestEvidence,
    } satisfies CandleStrengthCurrencyRow;
  }).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.currency.localeCompare(right.currency);
  });

  return {
    rows,
    resolvedPairs,
    totalPairs: FX_PAIRS.length,
    methodology: [
      "D1 and H4 candles only.",
      "When a pair rises, the base currency receives positive contribution and the quote receives negative contribution.",
      "Currency score is the average contribution across available pairs, not a trade signal.",
    ],
  };
}
