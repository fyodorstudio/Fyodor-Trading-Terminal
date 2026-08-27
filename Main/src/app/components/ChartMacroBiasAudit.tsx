import { X } from "lucide-react";
import type { MacroSignalChartMode, MacroSignalChartPattern, MacroSignalChartSignal } from "@/app/types";

export interface ChartMacroBiasAuditData {
  signal: MacroSignalChartSignal;
  pattern: MacroSignalChartPattern;
  symbol?: string;
  versionId: string;
  modelId: string;
  modelHash: string;
  datasetFingerprint?: string;
  mode: MacroSignalChartMode;
  targetR?: number;
  generatedAt?: number;
  onClose: () => void;
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatUtc(value: number | null | undefined): string {
  return value == null ? "Waiting for next H4 open" : `${new Date(value * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatOutcome(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return `Target first · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "stop_hit") return `Stop first · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "expired") return `Duration ended · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "ambiguous") return "Both touched · order unknown";
  if (signal.outcomeStatus === "unevaluable") return "Not evaluable";
  if (signal.outcomeStatus === "pending") return "Monitoring the frozen outcome window";
  return signal.activationTime == null ? "Waiting for the next H4 open" : "Awaiting paper-ledger reconciliation";
}

function lifecycleCopy(signal: MacroSignalChartSignal): { state: string; detail: string; resolved: boolean } {
  if (signal.outcomeStatus === "target_hit") return { state: "Closed — target reached", detail: "The frozen trade ended at its target. Later price movement does not change this result.", resolved: true };
  if (signal.outcomeStatus === "stop_hit") return { state: "Closed — stop reached", detail: "The frozen trade ended at its stop. This is a losing case for loss-review research.", resolved: true };
  if (signal.outcomeStatus === "expired") return { state: "Closed — maximum duration reached", detail: "Neither boundary won before expiry; the final marked-to-market R is retained.", resolved: true };
  if (signal.outcomeStatus === "ambiguous") return { state: "Closed — intrabar order unknown", detail: "Both boundaries touched inside the same smallest loaded candle, so no win or loss is invented.", resolved: true };
  if (signal.outcomeStatus === "unevaluable") return { state: "Unavailable", detail: "Loaded price history cannot truthfully resolve this case.", resolved: true };
  return { state: signal.activationTime == null ? "Waiting for H4 entry" : "Active hypothetical trade", detail: "The arrow remains active only until its target, stop, or maximum duration ends the frozen trade.", resolved: false };
}

function provenanceLabel(status: NonNullable<MacroSignalChartPattern["registrationProvenance"]>["status"]): string {
  if (status === "verified") return "Verified immutable recipe";
  if (status === "mismatch") return "Audit mismatch";
  if (status === "unavailable") return "Experiment unavailable";
  return "Legacy snapshot";
}

