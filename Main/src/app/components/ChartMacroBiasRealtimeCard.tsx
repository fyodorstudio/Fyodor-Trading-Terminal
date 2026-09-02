import { ChevronDown, ChevronRight, ShieldCheck, WalletCards } from "lucide-react";
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { ChartMacroBiasSetupCatalog, macroSignalReactionLabel, macroSignalSetupCredibility } from "@/app/components/ChartMacroBiasSetupCatalog";
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
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalGlobalResponse, MacroSignalPatternAssessment, MacroSignalResearchIntelligence, MacroSignalUpcomingPatternWatch } from "@/app/types";

const SHADOW_BALANCE_KEY = "fyodor.charts.shadow-starting-balance";
const SHADOW_RISK_KEY = "fyodor.charts.shadow-risk-percent";

function historicalAverage(pattern: MacroSignalChartPattern): number {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  if (typeof reviewed?.averageR === "number") return reviewed.averageR;
  return pattern.historicalBenchmark?.walkForwardAverageR ?? pattern.executionStress.overall.averageR ?? Number.NEGATIVE_INFINITY;
}

function historicalAccuracy(pattern: MacroSignalChartPattern): number {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  if (typeof reviewed?.tpBeforeSl === "number") return reviewed.tpBeforeSl;
  return pattern.historicalBenchmark?.targetFirstRate ?? pattern.overall.targetHitRate ?? Number.NEGATIVE_INFINITY;
}

function historicalSample(pattern: MacroSignalChartPattern): number {
  const reviewed = pattern.executionReview?.status === "reviewed_active" ? pattern.executionReview.later : null;
  if (typeof reviewed?.evaluableN === "number") return reviewed.evaluableN;
  return pattern.historicalBenchmark?.walkForwardN ?? pattern.overall.evaluableCount;
}

function executionRule(execution: MacroSignalChartPattern["execution"] | MacroSignalChartSignal["execution"] | undefined): string {
  const stopAtr = execution?.stopAtr ?? 1;
  const targetR = execution?.targetR ?? 2;
  const expiry = execution?.expiryCandles ?? 30;
  const base = `SL ${stopAtr} ATR · TP ${targetR}R · ${expiry} H4`;
  return execution?.managementFamily === "break_even"
    ? `${base} · move SL to entry after a completed H4 reaches +${execution.managementTriggerR ?? 1}R`
    : base;
}

type DecisionCalculation = NonNullable<MacroSignalPatternAssessment["calculations"]>[number];

function scoringRuleLabel(policy: string | null | undefined): string {
  if (policy === "momentum_only") return "Compare Actual with Previous. Forecast is ignored.";
  if (policy === "surprise_only") return "Compare Actual with Forecast. Previous is ignored.";
  if (policy === "forecast_quality") return "Use Forecast Guard: compare Actual with Forecast when reliable, and Actual with Previous.";
  if (policy === "agreement_no_bonus") return "Compare Actual with Forecast and Previous with equal weight; no agreement bonus.";
  return "Compare Actual with Forecast and Previous with equal weight.";
}

