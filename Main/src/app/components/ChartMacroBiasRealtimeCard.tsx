import { Clock3, ShieldCheck, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_SHADOW_RISK_PERCENT,
  DEFAULT_SHADOW_STARTING_BALANCE,
  buildMacroSignalShadowAccount,
  buildMacroSignalShadowPosition,
  normalizeShadowRiskPercent,
  normalizeShadowStartingBalance,
} from "@/app/lib/macroSignalShadow";
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse } from "@/app/types";

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

function formatR(value: number | null): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPrice(value: number | null | undefined): string {
  return value == null ? "Waiting for entry" : value.toFixed(5);
}

function outcomeCount(pattern: MacroSignalChartPattern | null, key: "targetHitCount" | "stopHitCount"): string {
  if (!pattern) return "—";
  return `${pattern.executionStress.overall[key]} / ${pattern.executionStress.overall.evaluableCount}`;
}

export function ChartMacroBiasRealtimeCard({ data }: { data: ChartMacroBiasRealtimeCardData }) {
  const { response, activeSignal, activePattern } = data;
  const [startingBalance, setStartingBalance] = useState(() => normalizeShadowStartingBalance(readStoredNumber(SHADOW_BALANCE_KEY, DEFAULT_SHADOW_STARTING_BALANCE)));
  const [riskPercent, setRiskPercent] = useState(() => normalizeShadowRiskPercent(readStoredNumber(SHADOW_RISK_KEY, DEFAULT_SHADOW_RISK_PERCENT)));
  const nextEvent = response.realtime?.nextPairEvent ?? null;
  const nextWatch = response.realtime?.nextPatternWatch ?? null;
  const watchPattern = nextWatch
    ? response.patterns.find((pattern) => pattern.id === nextWatch.patternId) ?? null
    : null;
  const historicalPattern = activePattern ?? watchPattern;
  const settings = useMemo(() => ({ startingBalance, riskPercent }), [startingBalance, riskPercent]);
  const liveAccount = useMemo(() => buildMacroSignalShadowAccount(response.signals, settings), [response.signals, settings]);
  const historicalAccount = useMemo(
    () => data.historicalSignals == null ? null : buildMacroSignalShadowAccount(data.historicalSignals, settings),
    [data.historicalSignals, settings],
  );
  const position = activeSignal ? buildMacroSignalShadowPosition(activeSignal, liveAccount.balance, riskPercent) : null;
  const bias = activeSignal ? (activeSignal.direction === "long" ? "Hypothetical long EURUSD" : "Hypothetical short EURUSD") : "No trade";
  const timeframeLabel = data.chartTimeframe === response.modelTimeframe
    ? `${response.modelTimeframe} model`
    : `${response.modelTimeframe} model on ${data.chartTimeframe}`;
  const nextWatchCurrency = nextWatch?.events[0]?.currency ?? "EUR/USD";
  const nextWatchTitles = nextWatch?.events.map((event) => event.title).join(" + ") ?? null;

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
      <section className="chart-macro-bias-realtime-state">
        <span>Current hypothetical decision</span>
        <strong>{bias}</strong>
        <p>{activePattern
          ? `${activePattern.label}: ${activePattern.condition}`
          : "Waiting for a frozen setup. No Current Model condition is active."}</p>
        {activeSignal && data.remainingModelCandles != null ? <small>{data.remainingModelCandles} H4 model candles remain</small> : null}
      </section>

      <section className="chart-shadow-settings" aria-label="Gross shadow account assumptions">
        <div className="chart-macro-bias-realtime-kicker"><WalletCards size={12} /> Gross shadow simulation</div>
        <label>
          <span>Starting balance</span>
          <span className="chart-shadow-input"><b>$</b><input type="number" min="100" step="100" defaultValue={startingBalance} onBlur={(event) => { event.currentTarget.value = String(updateStartingBalance(Number(event.currentTarget.value))); }} /></span>
        </label>
        <label>
          <span>Risk per trade</span>
          <span className="chart-shadow-input"><input type="number" min="0.1" max="5" step="0.1" defaultValue={riskPercent} onBlur={(event) => { event.currentTarget.value = String(updateRiskPercent(Number(event.currentTarget.value))); }} /><b>%</b></span>
        </label>
        <small>One position at a time · 1× ATR(14) stop · {response.targetR}R target · sequential compounding</small>
      </section>

      <section className="chart-shadow-ledger" aria-label="Gross account results">
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
        {historicalAccount && (historicalAccount.skippedOverlap > 0 || historicalAccount.ambiguous > 0 || historicalAccount.unevaluable > 0) ? (
          <p>{historicalAccount.skippedOverlap} overlapping skipped · {historicalAccount.ambiguous} ambiguous excluded · {historicalAccount.unevaluable} unevaluable excluded</p>
        ) : null}
      </section>

      {activeSignal && position ? (
        <section className="chart-shadow-position" aria-label="Hypothetical position">
          <div className="chart-macro-bias-realtime-kicker">Hypothetical position · no MT5 order</div>
          <div className="chart-shadow-position-grid">
            <div><span>Entry</span><strong>{formatPrice(activeSignal.entry)}</strong></div>
            <div><span>Stop</span><strong>{formatPrice(activeSignal.stop)}</strong></div>
            <div><span>{response.targetR}R target</span><strong>{formatPrice(activeSignal.target)}</strong></div>
            <div><span>Risk</span><strong>{formatMoney(position.riskDollars)}</strong></div>
            <div><span>Stop distance</span><strong>{position.stopPips == null ? "—" : `${position.stopPips.toFixed(1)} pips`}</strong></div>
            <div><span>Position size</span><strong>{position.lots == null ? "—" : `${position.lots.toFixed(2)} lots`}</strong></div>
          </div>
          <p>{activeSignal.events.map((event) => `${event.currency} ${event.title}: score ${event.score > 0 ? "+" : ""}${event.score}`).join(" · ")}</p>
        </section>
      ) : null}

      <section className="chart-macro-bias-realtime-watch">
        <div className="chart-macro-bias-realtime-kicker"><Clock3 size={12} /> Possible next setup</div>
        {nextWatch ? (
          <>
            <strong>{formatUtc(nextWatch.time)}</strong>
            <span>{nextWatchCurrency} · {nextWatchTitles || nextWatch.label}</span>
            <p>{nextWatch.condition}</p>
            <small>Direction is decided only after Actual arrives. A missing, zero, or nonmatching score produces no trade.</small>
          </>
        ) : <p>No registered setup is scheduled in the loaded calendar window.</p>}
      </section>

      <section className="chart-macro-bias-realtime-history" aria-label="Historical results for the active or next watched pattern">
        <div><span>{activePattern ? "Active · 2R first" : "Possible setup · 2R first"}</span><strong>{outcomeCount(historicalPattern, "targetHitCount")}</strong></div>
        <div><span>Stop first</span><strong>{outcomeCount(historicalPattern, "stopHitCount")}</strong></div>
        <div><span>Gross average R</span><strong>{formatR(historicalPattern?.overall.averageR ?? null)}</strong></div>
      </section>

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
