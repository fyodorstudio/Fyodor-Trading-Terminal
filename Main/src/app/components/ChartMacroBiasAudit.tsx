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

function pipSize(market: string): number {
  return market.endsWith("JPY") ? .01 : .0001;
}

function distancePips(from: number | null | undefined, to: number | null | undefined, market: string): number | null {
  return from == null || to == null ? null : Math.abs(to - from) / pipSize(market);
}

function formatAtr(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)} ATR`;
}

function readableContext(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ordinalPercentile(value: number): string {
  const rounded = Math.round(value * 100);
  const suffix = rounded % 100 >= 11 && rounded % 100 <= 13 ? "th" : rounded % 10 === 1 ? "st" : rounded % 10 === 2 ? "nd" : rounded % 10 === 3 ? "rd" : "th";
  return `${rounded}${suffix} past-only percentile`;
}

function contextHistory(
  pattern: MacroSignalChartPattern,
  dimension: "priceRegime" | "trendRelation" | "volatilityRegime" | "directionalRoom" | "macroBackground" | "releaseSession",
  value: string,
) {
  return pattern.reactionAudit?.profile?.contextResearch?.dimensions.find((row) => row.dimension === dimension && row.value === value) ?? null;
}

function marketContextValue(
  signal: MacroSignalChartSignal,
  dimension: "priceRegime" | "trendRelation" | "volatilityRegime" | "directionalRoom" | "macroBackground" | "releaseSession",
): string | null {
  const context = signal.marketContext;
  if (!context) return null;
  if (dimension === "priceRegime") return context.price.regime;
  if (dimension === "trendRelation") return context.price.relationToSignal;
  if (dimension === "volatilityRegime") return context.volatility.regime;
  if (dimension === "directionalRoom") return context.supportResistance.roomState;
  if (dimension === "macroBackground") return context.macroBackground.relationToSignal;
  return context.releaseEnvironment.session;
}

function formatHoldingCandles(from: number | null | undefined, to: number | null | undefined): string {
  if (from == null || to == null || to < from) return "—";
  const candles = (to - from) / 14_400;
  return `${Number.isInteger(candles) ? candles.toFixed(0) : candles.toFixed(1)} H4`;
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

function targetPathStatus(row: NonNullable<NonNullable<MacroSignalChartSignal["pathAudit"]>["targetLadder"]>[number]): string {
  if (row.status === "target_before_sl") return `Reached before original SL${row.timeToTargetCandles == null ? "" : ` · after ${row.timeToTargetCandles} H4`}`;
  if (row.status === "sl_before_target") return "Original SL came first";
  if (row.status === "ambiguous") return "Both touched · M1 order unavailable";
  if (row.status === "pending") return "Trade path still developing";
  return "Not reached before duration ended";
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
  const frozenStop = signal.initialStop ?? signal.stop;
  const riskPips = distancePips(signal.entry, frozenStop, market);
  const rewardPips = distancePips(signal.entry, signal.target, market);
  const atrPips = signal.atr == null ? null : signal.atr / pipSize(market);
  const riskAtr = signal.entry == null || frozenStop == null || signal.atr == null || signal.atr === 0 ? null : Math.abs(signal.entry - frozenStop) / signal.atr;
  const rewardAtr = signal.entry == null || signal.target == null || signal.atr == null || signal.atr === 0 ? null : Math.abs(signal.target - signal.entry) / signal.atr;
  const resultPips = signal.resultR == null || riskPips == null ? null : signal.resultR * riskPips;
  const timelineEnd = signal.exitTime ?? signal.pendingLifecycle?.asOf ?? signal.expiryTime ?? null;
  const targetLadder = signal.pathAudit?.targetLadder ?? [];
  const marketContext = signal.marketContext;
  const contextOverlay = signal.contextOverlay;
  const selectedContextCandidate = pattern.reactionAudit?.profile?.contextResearch?.selectedCandidate ?? null;
  const selectedContextMatches = selectedContextCandidate
    ? marketContextValue(signal, selectedContextCandidate.dimension) === selectedContextCandidate.value
    : false;
  const directionalBarrier = marketContext?.supportResistance.directionalBarrier;
  const directionalRoomDetail = marketContext?.supportResistance.directionalRoomAtr == null
    ? "No confirmed opposing H4 zone"
    : `${marketContext.supportResistance.directionalRoomAtr.toFixed(2)} ATR to ${directionalBarrier?.strength ?? "confirmed"} ${directionalBarrier?.kind ?? "zone"}${directionalBarrier ? ` at ${formatPrice(directionalBarrier.level, market)} · ${directionalBarrier.touches} touches` : ""}`;
  const contextRows = marketContext ? [
    { label: "Price regime", dimension: "priceRegime" as const, value: marketContext.price.regime, detail: `${readableContext(marketContext.price.relationToSignal)} with arrow` },
    { label: "Volatility", dimension: "volatilityRegime" as const, value: marketContext.volatility.regime, detail: marketContext.volatility.percentile == null ? `${marketContext.volatility.priorCount} prior ATR observations` : ordinalPercentile(marketContext.volatility.percentile) },
    { label: "Room toward target", dimension: "directionalRoom" as const, value: marketContext.supportResistance.roomState, detail: directionalRoomDetail },
    { label: "Economic background", dimension: "macroBackground" as const, value: marketContext.macroBackground.relationToSignal, detail: `${marketContext.macroBackground.pairVote ?? 0} Before-window pair vote` },
  ] : [];
  return (
    <aside className="chart-macro-bias-audit" aria-label={`${signal.direction} ${market} macro bias audit`}>
      <header>
        <div>
          <span>{historicalReplay ? "Past FMS result" : "Current FMS signal"}</span>
          <strong>{pattern.label}</strong>
        </div>
        <button type="button" onClick={data.onClose} aria-label="Close macro bias audit"><X size={15} /></button>
      </header>

      <section className="chart-macro-bias-at-a-glance" aria-label="Signal and frozen trade at a glance">
        <div><span>Signal</span><strong>{signal.direction === "long" ? "Long" : "Short"} {market}</strong></div>
        <div className={initialReactionFollowed ? "is-followed" : "is-rejected"}><span>Initial move</span><strong>{initialReaction ? `${initialReactionFollowed ? "Followed" : "Opposed"} · ${formatR(initialReaction.responseR)}` : "Not available"}</strong></div>
        <div><span>Frozen plan</span><strong>Risk −1R to seek +{targetR}R</strong><small>SL {stopAtr} ATR · TP {stopAtr * targetR} ATR · maximum {signal.expiryCandles} H4</small></div>
        <div><span>Frozen trade</span><strong>{formatOutcome(signal)}</strong><small>{lifecycle.state}</small></div>
      </section>

      <section className={`chart-macro-bias-entry-timing ${signal.entryTimingAudit ? "is-available" : "is-unavailable"}`} aria-label="Prospective entry timing comparison">
        <div><span>Entry timing research</span><strong>{signal.entryTimingAudit ? "Observed MT5 data" : "Not available for this arrow"}</strong></div>
        {signal.entryTimingAudit ? (
          <>
            <table>
              <thead><tr><th>Reference</th><th>Time</th><th>Price</th><th>Difference</th></tr></thead>
              <tbody>
                <tr><th>First observed quote</th><td>{formatUtc(signal.entryTimingAudit.quoteTime)}</td><td>{formatPrice(signal.entryTimingAudit.observedMid, market)}</td><td>{signal.entryTimingAudit.quoteDelaySeconds}s after release</td></tr>
                {signal.entryTimingAudit.entries.map((row) => <tr key={row.timeframe}><th>First later {row.timeframe} open</th><td>{row.entryTime == null ? "Waiting" : formatUtc(row.entryTime)}</td><td>{formatPrice(row.entryOpen, market)}</td><td>{row.status === "quote_captured_after_entry" ? "Quote arrived too late to compare" : row.status === "waiting_for_candle" ? "Not formed yet" : `${formatPips(row.gapPips)} raw · ${formatPips(row.directionAdjustedGapPips)} with arrow`}</td></tr>)}
              </tbody>
            </table>
            <small>{signal.entryTimingAudit.disclosure}</small>
          </>
        ) : <p>This arrow has no immutable first-seen MT5 quote. Older arrows remain honest H4 research; FMS will not invent a release-time price.</p>}
      </section>

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

      {marketContext ? (
        <section className="chart-macro-bias-market-context" aria-label="Market context known before entry">
          <div className="chart-macro-bias-section-title"><span>Context known before entry</span><strong>{contextOverlay?.executionApplied ? "Reviewed context contract used" : contextOverlay?.matched ? "Historical context match" : contextOverlay ? "Parent setup retained" : "Research comparison"}</strong></div>
          {contextOverlay ? (
            <div className={`chart-macro-bias-context-registration ${contextOverlay.matched ? "is-matched" : "is-not-matched"}`}>
              <div>
                <span>{contextOverlay.registrationId} · {readableContext(contextOverlay.condition.dimension)}</span>
                <strong>{contextOverlay.matched ? "Context matched" : "Context did not match"}</strong>
                <small>Rule: {readableContext(contextOverlay.condition.dimension)} must be {readableContext(contextOverlay.condition.value)}. At this entry it was {readableContext(contextOverlay.observedValue)}.</small>
              </div>
              <p>{contextOverlay.executionApplied
                ? `This reviewed context rule used SL ${contextOverlay.contextExecution.stopAtr} ATR, TP ${contextOverlay.contextExecution.targetR}R, maximum ${contextOverlay.contextExecution.expiryCandles} H4.`
                : contextOverlay.matched
                  ? "The historical arrow matches the reviewed condition, but its original parent result is preserved because the context model was not active then."
                  : "The condition did not match, so this recipe explicitly retained the parent arrow and parent execution contract."}</p>
              <dl>
                <div><dt>Later context trades</dt><dd>{typeof contextOverlay.later?.evaluableN === "number" ? contextOverlay.later.evaluableN : "—"}</dd></div>
                <div><dt>Context average</dt><dd>{formatR(typeof contextOverlay.later?.averageR === "number" ? contextOverlay.later.averageR : null)}</dd></div>
                <div><dt>Parent on same cases</dt><dd>{formatR(typeof contextOverlay.parentOnSameContextLater?.averageR === "number" ? contextOverlay.parentOnSameContextLater.averageR : null)}</dd></div>
                <div><dt>Followed after 6 H4</dt><dd>{formatPercent(typeof contextOverlay.reaction?.alignmentRate === "number" ? contextOverlay.reaction.alignmentRate : null)}</dd></div>
              </dl>
            </div>
          ) : null}
          <div className="chart-macro-bias-context-grid">
            {contextRows.map((row) => {
              const history = contextHistory(pattern, row.dimension, row.value);
              return <div key={row.dimension}><span>{row.label}</span><strong>{readableContext(row.value)}</strong><small>{row.detail}</small>{history ? <em>{history.laterReaction.evaluableN} later cases · {formatPercent(history.laterReaction.alignmentRate)} followed after 6 H4</em> : <em>No stable setup-specific comparison yet</em>}</div>;
            })}
          </div>
          {!contextOverlay && selectedContextCandidate ? (
            <div className="chart-macro-bias-context-challenger">
              <span>Development-selected context challenger</span>
              <strong>{readableContext(selectedContextCandidate.dimension)} = {readableContext(selectedContextCandidate.value)}</strong>
              <small>{selectedContextMatches ? "This arrow matches the selected historical context." : "This arrow does not match the selected historical context."}</small>
              <dl>
                <div><dt>Later audit</dt><dd>{selectedContextCandidate.status === "later_supported" ? "Supported" : "Rejected"}</dd></div>
                <div><dt>Later cases</dt><dd>{selectedContextCandidate.laterReaction.evaluableN}</dd></div>
                <div><dt>Followed after 6 H4</dt><dd>{formatPercent(selectedContextCandidate.laterReaction.alignmentRate)}</dd></div>
                <div><dt>Average trade</dt><dd>{formatR(selectedContextCandidate.laterExecution.averageR)}</dd></div>
                <div><dt>Versus parent recipe</dt><dd>{formatR(selectedContextCandidate.laterExecutionUpliftR)}</dd></div>
              </dl>
            </div>
          ) : null}
          <p>These labels use only completed candles and economic evidence available no later than the H4 entry. A reviewed match can change only this exact setup&apos;s contract; it never creates a duplicate arrow or reverses the economic direction.</p>
        </section>
      ) : null}

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
        <section className="chart-macro-bias-geometry" aria-label="Frozen trade geometry">
          <div className="chart-macro-bias-section-title"><span>Trade geometry</span><strong>Prices, ATR, pips, and R</strong></div>
          <div className="chart-macro-bias-atr-reference"><span>ATR(14) at entry</span><strong>{formatPrice(signal.atr, market)}{atrPips == null ? "" : ` · ${atrPips.toFixed(1)} pips`}</strong><small>One typical H4 range used to size this frozen setup.</small></div>
          <table aria-label="Frozen trade levels and independent target path">
            <thead><tr><th>Level</th><th>Price</th><th>Distance from entry</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr className="is-entry"><th>Entry</th><td>{formatPrice(signal.entry, market)}</td><td>0 pips · 0R</td><td>First strictly later H4 open</td></tr>
              <tr className="is-risk"><th>SL</th><td>{formatPrice(frozenStop, market)}</td><td>{riskPips == null ? "—" : `${riskPips.toFixed(1)} pips`} · {formatAtr(riskAtr)} · −1R</td><td>{signal.breakEvenArmed ? `Original risk; current stop moved to ${formatPrice(signal.stop, market)}` : "Frozen maximum loss before costs"}</td></tr>
              {targetLadder.length > 0 ? targetLadder.map((row) => {
                const frozen = Math.abs(row.targetR - targetR) < .000001;
                const ladderPips = Number.isFinite(row.distancePips) ? `${row.distancePips.toFixed(1)} pips` : "—";
                const ladderAtr = Number.isFinite(row.distanceAtr) ? `${row.distanceAtr.toFixed(2)} ATR` : "—";
                return <tr key={row.targetR} className={frozen ? "is-reward is-frozen-target" : "is-target-option"}><th>{frozen ? "Frozen TP" : "TP option"} · {row.targetR}R</th><td>{formatPrice(row.targetPrice, market)}</td><td>{ladderPips} · {ladderAtr} · +{row.targetR}R</td><td>{targetPathStatus(row)}</td></tr>;
              }) : <tr className="is-reward"><th>Frozen TP · {targetR}R</th><td>{formatPrice(signal.target, market)}</td><td>{rewardPips == null ? "—" : `${rewardPips.toFixed(1)} pips`} · {formatAtr(rewardAtr)} · +{targetR}R</td><td>Frozen take-profit reward</td></tr>}
            </tbody>
          </table>
          <p><b>How to read this:</b> the frozen TP remains the only official result. Other TP rows independently ask whether that target was reached before the original SL; they are hindsight path research, not partial exits or captured profit.</p>
        </section>
      ) : null}
      <section className="chart-macro-bias-timeline" aria-label="Release and trade timeline">
        <div className="chart-macro-bias-section-title"><span>What happened</span><strong>Release to frozen result</strong></div>
        <ol>
          <li><span>1</span><div><b>Economic release</b><strong>{formatUtc(signal.eventTime)}</strong></div></li>
          {signal.releaseObservationQuote ? <li><span>2</span><div><b>First FMS-observed post-release quote</b><strong>{formatUtc(signal.releaseObservationQuote.quoteTime)} · bid {formatPrice(signal.releaseObservationQuote.bid, market)} · ask {formatPrice(signal.releaseObservationQuote.ask, market)}</strong><small>{signal.entryTimingAudit?.quoteDelaySeconds ?? signal.releaseObservationQuote.entryLagSeconds}s after scheduled release · observed quote, not a fill</small></div></li> : null}
          <li><span>{signal.releaseObservationQuote ? "3" : "2"}</span><div><b>Frozen H4 trade activated</b><strong>{formatUtc(signal.activationTime)}</strong></div></li>
          {signal.pathAudit ? <li><span>{signal.releaseObservationQuote ? "4" : "3"}</span><div><b>Best favorable move</b><strong>{formatPips(signal.pathAudit.maximumFavorablePips)} · {formatR(signal.pathAudit.maximumFavorableR)} · after {signal.pathAudit.timeToMfeCandles ?? "—"} H4</strong></div></li> : null}
          <li><span>{signal.releaseObservationQuote ? (signal.pathAudit ? "5" : "4") : (signal.pathAudit ? "4" : "3")}</span><div><b>{lifecycle.resolved ? "Frozen trade closed" : "Current lifecycle"}</b><strong>{formatOutcome(signal)}{resultPips == null ? "" : ` · ${formatPips(resultPips)}`} · held {formatHoldingCandles(signal.activationTime, timelineEnd)}</strong><small>{signal.exitTime == null ? lifecycle.state : formatUtc(signal.exitTime)}</small></div></li>
        </ol>
        <p>Release-time entry remains prospective research. Historical rows without a first-seen quote cannot prove an executable release price; the frozen result still uses the first strictly later H4 open.</p>
      </section>
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
      {benchmark ? (
        <details className="chart-macro-bias-registered" aria-label="Historical setup performance">
          <summary><span>Historical performance of this exact setup</span><strong>{benchmark.experimentId}</strong></summary>
          <div className="chart-macro-bias-registered-body">
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
          </div>
        </details>
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
