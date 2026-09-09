import { FmsReleaseCards } from "@/app/components/FmsReleaseCards";
import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { formatJakartaDisplayDateTime } from "@/app/lib/format";
import entryResearch from "@/app/lib/fmsEntryResearchSummary.json";
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalPatternAssessment, MacroSignalUpcomingPatternWatch } from "@/app/types";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type ForwardSetupSummary = NonNullable<ChartMacroBiasRealtimeCardData["globalResponse"]>["forwardValidation"] extends infer T
  ? T extends { setupSummaries: Array<infer R> } ? R : never
  : never;

export type RegisteredSetupScheduleRow = {
  key: string;
  market: string;
  pattern: MacroSignalChartPattern;
  watch: MacroSignalUpcomingPatternWatch | null;
};

export type RecentFmsActivityRow = {
  key: string;
  market: string;
  label: string;
  time: number;
  direction: "long" | "short" | null;
  state: string;
  source: "live" | "recovered" | "decision";
  pattern: MacroSignalChartPattern;
  signal: MacroSignalChartSignal | null;
  assessment: MacroSignalPatternAssessment | null;
};

export type FmsTradeView = "next" | "current" | "recent";

export type FmsTradeScrollAnchor = {
  key: string | null;
  offset: number;
  scrollTop: number;
};

export type FmsTradeViewState = {
  activeView: FmsTradeView;
  expandedScheduleKey: string | null;
  expandedActivityKey: string | null;
  setupSearch: string;
  hideNoTrade: boolean;
  scroll: Record<FmsTradeView, FmsTradeScrollAnchor>;
};

export const DEFAULT_FMS_TRADE_VIEW_STATE: FmsTradeViewState = {
  activeView: "next",
  expandedScheduleKey: null,
  expandedActivityKey: null,
  setupSearch: "",
  hideNoTrade: false,
  scroll: {
    next: { key: null, offset: 0, scrollTop: 0 },
    current: { key: null, offset: 0, scrollTop: 0 },
    recent: { key: null, offset: 0, scrollTop: 0 },
  },
};

function signalActivityState(signal: MacroSignalChartSignal): string {
  if (signal.entry == null && signal.prospectiveCapture?.eligible) return "Waiting for entry";
  if (signal.entry == null) return "No trade open · entry unavailable";
  if (signal.outcomeStatus === "pending") return "Trade open";
  if (signal.outcomeStatus === "target_hit") return `TP reached${signal.resultR == null ? "" : ` · ${signal.resultR >= 0 ? "+" : ""}${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "stop_hit") return `SL reached${signal.resultR == null ? "" : ` · ${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "expired") return `Expired${signal.resultR == null ? "" : ` · ${signal.resultR >= 0 ? "+" : ""}${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "ambiguous") return "Ambiguous result";
  return "Not evaluable";
}

export function buildRecentFmsActivity(markets: MacroSignalChartSignalResponse[], now = Math.floor(Date.now() / 1000)): RecentFmsActivityRow[] {
  const rows = new Map<string, RecentFmsActivityRow>();
  for (const market of markets) {
    const patterns = new Map(market.patterns.map((pattern) => [pattern.id, pattern]));
    const signals = [...market.signals, ...(market.recoveredSignals ?? [])];
    const signalsByDecision = new Map(signals.map((signal) => [`${signal.patternId}:${signal.eventTime}`, signal]));
    const assessments = market.realtime?.patternAssessments ?? market.realtime?.latestPatternAssessments
      ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : []);
    for (const assessment of assessments) {
      const pattern = patterns.get(assessment.patternId);
      if (!pattern) continue;
      const signal = signalsByDecision.get(`${assessment.patternId}:${assessment.time}`) ?? null;
      const source = signal?.observationMode === "recovered_offline" ? "recovered" : signal ? "live" : "decision";
      const state = signal
        ? signalActivityState(signal)
        : assessment.status === "no_trade" ? "No trade"
        : assessment.status === "late_for_contract" ? "Audit only · late"
        : assessment.status === "awaiting_observation" ? "Awaiting release data"
        : assessment.status === "qualified" ? "Qualified"
        : "Audit only";
      const key = `${market.symbol}:${assessment.patternId}:${assessment.time}`;
      rows.set(key, { key, market: market.symbol, label: pattern.label ?? pattern.id, time: signal?.exitTime ?? assessment.time, direction: signal?.direction ?? assessment.direction, state, source, pattern, signal, assessment });
    }
    // A scheduled release must survive the gap before its first assessment.
    for (const watch of market.realtime?.upcomingPatternWatches ?? []) {
      if (watch.time > now) continue;
      const pattern = patterns.get(watch.patternId);
      const key = `${market.symbol}:${watch.patternId}:${watch.time}`;
      if (!pattern || rows.has(key) || signalsByDecision.has(`${watch.patternId}:${watch.time}`)) continue;
      const assessment: MacroSignalPatternAssessment = {
        time: watch.time, patternId: watch.patternId, label: watch.label,
        condition: watch.condition, status: "awaiting_observation", direction: null,
        reason: "Scheduled release time reached. Waiting for the bridge to record and evaluate the released values.",
        events: watch.events,
      };
      rows.set(key, { key, market: market.symbol, label: pattern.label ?? pattern.id,
        time: watch.time, direction: null, state: "Awaiting release data", source: "decision", pattern, signal: null, assessment });
    }
    for (const signal of signals) {
      const pattern = patterns.get(signal.patternId);
      if (!pattern) continue;
      const key = `${market.symbol}:${signal.patternId}:${signal.eventTime}`;
      if (rows.has(key)) continue;
      rows.set(key, {
        key,
        market: market.symbol,
        label: pattern.label ?? pattern.id,
        time: signal.exitTime ?? signal.eventTime,
        direction: signal.direction,
        state: signalActivityState(signal),
        source: signal.observationMode === "recovered_offline" ? "recovered" : "live",
        pattern,
        signal,
        assessment: null,
      });
    }
  }
  return [...rows.values()].sort((left, right) => right.time - left.time || left.market.localeCompare(right.market) || left.label.localeCompare(right.label));
}

