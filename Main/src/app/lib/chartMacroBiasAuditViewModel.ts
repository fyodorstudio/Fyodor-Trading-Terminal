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

export type ChartMacroBiasAuditRow =
  | { kind: "section"; label: string }
  | { kind: "data"; field: string; value: string; details: string; tone?: "entry" | "risk" | "reward" | "error" | "warning"; action?: "retry-detail" };

export interface ChartMacroBiasAuditViewModel {
  ariaLabel: string;
  kicker: string;
  title: string;
  subtitle: string;
  rows: ChartMacroBiasAuditRow[];
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

export function buildChartMacroBiasAuditViewModel(data: ChartMacroBiasAuditData): ChartMacroBiasAuditViewModel {
  const { signal, pattern } = data;
  const rows: ChartMacroBiasAuditRow[] = [];
  const section = (label: string) => rows.push({ kind: "section", label });
  const row = (field: string, value: string, details: string, options?: Pick<Extract<ChartMacroBiasAuditRow, { kind: "data" }>, "tone" | "action">) => rows.push({ kind: "data", field, value, details, ...options });
  const market = pattern.market ?? data.symbol ?? "EURUSD";
  const stopAtr = signal.stopAtr ?? pattern.execution?.stopAtr ?? 1;
  const targetR = signal.targetR ?? pattern.execution?.targetR ?? 2;
  const managementFamily = signal.managementFamily ?? "fixed";
  const historicalReplay = data.mode === "research_replay" || signal.historicalReplay;
  const benchmark = pattern.historicalBenchmark;
  const historicalEvidence = pattern.historicalEvidence;
  const provenance = pattern.registrationProvenance;
  const reviewedExecutionApplies = pattern.executionReview?.status === "reviewed_active" && signal.eventTime >= pattern.executionReview.activatedAt;
  const reviewedLater = reviewedExecutionApplies ? pattern.executionReview?.later : null;
  const benchmarkAverage = historicalEvidence?.averageGrossR ?? (typeof reviewedLater?.averageR === "number" ? reviewedLater.averageR : benchmark?.walkForwardAverageR);
  const benchmarkTargetRate = historicalEvidence?.targetHitRate ?? (typeof reviewedLater?.tpBeforeSl === "number" ? reviewedLater.tpBeforeSl : benchmark?.targetFirstRate);
  const benchmarkStopRate = historicalEvidence?.stopHitRate ?? benchmark?.stopFirstRate;
  const benchmarkSample = historicalEvidence?.evaluableCount ?? (typeof reviewedLater?.evaluableN === "number" ? reviewedLater.evaluableN : benchmark?.walkForwardN);
  const lifecycle = lifecycleCopy(signal);
  const simpleBreakEven = 1 / (1 + targetR);
  const initialReaction = signal.pathAudit?.fixedHorizonResponses.find((item) => item.holdingCandles === 1) ?? null;
  const initialReactionPips = initialReaction && signal.atr != null ? initialReaction.responseR * stopAtr * signal.atr / pipSize(market) : null;
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
  const frozenTargetPath = targetLadder.find((item) => Math.abs(item.targetR - targetR) < .000001) ?? null;
  const reactionProfile = pattern.reactionAudit?.profile;
  const historicalContractEvidence = reactionProfile?.targetEvidenceContracts?.find(({ execution }) =>
    Math.abs(execution.stopAtr - stopAtr) < .000001
    && Math.abs(execution.targetR - targetR) < .000001
    && execution.expiryCandles === signal.expiryCandles
    && execution.managementFamily === managementFamily
    && (execution.managementFamily !== "break_even" || Math.abs((execution.managementTriggerR ?? 1) - (signal.managementTriggerR ?? 1)) < .000001)
  )?.evidence;
  const registeredTargetEvidence = historicalContractEvidence ?? (reactionProfile?.targetEvidence && Math.abs(reactionProfile.targetEvidence.targetR - targetR) < .000001 ? reactionProfile.targetEvidence : null);
  const targetEvidenceLabel = registeredTargetEvidence?.label === "rare_outsized_wins" ? "Positive average depends on infrequent large wins"
    : registeredTargetEvidence?.label === "not_supported" ? "Large target not supported by later paths"
      : registeredTargetEvidence?.label === "historically_supported" ? "Historically reached often enough for positive gross expectancy"
        : benchmarkAverage == null || benchmarkTargetRate == null ? "Historical support unavailable"
          : benchmarkAverage <= 0 ? "Large target not supported by later paths"
            : targetR >= 3 && benchmarkTargetRate < simpleBreakEven ? "Positive average depends on infrequent large wins"
              : "Historically reached often enough for positive gross expectancy";
  const marketContext = signal.marketContext;
  const contextOverlay = signal.contextOverlay;
  const selectedContextCandidate = pattern.reactionAudit?.profile?.contextResearch?.selectedCandidate ?? null;
  const selectedContextMatches = selectedContextCandidate ? marketContextValue(signal, selectedContextCandidate.dimension) === selectedContextCandidate.value : false;
  const directionalBarrier = marketContext?.supportResistance.directionalBarrier;
  const h4DirectionalZones = (signal.direction === "long" ? marketContext?.supportResistance.resistances : marketContext?.supportResistance.supports) ?? (directionalBarrier ? [directionalBarrier] : []);
  const higherStructure = marketContext?.supportResistance.higherTimeframes;
  const directionalZones = [
    ...h4DirectionalZones.map((zone) => ({ ...zone, timeframe: zone.timeframe ?? "H4" as const })),
    ...(["D1", "W1"] as const).flatMap((timeframe) => (signal.direction === "long" ? higherStructure?.[timeframe].resistances : higherStructure?.[timeframe].supports) ?? []),
  ].sort((left, right) => left.distanceAtr - right.distanceAtr);
  const directionalRoomDetail = marketContext?.supportResistance.directionalRoomAtr == null ? "No confirmed opposing H4 zone"
    : `${marketContext.supportResistance.directionalRoomAtr.toFixed(2)} ATR to ${directionalBarrier?.strength ?? "confirmed"} ${directionalBarrier?.kind ?? "zone"}${directionalBarrier ? ` at ${formatPrice(directionalBarrier.level, market)} · ${directionalBarrier.touches} touches` : ""}`;
  const contextRows = marketContext ? [
    { label: "Price regime", dimension: "priceRegime" as const, value: marketContext.price.regime, detail: `${readableContext(marketContext.price.relationToSignal)} with arrow` },
    { label: "Volatility", dimension: "volatilityRegime" as const, value: marketContext.volatility.regime, detail: marketContext.volatility.percentile == null ? `${marketContext.volatility.priorCount} prior ATR observations` : ordinalPercentile(marketContext.volatility.percentile) },
    { label: "Room toward target", dimension: "directionalRoom" as const, value: marketContext.supportResistance.roomState, detail: directionalRoomDetail },
    { label: "Economic background", dimension: "macroBackground" as const, value: marketContext.macroBackground.relationToSignal, detail: `${marketContext.macroBackground.pairVote ?? 0} Before-window pair vote` },
  ] : [];

  section("Result");
  row("Direction and result", `${signal.direction === "long" ? "Long" : "Short"} ${market}`, formatOutcome(signal));
  row("Lifecycle", lifecycle.state, lifecycle.detail);
  row("Entry", formatPrice(signal.entry, market), `${signal.entryTimeframe ?? "H4"} · ${formatUtc(signal.activationTime)} · The chart arrow marks the activation candle; its vertical placement is visual only. The exact frozen entry is ${formatPrice(signal.entry, market)}.`, { tone: "entry" });
  row("Stop loss", formatPrice(frozenStop, market), `${riskPips == null ? "—" : `${riskPips.toFixed(1)} pips`} · ${formatAtr(riskAtr)} · −1R${signal.breakEvenArmed ? ` · current stop moved to ${formatPrice(signal.stop, market)}` : ""}`, { tone: "risk" });
  row("Take profit", formatPrice(signal.target, market), `${rewardPips == null ? "—" : `${rewardPips.toFixed(1)} pips`} · ${formatAtr(rewardAtr)} · +${targetR}R`, { tone: "reward" });
  row("Risk : reward", `1 : ${targetR}`, "Frozen registered contract");
  row("ATR at entry", `${formatPrice(signal.atr, market)}${atrPips == null ? "" : ` · ${atrPips.toFixed(1)} pips`}`, "Completed H4 ATR(14)");
  row("Maximum duration", `${signal.expiryCandles} H4`, `Expires ${formatUtc(signal.expiryTime)}`);
  row("Management", managementFamily === "break_even" ? "Break-even" : "Fixed", managementFamily === "break_even" ? `Move SL to entry after +${signal.managementTriggerR ?? 1}R` : "SL and TP stay fixed");

  section("Initial price reaction");
  row("After the first completed H4", initialReaction == null ? data.detailLoading ? "Loading path audit…" : "Not recorded for this arrow" : initialReactionFollowed ? "Price followed the arrow" : "Price opposed the arrow", initialReaction == null ? "No reaction value is inferred." : `${formatR(initialReaction.responseR)}${initialReactionPips == null ? "" : ` · ${formatPips(initialReactionPips)}`} · measured after 1 H4`);
  row(`After ${signal.pathAudit?.reactionHorizonCandles ?? 6} H4`, formatR(signal.pathAudit?.reactionResponseR), signal.pathAudit?.directionWorked == null ? "Direction unavailable" : signal.pathAudit.directionWorked ? "Direction worked" : "Direction did not work");
  row("Best favorable move", formatR(signal.pathAudit?.maximumFavorableR), `${formatPips(signal.pathAudit?.maximumFavorablePips)} · after ${signal.pathAudit?.timeToMfeCandles ?? "—"} H4 · not realized profit`);
  row("Worst open pressure", signal.pathAudit ? formatR(-signal.pathAudit.maximumAdverseR) : "—", `${signal.pathAudit ? formatPips(-signal.pathAudit.maximumAdversePips) : "—"} · after ${signal.pathAudit?.timeToMaeCandles ?? "—"} H4`);
  row("Frozen trade result", formatOutcome(signal), `Reaction versus trade result${signal.pathAudit?.givebackR == null ? "" : ` · ${formatR(signal.pathAudit.givebackR)} given back from the best open point`}`);

  section("Why the arrow appeared");
  row("Release package", signal.events.length > 0 ? `${signal.events.length} release${signal.events.length === 1 ? "" : "s"} matched this setup` : data.detailLoading ? "Loading…" : "Registered event package", pattern.condition ?? "Registered setup condition");
  signal.events.forEach((event) => row(event.title, `A ${event.actual || "?"} · F ${event.forecast || "?"} · P ${event.previous || "?"}`, `${event.currency ?? "?"}/${event.countryCode ?? "?"} · Surprise score ${formatSignedNumber(event.surprisePoint)} · Momentum score ${formatSignedNumber(event.momentumPoint)} · Score ${formatSignedNumber(event.score)}${event.forecastSuspect ? " · forecast excluded by guard" : ""}`));
  if (data.detailError) row("Frozen detail", "Unavailable", `Full frozen detail is unavailable: ${data.detailError}. Provisional Entry/SL/TP geometry remains visible.`, { tone: "error", action: data.onRetryDetail ? "retry-detail" : undefined });

  section("Why this target was plausible historically");
  row("Assessment", targetEvidenceLabel, "A large configured target does not itself predict a large move.");
  row("Registered target", `+${targetR}R`, formatAtr(rewardAtr));
  row("Later TP-before-SL", formatPercent(registeredTargetEvidence?.tpBeforeSl ?? benchmarkTargetRate), `${registeredTargetEvidence?.evaluableN ?? benchmarkSample ?? "—"} later cases`);
  row("Later average", formatR(registeredTargetEvidence?.averageR ?? benchmarkAverage), "Gross per matching trade");
  row("TP rate needed", formatPercent(simpleBreakEven), "Simple fixed-boundary reference");
  row("Typical best move", formatR(registeredTargetEvidence?.mfeR.median ?? reactionProfile?.mfe.r.median), "Median MFE · hindsight, not captured profit");
  row("This arrow", frozenTargetPath ? targetPathStatus(frozenTargetPath) : formatOutcome(signal), frozenTargetPath?.timeToTargetCandles == null ? "Frozen path result" : `${frozenTargetPath.timeToTargetCandles} H4 to target`);
  if (registeredTargetEvidence) row("Payoff dependence", `Median ${formatR(registeredTargetEvidence.medianR)}`, `SL first ${formatPercent(registeredTargetEvidence.slBeforeTp)} · expired ${formatPercent(registeredTargetEvidence.expiredRate)} · largest win share ${formatPercent(registeredTargetEvidence.topOneWinShare)} · top three ${formatPercent(registeredTargetEvidence.topThreeWinShare)} · typical target time ${registeredTargetEvidence.timeToTargetH4.median == null ? "—" : `${registeredTargetEvidence.timeToTargetH4.median.toFixed(1)} H4`}`);

  if (directionalZones.length) section("Multi-scale price structure toward target");
  directionalZones.forEach((zone, index) => {
    const distanceR = riskAtr && riskAtr > 0 ? zone.distanceAtr / riskAtr : null;
    const zonePips = signal.atr == null ? null : zone.distanceAtr * signal.atr / pipSize(market);
    row(`${index === 0 ? "Nearest" : `Wider ${index + 1}`} · ${zone.timeframe ?? "H4"} ${zone.kind}`, formatPrice(zone.level, market), `${zonePips == null ? "—" : `${zonePips.toFixed(1)} pips`} · ${zone.distanceAtr.toFixed(2)} ATR · ${distanceR == null ? "—" : `${distanceR.toFixed(2)}R`} · ${rewardAtr != null && zone.distanceAtr < rewardAtr ? "Before frozen TP" : "Beyond frozen TP"} · ${zone.touches} touches · ${readableContext(zone.strength)} · confirmed ${zone.confirmedAt == null ? "legacy record" : formatUtc(zone.confirmedAt)} · later outcome ${readableContext(zone.postEntryState)}`);
  });

  if (marketContext) {
    section("Context known before entry");
    row("Context decision", contextOverlay?.executionApplied ? "Reviewed context contract used" : contextOverlay?.matched ? "Historical context match" : contextOverlay ? "Parent setup retained" : "Research comparison", "Uses completed candles and economic evidence available no later than entry.");
    if (contextOverlay) {
      row(contextOverlay.registrationId, contextOverlay.matched ? "Context matched" : "Context did not match", `Rule: ${readableContext(contextOverlay.condition.dimension)} must be ${readableContext(contextOverlay.condition.value)}. At this entry it was ${readableContext(contextOverlay.observedValue)}. ${contextOverlay.executionApplied ? `Used SL ${contextOverlay.contextExecution.stopAtr} ATR, TP ${contextOverlay.contextExecution.targetR}R, maximum ${contextOverlay.contextExecution.expiryCandles} H4.` : contextOverlay.matched ? "The original parent result is preserved because the context model was not active then." : "The parent arrow and execution contract were retained."}`);
      row("Context evidence", formatR(typeof contextOverlay.later?.averageR === "number" ? contextOverlay.later.averageR : null), `${typeof contextOverlay.later?.evaluableN === "number" ? contextOverlay.later.evaluableN : "—"} later trades · parent ${formatR(typeof contextOverlay.parentOnSameContextLater?.averageR === "number" ? contextOverlay.parentOnSameContextLater.averageR : null)} · followed after 6 H4 ${formatPercent(typeof contextOverlay.reaction?.alignmentRate === "number" ? contextOverlay.reaction.alignmentRate : null)}`);
    }
    contextRows.forEach((context) => {
      const history = contextHistory(pattern, context.dimension, context.value);
      row(context.label, readableContext(context.value), `${context.detail} · ${history ? `${history.laterReaction.evaluableN} later cases · ${formatPercent(history.laterReaction.alignmentRate)} followed after 6 H4` : "No stable setup-specific comparison yet"}`);
    });
    if (!contextOverlay && selectedContextCandidate) row("Development-selected context challenger", `${readableContext(selectedContextCandidate.dimension)} = ${readableContext(selectedContextCandidate.value)}`, `${selectedContextMatches ? "This arrow matches" : "This arrow does not match"} · later audit ${selectedContextCandidate.status === "later_supported" ? "supported" : "rejected"} · ${selectedContextCandidate.laterReaction.evaluableN} cases · ${formatPercent(selectedContextCandidate.laterReaction.alignmentRate)} followed after 6 H4 · average ${formatR(selectedContextCandidate.laterExecution.averageR)} · versus parent ${formatR(selectedContextCandidate.laterExecutionUpliftR)}`);
    row("Contract boundary", "Setup-specific only", "A reviewed match can change only this exact setup's contract; it never creates a duplicate arrow or reverses the economic direction.");
  }

  const hasGeometry = signal.entry != null || signal.stop != null || signal.target != null;
  if (hasGeometry) {
    section("Trade geometry");
    row("ATR(14) at entry", `${formatPrice(signal.atr, market)}${atrPips == null ? "" : ` · ${atrPips.toFixed(1)} pips`}`, "One typical H4 range used to size this frozen setup");
    row("Entry", formatPrice(signal.entry, market), "0 pips · 0R · first strictly later H4 open", { tone: "entry" });
    row("SL", formatPrice(frozenStop, market), `${riskPips == null ? "—" : `${riskPips.toFixed(1)} pips`} · ${formatAtr(riskAtr)} · −1R · frozen maximum loss before costs`, { tone: "risk" });
    if (targetLadder.length) targetLadder.forEach((target) => row(`${Math.abs(target.targetR - targetR) < .000001 ? "Frozen TP" : "TP option"} · ${target.targetR}R`, formatPrice(target.targetPrice, market), `${Number.isFinite(target.distancePips) ? `${target.distancePips.toFixed(1)} pips` : "—"} · ${Number.isFinite(target.distanceAtr) ? `${target.distanceAtr.toFixed(2)} ATR` : "—"} · +${target.targetR}R · ${targetPathStatus(target)}`, Math.abs(target.targetR - targetR) < .000001 ? { tone: "reward" } : undefined));
    else row(`Frozen TP · ${targetR}R`, formatPrice(signal.target, market), `${rewardPips == null ? "—" : `${rewardPips.toFixed(1)} pips`} · ${formatAtr(rewardAtr)} · +${targetR}R · frozen take-profit reward`, { tone: "reward" });
    row("Target-path rule", "Frozen TP is official", "Other TP rows are hindsight path research, not partial exits or captured profit.");
  }

  section("What happened · Release to frozen result");
  row("1 · Economic release", formatUtc(signal.eventTime), "Scheduled event time");
  if (signal.releaseObservationQuote) row("2 · First FMS-observed post-release quote", formatUtc(signal.releaseObservationQuote.quoteTime), `bid ${formatPrice(signal.releaseObservationQuote.bid, market)} · ask ${formatPrice(signal.releaseObservationQuote.ask, market)} · ${signal.entryTimingAudit?.quoteDelaySeconds ?? signal.releaseObservationQuote.entryLagSeconds}s after scheduled release · observed quote, not a fill`);
  row(`${signal.releaseObservationQuote ? "3" : "2"} · Frozen H4 trade activated`, formatUtc(signal.activationTime), "First strictly later registered entry candle");
  if (signal.pathAudit) row(`${signal.releaseObservationQuote ? "4" : "3"} · Best favorable move`, formatR(signal.pathAudit.maximumFavorableR), `${formatPips(signal.pathAudit.maximumFavorablePips)} · after ${signal.pathAudit.timeToMfeCandles ?? "—"} H4`);
  row(lifecycle.resolved ? "Frozen trade closed" : "Current lifecycle", formatOutcome(signal), `${resultPips == null ? "" : `${formatPips(resultPips)} · `}held ${formatHoldingCandles(signal.activationTime, timelineEnd)} · ${signal.exitTime == null ? lifecycle.state : formatUtc(signal.exitTime)}`);
  row("Release-time limitation", "Prospective research only", "Historical rows without a first-seen quote cannot prove an executable release price; the frozen result uses the first strictly later H4 open.");

  if (signal.entryTimingAudit) {
    section("Entry timing research · Observed MT5 data");
    row("First observed quote", `${formatUtc(signal.entryTimingAudit.quoteTime)} · ${formatPrice(signal.entryTimingAudit.observedMid, market)}`, `${signal.entryTimingAudit.quoteDelaySeconds}s after release`);
    signal.entryTimingAudit.entries.forEach((entry) => row(`First later ${entry.timeframe} open`, entry.entryTime == null ? "Waiting" : `${formatUtc(entry.entryTime)} · ${formatPrice(entry.entryOpen, market)}`, entry.status === "quote_captured_after_entry" ? "Quote arrived too late to compare" : entry.status === "waiting_for_candle" ? "Not formed yet" : `${formatPips(entry.gapPips)} raw · ${formatPips(entry.directionAdjustedGapPips)} with arrow`));
    row("Entry timing disclosure", "Research only", signal.entryTimingAudit.disclosure);
  }

  if (signal.pathAudit) {
    section("Detailed reaction path · Reaction versus trade result");
    row("Registered mapping", signal.pathAudit.evidenceReaction === "rejected" ? "Rejects evidence" : "Follows evidence", "Economic evidence-to-direction mapping");
    row(`Direction after ${signal.pathAudit.reactionHorizonCandles} H4`, signal.pathAudit.directionWorked == null ? "Unavailable" : signal.pathAudit.directionWorked ? "Worked" : "Did not work", formatR(signal.pathAudit.reactionResponseR));
    row("Best favorable move", formatR(signal.pathAudit.maximumFavorableR), `${formatPips(signal.pathAudit.maximumFavorablePips)} · after ${signal.pathAudit.timeToMfeCandles ?? "—"} H4 · not realized profit`);
    row("Worst open pressure", formatR(-signal.pathAudit.maximumAdverseR), `${formatPips(-signal.pathAudit.maximumAdversePips)} · after ${signal.pathAudit.timeToMaeCandles ?? "—"} H4`);
    row("Final frozen trade", formatOutcome(signal), signal.pathAudit.givebackR == null ? "Frozen contract result" : `${formatR(signal.pathAudit.givebackR)} given back from the best open point`);
    if (signal.pathAudit.maximumFavorableR >= .5 && (signal.resultR ?? 0) < 0) row("Why reaction and result differ", "Price initially followed", "It did not reach this setup's TP before reversing into its SL. Best favorable move is hindsight path evidence, not captured profit.");
    (signal.pathAudit.lossReview ?? []).forEach((reason) => row("Loss-path observations", reason === "favourable_then_giveback" ? "Favourable move, then giveback" : reason === "target_not_reached_before_close" ? "Target was not reached before close" : reason === "adverse_before_best_favourable_move" ? "Adverse move came before the best favourable point" : reason === "direction_not_working_at_six_h4" ? "Direction was not working at six H4" : "Maximum duration ended negative", "Recorded path classification"));
    signal.pathAudit.fixedHorizonResponses.forEach((response) => row(`Fixed horizon · ${response.holdingCandles} H4`, formatR(response.responseR), "Direction-adjusted response"));
  }

  if (benchmark || historicalEvidence) {
    section("Historical performance of this exact setup");
    row("Evidence source", historicalEvidence?.sourceId ?? benchmark?.experimentId ?? "—", historicalEvidence?.scope ?? "Registered historical benchmark");
    row("Average per trade", formatR(benchmarkAverage), `Gross · ${benchmarkSample ?? "—"} later test trades`);
    row("TP before SL", formatPercent(benchmarkTargetRate), historicalEvidence?.targetHitCount == null ? "Rate recorded without exact count" : `${historicalEvidence.targetHitCount} / ${historicalEvidence.evaluableCount}`);
    row("SL before TP", formatPercent(benchmarkStopRate), historicalEvidence?.stopHitCount == null ? "Rate recorded without exact count" : `${historicalEvidence.stopHitCount} / ${historicalEvidence.evaluableCount}`);
    if (historicalEvidence) row("Other outcomes", `Expired ${historicalEvidence.expiredCount ?? "—"} · Break-even ${historicalEvidence.breakEvenCount ?? "—"}`, `Ambiguous ${historicalEvidence.ambiguousCount ?? "—"} · Unevaluable ${historicalEvidence.unevaluableCount ?? "—"}`);
    if (benchmark) row("All matching events", String(benchmark.historicalN), `Later TP rate needed ${formatPercent(simpleBreakEven)}`);
    if (pattern.reactionAudit) {
      row(`Direction worked after ${pattern.reactionAudit.horizonCandles} H4`, formatPercent(pattern.reactionAudit.positiveResponseRate), `Worked, but trade lost ${pattern.reactionAudit.directionWorkedTradeLost} / ${pattern.reactionAudit.evaluableN}`);
      row("Different measurements:", "Direction versus final trade", `Direction checks the registered price response after ${pattern.reactionAudit.horizonCandles} H4 candles. Final result uses this setup's exact SL, TP, and maximum duration.`);
    }
    row("Trade rules used in this test", `SL ${stopAtr} ATR · TP ${targetR}R = ${stopAtr * targetR} ATR`, `maximum ${signal.expiryCandles} H4 candles${signal.managementFamily === "break_even" ? ` · move SL to entry after a completed H4 reaches +${signal.managementTriggerR ?? 1}R` : ""}`);
    if (reviewedExecutionApplies) row("Reviewed execution contract", "Verified", `${pattern.executionReview?.reason} Historical result remains gross and is not live validation.`);
    if (provenance) row(provenanceLabel(provenance.status), provenance.status, provenance.note);
  } else row("Historical setup", "No linked backtest record", "This older setup is retained for audit, but exact historical performance is unavailable here.", { tone: "warning" });

  section("Important");
  row("Result scope", "Gross, local, hypothetical", `Gross results exclude spread, slippage, swap, and commission. ${historicalReplay ? "This past arrow is hindsight and was not available in real time." : "This release matched a registered FMS setup."} No order is sent to MT5.`);
  row("Recorded source", `${data.modelId} · ${data.modelHash.slice(0, 10)}`, data.datasetFingerprint ? `Data ${data.datasetFingerprint.slice(0, 10)}` : "No dataset fingerprint recorded");

  return {
    ariaLabel: `${signal.direction} ${market} macro bias audit`,
    kicker: historicalReplay ? "Past FMS result" : "Current FMS signal",
    title: pattern.label,
    subtitle: `${formatUtc(signal.eventTime)} · ${signal.observationMode?.replaceAll("_", " ") ?? (historicalReplay ? "historical replay" : "current")}`,
    rows,
  };
}