function contextLabel(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  const dimensionLabels: Record<string, string> = {
    priceRegime: "Price regime",
    trendRelation: "Trend relation",
    volatilityRegime: "Volatility regime",
    directionalRoom: "Directional room",
    macroBackground: "Macro background",
    releaseSession: "Release session",
  };
  if (dimensionLabels[value]) return dimensionLabels[value];
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function contextPercentile(value: number): string {
  const rounded = Math.round(value * 100);
  const suffix = rounded % 100 >= 11 && rounded % 100 <= 13 ? "th" : rounded % 10 === 1 ? "st" : rounded % 10 === 2 ? "nd" : rounded % 10 === 3 ? "rd" : "th";
  return `${rounded}${suffix} percentile`;
}

function signalContextValue(signal: MacroSignalChartSignal, dimension: string): string | null {
  const context = signal.marketContext;
  if (!context) return null;
  if (dimension === "priceRegime") return context.price.regime;
  if (dimension === "trendRelation") return context.price.relationToSignal;
  if (dimension === "volatilityRegime") return context.volatility.regime;
  if (dimension === "directionalRoom") return context.supportResistance.roomState;
  if (dimension === "macroBackground") return context.macroBackground.relationToSignal;
  if (dimension === "releaseSession") return context.releaseEnvironment.session;
  return null;
}

function zeroScoreExplanation(calculation: DecisionCalculation): string {
  if (calculation.scoringPolicy === "momentum_only") {
    return calculation.momentumPoint === 0
      ? `Actual ${calculation.actual ?? "â€“"} did not improve or weaken versus Previous ${calculation.previous ?? "â€“"}. Forecast ${calculation.forecast ?? "â€“"} is ignored by this frozen rule.`
      : "The eligible Actual-versus-Previous comparison produced no registered direction.";
  }
  if (calculation.surprisePoint != null && calculation.momentumPoint != null && calculation.surprisePoint === -calculation.momentumPoint) {
    return "Actual-versus-Forecast and Actual-versus-Previous pointed in opposite directions, so they cancelled to 0.";
  }
  if (calculation.forecastSuspect && calculation.momentumPoint === 0) {
    return "Forecast Guard excluded Surprise, and Actual-versus-Previous produced 0, so this release contributed no direction.";
  }
  return "The eligible comparisons produced a total score of 0, so this release contributed no direction.";
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

const countdownSubscribers = new Set<() => void>();
let countdownTimer: number | null = null;

function subscribeCountdown(update: () => void): () => void {
  countdownSubscribers.add(update);
  if (countdownTimer == null) {
    countdownTimer = window.setInterval(() => {
      countdownSubscribers.forEach((subscriber) => subscriber());
    }, 1_000);
  }
  return () => {
    countdownSubscribers.delete(update);
    if (countdownSubscribers.size === 0 && countdownTimer != null) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  };
}

function EventCountdown({ targetTime }: { targetTime: number }) {
  const valueRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => {
      if (valueRef.current) valueRef.current.textContent = formatCountdown(targetTime - Math.floor(Date.now() / 1_000));
    };
    update();
    return subscribeCountdown(update);
  }, [targetTime]);
  return (
    <span className="chart-shadow-event-countdown" aria-label={`Countdown to ${formatUtc(targetTime)}`}>
      <small>Starts in</small>
      <strong ref={valueRef}>Calculating…</strong>
    </span>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatSignedR(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatPrice(value: number | null | undefined): string {
  return value == null ? "Waiting for entry" : value.toFixed(5);
}

function formatOutcome(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return `Target reached · +${signal.resultR?.toFixed(2) ?? signal.targetR ?? 0}R`;
  if (signal.outcomeStatus === "stop_hit") return `Stop reached · ${signal.resultR?.toFixed(2) ?? "-1.00"}R`;
  if (signal.outcomeStatus === "expired") return `Expired · ${signal.resultR == null ? "result unavailable" : `${signal.resultR >= 0 ? "+" : ""}${signal.resultR.toFixed(2)}R`}`;
  if (signal.outcomeStatus === "ambiguous") return "Both boundaries touched · order unknown";
  if (signal.outcomeStatus === "unevaluable") return signal.outcomeReason ?? "Historical price data unavailable";
  if (signal.outcomeStatus === "pending") return signal.outcomeReason ?? "Trade still running";
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

type DemoExecution = NonNullable<NonNullable<MacroSignalGlobalResponse["forwardValidation"]>["demoExecution"]>;

function formatExecutionDelay(seconds: number | null): string {
  if (seconds == null) return "â€”";
  const absolute = Math.abs(Math.round(seconds));
  if (absolute < 60) return `${seconds < 0 ? "-" : ""}${absolute}s`;
  const minutes = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  return `${seconds < 0 ? "-" : ""}${minutes}m ${remainder}s`;
}

function DemoExecutionAudit({ execution, patterns, captureStatusText }: { execution: DemoExecution; patterns: MacroSignalChartPattern[]; captureStatusText: string }) {
  const comparison = execution.executionComparison;
  const trades = execution.trades ?? [];
  return (
    <div className="chart-shadow-demo-validation">
      <strong>Observed MT5 demo execution</strong><span>{captureStatusText}</span>
      <p>{execution.completedTrades} completed Â· {execution.openOrPartialTrades} open/partial Â· gross fill result {formatSignedR(execution.averageGrossFillR)} Â· after recorded costs {formatSignedR(execution.averageNetR)}.</p>
      {comparison ? <div className="chart-shadow-demo-comparison" aria-label="Planned versus actual demo execution">
        <div><span>Comparable entries</span><strong>{comparison.entryComparableTrades}</strong></div>
        <div><span>Average entry delay</span><strong>{formatExecutionDelay(comparison.averageEntryDelaySeconds)}</strong></div>
        <div><span>Entry difference</span><strong>{formatSignedR(comparison.averageAdverseEntryDifferenceR)}</strong><small>Positive is worse for the planned direction</small></div>
        <div><span>Actual versus candle result</span><strong>{formatSignedR(comparison.averageGrossResultDifferenceR)}</strong></div>
        <div><span>Recorded costs</span><strong>{formatSignedR(comparison.averageExecutionCostsR)}</strong><small>Commission, swap, and fee</small></div>
        <div><span>Contract matched</span><strong>{comparison.contractAdherentTrades}/{execution.matchedTrades}</strong></div>
      </div> : <p className="chart-shadow-demo-compatibility-note">Detailed execution comparison will appear after the bridge is restarted with the current build.</p>}
      <p>{execution.instructions}</p>
      {trades.length ? <table className="chart-shadow-demo-trades" aria-label="Matched MT5 demo trades"><thead><tr><th>Trade</th><th>Entry difference</th><th>Gross / net</th><th>Contract</th></tr></thead><tbody>{trades.slice(0, 5).map((trade) => { const demoPattern = patterns.find((row) => row.id === trade.patternId && (row.market ?? trade.market) === trade.market); return <tr key={`${trade.accountLogin}:${trade.signalTag}:${trade.positionId}`}><td><b><PairFlags symbol={trade.market} />{demoPattern?.label ?? trade.patternId}</b><small>{trade.entryTime == null ? trade.signalTag : formatUtc(trade.entryTime)}</small></td><td>{formatSignedR(trade.entryDifferenceR)}<small>{formatExecutionDelay(trade.entryDelaySeconds)} after planned entry</small></td><td>{formatSignedR(trade.grossFillR)} / {formatSignedR(trade.netR)}</td><td className={trade.contractAdherent ? "is-valid" : "is-invalid"}>{trade.contractAdherent ? "Matched" : "Deviation"}</td></tr>; })}</tbody></table> : null}
      <small>{comparison?.note ? `${comparison.note} ` : ""}Demo audit only; Fyodor sends no order.</small>
    </div>
  );
}

function packageDecisionCopy(assessment: MacroSignalPatternAssessment, pattern: MacroSignalChartPattern | null, symbol: string) {
  if (assessment.status === "qualified") {
    const plannedEntry = assessment.prospectiveCapture?.activationTime;
    return {
      title: `${assessment.direction === "long" ? "Long" : "Short"} ${symbol} qualified`,
      detail: plannedEntry == null
        ? "The complete release package matched the registered direction. The hypothetical trade waits for the first strictly later H4 open."
        : `The complete release package matched. The hypothetical trade is queued for ${formatUtc(plannedEntry)}.`,
    };
  }
  if (assessment.status === "pre_activation_audit") {
    return {
      title: `${assessment.direction === "long" ? "Long" : "Short"} ${symbol} · audit only`,
      detail: "The package matched the rule, but it occurred before this registered setup was activated.",
    };
  }
  if (assessment.status === "late_for_contract") {
    return {
      title: "Audit only · processed after entry",
      detail: "The release package was not fully observed and decided before its frozen H4 entry. It cannot open a trade or enter forward-performance statistics.",
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

interface ShadowDecisionRow {
  key: string;
  market: string;
  signal: MacroSignalChartSignal | null;
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
  const primaryCalculation = assessment.calculations?.[0] ?? null;
  const scoringPolicy = primaryCalculation?.scoringPolicy ?? pattern?.scoringPolicy;
  const status = signal
    ? signal.outcomeStatus === "pending"
      ? signal.activationTime == null ? "Waiting for H4 entry" : "Trade open"
      : formatOutcome(signal)
    : assessment.status === "pre_activation_audit"
    ? "Audit only"
    : assessment.status === "no_trade"
      ? "No trade"
      : assessment.status === "late_for_contract"
        ? "Audit only · late"
      : assessment.status === "qualified"
        ? "Queued for H4 entry"
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
      {assessment.status === "no_trade" ? (
        <div className="chart-shadow-no-trade-explanation">
          <span>Why no trade</span>
          <strong>{primaryCalculation ? zeroScoreExplanation(primaryCalculation) : assessment.reason}</strong>
          <p><b>The event name matched this registered setup.</b> Its released values did not produce the positive or negative score required by the frozen rule, so neither Long nor Short qualified.</p>
        </div>
      ) : null}
      {pattern ? (
        <div className="chart-shadow-hunt-plan">
          <div className="chart-shadow-hunt-rule"><span>Frozen rule</span><strong>{scoringRuleLabel(scoringPolicy)}</strong><small>{pattern.condition}</small></div>
          <div className="chart-shadow-if-grid" aria-label="Possible FMS decisions">
            {buildDecisionScenarios(pattern, symbol).map(([condition, action]) => (
              <div key={condition}><span>{condition}</span><strong>{action}</strong></div>
            ))}
          </div>
          {pattern.contextRegistration?.status === "reviewed_active" ? (
            <div className="chart-shadow-context-rule">
              <span>H4 entry context rule · {pattern.contextRegistration.id}</span>
              <strong>IF {contextLabel(pattern.contextRegistration.condition?.dimension ?? "context")} = {contextLabel(pattern.contextRegistration.condition?.value ?? "unknown")}, use SL {pattern.contextRegistration.execution?.stopAtr} ATR · TP {pattern.contextRegistration.execution?.targetR}R · maximum {pattern.contextRegistration.execution?.expiryCandles} H4.</strong>
              <small>{signal?.contextOverlay ? `Observed at entry: ${contextLabel(signal.contextOverlay.observedValue ?? "unknown")} · ${signal.contextOverlay.executionApplied ? "context contract applied" : "parent contract retained"}.` : "This condition is checked only when the first strictly later H4 entry opens. If it does not match, the parent setup remains active under its parent contract."}</small>
            </div>
          ) : null}
        </div>
      ) : null}
      {signal?.outcomeStatus === "pending" && signal.demoTag ? (
        <div className="chart-shadow-demo-tag">
          <span>Optional MT5 demo comment</span>
          <code>{signal.demoTag}</code>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(signal.demoTag!)}>Copy</button>
          <small>Use only on a manually placed demo trade matching this exact direction and frozen contract. Fyodor sends no order.</small>
        </div>
      ) : null}
      {assessment.calculations?.length ? <details className="chart-shadow-released-values" open={assessment.status !== "no_trade"}>
        <summary><span>Released values and scoring</span><strong>{assessment.calculations.length} release{assessment.calculations.length === 1 ? "" : "s"}</strong><ChevronDown size={14} /></summary>
        {assessment.calculations.map((calculation) => (
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
          {calculation.score === 0 ? <p><b>Why this row scored 0:</b> {zeroScoreExplanation(calculation)} It does not cancel other releases in the same package.</p> : null}
          {assessment.status === "pre_activation_audit" ? <p><b>Decision:</b> {assessment.direction === "long" ? `Long ${symbol}` : `Short ${symbol}`} under the frozen scoring rule, but audit-only because the release predates model activation.</p> : null}
          <small>{calculation.forecastSuspect ? `Raw Forecast ${calculation.forecast ?? "–"} retained; ${calculation.forecastGap?.toFixed(2) ?? "–"} gap exceeded the past-only ${calculation.forecastAnomalyThreshold?.toFixed(2) ?? "–"} threshold.` : "Frozen first-seen MT5 values."}</small>
        </div>
        ))}
      </details> : null}
      <div className={`chart-shadow-package-decision is-${assessment.status}`}>
        <span>Complete package decision</span>
        <strong>{packageDecision.title}</strong>
        <p>{packageDecision.detail}</p>
      </div>
    </section>
  );
}

export function marketMatchesCurrencySelection(market: string, selectedCurrencies: ReadonlySet<string> | null): boolean {
  if (selectedCurrencies == null) return true;
  return selectedCurrencies.has(market.slice(0, 3)) || selectedCurrencies.has(market.slice(3, 6));
}

function CurrencyFlag({ currency }: { currency: string }) {
  return <FlagIcon countryCode={CURRENCY_TO_COUNTRY_CODE[currency as keyof typeof CURRENCY_TO_COUNTRY_CODE] ?? ""} className="chart-shadow-currency-flag" />;
}

export type ChartMacroBiasRealtimeView = "all" | "setups" | "research";

export const ChartMacroBiasRealtimeCard = memo(function ChartMacroBiasRealtimeCard({ data, view = "all" }: { data: ChartMacroBiasRealtimeCardData; view?: ChartMacroBiasRealtimeView }) {
  const { response, activeSignal, activePattern } = data;
  const activeContextCandidate = activePattern?.reactionAudit?.profile?.contextResearch?.selectedCandidate ?? null;
  const activeContextMatches = Boolean(activeSignal && activeContextCandidate && signalContextValue(activeSignal, activeContextCandidate.dimension) === activeContextCandidate.value);
  const [setupSort, setSetupSort] = useState<"accuracy" | "profitability" | "soonest">("accuracy");
  const weakenedPatternKeys = useMemo(() => new Set(
    (data.globalResponse?.outcomeReview?.executionReviews ?? [])
      .filter((row) => row.status === "active_evidence_weakened")
      .map((row) => `${row.market}:${row.patternId}`),
  ), [data.globalResponse?.outcomeReview?.executionReviews]);
  const [selectedDecisionKey, setSelectedDecisionKey] = useState<string | null>(null);
  const [expandedWatchKey, setExpandedWatchKey] = useState<string | null>(null);
  const [openIntelligence, setOpenIntelligence] = useState<Set<MacroSignalResearchIntelligence["status"]>>(() => new Set());
  const [selectedCurrencies, setSelectedCurrencies] = useState<Set<string> | null>(null);
  const [startingBalance, setStartingBalance] = useState(() => normalizeShadowStartingBalance(readStoredNumber(SHADOW_BALANCE_KEY, DEFAULT_SHADOW_STARTING_BALANCE)));
  const [riskPercent, setRiskPercent] = useState(() => normalizeShadowRiskPercent(readStoredNumber(SHADOW_RISK_KEY, DEFAULT_SHADOW_RISK_PERCENT)));
  const registryResponses = useMemo(
    () => data.globalResponse?.markets.filter((market) => market.supported) ?? [response],
    [data.globalResponse, response],
  );
  const currencySymbols = useMemo(() => [...new Set(registryResponses.flatMap((market) => [market.symbol.slice(0, 3), market.symbol.slice(3, 6)]))].sort(), [registryResponses]);
  const upcomingWatchEntries = useMemo(() => {
    const unique = new Map<string, { market: MacroSignalChartSignalResponse; watch: MacroSignalUpcomingPatternWatch }>();
    for (const market of registryResponses) {
      const watches = market.realtime?.upcomingPatternWatches ?? (market.realtime?.nextPatternWatch ? [market.realtime.nextPatternWatch] : []);
      for (const watch of watches) unique.set(`${market.symbol}:${watch.patternId}:${watch.time}`, { market, watch });
    }
    return [...unique.values()].sort((left, right) => left.watch.time - right.watch.time || left.market.symbol.localeCompare(right.market.symbol) || left.watch.label.localeCompare(right.watch.label));
  }, [registryResponses]);
  const registeredPatternRows = useMemo(
    () => registryResponses.flatMap((market) => market.patterns.filter((pattern) => pattern.currentEligible)),
    [registryResponses],
  );
  const selectedContextReviews = useMemo(() => registeredPatternRows.flatMap((pattern) => {
    const candidate = pattern.reactionAudit?.profile?.contextResearch?.selectedCandidate;
    return candidate ? [{ pattern, candidate }] : [];
  }), [registeredPatternRows]);
  const supportedContextReviews = useMemo(
    () => selectedContextReviews.filter(({ candidate }) => candidate.status === "later_supported"),
    [selectedContextReviews],
  );
  const registeredContextPatterns = useMemo(
    () => registeredPatternRows.filter((pattern) => pattern.contextRegistration?.status === "reviewed_active"),
    [registeredPatternRows],
  );
  const unregisteredSupportedContextReviews = useMemo(
    () => supportedContextReviews.filter(({ pattern }) => pattern.contextRegistration?.status !== "reviewed_active"),
    [supportedContextReviews],
  );
  const forwardSetupByKey = useMemo(
    () => new Map((data.globalResponse?.forwardValidation?.setupSummaries ?? []).map((row) => [`${row.market}:${row.patternId}`, row])),
    [data.globalResponse?.forwardValidation?.setupSummaries],
  );
  const forwardSetupLabel = (market: string, patternId: string) => {
    const summary = forwardSetupByKey.get(`${market}:${patternId}`);
    if (!summary) return null;
    const title = (summary.manualLimitedLiveReviewBlockers ?? []).join(" ");
    if (summary.eligibleForManualLimitedLiveReview) return { className: "is-supportive", text: `Eligible for manual limited-live review · ${summary.demoCompletedTrades ?? 0} demo trades`, title };
    if (summary.status === "supportive" || summary.eligibleForPaperReliance) return { className: "is-supportive", text: `Forward supportive · demo execution ${summary.demoCompletedTrades ?? 0}/5`, title };
    if (summary.status === "degraded") return { className: "is-degraded", text: `Needs review · forward average ${formatSignedR(summary.averageR)}`, title };
    if (summary.status === "coverage_incomplete") return { className: "is-incomplete", text: `Forward quote coverage incomplete · ${Math.round((summary.nearEntryQuoteCoverage ?? 0) * 100)}%`, title };
    return { className: "is-collecting", text: `Forward evidence collecting · ${summary.resolvedCases}/10 cases · ${summary.elapsedDays ?? 0}/90 days`, title };
  };
  const assessmentsByPattern = useMemo(
    () => new Map(registryResponses.flatMap((market) => (market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : [])).map((assessment) => [`${market.symbol}:${assessment.patternId}`, assessment]))),
    [registryResponses],
  );
  const tradeRows = useMemo<ShadowTradeRow[]>(() => registryResponses.flatMap((market) => {
    const assessments = market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : []);
    const exactAssessments = new Map(assessments.map((assessment) => [`${assessment.patternId}:${assessment.time}`, assessment]));
    const patterns = new Map(market.patterns.map((pattern) => [pattern.id, pattern]));
    return market.signals
      .filter((signal) => patterns.get(signal.patternId)?.readiness?.actionableInShadowTrader !== false)
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
  const registeredDecisionRows = useMemo<ShadowDecisionRow[]>(() => registryResponses.flatMap((market) => {
    const patterns = new Map(market.patterns.filter((pattern) => pattern.currentEligible).map((pattern) => [pattern.id, pattern]));
    const signals = new Map(market.signals.map((signal) => [`${signal.patternId}:${signal.eventTime}`, signal]));
    const assessments = market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : []);
    return assessments.flatMap((assessment): ShadowDecisionRow[] => {
      const pattern = patterns.get(assessment.patternId) ?? null;
      if (!pattern) return [];
      return [{
        key: `decision:${market.symbol}:${assessment.patternId}:${assessment.time}`,
        market: market.symbol,
        signal: signals.get(`${assessment.patternId}:${assessment.time}`) ?? null,
        pattern,
        assessment,
      }];
    });
  }).sort((left, right) => right.assessment.time - left.assessment.time || left.market.localeCompare(right.market) || left.assessment.label.localeCompare(right.assessment.label)), [registryResponses]);
  const currentTradeRows = useMemo(
    () => tradeRows.filter((row) => row.signal.outcomeStatus === "pending" && row.signal.entry != null),
    [tradeRows],
  );
  const queuedTradeRows = useMemo(
    () => tradeRows.filter((row) => row.signal.entry == null && row.signal.prospectiveCapture?.eligible === true),
    [tradeRows],
  );
  const recentRegisteredDecisions = registeredDecisionRows.slice(0, 10);
  const selectedDecision = selectedDecisionKey == null
    ? null
    : registeredDecisionRows.find((row) => row.key === selectedDecisionKey)
      ?? tradeRows.find((row) => row.key === selectedDecisionKey)
      ?? null;
  const upcomingByPattern = useMemo(
    () => new Map(registryResponses.flatMap((market) => (market.realtime?.upcomingPatternWatches ?? (market.realtime?.nextPatternWatch ? [market.realtime.nextPatternWatch] : [])).map((watch) => [`${market.symbol}:${watch.patternId}`, watch]))),
    [registryResponses],
  );
  const latestSignalByPattern = useMemo(() => {
    const rows = new Map<string, MacroSignalChartSignal>();
    for (const market of registryResponses) {
      for (const signal of market.signals) {
        const key = `${market.symbol}:${signal.patternId}`;
        const current = rows.get(key);
        if (!current || signal.eventTime > current.eventTime) rows.set(key, signal);
      }
    }
    return rows;
  }, [registryResponses]);
  const registeredPatterns = useMemo(() => registeredPatternRows.filter((pattern) => marketMatchesCurrencySelection(pattern.market ?? response.symbol, selectedCurrencies)).sort((left, right) => {
    const leftMarket = left.market ?? response.symbol;
    const rightMarket = right.market ?? response.symbol;
    if (setupSort === "soonest") {
      const leftTime = upcomingByPattern.get(`${leftMarket}:${left.id}`)?.time ?? Number.POSITIVE_INFINITY;
      const rightTime = upcomingByPattern.get(`${rightMarket}:${right.id}`)?.time ?? Number.POSITIVE_INFINITY;
      return leftTime - rightTime || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
    }
    const leftValue = setupSort === "accuracy" ? historicalAccuracy(left) : historicalAverage(left);
    const rightValue = setupSort === "accuracy" ? historicalAccuracy(right) : historicalAverage(right);
    return rightValue - leftValue || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
  }), [registeredPatternRows, response.symbol, selectedCurrencies, setupSort, upcomingByPattern]);
  const settings = useMemo(() => ({ startingBalance, riskPercent }), [startingBalance, riskPercent]);
  const liveAccount = useMemo(() => buildMacroSignalShadowAccount(
    registryResponses.flatMap((market) => market.signals.map((signal) => ({ ...signal, market: market.symbol }))),
    settings,
  ), [registryResponses, settings]);
  const historicalAccount = useMemo(
    () => data.historicalSignals == null ? null : buildMacroSignalShadowAccount(data.historicalSignals, settings),
    [data.historicalSignals, settings],
  );
  const position = activeSignal ? buildMacroSignalShadowPosition(activeSignal, liveAccount.balance, riskPercent, response.symbol) : null;
  const timeframeLabel = data.chartTimeframe === response.modelTimeframe
    ? `${response.modelTimeframe} backtest model`
    : `${response.modelTimeframe} backtest · shown on ${data.chartTimeframe}`;
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
    const selected = selectedDecisionKey === row.key;
    const signal = row.signal;
    const plannedEntry = signal.prospectiveCapture?.activationTime ?? signal.activationTime;
    const state = signal.entry == null && signal.prospectiveCapture?.eligible === true
      ? "Queued for H4 entry"
      : signal.outcomeStatus === "pending" ? "Open" : formatOutcome(signal);
    const forwardStatus = forwardSetupLabel(row.market, signal.patternId);
    return (
      <tr
        key={row.key}
        className={selected ? "is-selected" : undefined}
        role="button"
        tabIndex={0}
        aria-expanded={selected}
        onClick={() => setSelectedDecisionKey((current) => current === row.key ? null : row.key)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedDecisionKey((current) => current === row.key ? null : row.key);
          }
        }}
      >
        <td><strong><PairFlags symbol={row.market} />{row.pattern?.label ?? signal.label}</strong><small>{signal.direction === "long" ? `Long ${row.market}` : `Short ${row.market}`}</small></td>
        <td><strong>{formatUtc(plannedEntry)}</strong><small>Release {formatUtc(signal.eventTime)}</small></td>
        <td><strong>{state}</strong><small>{executionRule(signal.execution ?? row.pattern?.execution)}</small>{forwardStatus ? <small className={`chart-shadow-forward-status ${forwardStatus.className}`} title={forwardStatus.title}>{forwardStatus.text}</small> : null}</td>
        <td><span>{selected ? "Hide audit" : "View audit"}</span>{selected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
      </tr>
    );
  };

  const renderDecisionRow = (row: ShadowDecisionRow) => {
    const selected = selectedDecisionKey === row.key;
    const direction = row.signal?.direction ?? row.assessment.direction;
    const state = row.signal ? formatOutcome(row.signal)
      : row.assessment.status === "no_trade" ? "No trade"
      : row.assessment.status === "pre_activation_audit" ? "Audit only"
      : row.assessment.status === "late_for_contract" ? "Audit only · late"
      : row.assessment.status === "qualified" ? "Qualified · waiting entry"
      : "Waiting for Actual";
    const forwardStatus = forwardSetupLabel(row.market, row.assessment.patternId);
    return (
      <tr
        key={row.key}
        className={selected ? "is-selected" : undefined}
        role="button"
        tabIndex={0}
        aria-expanded={selected}
        onClick={() => setSelectedDecisionKey((current) => current === row.key ? null : row.key)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedDecisionKey((current) => current === row.key ? null : row.key);
          }
        }}
      >
        <td><strong><PairFlags symbol={row.market} />{row.pattern?.label ?? row.assessment.label}</strong><small>{direction ? `${direction === "long" ? "Long" : "Short"} ${row.market}` : "Registered package produced no direction"}</small></td>
        <td><strong>{formatUtc(row.assessment.time)}</strong><small>Registered decision time</small></td>
        <td><strong>{state}</strong><small>{row.pattern ? executionRule(row.pattern.execution) : row.assessment.reason}</small>{forwardStatus ? <small className={`chart-shadow-forward-status ${forwardStatus.className}`} title={forwardStatus.title}>{forwardStatus.text}</small> : null}</td>
        <td><span>{selected ? "Hide audit" : "View audit"}</span>{selected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
      </tr>
    );
  };

  return (
    <aside className="chart-macro-bias-realtime" aria-label={view === "research" ? "FMS Research" : view === "setups" ? "Registered FMS Setups" : "FMS Shadow Trader"} data-fms-view={view}>
      <header>
        <div><ShieldCheck size={14} /><span>{view === "research" ? "FMS Research" : view === "setups" ? "Registered Setups" : "FMS Shadow Trader"}</span></div>
        <small>{view === "research" ? "Diagnostics and review" : data.globalResponse ? `${registryResponses.length} markets live` : timeframeLabel}</small>
      </header>
      {registeredContextPatterns.length > 0 ? (
        <section className="chart-shadow-context-summary fms-research-only" aria-label="Reviewed context rule availability">
          <div><span>Reviewed H4 context rules</span><strong>{registeredContextPatterns.length} exact setup rules</strong></div>
          <p>{[...new Set(registeredContextPatterns.map((pattern) => pattern.market ?? response.symbol))].map((market) => {
            const count = registeredContextPatterns.filter((pattern) => (pattern.market ?? response.symbol) === market).length;
            return <span key={market}><PairFlags symbol={market} />{market} x{count}</span>;
          })}</p>
          <small>Only matching arrows on these exact setups show <b>CONTEXT</b>. Click a past arrow to load its audit; when that entry had a confirmed opposing H4 zone, the chart shows it as an amber H4 support/resistance line.</small>
        </section>
      ) : null}
      {data.globalResponse?.forwardValidation ? (() => {
        const validation = data.globalResponse.forwardValidation;
        const operationalReady = validation.operationalPreflight?.signalMonitoringReadyNow ?? true;
        const demoEngineReady = validation.eligibleForDemoTrading && operationalReady;
        const captureStatus = validation.demoExecution?.captureStatus.status;
        const captureStatusText = captureStatus === "capturing_demo_deals" ? "Demo account verified"
          : captureStatus === "blocked_non_demo_account" ? "Blocked: connected account is not demo"
          : captureStatus === "mt5_unavailable" ? "MT5 unavailable"
          : captureStatus === "account_unavailable" ? "MT5 account unavailable"
          : captureStatus === "capture_failed" ? "Demo-history read failed"
          : captureStatus === "waiting_for_qualified_signal" ? "Waiting for a qualified setup"
          : "Demo capture not checked yet";
        return (
          <section className="chart-shadow-forward-gate fms-research-only" aria-label="FMS demo monitoring readiness">
            <div className="chart-shadow-forward-gate-heading">
              <div><span>Demo signal engine</span><strong>{demoEngineReady ? "Ready for demo monitoring" : validation.eligibleForDemoTrading ? "Signal engine ready · feed waiting" : "Not ready"}</strong></div>
              <em className={demoEngineReady ? "is-paper-ready" : "is-collecting"}>{demoEngineReady ? "EA cycle current" : validation.eligibleForDemoTrading ? "Preflight blocked" : "Unavailable"}</em>
            </div>
            <div className="chart-shadow-forward-gate-grid">
              <div><span>Qualified live decisions</span><strong>{validation.qualifiedDecisions}</strong></div>
              <div><span>Trades being tracked</span><strong>{validation.trackedCases}</strong></div>
              <div><span>Resolved demo-paper cases</span><strong>{validation.resolvedCases}</strong></div>
              <div><span>Forward average</span><strong>{formatSignedR(validation.averageR)}</strong></div>
              <div><span>Supportive setups</span><strong>{validation.paperReadySetups}</strong></div>
              <div><span>Needs review</span><strong>{validation.degradedSetups ?? 0}</strong></div>
            </div>
            <p>{validation.decision}</p>
            <div className="chart-shadow-limited-live-review"><strong>Manual limited-live review</strong><span>{validation.manualLimitedLiveReview?.decision ?? "Readiness details will appear after the bridge reloads the current FMS schema."}</span></div>
            {validation.operationalPreflight && !operationalReady ? <div className="chart-shadow-preflight-block"><strong>Do not act on a new signal yet</strong>{validation.operationalPreflight.blockingReasons.map((reason) => <span key={reason}>{reason}</span>)}</div> : null}
            <details><summary>Evidence audit <ChevronDown size={13} /></summary><ul>{validation.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>{validation.demoExecution ? <DemoExecutionAudit execution={validation.demoExecution} patterns={registeredPatternRows} captureStatusText={captureStatusText} /> : null}</details>
          </section>
        );
      })() : null}
      <section className="chart-shadow-trade-monitor fms-setups-only" aria-label="Current and recent hypothetical FMS trades">
        <div className="chart-shadow-section-heading">
          <div><span>Trade monitor</span><strong>What would FMS do now?</strong></div>
          <small>Setup-level simulations · click a row for its audit · the account replay separately skips portfolio overlaps</small>
        </div>
        <table>
          <thead><tr><th>Setup and direction</th><th>Opened</th><th>State and rules</th><th>Audit</th></tr></thead>
          <tbody>
            <tr className="chart-shadow-trade-group"><th colSpan={4}>Open now</th></tr>
            {currentTradeRows.length > 0 ? currentTradeRows.map(renderTradeRow) : <tr className="chart-shadow-trade-empty"><td colSpan={4}>No hypothetical trade is currently open.</td></tr>}
            <tr className="chart-shadow-trade-group"><th colSpan={4}>Queued for the next H4 entry</th></tr>
            {queuedTradeRows.length > 0 ? queuedTradeRows.map(renderTradeRow) : <tr className="chart-shadow-trade-empty"><td colSpan={4}>No qualified setup is waiting for entry.</td></tr>}
          </tbody>
        </table>
        <div className="chart-shadow-recent-decisions-heading">
          <strong>Latest registered decisions</strong>
          <small>{recentRegisteredDecisions.length} of 10</small>
        </div>
        <div className="chart-shadow-recent-decisions-scroll">
          <table aria-label="Latest registered FMS decisions">
            <tbody>
              {recentRegisteredDecisions.length > 0 ? recentRegisteredDecisions.map(renderDecisionRow) : <tr className="chart-shadow-trade-empty"><td colSpan={4}>No registered release decision is loaded.</td></tr>}
            </tbody>
          </table>
        </div>
        {selectedDecision ? <LatestDecisionSection assessment={selectedDecision.assessment} pattern={selectedDecision.pattern} symbol={selectedDecision.market} signal={selectedDecision.signal} /> : null}
        <details className="chart-shadow-upcoming-list">
          <summary>
            <span><b>Possible next setups</b><small>Upcoming registered releases</small></span>
            <span><b>{upcomingWatchEntries.length}</b><em>Show</em><ChevronDown size={14} /></span>
          </summary>
          <div className="chart-shadow-upcoming-scroll">
            {upcomingWatchEntries.length > 0 ? (
              <table aria-label="Upcoming registered FMS setups">
                <thead><tr><th>Pair and setup</th><th>Release time</th><th>What happens next</th><th>Countdown</th></tr></thead>
                <tbody>{upcomingWatchEntries.map(({ market, watch }) => {
                  const pattern = market.patterns.find((candidate) => candidate.id === watch.patternId) ?? null;
                  return (
                    <tr key={`${market.symbol}:${watch.patternId}:${watch.time}`}>
                      <td><strong><PairFlags symbol={market.symbol} />{watch.label}</strong><small>{watch.condition}</small></td>
                      <td><strong>{formatUtc(watch.time)}</strong></td>
                      <td><strong>Wait for Actual</strong>{pattern ? <small>{buildDecisionScenarios(pattern, market.symbol).map(([condition, action]) => `${condition} → ${action}`).join(" · ")}</small> : <small>Long, Short, or No trade only after the frozen package is complete.</small>}</td>
                      <td><EventCountdown targetTime={watch.time} /></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            ) : <p>No upcoming registered release is loaded.</p>}
          </div>
        </details>
      </section>
      {data.globalLoading ? <section className="chart-shadow-global-state fms-setups-only">Loading the global registry…</section> : null}
      {data.globalError ? <section className="chart-shadow-global-state is-error fms-setups-only">Global registry unavailable: {data.globalError}. Showing {response.symbol} only.</section> : null}
      <section className="chart-shadow-priority fms-setups-only" aria-label="All registered FMS setups">
        <div className="chart-shadow-section-heading">
          <div><span>Live watchlist</span><strong>Every registered setup</strong></div>
          <nav className="chart-shadow-market-filters" aria-label="Filter setups by currency">
            {currencySymbols.map((currency) => {
              const visible = selectedCurrencies == null || selectedCurrencies.has(currency);
              return (
                <button
                  type="button"
                  key={currency}
                  className={visible ? "is-visible" : "is-hidden"}
                  aria-label={`${visible ? "Hide" : "Show"} setups containing ${currency}`}
                  aria-pressed={visible}
                  title={`${visible ? "Hide" : "Show"} setups containing ${currency}`}
                  onClick={() => setSelectedCurrencies((current) => {
                    const next = new Set(current ?? currencySymbols);
                    if (next.has(currency)) next.delete(currency); else next.add(currency);
                    return next.size === currencySymbols.length ? null : next;
                  })}
                ><CurrencyFlag currency={currency} /></button>
              );
            })}
          </nav>
          <label><span>Sort</span><select value={setupSort} onChange={(event) => setSetupSort(event.target.value as typeof setupSort)}><option value="accuracy">Highest TP-before-SL</option><option value="soonest">Soonest release</option><option value="profitability">Best average result</option></select></label>
        </div>
        <table>
          <thead><tr><th>Pair and setup</th><th>Now</th><th>Relevant event</th><th>Historical result</th></tr></thead>
          <tbody>
            {registeredPatterns.length === 0 ? <tr className="chart-shadow-watchlist-empty"><td colSpan={4}>No setup contains a selected currency. Select a flag above.</td></tr> : null}
            {registeredPatterns.map((pattern) => {
              const patternMarket = pattern.market ?? response.symbol;
              const watchKey = `${patternMarket}:${pattern.id}`;
              const patternSignal = response.symbol === patternMarket && activeSignal?.patternId === pattern.id
                ? activeSignal
                : latestSignalByPattern.get(watchKey) ?? null;
              const assessment = assessmentsByPattern.get(`${patternMarket}:${pattern.id}`) ?? null;
              const upcoming = upcomingByPattern.get(`${patternMarket}:${pattern.id}`) ?? null;
              const assessmentIsNewer = assessment && (!patternSignal || assessment.time > patternSignal.eventTime);
              const openOrPending = patternSignal && !assessmentIsNewer && patternSignal.outcomeStatus === "pending";
              const latestTime = assessmentIsNewer ? assessment.time : patternSignal?.eventTime ?? assessment?.time ?? null;
              const blocked = pattern.readiness?.actionableInShadowTrader === false;
              const needsExecutionReview = weakenedPatternKeys.has(`${patternMarket}:${pattern.id}`);
              return (
                <Fragment key={watchKey}>
                  <tr
                    className={openOrPending ? "is-current" : undefined}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedWatchKey === watchKey}
                    onClick={() => setExpandedWatchKey((current) => current === watchKey ? null : watchKey)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpandedWatchKey((current) => current === watchKey ? null : watchKey);
                      }
                    }}
                  >
                    <td><strong className="chart-shadow-setup-title"><PairFlags symbol={patternMarket} />{patternMarket} · {pattern.label}</strong><small className="chart-shadow-contract-line">{executionRule(pattern.execution)}</small>{pattern.executionReview?.status === "reviewed_active" ? <span className="chart-shadow-readiness is-complete">Reviewed execution active</span> : null}{needsExecutionReview ? <span className="chart-shadow-needs-review">Needs execution review</span> : null}<span className={`chart-shadow-readiness is-${pattern.readiness?.auditStatus ?? "incomplete"}`}>{pattern.readiness?.label ?? "Audit incomplete"}</span>{pattern.readiness?.orientationAudited && <span className="chart-shadow-readiness is-complete">Orientation audited</span>}<span className={`chart-shadow-reaction is-${pattern.reaction === "contrarian" ? "rejected" : "followed"}`}>{pattern.reaction === "contrarian" ? "Rejected evidence" : "Followed evidence"}</span>{pattern.reactionAudit?.profile ? <span className="chart-shadow-reaction-shape">Reaction: {macroSignalReactionLabel(pattern.reactionAudit.profile.classification)}</span> : null}</td>
                    <td className="chart-shadow-now-cell">{blocked ? (
                      <><strong>Blocked</strong><small>Registration audit must be rebuilt.</small></>
                    ) : openOrPending ? (
                      <><strong>{patternSignal.entry != null ? "Trade open" : "Qualified — waiting entry"}</strong><small>{patternSignal.direction === "long" ? `Long ${patternMarket}` : `Short ${patternMarket}`}</small></>
                    ) : patternSignal && !assessmentIsNewer && patternSignal.outcomeStatus && patternSignal.outcomeStatus !== "pending" ? (
                      <strong>{formatOutcome(patternSignal)}</strong>
                    ) : assessment ? (
                      <strong>{assessment.status === "awaiting_observation" ? "Awaiting Actual" : assessment.status === "qualified" ? "Qualified — waiting entry" : assessment.status === "no_trade" ? "No trade" : assessment.status === "pre_activation_audit" ? `Past result · ${assessment.direction === "long" ? "Long" : "Short"}` : "Watching"}</strong>
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
                      <span className={`chart-shadow-history-strength is-${macroSignalSetupCredibility(pattern).label.toLowerCase()}`}>{macroSignalSetupCredibility(pattern).label} historical evidence</span>
                      <div className="chart-shadow-history-primary"><strong>{historicalAverage(pattern) >= 0 ? "+" : ""}{historicalAverage(pattern).toFixed(2)}R</strong><small>average per trade</small></div>
                      <div className="chart-shadow-history-metrics">
                        <span><b>{(historicalAccuracy(pattern) * 100).toFixed(1)}%</b> TP before SL</span>
                        <span><b>{historicalSample(pattern)}</b> later test trades</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="chart-shadow-priority-detail" hidden={expandedWatchKey !== watchKey}>
                    <td colSpan={4}>
                      <div className="chart-shadow-hunt-plan">
                        <div className="chart-shadow-hunt-rule"><span>Exact registered rule</span><strong>{pattern.condition}</strong></div>
                        <div className="chart-shadow-if-grid" aria-label={`Possible ${patternMarket} decisions`}>
                          {buildDecisionScenarios(pattern, patternMarket).map(([condition, action]) => <div key={condition}><span>{condition}</span><strong>{action}</strong></div>)}
                        </div>
                      </div>
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

      <section className="chart-shadow-account fms-setups-only" aria-label="Gross hypothetical account and performance replay">
        <div className="chart-shadow-section-heading"><div><span><WalletCards size={12} /> Hypothetical account</span><strong>Assumptions and performance replay</strong></div></div>
        <div className="chart-shadow-account-controls">
          <label>
            <span>Starting balance</span>
            <span className="chart-shadow-input"><b>$</b><input type="number" min={MIN_SHADOW_STARTING_BALANCE} step="1" defaultValue={startingBalance} onBlur={(event) => { event.currentTarget.value = String(updateStartingBalance(Number(event.currentTarget.value))); }} /></span>
          </label>
          <label>
            <span>Risk per trade</span>
            <span className="chart-shadow-input"><input type="number" min={MIN_SHADOW_RISK_PERCENT} max={MAX_SHADOW_RISK_PERCENT} step="0.01" defaultValue={riskPercent} onBlur={(event) => { event.currentTarget.value = String(updateRiskPercent(Number(event.currentTarget.value))); }} /><b>%</b></span>
          </label>
          <small>Gross simulation · one position at a time · frozen setup SL, TP, and duration · sequential compounding</small>
        </div>
        <div className="chart-shadow-account-results">
          <article>
            <span>All registered pairs since activation</span>
            <strong>{formatMoney(liveAccount.balance)}</strong>
            <small>{liveAccount.takenTrades} closed · {formatMoney(liveAccount.profit)} P/L · {liveAccount.returnPercent >= 0 ? "+" : ""}{liveAccount.returnPercent.toFixed(1)}%</small>
          </article>
          <article>
            <span>{response.symbol} historical replay · selected pair only</span>
            <strong>{historicalAccount ? formatMoney(historicalAccount.balance) : "Loading…"}</strong>
            <small>{historicalAccount ? `${historicalAccount.takenTrades} trades · ${historicalAccount.returnPercent >= 0 ? "+" : ""}${historicalAccount.returnPercent.toFixed(1)}% · DD ${historicalAccount.maxDrawdownPercent.toFixed(1)}%` : "Historical replay is not loaded"}</small>
          </article>
        </div>
        <p className="chart-shadow-account-scope">These are separate scopes and are never added together. The first uses immutable post-activation observations across loaded registered pairs; the second replays the selected chart pair&apos;s historical matches.</p>
        <details className="chart-shadow-account-audit">
          <summary><span>How the account is calculated</span><strong>View formula and exclusions</strong><ChevronDown size={14} /></summary>
          <div>
            <p><b>Per trade:</b> risk dollars = balance before trade × risk %. Balance after trade = balance before trade + (risk dollars × result R).</p>
            <p><b>Portfolio rule:</b> one hypothetical position at a time. Earlier activation wins. Exact-time candidates use fixed pair → setup → signal ordering; the others are recorded as simultaneous alternatives. Opposing decisions are conflicts only when they concern the same pair.</p>
            <dl>
              <div><dt>All-pair overlap</dt><dd>{liveAccount.skippedOverlap}</dd></div>
              <div><dt>All-pair alternatives</dt><dd>{liveAccount.skippedSimultaneousAlternative}</dd></div>
              <div><dt>All-pair conflicts</dt><dd>{liveAccount.skippedConflict}</dd></div>
              <div><dt>All-pair ambiguous</dt><dd>{liveAccount.ambiguous}</dd></div>
              <div><dt>All-pair unevaluable</dt><dd>{liveAccount.unevaluable}</dd></div>
              <div><dt>{response.symbol} overlap</dt><dd>{historicalAccount?.skippedOverlap ?? "—"}</dd></div>
              <div><dt>{response.symbol} alternatives</dt><dd>{historicalAccount?.skippedSimultaneousAlternative ?? "—"}</dd></div>
              <div><dt>{response.symbol} conflicts</dt><dd>{historicalAccount?.skippedConflict ?? "—"}</dd></div>
              <div><dt>{response.symbol} ambiguous</dt><dd>{historicalAccount?.ambiguous ?? "—"}</dd></div>
              <div><dt>{response.symbol} unevaluable</dt><dd>{historicalAccount?.unevaluable ?? "—"}</dd></div>
            </dl>
            <p><b>Definitions:</b> overlap = another signal arrived while a position was active; alternative = another same-time opportunity lost the fixed portfolio tie-break; conflict = the same pair produced opposing directions; ambiguous = TP and SL order could not be resolved; unevaluable = required activation or price outcome was unavailable.</p>
          </div>
        </details>
      </section>

      {activeSignal && position ? (
        <section className="chart-shadow-position fms-setups-only" aria-label="Hypothetical position">
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
          {activeSignal.marketContext ? (
            <div className="chart-shadow-position-context" aria-label="Market context known before this trade entry">
              <header><strong>Context known before entry</strong><span>{activeSignal.contextOverlay?.executionApplied ? "Reviewed context contract used" : activeSignal.contextOverlay?.matched ? "Historical context match" : activeSignal.contextOverlay ? "Parent setup retained" : "Research comparison"}</span></header>
              <dl>
                <div><dt>Price</dt><dd>{contextLabel(activeSignal.marketContext.price.regime)} · {contextLabel(activeSignal.marketContext.price.relationToSignal)}</dd></div>
                <div><dt>Volatility</dt><dd>{contextLabel(activeSignal.marketContext.volatility.regime)}{activeSignal.marketContext.volatility.percentile == null ? "" : ` · ${contextPercentile(activeSignal.marketContext.volatility.percentile)}`}</dd></div>
                <div><dt>Room</dt><dd>{contextLabel(activeSignal.marketContext.supportResistance.roomState)}{activeSignal.marketContext.supportResistance.directionalRoomAtr == null ? " · no confirmed barrier" : ` · ${activeSignal.marketContext.supportResistance.directionalRoomAtr.toFixed(2)} ATR`}</dd></div>
                <div><dt>Background</dt><dd>{contextLabel(activeSignal.marketContext.macroBackground.relationToSignal)}</dd></div>
              </dl>
              {activeSignal.contextOverlay ? <p><b>{activeSignal.contextOverlay.registrationId}:</b> {contextLabel(activeSignal.contextOverlay.condition.dimension)} must be {contextLabel(activeSignal.contextOverlay.condition.value)}. Entry context was {contextLabel(activeSignal.contextOverlay.observedValue ?? "unknown")} — {activeSignal.contextOverlay.executionApplied ? "matched; context contract applied" : activeSignal.contextOverlay.matched ? "matched historically; parent result preserved" : "did not match; parent contract retained"}.</p> : activeContextCandidate ? <p><b>Selected context challenger:</b> {contextLabel(activeContextCandidate.dimension)} = {contextLabel(activeContextCandidate.value)} · {activeContextCandidate.status === "later_supported" ? "later supported" : "later rejected"} · {activeContextMatches ? "this trade matches" : "this trade does not match"}. Research only.</p> : null}
            </div>
          ) : null}
          {activeSignal.demoTag ? <div className="chart-shadow-demo-tag"><span>MT5 demo order comment</span><code>{activeSignal.demoTag}</code><button type="button" onClick={() => void navigator.clipboard?.writeText(activeSignal.demoTag!)}>Copy</button><small>Optional manual demo validation only. FMS sends no order.</small></div> : null}
          <small className="chart-shadow-source-note">{position.sizingNote}</small>
        </section>
      ) : null}

      {data.globalResponse?.liveDecisions?.length ? (
        <details className="chart-shadow-account-audit chart-shadow-decision-ledger fms-setups-only">
          <summary><span>Immutable decision ledger</span><strong>{data.globalResponse.liveDecisions.length} first-seen decisions</strong><ChevronDown size={14} /></summary>
          <div>
            <p>Broker revisions cannot rewrite these original qualified/no-trade decisions.</p>
            <table aria-label="Immutable FMS first-seen decisions">
              <thead><tr><th>Pair and setup</th><th>Release</th><th>Decision</th><th>Recorded</th></tr></thead>
              <tbody>{data.globalResponse.liveDecisions.map((decision) => {
                const pattern = registeredPatternRows.find((row) => row.id === decision.patternId && (row.market ?? response.symbol) === decision.market);
                return <tr key={`${decision.market}:${decision.patternId}:${decision.eventTime}`}><td><strong><PairFlags symbol={decision.market} />{pattern?.label ?? decision.patternId}</strong></td><td>{formatUtc(decision.eventTime)}</td><td><strong>{decision.status === "qualified" ? `${decision.direction === "long" ? "Long" : "Short"} ${decision.market}` : decision.status === "late_for_contract" ? "Audit only · processed late" : "No trade"}</strong><small>{decision.eligibilityReason.replaceAll("_", " ")}</small></td><td>{formatUtc(decision.firstDecidedAt)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </details>
      ) : null}

      <div className="fms-setups-only"><ChartMacroBiasSetupCatalog patterns={registeredPatternRows} /></div>

      {registeredContextPatterns.length > 0 ? (
        <details className="chart-shadow-context-registry fms-research-only" open>
          <summary><span>Context-conditioned setups</span><strong>{registeredContextPatterns.length} reviewed rules</strong><ChevronDown size={14} /></summary>
          <div>
            <p>These rules sit above an unchanged parent setup. A matching entry context uses the shown contract; a nonmatch keeps the parent arrow and parent contract.</p>
            {registeredContextPatterns.map((pattern) => {
              const registration = pattern.contextRegistration!;
              const laterN = typeof registration.later?.evaluableN === "number" ? registration.later.evaluableN : null;
              const laterAverage = typeof registration.later?.averageR === "number" ? registration.later.averageR : null;
              const parentAverage = typeof registration.parentOnSameContextLater?.averageR === "number" ? registration.parentOnSameContextLater.averageR : null;
              const alignment = typeof registration.reaction?.alignmentRate === "number" ? registration.reaction.alignmentRate : null;
              return <article key={registration.id}>
                <header><strong>{pattern.market} · {pattern.label}</strong><em>{registration.id}</em></header>
                <span>IF {contextLabel(registration.condition?.dimension ?? "context")} = {contextLabel(registration.condition?.value ?? "unknown")}</span>
                <small>SL {registration.execution?.stopAtr} ATR · TP {registration.execution?.targetR}R · maximum {registration.execution?.expiryCandles} H4 · later N {laterN ?? "—"} · average {formatSignedR(laterAverage)} · parent on same cases {formatSignedR(parentAverage)} · followed after 6 H4 {alignment == null ? "—" : `${(alignment * 100).toFixed(1)}%`}</small>
              </article>;
            })}
          </div>
        </details>
      ) : null}

      {data.globalResponse?.prospectiveContextLedger?.rows.length ? (
        <details className="chart-shadow-context-registry chart-shadow-context-ledger fms-research-only">
          <summary>
            <span>Live context check</span>
            <strong>{data.globalResponse.prospectiveContextLedger.matchedDecisions} matched · {data.globalResponse.prospectiveContextLedger.resolvedMatchedCases} resolved</strong>
            <ChevronDown size={14} />
          </summary>
          <div>
            <p>First-seen future releases are compared with the historical context result. They never rewrite an active setup.</p>
            {data.globalResponse.prospectiveContextLedger.rows.map((row) => (
              <article key={row.registrationId}>
                <header><strong>{row.market} · {row.label}</strong><em>{row.registrationId}</em></header>
                <span>IF {contextLabel(row.condition.dimension ?? "context")} = {contextLabel(row.condition.value ?? "unknown")}</span>
                <small>
                  Historical later: N {row.historicalExpectation.evaluableN ?? "—"} · avg {formatSignedR(row.historicalExpectation.averageR)} · followed {row.historicalExpectation.alignmentRate == null ? "—" : `${(row.historicalExpectation.alignmentRate * 100).toFixed(1)}%`}
                  <br />Future matched: {row.prospective.matched.decisionCount} decisions · {row.prospective.matched.resolvedCount} resolved · avg {formatSignedR(row.prospective.matched.averageR)}
                  <br />Future nonmatches: {row.prospective.notMatched.decisionCount} decisions · {row.prospective.notMatched.resolvedCount} resolved · avg {formatSignedR(row.prospective.notMatched.averageR)}
                </small>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {data.globalResponse?.contextFollowupResearch ? (
        <details className="chart-shadow-context-registry chart-shadow-context-followup fms-research-only">
          <summary>
            <span>Context research follow-up</span>
            <strong>
              {data.globalResponse.contextFollowupResearch.policyInflationCandidates.length} slow-context · {data.globalResponse.contextFollowupResearch.boundedInteractionCandidates.length} combined · {data.globalResponse.contextFollowupResearch.crossMarketTransferCandidates.length} transfer
            </strong>
            <ChevronDown size={14} />
          </summary>
          <div>
            <p>{data.globalResponse.contextFollowupResearch.recipesAudited} registered recipes audited. These are review-only findings; no setup, arrow, or contract changed automatically.</p>
            {data.globalResponse.contextFollowupResearch.policyInflationCandidates.map((candidate) => (
              <article key={`slow:${candidate.recipe}:${candidate.dimension}:${candidate.value}`}>
                <header><strong>{candidate.recipe.replace("|", " · ")}</strong><em>Policy / inflation candidate</em></header>
                <span>IF {contextLabel(candidate.dimension)} = {contextLabel(candidate.value)}</span>
                <small>Later N {candidate.laterExecution.evaluableN} · avg {formatSignedR(candidate.laterExecution.averageR)} · uplift {formatSignedR(candidate.laterExecutionUpliftR)} · followed {candidate.laterReaction.alignmentRate == null ? "—" : `${(candidate.laterReaction.alignmentRate * 100).toFixed(1)}%`}</small>
              </article>
            ))}
            {data.globalResponse.contextFollowupResearch.boundedInteractionCandidates.map((candidate) => (
              <article key={`combined:${candidate.recipe}:${candidate.conditions.map((row) => `${row.dimension}:${row.value}`).join("|")}`}>
                <header><strong>{candidate.recipe.replace("|", " · ")}</strong><em>Two-context candidate</em></header>
                <span>{candidate.conditions.map((row) => `${contextLabel(row.dimension)} = ${contextLabel(row.value)}`).join(" + ")}</span>
                <small>Later N {candidate.laterExecution.evaluableN} · avg {formatSignedR(candidate.laterExecution.averageR)} · uplift {formatSignedR(candidate.laterExecutionUpliftR)} · followed {candidate.laterReaction.alignmentRate == null ? "—" : `${(candidate.laterReaction.alignmentRate * 100).toFixed(1)}%`}</small>
              </article>
            ))}
            {data.globalResponse.contextFollowupResearch.crossMarketTransferCandidates.map((candidate) => (
              <article key={candidate.id}>
                <header><strong>{candidate.targetMarket} · {candidate.targetLabel}</strong><em>Cross-market transfer</em></header>
                <span>{candidate.sourceRegistrationId} tested as {contextLabel(candidate.condition.dimension ?? "context")} = {contextLabel(candidate.condition.value ?? "unknown")}</span>
                <small>Later N {candidate.laterExecution.evaluableN} · avg {formatSignedR(candidate.laterExecution.averageR)} · uplift {formatSignedR(candidate.laterExecutionUpliftR)} · followed {candidate.laterReaction.alignmentRate == null ? "—" : `${(candidate.laterReaction.alignmentRate * 100).toFixed(1)}%`}</small>
              </article>
            ))}
            {!data.globalResponse.contextFollowupResearch.policyInflationCandidates.length && !data.globalResponse.contextFollowupResearch.boundedInteractionCandidates.length && !data.globalResponse.contextFollowupResearch.crossMarketTransferCandidates.length ? <p>No declared follow-up context survived later-history review.</p> : null}
            <p>{data.globalResponse.contextFollowupResearch.refreshPolicy}</p>
          </div>
        </details>
      ) : null}

      {data.globalResponse?.outcomeReview || unregisteredSupportedContextReviews.length > 0 ? (
        <details className="chart-shadow-account-audit chart-shadow-review-queue fms-research-only">
          <summary>
            <span>Needs Codex review</span>
            <strong>{data.globalResponse?.outcomeReview ? Object.values(data.globalResponse.outcomeReview.unresolvedByReason).reduce((sum, count) => sum + count, 0) : 0} unresolved · {unregisteredSupportedContextReviews.length} context candidates</strong>
            <ChevronDown size={14} />
          </summary>
          <div>
            <p>Active contracts are unchanged. Pending, ambiguous, and unavailable cases are excluded from win rates, average R, and account replay.</p>
            {data.globalResponse?.outcomeReview && Object.entries(data.globalResponse.outcomeReview.unresolvedByReason).length > 0 ? (
              <dl>{Object.entries(data.globalResponse.outcomeReview.unresolvedByReason).map(([reason, count]) => <div key={reason}><dt>{reason.replaceAll("_", " ")}</dt><dd>{count}</dd></div>)}</dl>
            ) : <p>Every loaded registered arrow currently has a resolved or genuinely live lifecycle.</p>}
            {(data.globalResponse?.outcomeReview?.executionReviews ?? []).map((review) => (
              <article key={`${review.market}:${review.patternId}`} className="chart-shadow-review-card">
                <header><strong>{review.market} · {review.label}</strong><em>{review.status === "review_worthy" ? "Challenger worth review" : "Active evidence weakened"}</em></header>
                <p>{review.reason}</p>
                <div>
                  <span><b>Active</b>{review.active.stopAtr ?? "—"} ATR SL · {review.active.targetR ?? "—"}R TP · {review.active.holdingCandles ?? "—"} H4<br />Later N {review.active.evaluableN ?? "—"} · avg {formatSignedR(review.active.laterAverageR as number | null)} · TP first {review.active.tpBeforeSl == null ? "—" : `${((review.active.tpBeforeSl as number) * 100).toFixed(1)}%`}<br />95% range {formatSignedR(review.active.laterLower95 as number | null)} to {formatSignedR(review.active.laterUpper95 as number | null)} · DD {formatSignedR(review.active.maximumDrawdownR as number | null)} · streak {review.active.longestLosingStreak ?? "—"} · positive years {review.active.positiveYears ?? "—"}/{review.active.evaluableYears ?? "—"}</span>
                  <span><b>Challenger · {String(review.challenger.family ?? "managed").replaceAll("_", " ")}</b>{review.challenger.stopAtr ?? "—"} ATR SL · {review.challenger.targetR ?? "—"}R TP · {review.challenger.holdingCandles ?? "—"} H4<br />Later N {review.challenger.laterEvaluableN ?? "—"} · avg {formatSignedR(review.challenger.laterAverageR as number | null)} · TP first {review.challenger.laterTpBeforeSl == null ? "—" : `${((review.challenger.laterTpBeforeSl as number) * 100).toFixed(1)}%`}<br />95% range {formatSignedR(review.challenger.laterLower95 as number | null)} to {formatSignedR(review.challenger.laterUpper95 as number | null)} · DD {formatSignedR(review.challenger.laterMaximumDrawdownR as number | null)} · streak {review.challenger.laterLongestLosingStreak ?? "—"} · positive years {review.challenger.laterPositiveYears ?? "—"}/{review.challenger.laterEvaluableYears ?? "—"}</span>
                </div>
              </article>
            ))}
            {unregisteredSupportedContextReviews.length > 0 ? <section className="chart-shadow-context-review" aria-label="Later-supported context challengers">
              <header><strong>Later-supported context challengers</strong><span>{unregisteredSupportedContextReviews.length} unregistered</span></header>
              <p>Development history selected one bounded context per setup. Later history then tested it unchanged. These are research candidates only; no arrow or contract is filtered.</p>
              {unregisteredSupportedContextReviews.map(({ pattern, candidate }) => (
                <article key={`${pattern.market}:${pattern.id}:${candidate.dimension}:${candidate.value}`}>
                  <strong>{pattern.market} · {pattern.label}</strong>
                  <span>{contextLabel(candidate.dimension)} = {contextLabel(candidate.value)}</span>
                  <small>Later N {candidate.laterExecution.evaluableN ?? candidate.laterReaction.evaluableN} · average {formatSignedR(candidate.laterExecution.averageR as number | null)} · versus parent {formatSignedR(candidate.laterExecutionUpliftR)} · followed after 6 H4 {candidate.laterReaction.alignmentRate == null ? "—" : `${(candidate.laterReaction.alignmentRate * 100).toFixed(1)}%`}</small>
                </article>
              ))}
            </section> : null}
            <button type="button" className="chart-shadow-copy-review" onClick={() => {
              const review = data.globalResponse?.outcomeReview;
              const markdown = [
                "# FMS review",
                ...Object.entries(review?.unresolvedByReason ?? {}).map(([reason, count]) => `- Unresolved ${reason}: ${count}`),
                ...(review?.executionReviews ?? []).map((row) => `- ${row.market} · ${row.label}: ${row.status}. Active ${row.active.stopAtr} ATR/${row.active.targetR}R/${row.active.holdingCandles} H4, later ${row.active.evaluableN ?? "—"} cases at ${formatSignedR(row.active.laterAverageR as number | null)}. Challenger ${String(row.challenger.family ?? "managed")}, ${row.challenger.stopAtr} ATR/${row.challenger.targetR}R/${row.challenger.holdingCandles} H4, later ${row.challenger.laterEvaluableN ?? "—"} cases at ${formatSignedR(row.challenger.laterAverageR as number | null)}. ${row.reason}`),
                 ...unregisteredSupportedContextReviews.map(({ pattern, candidate }) => `- ${pattern.market} · ${pattern.label}: later-supported context ${candidate.dimension}=${candidate.value}. Later N ${candidate.laterExecution.evaluableN ?? candidate.laterReaction.evaluableN}, average ${formatSignedR(candidate.laterExecution.averageR as number | null)}, uplift versus parent ${formatSignedR(candidate.laterExecutionUpliftR)}, 6-H4 alignment ${candidate.laterReaction.alignmentRate == null ? "—" : `${(candidate.laterReaction.alignmentRate * 100).toFixed(1)}%`}. Research only; active arrow unchanged.`),
              ].join("\n");
              void navigator.clipboard?.writeText(markdown);
            }}>Copy AI review</button>
            <p className="chart-shadow-source-note">Hypothetical results can benefit from hindsight and do not reproduce actual execution. See <a href="https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html" target="_blank" rel="noreferrer">CFTC guidance</a> and <a href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2308659" target="_blank" rel="noreferrer">backtest-overfitting research</a>. Spread, commission, slippage, and swap remain excluded.</p>
          </div>
        </details>
      ) : null}

      {response.policyInflationContext ? (
        <details className="chart-macro-bias-realtime-context fms-research-only" aria-label="Policy and inflation background context">
          <summary><span>Policy / inflation background</span><strong>Not used by frozen rules</strong><ChevronDown size={14} /></summary>
          <div className="chart-shadow-context-grid">
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
          </div>
          <small>Observation only. This background does not filter, reverse, suppress, or justify a registered trade. Any context-aware rule must be tested and registered as a separate immutable recipe.</small>
        </details>
      ) : null}

      {data.globalResponse ? (
        <section className="chart-shadow-intelligence fms-research-only" aria-label="FMS historical research intelligence">
          <div className="chart-shadow-section-heading">
            <div><span>What history says</span><strong>What to watch and avoid</strong></div>
          </div>
          <p>{data.globalResponse.explanation}</p>
          {(["registered", "contender", "avoid", "insufficient"] as const).map((status) => {
            const rows = data.globalResponse!.researchIntelligence.filter((row) => row.status === status);
            const open = openIntelligence.has(status);
            const title = status === "registered"
              ? "Registered — historically profitable directional recipe"
              : status === "contender"
                ? "Contender — promising but unstable"
                : status === "avoid"
                  ? "Avoid as standalone direction"
                  : "Insufficient evidence";
            return (
              <details key={status} open={open} onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                setOpenIntelligence((current) => {
                  const next = new Set(current);
                  if (nextOpen) next.add(status); else next.delete(status);
                  return next;
                });
              }}>
                <summary>
                  <strong>{title}</strong>
                  <span><b>{rows.length}</b><em>Show</em><ChevronDown size={13} /></span>
                </summary>
                {open ? rows.map((row) => (
                  <article key={row.id}>
                    <h4>{row.market} · {row.label}</h4>
                    <p>{row.evidence}</p>
                    <small>{row.conclusion}</small>
                  </article>
                )) : null}
              </details>
            );
          })}
          <small className="chart-shadow-source-note">“Avoid” does not mean the release is irrelevant. It means its economic direction did not produce a dependable standalone price-direction rule in the recorded tests.</small>
        </section>
      ) : null}
      <footer>{view === "research" ? "Research findings do not change active registered setups automatically." : "Hypothetical results only: spread, commission, slippage, and swap are excluded. No order is sent to MT5. Past results do not guarantee the next trade."}</footer>
    </aside>
  );
});