export function ChartMacroBiasAudit({ data }: { data: ChartMacroBiasAuditData }) {
  const { signal, pattern } = data;
  const market = pattern.market ?? data.symbol ?? "EURUSD";
  const stopAtr = signal.stopAtr ?? pattern.execution?.stopAtr ?? 1;
  const targetR = signal.targetR ?? pattern.execution?.targetR ?? 2;
  const historicalReplay = data.mode === "research_replay" || signal.historicalReplay;
  const benchmark = pattern.historicalBenchmark;
  const provenance = pattern.registrationProvenance;
  const lifecycle = lifecycleCopy(signal);
  const simpleBreakEven = 1 / (1 + targetR);
  return (
    <aside className="chart-macro-bias-audit" aria-label={`${signal.direction} ${market} macro bias audit`}>
      <header>
        <div>
          <span>{historicalReplay ? "Historical research replay" : "Current frozen model"} · {pattern.modelStatus === "current" ? "registered pattern" : "research only"}</span>
          <strong>{signal.direction === "long" ? "Long" : "Short"} {market} bias</strong>
          <small>{pattern.label}</small>
        </div>
        <button type="button" onClick={data.onClose} aria-label="Close macro bias audit"><X size={15} /></button>
      </header>
      <div className="chart-macro-bias-clock">
        <div><span>Economic release</span><strong>{formatUtc(signal.eventTime)}</strong></div>
        <div><span>Bias active from</span><strong>{formatUtc(signal.activationTime)}</strong></div>
      </div>
      <div className={`chart-macro-bias-lifecycle ${lifecycle.resolved ? "is-resolved" : "is-active"}`}>
        <div><span>Trade lifecycle</span><strong>{lifecycle.state}</strong></div>
        <p>{lifecycle.detail}</p>
      </div>
      <div className="chart-macro-bias-outcome">
        <span>{historicalReplay ? "Known-afterward simulation" : "Current paper lifecycle"}</span>
        <strong>{formatOutcome(signal)}</strong>
        <small>{historicalReplay ? "The outcome uses price after activation and was unknown when the arrow appeared." : "No order is sent to MT5; this is a hypothetical frozen-rule monitor."}</small>
      </div>

      {benchmark ? (
        <section className="chart-macro-bias-registered" aria-label="Exact registered recipe benchmark">
          <div className="chart-macro-bias-section-title"><span>Exact registered recipe</span><strong>{benchmark.experimentId}</strong></div>
          <div className="chart-macro-bias-stats">
            <div><span>Historical matches</span><strong>{benchmark.historicalN}</strong></div>
            <div><span>Walk-forward cases</span><strong>{benchmark.walkForwardN}</strong></div>
            <div><span>Walk-forward average</span><strong>{formatR(benchmark.walkForwardAverageR)}</strong></div>
            <div><span>Target first</span><strong>{formatPercent(benchmark.targetFirstRate)}</strong></div>
            <div><span>Stop first</span><strong>{formatPercent(benchmark.stopFirstRate)}</strong></div>
            <div><span>Simple gross break-even</span><strong>{formatPercent(simpleBreakEven)}</strong></div>
          </div>
          <div className="chart-macro-bias-contract"><b>Frozen contract</b><span>SL {stopAtr} ATR · TP {targetR}R = {stopAtr * targetR} ATR · maximum {signal.expiryCandles} H4 candles</span></div>
          {provenance ? <div className={`chart-macro-bias-provenance is-${provenance.status}`}><strong>{provenanceLabel(provenance.status)}</strong><span>{provenance.note}</span></div> : null}
        </section>
      ) : (
        <section className="chart-macro-bias-legacy-warning">
          <strong>Legacy registration — exact contract benchmark is not linked</strong>
          <span>The source diagnostics below are useful research context, but they must not be read as this registered contract's performance.</span>
        </section>
      )}

      <details className="chart-macro-bias-source-audit">
        <summary>Source research diagnostics <span>different benchmark</span></summary>
        <p>These figures describe the broader source-pattern research and alternative target tests. They may use a different population or exit than the exact registered recipe above.</p>
        <div className="chart-macro-bias-stats">
          <div><span>Source historical N</span><strong>{pattern.overall.evaluableCount}</strong></div>
          <div><span>Source 2R target first</span><strong>{formatPercent(pattern.overall.targetHitRate)}</strong></div>
          <div><span>Source stop first</span><strong>{formatPercent(pattern.overall.stopHitRate)}</strong></div>
          <div><span>Source gross average</span><strong>{formatR(pattern.overall.averageR)}</strong></div>
          <div><span>{pattern.executionStress.pips} pip stress</span><strong>{formatR(pattern.executionStress.overall.averageR)}</strong></div>
          <div><span>Source recent 3 years</span><strong>{formatR(pattern.executionStress.recent.averageR)}</strong></div>
        </div>
        {pattern.targetRobustness.length > 0 ? (
          <div className="chart-macro-bias-targets" aria-label="Source target sensitivity after execution stress">
            {pattern.targetRobustness.map((target) => (
              <div key={target.targetR}>
                <span>{target.targetR}R source target</span>
                <strong>{formatR(target.executionStress.averageR)}</strong>
                <small>gross {formatR(target.gross.averageR)}</small>
              </div>
            ))}
          </div>
        ) : null}
        <div className="chart-macro-bias-splits">
          <span>Source development: N {pattern.executionStress.development.evaluableCount} · {formatR(pattern.executionStress.development.averageR)}</span>
          <span>Source holdout: N {pattern.executionStress.holdout.evaluableCount} · {formatR(pattern.executionStress.holdout.averageR)}</span>
          <span>Source positive years: {pattern.yearStability.positiveYears}/{pattern.yearStability.evaluableYears}</span>
          <span>Source past-only audit: N {pattern.prequentialAudit.evaluableCount} · {formatR(pattern.prequentialAudit.executionStress.averageR)}</span>
        </div>
        <p className={`chart-macro-bias-selection-note ${pattern.uncertaintyIncludesNoEdge ? "is-warning" : ""}`}>
          {pattern.selectionNote} {signal.backgroundCoverageComplete ? `Release context: Before evidence was ${signal.backgroundAlignment}; this remains an audit dimension, not a fitted filter.` : "The immutable ledger does not contain a complete 90-day Before window for this signal."}
          {pattern.uncertaintyIncludesNoEdge ? " The source stressed 95% expectancy interval includes zero edge." : ""}
          {pattern.estimatedBreakEvenStressPips != null ? ` The linear source stress reaches zero near ${pattern.estimatedBreakEvenStressPips.toFixed(1)} pips per case; this is not an execution-cost estimate.` : ""}
        </p>
      </details>

      <div className="chart-macro-bias-events">
        {signal.events.map((event) => (
          <div key={`${event.id}:${event.time}`}>
            <strong>{event.currency}/{event.countryCode} · {event.title}</strong>
            <span>A {event.actual || "—"} · F {event.forecast || "—"} · P {event.previous || "—"} · score {event.score > 0 ? "+" : ""}{event.score}</span>
          </div>
        ))}
      </div>
      <footer>
        {data.modelId} ({data.modelHash.slice(0, 10)}) from {data.versionId}{data.datasetFingerprint ? ` · data ${data.datasetFingerprint.slice(0, 10)}` : ""}. Gross hypothetical research excludes spread, slippage, swap, and commission. {historicalReplay ? "This old arrow is hindsight replay and was not available in real time." : "This release matched the frozen current model."} Not a guaranteed outcome or automatic order.
      </footer>
    </aside>
  );
}
