import { AlertTriangle, Clock3, ShieldCheck } from "lucide-react";
import { Fragment, memo, useEffect, useMemo, useState } from "react";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { ChartMacroBiasRealtimeCardData } from "@/app/components/ChartMacroBiasRealtimeCard";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import {
  DEFAULT_SHADOW_RISK_PERCENT,
  DEFAULT_SHADOW_STARTING_BALANCE,
  buildMacroSignalShadowPosition,
  normalizeShadowRiskPercent,
  normalizeShadowStartingBalance,
} from "@/app/lib/macroSignalShadow";
import { formatJakartaDisplayDateTime } from "@/app/lib/format";
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalPatternAssessment, MacroSignalUpcomingPatternWatch } from "@/app/types";

const ENTRY_GRACE_SECONDS = 90;

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
      rows.set(key, { key, market: market.symbol, label: pattern.label, time: assessment.time, direction: signal?.direction ?? assessment.direction, state, source, pattern, signal, assessment });
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
        time: signal.eventTime,
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

function readStoredNumber(key: string, fallback: number): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
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
  return `SL ${execution?.stopAtr ?? 1} ATR · TP ${execution?.targetR ?? 2}R · maximum ${execution?.expiryCandles ?? 30} H4${management}`;
}

function patternExecutionLabel(pattern: MacroSignalChartPattern): string {
  const execution = pattern.execution;
  const management = execution?.managementFamily === "break_even"
    ? ` · move SL to entry after +${execution.managementTriggerR ?? 1}R`
    : "";
  return `SL ${execution?.stopAtr ?? 1} ATR · TP ${execution?.targetR ?? 2}R · ${execution?.expiryCandles ?? 30} H4${management}`;
}

function historicalRecord(pattern: MacroSignalChartPattern): { averageR: number | null; tpRate: number | null; sample: number } {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  const averageR = typeof reviewed?.averageR === "number" ? reviewed.averageR : pattern.historicalBenchmark?.walkForwardAverageR ?? pattern.executionStress.overall.averageR ?? null;
  const tpRate = typeof reviewed?.tpBeforeSl === "number" ? reviewed.tpBeforeSl : pattern.historicalBenchmark?.targetFirstRate ?? pattern.overall.targetHitRate ?? null;
  const sample = typeof reviewed?.evaluableN === "number" ? reviewed.evaluableN : pattern.historicalBenchmark?.walkForwardN ?? pattern.overall.evaluableCount;
  return { averageR, tpRate, sample };
}

function candidateRows(data: ChartMacroBiasRealtimeCardData): ActionCandidate[] {
  const markets = data.globalResponse?.markets.filter((market) => market.supported) ?? [data.response];
  return markets.flatMap((market) => {
    const patterns = new Map(market.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => [pattern.id, pattern]));
    return market.signals.flatMap((signal): ActionCandidate[] => {
      const pattern = patterns.get(signal.patternId);
      if (!pattern || pattern.readiness?.actionableInShadowTrader === false || signal.observationMode === "recovered_offline") return [];
      return [{ market: market.symbol, pattern, signal }];
    });
  });
}

