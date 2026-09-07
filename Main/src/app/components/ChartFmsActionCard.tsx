import { AlertTriangle, Clock3, ShieldCheck } from "lucide-react";
import { Fragment, memo, useEffect, useMemo, useState } from "react";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { formatJakartaDisplayDateTime } from "@/app/lib/format";
import entryResearch from "@/app/lib/fmsEntryResearchSummary.json";
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalPatternAssessment, MacroSignalUpcomingPatternWatch } from "@/app/types";

const ENTRY_GRACE_SECONDS = 90;

type ForwardSetupSummary = NonNullable<ChartMacroBiasRealtimeCardData["globalResponse"]>["forwardValidation"] extends infer T
  ? T extends { setupSummaries: Array<infer R> } ? R : never
  : never;

type ActionCandidate = {
  market: string;
  pattern: MacroSignalChartPattern;
  signal: MacroSignalChartSignal;
};

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

function signalActivityState(signal: MacroSignalChartSignal): string {
  if (signal.entry == null && signal.prospectiveCapture?.eligible) return "Waiting for entry";
  if (signal.outcomeStatus === "pending") return "Trade open";
  if (signal.outcomeStatus === "target_hit") return `TP reached${signal.resultR == null ? "" : ` · ${signal.resultR >= 0 ? "+" : ""}${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "stop_hit") return `SL reached${signal.resultR == null ? "" : ` · ${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "expired") return `Expired${signal.resultR == null ? "" : ` · ${signal.resultR >= 0 ? "+" : ""}${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "ambiguous") return "Ambiguous result";
  return "Not evaluable";
}

