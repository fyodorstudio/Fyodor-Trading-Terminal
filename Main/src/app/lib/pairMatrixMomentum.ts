import {
  findPairMatrixMomentumRule,
  type PairMatrixEconomyFactorId,
  type PairMatrixMomentumDirection,
  type PairMatrixMomentumRegistryEntry,
} from "@/app/lib/pairMatrixMomentumRegistry";
import {
  comparePairMatrixSourceValues,
  getPairMatrixCandleClose,
  type PairMatrixCurrencyTimeline,
  type PairMatrixSeriesSnapshot,
  type PairMatrixTimelineSnapshot,
} from "@/app/lib/pairMatrixSnapshot";
import type { Timeframe } from "@/app/types";

export type PairMatrixDirectionPoint = -1 | 0 | 1;
export type PairMatrixEconomyState = "improving" | "weakening" | "net_zero" | "no_scored_data";
export type PairMatrixInflationState = "heating" | "cooling" | "net_zero" | "no_scored_data";
export type PairMatrixPolicyState = "tightening" | "holding" | "easing" | "no_decision" | "no_policy_data";

export interface PairMatrixEventJudgment {
  series: PairMatrixSeriesSnapshot;
  rule: PairMatrixMomentumRegistryEntry;
  surprisePoint: PairMatrixDirectionPoint | null;
  momentumPoint: PairMatrixDirectionPoint | null;
  agreementBonus: PairMatrixDirectionPoint;
  score: number | null;
  audit: string;
}

export interface PairMatrixScoreGroupJudgment {
  id: string;
  label: string;
  score: number;
  events: PairMatrixEventJudgment[];
}

export interface PairMatrixFactorVote {
  factor: PairMatrixEconomyFactorId;
  score: number;
  vote: PairMatrixDirectionPoint;
  groups: PairMatrixScoreGroupJudgment[];
}

export interface PairMatrixEconomyJudgment {
  state: PairMatrixEconomyState;
  upCount: number;
  downCount: number;
  zeroCount: number;
  netVotes: number;
  factors: PairMatrixFactorVote[];
  audit: string;
}

export interface PairMatrixInflationJudgment {
  state: PairMatrixInflationState;
  upCount: number;
  downCount: number;
  zeroCount: number;
  groups: PairMatrixScoreGroupJudgment[];
  audit: string;
}

export interface PairMatrixPolicyJudgment {
  state: PairMatrixPolicyState;
  event: PairMatrixEventJudgment | null;
  priorEvents: PairMatrixEventJudgment[];
  audit: string;
}

export interface PairMatrixCurrencyMomentumRead {
  currency: string;
  economy: PairMatrixEconomyJudgment;
  inflation: PairMatrixInflationJudgment;
  policy: PairMatrixPolicyJudgment;
  contributors: PairMatrixEventJudgment[];
}

export interface PairMatrixMomentumSnapshot {
  during: PairMatrixCurrencyMomentumRead[];
  background: PairMatrixCurrencyMomentumRead[];
}

export interface PairMatrixReleaseRailGroup {
  candleOpen: number;
  count: number;
  titles: string[];
  currencies: string[];
}

function sign(value: number): PairMatrixDirectionPoint {
  if (value === 0) return 0;
  return value > 0 ? 1 : -1;
}

function clampGroupScore(value: number): number {
  return Math.max(-3, Math.min(3, value));
}

function orientComparison(raw: PairMatrixDirectionPoint | null, direction: PairMatrixMomentumDirection): PairMatrixDirectionPoint | null {
  if (raw == null) return null;
  return direction === "lower_is_better" ? sign(-raw) : raw;
}

function describePoint(name: "Forecast" | "Previous", point: PairMatrixDirectionPoint | null, rule: PairMatrixMomentumRegistryEntry): string {
  if (point == null) return `${name} unavailable`;
  if (point === 0) return `equal to ${name.toLowerCase()} (0)`;
  const favorable = point > 0;
  if (rule.pillar === "inflation") return `${favorable ? "hotter" : "cooler"} than ${name.toLowerCase()} (${point > 0 ? "+1" : "-1"})`;
  if (name === "Previous") return `${favorable ? "improving" : "weakening"} from previous (${point > 0 ? "+1" : "-1"})`;
  return `${favorable ? "better" : "worse"} than forecast (${point > 0 ? "+1" : "-1"})`;
}

