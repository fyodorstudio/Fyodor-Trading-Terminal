import { AlertTriangle, Clock3, ShieldCheck } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
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
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalUpcomingPatternWatch } from "@/app/types";

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
      rows.set(key, { key, market: market.symbol, label: pattern.label, time: assessment.time, direction: signal?.direction ?? assessment.direction, state, source });
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

function executionLabel(signal: MacroSignalChartSignal, pattern: MacroSignalChartPattern): string {
  const execution = signal.execution ?? pattern.execution;
  const management = execution?.managementFamily === "break_even"
    ? ` · SL to entry after +${execution.managementTriggerR ?? 1}R`
    : "";
  return `SL ${execution?.stopAtr ?? 1} ATR · TP ${execution?.targetR ?? 2}R · maximum ${execution?.expiryCandles ?? 30} H4${management}`;
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
  const now = data.response.generatedAt ?? Math.floor(Date.now() / 1_000);
  const [clock, setClock] = useState(now);
  useEffect(() => {
    setClock(Math.max(now, Math.floor(Date.now() / 1_000)));
    const timer = window.setInterval(() => setClock(Math.floor(Date.now() / 1_000)), 30_000);
    return () => window.clearInterval(timer);
  }, [now]);
  const registeredSchedule = useMemo(() => buildRegisteredSetupSchedule(markets, clock), [markets, clock]);
  const datedSetupCount = registeredSchedule.filter((row) => row.watch != null).length;
  const recentActivity = useMemo(() => buildRecentFmsActivity(markets).slice(0, 10), [markets]);
  const open = candidates
    .filter(({ signal }) => signal.outcomeStatus === "pending" && signal.entry != null)
    .sort((left, right) => (right.signal.activationTime ?? 0) - (left.signal.activationTime ?? 0));
  const queued = candidates
    .filter(({ signal }) => signal.entry == null && signal.prospectiveCapture?.eligible === true)
    .sort((left, right) => (left.signal.prospectiveCapture?.activationTime ?? Number.POSITIVE_INFINITY) - (right.signal.prospectiveCapture?.activationTime ?? Number.POSITIVE_INFINITY));
  const primary = open[0] ?? queued[0] ?? null;
  const sameTime = primary ? [...open, ...queued].filter((candidate) =>
    candidate.market === primary.market
    && (candidate.signal.activationTime ?? candidate.signal.prospectiveCapture?.activationTime) === (primary.signal.activationTime ?? primary.signal.prospectiveCapture?.activationTime),
  ) : [];
  const conflict = new Set(sameTime.map((candidate) => candidate.signal.direction)).size > 1;
  const weakened = primary ? (data.globalResponse?.outcomeReview?.executionReviews ?? []).some((review) => review.market === primary.market && review.patternId === primary.pattern.id && review.status === "active_evidence_weakened") : false;
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
  const position = primary?.signal.entry != null
    ? buildMacroSignalShadowPosition(primary.signal, startingBalance, riskPercent, primary.market)
    : null;
  const history = primary ? historicalRecord(primary.pattern) : null;
  const activation = primary?.signal.activationTime ?? primary?.signal.prospectiveCapture?.activationTime ?? null;
  const withinEntryGrace = activation != null && now >= activation && now <= activation + ENTRY_GRACE_SECONDS;
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
          {registeredSchedule.length > 0 ? registeredSchedule.map((row) => (
            <div className={row.watch ? "fms-action-schedule-row is-scheduled" : "fms-action-schedule-row"} key={row.key}>
              <div><PairFlags symbol={row.market} /><strong>{row.market}</strong><span>{row.pattern.label}</span></div>
              {row.watch ? (
                <div><time>{formatJakartaDisplayDateTime(row.watch.time)}</time><b>{countdownLabel(row.watch.time, clock)}</b></div>
              ) : <small>No upcoming date loaded</small>}
            </div>
          )) : <p>No registered setup is loaded.</p>}
        </div>
      </section>
      <div className="fms-action-section-title"><span>Current registered setup</span><small>Open or waiting for entry</small></div>
      {action ? <div className={`fms-action-decision is-${action.tone}`}>
        <span>{action.state}</span>
        <strong>{action.title}</strong>
        <p>{action.detail}</p>
      </div> : null}
      {primary ? (
        <>
          <div className="fms-action-setup">
            <div><PairFlags symbol={primary.market} /><strong>{primary.market} · {primary.pattern.label}</strong></div>
            <b>{primary.signal.direction === "long" ? "LONG" : "SHORT"}</b>
          </div>
          <dl className="fms-action-grid">
            <div><dt>Release</dt><dd>{formatJakartaDisplayDateTime(primary.signal.eventTime)}</dd></div>
            <div><dt>Frozen entry</dt><dd>{activation == null ? "Unavailable" : formatJakartaDisplayDateTime(activation)}</dd></div>
            <div><dt>Entry</dt><dd>{price(primary.signal.entry)}</dd></div>
            <div><dt>SL</dt><dd>{price(primary.signal.stop)}</dd></div>
            <div><dt>TP</dt><dd>{price(primary.signal.target)}</dd></div>
            <div><dt>Risk amount</dt><dd>{position ? `$${position.riskDollars.toFixed(2)}` : `${riskPercent}% at entry`}</dd></div>
            <div><dt>Expiry</dt><dd>{primary.signal.expiryTime ? formatJakartaDisplayDateTime(primary.signal.expiryTime) : `${primary.signal.expiryCandles} H4 candles`}</dd></div>
            <div><dt>Lifecycle</dt><dd>{primary.signal.entry == null ? "Waiting for entry" : primary.signal.outcomeStatus === "pending" ? "Trade running" : primary.signal.outcomeStatus ?? "Unavailable"}</dd></div>
            <div><dt>Later-test average</dt><dd>{history?.averageR == null ? "Unavailable" : `${history.averageR >= 0 ? "+" : ""}${history.averageR.toFixed(2)}R`}</dd></div>
            <div><dt>TP before SL</dt><dd>{history?.tpRate == null ? "Unavailable" : `${(history.tpRate * 100).toFixed(1)}% · N ${history.sample}`}</dd></div>
          </dl>
          <div className="fms-action-rule"><span>Frozen rule</span><strong>{executionLabel(primary.signal, primary.pattern)}</strong></div>
          <div className="fms-action-reason">
            <span>Why</span>
            {primary.signal.events.map((event) => <p key={`${event.currency}:${event.title}`}><b>{event.currency} {event.title}</b><em>score {signed(event.score)}</em></p>)}
          </div>
          <div className="fms-action-integrity">
            <ShieldCheck size={14} />
            <span><b>Decision integrity:</b> {integrityBlocked ? integrityIssues.join(" · ") : "captured before the frozen entry · registered setup · frozen geometry available"}<br /><b>Setup health:</b> {weakened ? "Weakening — active later evidence needs review" : "Healthy — current registered audit remains intact"}</span>
          </div>
        </>
      ) : (
        <div className="fms-action-empty"><Clock3 size={18} /><p>No registered trade is open or waiting for entry.</p></div>
      )}
      {conflict ? <div className="fms-action-warning"><AlertTriangle size={14} />{sameTime.length} simultaneous signals require review.</div> : null}
      {correlatedMarkets.length > 0 ? <div className="fms-action-warning"><AlertTriangle size={14} />Related currency exposure is already open in {Array.from(new Set(correlatedMarkets)).join(", ")}. FMS does not silently add another portfolio position.</div> : null}
      <section className="fms-action-activity" aria-label="Recent FMS activity">
        <div className="fms-action-section-title"><span>Recent FMS activity</span><small>Newest first · latest {recentActivity.length}</small></div>
        <div className="fms-action-activity-scroll">
          {recentActivity.length > 0 ? recentActivity.map((row) => (
            <article key={row.key}>
              <div><PairFlags symbol={row.market} /><strong>{row.market}</strong><span>{row.label}</span></div>
              <div><b>{row.direction ? `${row.direction === "long" ? "Long" : "Short"} · ` : ""}{row.state}</b><time>{formatJakartaDisplayDateTime(row.time)}</time></div>
              <em className={`is-${row.source}`}>{row.source === "recovered" ? "Recovered offline" : row.source === "live" ? "Live captured" : "Decision"}</em>
            </article>
          )) : <p>No registered decision has been recorded yet.</p>}
        </div>
      </section>
      <footer>The 90-second button window is an operational display rule around the exact frozen H4 open. Missing it does not create a new tested entry.</footer>
    </section>
  );
});