export function partitionFmsActivity(activity: RecentFmsActivityRow[], _now: number) {
  const current: RecentFmsActivityRow[] = [];
  const recent: RecentFmsActivityRow[] = [];
  for (const row of activity) {
    const pending = row.signal?.outcomeStatus === "pending";
    const waitingForEntry = row.signal?.entry == null && row.signal?.prospectiveCapture?.eligible === true && row.signal.outcomeStatus === "unevaluable";
    const awaiting = !row.signal && (row.assessment?.status === "awaiting_observation" || row.assessment?.status === "qualified");
    ((pending || waitingForEntry || awaiting) ? current : recent).push(row);
  }
  return { current, recent };
}

export function buildRegisteredSetupSchedule(
  markets: MacroSignalChartSignalResponse[],
  now: number,
): RegisteredSetupScheduleRow[] {
  return markets.flatMap((market) => {
    const futureWatches = (market.realtime?.upcomingPatternWatches
      ?? (market.realtime?.nextPatternWatch ? [market.realtime.nextPatternWatch] : []))
      .filter((watch) => watch.time >= now)
      .sort((left, right) => left.time - right.time);
    return market.patterns
      .filter((pattern) => pattern.currentEligible)
      .flatMap((pattern) => {
        const watches = futureWatches.filter((watch) => watch.patternId === pattern.id);
        return (watches.length ? watches : [null]).map((watch) => ({
          key: `${market.symbol}:${pattern.id}:${watch?.time ?? "undated"}`,
          market: market.symbol,
          pattern,
          watch,
        }));
      });
  }).sort((left, right) => {
    if (left.watch && right.watch) return left.watch.time - right.watch.time || left.market.localeCompare(right.market) || (left.pattern.label ?? left.pattern.id).localeCompare(right.pattern.label ?? right.pattern.id);
    if (left.watch) return -1;
    if (right.watch) return 1;
    return left.market.localeCompare(right.market) || (left.pattern.label ?? left.pattern.id).localeCompare(right.pattern.label ?? right.pattern.id);
  });
}

export function getTradeMarkets(data: { response: MacroSignalChartSignalResponse; globalResponse?: { markets: MacroSignalChartSignalResponse[] } | null }): MacroSignalChartSignalResponse[] {
  const markets = new Map((data.globalResponse?.markets ?? []).map((market) => [market.symbol, market]));
  const selected = data.response;
  const previous = markets.get(selected.symbol);
  if (!previous || (selected.generatedAt ?? 0) >= (previous.generatedAt ?? 0)) markets.set(selected.symbol, selected);
  return [...markets.values()].filter((market) => market.supported);
}

const tradeDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

function TradeDate({ label, time, fallback = "Not recorded" }: { label: string; time?: number | null; fallback?: string }) {
  return <div className="fms-trade-date"><span>{label}</span>{time != null
    ? <time dateTime={new Date(time * 1000).toISOString()}>{tradeDateFormatter.format(new Date(time * 1000))}</time>
    : <span className="fms-trade-date-empty">{fallback}</span>}</div>;
}