export function scorePairMatrixSeries(series: PairMatrixSeriesSnapshot): PairMatrixEventJudgment | null {
  const rule = findPairMatrixMomentumRule(series.event);
  if (!rule) return null;

  const rawSurprise = comparePairMatrixSourceValues(series.event.actual, series.event.forecast);
  const rawMomentum = comparePairMatrixSourceValues(series.event.actual, series.event.previous);
  const surprisePoint = rule.pillar === "policy" ? null : orientComparison(rawSurprise, rule.direction);
  const momentumPoint = orientComparison(rawMomentum, rule.direction);
  const usable = surprisePoint != null || momentumPoint != null;
  const agreementBonus: PairMatrixDirectionPoint = surprisePoint != null
    && momentumPoint != null
    && surprisePoint !== 0
    && surprisePoint === momentumPoint
    ? surprisePoint
    : 0;
  const score = usable ? (surprisePoint ?? 0) + (momentumPoint ?? 0) + agreementBonus : null;
  const scoreText = score == null ? "unscored" : `${score > 0 ? "+" : ""}${score}`;
  const audit = rule.pillar === "policy"
    ? `${series.event.title}: Actual versus Previous is ${momentumPoint == null ? "unavailable" : momentumPoint > 0 ? "higher" : momentumPoint < 0 ? "lower" : "unchanged"}; policy action ${scoreText}.`
    : `${series.event.title}: ${describePoint("Forecast", surprisePoint, rule)}; ${describePoint("Previous", momentumPoint, rule)}; agreement bonus ${agreementBonus > 0 ? "+1" : agreementBonus < 0 ? "-1" : "0"}; event score ${scoreText}.`;
  return { series, rule, surprisePoint, momentumPoint, agreementBonus, score, audit };
}

function buildGroups(events: PairMatrixEventJudgment[]): PairMatrixScoreGroupJudgment[] {
  const grouped = new Map<string, PairMatrixEventJudgment[]>();
  events.forEach((event) => {
    if (event.score == null) return;
    const current = grouped.get(event.rule.scoreGroup) ?? [];
    current.push(event);
    grouped.set(event.rule.scoreGroup, current);
  });
  return [...grouped.entries()].map(([id, items]) => ({
    id,
    label: items[0]?.rule.label ?? id,
    score: clampGroupScore(items.reduce((sum, item) => sum + (item.score ?? 0), 0)),
    events: items,
  }));
}

function buildEconomy(events: PairMatrixEventJudgment[]): PairMatrixEconomyJudgment {
  const economyEvents = events.filter((event) => event.rule.pillar === "economy" && event.rule.factor && event.score != null);
  const factorMap = new Map<PairMatrixEconomyFactorId, PairMatrixEventJudgment[]>();
  economyEvents.forEach((event) => {
    const factor = event.rule.factor!;
    const current = factorMap.get(factor) ?? [];
    current.push(event);
    factorMap.set(factor, current);
  });
  const factors = [...factorMap.entries()].map(([factor, items]) => {
    const groups = buildGroups(items);
    const score = groups.reduce((sum, group) => sum + group.score, 0);
    return { factor, score, vote: sign(score), groups } satisfies PairMatrixFactorVote;
  });
  const upCount = factors.filter((factor) => factor.vote > 0).length;
  const downCount = factors.filter((factor) => factor.vote < 0).length;
  const zeroCount = factors.filter((factor) => factor.vote === 0).length;
  const netVotes = upCount - downCount;
  const state: PairMatrixEconomyState = factors.length === 0
    ? "no_scored_data"
    : netVotes > 0
      ? "improving"
      : netVotes < 0
        ? "weakening"
        : "net_zero";
  const factorAudit = factors.map((factor) => `${factor.factor} ${factor.vote > 0 ? "↑" : factor.vote < 0 ? "↓" : "0"} (${factor.score})`).join("; ");
  return {
    state,
    upCount,
    downCount,
    zeroCount,
    netVotes,
    factors,
    audit: factors.length === 0
      ? "No registered economic release has usable comparison data."
      : `Factor votes: ${upCount}↑ ${downCount}↓${zeroCount ? ` ${zeroCount} zero` : ""}; net ${netVotes}. ${factorAudit}.`,
  };
}

