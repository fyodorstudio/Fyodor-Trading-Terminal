import { CURRENCY_TO_COUNTRY_CODE, FX_PAIRS, MAJOR_CURRENCY_ORDER, getFxPairByName } from "@/app/config/fxPairs";
import { classifyEventQualityFamily } from "@/app/lib/eventQuality";
import { parseNumericValue } from "@/app/lib/format";
import type {
  BridgeCandle,
  CalendarEvent,
  CentralBankSnapshot,
  FxPairDefinition,
  StrengthBoardCurrency,
  StrengthIngredientBreakdown,
  StrengthMeterResult,
  StrengthPairCandleSet,
  StrengthShortlistItem,
} from "@/app/types";

const PRICE_WEIGHT = 0.55;
const EVENT_WEIGHT = 0.25;
const STRUCTURAL_WEIGHT = 0.2;

const IMPACT_MULTIPLIER: Record<CalendarEvent["impact"], number> = {
  high: 1,
  medium: 0.65,
  low: 0.35,
};

const SURPRISE_SCALE_BY_FAMILY = {
  policy: 0.25,
  inflation: 0.25,
  labor: 1.5,
  gdp: 0.4,
  activity: 1.5,
  trade_confidence: 4,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scaleToUnit(value: number, scale: number): number {
  if (!Number.isFinite(value) || scale <= 0) return 0;
  return clamp(value / scale, -1, 1);
}

function getEma(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const initial = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const result: number[] = [initial];
  for (let index = period; index < values.length; index += 1) {
    result.push((values[index] - result[result.length - 1]) * multiplier + result[result.length - 1]);
  }
  return result;
}

function getPairCoverage(candles: StrengthPairCandleSet | undefined): number {
  if (!candles) return 0;
  const d1Coverage = candles.d1.length >= 20 ? 1 : candles.d1.length / 20;
  const h4Coverage = candles.h4.length >= 10 ? 1 : candles.h4.length / 10;
  return clamp((d1Coverage + h4Coverage) / 2, 0, 1);
}

function getPairImpulse(candles: StrengthPairCandleSet | undefined): number | null {
  if (!candles || candles.d1.length < 20 || candles.h4.length < 10) return null;

  const d1Current = candles.d1[candles.d1.length - 1];
  const d1Past = candles.d1[candles.d1.length - 20];
  const h4Current = candles.h4[candles.h4.length - 1];
  const h4Past = candles.h4[candles.h4.length - 10];
  if (!d1Current || !d1Past || !h4Current || !h4Past || d1Past.close === 0 || h4Past.close === 0) return null;

  const d1Pct = (d1Current.close - d1Past.close) / d1Past.close;
  const h4Pct = (h4Current.close - h4Past.close) / h4Past.close;
  const ema20 = getEma(candles.d1.map((candle) => candle.close), 20);
  const currentEma = ema20[ema20.length - 1];
  const emaDistance = currentEma ? (d1Current.close - currentEma) / currentEma : 0;

  const impulse =
    scaleToUnit(d1Pct, 0.04) * 0.45 +
    scaleToUnit(h4Pct, 0.025) * 0.35 +
    scaleToUnit(emaDistance, 0.015) * 0.2;

  return Number(clamp(impulse, -1, 1).toFixed(3));
}

function percentileRank(values: number[], value: number): number {
  if (values.length <= 1) return 0.5;
  const sorted = [...values].sort((left, right) => left - right);
  const index = sorted.findIndex((item) => item === value);
  const safeIndex = index === -1 ? sorted.findIndex((item) => item >= value) : index;
  const resolvedIndex = safeIndex === -1 ? sorted.length - 1 : safeIndex;
  return resolvedIndex / (sorted.length - 1);
}

function normalizeUnitRange(value: number): number {
  return Number((50 + value * 50).toFixed(1));
}

function toCoverage(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(2));
}