export const ChartFmsActionCard = memo(function ChartFmsActionCard({
  data,
  historicalMatchesVisible = false,
  historicalMatchesCount = 0,
  onToggleHistoricalMatches,
}: {
  data: ChartMacroBiasRealtimeCardData;
  historicalMatchesVisible?: boolean;
  historicalMatchesCount?: number;
  onToggleHistoricalMatches?: () => void;
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
  const datedSetupCount = registeredSchedule.filter((row) => row.watch != null).length;
  const recentActivity = useMemo(() => buildRecentFmsActivity(markets).slice(0, 10), [markets]);
  const [expandedScheduleKey, setExpandedScheduleKey] = useState<string | null>(null);
  const [expandedCurrentKey, setExpandedCurrentKey] = useState<string | null>(null);
  const [expandedActivityKey, setExpandedActivityKey] = useState<string | null>(null);
  const open = candidates
    .filter(({ signal }) => signal.outcomeStatus === "pending" && signal.entry != null)
    .sort((left, right) => (right.signal.activationTime ?? 0) - (left.signal.activationTime ?? 0));
  const queued = candidates
    .filter(({ signal }) => signal.entry == null && signal.prospectiveCapture?.eligible === true)
    .sort((left, right) => (left.signal.prospectiveCapture?.activationTime ?? Number.POSITIVE_INFINITY) - (right.signal.prospectiveCapture?.activationTime ?? Number.POSITIVE_INFINITY));
  const primary = open[0] ?? queued[0] ?? null;
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
  const correlatedMarkets = primary ? open
    .filter((candidate) => candidate.market !== primary.market && [primary.market.slice(0, 3), primary.market.slice(3, 6)].some((currency) => candidate.market.includes(currency)))
    .map((candidate) => candidate.market) : [];
  const startingBalance = normalizeShadowStartingBalance(readStoredNumber("fyodor.charts.shadow-starting-balance", DEFAULT_SHADOW_STARTING_BALANCE));
  const riskPercent = normalizeShadowRiskPercent(readStoredNumber("fyodor.charts.shadow-risk-percent", DEFAULT_SHADOW_RISK_PERCENT));
  const activation = primary?.signal.activationTime ?? primary?.signal.prospectiveCapture?.activationTime ?? null;
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
        ? { state: "WAITING", title: "Wait for the H4 entry", detail: `The frozen entry is ${formatJakartaDisplayDateTime(activation!)}. Do not enter before it.`, tone: "waiting" }
        : withinEntryGrace
          ? { state: "ENTRY WINDOW", title: `Enter ${primary.signal.direction === "long" ? "Long" : "Short"} ${primary.market} now`, detail: `The frozen H4 entry opened within the last ${ENTRY_GRACE_SECONDS} seconds.`, tone: "entry" }
          : { state: "MONITORING", title: "Do not enter late", detail: "The model trade is already open from its frozen H4 entry. Monitor it; do not replace the tested entry with a later one.", tone: "open" };

  return (
    <section className="fms-action-card" aria-label="FMS actionable trade card">
      <div className="fms-action-display-controls">
        <label title="Show or hide frozen historical arrows from the registered setups.">
          <input type="checkbox" checked={historicalMatchesVisible} onChange={onToggleHistoricalMatches} disabled={!onToggleHistoricalMatches} />
          <span>Past arrows</span>
          <small>{historicalMatchesCount}</small>
        </label>
        <span className="fms-arrow-color-key"><i className="is-history" /> frozen history <i className="is-journal" /> journal</span>
      </div>
      <header>
        <div><ShieldCheck size={15} /><span>FMS Trade</span></div>
        <small>Registered rules only · no MT5 order</small>
      </header>
      <section className="fms-action-schedule" aria-label="Next registered setups">
        <div className="fms-action-schedule-heading">
          <div><span>Next registered setups</span><strong>{datedSetupCount} scheduled · {registeredSchedule.length - datedSetupCount} awaiting date</strong></div>
          <small>Jakarta time</small>
        </div>
        <div className="fms-action-schedule-scroll">
          {registeredSchedule.length > 0 ? <table className="fms-action-table">
            <thead><tr><th>Setup</th><th>Next release</th><th>Frozen contract</th></tr></thead>
            <tbody>{registeredSchedule.map((row) => {
              const expanded = expandedScheduleKey === row.key;
              const record = historicalRecord(row.pattern);
              return <Fragment key={row.key}>
                <tr className={row.watch ? "is-scheduled" : ""} role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpandedScheduleKey(expanded ? null : row.key)} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedScheduleKey(expanded ? null : row.key); }
                }}>
                  <td><strong><PairFlags symbol={row.market} />{row.market}</strong><small>{row.pattern.label}</small></td>
                  <td>{row.watch ? <><strong>{formatJakartaDisplayDateTime(row.watch.time)}</strong><small>{countdownLabel(row.watch.time, clock)}</small></> : <small>No upcoming date loaded</small>}</td>
                  <td><strong>{patternExecutionLabel(row.pattern)}</strong><small>{expanded ? "Hide details" : "Show details"}</small></td>
                </tr>
                {expanded ? <tr className="fms-action-detail-row"><td colSpan={3}>
                  <table><tbody>
                    <tr><th>Frozen decision rule</th><td>{row.pattern.condition}</td></tr>
                    <tr><th>Required package</th><td>{row.watch?.requiredGroups.join(" · ") || row.pattern.groups.join(" · ")}</td></tr>
                    <tr><th>Entry and expiry</th><td>First strictly later H4 open · maximum {row.pattern.execution?.expiryCandles ?? 30} H4</td></tr>
                    <tr><th>Historical contract</th><td>{record.averageR == null ? "Unavailable" : `${record.averageR >= 0 ? "+" : ""}${record.averageR.toFixed(2)}R average · ${(Number(record.tpRate ?? 0) * 100).toFixed(1)}% TP before SL · N ${record.sample}`}</td></tr>
                    <tr><th>Scoring</th><td>{row.pattern.scoringPolicy?.replaceAll("_", " ") ?? "baseline"} · {row.pattern.reaction ?? "continuation"}</td></tr>
                  </tbody></table>
                </td></tr> : null}
              </Fragment>;
            })}</tbody>
          </table> : <p>No registered setup is loaded.</p>}
        </div>
      </section>
      <div className="fms-action-section-title"><span>Current registered setup</span><small>Open or waiting for entry</small></div>
      {currentCandidates.length > 0 ? <table className="fms-action-table fms-action-current-table">
        <thead><tr><th>Setup</th><th>Decision</th><th>State and contract</th></tr></thead>
        <tbody>{currentCandidates.map((candidate) => {
          const key = `${candidate.market}:${candidate.signal.id}`;
          const expanded = expandedCurrentKey === key;
          const candidateActivation = candidate.signal.activationTime ?? candidate.signal.prospectiveCapture?.activationTime ?? null;
          const candidateRecord = historicalRecord(candidate.pattern);
          const candidatePosition = candidate.signal.entry == null ? null : buildMacroSignalShadowPosition(candidate.signal, startingBalance, riskPercent, candidate.market);
          const isPrimary = candidate === primary;
          const candidateState = isPrimary && action
            ? `${action.state} · ${action.title}`
            : candidate.signal.entry == null ? "Waiting for H4 entry" : "Trade running";
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
                <tr><th>Expiry</th><td>{candidate.signal.expiryTime ? formatJakartaDisplayDateTime(candidate.signal.expiryTime) : `${candidate.signal.expiryCandles} H4`}</td><th>Risk amount</th><td>{candidatePosition ? `$${candidatePosition.riskDollars.toFixed(2)} · ${riskPercent}%` : `${riskPercent}% at entry`}</td></tr>
                <tr><th>Historical contract</th><td colSpan={3}>{candidateRecord.averageR == null ? "Unavailable" : `${candidateRecord.averageR >= 0 ? "+" : ""}${candidateRecord.averageR.toFixed(2)}R average · ${(Number(candidateRecord.tpRate ?? 0) * 100).toFixed(1)}% TP before SL · N ${candidateRecord.sample}`}</td></tr>
                <tr><th>Evidence</th><td colSpan={3}>{candidate.signal.events.length > 0 ? candidate.signal.events.map((event) => `${event.currency} ${event.title}: score ${signed(event.score)}`).join(" · ") : "No event calculation rows loaded."}</td></tr>
                <tr><th>Integrity</th><td colSpan={3}>{isPrimary && integrityBlocked ? integrityIssues.join(" · ") : candidate.signal.observationMode === "recovered_offline" ? "Recovered offline — never eligible for automated entry" : "Live captured · registered setup · frozen geometry checked"}</td></tr>
              </tbody></table>
            </td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table> : (
        <div className="fms-action-empty"><Clock3 size={18} /><p>No registered trade is open or waiting for entry.</p></div>
      )}
      {conflict ? <div className="fms-action-warning"><AlertTriangle size={14} />{sameTime.length} simultaneous signals require review.</div> : null}
      {correlatedMarkets.length > 0 ? <div className="fms-action-warning"><AlertTriangle size={14} />Related currency exposure is already open in {Array.from(new Set(correlatedMarkets)).join(", ")}. FMS does not silently add another portfolio position.</div> : null}
      <section className="fms-action-activity" aria-label="Recent FMS activity">
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
                    <tr><th>Entry</th><td>{price(row.signal?.entry)}</td><th>ATR at entry</th><td>{row.signal?.atr == null ? "Unavailable" : `${row.signal.atr.toFixed(5)} · ${pipDistance(row.market, 0, row.signal.atr)}`}</td></tr>
                    <tr><th>Stop loss</th><td>{price(row.signal?.stop)} · {pipDistance(row.market, row.signal?.entry, row.signal?.stop)}</td><th>Take profit</th><td>{price(row.signal?.target)} · {pipDistance(row.market, row.signal?.entry, row.signal?.target)}</td></tr>
                    <tr><th>Observed result</th><td>{row.signal ? signalActivityState(row.signal) : row.state}</td><th>Exit / expiry</th><td>{row.signal?.exitTime ? formatJakartaDisplayDateTime(row.signal.exitTime) : row.signal?.expiryTime ? formatJakartaDisplayDateTime(row.signal.expiryTime) : "Unavailable"}</td></tr>
                    <tr><th>Best favorable move</th><td>{row.signal?.pathAudit ? `+${row.signal.pathAudit.maximumFavorableR.toFixed(2)}R · ${row.signal.pathAudit.maximumFavorablePips.toFixed(1)} pips` : "Unavailable"}</td><th>Worst adverse move</th><td>{row.signal?.pathAudit ? `-${row.signal.pathAudit.maximumAdverseR.toFixed(2)}R · -${row.signal.pathAudit.maximumAdversePips.toFixed(1)} pips` : "Unavailable"}</td></tr>
                    <tr><th>Decision evidence</th><td colSpan={3}>{row.assessment?.reason ?? (row.signal?.events.length ? row.signal.events.map((event) => `${event.currency} ${event.title}: score ${signed(event.score)}`).join(" · ") : "No calculation explanation loaded.")}</td></tr>
                    <tr><th>MT5 eligibility</th><td colSpan={3}>{row.source === "live" ? "Live-captured provenance. Automated demo transmission is not implemented and remains disabled." : "Ineligible. Historical, recovered, audit-only, and no-trade records can never be transmitted."}</td></tr>
                  </tbody></table>
                </td></tr> : null}
              </Fragment>;
            })}</tbody>
          </table> : <p>No registered decision has been recorded yet.</p>}
        </div>
      </section>
      <footer>The 90-second button window is an operational display rule around the exact frozen H4 open. Missing it does not create a new tested entry.</footer>
    </section>
  );
});