function buildInflation(events: PairMatrixEventJudgment[]): PairMatrixInflationJudgment {
  const groups = buildGroups(events.filter((event) => event.rule.pillar === "inflation" && event.score != null));
  const upCount = groups.filter((group) => group.score > 0).length;
  const downCount = groups.filter((group) => group.score < 0).length;
  const zeroCount = groups.filter((group) => group.score === 0).length;
  const net = groups.reduce((sum, group) => sum + group.score, 0);
  const state: PairMatrixInflationState = groups.length === 0 ? "no_scored_data" : net > 0 ? "heating" : net < 0 ? "cooling" : "net_zero";
  return {
    state,
    upCount,
    downCount,
    zeroCount,
    groups,
    audit: groups.length === 0
      ? "No registered inflation release has usable comparison data."
      : `Inflation groups: ${groups.map((group) => `${group.label} ${group.score > 0 ? "+" : ""}${group.score}`).join("; ")}; net ${net}.`,
  };
}

function buildPolicy(events: PairMatrixEventJudgment[], background: boolean): PairMatrixPolicyJudgment {
  const decisions = events
    .filter((event) => event.rule.pillar === "policy" && event.rule.canonicalPolicy && event.momentumPoint != null)
    .sort((left, right) => right.series.event.time - left.series.event.time
      || (right.rule.policyPriority ?? 0) - (left.rule.policyPriority ?? 0)
      || left.series.event.title.localeCompare(right.series.event.title));
  const event = decisions[0] ?? null;
  if (!event) {
    return {
      state: background ? "no_policy_data" : "no_decision",
      event: null,
      priorEvents: [],
      audit: background ? "No canonical policy decision is available in the background window." : "No new canonical policy decision occurred during the selected candle range.",
    };
  }
  const state: PairMatrixPolicyState = event.momentumPoint! > 0 ? "tightening" : event.momentumPoint! < 0 ? "easing" : "holding";
  return {
    state,
    event,
    priorEvents: decisions.slice(1),
    audit: `${event.series.event.title}: Actual ${event.series.event.actual} versus Previous ${event.series.event.previous} → ${state.toUpperCase()}.${decisions.length > 1 ? ` ${decisions.length - 1} earlier decision(s) are listed in the contributor audit.` : ""}`,
  };
}

function buildCurrencyRead(timeline: PairMatrixCurrencyTimeline | null, currency: string, background: boolean): PairMatrixCurrencyMomentumRead {
  const contributors = (timeline?.entries ?? []).map(scorePairMatrixSeries).filter((item): item is PairMatrixEventJudgment => item !== null && item.score != null);
  return {
    currency,
    economy: buildEconomy(contributors),
    inflation: buildInflation(contributors),
    policy: buildPolicy(contributors, background),
    contributors,
  };
}

export function buildPairMatrixMomentumSnapshot(timeline: PairMatrixTimelineSnapshot, currencies: readonly string[]): PairMatrixMomentumSnapshot {
  return {
    during: currencies.map((currency) => buildCurrencyRead(timeline.during.find((side) => side.currency === currency) ?? null, currency, false)),
    background: currencies.map((currency) => buildCurrencyRead(timeline.before.find((side) => side.currency === currency) ?? null, currency, true)),
  };
}

export function groupPairMatrixReleaseRailByCandle(params: {
  momentum: PairMatrixMomentumSnapshot;
  candleTimes: number[];
  timeframe: Timeframe;
  sourceTimeOffsetSeconds: number;
}): PairMatrixReleaseRailGroup[] {
  const sortedCandles = [...params.candleTimes].sort((left, right) => left - right);
  const groups = new Map<number, PairMatrixEventJudgment[]>();
  params.momentum.during.flatMap((read) => read.contributors).forEach((judgment) => {
    const chartTime = judgment.series.event.time + params.sourceTimeOffsetSeconds;
    let low = 0;
    let high = sortedCandles.length - 1;
    let candidate = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (sortedCandles[middle] <= chartTime) {
        candidate = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (candidate < 0) return;
    const candleOpen = sortedCandles[candidate];
    if (chartTime >= getPairMatrixCandleClose(candleOpen, params.timeframe)) return;
    const current = groups.get(candleOpen) ?? [];
    current.push(judgment);
    groups.set(candleOpen, current);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([candleOpen, judgments]) => ({
      candleOpen,
      count: judgments.length,
      titles: judgments.map((judgment) => judgment.series.event.title),
      currencies: [...new Set(judgments.map((judgment) => judgment.series.event.currency))],
    }));
}