function toContribution(value: number, weight: number, coverage: number): number {
  return Number((value * weight * coverage).toFixed(4));
}

function buildIngredient(
  value: number,
  weight: number,
  coverage: number,
  label: string,
  evidence: string[] = [],
): StrengthIngredientBreakdown {
  return {
    value: Number(value.toFixed(3)),
    weight,
    coverage: toCoverage(coverage),
    contribution: toContribution(value, weight, coverage),
    label,
    evidence,
  };
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export function deriveCurrencyPriceStrength(
  candleMap: Partial<Record<string, StrengthPairCandleSet>>,
): Map<string, { value: number; coverage: number; evidence: string[] }> {
  const contributions = new Map<string, number[]>();
  const coverage = new Map<string, number[]>();
  const evidence = new Map<string, Array<{ pair: string; impulse: number }>>();

  MAJOR_CURRENCY_ORDER.forEach((currency) => {
    contributions.set(currency, []);
    coverage.set(currency, []);
    evidence.set(currency, []);
  });

  FX_PAIRS.forEach((pair) => {
    const candles = candleMap[pair.name];
    const impulse = getPairImpulse(candles);
    const pairCoverage = getPairCoverage(candles);
    coverage.get(pair.base)?.push(pairCoverage);
    coverage.get(pair.quote)?.push(pairCoverage);
    if (impulse == null) return;
    contributions.get(pair.base)?.push(impulse);
    contributions.get(pair.quote)?.push(-impulse);
    evidence.get(pair.base)?.push({ pair: pair.name, impulse });
    evidence.get(pair.quote)?.push({ pair: pair.name, impulse: -impulse });
  });

  const result = new Map<string, { value: number; coverage: number; evidence: string[] }>();
  MAJOR_CURRENCY_ORDER.forEach((currency) => {
    const values = contributions.get(currency) ?? [];
    const coverageValues = coverage.get(currency) ?? [];
    const average =
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const averageCoverage =
      coverageValues.length > 0 ? coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length : 0;
    const topEvidence = [...(evidence.get(currency) ?? [])]
      .sort((left, right) => Math.abs(right.impulse) - Math.abs(left.impulse))
      .slice(0, 2)
      .map((item) => `${item.pair} ${item.impulse > 0 ? "supports" : "leans against"} ${currency} (${formatPercent(item.impulse)})`);
    result.set(currency, {
      value: Number(clamp(average, -1, 1).toFixed(3)),
      coverage: toCoverage(averageCoverage),
      evidence: topEvidence,
    });
  });

  return result;
}

function getRecencyWeight(nowSeconds: number, eventTime: number): number {
  const age = nowSeconds - eventTime;
  if (age < 0 || age > 7 * 24 * 60 * 60) return 0;
  if (age <= 24 * 60 * 60) return 1;
  if (age <= 72 * 60 * 60) return 0.5;
  return 0.25;
}

function isInverseEvent(title: string): boolean {
  const normalized = title.toLowerCase();
  return normalized.includes("unemployment") || normalized.includes("jobless claims") || normalized.includes("claimant count");
}

function getSurpriseScale(family: keyof typeof SURPRISE_SCALE_BY_FAMILY): number {
  return SURPRISE_SCALE_BY_FAMILY[family];
}

export function deriveCurrencyEventPush(
  events: CalendarEvent[],
  nowSeconds: number,
): Map<string, { value: number; coverage: number; evidence: string[]; events: CalendarEvent[] }> {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  const bestEvent = new Map<string, { title: string; detail: string; score: number }>();

  MAJOR_CURRENCY_ORDER.forEach((currency) => {
    totals.set(currency, 0);
    counts.set(currency, 0);
  });

  events.forEach((event) => {
    if (!MAJOR_CURRENCY_ORDER.includes(event.currency as (typeof MAJOR_CURRENCY_ORDER)[number])) return;
    if (event.impact === "low") return;
    const recencyWeight = getRecencyWeight(nowSeconds, event.time);
    if (recencyWeight === 0) return;

    const family = classifyEventQualityFamily(event.title);
    if (!family) return;

    const actual = parseNumericValue(event.actual);
    const comparison = parseNumericValue(event.forecast) ?? parseNumericValue(event.previous);
    if (actual == null || comparison == null) return;

    let surprise = actual - comparison;
    if (isInverseEvent(event.title)) {
      surprise *= -1;
    }

    const surpriseScale = getSurpriseScale(family.family);
    const weighted =
      scaleToUnit(surprise, surpriseScale) *
      (family.weight / 8) *
      IMPACT_MULTIPLIER[event.impact] *
      recencyWeight;

    const prior = totals.get(event.currency) ?? 0;
    totals.set(event.currency, clamp(prior + weighted, -1, 1));
    counts.set(event.currency, (counts.get(event.currency) ?? 0) + 1);

    const detail = `${event.title}: actual ${event.actual || "n/a"} vs ${event.forecast || event.previous || "n/a"}`;
    const currentBest = bestEvent.get(event.currency);
    if (!currentBest || Math.abs(weighted) > Math.abs(currentBest.score)) {
      bestEvent.set(event.currency, {
        title: event.title,
        detail,
        score: weighted,
      });
    }
  });

  const result = new Map<string, { value: number; coverage: number; evidence: string[]; events: CalendarEvent[] }>();
  MAJOR_CURRENCY_ORDER.forEach((currency) => {
    const count = counts.get(currency) ?? 0;
    const eventDetail = bestEvent.get(currency);
    result.set(currency, {
      value: Number((totals.get(currency) ?? 0).toFixed(3)),
      coverage: count > 0 ? 1 : 0,
      evidence: eventDetail ? [eventDetail.detail] : [],
      events: events
        .filter((event) => event.currency === currency)
        .sort((left, right) => right.time - left.time)
        .slice(0, 2),
    });
  });

  return result;
}

export function deriveCurrencyStructuralBackdrop(
  snapshots: CentralBankSnapshot[],
): Map<string, { value: number; coverage: number; evidence: string[] }> {
  const byCurrency = new Map(snapshots.map((snapshot) => [snapshot.currency, snapshot]));
  const resolved = MAJOR_CURRENCY_ORDER.map((currency) => {
    const snapshot = byCurrency.get(currency);
    const rate = parseNumericValue(snapshot?.currentPolicyRate ?? "");
    const inflation = parseNumericValue(snapshot?.currentInflationRate ?? "");
    const realRate = rate != null && inflation != null ? rate - inflation : null;
    return {
      currency,
      rate,
      realRate,
      coverage: rate != null && realRate != null ? 1 : rate != null || inflation != null ? 0.5 : 0,
    };
  });

  const resolvedRates = resolved.filter((item) => item.rate != null).map((item) => item.rate as number);
  const resolvedRealRates = resolved.filter((item) => item.realRate != null).map((item) => item.realRate as number);
  const result = new Map<string, { value: number; coverage: number; evidence: string[] }>();

  resolved.forEach((item) => {
    if (item.rate == null || item.realRate == null || resolvedRates.length === 0 || resolvedRealRates.length === 0) {
      result.set(item.currency, { value: 0, coverage: item.coverage, evidence: [] });
      return;
    }

    const ratePercentile = percentileRank(resolvedRates, item.rate);
    const realRatePercentile = percentileRank(resolvedRealRates, item.realRate);
    const value = ((ratePercentile * 2 - 1) * 0.45) + ((realRatePercentile * 2 - 1) * 0.55);

    result.set(item.currency, {
      value: Number(clamp(value, -1, 1).toFixed(3)),
      coverage: item.coverage,
      evidence: [`Rate ${item.rate.toFixed(2)}%, real-rate proxy ${item.realRate.toFixed(2)}%`],
    });
  });

  return result;
}

function getCurrencyTags(currency: StrengthBoardCurrency): string[] {
  const tags: string[] = [];
  if (currency.price.value >= 0.35) tags.push("winning on price");
  if (currency.price.value <= -0.35) tags.push("losing on price");
  if (currency.event.value >= 0.2) tags.push("recent event support");
  if (currency.event.value <= -0.2) tags.push("recent event drag");
  if (currency.structural.value >= 0.2) tags.push("macro backdrop support");
  if (currency.structural.value <= -0.2) tags.push("macro backdrop soft");
  if (currency.partial) tags.push("data still partial");
  return tags.slice(0, 3);
}

function getCurrencyEvidence(currency: {
  price: { value: number; evidence: string[] };
  event: { value: number; evidence: string[] };
  structural: { value: number; evidence: string[] };
  partial: boolean;
}): string[] {
  const lines: string[] = [];
  if (currency.price.value >= 0.35 || currency.price.value <= -0.35) {
    lines.push(currency.price.evidence[0] ?? "Price evidence is limited.");
  }
  if (currency.event.value >= 0.2 || currency.event.value <= -0.2) {
    lines.push(currency.event.evidence[0] ?? "Recent event evidence is limited.");
  }
  if (currency.structural.value >= 0.2 || currency.structural.value <= -0.2) {
    lines.push(currency.structural.evidence[0] ?? "Macro backdrop evidence is limited.");
  }
  if (currency.partial) {
    lines.push("Some inputs are still partial.");
  }
  return lines.slice(0, 3);
}

function getCurrencySummary(state: StrengthBoardCurrency["state"], currency: string): string {
  if (state === "strong") return `${currency} is one of the cleaner board winners right now.`;
  if (state === "weak") return `${currency} is one of the weaker board currencies right now.`;
  return `${currency} is not giving a clean board read right now.`;
}

function getCurrencyState(index: number, length: number): StrengthBoardCurrency["state"] {
  if (index <= 1) return "strong";
  if (index >= Math.max(length - 2, 0)) return "weak";
  return "mixed";
}

function getCurrencyStateLabel(state: StrengthBoardCurrency["state"]): string {
  if (state === "strong") return "winning broadly";
  if (state === "weak") return "losing broadly";
  return "unclear";
}

function getSoonRisk(events: CalendarEvent[], pair: FxPairDefinition, nowSeconds: number): boolean {
  return events.some(
    (event) =>
      event.impact === "high" &&
      event.time >= nowSeconds &&
      event.time <= nowSeconds + 24 * 60 * 60 &&
      (event.currency === pair.base || event.currency === pair.quote),
  );
}

function buildReasonTags(
  pair: FxPairDefinition,
  stronger: StrengthBoardCurrency,
  weaker: StrengthBoardCurrency,
  directionAgreement: boolean,
  eventSensitiveSoon: boolean,
): string[] {
  const tags: string[] = [];
  if (stronger.price.value >= 0.35) tags.push(`${stronger.currency} winning on price`);
  if (stronger.event.value >= 0.2) tags.push(`${stronger.currency} has event support`);
  if (stronger.structural.value >= 0.2) tags.push(`${stronger.currency} has macro support`);
  if (directionAgreement) tags.push("pair agrees with that read");
  if (eventSensitiveSoon) tags.push("event risk soon");
  if (stronger.partial || weaker.partial) tags.push("data still partial");

  if (tags.length === 0) {
    tags.push("read still mixed");
  }

  return tags.slice(0, 3);
}

export function deriveStrengthMeterResult(params: {
  snapshots: CentralBankSnapshot[];
  events: CalendarEvent[];
  candleMap: Partial<Record<string, StrengthPairCandleSet>>;
  nowSeconds?: number;
}): StrengthMeterResult {
  const nowSeconds = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const priceMap = deriveCurrencyPriceStrength(params.candleMap);
  const eventMap = deriveCurrencyEventPush(params.events, nowSeconds);
  const structuralMap = deriveCurrencyStructuralBackdrop(params.snapshots);

  const currencies = MAJOR_CURRENCY_ORDER.map((currency) => {
    const price = priceMap.get(currency) ?? { value: 0, coverage: 0 };
    const event = eventMap.get(currency) ?? { value: 0, coverage: 0 };
    const structural = structuralMap.get(currency) ?? { value: 0, coverage: 0 };
    const compositeRaw =
      price.value * PRICE_WEIGHT * price.coverage +
      event.value * EVENT_WEIGHT * event.coverage +
      structural.value * STRUCTURAL_WEIGHT * structural.coverage;
    const coverage = (price.coverage + Math.max(event.coverage, 0.35) + structural.coverage) / 3;

    return {
      currency,
      countryCode: CURRENCY_TO_COUNTRY_CODE[currency],
      compositeScore: normalizeUnitRange(clamp(compositeRaw, -1, 1)),
      state: "mixed" as const,
      partial: coverage < 0.75 || structural.coverage < 1 || price.coverage < 0.7,
      coverage: toCoverage(coverage),
      price: buildIngredient(price.value, PRICE_WEIGHT, price.coverage, "Price strength", price.evidence),
      event: buildIngredient(event.value, EVENT_WEIGHT, event.coverage, "Recent event push", event.evidence),
      structural: buildIngredient(structural.value, STRUCTURAL_WEIGHT, structural.coverage, "Structural backdrop", structural.evidence),
      summary: "",
      evidence: [],
      eventRefs: event.events,
      tags: [],
    };
  })
    .sort((left, right) => right.compositeScore - left.compositeScore)
    .map((currency, index, list) => {
      const nextCurrency: StrengthBoardCurrency = {
        ...currency,
        state: getCurrencyState(index, list.length),
        stateLabel: getCurrencyStateLabel(getCurrencyState(index, list.length)),
      };
      return {
        ...nextCurrency,
        summary: getCurrencySummary(nextCurrency.state, nextCurrency.currency),
        evidence: getCurrencyEvidence(nextCurrency),
        tags: getCurrencyTags(nextCurrency),
      };
    });

  const currencyMap = new Map(currencies.map((currency) => [currency.currency, currency]));

  const pairRankings = FX_PAIRS.map((pair) => {
    const base = currencyMap.get(pair.base);
    const quote = currencyMap.get(pair.quote);
    if (!base || !quote) return null;

    const stronger = base.compositeScore >= quote.compositeScore ? base : quote;
    const weaker = stronger.currency === base.currency ? quote : base;
    const gap = Number(Math.abs(base.compositeScore - quote.compositeScore).toFixed(1));
    const pairImpulse = getPairImpulse(params.candleMap[pair.name]);
    const directionAgreement =
      pairImpulse != null &&
      ((stronger.currency === pair.base && pairImpulse > 0) || (stronger.currency === pair.quote && pairImpulse < 0));
    const eventSensitiveSoon = getSoonRisk(params.events, pair, nowSeconds);
    const partial = stronger.partial || weaker.partial || getPairCoverage(params.candleMap[pair.name]) < 0.7;

    let score = gap;
    if (directionAgreement) score += 8;
    if (partial) score -= 10;
    if (eventSensitiveSoon) score -= 12;

    const normalizedScore = Number(clamp(score, 0, 100).toFixed(1));
    const label: StrengthShortlistItem["label"] =
      normalizedScore >= 45 ? "Open first" : normalizedScore >= 25 ? "Backup watchlist" : "Skip for now";
    const summary =
      label === "Open first"
        ? `Start with ${pair.name}. ${stronger.currency} is giving the cleaner read against ${weaker.currency}.`
        : label === "Backup watchlist"
          ? `${pair.name} is usable as a backup check, but not the first chart to open.`
          : `${pair.name} is not a good first look right now.`;
    const caution =
      eventSensitiveSoon
        ? "A relevant high-impact event is close."
        : partial
          ? "Some of the supporting data is still partial."
          : null;

    return {
      pair,
      score: normalizedScore,
      label,
      strongerCurrency: stronger.currency,
      weakerCurrency: weaker.currency,
      summary,
      caution,
      directionAgreement: Boolean(directionAgreement),
      eventSensitiveSoon,
      partial,
      reasonTags: buildReasonTags(pair, stronger, weaker, Boolean(directionAgreement), eventSensitiveSoon),
      evidence: [
        ...(stronger.evidence.slice(0, 2)),
        directionAgreement ? `${pair.name} itself agrees with the broader read.` : `${pair.name} itself is not fully confirming the broader read.`,
        eventSensitiveSoon ? "A relevant high-impact event is close." : "No immediate high-impact event is blocking the pair.",
      ].slice(0, 4),
      eventRefs: [...stronger.eventRefs, ...weaker.eventRefs]
        .filter((event, index, list) => list.findIndex((item) => item.id === event.id && item.time === event.time) === index)
        .slice(0, 3),
      gap,
    } satisfies StrengthShortlistItem;
  })
    .filter((item): item is StrengthShortlistItem => item !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.gap !== left.gap) return right.gap - left.gap;
      return left.pair.name.localeCompare(right.pair.name);
    });

  return {
    currencies,
    shortlist: pairRankings.slice(0, 5),
    lowerPriority: [...pairRankings].reverse().slice(0, 5).reverse(),
    partialCurrencies: currencies.filter((currency) => currency.partial).map((currency) => currency.currency),
    methodology: [
      "Open the top pairs in TradingView first, then do your normal D1 to H4 to H1 chart read.",
      "This tab only helps choose where to look first. It does not decide entries, stops, or targets for you.",
      "Pairs move up when one side is winning broadly, the direct pair agrees, and event risk is not too close.",
    ],
  };
}

