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

function formatPips(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)} pips`;
}

function formatPrice(value: number | null | undefined, market: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(market.endsWith("JPY") ? 3 : 5);
}

function formatUtc(value: number | null | undefined): string {
  return value == null ? "Waiting for next H4 open" : formatUtcDisplayDateTime(value);
}

function formatOutcome(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return `TP reached · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "stop_hit") return `SL reached · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "expired") return `Duration ended · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "ambiguous") return "Both touched · order unknown";
  if (signal.outcomeStatus === "unevaluable") return signal.outcomeReason ?? "Historical price data unavailable";
  if (signal.outcomeStatus === "pending") return signal.outcomeReason ?? "Trade still running";
  return signal.activationTime == null ? "Waiting for the next H4 open" : "Awaiting paper-ledger reconciliation";
}

function lifecycleCopy(signal: MacroSignalChartSignal): { state: string; detail: string; resolved: boolean } {
  if (signal.outcomeStatus === "target_hit") return { state: "Closed — target reached", detail: "The frozen trade ended at its target. Later price movement does not change this result.", resolved: true };
  if (signal.outcomeStatus === "stop_hit" && signal.resultR === 0) return { state: "Closed — break-even stop reached", detail: "The reviewed rule had already moved the stop to entry, so this case closed at 0R before costs.", resolved: true };
  if (signal.outcomeStatus === "stop_hit") return { state: "Closed — stop reached", detail: "The frozen trade ended at its stop. This is a losing case for loss-review research.", resolved: true };
  if (signal.outcomeStatus === "expired") return { state: "Closed — maximum duration reached", detail: "Neither boundary won before expiry; the final marked-to-market R is retained.", resolved: true };
  if (signal.outcomeStatus === "ambiguous") return { state: "Closed — intrabar order unknown", detail: "Both boundaries touched inside the same smallest loaded candle, so no win or loss is invented.", resolved: true };
  if (signal.outcomeStatus === "unevaluable") {
    const coverage = signal.outcomeCoverage;
    const required = coverage?.requiredFrom != null && coverage.requiredTo != null ? `${formatUtc(coverage.requiredFrom)} to ${formatUtc(coverage.requiredTo)}` : "the required trade interval";
    const available = coverage?.availableFrom != null && coverage.availableTo != null ? `${formatUtc(coverage.availableFrom)} to ${formatUtc(coverage.availableTo)}` : "none";
    return { state: signal.outcomeReason ?? "Historical price data unavailable", detail: `Required MT5 coverage: ${required} (${coverage?.requiredCandles ?? "additional"} H4 candles). Available coverage: ${available}.`, resolved: true };
  }
  if (signal.outcomeStatus === "pending") return { state: signal.outcomeReason ?? "Trade still running", detail: signal.outcomeReasonCode === "waiting_for_entry_candle" ? "The release is known; the first strictly later H4 entry candle has not opened yet." : "The hypothetical trade remains open until TP, SL, ambiguity, or its maximum H4 duration resolves it.", resolved: false };
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
  const reviewedExecutionApplies = pattern.executionReview?.status === "reviewed_active"
    && signal.eventTime >= pattern.executionReview.activatedAt;
  const reviewedLater = reviewedExecutionApplies ? pattern.executionReview?.later : null;
  const benchmarkAverage = typeof reviewedLater?.averageR === "number" ? reviewedLater.averageR : benchmark?.walkForwardAverageR;
  const benchmarkTargetRate = typeof reviewedLater?.tpBeforeSl === "number" ? reviewedLater.tpBeforeSl : benchmark?.targetFirstRate;
  const benchmarkSample = typeof reviewedLater?.evaluableN === "number" ? reviewedLater.evaluableN : benchmark?.walkForwardN;
  const lifecycle = lifecycleCopy(signal);
  const simpleBreakEven = 1 / (1 + targetR);
  const initialReaction = signal.pathAudit?.fixedHorizonResponses.find((row) => row.holdingCandles === 1) ?? null;
  const initialReactionPips = initialReaction && signal.atr != null
    ? initialReaction.responseR * stopAtr * signal.atr / (market.endsWith("JPY") ? .01 : .0001)
    : null;
  const initialReactionFollowed = initialReaction == null ? null : initialReaction.responseR > 0;
  return (
    <aside className="chart-macro-bias-audit" aria-label={`${signal.direction} ${market} macro bias audit`}>
      <header>
        <div>
          <span>{historicalReplay ? "Past FMS result" : "Current FMS signal"}</span>
          <strong>{pattern.label}</strong>
          <div className="chart-macro-bias-header-status">
            <b>{signal.direction === "long" ? "Long" : "Short"} {market}</b>
            {initialReaction ? <em className={initialReactionFollowed ? "is-followed" : "is-rejected"}>Initial move {initialReactionFollowed ? "followed" : "opposed"} · {formatR(initialReaction.responseR)}</em> : null}
            <em>Frozen trade · {formatOutcome(signal)}</em>
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

      {initialReaction ? (
        <section className={`chart-macro-bias-reaction-verdict ${initialReactionFollowed ? "is-followed" : "is-rejected"}`} aria-label="Initial price reaction">
          <div><span>Initial price reaction</span><strong>{initialReactionFollowed ? "Price followed the arrow" : "Price opposed the arrow"}</strong></div>
          <b>{formatR(initialReaction.responseR)}{initialReactionPips == null ? "" : ` · ${formatPips(initialReactionPips)}`} after 1 H4</b>
          <p>This measures direction after the first completed H4 candle. It is separate from whether the frozen TP or SL was reached later.</p>
        </section>
      ) : null}

      <div className={`chart-macro-bias-lifecycle ${lifecycle.resolved ? "is-resolved" : "is-active"}`}>
        <div><span>{historicalReplay ? "Frozen trade result" : "Trade monitor"}</span><strong>{lifecycle.state}</strong></div>
        <p>{lifecycle.detail}</p>
      </div>
      {signal.entry != null || signal.stop != null || signal.target != null ? (
        <section className="chart-macro-bias-levels" aria-label="Frozen trade price levels">
          <div className="is-entry"><span>Entry</span><strong>{formatPrice(signal.entry, market)}</strong><small>Trade activation price</small></div>
          <div className="is-risk"><span>{signal.breakEvenArmed ? "Break-even · SL" : "Risk · SL"}</span><strong>{formatPrice(signal.stop, market)}</strong><small>{signal.breakEvenArmed ? "Moved to entry · 0R before costs" : "−1R boundary"}</small></div>
          <div className="is-reward"><span>Reward · TP</span><strong>{formatPrice(signal.target, market)}</strong><small>+{targetR}R boundary</small></div>
        </section>
      ) : null}
      {signal.pathAudit ? (
        <section className="chart-macro-bias-path-audit" aria-label="Evidence reaction and trade execution">
          <div className="chart-macro-bias-section-title"><span>Reaction versus trade result</span><strong>Two separate questions</strong></div>
          <div className="chart-macro-bias-path-grid">
            <div><span>Registered mapping</span><strong>{signal.pathAudit.evidenceReaction === "rejected" ? "Rejects evidence" : "Follows evidence"}</strong></div>
            <div><span>Direction after {signal.pathAudit.reactionHorizonCandles} H4</span><strong>{signal.pathAudit.directionWorked == null ? "Unavailable" : signal.pathAudit.directionWorked ? "Worked" : "Did not work"}</strong><small>{formatR(signal.pathAudit.reactionResponseR)}</small></div>
            <div><span>Best favorable move</span><strong>{formatR(signal.pathAudit.maximumFavorableR)}</strong><small>{formatPips(signal.pathAudit.maximumFavorablePips)} · after {signal.pathAudit.timeToMfeCandles ?? "—"} H4 · not realized profit</small></div>
            <div><span>Worst open pressure</span><strong>{formatR(-signal.pathAudit.maximumAdverseR)}</strong><small>{formatPips(-signal.pathAudit.maximumAdversePips)} · after {signal.pathAudit.timeToMaeCandles ?? "—"} H4</small></div>
            <div><span>Final frozen trade</span><strong>{formatOutcome(signal)}</strong>{signal.pathAudit.givebackR != null ? <small>{formatR(signal.pathAudit.givebackR)} given back from the best open point</small> : null}</div>
          </div>
          {signal.pathAudit.maximumFavorableR >= .5 && (signal.resultR ?? 0) < 0 ? <p><b>Why they differ:</b> price initially moved in the registered direction, but not far enough to reach this setup’s TP before reversing into its SL. The best favorable move is hindsight path evidence, not profit the frozen rule captured.</p> : null}
          {(signal.pathAudit.lossReview ?? []).length > 0 ? <div className="chart-macro-bias-loss-review"><span>Loss-path observations</span>{(signal.pathAudit.lossReview ?? []).map((reason) => <b key={reason}>{reason === "favourable_then_giveback" ? "Favourable move, then giveback" : reason === "target_not_reached_before_close" ? "Target was not reached before close" : reason === "adverse_before_best_favourable_move" ? "Adverse move came before the best favourable point" : reason === "direction_not_working_at_six_h4" ? "Direction was not working at six H4" : "Maximum duration ended negative"}</b>)}</div> : null}
          {signal.pathAudit.fixedHorizonResponses.length > 0 ? <div className="chart-macro-bias-horizon-strip">{signal.pathAudit.fixedHorizonResponses.map((row) => <span key={row.holdingCandles}><b>{row.holdingCandles} H4</b>{formatR(row.responseR)}</span>)}</div> : null}
        </section>
      ) : null}
      <div className="chart-macro-bias-clock" aria-label="Signal timing">
        <div><span>Release time</span><strong>{formatUtc(signal.eventTime)}</strong></div>
        <div><span>Trade started</span><strong>{formatUtc(signal.activationTime)}</strong></div>
      </div>

      {benchmark ? (
        <section className="chart-macro-bias-registered" aria-label="Historical setup performance">
          <div className="chart-macro-bias-section-title"><span>Historical performance of this exact setup</span><strong>{benchmark.experimentId}</strong></div>
          <div className="chart-macro-bias-stats">
            <div className="is-primary"><span>Average per trade</span><strong>{formatR(benchmarkAverage)}</strong></div>
            <div><span>TP before SL</span><strong>{formatPercent(benchmarkTargetRate)}</strong></div>
            <div><span>Later test trades</span><strong>{benchmarkSample ?? "—"}</strong></div>
            <div><span>All matching events</span><strong>{benchmark.historicalN}</strong></div>
            <div><span>SL before TP</span><strong>{formatPercent(benchmark.stopFirstRate)}</strong></div>
            <div><span>TP rate needed</span><strong>{formatPercent(simpleBreakEven)}</strong></div>
            {pattern.reactionAudit ? <div><span>Direction worked after {pattern.reactionAudit.horizonCandles} H4</span><strong>{formatPercent(pattern.reactionAudit.positiveResponseRate)}</strong></div> : null}
            {pattern.reactionAudit ? <div><span>Worked, but trade lost</span><strong>{pattern.reactionAudit.directionWorkedTradeLost} / {pattern.reactionAudit.evaluableN}</strong></div> : null}
          </div>
          {pattern.reactionAudit ? <p className="chart-macro-bias-reaction-note"><b>Different measurements:</b> direction checks the registered price response after {pattern.reactionAudit.horizonCandles} H4 candles. The final trade result uses this setup&apos;s exact SL, TP, and maximum duration.</p> : null}
          <div className="chart-macro-bias-contract"><b>Trade rules used in this test</b><span>SL {stopAtr} ATR · TP {targetR}R = {stopAtr * targetR} ATR · maximum {signal.expiryCandles} H4 candles{signal.managementFamily === "break_even" ? ` · move SL to entry after a completed H4 reaches +${signal.managementTriggerR ?? 1}R` : ""}</span></div>
          {reviewedExecutionApplies ? <div className="chart-macro-bias-provenance is-verified"><strong>Reviewed execution contract</strong><span>{pattern.executionReview?.reason} Historical result remains gross and is not live validation.</span></div> : null}
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
