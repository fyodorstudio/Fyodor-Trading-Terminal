import { ChevronDown, ChevronRight, ShieldCheck, WalletCards } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChartMacroBiasNextSetup, ChartMacroBiasSetupCatalog } from "@/app/components/ChartMacroBiasSetupCatalog";
import { FlagIcon } from "@/app/components/FlagIcon";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import {
  DEFAULT_SHADOW_RISK_PERCENT,
  DEFAULT_SHADOW_STARTING_BALANCE,
  MAX_SHADOW_RISK_PERCENT,
  MIN_SHADOW_RISK_PERCENT,
  MIN_SHADOW_STARTING_BALANCE,
  buildMacroSignalShadowAccount,
  buildMacroSignalShadowPosition,
  normalizeShadowRiskPercent,
  normalizeShadowStartingBalance,
} from "@/app/lib/macroSignalShadow";
import { formatUtcDisplayDateTime } from "@/app/lib/format";
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalGlobalResponse, MacroSignalPatternAssessment } from "@/app/types";

const SHADOW_BALANCE_KEY = "fyodor.charts.shadow-starting-balance";
const SHADOW_RISK_KEY = "fyodor.charts.shadow-risk-percent";

function historicalAverage(pattern: MacroSignalChartPattern): number {
  return pattern.historicalBenchmark?.walkForwardAverageR ?? pattern.executionStress.overall.averageR ?? Number.NEGATIVE_INFINITY;
}

function historicalAccuracy(pattern: MacroSignalChartPattern): number {
  return pattern.historicalBenchmark?.targetFirstRate ?? pattern.overall.targetHitRate ?? Number.NEGATIVE_INFINITY;
}

function historicalSample(pattern: MacroSignalChartPattern): number {
  return pattern.historicalBenchmark?.walkForwardN ?? pattern.overall.evaluableCount;
}

export interface ChartMacroBiasRealtimeCardData {
  response: MacroSignalChartSignalResponse;
  activeSignal: MacroSignalChartSignal | null;
  activePattern: MacroSignalChartPattern | null;
  remainingModelCandles: number | null;
  chartTimeframe: string;
  historicalSignals: MacroSignalChartSignal[] | null;
  globalResponse?: MacroSignalGlobalResponse | null;
  globalLoading?: boolean;
  globalError?: string | null;
}

