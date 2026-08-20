import { X } from "lucide-react";
import type { MacroSignalChartMode, MacroSignalChartPattern, MacroSignalChartSignal } from "@/app/types";

export interface ChartMacroBiasAuditData {
  signal: MacroSignalChartSignal;
  pattern: MacroSignalChartPattern;
  versionId: string;
  modelId: string;
  modelHash: string;
  datasetFingerprint?: string;
  mode: MacroSignalChartMode;
  targetR: number;
  generatedAt?: number;
  onClose: () => void;
}

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number | null): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatUtc(value: number | null | undefined): string {
  return value == null ? "Waiting for next H4 open" : `${new Date(value * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatOutcome(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return `Target first · ${formatR(signal.resultR ?? null)}`;
  if (signal.outcomeStatus === "stop_hit") return `Stop first · ${formatR(signal.resultR ?? null)}`;
  if (signal.outcomeStatus === "expired") return `Expired · ${formatR(signal.resultR ?? null)}`;
  if (signal.outcomeStatus === "ambiguous") return "Both touched · order unknown";
  if (signal.outcomeStatus === "unevaluable") return "Not evaluable";
  if (signal.outcomeStatus === "pending") return "Monitoring the frozen outcome window";
  return signal.activationTime == null ? "Waiting for the next H4 open" : "Awaiting paper-ledger reconciliation";
}

export function ChartMacroBiasAudit({ data }: { data: ChartMacroBiasAuditData }) {
  const { signal, pattern } = data;
  const historicalReplay = data.mode === "research_replay" || signal.historicalReplay;
  return (
    <aside className="chart-macro-bias-audit" aria-label={`${signal.direction} macro bias audit`}>
      <header>
        <div>
          <span>{historicalReplay ? "Historical research replay" : "Current frozen model"} · {pattern.modelStatus === "current" ? "current pattern" : "research only"}</span>
          <strong>{signal.direction === "long" ? "Long EURUSD bias" : "Short EURUSD bias"}</strong>
          <small>{pattern.label}</small>
        </div>
        <button type="button" onClick={data.onClose} aria-label="Close macro bias audit"><X size={15} /></button>
      </header>
      <div className="chart-macro-bias-clock">
        <div><span>Economic release</span><strong>{formatUtc(signal.eventTime)}</strong></div>
        <div><span>Bias active from</span><strong>{formatUtc(signal.activationTime)}</strong></div>
      </div>
      <div className="chart-macro-bias-outcome">
        <span>{historicalReplay ? "Known-afterward simulation" : "Current paper lifecycle"}</span>
        <strong>{formatOutcome(signal)}</strong>
        <small>{historicalReplay ? "This outcome uses price data after the arrow and was not known when it activated." : "A resolved target, stop, or expiry ends the active-bias state."}</small>
      </div>
      <div className="chart-macro-bias-stats">
        <div><span>Historical N</span><strong>{pattern.overall.evaluableCount}</strong></div>
        <div><span>{data.targetR}R target first</span><strong>{formatPercent(pattern.overall.targetHitRate)}</strong></div>
        <div><span>Stop first</span><strong>{formatPercent(pattern.overall.stopHitRate)}</strong></div>
        <div><span>Gross average</span><strong>{formatR(pattern.overall.averageR)}</strong></div>
        <div><span>{pattern.executionStress.pips} pip stress</span><strong>{formatR(pattern.executionStress.overall.averageR)}</strong></div>
        <div><span>Recent 3 years</span><strong>{formatR(pattern.executionStress.recent.averageR)}</strong></div>
      </div>
      {pattern.targetRobustness.length > 0 ? (
        <div className="chart-macro-bias-targets" aria-label="Target sensitivity after execution stress">
          {pattern.targetRobustness.map((target) => (
            <div key={target.targetR}>
              <span>{target.targetR}R target</span>
              <strong>{formatR(target.executionStress.averageR)}</strong>
              <small>gross {formatR(target.gross.averageR)}</small>
            </div>
          ))}
        </div>
      ) : null}
      <div className="chart-macro-bias-splits">
        <span>Stressed development: N {pattern.executionStress.development.evaluableCount} · {formatR(pattern.executionStress.development.averageR)}</span>
        <span>Stressed holdout: N {pattern.executionStress.holdout.evaluableCount} · {formatR(pattern.executionStress.holdout.averageR)}</span>
        <span>Positive years: {pattern.yearStability.positiveYears}/{pattern.yearStability.evaluableYears}</span>
        <span>Past-only qualification: N {pattern.prequentialAudit.evaluableCount} · {formatR(pattern.prequentialAudit.executionStress.averageR)}</span>
      </div>
      <p className={`chart-macro-bias-selection-note ${pattern.uncertaintyIncludesNoEdge ? "is-warning" : ""}`}>
        {pattern.selectionNote} {signal.backgroundCoverageComplete ? `Release context: Before evidence was ${signal.backgroundAlignment}; this remains an audit dimension, not a fitted filter.` : "The immutable ledger does not yet contain a complete 90-day Before window for this signal, so background alignment is not interpreted."}
        {pattern.uncertaintyIncludesNoEdge ? " The stressed 95% expectancy interval still includes zero edge." : ""}
        {pattern.estimatedBreakEvenStressPips != null ? ` The linear historical result stress reaches zero near ${pattern.estimatedBreakEvenStressPips.toFixed(1)} pips per case; this is not an execution-cost estimate.` : ""}
      </p>
      <div className="chart-macro-bias-events">
        {signal.events.map((event) => (
          <div key={`${event.id}:${event.time}`}>
            <strong>{event.currency}/{event.countryCode} · {event.title}</strong>
            <span>A {event.actual || "—"} · F {event.forecast || "—"} · P {event.previous || "—"} · score {event.score > 0 ? "+" : ""}{event.score}</span>
          </div>
        ))}
      </div>
      <footer>
        {data.modelId} ({data.modelHash.slice(0, 10)}) from {data.versionId}{data.datasetFingerprint ? ` · data ${data.datasetFingerprint.slice(0, 10)}` : ""}. Three-pip result stress is shown, but exact historical spread, slippage, swap, and commission are unavailable. {historicalReplay ? "This old arrow is a hindsight replay and was not available in real time." : "This release matched the frozen current model."} Not a guaranteed outcome or automatic order.
      </footer>
    </aside>
  );
}