function humanizeSetupId(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function setupOptionLabel(option: { id: string; label: string }): string {
  return option.label && option.label !== option.id ? option.label : humanizeSetupId(option.id);
}

function countdownLabel(targetTime: number, now: number): string {
  const remaining = Math.max(0, targetTime - now);
  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function PairFlags({ symbol }: { symbol: string }) {
  return (
    <span className="fms-action-flags" aria-hidden="true">
      <FlagIcon countryCode={CURRENCY_TO_COUNTRY_CODE[symbol.slice(0, 3) as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? ""} />
      <FlagIcon countryCode={CURRENCY_TO_COUNTRY_CODE[symbol.slice(3, 6) as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? ""} />
    </span>
  );
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function decisionSummary(assessment: MacroSignalPatternAssessment | null): string {
  if (!assessment) return "No separate release decision loaded.";
  const reason = assessment.reason;
  const ruleEnd = reason.indexOf("Frozen rule:");
  if (ruleEnd >= 0) {
    const result = reason.slice(ruleEnd).match(/(?:This package|No complete|The package)[\s\S]*/);
    if (result) return result[0];
  }
  return reason;
}

function assessmentReading(market: string, assessment: MacroSignalPatternAssessment): string {
  const currencies = new Set(assessment.events.map((event) => event.currency));
  if (currencies.size !== 1) return "Multiple currencies: inspect each release below";
  const currency = assessment.events[0]?.currency;
  const total = assessment.calculations?.reduce((sum, row) => sum + row.score, 0) ?? 0;
  if (!currency || total === 0) return "Mixed or neutral economic reading";
  const positive = total > 0;
  const pairDirection = market.startsWith(currency) ? positive ? "higher" : "lower" : positive ? "lower" : "higher";
  return `${currency}-${positive ? "positive" : "negative"} · economic pressure favors ${market} ${pairDirection}`;
}

function price(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "Unavailable" : value.toFixed(5);
}

function pipDistance(market: string, from: number | null | undefined, to: number | null | undefined): string {
  if (from == null || to == null) return "Unavailable";
  return `${(Math.abs(to - from) / (market.endsWith("JPY") ? .01 : .0001)).toFixed(1)} pips`;
}

function executionLabel(signal: MacroSignalChartSignal, pattern: MacroSignalChartPattern): string {
  const execution = signal.execution ?? pattern.execution;
  const management = execution?.managementFamily === "break_even"
    ? ` · SL to entry after +${execution.managementTriggerR ?? 1}R`
    : "";
  return `${signal.entryTimeframe ?? execution?.entryTimeframe ?? "H4"} entry · SL ${execution?.stopAtr ?? 1} ATR · TP ${execution?.targetR ?? 2}R · maximum ${execution?.expiryCandles ?? 30} H4${management}`;
}

function patternExecutionLabel(pattern: MacroSignalChartPattern): string {
  const execution = pattern.execution;
  const management = execution?.managementFamily === "break_even"
    ? ` · move SL to entry after +${execution.managementTriggerR ?? 1}R`
    : "";
  return `${execution?.entryTimeframe ?? "H4"} · SL ${execution?.stopAtr ?? 1} ATR · TP ${execution?.targetR ?? 2}R · max ${execution?.expiryCandles ?? 30} H4${management}`;
}

type HistoricalRecord = {
  scope: string;
  cohort: { dimension: string; value: string };
  sourceId: string | null;
  sample: number;
  targetHitCount: number | null;
  tpRate: number | null;
  stopHitCount: number | null;
  stopRate: number | null;
  expiredCount: number | null;
  breakEvenCount: number | null;
  ambiguousCount: number | null;
  ambiguousCases: Array<{ caseId?: string | null; eventTime?: number | null; reason?: string | null }>;
  unevaluableCount: number | null;
  averageR: number | null;
  totalR: number | null;
  totalComputed: boolean;
};

function historicalRecord(pattern: MacroSignalChartPattern): HistoricalRecord {
  const evidence = pattern.historicalEvidence;
  if (evidence) return {
    scope: evidence.scope,
    cohort: evidence.cohort,
    sourceId: evidence.sourceId,
    sample: evidence.evaluableCount,
    targetHitCount: evidence.targetHitCount,
    tpRate: evidence.targetHitRate,
    stopHitCount: evidence.stopHitCount,
    stopRate: evidence.stopHitRate,
    expiredCount: evidence.expiredCount,
    breakEvenCount: evidence.breakEvenCount,
    ambiguousCount: evidence.ambiguousCount,
    ambiguousCases: evidence.ambiguousCases ?? [],
    unevaluableCount: evidence.unevaluableCount,
    averageR: evidence.averageGrossR,
    totalR: evidence.totalGrossR,
    totalComputed: evidence.totalGrossRDerivation === "exact_mean_times_evaluable_n",
  };
  const metrics = pattern.overall;
  return {
    scope: "Overall registered-contract history",
    cohort: pattern.cohort ?? { dimension: "none", value: "all" },
    sourceId: pattern.historicalBenchmark?.experimentId ?? null,
    sample: metrics.evaluableCount,
    targetHitCount: metrics.targetHitCount,
    tpRate: metrics.targetHitRate,
    stopHitCount: metrics.stopHitCount,
    stopRate: metrics.stopHitRate,
    expiredCount: metrics.expiredCount,
    breakEvenCount: null,
    ambiguousCount: metrics.ambiguousCount,
    ambiguousCases: [],
    unevaluableCount: metrics.unevaluableCount,
    averageR: metrics.averageR,
    totalR: metrics.averageR == null ? null : metrics.averageR * metrics.evaluableCount,
    totalComputed: metrics.averageR != null,
  };
}

function countAndRate(count: number | null, rate: number | null): string {
  if (count == null && rate == null) return "Not recorded for this cohort";
  if (count == null) return `${(Number(rate) * 100).toFixed(1)}% · exact count not stored`;
  return `${count}${rate == null ? "" : ` · ${(rate * 100).toFixed(1)}%`}`;
}

function cohortLabel(cohort: { dimension: string; value: string }): string {
  return cohort.dimension === "none" ? "All matching cases" : `${humanizeSetupId(cohort.dimension)}: ${humanizeSetupId(cohort.value)}`;
}

function HistoricalBenchmark({ pattern }: { pattern: MacroSignalChartPattern }) {
  const record = historicalRecord(pattern);
  const other = [
    `Expired ${record.expiredCount ?? "unavailable"}`,
    record.breakEvenCount == null ? null : `Break-even ${record.breakEvenCount}`,
    `Ambiguous ${record.ambiguousCount ?? "unavailable"}`,
    `Unevaluable ${record.unevaluableCount ?? "unavailable"}`,
  ].filter(Boolean).join(" · ");
  return <div className="fms-history-benchmark">
    <p><strong>{record.scope}</strong><span>{cohortLabel(record.cohort)}{record.sourceId ? ` · ${record.sourceId}` : ""}</span></p>
    <dl>
      <div><dt>Evaluable N</dt><dd>{record.sample}</dd></div>
      <div><dt>TP hits</dt><dd>{countAndRate(record.targetHitCount, record.tpRate)}</dd></div>
      <div><dt>SL hits</dt><dd>{countAndRate(record.stopHitCount, record.stopRate)}</dd></div>
      <div><dt>Other</dt><dd>{other}</dd></div>
      <div><dt>Total gross R</dt><dd>{record.totalR == null ? "Unavailable" : `${signed(Number(record.totalR.toFixed(2)))}R${record.totalComputed ? " · computed from exact mean × N" : ""}`}</dd></div>
      <div><dt>Average gross R</dt><dd>{record.averageR == null ? "Unavailable" : `${signed(Number(record.averageR.toFixed(3)))}R`}</dd></div>
    </dl>
    <details className="fms-history-definitions">
      <summary>Outcome definitions{record.ambiguousCount ? ` · inspect ${record.ambiguousCount} ambiguous` : ""}</summary>
      <p><b>Expired:</b> neither SL nor TP was reached before the frozen maximum duration; the final candle determines gross R. <b>Ambiguous:</b> SL and TP were both touched inside one H4 candle and available finer data could not prove which came first. <b>Unevaluable:</b> required entry, ATR, or outcome candles were missing, so no result was invented.</p>
      {record.ambiguousCases.length ? <ul>{record.ambiguousCases.map((row, index) => <li key={row.caseId ?? `${row.eventTime}:${index}`}><strong>{row.eventTime == null ? "Time unavailable" : formatJakartaDisplayDateTime(row.eventTime)}</strong><span>{row.caseId ?? "Case ID unavailable"} · {row.reason ?? "SL/TP order unresolved"}</span></li>)}</ul> : record.ambiguousCount ? <small>The source records the ambiguous count but not case-level identifiers. Use source {record.sourceId ?? "ID unavailable"} for a raw-case audit.</small> : <small>No ambiguous case is recorded in this cohort.</small>}
    </details>
  </div>;
}

function setupEvidenceLabel(pattern: MacroSignalChartPattern): { primary: string; quirks: string[] } {
  const record = historicalRecord(pattern);
  const target = pattern.reactionAudit?.profile?.targetEvidence;
  const quirks: string[] = [];
  if (target?.label === "rare_outsized_wins") quirks.push("Rare-winner dependent");
  if (typeof target?.medianR === "number" && target.medianR < 0) quirks.push("Median loss");
  if ((target?.expiredRate ?? 0) >= .2) quirks.push("Expiry dependent");
  if (record.sample < 20) quirks.push("Small sample");
  if ((target?.longestLosingStreak ?? 0) >= 6) quirks.push("Long losing streak");
  if (pattern.contextRegistration?.status === "reviewed_active" && !pattern.contextRegistration.retiredAt) quirks.push("Context conditional");
  const primary = target?.label === "rare_outsized_wins"
    ? "Fragile payoff shape"
    : record.tpRate != null && record.tpRate >= .65
      ? "High TP frequency"
      : record.averageR != null && record.averageR > 0
        ? "Balanced expectancy"
        : "Evidence needs review";
  return { primary, quirks: [...new Set(quirks)] };
}

function forwardEvidenceLabel(summary: ForwardSetupSummary | null | undefined): { label: string; tone: string; detail: string } {
  if (!summary) return { label: "Awaiting fresh evidence", tone: "is-collecting", detail: "No true first-seen resolved case yet." };
  const average = summary.averageR == null ? "—" : `${summary.averageR >= 0 ? "+" : ""}${summary.averageR.toFixed(2)}R`;
  const detail = `${summary.resolvedCases} fresh resolved · ${average} average`;
  if (summary.status === "prospectively_supported" || summary.status === "supportive") return { label: "Prospectively supported", tone: "is-supportive", detail };
  if (summary.status === "pause_candidate") return { label: "Pause candidate", tone: "is-degraded", detail };
  if (summary.status === "weakening" || summary.status === "degraded") return { label: "Weakening", tone: "is-degraded", detail };
  if (summary.status === "promising_unproven") return { label: "Promising, unproven", tone: "is-supportive", detail };
  if (summary.status === "coverage_incomplete") return { label: "Quote coverage incomplete", tone: "is-incomplete", detail };
  return { label: "Early observation", tone: "is-collecting", detail };
}

function positionCurrencyExposure(market: string, direction: "long" | "short"): Record<string, number> {
  const sign = direction === "long" ? 1 : -1;
  return { [market.slice(0, 3)]: sign, [market.slice(3, 6)]: -sign };
}

function entryResearchNote(market: string, pattern: MacroSignalChartPattern): string {
  const recipe = `${market}|${pattern.id}`;
  const hourly = entryResearch.sessionHourly.findings.find((row) => row.recipe === recipe);
  const activeReview = entryResearch.activeEntryReview.findings.find((row) => row.recipe === recipe);
  const preH4 = entryResearch.preH4Reaction.findings.find((row) => row.recipe === recipe)?.later;
  const minute = entryResearch.minute.findings.find((row) => row.recipe === recipe);
  const later = hourly?.later;
  const hourlyConclusion = hourly?.developmentSelectedEntry === "H1" && later?.n
    ? later.pairedUpliftR != null && later.pairedUpliftR > 0 && (later.h1AverageR ?? 0) > 0
      ? `H1 remained positive on ${later.n} later matched cases (${later.pairedUpliftR >= 0 ? "+" : ""}${later.pairedUpliftR.toFixed(2)}R versus H4), but coverage is selective.`
      : `H1 was favored during development but did not improve the ${later.n} later matched cases.`
    : "The frozen H1 campaign did not support selecting an earlier entry for this recipe.";
  const minuteCoverage = minute?.matched
    ? ` Recent M1/H1/H4 comparison: ${minute.matched} matched case${minute.matched === 1 ? "" : "s"}; too limited to select a contract.`
    : " No comparable recent M1 path was available.";
  const activeContract = activeReview?.supportedForEntryCandidate
    ? ` The exact active contract also retained positive H1 improvement, so this is a review candidate.${preH4?.entryToH4.mean == null ? "" : ` Before H4 entry, its later cases moved ${preH4.entryToH4.mean >= 0 ? "+" : ""}${preH4.entryToH4.mean.toFixed(2)} ATR on average in the trade direction.`}`
    : "";
  const activeEntry = pattern.entryReview?.status === "reviewed_active"
    ? ` Active entry is now the first eligible H1 open from ${formatJakartaDisplayDateTime(pattern.entryReview.activatedAt)}; older occurrences retain H4.`
    : " Active entry remains the first strictly later H4 open.";
  return `${hourlyConclusion}${activeContract}${minuteCoverage}${activeEntry}`;
}

export const ChartFmsActionCard = memo(function ChartFmsActionCard({
  data,
  historicalMatchesVisible = false,
  historicalMatchesCount = 0,
  historicalPatternFilters = [],
  onToggleHistoricalMatches,
  onToggleHistoricalPattern,
  onSetAllHistoricalPatterns,
  onGoToArrow,
  viewState,
  onViewStateChange,
}: {
  data: ChartMacroBiasRealtimeCardData;
  historicalMatchesVisible?: boolean;
  historicalMatchesCount?: number;
  historicalPatternFilters?: Array<{ id: string; label: string; count: number; checked: boolean }>;
  onToggleHistoricalMatches?: () => void;
  onToggleHistoricalPattern?: (patternId: string) => void;
  onSetAllHistoricalPatterns?: (visible: boolean) => void;
  onGoToArrow?: (market: string, signal: MacroSignalChartSignal) => void;
  viewState?: FmsTradeViewState;
  onViewStateChange?: (state: FmsTradeViewState) => void;
}) {
  const markets = useMemo(() => getTradeMarkets(data), [data.globalResponse?.markets, data.response]);
  const responseNow = data.response.generatedAt ?? Math.floor(Date.now() / 1_000);
  const [clock, setClock] = useState(responseNow);
  useEffect(() => {
    setClock(Math.max(responseNow, Math.floor(Date.now() / 1_000)));
    const timer = window.setInterval(() => setClock(Math.floor(Date.now() / 1_000)), 5_000);
    return () => window.clearInterval(timer);
  }, [responseNow]);
  const registeredSchedule = useMemo(() => buildRegisteredSetupSchedule(markets, clock), [markets, clock]);
  const forwardSetupByKey = useMemo(() => new Map(
    (data.globalResponse?.forwardValidation?.setupSummaries ?? []).map((summary) => [`${summary.market}:${summary.patternId}`, summary]),
  ), [data.globalResponse?.forwardValidation?.setupSummaries]);
  const datedSetupCount = registeredSchedule.filter((row) => row.watch != null).length;
  const activity = useMemo(() => buildRecentFmsActivity(markets, clock), [markets, clock]);
  const latestArrowBySetup = useMemo(() => {
    const latest = new Map<string, MacroSignalChartSignal>();
    activity.forEach((row) => {
      if (row.signal && !latest.has(`${row.market}:${row.pattern.id}`)) latest.set(`${row.market}:${row.pattern.id}`, row.signal);
    });
    return latest;
  }, [activity]);
  const [localViewState, setLocalViewState] = useState<FmsTradeViewState>(DEFAULT_FMS_TRADE_VIEW_STATE);
  const currentViewState = viewState ?? localViewState;
  const updateViewState = (patch: Partial<FmsTradeViewState>) => {
    const next = { ...currentViewState, ...patch };
    if (!viewState) setLocalViewState(next);
    onViewStateChange?.(next);
  };
  const { activeView, expandedScheduleKey, expandedActivityKey, setupSearch, hideNoTrade } = currentViewState;
  const { current: currentActivity, recent: recentActivity } = partitionFmsActivity(activity, clock);
  const displayedActivity = activeView === "current"
    ? currentActivity
    : hideNoTrade ? recentActivity.filter((row) => row.assessment?.status !== "no_trade") : recentActivity;
  const normalizedSetupSearch = setupSearch.trim().toLocaleLowerCase();
  const filteredPatternOptions = historicalPatternFilters.filter((option) => {
    if (!normalizedSetupSearch) return true;
    return [setupOptionLabel(option), option.label, option.id, data.response.symbol]
      .some((value) => value.toLocaleLowerCase().includes(normalizedSetupSearch));
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(currentViewState);
  stateRef.current = currentViewState;

  const captureScroll = (container: HTMLDivElement | null) => {
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const rows = Array.from(container.querySelectorAll<HTMLElement>("tr[data-row-key]"));
    const anchor = rows.find((row) => row.getBoundingClientRect().bottom > bounds.top) ?? null;
    const saved: FmsTradeScrollAnchor = {
      key: anchor?.dataset.rowKey ?? null,
      offset: anchor ? anchor.getBoundingClientRect().top - bounds.top : 0,
      scrollTop: container.scrollTop,
    };
    const latest = stateRef.current;
    const previous = latest.scroll[latest.activeView];
    if (previous.key === saved.key && Math.abs(previous.offset - saved.offset) < 1 && Math.abs(previous.scrollTop - saved.scrollTop) < 1) return;
    const next = { ...latest, scroll: { ...latest.scroll, [latest.activeView]: saved } };
    stateRef.current = next;
    if (!viewState) setLocalViewState(next);
    onViewStateChange?.(next);
  };

  const rowSignature = activeView === "next"
    ? `${registeredSchedule.length}:${registeredSchedule[0]?.key ?? ""}:${registeredSchedule[registeredSchedule.length - 1]?.key ?? ""}`
    : `${displayedActivity.length}:${displayedActivity[0]?.key ?? ""}:${displayedActivity[displayedActivity.length - 1]?.key ?? ""}`;
  useClientLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const saved = stateRef.current.scroll[activeView];
    const anchor = saved.key
      ? Array.from(container.querySelectorAll<HTMLElement>("tr[data-row-key]")).find((row) => row.dataset.rowKey === saved.key)
      : null;
    container.scrollTop = anchor
      ? container.scrollTop + anchor.getBoundingClientRect().top - container.getBoundingClientRect().top - saved.offset
      : saved.scrollTop;
  }, [activeView, rowSignature]);
  useEffect(() => () => captureScroll(scrollRef.current), []);
  const onScroll = (event: UIEvent<HTMLDivElement>) => captureScroll(event.currentTarget);

  return (
    <section className="fms-action-card" aria-label="FMS actionable trade card">
      <div className="fms-action-display-controls">
        <label title="Show or hide frozen historical arrows from the registered setups.">
          <input type="checkbox" checked={historicalMatchesVisible} onChange={onToggleHistoricalMatches} disabled={!onToggleHistoricalMatches} />
          <span>Past arrows</span>
          <small>{historicalMatchesCount}</small>
        </label>
        <details className="fms-arrow-filter">
          <summary>Choose setups</summary>
          <div>
            <header><strong>Setups shown on this pair</strong><span><button type="button" onClick={() => filteredPatternOptions.forEach((option) => { if (!option.checked) onToggleHistoricalPattern?.(option.id); })}>Select shown</button><button type="button" onClick={() => filteredPatternOptions.forEach((option) => { if (option.checked) onToggleHistoricalPattern?.(option.id); })}>Clear shown</button></span></header>
            <input className="fms-setup-search" type="search" value={setupSearch} onChange={(event) => updateViewState({ setupSearch: event.target.value })} placeholder="Search label, pair or ID" aria-label="Search setups" />
            {filteredPatternOptions.map((option) => <label key={option.id}>
              <input type="checkbox" checked={option.checked} onChange={() => onToggleHistoricalPattern?.(option.id)} />
              <span>{setupOptionLabel(option)}</span><small>{option.count}</small>
            </label>)}
            {historicalPatternFilters.length === 0 ? <p>No historical setup is loaded for this pair.</p> : filteredPatternOptions.length === 0 ? <p>No setup matches this search.</p> : null}
          </div>
        </details>
        <span className="fms-arrow-color-key"><i className="is-history" /> frozen history <i className="is-journal" /> journal</span>
      </div>
      <nav className="fms-action-view-tabs" aria-label="Trade setup views">
        <button type="button" className={activeView === "next" ? "is-active" : ""} aria-pressed={activeView === "next"} onClick={() => updateViewState({ activeView: "next" })}>
          <span>Next</span><small>{datedSetupCount}</small>
        </button>
        <button type="button" className={activeView === "current" ? "is-active" : ""} aria-pressed={activeView === "current"} onClick={() => updateViewState({ activeView: "current" })}>
          <span>Current</span><small>{currentActivity.length}</small>
        </button>
        <button type="button" className={activeView === "recent" ? "is-active" : ""} aria-pressed={activeView === "recent"} onClick={() => updateViewState({ activeView: "recent" })}>
          <span>Recent</span><small>{recentActivity.length}</small>
        </button>
      </nav>
      {(data.refreshing || data.refreshedAt) ? <div className="fms-action-refresh-state" role="status">
        <span>{data.refreshing ? "Refreshing saved data…" : "Last successful update"}</span>
        {data.refreshedAt ? <time dateTime={new Date(data.refreshedAt * 1000).toISOString()}>{tradeDateFormatter.format(new Date(data.refreshedAt * 1000))} · Jakarta</time> : null}
      </div> : null}
      {data.globalError ? <p role="alert" className="fms-action-warning">{data.globalError}</p> : null}
      {activeView === "next" ? <section className="fms-action-schedule fms-action-view" aria-label="Next registered setups">
        <div className="fms-action-section-title">
          <span>Upcoming setups</span><small>{datedSetupCount} scheduled · {registeredSchedule.length - datedSetupCount} awaiting date</small>
        </div>
        <div ref={activeView === "next" ? scrollRef : undefined} className="fms-action-schedule-scroll" onScroll={onScroll}>
          {registeredSchedule.length > 0 ? <table className="fms-action-table">
            <thead><tr><th>Setup</th><th>Plan and evidence</th><th>Dates · Jakarta</th></tr></thead>
            <tbody>{registeredSchedule.map((row) => {
              const expanded = expandedScheduleKey === row.key;
              const record = historicalRecord(row.pattern);
              const evidence = setupEvidenceLabel(row.pattern);
              const fresh = forwardEvidenceLabel(forwardSetupByKey.get(`${row.market}:${row.pattern.id}`));
              const latestArrow = latestArrowBySetup.get(`${row.market}:${row.pattern.id}`) ?? null;
              return <Fragment key={row.key}>
                <tr data-row-key={row.key} className={row.watch ? "is-scheduled" : ""} role="button" tabIndex={0} aria-expanded={expanded} onClick={() => updateViewState({ expandedScheduleKey: expanded ? null : row.key })} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); updateViewState({ expandedScheduleKey: expanded ? null : row.key }); }
                }}>
                  <td><strong><PairFlags symbol={row.market} />{row.market}</strong><small>{row.pattern.label}</small></td>
                  <td className="fms-action-evidence"><strong>{record.tpRate == null ? "TP rate unavailable" : `${(record.tpRate * 100).toFixed(1)}% TP before SL`}</strong><small>{record.averageR == null ? "Gross average unavailable" : `${record.averageR >= 0 ? "+" : ""}${record.averageR.toFixed(2)}R gross avg`} · N {record.sample}</small><span className="fms-row-actions"><small className="fms-row-details">{expanded ? "Hide details" : "Show details"}</small>{latestArrow && onGoToArrow ? <button type="button" className="fms-go-to-arrow" onClick={(event) => { event.stopPropagation(); onGoToArrow(row.market, latestArrow); }} onKeyDown={(event) => event.stopPropagation()}>Go to latest arrow</button> : null}</span></td>
                  <td><TradeDate label="Release" time={row.watch?.time} fallback="Awaiting date" />{row.watch ? <small className="fms-release-countdown">In {countdownLabel(row.watch.time, clock)}</small> : null}</td>
                </tr>
                {expanded ? <tr className="fms-action-detail-row"><td colSpan={3}>
                  <table><tbody>
                    <tr><th>Frozen contract</th><td>{patternExecutionLabel(row.pattern)}</td></tr>
                    <tr><th>Historical benchmark</th><td><HistoricalBenchmark pattern={row.pattern} /></td></tr>
                    <tr><th>Evidence profile</th><td>{evidence.primary}</td></tr>
                    <tr><th>Quirks</th><td>{evidence.quirks.length ? evidence.quirks.join(" · ") : "No headline quirk under the current frozen thresholds."}</td></tr>
                    <tr><th>Forward record</th><td>{fresh.label} · {fresh.detail}</td></tr>
                    <tr><th>Payoff shape</th><td>{row.pattern.reactionAudit?.profile?.targetEvidence ? `Median ${row.pattern.reactionAudit.profile.targetEvidence.medianR == null ? "unavailable" : `${signed(row.pattern.reactionAudit.profile.targetEvidence.medianR)}R`} · expired ${row.pattern.reactionAudit.profile.targetEvidence.expiredRate == null ? "unavailable" : `${(row.pattern.reactionAudit.profile.targetEvidence.expiredRate * 100).toFixed(1)}%`} · largest win share ${row.pattern.reactionAudit.profile.targetEvidence.topOneWinShare == null ? "unavailable" : `${(row.pattern.reactionAudit.profile.targetEvidence.topOneWinShare * 100).toFixed(1)}%`} · drawdown ${row.pattern.reactionAudit.profile.targetEvidence.maximumDrawdownR.toFixed(2)}R · losing streak ${row.pattern.reactionAudit.profile.targetEvidence.longestLosingStreak}` : "Detailed target evidence unavailable"}</td></tr>
                    <tr><th>Period breadth</th><td>{row.pattern.yearStability.evaluableYears} represented years · {row.pattern.yearStability.positiveYears} positive · break-even TP reference {row.pattern.reactionAudit?.profile?.targetEvidence ? `${(row.pattern.reactionAudit.profile.targetEvidence.breakEvenTargetRate * 100).toFixed(1)}%` : "unavailable"}</td></tr>
                    <tr><th>Frozen decision rule</th><td>{row.pattern.condition}</td></tr>
                    <tr><th>Required package</th><td>{row.watch?.requiredGroups.join(" · ") || row.pattern.groups.join(" · ")}</td></tr>
                    <tr><th>Scoring</th><td>{row.pattern.scoringPolicy?.replaceAll("_", " ") ?? "baseline"} · {row.pattern.reaction ?? "continuation"}</td></tr>
                    <tr><th>Entry and expiry</th><td>First eligible {row.pattern.execution?.entryTimeframe ?? "H4"} open · maximum {row.pattern.execution?.expiryCandles ?? 30} H4</td></tr>
                    <tr><th>Earlier-entry research</th><td>{entryResearchNote(row.market, row.pattern)}</td></tr>
                    <tr><th>Identifiers</th><td><code>{row.market} · {row.pattern.id}</code></td></tr>
                  </tbody></table>
                </td></tr> : null}
              </Fragment>;
            })}</tbody>
          </table> : <p>No registered setup is loaded.</p>}
        </div>
      </section> : null}
      {(activeView === "recent" || activeView === "current") ? <section className="fms-action-activity fms-action-view" aria-label="Recent FMS activity">
        <div className="fms-action-section-title"><span>{activeView === "current" ? "Open trades and awaiting decisions" : "Closed trades and completed decisions"}</span>{activeView === "recent" ? <label className="fms-hide-no-trade"><input type="checkbox" checked={hideNoTrade} onChange={(event) => updateViewState({ hideNoTrade: event.target.checked })} /> Hide no trade</label> : null}<small>Newest first · {activeView === "recent" && hideNoTrade ? `${displayedActivity.length} displayed / ${recentActivity.length} total` : `all ${displayedActivity.length}`}</small></div>
        <div ref={scrollRef} className="fms-action-activity-scroll" onScroll={onScroll}>
          {displayedActivity.length > 0 ? <table className="fms-action-table">
            <thead><tr><th>Setup</th><th>Decision and result</th><th>Dates · Jakarta</th></tr></thead>
            <tbody>{displayedActivity.map((row) => {
              const expanded = expandedActivityKey === row.key;
              const sourceLabel = row.source === "recovered" ? "Recovered offline" : row.source === "live" ? "Live captured" : row.state === "No trade" ? "No trade" : "Decision";
              const arrowSignal = row.signal;
              return <Fragment key={row.key}>
                <tr data-row-key={row.key} role="button" tabIndex={0} aria-expanded={expanded} onClick={() => updateViewState({ expandedActivityKey: expanded ? null : row.key })} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); updateViewState({ expandedActivityKey: expanded ? null : row.key }); }
                }}>
                  <td><strong><PairFlags symbol={row.market} />{row.market}</strong><small>{row.label}</small></td>
                  <td><strong>{row.direction ? `${row.direction === "long" ? "Long" : "Short"} · ` : ""}{row.state}</strong><span className="fms-row-actions"><small className="fms-row-details">{expanded ? "Hide details" : "Show details"}</small>{arrowSignal && onGoToArrow ? <button type="button" className="fms-go-to-arrow" onClick={(event) => { event.stopPropagation(); onGoToArrow(row.market, arrowSignal); }} onKeyDown={(event) => event.stopPropagation()}>Go to arrow</button> : null}</span></td>
                  <td className="fms-activity-dates">
                    <TradeDate label="Released" time={row.signal?.eventTime ?? row.assessment?.time ?? row.time} />
                    {row.signal ? <>
                      <TradeDate label="Opened" time={row.signal.entry != null ? row.signal.activationTime : null} fallback="Entry not recorded" />
                      <TradeDate label="Closed" time={row.signal.exitTime} fallback={row.signal.outcomeStatus === "pending" ? "Pending" : "Exit not recorded"} />
                    </> : null}
                  </td>
                </tr>
                {expanded ? <tr className="fms-action-detail-row"><td colSpan={3}>
                  <table><tbody>
                    <tr><th>{row.state === "No trade" ? "Why no trade" : "Decision reason"}</th><td colSpan={3}><strong>{decisionSummary(row.assessment)}</strong><details><summary>Full recorded explanation</summary><p>{row.assessment?.reason ?? "Unavailable"}</p></details></td></tr>
                    <tr><th>Historical benchmark</th><td colSpan={3}><HistoricalBenchmark pattern={row.pattern} /></td></tr>
                    <tr><th>Capture status</th><td colSpan={3}><strong>{sourceLabel}.</strong> {row.signal?.prospectiveCapture?.reason ?? row.assessment?.prospectiveCapture?.reason ?? (row.source === "recovered" ? "Recovered history; not a live-captured entry." : row.source === "decision" ? "No open simulated trade." : "Live-captured simulation.")}</td></tr>
                    <tr><th>Frozen decision rule</th><td colSpan={3}>{row.pattern.condition}</td></tr>
                    <tr><th>Frozen contract</th><td colSpan={3}>{row.signal ? executionLabel(row.signal, row.pattern) : patternExecutionLabel(row.pattern)}</td></tr>
                    <tr><th>Timing research</th><td colSpan={3}><details><summary>Why this entry timeframe?</summary>{entryResearchNote(row.market, row.pattern)}</details></td></tr>
                    <tr><th>Entry</th><td>{price(row.signal?.entry)}</td><th>ATR at entry</th><td>{row.signal?.atr == null ? "Unavailable" : `${row.signal.atr.toFixed(5)} · ${pipDistance(row.market, 0, row.signal.atr)}`}</td></tr>
                    <tr><th>Stop loss</th><td>{price(row.signal?.stop)} · {pipDistance(row.market, row.signal?.entry, row.signal?.stop)}</td><th>Take profit</th><td>{price(row.signal?.target)} · {pipDistance(row.market, row.signal?.entry, row.signal?.target)}</td></tr>
                    <tr><th>Observed result</th><td>{row.signal ? signalActivityState(row.signal) : row.state}</td><th>Exit / expiry</th><td>{row.signal?.exitTime ? formatJakartaDisplayDateTime(row.signal.exitTime) : row.signal?.expiryTime ? formatJakartaDisplayDateTime(row.signal.expiryTime) : "Unavailable"}</td></tr>
                    <tr><th>Best favorable move</th><td>{row.signal?.pathAudit ? `+${row.signal.pathAudit.maximumFavorableR.toFixed(2)}R · ${row.signal.pathAudit.maximumFavorablePips.toFixed(1)} pips` : "Unavailable"}</td><th>Worst adverse move</th><td>{row.signal?.pathAudit ? `-${row.signal.pathAudit.maximumAdverseR.toFixed(2)}R · -${row.signal.pathAudit.maximumAdversePips.toFixed(1)} pips` : "Unavailable"}</td></tr>
                    {row.assessment?.calculations?.length ? <>
                      <tr><th>News reading</th><td colSpan={3}><strong>{assessmentReading(row.market, row.assessment)}</strong><small>This describes the economic release only; the frozen setup decision remains {row.state.toLowerCase()}.</small></td></tr>
                      <tr><th>Release calculations</th><td colSpan={3}><div className="chart-macro-bias-trigger"><FmsReleaseCards releases={row.assessment.calculations.map((calculation) => ({ ...row.assessment?.events.find((event) => event.title === calculation.title), ...calculation }))} /></div></td></tr>
                    </> : (row.signal?.events?.length || row.assessment?.events?.length) ? <tr><th>Release values</th><td colSpan={3}><div className="chart-macro-bias-trigger"><FmsReleaseCards releases={row.signal?.events?.length ? row.signal.events : row.assessment?.events ?? []} /></div></td></tr> : null}

                    <tr><th>MT5 eligibility</th><td colSpan={3}>{row.source === "live" ? "Live-captured provenance. Automated demo transmission is not implemented and remains disabled." : "Ineligible. Historical, recovered, audit-only, and no-trade records can never be transmitted."}</td></tr>
                  </tbody></table>
                </td></tr> : null}
              </Fragment>;
            })}</tbody>
          </table> : <p>{data.globalLoading ? "Loading registered release decisions…" : activeView === "current" ? "No release is awaiting evaluation and no simulated trade is pending. Upcoming releases are in Next." : hideNoTrade && recentActivity.length > 0 ? "No completed trades match this filter. Clear Hide no trade to show recorded no-trade decisions." : "No completed or earlier release decisions loaded."}</p>}
        </div>
      </section> : null}
    </section>
  );
});
