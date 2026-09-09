import { X } from "lucide-react";
import { formatJakartaDisplayDateTime } from "@/app/lib/format";
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
  detailLoading?: boolean;
  detailError?: string | null;
  onRetryDetail?: () => void;
  onClose: () => void;
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number | null | undefined): string {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatSignedNumber(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value}`;
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
  return value == null ? "Waiting for next H4 open" : formatJakartaDisplayDateTime(value);
}

function formatOutcome(signal: MacroSignalChartSignal): string {
  if (signal.outcomeStatus === "target_hit") return `TP reached · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "stop_hit") return `SL reached · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "expired") return `Duration ended · ${formatR(signal.resultR)}`;
  if (signal.outcomeStatus === "ambiguous") return "Both touched · order unknown";
  if (signal.outcomeStatus === "unevaluable") return signal.outcomeReason ?? "Historical price data unavailable";
  if (signal.outcomeStatus === "pending") return signal.outcomeReason ?? "Trade still running";
  if (signal.activationTime == null) return "Waiting for the next H4 open";
  if (signal.entry == null) return "Entry geometry is not recorded";
  if (signal.resultR != null) return `Recorded result ${formatR(signal.resultR)} · outcome status unavailable`;
  return "Outcome status unavailable";
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
  const signalEvents = signal.events ?? [];
  const market = pattern.market ?? data.symbol ?? "EURUSD";
  const stopAtr = signal.stopAtr ?? pattern.execution?.stopAtr ?? 1;
  const targetR = signal.targetR ?? pattern.execution?.targetR ?? 2;
  const managementFamily = signal.managementFamily ?? "fixed";
  const historicalReplay = data.mode === "research_replay" || signal.historicalReplay;
  const benchmark = pattern.historicalBenchmark;
  const historicalEvidence = pattern.historicalEvidence;
  const provenance = pattern.registrationProvenance;
  const reviewedExecutionApplies = pattern.executionReview?.status === "reviewed_active"
    && signal.eventTime >= pattern.executionReview.activatedAt;
  const reviewedLater = reviewedExecutionApplies ? pattern.executionReview?.later : null;
  const benchmarkAverage = typeof historicalEvidence?.averageGrossR === "number"
    ? historicalEvidence.averageGrossR
    : typeof reviewedLater?.averageR === "number" ? reviewedLater.averageR : benchmark?.walkForwardAverageR;
  const benchmarkTargetRate = typeof historicalEvidence?.targetHitRate === "number"
    ? historicalEvidence.targetHitRate
    : typeof reviewedLater?.tpBeforeSl === "number" ? reviewedLater.tpBeforeSl : benchmark?.targetFirstRate;
  const benchmarkStopRate = typeof historicalEvidence?.stopHitRate === "number"
    ? historicalEvidence.stopHitRate
    : benchmark?.stopFirstRate;
  const benchmarkSample = typeof historicalEvidence?.evaluableCount === "number"
    ? historicalEvidence.evaluableCount
    : typeof reviewedLater?.evaluableN === "number" ? reviewedLater.evaluableN : benchmark?.walkForwardN;
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
  const frozenTargetPath = targetLadder.find((row) => Math.abs(row.targetR - targetR) < .000001) ?? null;
  const reactionProfile = pattern.reactionAudit?.profile;
  const historicalContractEvidence = reactionProfile?.targetEvidenceContracts?.find(({ execution }) =>
    Math.abs(execution.stopAtr - stopAtr) < .000001
    && Math.abs(execution.targetR - targetR) < .000001
    && execution.expiryCandles === signal.expiryCandles
    && execution.managementFamily === managementFamily
    && (execution.managementFamily !== "break_even" || Math.abs((execution.managementTriggerR ?? 1) - (signal.managementTriggerR ?? 1)) < .000001)
  )?.evidence;
  const registeredTargetEvidence = historicalContractEvidence ?? (
    reactionProfile?.targetEvidence && Math.abs(reactionProfile.targetEvidence.targetR - targetR) < .000001
      ? reactionProfile.targetEvidence : null
  );
  const targetEvidenceLabel = registeredTargetEvidence?.label === "rare_outsized_wins"
    ? "Positive average depends on infrequent large wins"
    : registeredTargetEvidence?.label === "not_supported"
      ? "Large target not supported by later paths"
      : registeredTargetEvidence?.label === "historically_supported"
        ? "Historically reached often enough for positive gross expectancy"
        : benchmarkAverage == null || benchmarkTargetRate == null
    ? "Historical support unavailable"
    : benchmarkAverage <= 0
      ? "Large target not supported by later paths"
      : targetR >= 3 && benchmarkTargetRate < simpleBreakEven
        ? "Positive average depends on infrequent large wins"
        : "Historically reached often enough for positive gross expectancy";
  const marketContext = signal.marketContext;
  const contextOverlay = signal.contextOverlay;
  const selectedContextCandidate = pattern.reactionAudit?.profile?.contextResearch?.selectedCandidate ?? null;
  const selectedContextMatches = selectedContextCandidate
    ? marketContextValue(signal, selectedContextCandidate.dimension) === selectedContextCandidate.value
    : false;
  const directionalBarrier = marketContext?.supportResistance.directionalBarrier;
  const h4DirectionalZones = (signal.direction === "long"
    ? marketContext?.supportResistance.resistances
    : marketContext?.supportResistance.supports) ?? (directionalBarrier ? [directionalBarrier] : []);
  const higherStructure = marketContext?.supportResistance.higherTimeframes;
  const directionalZones = [
    ...h4DirectionalZones.map((zone) => ({ ...zone, timeframe: zone.timeframe ?? "H4" as const })),
    ...(["D1", "W1"] as const).flatMap((timeframe) => (signal.direction === "long"
      ? higherStructure?.[timeframe].resistances
      : higherStructure?.[timeframe].supports) ?? []),
  ].sort((left, right) => left.distanceAtr - right.distanceAtr);
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
          <small>{formatUtc(signal.eventTime)} · {signal.observationMode?.replaceAll("_", " ") ?? (historicalReplay ? "historical replay" : "current")}</small>
        </div>
        <button type="button" onClick={data.onClose} aria-label="Close macro bias audit"><X size={15} /></button>
      </header>

      <table className="chart-macro-bias-audit-table" aria-label="Past result audit table">
        <colgroup><col className="is-field" /><col className="is-value" /><col className="is-detail" /></colgroup>
        <thead><tr><th>Field</th><th>Value</th><th>Details</th></tr></thead>
        <tbody>
          <tr className="is-section"><th colSpan={3}>Result</th></tr>
          <tr><th>Direction and result</th><td>{signal.direction === "long" ? "Long" : "Short"} {market}</td><td>{formatOutcome(signal)}</td></tr>
          <tr><th>Lifecycle</th><td>{lifecycle.state}</td><td>{lifecycle.detail}</td></tr>
          <tr><th>Entry</th><td>{formatPrice(signal.entry, market)}</td><td>{signal.entryTimeframe ?? "H4"} · {formatUtc(signal.activationTime)} · The chart arrow marks the activation candle; its vertical placement is visual only. The exact frozen entry is {formatPrice(signal.entry, market)}.</td></tr>
          <tr className="is-risk"><th>Stop loss</th><td>{formatPrice(frozenStop, market)}</td><td>{riskPips == null ? "—" : `${riskPips.toFixed(1)} pips`} · {formatAtr(riskAtr)} · −1R{signal.breakEvenArmed ? ` · current stop moved to ${formatPrice(signal.stop, market)}` : ""}</td></tr>
          <tr className="is-reward"><th>Take profit</th><td>{formatPrice(signal.target, market)}</td><td>{rewardPips == null ? "—" : `${rewardPips.toFixed(1)} pips`} · {formatAtr(rewardAtr)} · +{targetR}R</td></tr>
          <tr><th>Risk : reward</th><td>1 : {targetR}</td><td>Frozen registered contract</td></tr>
          <tr><th>ATR at entry</th><td>{formatPrice(signal.atr, market)}{atrPips == null ? "" : ` · ${atrPips.toFixed(1)} pips`}</td><td>Completed H4 ATR(14)</td></tr>
          <tr><th>Maximum duration</th><td>{signal.expiryCandles} H4</td><td>Expires {formatUtc(signal.expiryTime)}</td></tr>
          <tr><th>Management</th><td>{managementFamily === "break_even" ? "Break-even" : "Fixed"}</td><td>{managementFamily === "break_even" ? `Move SL to entry after +${signal.managementTriggerR ?? 1}R` : "SL and TP stay fixed"}</td></tr>

          <tr className="is-section"><th colSpan={3}>Initial price reaction</th></tr>
          <tr><th>After the first completed H4</th><td>{initialReaction == null ? data.detailLoading ? "Loading path audit…" : "Not recorded for this arrow" : initialReactionFollowed ? "Price followed the arrow" : "Price opposed the arrow"}</td><td>{initialReaction == null ? "No reaction value is inferred." : `${formatR(initialReaction.responseR)}${initialReactionPips == null ? "" : ` · ${formatPips(initialReactionPips)}`} · measured after 1 H4`}</td></tr>
          <tr><th>After {signal.pathAudit?.reactionHorizonCandles ?? 6} H4</th><td>{formatR(signal.pathAudit?.reactionResponseR)}</td><td>{signal.pathAudit?.directionWorked == null ? "Direction unavailable" : signal.pathAudit.directionWorked ? "Direction worked" : "Direction did not work"}</td></tr>
          <tr><th>Best favorable move</th><td>{formatR(signal.pathAudit?.maximumFavorableR)}</td><td>{formatPips(signal.pathAudit?.maximumFavorablePips)} · after {signal.pathAudit?.timeToMfeCandles ?? "—"} H4 · not realized profit</td></tr>
          <tr><th>Worst open pressure</th><td>{signal.pathAudit ? formatR(-signal.pathAudit.maximumAdverseR) : "—"}</td><td>{signal.pathAudit ? formatPips(-signal.pathAudit.maximumAdversePips) : "—"} · after {signal.pathAudit?.timeToMaeCandles ?? "—"} H4</td></tr>
          <tr><th>Frozen trade result</th><td>{formatOutcome(signal)}</td><td>Reaction versus trade result{signal.pathAudit?.givebackR == null ? "" : ` · ${formatR(signal.pathAudit.givebackR)} given back from the best open point`}</td></tr>

          <tr className="is-section"><th colSpan={3}>Why the arrow appeared</th></tr>
          <tr><th>Release package</th><td>{signalEvents.length > 0 ? `${signalEvents.length} release${signalEvents.length === 1 ? "" : "s"} matched this setup` : data.detailLoading ? "Loading…" : "Registered event package"}</td><td>{pattern.condition}</td></tr>
          {signalEvents.map((event, index) => <tr key={`${event.title}:${index}`}><th>{event.title}</th><td>A {event.actual || "?"} · F {event.forecast || "?"} · P {event.previous || "?"}</td><td>{event.currency ?? "?"}/{event.countryCode ?? "?"} · Surprise score {formatSignedNumber(event.surprisePoint)} · Momentum score {formatSignedNumber(event.momentumPoint)} · Score {formatSignedNumber(event.score)}{event.forecastSuspect ? " · forecast excluded by guard" : ""}</td></tr>)}
          {data.detailError ? <tr className="is-error"><th>Frozen detail</th><td>Unavailable</td><td>Full frozen detail is unavailable: {data.detailError}. Provisional Entry/SL/TP geometry remains visible. {data.onRetryDetail ? <button type="button" onClick={data.onRetryDetail}>Retry detail</button> : null}</td></tr> : null}

          <tr className="is-section"><th colSpan={3}>Why this target was plausible historically</th></tr>
          <tr><th>Assessment</th><td>{targetEvidenceLabel}</td><td>A large configured target does not itself predict a large move.</td></tr>
          <tr><th>Registered target</th><td>+{targetR}R</td><td>{formatAtr(rewardAtr)}</td></tr>
          <tr><th>Later TP-before-SL</th><td>{formatPercent(registeredTargetEvidence?.tpBeforeSl ?? benchmarkTargetRate)}</td><td>{registeredTargetEvidence?.evaluableN ?? benchmarkSample ?? "—"} later cases</td></tr>
          <tr><th>Later average</th><td>{formatR(registeredTargetEvidence?.averageR ?? benchmarkAverage)}</td><td>Gross per matching trade</td></tr>
          <tr><th>TP rate needed</th><td>{formatPercent(simpleBreakEven)}</td><td>Simple fixed-boundary reference</td></tr>
          <tr><th>Typical best move</th><td>{formatR(registeredTargetEvidence?.mfeR.median ?? reactionProfile?.mfe.r.median)}</td><td>Median MFE · hindsight, not captured profit</td></tr>
          <tr><th>This arrow</th><td>{frozenTargetPath ? targetPathStatus(frozenTargetPath) : formatOutcome(signal)}</td><td>{frozenTargetPath?.timeToTargetCandles == null ? "Frozen path result" : `${frozenTargetPath.timeToTargetCandles} H4 to target`}</td></tr>
          {registeredTargetEvidence ? <tr><th>Payoff dependence</th><td>Median {formatR(registeredTargetEvidence.medianR)}</td><td>SL first {formatPercent(registeredTargetEvidence.slBeforeTp)} · expired {formatPercent(registeredTargetEvidence.expiredRate)} · largest win share {formatPercent(registeredTargetEvidence.topOneWinShare)} · top three {formatPercent(registeredTargetEvidence.topThreeWinShare)} · typical target time {registeredTargetEvidence.timeToTargetH4.median == null ? "—" : `${registeredTargetEvidence.timeToTargetH4.median.toFixed(1)} H4`}</td></tr> : null}

          {directionalZones.length > 0 ? <tr className="is-section"><th colSpan={3}>Multi-scale price structure toward target</th></tr> : null}
          {directionalZones.map((zone, index) => {
            const distanceR = riskAtr && riskAtr > 0 ? zone.distanceAtr / riskAtr : null;
            const zonePips = signal.atr == null ? null : zone.distanceAtr * signal.atr / pipSize(market);
            const beforeTarget = rewardAtr != null && zone.distanceAtr < rewardAtr;
            return <tr key={zone.id ?? `${zone.kind}:${zone.level}:${index}`}><th>{index === 0 ? "Nearest" : `Wider ${index + 1}`} · {zone.timeframe ?? "H4"} {zone.kind}</th><td>{formatPrice(zone.level, market)}</td><td>{zonePips == null ? "—" : `${zonePips.toFixed(1)} pips`} · {zone.distanceAtr.toFixed(2)} ATR · {distanceR == null ? "—" : `${distanceR.toFixed(2)}R`} · {beforeTarget ? "Before frozen TP" : "Beyond frozen TP"} · {zone.touches} touches · {readableContext(zone.strength)} · confirmed {zone.confirmedAt == null ? "legacy record" : formatUtc(zone.confirmedAt)} · later outcome {readableContext(zone.postEntryState)}</td></tr>;
          })}

          {marketContext ? <tr className="is-section"><th colSpan={3}>Context known before entry</th></tr> : null}
          {marketContext ? <tr><th>Context decision</th><td>{contextOverlay?.executionApplied ? "Reviewed context contract used" : contextOverlay?.matched ? "Historical context match" : contextOverlay ? "Parent setup retained" : "Research comparison"}</td><td>Uses completed candles and economic evidence available no later than entry.</td></tr> : null}
          {contextOverlay ? <tr><th>{contextOverlay.registrationId}</th><td>{contextOverlay.matched ? "Context matched" : "Context did not match"}</td><td>Rule: {readableContext(contextOverlay.condition.dimension)} must be {readableContext(contextOverlay.condition.value)}. At this entry it was {readableContext(contextOverlay.observedValue)}. {contextOverlay.executionApplied ? `Used SL ${contextOverlay.contextExecution.stopAtr} ATR, TP ${contextOverlay.contextExecution.targetR}R, maximum ${contextOverlay.contextExecution.expiryCandles} H4.` : contextOverlay.matched ? "The original parent result is preserved because the context model was not active then." : "The parent arrow and execution contract were retained."}</td></tr> : null}
          {contextOverlay ? <tr><th>Context evidence</th><td>{formatR(typeof contextOverlay.later?.averageR === "number" ? contextOverlay.later.averageR : null)}</td><td>{typeof contextOverlay.later?.evaluableN === "number" ? contextOverlay.later.evaluableN : "—"} later trades · parent {formatR(typeof contextOverlay.parentOnSameContextLater?.averageR === "number" ? contextOverlay.parentOnSameContextLater.averageR : null)} · followed after 6 H4 {formatPercent(typeof contextOverlay.reaction?.alignmentRate === "number" ? contextOverlay.reaction.alignmentRate : null)}</td></tr> : null}
          {contextRows.map((row) => {
            const history = contextHistory(pattern, row.dimension, row.value);
            return <tr key={row.dimension}><th>{row.label}</th><td>{readableContext(row.value)}</td><td>{row.detail} · {history ? `${history.laterReaction.evaluableN} later cases · ${formatPercent(history.laterReaction.alignmentRate)} followed after 6 H4` : "No stable setup-specific comparison yet"}</td></tr>;
          })}
          {!contextOverlay && selectedContextCandidate ? <tr><th>Development-selected context challenger</th><td>{readableContext(selectedContextCandidate.dimension)} = {readableContext(selectedContextCandidate.value)}</td><td>{selectedContextMatches ? "This arrow matches" : "This arrow does not match"} · later audit {selectedContextCandidate.status === "later_supported" ? "supported" : "rejected"} · {selectedContextCandidate.laterReaction.evaluableN} cases · {formatPercent(selectedContextCandidate.laterReaction.alignmentRate)} followed after 6 H4 · average {formatR(selectedContextCandidate.laterExecution.averageR)} · versus parent {formatR(selectedContextCandidate.laterExecutionUpliftR)}</td></tr> : null}
          {marketContext ? <tr><th>Contract boundary</th><td>Setup-specific only</td><td>A reviewed match can change only this exact setup&apos;s contract; it never creates a duplicate arrow or reverses the economic direction.</td></tr> : null}

          {signal.entry != null || signal.stop != null || signal.target != null ? <tr className="is-section"><th colSpan={3}>Trade geometry</th></tr> : null}
          {signal.entry != null || signal.stop != null || signal.target != null ? <tr><th>ATR(14) at entry</th><td>{formatPrice(signal.atr, market)}{atrPips == null ? "" : ` · ${atrPips.toFixed(1)} pips`}</td><td>One typical H4 range used to size this frozen setup</td></tr> : null}
          {signal.entry != null || signal.stop != null || signal.target != null ? <tr className="is-entry"><th>Entry</th><td>{formatPrice(signal.entry, market)}</td><td>0 pips · 0R · first strictly later H4 open</td></tr> : null}
          {signal.entry != null || signal.stop != null || signal.target != null ? <tr className="is-risk"><th>SL</th><td>{formatPrice(frozenStop, market)}</td><td>{riskPips == null ? "—" : `${riskPips.toFixed(1)} pips`} · {formatAtr(riskAtr)} · −1R · frozen maximum loss before costs</td></tr> : null}
          {targetLadder.length > 0 ? targetLadder.map((row) => {
            const frozen = Math.abs(row.targetR - targetR) < .000001;
            return <tr key={row.targetR} className={frozen ? "is-reward is-frozen-target" : "is-target-option"}><th>{frozen ? "Frozen TP" : "TP option"} · {row.targetR}R</th><td>{formatPrice(row.targetPrice, market)}</td><td>{Number.isFinite(row.distancePips) ? `${row.distancePips.toFixed(1)} pips` : "—"} · {Number.isFinite(row.distanceAtr) ? `${row.distanceAtr.toFixed(2)} ATR` : "—"} · +{row.targetR}R · {targetPathStatus(row)}</td></tr>;
          }) : signal.entry != null || signal.stop != null || signal.target != null ? <tr className="is-reward"><th>Frozen TP · {targetR}R</th><td>{formatPrice(signal.target, market)}</td><td>{rewardPips == null ? "—" : `${rewardPips.toFixed(1)} pips`} · {formatAtr(rewardAtr)} · +{targetR}R · frozen take-profit reward</td></tr> : null}
          {signal.entry != null || signal.stop != null || signal.target != null ? <tr><th>Target-path rule</th><td>Frozen TP is official</td><td>Other TP rows are hindsight path research, not partial exits or captured profit.</td></tr> : null}

          <tr className="is-section"><th colSpan={3}>What happened · Release to frozen result</th></tr>
          <tr><th>1 · Economic release</th><td>{formatUtc(signal.eventTime)}</td><td>Scheduled event time</td></tr>
          {signal.releaseObservationQuote ? <tr><th>2 · First FMS-observed post-release quote</th><td>{formatUtc(signal.releaseObservationQuote.quoteTime)}</td><td>bid {formatPrice(signal.releaseObservationQuote.bid, market)} · ask {formatPrice(signal.releaseObservationQuote.ask, market)} · {signal.entryTimingAudit?.quoteDelaySeconds ?? signal.releaseObservationQuote.entryLagSeconds}s after scheduled release · observed quote, not a fill</td></tr> : null}
          <tr><th>{signal.releaseObservationQuote ? "3" : "2"} · Frozen H4 trade activated</th><td>{formatUtc(signal.activationTime)}</td><td>First strictly later registered entry candle</td></tr>
          {signal.pathAudit ? <tr><th>{signal.releaseObservationQuote ? "4" : "3"} · Best favorable move</th><td>{formatR(signal.pathAudit.maximumFavorableR)}</td><td>{formatPips(signal.pathAudit.maximumFavorablePips)} · after {signal.pathAudit.timeToMfeCandles ?? "—"} H4</td></tr> : null}
          <tr><th>{lifecycle.resolved ? "Frozen trade closed" : "Current lifecycle"}</th><td>{formatOutcome(signal)}</td><td>{resultPips == null ? "" : `${formatPips(resultPips)} · `}held {formatHoldingCandles(signal.activationTime, timelineEnd)} · {signal.exitTime == null ? lifecycle.state : formatUtc(signal.exitTime)}</td></tr>
          <tr><th>Release-time limitation</th><td>Prospective research only</td><td>Historical rows without a first-seen quote cannot prove an executable release price; the frozen result uses the first strictly later H4 open.</td></tr>

          {signal.entryTimingAudit ? <tr className="is-section"><th colSpan={3}>Entry timing research · Observed MT5 data</th></tr> : null}
          {signal.entryTimingAudit ? <tr><th>First observed quote</th><td>{formatUtc(signal.entryTimingAudit.quoteTime)} · {formatPrice(signal.entryTimingAudit.observedMid, market)}</td><td>{signal.entryTimingAudit.quoteDelaySeconds}s after release</td></tr> : null}
          {signal.entryTimingAudit?.entries.map((row) => <tr key={row.timeframe}><th>First later {row.timeframe} open</th><td>{row.entryTime == null ? "Waiting" : `${formatUtc(row.entryTime)} · ${formatPrice(row.entryOpen, market)}`}</td><td>{row.status === "quote_captured_after_entry" ? "Quote arrived too late to compare" : row.status === "waiting_for_candle" ? "Not formed yet" : `${formatPips(row.gapPips)} raw · ${formatPips(row.directionAdjustedGapPips)} with arrow`}</td></tr>)}
          {signal.entryTimingAudit ? <tr><th>Entry timing disclosure</th><td>Research only</td><td>{signal.entryTimingAudit.disclosure}</td></tr> : null}

          {signal.pathAudit ? <tr className="is-section"><th colSpan={3}>Detailed reaction path · Reaction versus trade result</th></tr> : null}
          {signal.pathAudit ? <tr><th>Registered mapping</th><td>{signal.pathAudit.evidenceReaction === "rejected" ? "Rejects evidence" : "Follows evidence"}</td><td>Economic evidence-to-direction mapping</td></tr> : null}
          {signal.pathAudit ? <tr><th>Direction after {signal.pathAudit.reactionHorizonCandles} H4</th><td>{signal.pathAudit.directionWorked == null ? "Unavailable" : signal.pathAudit.directionWorked ? "Worked" : "Did not work"}</td><td>{formatR(signal.pathAudit.reactionResponseR)}</td></tr> : null}
          {signal.pathAudit ? <tr><th>Best favorable move</th><td>{formatR(signal.pathAudit.maximumFavorableR)}</td><td>{formatPips(signal.pathAudit.maximumFavorablePips)} · after {signal.pathAudit.timeToMfeCandles ?? "—"} H4 · not realized profit</td></tr> : null}
          {signal.pathAudit ? <tr><th>Worst open pressure</th><td>{formatR(-signal.pathAudit.maximumAdverseR)}</td><td>{formatPips(-signal.pathAudit.maximumAdversePips)} · after {signal.pathAudit.timeToMaeCandles ?? "—"} H4</td></tr> : null}
          {signal.pathAudit ? <tr><th>Final frozen trade</th><td>{formatOutcome(signal)}</td><td>{signal.pathAudit.givebackR == null ? "Frozen contract result" : `${formatR(signal.pathAudit.givebackR)} given back from the best open point`}</td></tr> : null}
          {signal.pathAudit && signal.pathAudit.maximumFavorableR >= .5 && (signal.resultR ?? 0) < 0 ? <tr><th>Why reaction and result differ</th><td>Price initially followed</td><td>It did not reach this setup&apos;s TP before reversing into its SL. Best favorable move is hindsight path evidence, not captured profit.</td></tr> : null}
          {(signal.pathAudit?.lossReview ?? []).map((reason) => <tr key={reason}><th>Loss-path observations</th><td>{reason === "favourable_then_giveback" ? "Favourable move, then giveback" : reason === "target_not_reached_before_close" ? "Target was not reached before close" : reason === "adverse_before_best_favourable_move" ? "Adverse move came before the best favourable point" : reason === "direction_not_working_at_six_h4" ? "Direction was not working at six H4" : "Maximum duration ended negative"}</td><td>Recorded path classification</td></tr>)}
          {signal.pathAudit?.fixedHorizonResponses.map((row) => <tr key={row.holdingCandles}><th>Fixed horizon · {row.holdingCandles} H4</th><td>{formatR(row.responseR)}</td><td>Direction-adjusted response</td></tr>)}

          {benchmark || historicalEvidence ? <tr className="is-section"><th colSpan={3}>Historical performance of this exact setup</th></tr> : null}
          {benchmark || historicalEvidence ? <tr><th>Evidence source</th><td>{historicalEvidence?.sourceId ?? benchmark?.experimentId ?? "—"}</td><td>{historicalEvidence?.scope ?? "Registered historical benchmark"}</td></tr> : null}
          {benchmark || historicalEvidence ? <tr><th>Average per trade</th><td>{formatR(benchmarkAverage)}</td><td>Gross · {benchmarkSample ?? "—"} later test trades</td></tr> : null}
          {benchmark || historicalEvidence ? <tr><th>TP before SL</th><td>{formatPercent(benchmarkTargetRate)}</td><td>{historicalEvidence?.targetHitCount == null ? "Rate recorded without exact count" : `${historicalEvidence.targetHitCount} / ${historicalEvidence.evaluableCount}`}</td></tr> : null}
          {benchmark || historicalEvidence ? <tr><th>SL before TP</th><td>{formatPercent(benchmarkStopRate)}</td><td>{historicalEvidence?.stopHitCount == null ? "Rate recorded without exact count" : `${historicalEvidence.stopHitCount} / ${historicalEvidence.evaluableCount}`}</td></tr> : null}
          {historicalEvidence ? <tr><th>Other outcomes</th><td>Expired {historicalEvidence.expiredCount ?? "—"} · Break-even {historicalEvidence.breakEvenCount ?? "—"}</td><td>Ambiguous {historicalEvidence.ambiguousCount ?? "—"} · Unevaluable {historicalEvidence.unevaluableCount ?? "—"}</td></tr> : null}
          {benchmark ? <tr><th>All matching events</th><td>{benchmark.historicalN}</td><td>Later TP rate needed {formatPercent(simpleBreakEven)}</td></tr> : null}
          {pattern.reactionAudit ? <tr><th>Direction worked after {pattern.reactionAudit.horizonCandles} H4</th><td>{formatPercent(pattern.reactionAudit.positiveResponseRate)}</td><td>Worked, but trade lost {pattern.reactionAudit.directionWorkedTradeLost} / {pattern.reactionAudit.evaluableN}</td></tr> : null}
          {pattern.reactionAudit ? <tr><th>Different measurements:</th><td>Direction versus final trade</td><td>Direction checks the registered price response after {pattern.reactionAudit.horizonCandles} H4 candles. Final result uses this setup&apos;s exact SL, TP, and maximum duration.</td></tr> : null}
          {benchmark || historicalEvidence ? <tr><th>Trade rules used in this test</th><td>SL {stopAtr} ATR · TP {targetR}R = {stopAtr * targetR} ATR</td><td>maximum {signal.expiryCandles} H4 candles{signal.managementFamily === "break_even" ? ` · move SL to entry after a completed H4 reaches +${signal.managementTriggerR ?? 1}R` : ""}</td></tr> : null}
          {reviewedExecutionApplies ? <tr><th>Reviewed execution contract</th><td>Verified</td><td>{pattern.executionReview?.reason} Historical result remains gross and is not live validation.</td></tr> : null}
          {provenance ? <tr><th>{provenanceLabel(provenance.status)}</th><td>{provenance.status}</td><td>{provenance.note}</td></tr> : null}
          {!benchmark && !historicalEvidence ? <tr className="is-warning"><th>Historical setup</th><td>No linked backtest record</td><td>This older setup is retained for audit, but exact historical performance is unavailable here.</td></tr> : null}

          <tr className="is-section"><th colSpan={3}>Important</th></tr>
          <tr><th>Result scope</th><td>Gross, local, hypothetical</td><td>Gross results exclude spread, slippage, swap, and commission. {historicalReplay ? "This past arrow is hindsight and was not available in real time." : "This release matched a registered FMS setup."} No order is sent to MT5.</td></tr>
          <tr><th>Recorded source</th><td>{data.modelId} · {data.modelHash.slice(0, 10)}</td><td>{data.datasetFingerprint ? `Data ${data.datasetFingerprint.slice(0, 10)}` : "No dataset fingerprint recorded"}</td></tr>
        </tbody>
      </table>
    </aside>
  );
}
