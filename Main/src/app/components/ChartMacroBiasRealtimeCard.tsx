import { ChevronDown, ChevronRight, ShieldCheck, WalletCards } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChartMacroBiasSetupCatalog, macroSignalSetupCredibility } from "@/app/components/ChartMacroBiasSetupCatalog";
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
  const [setupSort, setSetupSort] = useState<"actionable" | "readiness" | "credibility" | "profitability" | "accuracy" | "sample" | "soonest" | "market_family">("accuracy");
  const [selectedTradeKey, setSelectedTradeKey] = useState<string | null>(null);
  const [expandedWatchKey, setExpandedWatchKey] = useState<string | null>(null);
  const [openIntelligence, setOpenIntelligence] = useState<Set<MacroSignalResearchIntelligence["status"]>>(() => new Set());
  const [hiddenMarkets, setHiddenMarkets] = useState<Set<string>>(() => new Set());
  const [startingBalance, setStartingBalance] = useState(() => normalizeShadowStartingBalance(readStoredNumber(SHADOW_BALANCE_KEY, DEFAULT_SHADOW_STARTING_BALANCE)));
  const [riskPercent, setRiskPercent] = useState(() => normalizeShadowRiskPercent(readStoredNumber(SHADOW_RISK_KEY, DEFAULT_SHADOW_RISK_PERCENT)));
  const registryResponses = useMemo(
    () => data.globalResponse?.markets.filter((market) => market.supported) ?? [response],
    [data.globalResponse, response],
  );
  const marketSymbols = useMemo(() => registryResponses.map((market) => market.symbol).sort(), [registryResponses]);
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
  const assessmentsByPattern = useMemo(
    () => new Map(registryResponses.flatMap((market) => (market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : [])).map((assessment) => [`${market.symbol}:${assessment.patternId}`, assessment]))),
    [registryResponses],
  );
  const tradeRows = useMemo<ShadowTradeRow[]>(() => registryResponses.flatMap((market) => {
    const assessments = market.realtime?.latestPatternAssessments ?? (market.realtime?.latestPatternAssessment ? [market.realtime.latestPatternAssessment] : []);
    const exactAssessments = new Map(assessments.map((assessment) => [`${assessment.patternId}:${assessment.time}`, assessment]));
    const patterns = new Map(market.patterns.map((pattern) => [pattern.id, pattern]));
    return market.signals
      .filter((signal) => signal.activationTime != null && patterns.get(signal.patternId)?.readiness?.actionableInShadowTrader !== false)
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
  const registeredPatterns = useMemo(() => registeredPatternRows.filter((pattern) => !hiddenMarkets.has(pattern.market ?? response.symbol)).sort((left, right) => {
    const leftMarket = left.market ?? response.symbol;
    const rightMarket = right.market ?? response.symbol;
    if (setupSort === "market_family") return leftMarket.localeCompare(rightMarket) || left.sourceVersionId.localeCompare(right.sourceVersionId) || left.label.localeCompare(right.label);
    if (setupSort === "soonest") {
      const leftTime = upcomingByPattern.get(`${leftMarket}:${left.id}`)?.time ?? Number.POSITIVE_INFINITY;
      const rightTime = upcomingByPattern.get(`${rightMarket}:${right.id}`)?.time ?? Number.POSITIVE_INFINITY;
      return leftTime - rightTime || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
    }
    if (setupSort === "readiness") {
      const leftReady = left.readiness?.auditStatus === "complete" ? 1 : 0;
      const rightReady = right.readiness?.auditStatus === "complete" ? 1 : 0;
      return rightReady - leftReady || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
    }
    if (setupSort === "credibility") {
      const rank = { Strong: 3, Moderate: 2, Fragile: 1, Unproven: 0 } as const;
      const difference = rank[macroSignalSetupCredibility(right).label] - rank[macroSignalSetupCredibility(left).label];
      if (difference !== 0) return difference;
    }
    if (setupSort === "actionable") {
      const rank = (pattern: MacroSignalChartPattern, market: string) => {
        if (pattern.readiness?.actionableInShadowTrader === false) return 0;
        const signal = latestSignalByPattern.get(`${market}:${pattern.id}`);
        if (signal?.outcomeStatus === "pending") return signal.entry != null ? 6 : 5;
        const assessment = assessmentsByPattern.get(`${market}:${pattern.id}`);
        if (assessment?.status === "qualified") return 5;
        if (assessment?.status === "awaiting_observation") return 4;
        if (upcomingByPattern.has(`${market}:${pattern.id}`)) return 3;
        return 1;
      };
      return rank(right, rightMarket) - rank(left, leftMarket) || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
    }
    const leftValue = setupSort === "accuracy" ? historicalAccuracy(left) : setupSort === "sample" ? historicalSample(left) : historicalAverage(left);
    const rightValue = setupSort === "accuracy" ? historicalAccuracy(right) : setupSort === "sample" ? historicalSample(right) : historicalAverage(right);
    return rightValue - leftValue || leftMarket.localeCompare(rightMarket) || left.label.localeCompare(right.label);
  }), [assessmentsByPattern, hiddenMarkets, latestSignalByPattern, registeredPatternRows, response.symbol, setupSort, upcomingByPattern]);
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
          <div><span>Trade monitor</span><strong>What would FMS do now?</strong></div>
          <small>Setup-level simulations · click a row for its audit · the account replay separately skips portfolio overlaps</small>
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
      {selectedTrade ? <LatestDecisionSection assessment={selectedTrade.assessment} pattern={selectedTrade.pattern} symbol={selectedTrade.market} signal={selectedTrade.signal} /> : null}
      {data.globalLoading ? <section className="chart-shadow-global-state">Loading the global registry…</section> : null}
      {data.globalError ? <section className="chart-shadow-global-state is-error">Global registry unavailable: {data.globalError}. Showing {response.symbol} only.</section> : null}
      <section className="chart-shadow-priority" aria-label="All registered FMS setups">
        <div className="chart-shadow-section-heading">
          <div><span>Live watchlist</span><strong>Every registered setup</strong></div>
          <nav className="chart-shadow-market-filters" aria-label="Show or hide market rows">
            {marketSymbols.map((market) => {
              const visible = !hiddenMarkets.has(market);
              return (
                <button
                  type="button"
                  key={market}
                  className={visible ? "is-visible" : "is-hidden"}
                  aria-label={`${visible ? "Hide" : "Show"} ${market}`}
                  aria-pressed={visible}
                  title={`${visible ? "Hide" : "Show"} ${market}`}
                  onClick={() => setHiddenMarkets((current) => {
                    const next = new Set(current);
                    if (next.has(market)) next.delete(market); else next.add(market);
                    return next;
                  })}
                ><PairFlags symbol={market} /></button>
              );
            })}
            {hiddenMarkets.size > 0 ? <button type="button" className="chart-shadow-market-reset" aria-label="Show all markets" title="Show all markets" onClick={() => setHiddenMarkets(new Set())}>All</button> : null}
          </nav>
          <label><span>Sort</span><select value={setupSort} onChange={(event) => setSetupSort(event.target.value as typeof setupSort)}><option value="accuracy">Highest TP-before-SL</option><option value="actionable">Actionable now</option><option value="readiness">Audit readiness</option><option value="credibility">Historical credibility</option><option value="profitability">Best average result</option><option value="sample">Largest later-test sample</option><option value="soonest">Soonest registered release</option><option value="market_family">Market and family</option></select></label>
        </div>
        <table>
          <thead><tr><th>Pair and setup</th><th>Now</th><th>Relevant event</th><th>Historical result</th></tr></thead>
          <tbody>
            {registeredPatterns.length === 0 ? <tr className="chart-shadow-watchlist-empty"><td colSpan={4}>All pair rows are hidden. Use <b>Show all</b> above to restore the watchlist.</td></tr> : null}
            {registeredPatterns.map((pattern) => {
              const patternMarket = pattern.market ?? response.symbol;
              const watchKey = `${patternMarket}:${pattern.id}`;
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
              const blocked = pattern.readiness?.actionableInShadowTrader === false;
              return (
                <Fragment key={pattern.id}>
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
                    <td><strong className="chart-shadow-setup-title"><PairFlags symbol={patternMarket} />{patternMarket} · {pattern.label}</strong><small className="chart-shadow-contract-line">SL {pattern.execution?.stopAtr ?? 1} ATR · TP {pattern.execution?.targetR ?? 2}R · {pattern.execution?.expiryCandles ?? 30} H4</small><span className={`chart-shadow-readiness is-${pattern.readiness?.auditStatus ?? "incomplete"}`}>{pattern.readiness?.label ?? "Audit incomplete"}</span>{pattern.readiness?.orientationAudited && <span className="chart-shadow-readiness is-complete">Orientation audited</span>}<span className={`chart-shadow-reaction is-${pattern.reaction === "contrarian" ? "rejected" : "followed"}`}>{pattern.reaction === "contrarian" ? "Rejected evidence" : "Followed evidence"}</span></td>
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

      <section className="chart-shadow-account" aria-label="Gross hypothetical account and performance replay">
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

      {data.globalResponse?.liveDecisions?.length ? (
        <details className="chart-shadow-account-audit chart-shadow-decision-ledger">
          <summary><span>Immutable decision ledger</span><strong>{data.globalResponse.liveDecisions.length} first-seen decisions</strong><ChevronDown size={14} /></summary>
          <div>
            <p>Broker revisions cannot rewrite these original qualified/no-trade decisions.</p>
            <table aria-label="Immutable FMS first-seen decisions">
              <thead><tr><th>Pair and setup</th><th>Release</th><th>Decision</th><th>Recorded</th></tr></thead>
              <tbody>{data.globalResponse.liveDecisions.map((decision) => {
                const pattern = registeredPatternRows.find((row) => row.id === decision.patternId && (row.market ?? response.symbol) === decision.market);
                return <tr key={`${decision.market}:${decision.patternId}:${decision.eventTime}`}><td><strong><PairFlags symbol={decision.market} />{pattern?.label ?? decision.patternId}</strong></td><td>{formatUtc(decision.eventTime)}</td><td><strong>{decision.status === "qualified" ? `${decision.direction === "long" ? "Long" : "Short"} ${decision.market}` : "No trade"}</strong></td><td>{formatUtc(decision.firstDecidedAt)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </details>
      ) : null}

      <ChartMacroBiasSetupCatalog patterns={registeredPatternRows} />

      {response.policyInflationContext ? (
        <details className="chart-macro-bias-realtime-context" aria-label="Policy and inflation background context">
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
        <section className="chart-shadow-intelligence" aria-label="FMS historical research intelligence">
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
      <footer>Hypothetical results only: spread, commission, slippage, and swap are excluded. No order is sent to MT5. Past results do not guarantee the next trade.</footer>
    </aside>
  );
}