export function buildRecentFmsActivity(markets: MacroSignalChartSignalResponse[]): RecentFmsActivityRow[] {
  const rows = new Map<string, RecentFmsActivityRow>();
  for (const market of markets) {
    const patterns = new Map(market.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => [pattern.id, pattern]));
    const signals = [...market.signals, ...(market.recoveredSignals ?? [])];
    const signalsByDecision = new Map(signals.map((signal) => [`${signal.patternId}:${signal.eventTime}`, signal]));
    const assessments = market.realtime?.latestPatternAssessments
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
      rows.set(key, { key, market: market.symbol, label: pattern.label, time: signal?.exitTime ?? assessment.time, direction: signal?.direction ?? assessment.direction, state, source, pattern, signal, assessment });
    }
    for (const signal of signals) {
      const pattern = patterns.get(signal.patternId);
      if (!pattern) continue;
      const key = `${market.symbol}:${signal.patternId}:${signal.eventTime}`;
      if (rows.has(key)) continue;
      rows.set(key, {
        key,
        market: market.symbol,
        label: pattern.label,
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
      .map((pattern) => ({
        key: `${market.symbol}:${pattern.id}`,
        market: market.symbol,
        pattern,
        watch: futureWatches.find((watch) => watch.patternId === pattern.id) ?? null,
      }));
  }).sort((left, right) => {
    if (left.watch && right.watch) return left.watch.time - right.watch.time || left.market.localeCompare(right.market) || left.pattern.label.localeCompare(right.pattern.label);
    if (left.watch) return -1;
    if (right.watch) return 1;
    return left.market.localeCompare(right.market) || left.pattern.label.localeCompare(right.pattern.label);
  });
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

function price(value: number | null | undefined): string {
  return value == null ? "Available at entry" : value.toFixed(5);
}

function pipDistance(market: string, from: number | null | undefined, to: number | null | undefined): string {
  if (from == null || to == null) return "Available at entry";
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

function historicalRecord(pattern: MacroSignalChartPattern): { averageR: number | null; tpRate: number | null; sample: number } {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  const averageR = typeof reviewed?.averageR === "number" ? reviewed.averageR : pattern.historicalBenchmark?.walkForwardAverageR ?? pattern.executionStress.overall.averageR ?? null;
  const tpRate = typeof reviewed?.tpBeforeSl === "number" ? reviewed.tpBeforeSl : pattern.historicalBenchmark?.targetFirstRate ?? pattern.overall.targetHitRate ?? null;
  const sample = typeof reviewed?.evaluableN === "number" ? reviewed.evaluableN : pattern.historicalBenchmark?.walkForwardN ?? pattern.overall.evaluableCount;
  return { averageR, tpRate, sample };
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

function candidateRows(data: ChartMacroBiasRealtimeCardData): ActionCandidate[] {
  const markets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  const rows = markets.flatMap((market) => {
    const patterns = new Map(market.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => [pattern.id, pattern]));
    return [...market.signals, ...(market.recoveredSignals ?? [])].flatMap((signal): ActionCandidate[] => {
      const pattern = patterns.get(signal.patternId);
      if (!pattern || pattern.readiness?.actionableInShadowTrader === false) return [];
      return [{ market: market.symbol, pattern, signal }];
    });
  });
  return [...new Map(rows.map((row) => [`${row.market}:${row.signal.id}`, row])).values()];
}

export const ChartFmsActionCard = memo(function ChartFmsActionCard({
  data,
  historicalMatchesVisible = false,
  historicalMatchesCount = 0,
  historicalPatternFilters = [],
  onToggleHistoricalMatches,
  onToggleHistoricalPattern,
  onSetAllHistoricalPatterns,
}: {
  data: ChartMacroBiasRealtimeCardData;
  historicalMatchesVisible?: boolean;
  historicalMatchesCount?: number;
  historicalPatternFilters?: Array<{ id: string; label: string; count: number; checked: boolean }>;
  onToggleHistoricalMatches?: () => void;
  onToggleHistoricalPattern?: (patternId: string) => void;
  onSetAllHistoricalPatterns?: (visible: boolean) => void;
}) {
  const markets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  const candidates = useMemo(() => candidateRows(data), [data]);
  const responseNow = data.response.generatedAt ?? Math.floor(Date.now() / 1_000);
  const [clock, setClock] = useState(responseNow);
  useEffect(() => {
    setClock(Math.max(responseNow, Math.floor(Date.now() / 1_000)));
    const timer = window.setInterval(() => setClock(Math.floor(Date.now() / 1_000)), 30_000);
    return () => window.clearInterval(timer);
  }, [responseNow]);
  const registeredSchedule = useMemo(() => buildRegisteredSetupSchedule(markets, clock), [markets, clock]);
  const forwardSetupByKey = useMemo(() => new Map(
    (data.globalResponse?.forwardValidation?.setupSummaries ?? []).map((summary) => [`${summary.market}:${summary.patternId}`, summary]),
  ), [data.globalResponse?.forwardValidation?.setupSummaries]);
  const datedSetupCount = registeredSchedule.filter((row) => row.watch != null).length;
  const recentActivity = useMemo(() => buildRecentFmsActivity(markets)
    .filter((row) => row.signal == null || (row.signal.outcomeStatus !== "pending" && !(row.signal.entry == null && row.signal.prospectiveCapture?.eligible)))
    .slice(0, 10), [markets]);
  const [expandedScheduleKey, setExpandedScheduleKey] = useState<string | null>(null);
  const [expandedCurrentKey, setExpandedCurrentKey] = useState<string | null>(null);
  const [expandedActivityKey, setExpandedActivityKey] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"next" | "current" | "recent">("next");
  const open = candidates
    .filter(({ signal }) => signal.outcomeStatus === "pending" && signal.entry != null)
    .sort((left, right) => (right.signal.activationTime ?? 0) - (left.signal.activationTime ?? 0));
  const queued = candidates
    .filter(({ signal }) => signal.entry == null && signal.prospectiveCapture?.eligible === true)
    .sort((left, right) => (left.signal.prospectiveCapture?.activationTime ?? Number.POSITIVE_INFINITY) - (right.signal.prospectiveCapture?.activationTime ?? Number.POSITIVE_INFINITY));
  const actionableOpen = open.filter(({ signal }) => signal.observationMode !== "recovered_offline");
  const primary = actionableOpen[0] ?? queued[0] ?? null;
  const currentCandidates = [...open, ...queued];
  const sameTime = primary ? [...open, ...queued].filter((candidate) =>
    candidate.market === primary.market
    && (candidate.signal.activationTime ?? candidate.signal.prospectiveCapture?.activationTime) === (primary.signal.activationTime ?? primary.signal.prospectiveCapture?.activationTime),
  ) : [];
  const conflict = new Set(sameTime.map((candidate) => candidate.signal.direction)).size > 1;
  const operationalPreflight = data.globalResponse?.forwardValidation?.operationalPreflight;
  const globalBlock = data.globalLoading ? "Global registered-market scan is still loading"
    : data.globalError ? `Global registered-market scan unavailable: ${data.globalError}`
    : operationalPreflight?.signalMonitoringReadyNow === false ? operationalPreflight.blockingReasons.join("; ")
    : null;
  const integrityIssues = primary ? [
    globalBlock,
    primary.pattern.registrationProvenance && primary.pattern.registrationProvenance.status !== "verified" ? "Registered recipe provenance is not verified" : null,
    primary.pattern.readiness?.auditStatus !== "complete" ? "Setup audit is incomplete" : null,
    primary.signal.entry != null && (primary.signal.atr == null || primary.signal.stop == null || primary.signal.target == null) ? "Frozen entry geometry is incomplete" : null,
  ].filter((issue): issue is string => Boolean(issue)) : [];
  const integrityBlocked = integrityIssues.length > 0;
  const correlatedExposure = primary ? open.flatMap((candidate) => {
    if (candidate.signal.id === primary.signal.id && candidate.market === primary.market) return [];
    const primaryExposure = positionCurrencyExposure(primary.market, primary.signal.direction);
    const otherExposure = positionCurrencyExposure(candidate.market, candidate.signal.direction);
    const concentrated = Object.keys(primaryExposure).filter((currency) => otherExposure[currency] === primaryExposure[currency]);
    return concentrated.length ? [{ market: candidate.market, currencies: concentrated }] : [];
  }) : [];
  const activation = primary?.signal.activationTime ?? primary?.signal.prospectiveCapture?.activationTime ?? null;
  const primaryEntryTimeframe = primary?.signal.entryTimeframe ?? primary?.pattern.execution?.entryTimeframe ?? "H4";
  const withinEntryGrace = activation != null && clock >= activation && clock <= activation + ENTRY_GRACE_SECONDS;
  const action = globalBlock
    ? { state: "BLOCKED", title: "Do not enter now", detail: globalBlock, tone: "blocked" }
    : integrityBlocked
    ? { state: "BLOCKED", title: "Do not enter now", detail: integrityIssues[0], tone: "blocked" }
    : conflict
    ? { state: "BLOCKED", title: "Do not enter now", detail: "Opposing registered directions share this pair and entry time. Review the conflict instead of choosing one silently.", tone: "blocked" }
    : primary == null
      ? null
      : primary.signal.entry == null
        ? { state: "WAITING", title: `Wait for the ${primaryEntryTimeframe} entry`, detail: `The frozen entry is ${formatJakartaDisplayDateTime(activation!)}. Do not enter before it.`, tone: "waiting" }
        : withinEntryGrace
          ? { state: "ENTRY WINDOW", title: `Enter ${primary.signal.direction === "long" ? "Long" : "Short"} ${primary.market} now`, detail: `The frozen ${primaryEntryTimeframe} entry opened within the last ${ENTRY_GRACE_SECONDS} seconds.`, tone: "entry" }
          : { state: "MONITORING", title: "Do not enter late", detail: `The model trade is already open from its frozen ${primaryEntryTimeframe} entry. Monitor it; do not replace the tested entry with a later one.`, tone: "open" };

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
            <header><strong>Setups shown on this pair</strong><span><button type="button" onClick={() => onSetAllHistoricalPatterns?.(true)}>All</button><button type="button" onClick={() => onSetAllHistoricalPatterns?.(false)}>None</button></span></header>
            {historicalPatternFilters.map((option) => <label key={option.id}>
              <input type="checkbox" checked={option.checked} onChange={() => onToggleHistoricalPattern?.(option.id)} />
              <span>{option.label}</span><small>{option.count}</small>
            </label>)}
            {historicalPatternFilters.length === 0 ? <p>No historical setup is loaded for this pair.</p> : null}
          </div>
        </details>
        <span className="fms-arrow-color-key"><i className="is-history" /> frozen history <i className="is-journal" /> journal</span>
      </div>
      <header>
        <div><ShieldCheck size={15} /><span>FMS Trade</span></div>
        <small>Registered rules only · no MT5 order</small>
      </header>
      <nav className="fms-action-view-tabs" aria-label="Trade setup views">
        <button type="button" className={activeView === "next" ? "is-active" : ""} aria-pressed={activeView === "next"} onClick={() => setActiveView("next")}>
          <span>Next</span><small>{datedSetupCount}</small>
        </button>
        <button type="button" className={activeView === "current" ? "is-active" : ""} aria-pressed={activeView === "current"} onClick={() => setActiveView("current")}>
          <span>Current</span><small>{currentCandidates.length}</small>
        </button>
        <button type="button" className={activeView === "recent" ? "is-active" : ""} aria-pressed={activeView === "recent"} onClick={() => setActiveView("recent")}>
          <span>Recent</span><small>{recentActivity.length}</small>
        </button>
      </nav>
      {activeView === "next" ? <section className="fms-action-schedule fms-action-view" aria-label="Next registered setups">
        <div className="fms-action-schedule-heading">
          <div><span>Next registered setups</span><strong>{datedSetupCount} scheduled · {registeredSchedule.length - datedSetupCount} awaiting date</strong></div>
          <small>Jakarta time</small>
        </div>
        <div className="fms-action-schedule-scroll">
          {registeredSchedule.length > 0 ? <table className="fms-action-table">
            <thead><tr><th>Setup</th><th>Next release</th><th>Historical evidence</th><th>Trade plan</th></tr></thead>
            <tbody>{registeredSchedule.map((row) => {
              const expanded = expandedScheduleKey === row.key;
              const record = historicalRecord(row.pattern);
              const evidence = setupEvidenceLabel(row.pattern);
              const fresh = forwardEvidenceLabel(forwardSetupByKey.get(`${row.market}:${row.pattern.id}`));
              return <Fragment key={row.key}>
                <tr className={row.watch ? "is-scheduled" : ""} role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpandedScheduleKey(expanded ? null : row.key)} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedScheduleKey(expanded ? null : row.key); }
                }}>
                  <td><strong><PairFlags symbol={row.market} />{row.market}</strong><small>{row.pattern.label}</small></td>
                  <td>{row.watch ? <><strong>{formatJakartaDisplayDateTime(row.watch.time)}</strong><small>{countdownLabel(row.watch.time, clock)}</small></> : <small>No upcoming date loaded</small>}</td>
                  <td className="fms-action-evidence"><strong>{record.tpRate == null ? "TP rate unavailable" : `${(record.tpRate * 100).toFixed(1)}% TP before SL`}</strong><small>{record.averageR == null ? "Gross average unavailable" : `${record.averageR >= 0 ? "+" : ""}${record.averageR.toFixed(2)}R gross avg`} · Later N {record.sample}</small><em title={evidence.quirks.join(" · ")}>{evidence.primary}{evidence.quirks.length ? ` · ${evidence.quirks.slice(0, 2).join(" · ")}` : ""}</em><small className={`fms-action-forward ${fresh.tone}`} title={fresh.detail}>Fresh: {fresh.label}</small></td>
                  <td><strong>{patternExecutionLabel(row.pattern)}</strong><small>{expanded ? "Hide details" : "Show details"}</small></td>
                </tr>
                {expanded ? <tr className="fms-action-detail-row"><td colSpan={4}>
                  <table><tbody>
                    <tr><th>Historical evidence</th><td>{record.averageR == null ? "Unavailable" : `${(Number(record.tpRate ?? 0) * 100).toFixed(1)}% TP before SL · ${record.averageR >= 0 ? "+" : ""}${record.averageR.toFixed(2)}R gross average · Later N ${record.sample}`}</td></tr>
                    <tr><th>Evidence profile</th><td>{evidence.primary}</td></tr>
                    <tr><th>Quirks</th><td>{evidence.quirks.length ? evidence.quirks.join(" · ") : "No headline quirk under the current frozen thresholds."}</td></tr>
                    <tr><th>Fresh record</th><td>{fresh.label} · {fresh.detail}</td></tr>
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
      {activeView === "current" ? <section className="fms-action-view" aria-label="Current registered setups">
      <div className="fms-action-section-title"><span>Current registered setup</span><small>Open or waiting for entry</small></div>
      {currentCandidates.length > 0 ? <table className="fms-action-table fms-action-current-table">
        <thead><tr><th>Setup</th><th>Decision</th><th>State and contract</th></tr></thead>
        <tbody>{currentCandidates.map((candidate) => {
          const key = `${candidate.market}:${candidate.signal.id}`;
          const expanded = expandedCurrentKey === key;
          const candidateActivation = candidate.signal.activationTime ?? candidate.signal.prospectiveCapture?.activationTime ?? null;
          const candidateRecord = historicalRecord(candidate.pattern);
          const candidateForward = forwardSetupByKey.get(`${candidate.market}:${candidate.pattern.id}`);
          const fresh = forwardEvidenceLabel(candidateForward);
          const isPrimary = candidate === primary;
          const candidateState = candidate.signal.observationMode === "recovered_offline"
            ? "Recovered offline · trade open"
            : isPrimary && action
            ? `${action.state} · ${action.title}`
            : candidate.signal.entry == null ? `Waiting for ${candidate.signal.entryTimeframe ?? candidate.pattern.execution?.entryTimeframe ?? "H4"} entry` : "Trade running";
          return <Fragment key={key}>
            <tr role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpandedCurrentKey(expanded ? null : key)} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedCurrentKey(expanded ? null : key); }
            }}>
              <td><strong><PairFlags symbol={candidate.market} />{candidate.market}</strong><small>{candidate.pattern.label}</small></td>
              <td><strong>{candidate.signal.direction === "long" ? "Long" : "Short"}</strong><small>{candidateActivation == null ? "Entry unavailable" : formatJakartaDisplayDateTime(candidateActivation)}</small></td>
              <td><strong>{candidateState}</strong><small>{executionLabel(candidate.signal, candidate.pattern)}</small></td>
            </tr>
            {expanded ? <tr className="fms-action-detail-row"><td colSpan={3}>
              <table><tbody>
                <tr><th>Release</th><td>{formatJakartaDisplayDateTime(candidate.signal.eventTime)}</td><th>Entry / ATR</th><td>{price(candidate.signal.entry)} · ATR {price(candidate.signal.atr)}</td></tr>
                <tr><th>Stop loss</th><td>{price(candidate.signal.stop)} · {pipDistance(candidate.market, candidate.signal.entry, candidate.signal.stop)} · {candidate.signal.stopAtr ?? candidate.pattern.execution?.stopAtr ?? 1} ATR</td><th>Take profit</th><td>{price(candidate.signal.target)} · {pipDistance(candidate.market, candidate.signal.entry, candidate.signal.target)} · {candidate.signal.targetR ?? candidate.pattern.execution?.targetR ?? 2}R</td></tr>
                <tr><th>Expiry</th><td>{candidate.signal.expiryTime ? formatJakartaDisplayDateTime(candidate.signal.expiryTime) : `${candidate.signal.expiryCandles} H4`}</td><th>0.01-lot SL exposure</th><td>{candidate.signal.minimumLotExposure ? `${candidate.signal.minimumLotExposure.accountCurrency || "Account currency"} ${candidate.signal.minimumLotExposure.accountRisk.toFixed(2)} · broker-calculated` : `0.01 lot · ${pipDistance(candidate.market, candidate.signal.entry, candidate.signal.stop)} stop · amount available while MT5 is connected`}</td></tr>
                <tr><th>Historical contract</th><td colSpan={3}>{candidateRecord.averageR == null ? "Unavailable" : `${candidateRecord.averageR >= 0 ? "+" : ""}${candidateRecord.averageR.toFixed(2)}R average · ${(Number(candidateRecord.tpRate ?? 0) * 100).toFixed(1)}% TP before SL · N ${candidateRecord.sample}`}</td></tr>
                <tr><th>Fresh record</th><td colSpan={3}>{fresh.label} · {fresh.detail}{candidateForward?.medianR == null ? "" : ` · median ${candidateForward.medianR >= 0 ? "+" : ""}${candidateForward.medianR.toFixed(2)}R`}{candidateForward?.maximumDrawdownR == null ? "" : ` · drawdown ${candidateForward.maximumDrawdownR.toFixed(2)}R`}{candidateForward?.longestLosingStreak == null ? "" : ` · longest losing streak ${candidateForward.longestLosingStreak}`}</td></tr>
                <tr><th>Earlier-entry research</th><td colSpan={3}>{entryResearchNote(candidate.market, candidate.pattern)}</td></tr>
                <tr><th>Evidence</th><td colSpan={3}>{(candidate.signal.events?.length ?? 0) > 0 ? candidate.signal.events.map((event) => `${event.currency} ${event.title}: score ${signed(event.score)}`).join(" · ") : "No event calculation rows loaded."}</td></tr>
                <tr><th>Integrity</th><td colSpan={3}>{isPrimary && integrityBlocked ? integrityIssues.join(" · ") : candidate.signal.observationMode === "recovered_offline" ? "Recovered offline — never eligible for automated entry" : "Live captured · registered setup · frozen geometry checked"}</td></tr>
                <tr><th>MT5 demo tag</th><td colSpan={3}>{candidate.signal.observationMode === "live_captured" && candidate.signal.demoTag ? <span className="fms-demo-tag"><code>{candidate.signal.demoTag}</code><button type="button" onClick={(event) => { event.stopPropagation(); void navigator.clipboard?.writeText(candidate.signal.demoTag!); }}>Copy tag</button><small>Use this exact Comment on a manually placed MT5 demo order so Journal can attach the actual fill and P/L.</small></span> : "Unavailable — only a prospectively live-captured signal receives an eligible demo tag."}</td></tr>
              </tbody></table>
            </td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table> : (
        <div className="fms-action-empty"><Clock3 size={18} /><p>No registered trade is open or waiting for entry.</p></div>
      )}
      {conflict ? <div className="fms-action-warning"><AlertTriangle size={14} />{sameTime.length} simultaneous signals require review.</div> : null}
      {correlatedExposure.length > 0 ? <div className="fms-action-warning"><AlertTriangle size={14} />Concentrated currency exposure: {correlatedExposure.map((row) => `${row.market} (${row.currencies.join("/")})`).join(", ")} already leans the same way.</div> : null}
      {primary && forwardSetupByKey.get(`${primary.market}:${primary.pattern.id}`)?.status === "pause_candidate" ? <div className="fms-action-warning"><AlertTriangle size={14} />Fresh evidence marks this setup as a pause candidate. Its historical registration is preserved; review before manually following it.</div> : null}
      <footer>The 90-second button window is an operational display rule around the exact frozen entry open. Missing it does not create a new tested entry.</footer>
      </section> : null}
      {activeView === "recent" ? <section className="fms-action-activity fms-action-view" aria-label="Recent FMS activity">
        <div className="fms-action-section-title"><span>Recent FMS activity</span><small>Newest first · latest {recentActivity.length}</small></div>
        <div className="fms-action-activity-scroll">
          {recentActivity.length > 0 ? <table className="fms-action-table">
            <thead><tr><th>Setup</th><th>Decision and result</th><th>Source and time</th></tr></thead>
            <tbody>{recentActivity.map((row) => {
              const expanded = expandedActivityKey === row.key;
              const sourceLabel = row.source === "recovered" ? "Recovered offline" : row.source === "live" ? "Live captured" : row.state === "No trade" ? "No trade" : "Decision";
              return <Fragment key={row.key}>
                <tr role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpandedActivityKey(expanded ? null : row.key)} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedActivityKey(expanded ? null : row.key); }
                }}>
                  <td><strong><PairFlags symbol={row.market} />{row.market}</strong><small>{row.label}</small></td>
                  <td><strong>{row.direction ? `${row.direction === "long" ? "Long" : "Short"} · ` : ""}{row.state}</strong><small>{expanded ? "Hide details" : "Show details"}</small></td>
                  <td><strong className={`fms-activity-source is-${row.source}`}>{sourceLabel}</strong><small>{formatJakartaDisplayDateTime(row.time)}</small></td>
                </tr>
                {expanded ? <tr className="fms-action-detail-row"><td colSpan={3}>
                  <table><tbody>
                    <tr><th>Frozen decision rule</th><td colSpan={3}>{row.pattern.condition}</td></tr>
                    <tr><th>Frozen contract</th><td colSpan={3}>{row.signal ? executionLabel(row.signal, row.pattern) : patternExecutionLabel(row.pattern)}</td></tr>
                    <tr><th>Earlier-entry research</th><td colSpan={3}>{entryResearchNote(row.market, row.pattern)}</td></tr>
                    <tr><th>Entry</th><td>{price(row.signal?.entry)}</td><th>ATR at entry</th><td>{row.signal?.atr == null ? "Unavailable" : `${row.signal.atr.toFixed(5)} · ${pipDistance(row.market, 0, row.signal.atr)}`}</td></tr>
                    <tr><th>Stop loss</th><td>{price(row.signal?.stop)} · {pipDistance(row.market, row.signal?.entry, row.signal?.stop)}</td><th>Take profit</th><td>{price(row.signal?.target)} · {pipDistance(row.market, row.signal?.entry, row.signal?.target)}</td></tr>
                    <tr><th>Observed result</th><td>{row.signal ? signalActivityState(row.signal) : row.state}</td><th>Exit / expiry</th><td>{row.signal?.exitTime ? formatJakartaDisplayDateTime(row.signal.exitTime) : row.signal?.expiryTime ? formatJakartaDisplayDateTime(row.signal.expiryTime) : "Unavailable"}</td></tr>
                    <tr><th>Best favorable move</th><td>{row.signal?.pathAudit ? `+${row.signal.pathAudit.maximumFavorableR.toFixed(2)}R · ${row.signal.pathAudit.maximumFavorablePips.toFixed(1)} pips` : "Unavailable"}</td><th>Worst adverse move</th><td>{row.signal?.pathAudit ? `-${row.signal.pathAudit.maximumAdverseR.toFixed(2)}R · -${row.signal.pathAudit.maximumAdversePips.toFixed(1)} pips` : "Unavailable"}</td></tr>
                    <tr><th>Decision evidence</th><td colSpan={3}>{row.assessment?.reason ?? (row.signal?.events?.length ? row.signal.events.map((event) => `${event.currency} ${event.title}: score ${signed(event.score)}`).join(" · ") : "No calculation explanation loaded.")}</td></tr>
                    <tr><th>MT5 eligibility</th><td colSpan={3}>{row.source === "live" ? "Live-captured provenance. Automated demo transmission is not implemented and remains disabled." : "Ineligible. Historical, recovered, audit-only, and no-trade records can never be transmitted."}</td></tr>
                  </tbody></table>
                </td></tr> : null}
              </Fragment>;
            })}</tbody>
          </table> : <p>No registered decision has been recorded yet.</p>}
        </div>
      </section> : null}
    </section>
  );
});
