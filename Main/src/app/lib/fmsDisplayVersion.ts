import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse } from "@/app/types";

/** Trading-release display names, not research/model IDs or contract revisions.
 * The current frozen registry is the v1 baseline. A successor must introduce an
 * explicit registration-to-release mapping rather than relabel old records.
 */
export const FMS_BASELINE_DISPLAY_VERSION = "FMS v1";
export const FMS_SUCCESSOR_DISPLAY_VERSION = "FMS v2";
export type FmsDisplayVersion = typeof FMS_BASELINE_DISPLAY_VERSION | typeof FMS_SUCCESSOR_DISPLAY_VERSION;

export function fmsSignalDisplayVersion(signal: Pick<MacroSignalChartSignal, "registeredVersion">): FmsDisplayVersion {
  return signal.registeredVersion === FMS_SUCCESSOR_DISPLAY_VERSION
    ? FMS_SUCCESSOR_DISPLAY_VERSION
    : FMS_BASELINE_DISPLAY_VERSION;
}

export function fmsPatternSupportsVersion(pattern: MacroSignalChartPattern, version: FmsDisplayVersion): boolean {
  return pattern.currentEligible && (
    version === FMS_BASELINE_DISPLAY_VERSION
    || pattern.successorReview?.status === "reviewed_active"
  );
}

export function fmsVersionAtEvent(pattern: MacroSignalChartPattern, eventTime: number): FmsDisplayVersion {
  return pattern.successorReview?.status === "reviewed_active"
    && eventTime >= pattern.successorReview.activatedAt
    ? FMS_SUCCESSOR_DISPLAY_VERSION
    : FMS_BASELINE_DISPLAY_VERSION;
}

export function projectFmsPatternVersion(pattern: MacroSignalChartPattern, version: FmsDisplayVersion): MacroSignalChartPattern {
  if (version === FMS_SUCCESSOR_DISPLAY_VERSION) {
    return {
      ...pattern,
      activeExecution: pattern.successorReview?.currentExecution ?? pattern.activeExecution ?? pattern.execution,
      registeredVersion: FMS_SUCCESSOR_DISPLAY_VERSION,
    };
  }
  return {
    ...pattern,
    activeExecution: pattern.successorReview?.previousExecution ?? pattern.activeExecution ?? pattern.execution,
    registeredVersion: FMS_BASELINE_DISPLAY_VERSION,
    successorReview: null,
  };
}

export function projectFmsMarketVersion(
  market: MacroSignalChartSignalResponse,
  version: FmsDisplayVersion,
): MacroSignalChartSignalResponse {
  const sourcePatterns = new Map(market.patterns.map((pattern) => [pattern.id, pattern]));
  const sourceSignals = new Map(
    [...market.signals, ...(market.recoveredSignals ?? [])]
      .map((signal) => [`${signal.patternId}:${signal.eventTime}`, signal]),
  );
  const patterns = market.patterns
    .filter((pattern) => fmsPatternSupportsVersion(pattern, version))
    .map((pattern) => projectFmsPatternVersion(pattern, version));
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const signalMatches = (signal: MacroSignalChartSignal) => (
    patternIds.has(signal.patternId) && fmsSignalDisplayVersion(signal) === version
  );
  const assessmentMatches = (assessment: { patternId: string; time: number }) => {
    const pattern = sourcePatterns.get(assessment.patternId);
    const exactSignal = sourceSignals.get(`${assessment.patternId}:${assessment.time}`);
    const eventVersion = exactSignal ? fmsSignalDisplayVersion(exactSignal) : pattern ? fmsVersionAtEvent(pattern, assessment.time) : null;
    return Boolean(pattern && patternIds.has(assessment.patternId) && eventVersion === version);
  };
  const realtime = market.realtime ? { ...market.realtime } : undefined;
  if (realtime) {
    const sourceWatches = realtime.upcomingPatternWatches?.length
      ? realtime.upcomingPatternWatches
      : realtime.nextPatternWatch ? [realtime.nextPatternWatch] : [];
    realtime.upcomingPatternWatches = sourceWatches.filter((watch) => patternIds.has(watch.patternId));
    realtime.nextPatternWatch = realtime.upcomingPatternWatches[0] ?? null;
    if (realtime.latestPatternAssessments) {
      realtime.latestPatternAssessments = realtime.latestPatternAssessments.filter(assessmentMatches);
    }
    if (realtime.patternAssessments) {
      realtime.patternAssessments = realtime.patternAssessments.filter(assessmentMatches);
    }
    const latestAssessment = realtime.latestPatternAssessments?.[0]
      ?? (realtime.latestPatternAssessment && assessmentMatches(realtime.latestPatternAssessment)
        ? realtime.latestPatternAssessment : null);
    realtime.latestPatternAssessment = latestAssessment;
  }
  return {
    ...market,
    patterns,
    signals: market.signals.filter(signalMatches),
    recoveredSignals: (market.recoveredSignals ?? []).filter(signalMatches),
    realtime,
    currentPatternCount: patterns.length,
  };
}

/** Existing v1 note keys remain unchanged; v2 gets a suffix so parallel reviews never overwrite them. */
export function fmsReviewRecordKey(
  market: string,
  patternId: string,
  eventTime: number | string,
  version: FmsDisplayVersion,
): string {
  const base = `${market}:${patternId}:${eventTime}`;
  return version === FMS_SUCCESSOR_DISPLAY_VERSION ? `${base}:fms-v2` : base;
}

export const FMS_BASELINE_GENERATION_SUMMARY =
  "Frozen event–pair recipes researched on historical MT5 calendar values and candles. " +
  "Each recipe declares its release package, scoring and currency orientation, " +
  "follow/rejection treatment, entry, SL, TP and expiry. Matching releases produce " +
  "setups under those rules; missing or nonmatching inputs can produce no trade. " +
  "Historical evidence is gross, not guaranteed future performance. Expand a row for its exact recipe.";

export const FMS_SUCCESSOR_GENERATION_SUMMARY =
  "Approved event-specific execution successors retain each recipe's v1 release/scoring rule, " +
  "but use a separately selected SL, TP and expiry after the v2 activation boundary. " +
  "Selection used development history; the reused chronological holdout had to remain positive " +
  "and improve over the exact v1 contract on the same complete H4 paths. Old arrows stay v1.";