export function getStrengthSummaryForPair(params: {
  reviewSymbol: string;
  snapshots: CentralBankSnapshot[];
  events: CalendarEvent[];
  candleMap: Partial<Record<string, StrengthPairCandleSet>>;
  nowSeconds?: number;
}): {
  unresolved: boolean;
  strongerCurrency: string | null;
  weakerCurrency: string | null;
  scoreGap: number | null;
  decisive: boolean;
  title: string;
  detail: string;
} {
  const pair = getFxPairByName(params.reviewSymbol);
  if (!pair) {
    return {
      unresolved: true,
      strongerCurrency: null,
      weakerCurrency: null,
      scoreGap: null,
      decisive: false,
      title: "Strength board unresolved.",
      detail: "Pair mapping is unavailable.",
    };
  }

  const result = deriveStrengthMeterResult(params);
  const base = result.currencies.find((item) => item.currency === pair.base);
  const quote = result.currencies.find((item) => item.currency === pair.quote);
  if (!base || !quote) {
    return {
      unresolved: true,
      strongerCurrency: null,
      weakerCurrency: null,
      scoreGap: null,
      decisive: false,
      title: "Strength board unresolved.",
      detail: "The board could not resolve one side of the pair.",
    };
  }

  const stronger = base.compositeScore >= quote.compositeScore ? base : quote;
  const weaker = stronger.currency === base.currency ? quote : base;
  const scoreGap = Number(Math.abs(stronger.compositeScore - weaker.compositeScore).toFixed(1));
  const partial = base.partial || quote.partial;

  return {
    unresolved: false,
    strongerCurrency: stronger.currency,
    weakerCurrency: weaker.currency,
    scoreGap,
    decisive: scoreGap >= 18,
    title: `${stronger.currency} has the cleaner board strength in ${pair.name}.`,
    detail: partial ? `Board gap ${scoreGap.toFixed(1)} pts with partial coverage.` : `Board gap ${scoreGap.toFixed(1)} pts.`,
  };
}
