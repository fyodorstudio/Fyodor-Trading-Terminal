import { X } from "lucide-react";
import { formatUtcDisplayDateTime } from "@/app/lib/format";
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
  return value == null ? "Waiting for next H4 open" : formatUtcDisplayDateTime(value);
}

function formatOutcome(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return `TP reached · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "stop_hit") return `SL reached · ${formatR(signal.resultR)}`;
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
  if (status === "verified") return "Backtest record verified";
  if (status === "mismatch") return "Backtest record mismatch";
  if (status === "unavailable") return "Backtest record unavailable";
  return "Older saved setup";
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
          <span>{historicalReplay ? "Past FMS result" : "Current FMS signal"}</span>
          <strong>{pattern.label}</strong>
          <div className="chart-macro-bias-header-status">
            <b>{signal.direction === "long" ? "Long" : "Short"} {market}</b>
            <em>{formatOutcome(signal)}</em>
          </div>
        </div>
        <button type="button" onClick={data.onClose} aria-label="Close macro bias audit"><X size={15} /></button>
      </header>

      <section className="chart-macro-bias-trigger" aria-label="Economic releases that triggered this signal">
        <div className="chart-macro-bias-trigger-heading">
          <span>Why the arrow appeared</span>
          <strong>{signal.events.length > 0 ? `${signal.events.length} release${signal.events.length === 1 ? "" : "s"} matched this setup` : "Registered event package"}</strong>
        </div>
        <div className="chart-macro-bias-events">
          {signal.events.map((event) => (
            <div key={`${event.id}:${event.time}`}>
              <strong>{event.title}</strong>
              <small>{event.currency}/{event.countryCode}</small>
              <span>A {event.actual || "—"} · F {event.forecast || "—"} · P {event.previous || "—"}</span>
              <b>Score {event.score > 0 ? "+" : ""}{event.score}</b>
            </div>
          ))}
        </div>
      </section>

      <div className={`chart-macro-bias-lifecycle ${lifecycle.resolved ? "is-resolved" : "is-active"}`}>
        <div><span>{historicalReplay ? "What happened afterward" : "Trade monitor"}</span><strong>{lifecycle.state}</strong></div>
        <p>{lifecycle.detail}</p>
      </div>
      <div className="chart-macro-bias-clock" aria-label="Signal timing">
        <div><span>Release time</span><strong>{formatUtc(signal.eventTime)}</strong></div>
        <div><span>Trade started</span><strong>{formatUtc(signal.activationTime)}</strong></div>
      </div>

      {benchmark ? (
        <section className="chart-macro-bias-registered" aria-label="Historical setup performance">
          <div className="chart-macro-bias-section-title"><span>Historical performance of this exact setup</span><strong>{benchmark.experimentId}</strong></div>
          <div className="chart-macro-bias-stats">
            <div className="is-primary"><span>Average per trade</span><strong>{formatR(benchmark.walkForwardAverageR)}</strong></div>
            <div><span>TP before SL</span><strong>{formatPercent(benchmark.targetFirstRate)}</strong></div>
            <div><span>Later test trades</span><strong>{benchmark.walkForwardN}</strong></div>
            <div><span>All matching events</span><strong>{benchmark.historicalN}</strong></div>
            <div><span>SL before TP</span><strong>{formatPercent(benchmark.stopFirstRate)}</strong></div>
            <div><span>TP rate needed</span><strong>{formatPercent(simpleBreakEven)}</strong></div>
          </div>
          <div className="chart-macro-bias-contract"><b>Trade rules used in this test</b><span>SL {stopAtr} ATR · TP {targetR}R = {stopAtr * targetR} ATR · maximum {signal.expiryCandles} H4 candles</span></div>
          {provenance ? <div className={`chart-macro-bias-provenance is-${provenance.status}`}><strong>{provenanceLabel(provenance.status)}</strong><span>{provenance.note}</span></div> : null}
        </section>
      ) : (
        <section className="chart-macro-bias-legacy-warning">
          <strong>This older setup has no linked backtest record</strong>
          <span>Its signal is retained for audit, but exact historical performance is unavailable here.</span>
        </section>
      )}

      <footer>
        <strong>Important</strong>
        <span>Gross results exclude spread, slippage, swap, and commission. {historicalReplay ? "This past arrow is hindsight and was not available in real time." : "This release matched a registered FMS setup."} No order is sent to MT5.</span>
        <small>Recorded setup {data.modelId} ({data.modelHash.slice(0, 10)}){data.datasetFingerprint ? ` · data ${data.datasetFingerprint.slice(0, 10)}` : ""}</small>
      </footer>
    </aside>
  );
}