function readStoredNumber(key: string, fallback: number): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function formatUtc(value: number | null | undefined): string {
  return value == null ? "No scheduled row loaded" : formatUtcDisplayDateTime(value);
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Awaiting release update";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function EventCountdown({ targetTime }: { targetTime: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Math.floor(Date.now() / 1_000));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [targetTime]);
  return (
    <span className="chart-shadow-event-countdown" aria-label={`Countdown to ${formatUtc(targetTime)}`}>
      <small>Starts in</small>
      <strong>{now == null ? "Calculating…" : formatCountdown(targetTime - now)}</strong>
    </span>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPrice(value: number | null | undefined): string {
  return value == null ? "Waiting for entry" : value.toFixed(5);
}

function formatOutcome(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return `Target reached · +${signal.resultR?.toFixed(2) ?? signal.targetR ?? 0}R`;
  if (signal.outcomeStatus === "stop_hit") return `Stop reached · ${signal.resultR?.toFixed(2) ?? "-1.00"}R`;
  if (signal.outcomeStatus === "expired") return `Expired · ${signal.resultR == null ? "result unavailable" : `${signal.resultR >= 0 ? "+" : ""}${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "ambiguous") return "Both boundaries touched · order unknown";
  if (signal.outcomeStatus === "unevaluable") return "Could not be evaluated from loaded prices";
  return "Qualified · waiting for the frozen H4 entry";
}

function formatPoint(value: number | null): string {
  if (value == null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

function surpriseMeaning(value: number | null): string {
  if (value == null) return "excluded";
  return value > 0 ? "better" : value < 0 ? "worse" : "equal / unavailable";
}

function momentumMeaning(value: number | null): string {
  if (value == null) return "unavailable";
  return value > 0 ? "improving" : value < 0 ? "weakening" : "equal / unavailable";
}

function relativeMagnitude(value: { status: string; percentile?: number; priorCount: number; category?: string } | undefined): string {
  if (!value || value.status === "unavailable") return "relative size unavailable";
  if (value.status !== "ready" || value.percentile == null) return `relative size needs more history · prior N ${value.priorCount}`;
  return `${Math.round(value.percentile * 100)}th percentile · ${value.category} · prior N ${value.priorCount}`;
}

function buildDecisionScenarios(pattern: MacroSignalChartPattern, symbol: string): Array<[string, string]> {
  const currency = pattern.groups[0]?.split(":")[0] ?? symbol.slice(0, 3);
  if (pattern.direction === "both") {
    const improvingAction = symbol.startsWith(currency) ? `Long ${symbol}` : `Short ${symbol}`;
    const weakeningAction = symbol.startsWith(currency) ? `Short ${symbol}` : `Long ${symbol}`;
    return [
      [`IF registered ${currency} evidence improves`, improvingAction],
      [`IF registered ${currency} evidence weakens`, weakeningAction],
      ["IF evidence is zero, missing, or conflicted", "No trade"],
    ];
  }
  return [
    ["IF the registered rule is fully satisfied", `Open simulated ${pattern.direction === "long" ? "Long" : "Short"} ${symbol}`],
    ["IF evidence is partial, conflicted, zero, or missing", "No trade"],
  ];
}

function PairFlags({ symbol }: { symbol: string }) {
  const base = symbol.slice(0, 3) as keyof typeof CURRENCY_TO_COUNTRY_CODE;
  const quote = symbol.slice(3, 6) as keyof typeof CURRENCY_TO_COUNTRY_CODE;
  return (
    <span className="chart-shadow-pair-flags" aria-label={`${symbol} flags`}>
      <FlagIcon countryCode={CURRENCY_TO_COUNTRY_CODE[base] ?? ""} className="chart-shadow-pair-flag" />
      <FlagIcon countryCode={CURRENCY_TO_COUNTRY_CODE[quote] ?? ""} className="chart-shadow-pair-flag" />
    </span>
  );
}

function packageDecisionCopy(assessment: MacroSignalPatternAssessment, pattern: MacroSignalChartPattern | null, symbol: string) {
  if (assessment.status === "qualified") {
    return {
      title: `${assessment.direction === "long" ? "Long" : "Short"} ${symbol} qualified`,
      detail: "The complete release package matched the registered direction. The hypothetical trade waits for the first strictly later H4 open.",
    };
  }
  if (assessment.status === "pre_activation_audit") {
    return {
      title: `${assessment.direction === "long" ? "Long" : "Short"} ${symbol} · audit only`,
      detail: "The package matched the rule, but it occurred before this registered setup was activated.",
    };
  }
  if (assessment.status === "awaiting_observation") {
    return { title: "Waiting for frozen values", detail: "FMS will decide after the next completed EA cycle records the first-seen Actual values." };
  }
  const positive = assessment.calculations?.filter((row) => row.score > 0).length ?? 0;
  const negative = assessment.calculations?.filter((row) => row.score < 0).length ?? 0;
  const mixed = assessment.calculations?.filter((row) => row.score === 0).length ?? 0;
  return {
    title: "No registered direction matched",
    detail: pattern
      ? `Individual release totals are inputs, not separate trades. Package rows: ${positive} positive, ${negative} negative, ${mixed} mixed/zero. The complete package did not match this setup's registered direction.`
      : assessment.reason,
  };
}

interface ShadowTradeRow {
  key: string;
  market: string;
  signal: MacroSignalChartSignal;
  pattern: MacroSignalChartPattern | null;
  assessment: MacroSignalPatternAssessment;
}

function assessmentForSignal(
  signal: MacroSignalChartSignal,
  pattern: MacroSignalChartPattern | null,
  exactAssessment: MacroSignalPatternAssessment | null,
): MacroSignalPatternAssessment {
  if (exactAssessment?.time === signal.eventTime) return exactAssessment;
  return {
    time: signal.eventTime,
    patternId: signal.patternId,
    label: pattern?.label ?? signal.label,
    condition: pattern?.condition ?? "This release matched a registered FMS setup.",
    status: "qualified",
    direction: signal.direction,
    reason: "This package produced a registered hypothetical trade.",
    events: [],
    calculations: signal.events.map((event) => ({
      title: event.title,
      actual: event.actual,
      forecast: event.forecast,
      previous: event.previous,
      surprisePoint: event.surprisePoint,
      momentumPoint: event.momentumPoint,
      agreementBonus: event.agreementBonus,
      score: event.score,
      scoringPolicy: pattern?.scoringPolicy ?? null,
    })),
  };
}

function LatestDecisionSection({ assessment, pattern, symbol, signal }: { assessment: MacroSignalPatternAssessment; pattern: MacroSignalChartPattern | null; symbol: string; signal?: MacroSignalChartSignal | null }) {
  const status = signal
    ? signal.outcomeStatus === "pending"
      ? signal.activationTime == null ? "Waiting for H4 entry" : "Trade open"
      : formatOutcome(signal)
    : assessment.status === "pre_activation_audit"
    ? "Audit only"
    : assessment.status === "no_trade"
      ? "No trade"
      : assessment.status === "qualified"
        ? "Qualified"
        : "Processing";
  const packageDecision = signal ? {
    title: `${signal.direction === "long" ? "Long" : "Short"} ${symbol}`,
    detail: signal.outcomeStatus === "pending"
      ? signal.activationTime == null
        ? "The registered package qualified. The hypothetical trade waits for the first strictly later H4 open."
        : "The hypothetical trade is open and being monitored under this setup's frozen SL, TP, and maximum duration."
      : `This hypothetical trade is closed: ${formatOutcome(signal)}. Its historical result remains fixed.`,
  } : packageDecisionCopy(assessment, pattern, symbol);
  return (
    <section className="chart-shadow-decision" aria-label="Selected FMS trade decision audit">
      <div className="chart-shadow-section-heading">
        <div><span>Trade decision audit</span><strong className="chart-shadow-decision-title"><PairFlags symbol={symbol} />{pattern?.label ?? assessment.label}</strong></div>
        <div className="chart-shadow-decision-meta">
          <b className={`chart-shadow-status is-${assessment.status}`}>{status}</b>
          <time>{formatUtc(assessment.time)}</time>
        </div>
      </div>
      {pattern ? (
        <div className="chart-shadow-hunt-plan">
          <div className="chart-shadow-hunt-rule"><span>What FMS is hunting</span><strong>{pattern.condition}</strong></div>
          <div className="chart-shadow-if-grid" aria-label="Possible FMS decisions">
            {buildDecisionScenarios(pattern, symbol).map(([condition, action]) => (
              <div key={condition}><span>{condition}</span><strong>{action}</strong></div>
            ))}
          </div>
        </div>
      ) : null}
      {assessment.calculations?.map((calculation) => (
        <div className="chart-shadow-decision-audit" key={`${assessment.time}-${calculation.title}`}>
          <h4>{calculation.title}</h4>
          <dl>
            <div><dt>Actual</dt><dd>{calculation.actual ?? "–"}</dd></div>
            <div><dt>Forecast</dt><dd>{calculation.forecast ?? "–"}</dd></div>
            <div><dt>Previous</dt><dd>{calculation.previous ?? "–"}</dd></div>
            <div><dt>Surprise</dt><dd>{calculation.forecastSuspect ? "Excluded · suspect" : `${surpriseMeaning(calculation.surprisePoint)} ${formatPoint(calculation.surprisePoint)}`}<small>{relativeMagnitude(calculation.surpriseMagnitude)}</small></dd></div>
            <div><dt>Momentum</dt><dd>{momentumMeaning(calculation.momentumPoint)} {formatPoint(calculation.momentumPoint)}<small>{relativeMagnitude(calculation.momentumMagnitude)}</small></dd></div>
            <div><dt>Total</dt><dd>{formatPoint(calculation.score)}</dd></div>
          </dl>
          {calculation.score === 0 ? <p><b>This release only:</b> Surprise and Momentum offset each other, so this row contributes 0. It does not cancel the other releases.</p> : null}
          {assessment.status === "pre_activation_audit" ? <p><b>Decision:</b> {assessment.direction === "long" ? `Long ${symbol}` : `Short ${symbol}`} under the frozen scoring rule, but audit-only because the release predates model activation.</p> : null}
          <small>{calculation.forecastSuspect ? `Raw Forecast ${calculation.forecast ?? "–"} retained; ${calculation.forecastGap?.toFixed(2) ?? "–"} gap exceeded the past-only ${calculation.forecastAnomalyThreshold?.toFixed(2) ?? "–"} threshold.` : "Frozen first-seen MT5 values."}</small>
        </div>
      ))}
      <div className={`chart-shadow-package-decision is-${assessment.status}`}>
        <span>Complete package decision</span>
        <strong>{packageDecision.title}</strong>
        <p>{packageDecision.detail}</p>
      </div>
    </section>
  );
}

export function ChartMacroBiasRealtimeCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const { response, activeSignal, activePattern } = data;
  const [setupSort, setSetupSort] = useState<"profitability" | "accuracy" | "soonest" | "name">("accuracy");
  const [selectedTradeKey, setSelectedTradeKey] = useState<string | null>(null);
  const [startingBalance, setStartingBalance] = useState(() => normalizeShadowStartingBalance(readStoredNumber(SHADOW_BALANCE_KEY, DEFAULT_SHADOW_STARTING_BALANCE)));
  const [riskPercent, setRiskPercent] = useState(() => normalizeShadowRiskPercent(readStoredNumber(SHADOW_RISK_KEY, DEFAULT_SHADOW_RISK_PERCENT)));
  const registryResponses = useMemo(
    () => data.globalResponse?.markets.filter((market) => market.supported) ?? [response],
    [data.globalResponse, response],
  );
  const nextEvent = response.realtime?.nextPairEvent ?? null;
  const nextWatchEntry = useMemo(() => registryResponses
    .flatMap((market) => (market.realtime?.upcomingPatternWatches ?? (market.realtime?.nextPatternWatch ? [market.realtime.nextPatternWatch] : [])).map((watch) => ({ market, watch })))
    .sort((left, right) => left.watch.time - right.watch.time || left.market.symbol.localeCompare(right.market.symbol))[0] ?? null, [registryResponses]);
  const nextWatch = nextWatchEntry?.watch ?? null;
  const latestAssessmentEntry = useMemo(() => registryResponses
    .flatMap((market) => (market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : [])).map((assessment) => ({ market, assessment })))
    .sort((left, right) => right.assessment.time - left.assessment.time || left.market.symbol.localeCompare(right.market.symbol))[0] ?? null, [registryResponses]);
  const latestAssessment = latestAssessmentEntry?.assessment ?? null;
  const registeredPatternRows = useMemo(
    () => registryResponses.flatMap((market) => market.patterns.filter((pattern) => pattern.currentEligible)),
    [registryResponses],
  );
  const openSignals = useMemo(
    () => registryResponses.flatMap((market) => market.signals.filter((signal) => signal.outcomeStatus === "pending" && signal.activationTime != null && signal.entry != null)),
    [registryResponses],
  );
  const verifiedPatterns = useMemo(
    () => registeredPatternRows.filter((pattern) => pattern.registrationProvenance?.status === "verified"),
    [registeredPatternRows],
  );
  const registryHistoricallyReady = registeredPatternRows.length > 0 && verifiedPatterns.length === registeredPatternRows.length;
  const assessmentsByPattern = useMemo(
    () => new Map(registryResponses.flatMap((market) => (market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : [])).map((assessment) => [`${market.symbol}:${assessment.patternId}`, assessment]))),
    [registryResponses],
  );
  const tradeRows = useMemo<ShadowTradeRow[]>(() => registryResponses.flatMap((market) => {
    const assessments = market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : []);
    const exactAssessments = new Map(assessments.map((assessment) => [`${assessment.patternId}:${assessment.time}`, assessment]));
    const patterns = new Map(market.patterns.map((pattern) => [pattern.id, pattern]));
    return market.signals
      .filter((signal) => signal.activationTime != null)
      .map((signal) => {
        const pattern = patterns.get(signal.patternId) ?? null;
        const exactAssessment = exactAssessments.get(`${signal.patternId}:${signal.eventTime}`) ?? null;
        return {
          key: `${market.symbol}:${signal.id}`,
          market: market.symbol,
          signal,
          pattern,
          assessment: assessmentForSignal(signal, pattern, exactAssessment),
        };
      });
  }).sort((left, right) => (right.signal.activationTime ?? 0) - (left.signal.activationTime ?? 0) || right.signal.eventTime - left.signal.eventTime || left.key.localeCompare(right.key)), [registryResponses]);
  const currentTradeRows = useMemo(
    () => tradeRows.filter((row) => row.signal.outcomeStatus === "pending" && row.signal.entry != null),
    [tradeRows],
  );
  const currentTradeKeys = useMemo(() => new Set(currentTradeRows.map((row) => row.key)), [currentTradeRows]);
  const lastOpenedTrade = useMemo(
    () => tradeRows.find((row) => !currentTradeKeys.has(row.key)) ?? null,
    [currentTradeKeys, tradeRows],
  );
  const selectedTrade = selectedTradeKey == null ? null : tradeRows.find((row) => row.key === selectedTradeKey) ?? null;
  const upcomingByPattern = useMemo(
    () => new Map(registryResponses.flatMap((market) => (market.realtime?.upcomingPatternWatches ?? (market.realtime?.nextPatternWatch ? [market.realtime.nextPatternWatch] : [])).map((watch) => [`${market.symbol}:${watch.patternId}`, watch]))),
    [registryResponses],
  );
  const registeredPatterns = useMemo(() => [...registeredPatternRows].sort((left, right) => {
    const leftMarket = left.market ?? response.symbol;
    const rightMarket = right.market ?? response.symbol;
    if (setupSort === "name") return leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
    if (setupSort === "soonest") {
      const leftTime = upcomingByPattern.get(`${leftMarket}:${left.id}`)?.time ?? Number.POSITIVE_INFINITY;
      const rightTime = upcomingByPattern.get(`${rightMarket}:${right.id}`)?.time ?? Number.POSITIVE_INFINITY;
      return leftTime - rightTime || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
    }
    const leftValue = setupSort === "accuracy" ? historicalAccuracy(left) : historicalAverage(left);
    const rightValue = setupSort === "accuracy" ? historicalAccuracy(right) : historicalAverage(right);
    return rightValue - leftValue || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
  }), [registeredPatternRows, response.symbol, setupSort, upcomingByPattern]);
  const watchPattern = nextWatch
    ? nextWatchEntry?.market.patterns.find((pattern) => pattern.id === nextWatch.patternId) ?? null
    : null;
  const settings = useMemo(() => ({ startingBalance, riskPercent }), [startingBalance, riskPercent]);
  const liveAccount = useMemo(() => buildMacroSignalShadowAccount(registryResponses.flatMap((market) => market.signals), settings), [registryResponses, settings]);
  const historicalAccount = useMemo(
    () => data.historicalSignals == null ? null : buildMacroSignalShadowAccount(data.historicalSignals, settings),
    [data.historicalSignals, settings],
  );
  const position = activeSignal ? buildMacroSignalShadowPosition(activeSignal, liveAccount.balance, riskPercent, response.symbol) : null;
  const timeframeLabel = data.chartTimeframe === response.modelTimeframe
    ? `${response.modelTimeframe} backtest model`
    : `${response.modelTimeframe} backtest · shown on ${data.chartTimeframe}`;
  const scannerState = openSignals.length > 0
    ? { label: "Trade open", detail: `${openSignals.length} hypothetical trade${openSignals.length === 1 ? "" : "s"} being monitored` }
    : latestAssessment?.status === "awaiting_observation"
      ? { label: "Checking release", detail: "Waiting for the broker's Actual value" }
      : { label: "Scanning", detail: `Watching ${registeredPatternRows.length} registered setup${registeredPatternRows.length === 1 ? "" : "s"}` };

  const updateStartingBalance = (value: number) => {
    const normalized = normalizeShadowStartingBalance(value);
    setStartingBalance(normalized);
    try { window.localStorage.setItem(SHADOW_BALANCE_KEY, String(normalized)); } catch { /* optional preference */ }
    return normalized;
  };
  const updateRiskPercent = (value: number) => {
    const normalized = normalizeShadowRiskPercent(value);
    setRiskPercent(normalized);
    try { window.localStorage.setItem(SHADOW_RISK_KEY, String(normalized)); } catch { /* optional preference */ }
    return normalized;
  };

  const renderTradeRow = (row: ShadowTradeRow) => {
    const selected = selectedTradeKey === row.key;
    const signal = row.signal;
    const state = signal.outcomeStatus === "pending" ? "Open" : formatOutcome(signal);
    return (
      <tr
        key={row.key}
        className={selected ? "is-selected" : undefined}
        role="button"
        tabIndex={0}
        aria-expanded={selected}
        onClick={() => setSelectedTradeKey((current) => current === row.key ? null : row.key)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedTradeKey((current) => current === row.key ? null : row.key);
          }
        }}
      >
        <td><strong><PairFlags symbol={row.market} />{row.pattern?.label ?? signal.label}</strong><small>{signal.direction === "long" ? `Long ${row.market}` : `Short ${row.market}`}</small></td>
        <td><strong>{formatUtc(signal.activationTime)}</strong><small>Release {formatUtc(signal.eventTime)}</small></td>
        <td><strong>{state}</strong><small>SL {signal.stopAtr ?? row.pattern?.execution?.stopAtr ?? 1} ATR · TP {signal.targetR ?? row.pattern?.execution?.targetR ?? 2}R · {signal.expiryCandles} H4</small></td>
        <td><span>{selected ? "Hide audit" : "View audit"}</span>{selected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
      </tr>
    );
  };

  return (
    <aside className="chart-macro-bias-realtime" aria-label="FMS Shadow Trader">
      <header>
        <div><ShieldCheck size={14} /><span>FMS Shadow Trader</span></div>
        <small>{data.globalResponse ? `${registryResponses.length} markets live` : timeframeLabel}</small>
      </header>
      <section className="chart-shadow-trade-monitor" aria-label="Current and recent hypothetical FMS trades">
        <div className="chart-shadow-section-heading">
          <div><span>Trade monitor</span><strong>What FMS has opened</strong></div>
          <small>Hypothetical only · click a row for its decision audit</small>
        </div>
        <table>
          <thead><tr><th>Setup and direction</th><th>Opened</th><th>State and rules</th><th>Audit</th></tr></thead>
          <tbody>
            <tr className="chart-shadow-trade-group"><th colSpan={4}>Open now</th></tr>
            {currentTradeRows.length > 0 ? currentTradeRows.map(renderTradeRow) : <tr className="chart-shadow-trade-empty"><td colSpan={4}>No hypothetical trade is currently open.</td></tr>}
            <tr className="chart-shadow-trade-group"><th colSpan={4}>Last opened trade</th></tr>
            {lastOpenedTrade ? renderTradeRow(lastOpenedTrade) : <tr className="chart-shadow-trade-empty"><td colSpan={4}>No earlier opened trade is loaded.</td></tr>}
          </tbody>
        </table>
      </section>
      {selectedTrade ? <LatestDecisionSection assessment={selectedTrade.assessment} pattern={selectedTrade.pattern} symbol={selectedTrade.market} signal={selectedTrade.signal} /> : null}
      <section className={`chart-shadow-readiness ${registryHistoricallyReady ? "is-audited" : "is-blocked"}`} aria-label="FMS readiness">
        <div>
          <span>Can I follow this blindly?</span>
          <strong>No.</strong>
        </div>
        <p>{registryHistoricallyReady
          ? `${verifiedPatterns.length} registered recipe${verifiedPatterns.length === 1 ? " has" : "s have"} positive later-test historical averages and verified immutable records. This is research support, not proof that the next trade will profit.`
          : `${verifiedPatterns.length} of ${registeredPatternRows.length} registered recipes currently reconcile with corrected immutable backtests. Do not act on an unverified recipe.`}</p>
      </section>
      <section className="chart-shadow-scanner" aria-label="FMS scanner status">
        <div className="chart-shadow-scanner-state">
          <span>{scannerState.label}</span>
          <strong>{scannerState.detail}</strong>
          <small>No MT5 order is sent.</small>
        </div>
        <div className="chart-shadow-scanner-grid">
          <div><span>Registered setups</span><strong>{registeredPatternRows.length}</strong></div>
          <div><span>Markets watched</span><strong>{registryResponses.length}</strong></div>
          <div><span>Next registered event</span><strong>{nextWatch ? formatUtc(nextWatch.time) : "None loaded"}</strong></div>
        </div>
      </section>
      {data.globalLoading ? <section className="chart-shadow-global-state">Loading the global registry…</section> : null}
      {data.globalError ? <section className="chart-shadow-global-state is-error">Global registry unavailable: {data.globalError}. Showing {response.symbol} only.</section> : null}
      <section className="chart-shadow-priority" aria-label="All registered FMS setups">
        <div className="chart-shadow-section-heading">
          <div><span>Live watchlist</span><strong>Every registered setup</strong></div>
          <label><span>Sort</span><select value={setupSort} onChange={(event) => setSetupSort(event.target.value as typeof setupSort)}><option value="accuracy">Highest TP-before-SL</option><option value="soonest">Soonest registered release</option><option value="profitability">Best average result</option><option value="name">Pair / setup (A–Z)</option></select></label>
        </div>
        <table>
          <thead><tr><th>Pair and setup</th><th>Now</th><th>Relevant event</th><th>Historical result</th></tr></thead>
          <tbody>
            {registeredPatterns.map((pattern) => {
              const patternMarket = pattern.market ?? response.symbol;
              const patternResponse = registryResponses.find((market) => market.symbol === patternMarket) ?? response;
              const patternSignals = patternResponse.signals
                .filter((signal) => signal.patternId === pattern.id)
                .sort((left, right) => right.eventTime - left.eventTime || right.id.localeCompare(left.id));
              const patternSignal = response.symbol === patternMarket && activeSignal?.patternId === pattern.id ? activeSignal : patternSignals[0] ?? null;
              const assessment = assessmentsByPattern.get(`${patternMarket}:${pattern.id}`) ?? null;
              const upcoming = upcomingByPattern.get(`${patternMarket}:${pattern.id}`) ?? null;
              const assessmentIsNewer = assessment && (!patternSignal || assessment.time > patternSignal.eventTime);
              const openOrPending = patternSignal && !assessmentIsNewer && patternSignal.outcomeStatus === "pending";
              const latestTime = assessmentIsNewer ? assessment.time : patternSignal?.eventTime ?? assessment?.time ?? null;
              return (
                <Fragment key={pattern.id}>
                  <tr className={openOrPending ? "is-current" : undefined}>
                    <td><strong className="chart-shadow-setup-title"><PairFlags symbol={patternMarket} />{patternMarket} · {pattern.label}</strong><small className="chart-shadow-contract-line">SL {pattern.execution?.stopAtr ?? 1} ATR · TP {pattern.execution?.targetR ?? 2}R · {pattern.execution?.expiryCandles ?? 30} H4</small><span className={`chart-shadow-reaction is-${pattern.reaction === "contrarian" ? "rejected" : "followed"}`}>{pattern.reaction === "contrarian" ? "Rejected evidence" : "Followed evidence"}</span></td>
                    <td className="chart-shadow-now-cell">{openOrPending ? (
                      <><strong>{patternSignal.activationTime != null ? "Trade open" : "Waiting for H4 entry"}</strong><small>{patternSignal.direction === "long" ? `Long ${patternMarket}` : `Short ${patternMarket}`}</small></>
                    ) : patternSignal && !assessmentIsNewer && patternSignal.outcomeStatus && patternSignal.outcomeStatus !== "pending" ? (
                      <strong>{formatOutcome(patternSignal)}</strong>
                    ) : assessment ? (
                      <strong>{assessment.status === "awaiting_observation" ? "Checking release" : assessment.status === "qualified" ? "Trade qualified" : assessment.status === "pre_activation_audit" ? `Past result · ${assessment.direction === "long" ? "Long" : "Short"}` : "Watching"}</strong>
                    ) : <span>Watching</span>}</td>
                    <td className="chart-shadow-event-cell">
                      {upcoming ? (
                        <div className="chart-shadow-event-block is-next">
                          <span className="chart-shadow-event-kicker">Next registered release</span>
                          <strong>{formatUtc(upcoming.time)}</strong>
                          <EventCountdown targetTime={upcoming.time} />
                        </div>
                      ) : null}
                      {latestTime != null ? (
                        <div className="chart-shadow-event-block is-latest">
                          <span className="chart-shadow-event-kicker">Latest matching release</span>
                          <strong>{formatUtc(latestTime)}</strong>
                        </div>
                      ) : !upcoming ? <span className="chart-shadow-event-empty">No upcoming release loaded</span> : null}
                    </td>
                    <td className="chart-shadow-history-cell">
                      <span className="chart-shadow-history-kicker">Later-test history</span>
                      {pattern.historicalBenchmark?.strength === "positive_but_fragile" ? <span className="chart-shadow-history-strength">Positive but fragile</span> : null}
                      <div className="chart-shadow-history-primary"><strong>{historicalAverage(pattern) >= 0 ? "+" : ""}{historicalAverage(pattern).toFixed(2)}R</strong><small>average per trade</small></div>
                      <div className="chart-shadow-history-metrics">
                        <span><b>{(historicalAccuracy(pattern) * 100).toFixed(1)}%</b> TP before SL</span>
                        <span><b>{historicalSample(pattern)}</b> later test trades</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="chart-shadow-priority-detail" hidden>
                    <td colSpan={4}>
                      {assessment?.calculations?.length ? (
                        <div className="chart-shadow-calculation" aria-label={assessment.reason}>
                          <div className="chart-shadow-calculation-heading">
                            <strong>{assessment.status === "no_trade" ? "Why no trade" : assessment.status === "pre_activation_audit" ? "Forecast Guard reclassification" : "Latest frozen calculation"}</strong>
                            <span>MT5 first-seen values</span>
                          </div>
                          {assessment.calculations.map((calculation) => (
                            <div className="chart-shadow-calculation-event" key={`${assessment.time}-${calculation.title}`}>
                              <strong>{calculation.title}</strong>
                              <div className="chart-shadow-calculation-values">
                                <span><b>Actual</b>{calculation.actual ?? "–"}</span>
                                <span><b>Forecast</b>{calculation.forecast ?? "–"}</span>
                                <span><b>Previous</b>{calculation.previous ?? "–"}</span>
                                <span><b>A vs F</b>{calculation.forecastSuspect ? "excluded · suspect" : `${surpriseMeaning(calculation.surprisePoint)} (${formatPoint(calculation.surprisePoint)})`}</span>
                                <span><b>A vs P</b>{momentumMeaning(calculation.momentumPoint)} ({formatPoint(calculation.momentumPoint)})</span>
                                <span><b>Bonus</b>{formatPoint(calculation.agreementBonus)}</span>
                                <span><b>Total</b>{formatPoint(calculation.score)}</span>
                              </div>
                              {calculation.score === 0 ? <p><b>This release only:</b> Surprise and Momentum offset each other, so this row contributes 0. It does not cancel the other releases.</p> : null}
                              {assessment.status === "pre_activation_audit" ? <p><b>Decision:</b> the frozen scoring rule produces {assessment.direction === "long" ? `Long ${patternMarket}` : `Short ${patternMarket}`}, but this release occurred before the model activated, so no hypothetical trade was opened.</p> : null}
                              <small className="chart-shadow-source-note">{calculation.forecastSuspect ? `Raw MT5 Forecast ${calculation.forecast ?? "–"} was preserved but excluded: its ${calculation.forecastGap?.toFixed(2) ?? "–"} Forecast/Previous gap exceeded the past-only ${calculation.forecastAnomalyThreshold?.toFixed(2) ?? "–"} threshold.` : "FMS uses the frozen first-seen MT5 values above."}</small>
                            </div>
                          ))}
                        </div>
                      ) : assessment ? <p className="chart-shadow-assessment-reason" aria-label={assessment.reason}>{assessment.reason}</p> : null}
                      <p className="chart-shadow-frozen-rule"><b>Trade rule:</b> {pattern.condition}</p>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <ChartMacroBiasNextSetup watch={nextWatch} pattern={watchPattern} symbol={nextWatchEntry?.market.symbol ?? response.symbol} asOf={nextWatchEntry?.market.realtime?.asOf ?? response.realtime?.asOf ?? response.generatedAt ?? Math.floor(Date.now() / 1_000)} />

      <section className="chart-shadow-settings" aria-label="Gross shadow account assumptions">
        <div className="chart-shadow-section-heading"><div><span><WalletCards size={12} /> Hypothetical account</span><strong>Past trades applied in sequence</strong></div></div>
        <label>
          <span>Starting balance</span>
          <span className="chart-shadow-input"><b>$</b><input type="number" min={MIN_SHADOW_STARTING_BALANCE} step="1" defaultValue={startingBalance} onBlur={(event) => { event.currentTarget.value = String(updateStartingBalance(Number(event.currentTarget.value))); }} /></span>
        </label>
        <label>
          <span>Risk per trade</span>
          <span className="chart-shadow-input"><input type="number" min={MIN_SHADOW_RISK_PERCENT} max={MAX_SHADOW_RISK_PERCENT} step="0.01" defaultValue={riskPercent} onBlur={(event) => { event.currentTarget.value = String(updateRiskPercent(Number(event.currentTarget.value))); }} /><b>%</b></span>
        </label>
        <small>One position at a time · each registered setup uses its frozen ATR stop, R target, and H4 expiry · sequential compounding</small>
      </section>

      <section className="chart-shadow-ledger" aria-label="Gross account results">
        <div className="chart-shadow-section-heading"><div><span>Performance replay</span><strong>Account results</strong></div></div>
        <div>
          <span>Registered setups since activation</span>
          <strong>{formatMoney(liveAccount.balance)}</strong>
          <small>{liveAccount.takenTrades} closed · {formatMoney(liveAccount.profit)} P/L</small>
        </div>
        <div>
          <span>{response.symbol} past registered setups</span>
          <strong>{historicalAccount ? formatMoney(historicalAccount.balance) : "Loading…"}</strong>
          <small>{historicalAccount ? `${historicalAccount.takenTrades} trades · ${historicalAccount.returnPercent >= 0 ? "+" : ""}${historicalAccount.returnPercent.toFixed(1)}% · DD ${historicalAccount.maxDrawdownPercent.toFixed(1)}%` : "Current-pattern history only"}</small>
        </div>
        {historicalAccount && (historicalAccount.skippedOverlap > 0 || historicalAccount.skippedConflict > 0 || historicalAccount.ambiguous > 0 || historicalAccount.unevaluable > 0) ? (
          <p>{historicalAccount.skippedOverlap} overlapping skipped · {historicalAccount.skippedConflict} simultaneous conflicts skipped · {historicalAccount.ambiguous} ambiguous excluded · {historicalAccount.unevaluable} unevaluable excluded</p>
        ) : null}
      </section>

      {data.globalResponse ? (
        <section className="chart-shadow-intelligence" aria-label="FMS historical research intelligence">
          <div className="chart-shadow-section-heading">
            <div><span>What history says</span><strong>What to watch and avoid</strong></div>
          </div>
          <p>{data.globalResponse.explanation}</p>
          {(["contender", "avoid"] as const).map((status) => {
            const rows = data.globalResponse!.researchIntelligence.filter((row) => row.status === status);
            return (
              <details key={status}>
                <summary>
                  <strong>{status === "contender" ? "Research contenders" : "Avoid as standalone direction"}</strong>
                  <span><b>{rows.length}</b><em>Show</em><ChevronDown size={13} /></span>
                </summary>
                {rows.map((row) => (
                  <article key={row.id}>
                    <h4>{row.market} · {row.label}</h4>
                    <p>{row.evidence}</p>
                    <small>{row.conclusion}</small>
                  </article>
                ))}
              </details>
            );
          })}
          <small className="chart-shadow-source-note">“Avoid” does not mean the release is irrelevant. It means its economic direction did not produce a dependable standalone price-direction rule in the recorded tests.</small>
        </section>
      ) : null}

      {activeSignal && position ? (
        <section className="chart-shadow-position" aria-label="Hypothetical position">
          <div className="chart-macro-bias-realtime-kicker">Open hypothetical trade · no MT5 order</div>
          <div className="chart-shadow-position-grid">
            <div><span>Entry</span><strong>{formatPrice(activeSignal.entry)}</strong></div>
            <div><span>Stop</span><strong>{formatPrice(activeSignal.stop)}</strong></div>
            <div><span>{activeSignal.targetR ?? activePattern?.execution?.targetR ?? response.targetR}R target</span><strong>{formatPrice(activeSignal.target)}</strong></div>
            <div><span>Risk</span><strong>{formatMoney(position.riskDollars)}</strong></div>
            <div><span>Stop distance</span><strong>{position.stopPips == null ? "—" : `${position.stopPips.toFixed(1)} pips`}</strong></div>
            <div><span>Position size</span><strong>{position.lots == null ? "—" : `${position.lots.toFixed(2)} lots`}</strong></div>
          </div>
          <p>{activeSignal.events.map((event) => `${event.currency} ${event.title}: score ${event.score > 0 ? "+" : ""}${event.score}`).join(" · ")}</p>
          <small className="chart-shadow-source-note">{position.sizingNote}</small>
        </section>
      ) : null}

      <ChartMacroBiasSetupCatalog patterns={registeredPatterns} />

      {response.policyInflationContext ? (
        <section className="chart-macro-bias-realtime-context" aria-label="Policy and inflation context">
          <span>Policy / inflation context</span>
          {(["EUR", "USD"] as const).map((currency) => {
            const context = response.policyInflationContext!.currencies[currency];
            return (
              <div key={currency}>
                <strong>{currency}</strong>
                <span>Policy {context.policy.state}{context.policy.actual ? ` ${context.policy.actual}` : ""}</span>
                <span>Inflation {context.inflation.state} · {context.inflation.heatingGroups}↑ {context.inflation.coolingGroups}↓</span>
              </div>
            );
          })}
          <small>Context only—it does not filter or reverse the hypothetical position.</small>
        </section>
      ) : null}

      {nextEvent && (!nextWatch || nextEvent.time < nextWatch.time) ? (
        <section className="chart-macro-bias-realtime-next">
          <div className="chart-macro-bias-realtime-kicker">Earlier {response.symbol} calendar row</div>
          <strong>{nextEvent.currency} · {nextEvent.title}</strong><span>{formatUtc(nextEvent.time)} · {nextEvent.impact} impact · not a registered setup</span>
        </section>
      ) : null}
      <footer>Hypothetical results only: spread, commission, slippage, and swap are excluded. No order is sent to MT5. Past results do not guarantee the next trade.</footer>
    </aside>
  );
}
