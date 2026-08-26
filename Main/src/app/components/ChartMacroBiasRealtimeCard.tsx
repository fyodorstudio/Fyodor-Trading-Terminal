import { ShieldCheck, WalletCards } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { ChartMacroBiasNextSetup, ChartMacroBiasSetupCatalog } from "@/app/components/ChartMacroBiasSetupCatalog";
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
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalPatternAssessment } from "@/app/types";

const SHADOW_BALANCE_KEY = "fyodor.charts.shadow-starting-balance";
const SHADOW_RISK_KEY = "fyodor.charts.shadow-risk-percent";

export interface ChartMacroBiasRealtimeCardData {
  response: MacroSignalChartSignalResponse;
  activeSignal: MacroSignalChartSignal | null;
  activePattern: MacroSignalChartPattern | null;
  remainingModelCandles: number | null;
  chartTimeframe: string;
  historicalSignals: MacroSignalChartSignal[] | null;
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
  return value == null ? "No scheduled row loaded" : `${new Date(value * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
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

function LatestDecisionSection({ assessment, pattern }: { assessment: MacroSignalPatternAssessment; pattern: MacroSignalChartPattern | null }) {
  const status = assessment.status === "pre_activation_audit"
    ? "Audit only"
    : assessment.status === "no_trade"
      ? "No trade"
      : assessment.status === "qualified"
        ? "Qualified"
        : "Processing";
  return (
    <section className="chart-shadow-decision" aria-label="Latest FMS decision">
      <div className="chart-shadow-section-heading">
        <div><span>Latest decision</span><strong>{pattern?.label ?? assessment.label}</strong></div>
        <b className={`chart-shadow-status is-${assessment.status}`}>{status}</b>
      </div>
      <time>{formatUtc(assessment.time)}</time>
      {assessment.calculations?.map((calculation) => (
        <div className="chart-shadow-decision-audit" key={`${assessment.time}-${calculation.title}`}>
          <h4>{calculation.title}</h4>
          <dl>
            <div><dt>Actual</dt><dd>{calculation.actual ?? "–"}</dd></div>
            <div><dt>Forecast</dt><dd>{calculation.forecast ?? "–"}</dd></div>
            <div><dt>Previous</dt><dd>{calculation.previous ?? "–"}</dd></div>
            <div><dt>Surprise</dt><dd>{calculation.forecastSuspect ? "Excluded · suspect" : `${surpriseMeaning(calculation.surprisePoint)} ${formatPoint(calculation.surprisePoint)}`}</dd></div>
            <div><dt>Momentum</dt><dd>{momentumMeaning(calculation.momentumPoint)} {formatPoint(calculation.momentumPoint)}</dd></div>
            <div><dt>Total</dt><dd>{formatPoint(calculation.score)}</dd></div>
          </dl>
          {calculation.score === 0 ? <p><b>Decision:</b> evidence cancelled to zero, so no trade was opened.</p> : null}
          {assessment.status === "pre_activation_audit" ? <p><b>Decision:</b> {assessment.direction === "long" ? "Long EURUSD" : "Short EURUSD"} under Forecast Guard, but audit-only because the release predates model activation.</p> : null}
          <small>{calculation.forecastSuspect ? `Raw Forecast ${calculation.forecast ?? "–"} retained; ${calculation.forecastGap?.toFixed(2) ?? "–"} gap exceeded the past-only ${calculation.forecastAnomalyThreshold?.toFixed(2) ?? "–"} threshold.` : "Frozen first-seen MT5 values."}</small>
        </div>
      ))}
      {!assessment.calculations?.length ? <p>{assessment.reason}</p> : null}
      {pattern ? <p className="chart-shadow-decision-rule"><b>Rule:</b> {pattern.condition}</p> : null}
    </section>
  );
}

export function ChartMacroBiasRealtimeCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const { response, activeSignal, activePattern } = data;
  const [startingBalance, setStartingBalance] = useState(() => normalizeShadowStartingBalance(readStoredNumber(SHADOW_BALANCE_KEY, DEFAULT_SHADOW_STARTING_BALANCE)));
  const [riskPercent, setRiskPercent] = useState(() => normalizeShadowRiskPercent(readStoredNumber(SHADOW_RISK_KEY, DEFAULT_SHADOW_RISK_PERCENT)));
  const nextEvent = response.realtime?.nextPairEvent ?? null;
  const nextWatch = response.realtime?.nextPatternWatch ?? null;
  const latestAssessment = response.realtime?.latestPatternAssessment ?? null;
  const registeredPatterns = useMemo(
    () => response.patterns.filter((pattern) => pattern.currentEligible).sort((left, right) => left.label.localeCompare(right.label)),
    [response.patterns],
  );
  const assessmentsByPattern = useMemo(
    () => new Map((response.realtime?.latestPatternAssessments ?? []).map((assessment) => [assessment.patternId, assessment])),
    [response.realtime?.latestPatternAssessments],
  );
  const upcomingByPattern = useMemo(
    () => new Map((response.realtime?.upcomingPatternWatches ?? []).map((watch) => [watch.patternId, watch])),
    [response.realtime?.upcomingPatternWatches],
  );
  const watchPattern = nextWatch
    ? response.patterns.find((pattern) => pattern.id === nextWatch.patternId) ?? null
    : null;
  const latestAssessmentPattern = latestAssessment
    ? response.patterns.find((pattern) => pattern.id === latestAssessment.patternId) ?? null
    : null;
  const settings = useMemo(() => ({ startingBalance, riskPercent }), [startingBalance, riskPercent]);
  const liveAccount = useMemo(() => buildMacroSignalShadowAccount(response.signals, settings), [response.signals, settings]);
  const historicalAccount = useMemo(
    () => data.historicalSignals == null ? null : buildMacroSignalShadowAccount(data.historicalSignals, settings),
    [data.historicalSignals, settings],
  );
  const position = activeSignal ? buildMacroSignalShadowPosition(activeSignal, liveAccount.balance, riskPercent) : null;
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

  return (
    <aside className="chart-macro-bias-realtime" aria-label="FMS Shadow Trader">
      <header>
        <div><ShieldCheck size={14} /><span>FMS Shadow Trader</span></div>
        <small>{timeframeLabel}</small>
      </header>
      {latestAssessment ? <LatestDecisionSection assessment={latestAssessment} pattern={latestAssessmentPattern} /> : null}
      <section className="chart-shadow-priority" aria-label="All registered FMS setups">
        <div className="chart-shadow-section-heading">
          <div><span>Registered setups</span><strong>{registeredPatterns.length} frozen rules monitored</strong></div>
        </div>
        <table>
          <thead><tr><th>Registered setup</th><th>State</th><th>Relevant time</th></tr></thead>
          <tbody>
            {registeredPatterns.map((pattern) => {
              const patternSignals = response.signals
                .filter((signal) => signal.patternId === pattern.id)
                .sort((left, right) => right.eventTime - left.eventTime || right.id.localeCompare(left.id));
              const patternSignal = activeSignal?.patternId === pattern.id ? activeSignal : patternSignals[0] ?? null;
              const assessment = assessmentsByPattern.get(pattern.id) ?? (latestAssessment?.patternId === pattern.id ? latestAssessment : null);
              const upcoming = upcomingByPattern.get(pattern.id) ?? (nextWatch?.patternId === pattern.id ? nextWatch : null);
              const assessmentIsNewer = assessment && (!patternSignal || assessment.time > patternSignal.eventTime);
              const openOrPending = patternSignal && !assessmentIsNewer && patternSignal.outcomeStatus === "pending";
              const latestTime = assessmentIsNewer ? assessment.time : patternSignal?.eventTime ?? assessment?.time ?? null;
              return (
                <Fragment key={pattern.id}>
                  <tr className={openOrPending ? "is-current" : undefined}>
                    <td><strong>{pattern.label}</strong></td>
                    <td>{openOrPending ? (
                      <><strong>{activeSignal?.id === patternSignal.id ? "Open hypothetical trade" : "Qualified · waiting H4 entry"}</strong><small>{patternSignal.direction === "long" ? "Long EURUSD" : "Short EURUSD"}</small></>
                    ) : patternSignal && !assessmentIsNewer && patternSignal.outcomeStatus && patternSignal.outcomeStatus !== "pending" ? (
                      <strong>{formatOutcome(patternSignal)}</strong>
                    ) : assessment ? (
                      <strong>{assessment.status === "awaiting_observation" ? "Processing release" : assessment.status === "qualified" ? "Qualified" : assessment.status === "pre_activation_audit" ? `Audit only · ${assessment.direction === "long" ? "Long" : "Short"}` : "No trade"}</strong>
                    ) : <span>Waiting</span>}</td>
                    <td>
                      {latestTime != null ? <strong>Latest · {formatUtc(latestTime)}</strong> : null}
                      {upcoming ? <small><b>Next ·</b> {formatUtc(upcoming.time)}</small> : latestTime == null ? <span>No upcoming release loaded</span> : null}
                    </td>
                  </tr>
                  <tr className="chart-shadow-priority-detail" hidden>
                    <td colSpan={3}>
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
                              {calculation.score === 0 ? <p><b>Decision:</b> equal-weight evidence cancelled to zero, so this frozen rule cannot open a trade.</p> : null}
                              {assessment.status === "pre_activation_audit" ? <p><b>Decision:</b> the Forecast Guard produces {assessment.direction === "long" ? "Long EURUSD" : "Short EURUSD"}, but this release occurred before the new model activated, so no hypothetical trade was opened.</p> : null}
                              <small className="chart-shadow-source-note">{calculation.forecastSuspect ? `Raw MT5 Forecast ${calculation.forecast ?? "–"} was preserved but excluded: its ${calculation.forecastGap?.toFixed(2) ?? "–"} Forecast/Previous gap exceeded the past-only ${calculation.forecastAnomalyThreshold?.toFixed(2) ?? "–"} threshold.` : "FMS uses the frozen first-seen MT5 values above."}</small>
                            </div>
                          ))}
                        </div>
                      ) : assessment ? <p className="chart-shadow-assessment-reason" aria-label={assessment.reason}>{assessment.reason}</p> : null}
                      <p className="chart-shadow-frozen-rule"><b>Frozen rule:</b> {pattern.condition}</p>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <ChartMacroBiasNextSetup watch={nextWatch} pattern={watchPattern} asOf={response.realtime?.asOf ?? response.generatedAt ?? Math.floor(Date.now() / 1_000)} />

      <section className="chart-shadow-settings" aria-label="Gross shadow account assumptions">
        <div className="chart-shadow-section-heading"><div><span><WalletCards size={12} /> Shadow account</span><strong>Gross sequential replay</strong></div></div>
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
          <span>Current-model account</span>
          <strong>{formatMoney(liveAccount.balance)}</strong>
          <small>{liveAccount.takenTrades} closed · {formatMoney(liveAccount.profit)} P/L</small>
        </div>
        <div>
          <span>Historical replay</span>
          <strong>{historicalAccount ? formatMoney(historicalAccount.balance) : "Loading…"}</strong>
          <small>{historicalAccount ? `${historicalAccount.takenTrades} trades · ${historicalAccount.returnPercent >= 0 ? "+" : ""}${historicalAccount.returnPercent.toFixed(1)}% · DD ${historicalAccount.maxDrawdownPercent.toFixed(1)}%` : "Current-pattern history only"}</small>
        </div>
        {historicalAccount && (historicalAccount.skippedOverlap > 0 || historicalAccount.skippedConflict > 0 || historicalAccount.ambiguous > 0 || historicalAccount.unevaluable > 0) ? (
          <p>{historicalAccount.skippedOverlap} overlapping skipped · {historicalAccount.skippedConflict} simultaneous conflicts skipped · {historicalAccount.ambiguous} ambiguous excluded · {historicalAccount.unevaluable} unevaluable excluded</p>
        ) : null}
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

      <ChartMacroBiasSetupCatalog patterns={response.patterns} />

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
          <div className="chart-macro-bias-realtime-kicker">Earlier EUR/USD calendar row</div>
          <strong>{nextEvent.currency} · {nextEvent.title}</strong><span>{formatUtc(nextEvent.time)} · {nextEvent.impact} impact · not a registered setup</span>
        </section>
      ) : null}
      <footer>Gross hypothetical simulation only: spread, commission, slippage, and swap are excluded. No order is sent to MT5, and historical replay is hindsight—not a guaranteed forecast.</footer>
    </aside>
  );
}
