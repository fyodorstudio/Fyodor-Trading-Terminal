import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartSettingsDrawer } from "@/app/components/ChartSettingsDrawer";
import { ChartMacroBiasAudit } from "@/app/components/ChartMacroBiasAudit";
import { ChartMacroBiasRealtimeCard } from "@/app/components/ChartMacroBiasRealtimeCard";
import { ChartToolStrip } from "@/app/components/ChartToolStrip";
import { ChartPairMatrixContextMarkers, clusterPairMatrixMarkerViews } from "@/app/components/ChartPairMatrixContextMarkers";
import { ChartPairMatrixRangeOverlay, clampPairMatrixPanelHeight } from "@/app/components/ChartViewport";
import { DEFAULT_CHART_PREFERENCES } from "@/app/lib/chartView";
import { buildMacroSignalShadowAccount, buildMacroSignalShadowPosition, normalizeShadowRiskPercent, normalizeShadowStartingBalance } from "@/app/lib/macroSignalShadow";
import { createPairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import { buildMacroBiasSeriesMarkers, captureChartZoomSnapshot, ChartsTab, getChartRangeUpdateCadence, getMacroBiasActiveState, getMacroBiasReplayStatusLabel, getMacroBiasRequestScope, getPairMatrixAnalyzeCandleRange, getPairMatrixHoverSettleDelay, resolvePairMatrixHoveredCandleUpdate, restoreChartZoomRange } from "@/app/tabs/primary/ChartsTab";
import type { MacroSignalChartPattern, MacroSignalChartSignal, MacroSignalChartSignalResponse, MacroSignalGlobalResponse, MacroSignalMetrics } from "@/app/types";
import { DEFAULT_CHART_TIMEFRAME, getChartConnectionLabel } from "@/app/lib/chartDisplay";
import { getChartSessionDetail } from "@/app/lib/chartView";

describe("getChartConnectionLabel", () => {
  it("opens Charts on the H4 timeframe by default", () => {
    expect(DEFAULT_CHART_TIMEFRAME).toBe("H4");
  });
  it("updates Pair Matrix hover once per snapped candle and never while disabled", () => {
    expect(resolvePairMatrixHoveredCandleUpdate(null, 100, false)).toEqual({ shouldUpdate: false, value: 100 });
    expect(resolvePairMatrixHoveredCandleUpdate(100, 100, true)).toEqual({ shouldUpdate: false, value: 100 });
    expect(resolvePairMatrixHoveredCandleUpdate(100, 200, true)).toEqual({ shouldUpdate: true, value: 200 });
  });
  it("defers chart-range React updates until interaction settles while Pair Matrix is open", () => {
    expect(getChartRangeUpdateCadence(false)).toBe("animation_frame");
    expect(getChartRangeUpdateCadence(true)).toBe("settled");
  });
  it("renders one clickable activation arrow per signal without a redundant release dot", () => {
    const makeSignal = (id: string, eventTime: number, direction: "long" | "short"): MacroSignalChartSignal => ({
      id, patternId: `pattern-${id}`, sourceVersionId: "v2", eventTime, activationTime: eventTime < 14_400 ? 14_400 : 28_800, expiryCandles: 30, historicalReplay: true, direction, label: "Historical pattern", agreement: "consensus", pairVote: direction === "long" ? 1 : -1, backgroundDirection: "none", backgroundPairVote: 0, backgroundAlignment: "neutral", backgroundCoverageComplete: true, highestImpact: "high", events: [],
    });
    const candles = [0, 14_400, 28_800].map((time) => ({ time, open: 1.1, high: 1.2, low: 1.0, close: 1.15, volume: 1 }));
    const signals = [makeSignal("long", 1_000, "long"), makeSignal("short", 15_000, "short")];
    const built = buildMacroBiasSeriesMarkers(signals, candles, "H4", 0);

    expect(built.markers.map((marker) => ({ time: marker.time, shape: marker.shape, text: marker.text }))).toEqual([
      { time: 14_400, shape: "arrowUp", text: "LONG BIAS" },
      { time: 28_800, shape: "arrowDown", text: "SHORT BIAS" },
    ]);
    expect([...built.signalByMarkerId.keys()]).toEqual([
      "macro-bias-activation:long",
      "macro-bias-activation:short",
    ]);
    expect(getMacroBiasActiveState([makeSignal("active", 1_000, "long")], candles, 0)).toMatchObject({
      activationCandleOpen: 14_400,
      remainingCandles: 29,
    });
    expect(getMacroBiasActiveState([{ ...makeSignal("resolved", 1_000, "long"), outcomeStatus: "target_hit" }], candles, 0)).toBeNull();

    const h1Candles = Array.from({ length: 120 }, (_, index) => ({ time: index * 3_600, open: 1.1, high: 1.2, low: 1, close: 1.15, volume: 1 }));
    const h1Signal = { ...makeSignal("h1", 1_000, "long"), activationTime: 3_600 };
    expect(getMacroBiasActiveState([h1Signal], h1Candles, 0, "H1")).toMatchObject({ remainingCandles: 1 });
    expect(getMacroBiasActiveState([{ ...h1Signal, activationTime: null }], h1Candles, 0, "H1")).toBeNull();

    const m15Candles = Array.from({ length: 20 }, (_, index) => ({ time: index * 900, open: 1.1, high: 1.2, low: 1, close: 1.15, volume: 1 }));
    const m15Built = buildMacroBiasSeriesMarkers([makeSignal("m15", 1_000, "long")], m15Candles, "M15", 0);
    expect(m15Built.markers).toMatchObject([{ time: 14_400, shape: "arrowUp" }]);

    const d1Candles = [0, 86_400].map((time) => ({ time, open: 1.1, high: 1.2, low: 1, close: 1.15, volume: 1 }));
    const d1Built = buildMacroBiasSeriesMarkers([makeSignal("d1", 1_000, "short")], d1Candles, "D1", 0);
    expect(d1Built.markers).toMatchObject([{ time: 0, shape: "arrowDown" }]);
    expect([...d1Built.signalByMarkerId.keys()]).toEqual(["macro-bias-activation:d1"]);
    expect(getMacroBiasActiveState([makeSignal("d1-active", 1_000, "long")], [d1Candles[0]], 0, "D1"))
      .toMatchObject({ activationCandleOpen: 0, remainingCandles: null, expiryCandleOpen: null });
  });
  it("uses one FMS view with an optional past-arrow overlay", () => {
    expect(getMacroBiasReplayStatusLabel({
      evaluatedPackageCount: 20,
      matchingPackageCount: 4,
      latestEvaluatedAt: 2_000,
      latestMatchedEventAt: 1_000,
      latestArrowAt: 86_400,
      laterUnmatchedPackageCount: 7,
    })).toBe("Hindsight replay · last arrow 02 Jan 1970 · 7 later scored packages did not match");
    const html = renderToStaticMarkup(createElement(ChartToolStrip, {
      cursorReadoutMode: "both",
      eventOverlayVisible: true,
      eventCandidateCount: 0,
      eventVisibleCount: 0,
      macroBiasVisible: true,
      macroBiasCount: 0,
      macroBiasSupported: true,
      macroBiasStatusLabel: "One current pattern",
      macroBiasHistoricalMatchesVisible: true,
      macroBiasHistoricalMatchesCount: 42,
      macroBiasActiveLabel: "No active bias",
      eventLensExpanded: false,
      pairMatrixOpen: false,
      onCursorModeChange: () => {},
      onRefocusChart: () => {},
      onOpenDrawer: () => {},
      onToggleMacroBias: () => {},
      onToggleMacroBiasHistoricalMatches: () => {},
      onToggleEventLens: () => {},
      onTogglePairMatrix: () => {},
    }));

    expect(html).not.toContain("Current model");
    expect(html).not.toContain("Research replay");
    expect(html).toContain("Past arrows");
    expect(html).toContain(">42<");
    expect(html).toContain("No active bias");
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('aria-label="Open Event Lens"');
    expect(html).toContain('aria-label="Open Pair Matrix Time Lens"');
  });
  it("makes target sensitivity, resolved outcomes, costs, and uncertainty explicit in the bias audit", () => {
    const metrics: MacroSignalMetrics = {
      candidateCount: 55, directionalCount: 55, evaluableCount: 54, targetHitCount: 21, stopHitCount: 32,
      expiredCount: 1, ambiguousCount: 1, unevaluableCount: 0, targetHitRate: 0.389, stopHitRate: 0.593,
      expiredRate: 0.018, ambiguousRate: 0.018, averageR: 0.184, medianR: -1,
      expectancyCi95: { lower: -0.2, upper: 0.58 }, targetHitCi95: { lower: 0.27, upper: 0.52 },
    };
    const signal: MacroSignalChartSignal = {
      id: "signal", patternId: "pattern", sourceVersionId: "v2", eventTime: 1_000, activationTime: 14_400,
      execution: { stopAtr: 2, targetR: .5, expiryCandles: 42 }, stopAtr: 2, targetR: .5, expiryCandles: 42,
      entry: 1.35000, stop: 1.34000, target: 1.35500,
      historicalReplay: true, direction: "long", label: "US labor claims improvement", agreement: "consensus", pairVote: 1,
      backgroundDirection: "short", backgroundPairVote: -1, backgroundAlignment: "aligned", backgroundCoverageComplete: true,
      highestImpact: "high", events: [], outcomeStatus: "target_hit", resultR: .5, exitTime: 28_800,
      evidenceReaction: "followed",
      pathAudit: {
        evidenceReaction: "followed", reactionHorizonCandles: 6, reactionResponseR: .65, directionWorked: true, lossReview: ["favourable_then_giveback", "target_not_reached_before_close"], maximumFavorableR: 1.39, maximumFavorablePips: 69,
        maximumAdverseR: .4, maximumAdversePips: 20, timeToMfeCandles: 18,
        timeToMaeCandles: 2, givebackR: .89,
        fixedHorizonResponses: [{ holdingCandles: 1, responseR: .67 }, { holdingCandles: 6, responseR: .65 }, { holdingCandles: 30, responseR: -.58 }],
      },
    };
    const html = renderToStaticMarkup(createElement(ChartMacroBiasAudit, { data: {
      signal,
      pattern: {
        id: "pattern", market: "USDCAD", signature: "long|USD:labor_claims", signatures: ["long|USD:labor_claims"], sourceVersionId: "v2", label: "US labor claims improvement", condition: "Long USDCAD when claims evidence improves.", execution: { stopAtr: 2, targetR: .5, expiryCandles: 42 }, direction: "long", groups: ["USD:labor_claims"],
        historicalBenchmark: { experimentId: "FMS-USDCAD-H4-E030", historicalN: 178, walkForwardN: 67, walkForwardAverageR: .143, targetFirstRate: .776, stopFirstRate: .224, status: "historically_profitable" },
        reactionAudit: { schema: "registered-reaction-audit-v1", scope: "chronological later-test cases", horizonCandles: 6, evaluableN: 67, directionWorkedTradeProfited: 30, directionWorkedTradeLost: 7, directionFailedTradeProfited: 8, directionFailedTradeLost: 22, positiveResponseRate: .552, medianResponseR: .18 },
        registrationProvenance: { status: "verified", experimentId: "FMS-USDCAD-H4-E030", configurationHash: "config", datasetFingerprint: "data", qualificationAuditId: "audit", checks: { market: true }, note: "Verified against the immutable experiment." },
        overall: metrics, development: metrics, holdout: metrics, qualification: {}, exampleTitles: [], modelStatus: "current", currentEligible: true,
        modelChecks: {}, executionStress: { pips: 3, overall: { ...metrics, averageR: 0.087 }, development: metrics, holdout: metrics, recent: metrics },
        recentWindow: { from: 0, to: 1, metrics }, yearStability: { evaluableYears: 11, positiveYears: 7, positiveYearShare: 7 / 11, byYear: [] },
        prequentialAudit: { evaluableCount: 2, gross: metrics, executionStress: metrics, firstEligibleEventTime: 0, lastEligibleEventTime: 1 },
        targetRobustness: [
          { targetR: 1, gross: metrics, executionStress: { ...metrics, averageR: -0.171 } },
          { targetR: 1.5, gross: metrics, executionStress: { ...metrics, averageR: -0.032 } },
          { targetR: 2, gross: metrics, executionStress: { ...metrics, averageR: 0.087 } },
        ],
        estimatedBreakEvenStressPips: 5.67, uncertaintyIncludesNoEdge: true, selectionNote: "Frozen research pattern.",
      },
      versionId: "v2", modelId: "v3", modelHash: "abcdef123456", datasetFingerprint: "123456abcdef", mode: "research_replay", targetR: 2, onClose: () => {},
    } }));

    expect(html).toContain("Past FMS result");
    expect(html).toContain("Long USDCAD");
    expect(html).not.toContain("Long EURUSD");
    expect(html).toContain("Why the arrow appeared");
    expect(html).toContain("Initial move followed");
    expect(html).toContain("Price followed the arrow");
    expect(html).toContain("after 1 H4");
    expect(html).toContain("Frozen trade result");
    expect(html).toContain("Reaction versus trade result");
    expect(html).toContain("Follows evidence");
    expect(html).toContain("Direction after 6 H4");
    expect(html).toContain("Worked");
    expect(html).toContain("Loss-path observations");
    expect(html).toContain("Favourable move, then giveback");
    expect(html).toContain("Best favorable move");
    expect(html).toContain("not realized profit");
    expect(html).toContain("+1.39R");
    expect(html).toContain("+69.0 pips");
    expect(html).toContain("Direction worked after 6 H4");
    expect(html).toContain("Worked, but trade lost");
    expect(html).toContain("Different measurements:");
    expect(html.indexOf("US labor claims improvement")).toBeLessThan(html.indexOf("Release time"));
    expect(html).toContain("Closed — target reached");
    expect(html).toContain("Later price movement does not change this result");
    expect(html).toContain("TP reached · +0.50R");
    expect(html).toContain("Frozen trade price levels");
    expect(html).toContain("Risk · SL");
    expect(html).toContain("Reward · TP");
    expect(html).toContain("SL 2 ATR · TP 0.5R = 1 ATR · maximum 42 H4 candles");
    expect(html).toContain("Historical performance of this exact setup");
    expect(html).toContain("FMS-USDCAD-H4-E030");
    expect(html).toContain("+0.14R");
    expect(html).toContain("77.6%");
    expect(html).toContain("Backtest record verified");
    expect(html).not.toContain("Source research diagnostics");
  });
  it("shows the current bias, historical wins and failures, next event, and next frozen condition", () => {
    const metrics: MacroSignalMetrics = {
      candidateCount: 10, directionalCount: 10, evaluableCount: 10, targetHitCount: 4, stopHitCount: 6,
      expiredCount: 0, ambiguousCount: 0, unevaluableCount: 0, targetHitRate: .4, stopHitRate: .6,
      expiredRate: 0, ambiguousRate: 0, averageR: .2, medianR: -1,
      expectancyCi95: { lower: -.2, upper: .6 }, targetHitCi95: { lower: .2, upper: .6 },
    };
    const distribution = { minimum: -.5, p25: -.1, median: .2, mean: .25, p75: .6, maximum: 1.5 };
    const pattern = {
      id: "sentiment", signature: "long|EUR:consumer_sentiment", signatures: ["long|EUR:consumer_sentiment", "short|EUR:consumer_sentiment"],
      sourceVersionId: "v3", label: "Euro-area consumer sentiment", condition: "Long if sentiment improves; Short if it weakens.", execution: { stopAtr: 1, targetR: 2, expiryCandles: 30 }, direction: "both",
      market: "EURUSD", scoringPolicy: "forecast_quality", historicalBenchmark: { experimentId: "FMS-EURUSD-H4-E197", historicalN: 48, walkForwardN: 35, walkForwardAverageR: .14, targetFirstRate: .75, stopFirstRate: .17, status: "historically_profitable" },
      reactionAudit: { schema: "registered-reaction-audit-v1", scope: "chronological later-test cases", horizonCandles: 6, evaluableN: 35, directionWorkedTradeProfited: 20, directionWorkedTradeLost: 4, directionFailedTradeProfited: 3, directionFailedTradeLost: 8, positiveResponseRate: 24 / 35, medianResponseR: .22, profile: { schema: "registered-reaction-profile-v1", scope: "chronological later-test cases", experimentId: "FMS-EURUSD-H4-E197", evaluableN: 35, standardWindowCandles: 30, classification: "short_lived_impulse", horizons: [1, 3, 6, 12, 30].map((holdingCandles) => ({ holdingCandles, evaluableN: 35, alignmentRate: holdingCandles <= 3 ? .68 : .48, atr: distribution, r: distribution, pips: distribution })), mfe: { atr: distribution, r: distribution, pips: distribution, timeCandles: distribution }, mae: { atr: distribution, r: distribution, pips: distribution, timeCandles: distribution }, givebackAtr: distribution, contractResearch: { selectionRule: "Development only", status: "keep_frozen_contract", frozen: { stopAtr: 1, targetR: 2, holdingCandles: 30, developmentAverageR: .2, laterAverageR: .14, laterTargetRate: .75, laterStopRate: .17 }, developmentSelected: { stopAtr: 1, targetR: 2, holdingCandles: 30, developmentAverageR: .2, laterAverageR: .14, laterTargetRate: .75, laterStopRate: .17 } } } },
      groups: ["EUR:consumer_sentiment"], overall: metrics, development: metrics, holdout: metrics, qualification: {}, exampleTitles: [],
      modelStatus: "current", currentEligible: true, modelChecks: {}, executionStress: { pips: 3, overall: metrics, development: metrics, holdout: metrics, recent: metrics },
      readiness: { auditStatus: "complete", historicalStatus: "historically_qualified", liveStatus: "not_live_validated", label: "Historical audit complete", actionableInShadowTrader: true },
      recentWindow: { from: 0, to: 1, metrics }, yearStability: { evaluableYears: 10, positiveYears: 7, positiveYearShare: .7, byYear: [] },
      prequentialAudit: { evaluableCount: 3, gross: metrics, executionStress: metrics, firstEligibleEventTime: 0, lastEligibleEventTime: 1 },
      targetRobustness: [], estimatedBreakEvenStressPips: 4, uncertaintyIncludesNoEdge: true, selectionNote: "Frozen.",
    } satisfies MacroSignalChartPattern;
    const closedSignal = {
      id: "sentiment-closed", patternId: "sentiment", sourceVersionId: "v3", eventTime: 60, activationTime: 64,
      historicalReplay: false, direction: "short", label: pattern.label, agreement: "consensus", pairVote: -1,
      backgroundDirection: "none", backgroundPairVote: 0, backgroundAlignment: "neutral", backgroundCoverageComplete: true,
      highestImpact: "high", events: [], execution: { stopAtr: 1, targetR: 2, expiryCandles: 30 }, stopAtr: 1, targetR: 2,
      expiryCandles: 30, entry: 1.1, atr: .01, stop: 1.11, target: 1.08, outcomeStatus: "target_hit", resultR: 2, exitTime: 80,
    } satisfies MacroSignalChartSignal;
    const openSignal = {
      ...closedSignal,
      id: "sentiment-open", eventTime: 95, activationTime: 96, direction: "long", pairVote: 1,
      entry: 1.2, stop: 1.19, target: 1.22, outcomeStatus: "pending", resultR: null, exitTime: null,
    } satisfies MacroSignalChartSignal;
    const response = {
      supported: true, versionId: "v4", modelId: "v4", modelHash: "hash", modelActivatedAt: 1, datasetFingerprint: "data",
      mode: "current", symbol: "EURUSD", timeframe: "H1", modelTimeframe: "H4", targetR: 2, patterns: [pattern], signals: [closedSignal, openSignal], message: "Current",
      realtime: {
        asOf: 100,
        nextPairEvent: { id: 1, time: 200, currency: "USD", countryCode: "US", title: "Leading Index", impact: "high", actual: null, forecast: "1", previous: "0" },
        nextPatternWatch: { time: 300, patternId: "sentiment", label: pattern.label, condition: pattern.condition, sourceVersionId: "v3", requiredGroups: ["EUR:consumer_sentiment"], events: [] },
        latestPatternAssessment: {
          time: 90, patternId: "sentiment", label: pattern.label, condition: pattern.condition, status: "no_trade", direction: null,
          reason: "The complete package produced no registered direction.", events: [],
          calculations: [
            { title: "Consumer Confidence", actual: "90", forecast: "80", previous: "70", surprisePoint: 1, momentumPoint: 1, agreementBonus: 1, score: 3, forecastSuspect: false, forecastGap: 10, forecastAnomalyThreshold: 20, scoringPolicy: "forecast_quality" },
            { title: "Consumer Confidence Average", actual: "80", forecast: "70", previous: "90", surprisePoint: 1, momentumPoint: -1, agreementBonus: 0, score: 0, forecastSuspect: false, forecastGap: 20, forecastAnomalyThreshold: 30, scoringPolicy: "forecast_quality" },
          ],
        },
      },
      policyInflationContext: {
        asOf: 100,
        currencies: {
          EUR: { policy: { state: "holding", time: 50, title: "ECB Deposit Facility Rate Decision", actual: "2.25", previous: "2.25" }, inflation: { state: "cooling", time: 80, heatingGroups: 0, coolingGroups: 1, titles: ["CPI y/y"] } },
          USD: { policy: { state: "holding", time: 60, title: "Fed Interest Rate Decision", actual: "3.75", previous: "3.75" }, inflation: { state: "heating", time: 90, heatingGroups: 2, coolingGroups: 0, titles: ["Core CPI y/y"] } },
        },
        usage: "Context only.",
      },
    } satisfies MacroSignalChartSignalResponse;
    const gbpPattern = { ...pattern, id: "gbp-industrial", market: "GBPUSD", label: "US industrial-production package", readiness: { auditStatus: "incomplete", historicalStatus: "unverified", liveStatus: "not_live_validated", label: "Audit incomplete", actionableInShadowTrader: false } } satisfies MacroSignalChartPattern;
    const gbpResponse = {
      ...response,
      symbol: "GBPUSD",
      patterns: [gbpPattern],
      realtime: {
        asOf: 100,
        nextPairEvent: null,
        nextPatternWatch: { time: 400, patternId: gbpPattern.id, label: gbpPattern.label, condition: gbpPattern.condition, sourceVersionId: "v7", requiredGroups: ["USD:industrial_output"], events: [] },
      },
      policyInflationContext: undefined,
    } satisfies MacroSignalChartSignalResponse;
    const globalResponse = {
      modelId: "global", modelHash: "global-hash", generatedAt: 100, markets: [response, gbpResponse],
      liveDecisions: [{ modelId: "global", market: "EURUSD", patternId: pattern.id, eventTime: 90, firstDecidedAt: 91, status: "no_trade", direction: null, assessment: response.realtime.latestPatternAssessment!, signal: null }],
      explanation: "Registered, contender, and avoid meanings.",
      researchIntelligence: [
        { id: "contender", status: "contender", market: "EURUSD", label: "Retail sales", evidence: "Positive in some partitions.", conclusion: "Retest later." },
        { id: "avoid", status: "avoid", market: "GBPUSD", label: "Producer inflation", evidence: "Repeated tests were unstable.", conclusion: "Avoid standalone direction." },
        { id: "insufficient", status: "insufficient", market: "GBPUSD", label: "Small sample", evidence: "Too few cases.", conclusion: "No conclusion yet." },
      ],
    } satisfies MacroSignalGlobalResponse;
    const html = renderToStaticMarkup(createElement(ChartMacroBiasRealtimeCard, { data: {
      response, activeSignal: null, activePattern: null, remainingModelCandles: null, chartTimeframe: "H1", historicalSignals: [], globalResponse, globalLoading: false, globalError: null,
    } }));

    expect(html).toContain("FMS Shadow Trader");
    expect(html).toContain("EURUSD flags");
    expect(html).toContain("GBPUSD flags");
    expect(html).toContain("Trade open");
    expect(html).toContain("What would FMS do now?");
    expect(html).toContain("Open now");
    expect(html).toContain("Last opened trade");
    expect(html).toContain("View audit");
    expect(html).toContain("Target reached");
    expect(html).not.toContain("Trade decision audit");
    expect(html).toContain("This release only:");
    expect(html).toContain("It does not cancel the other releases.");
    expect(html).not.toContain("Complete package decision");
    expect(html).not.toContain("evidence cancelled to zero, so no trade was opened");
    expect(html).toContain("00:01 · 01 Jan 1970 · UTC");
    expect(html).toContain("All registered FMS setups");
    expect(html).toContain("Pair and setup");
    expect(html).toContain("Now");
    expect(html).toContain("Relevant event");
    expect(html).toContain("Historical result");
    expect(html).toContain("Next registered release");
    expect(html).toContain("Starts in");
    expect(html).toContain("Exact registered rule");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Latest matching release");
    expect(html).toContain("Later-test history");
    expect(html).toContain("Historical audit complete");
    expect(html).toContain("Audit incomplete");
    expect(html).toContain("Blocked");
    expect(html).toContain("Possible next setups");
    expect(html).toContain("Upcoming registered releases");
    expect(html).toContain("Wait for Actual");
    expect(html).toContain("Registered setups");
    expect(html).toContain("Average per trade");
    expect(html).toContain("Historical credibility");
    expect(html).toContain("How price usually reacted");
    expect(html).toContain("Short-lived impulse");
    expect(html).toContain("Arrow direction followed");
    expect(html).toContain("Typical best favorable move");
    expect(html).toContain("Execution-contract research");
    expect(html).toContain("Frozen contract retained");
    expect(html).toContain("Moderate");
    expect(html).toContain("Not live validated");
    expect(html).toContain("Spread, commission, slippage, and swap excluded");
    expect(html).toContain("View details");
    expect(html).toContain("Show");
    expect(html).toContain("FMS-EURUSD-H4-E197");
    expect(html).toContain("Best average result");
    expect(html).toContain("Highest TP-before-SL");
    expect(html).toContain("Soonest registered release");
    expect(html).toContain("Actionable now");
    expect(html).toContain("Audit readiness");
    expect(html).toContain("Historical credibility");
    expect(html).toContain("Moderate historical evidence");
    expect(html).toContain("Largest later-test sample");
    expect(html).toContain("Market and family");
    expect(html).toContain("2 markets live");
    expect(html).toContain("Show or hide market rows");
    expect(html).toContain('aria-label="Hide EURUSD"');
    expect(html).toContain('aria-label="Hide GBPUSD"');
    expect(html).toContain('title="Hide EURUSD"');
    expect(html).toContain('title="Hide GBPUSD"');
    const eurMarketFilter = html.match(/<button[^>]*title="Hide EURUSD"[^>]*>(.*?)<\/button>/)?.[1] ?? "";
    expect(eurMarketFilter).toContain("EURUSD flags");
    expect(eurMarketFilter).not.toContain(">EURUSD<");
    expect(html).toContain("GBPUSD · US industrial-production package");
    expect(html).toContain("What history says");
    expect(html).toContain("Immutable decision ledger");
    expect(html).toContain("first-seen decisions");
    expect(html).toContain("Broker revisions cannot rewrite");
    expect(html).toContain("Registered — historically profitable directional recipe");
    expect(html).toContain("Contender — promising but unstable");
    expect(html).toContain("Avoid as standalone direction");
    expect(html).toContain("Insufficient evidence");
    expect(html).toContain("All matching events");
    expect(html).toContain("Later test trades");
    expect(html).toContain("IF registered EUR evidence improves");
    expect(html).toContain("Long EURUSD");
    expect(html).toContain("IF evidence is zero, missing, or conflicted");
    expect(html).toContain("00:05 · 01 Jan 1970 · UTC");
    expect(html).toContain("Long if sentiment improves; Short if it weakens.");
    expect(html).toContain("75.0%");
    expect(html).toContain("17.0%");
    expect(html).toContain("+0.14R");
    expect(html).toContain("Direction worked + trade profited");
    expect(html).toContain("Direction worked + trade lost");
    expect(html).toContain("Direction failed + trade profited");
    expect(html).toContain("Direction failed + trade lost");
    expect(html).toContain("Direction and execution are separate:");
    expect(html).toContain("$1,000.00");
    expect(html).toContain("All registered pairs since activation");
    expect(html).toContain("EURUSD historical replay · selected pair only");
    expect(html).toContain("risk dollars = balance before trade × risk %");
    expect(html).toContain("Opposing decisions are conflicts only when they concern the same pair.");
    expect(html).toContain("spread, commission, slippage, and swap are excluded");
    expect(html).toContain("Policy holding 2.25");
    expect(html).toContain("Inflation heating");
    expect(html).toContain("Not used by frozen rules");
    expect(html).toContain("does not filter, reverse, suppress, or justify a registered trade");
    expect(html).not.toContain("Can I follow this blindly?");
    expect(html).not.toContain("Earlier EURUSD calendar row");
  });
  it("compounds the gross shadow account sequentially and skips overlapping signals", () => {
    const makeSignal = (id: string, activationTime: number, exitTime: number, resultR: number, outcomeStatus: "target_hit" | "stop_hit"): MacroSignalChartSignal => ({
      id, patternId: "pattern", sourceVersionId: "v9", eventTime: activationTime - 60, activationTime, exitTime,
      expiryCandles: 30, historicalReplay: true, direction: "long", label: "Pattern", agreement: "consensus",
      pairVote: 1, backgroundDirection: "none", backgroundPairVote: 0, backgroundAlignment: "neutral",
      backgroundCoverageComplete: true, highestImpact: "high", events: [], resultR, outcomeStatus,
    });
    const account = buildMacroSignalShadowAccount([
      makeSignal("win", 100, 200, 2, "target_hit"),
      makeSignal("overlap", 150, 180, -1, "stop_hit"),
      makeSignal("loss", 300, 400, -1, "stop_hit"),
    ], { startingBalance: 1_000, riskPercent: 1 });
    expect(account).toMatchObject({ balance: 1_009.8, profit: 9.8, takenTrades: 2, targetHits: 1, stopHits: 1, skippedOverlap: 1 });
    const position = buildMacroSignalShadowPosition({ ...makeSignal("position", 500, 600, 2, "target_hit"), entry: 1.1, stop: 1.095 }, 1_000, 0.5);
    expect(position.riskDollars).toBe(5);
    expect(position.stopPips).toBeCloseTo(50);
    expect(position.lots).toBeCloseTo(.01);
    expect(normalizeShadowStartingBalance(25)).toBe(25);
    expect(normalizeShadowRiskPercent(12.5)).toBe(12.5);
    expect(normalizeShadowStartingBalance(0)).toBe(1);
    expect(normalizeShadowRiskPercent(150)).toBe(100);
    expect(position.sizingNote).toContain("USD-account sizing");
    const jpyPosition = buildMacroSignalShadowPosition({ ...makeSignal("jpy-position", 500, 600, 2, "target_hit"), entry: 150, stop: 149.5 }, 1_000, 1, "USDJPY");
    expect(jpyPosition.stopPips).toBeCloseTo(50);
    expect(jpyPosition.lots).toBeCloseTo(.03);

    const conflict = buildMacroSignalShadowAccount([
      { ...makeSignal("long", 500, 600, 2, "target_hit"), direction: "long", maximumAdverseR: 0.5, expiryTime: 900 },
      { ...makeSignal("short", 500, 600, -1, "stop_hit"), direction: "short", maximumAdverseR: 1, expiryTime: 900 },
    ], { startingBalance: 1_000, riskPercent: 1 });
    expect(conflict).toMatchObject({ balance: 1_000, takenTrades: 0, skippedConflict: 2 });

    const crossMarketAlternative = buildMacroSignalShadowAccount([
      { ...makeSignal("gbp-long", 600, 700, 2, "target_hit"), market: "GBPUSD", direction: "long" },
      { ...makeSignal("jpy-short", 600, 700, -1, "stop_hit"), market: "USDJPY", direction: "short" },
    ], { startingBalance: 1_000, riskPercent: 1 });
    expect(crossMarketAlternative).toMatchObject({
      balance: 1_020,
      takenTrades: 1,
      skippedConflict: 0,
      skippedSimultaneousAlternative: 1,
    });

    const pathDrawdown = buildMacroSignalShadowAccount([
      { ...makeSignal("mae", 700, 800, 2, "target_hit"), maximumAdverseR: 0.75, expiryTime: 1_000 },
    ], { startingBalance: 1_000, riskPercent: 10 });
    expect(pathDrawdown.maxDrawdownPercent).toBeCloseTo(7.5);
    expect(pathDrawdown.drawdownBasis).toBe("intratrade_mae_when_available");
  });
  it("reuses the H4 Current Model on every timeframe while replay remains viewport-specific", () => {
    const currentH4 = getMacroBiasRequestScope({ mode: "current", symbol: "EURUSD", timeframe: "H4", from: 100, to: 200, calendarRevision: "calendar-a" });
    const currentH1 = getMacroBiasRequestScope({ mode: "current", symbol: "EURUSD", timeframe: "H1", from: 300, to: 400, calendarRevision: "calendar-a" });
    expect(currentH1).toBe(currentH4);
    expect(getMacroBiasRequestScope({ mode: "current", symbol: "EURUSD", timeframe: "M1", from: 500, to: 600, calendarRevision: "calendar-a" })).toBe(currentH4);
    expect(getMacroBiasRequestScope({ mode: "current", symbol: "EURUSD", timeframe: "MN1", from: 700, to: 800, calendarRevision: "calendar-a" })).toBe(currentH4);
    expect(getMacroBiasRequestScope({ mode: "research_replay", symbol: "EURUSD", timeframe: "H4", from: 100, to: 200, calendarRevision: "calendar-a" }))
      .not.toBe(getMacroBiasRequestScope({ mode: "research_replay", symbol: "EURUSD", timeframe: "H4", from: 300, to: 400, calendarRevision: "calendar-a" }));
  });
  it("restarts the hover quiet period when raw pointer motion continues", () => {
    expect(getPairMatrixHoverSettleDelay(1_000, 1_040, 120)).toBe(80);
    expect(getPairMatrixHoverSettleDelay(1_080, 1_090, 120)).toBe(110);
    expect(getPairMatrixHoverSettleDelay(1_000, 1_121, 120)).toBe(0);
  });
  it("locks Analyze candle to exactly one complete timeframe candle", () => {
    expect(getPairMatrixAnalyzeCandleRange([0, 14_400, 28_800], 14_400, "H4")).toEqual({
      firstOpen: 14_400,
      lastOpen: 14_400,
      close: 28_800,
      candleCount: 1,
    });
    expect(getPairMatrixAnalyzeCandleRange([0, 14_400, 28_800], 7_200, "H4")).toBeNull();
  });
  it("publishes snapped candles outside ChartsTab state and ignores duplicate anchors", () => {
    const runtime = createPairMatrixHoverRuntime();
    const published: Array<number | null> = [];
    const unsubscribe = runtime.subscribe((anchor) => published.push(anchor));
    runtime.publishAnchor(100);
    runtime.publishAnchor(100);
    runtime.publishAnchor(200);
    unsubscribe();
    runtime.publishAnchor(300);
    expect(runtime.getAnchor()).toBe(300);
    expect(published).toEqual([100, 200]);
  });
  it("preserves horizontal candle span and latest-side padding across market changes", () => {
    const snapshot = captureChartZoomSnapshot({ from: 40, to: 120 }, 100);
    expect(snapshot).toEqual({ span: 80, rightOffset: 20 });
    expect(restoreChartZoomRange(snapshot!, 500)).toEqual({ from: 440, to: 520 });
    expect(captureChartZoomSnapshot({ from: 0, to: 1 }, 1)).toBeNull();
  });
  it("keeps Pair Matrix resizing within the default panel and usable-chart bounds", () => {
    expect(clampPairMatrixPanelHeight(500, 900)).toBe(500);
    expect(clampPairMatrixPanelHeight(100, 900)).toBe(240);
    expect(clampPairMatrixPanelHeight(900, 900)).toBe(680);
  });

  it("uses market and bridge specific labels", () => {
    expect(
      getChartConnectionLabel({
        historyState: "ready",
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: null,
          asset_class: null,
          session_state: "open",
          is_open: true,
          terminal_connected: true,
          checked_at: 0,
          server_time: null,
          last_tick_time: null,
          next_open_time: null,
          next_close_time: null,
          reason: null,
        },
        streamConnected: true,
      }),
    ).toBe("Market Open");

    expect(
      getChartConnectionLabel({
        historyState: "ready",
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: null,
          asset_class: null,
          session_state: "closed",
          is_open: false,
          terminal_connected: true,
          checked_at: 0,
          server_time: null,
          last_tick_time: null,
          next_open_time: null,
          next_close_time: null,
          reason: null,
        },
        streamConnected: false,
      }),
    ).toBe("Market Closed");

    expect(
      getChartConnectionLabel({
        historyState: "error",
        marketStatus: null,
        streamConnected: false,
      }),
    ).toBe("Bridge Unavailable");

    expect(
      getChartConnectionLabel({
        historyState: "ready",
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: null,
          asset_class: null,
          session_state: "open",
          is_open: true,
          terminal_connected: false,
          checked_at: 0,
          server_time: null,
          last_tick_time: null,
          next_open_time: null,
          next_close_time: null,
          reason: null,
        },
        streamConnected: false,
      }),
    ).toBe("MT5 Disconnected");
  });

  it("renders chart toolbar and settings drawer controls", () => {
    const html = renderToStaticMarkup(
      createElement(ChartsTab, {
        selectedSymbol: "EURUSD",
        onSelectedSymbolChange: () => {},
        events: [],
        onOpenCalendarEvent: () => {},
        marketStatus: {
          symbol: "EURUSD",
          symbol_path: "Forex Majors\\EURUSD",
          asset_class: "forex",
          session_state: "open",
          is_open: true,
          terminal_connected: true,
          checked_at: 0,
          server_time: null,
          last_tick_time: null,
          next_open_time: null,
          next_close_time: null,
          reason: null,
        },
      }),
    );

    expect(html).toContain("Cursor readout mode");
    expect(html).toContain("Crosshair");
    expect(html).toContain("Sticky");
    expect(html).toContain("Open chart appearance");
    expect(html).toContain("Open chart events");
    expect(html).toContain("Open chart diagnostics");
    expect(html).toContain("Macro bias");
    expect(html).toContain("Event Lens");
    expect(html).toContain("Open Event Lens");
    expect(html).toContain("Open Pair Matrix Time Lens");
    expect(html).not.toContain(">Details<");
    expect(html).not.toContain("Loaded broker/MT5 rows only");
    expect(html).not.toContain("No loaded high-impact EUR/USD events in this visible range");
    expect(html).not.toContain("Loaded events:");
    expect(html).not.toContain("Events settings");
    expect(html).not.toContain("Show high + medium");
    expect(html).not.toContain(">History<");
    expect(html).not.toContain("Terminal Console");
  });

  it("keeps the locked range band separate from Pair Matrix context markers", () => {
    const html = renderToStaticMarkup(
      createElement(ChartPairMatrixRangeOverlay, {
        data: {
          armed: false,
          cancelRevision: 0,
          lockedBounds: { left: 100, right: 400 },
          startPreview: () => null,
          updatePreview: () => null,
          onCommit: () => {},
          onCancel: () => {},
          onInteractionChange: () => {},
        },
      }),
    );

    expect(html).toContain("Locked Pair Matrix candle range");
    expect(html).toContain("translate3d(100px, 0, 0)");
    expect(html).not.toContain("chart-event-dot");

    const event = { id: 1, time: 110, currency: "USD", countryCode: "US", title: "CPI y/y", impact: "high" as const, actual: "2.5", forecast: "2.4", previous: "2.3" };
    const markers = renderToStaticMarkup(createElement(ChartPairMatrixContextMarkers, {
      markers: [{
        key: "marker", candleOpen: 100, impact: "high" as const, position: "after" as const, x: 250, placement: "center" as const,
        events: [event],
        families: [{ factor: { id: "inflation" as const, label: "Inflation", helpText: "", includeAny: [] }, events: [event] }],
      }],
      passive: false,
      displayTimeMode: "local" as const,
      sourceTimeOffsetSeconds: 0,
      loadState: "ready" as const,
      onSelectEvent: () => {},
      onAnalyzeCandle: () => {},
    }));
    expect(markers).toContain('data-pair-matrix-context-markers=""');
    expect(markers).toContain("translate3d(250px, 0, 0) translateX(-50%)");
    expect(markers).toContain("1 Pair Matrix release in this candle");
    expect(markers).toContain("impact-high");
    expect(markers).toContain("high broker impact");
  });

  it("collapses visually crowded Pair Matrix markers without losing their releases", () => {
    const factor = { id: "inflation" as const, label: "Inflation", helpText: "", includeAny: [] };
    const first = { id: 1, time: 110, currency: "EUR", countryCode: "EU", title: "CPI y/y", impact: "high" as const, actual: "2.5", forecast: "2.4", previous: "2.3" };
    const second = { id: 2, time: 210, currency: "USD", countryCode: "US", title: "Core CPI y/y", impact: "medium" as const, actual: "2.7", forecast: "2.6", previous: "2.5" };
    const clustered = clusterPairMatrixMarkerViews([
      { key: "first", candleOpen: 100, impact: "high", position: "during", x: 101, placement: "center", events: [first], families: [{ factor, events: [first] }] },
      { key: "second", candleOpen: 200, impact: "medium", position: "during", x: 120, placement: "center", events: [second], families: [{ factor, events: [second] }] },
    ]);

    expect(clustered).toHaveLength(1);
    expect(clustered[0]).toMatchObject({ candleCount: 2, impact: "high" });
    expect(clustered[0].candleOpens).toEqual([100, 200]);
    expect(clustered[0].events.map((event) => event.title)).toEqual(["CPI y/y", "Core CPI y/y"]);
    expect(clustered[0].families[0].events).toHaveLength(2);
    expect(clustered[0].eventCandleOpenByKey.get("EUR:1:110:CPI y/y")).toBe(100);
    expect(clustered[0].eventCandleOpenByKey.get("USD:2:210:Core CPI y/y")).toBe(200);
  });

  it("renders event overlay controls inside the chart settings drawer", () => {
    const html = renderToStaticMarkup(
      createElement(ChartSettingsDrawer, {
        open: true,
        mode: "events",
        onModeChange: () => {},
        onClose: () => {},
        preferences: DEFAULT_CHART_PREFERENCES,
        onCursorModeChange: () => {},
        onPreserveZoomChange: () => {},
        onAppearanceChange: () => {},
        onEventOverlayChange: () => {},
        onResetAppearance: () => {},
        replayData: {
          defaultSpeed: 1,
          stepCandles: 1,
          futureCandleOpacity: 0.6,
          speedOptions: [0.5, 1, 2, 4],
          stepOptions: [1, 2, 4, 8],
          onDefaultSpeedChange: () => {},
          onStepCandlesChange: () => {},
          onFutureCandleOpacityChange: () => {},
        },
      }),
    );

    expect(html).toContain("Events");
    expect(html).toContain("Show event rail");
    expect(html).toContain("Current chart settings summary");
    expect(html).toContain("Surface");
    expect(html).toContain("Replay");
    expect(html).toContain("Impact");
    expect(html).toContain("High only");
    expect(html).toContain("High + medium");
    expect(html).toContain("Max markers");
    expect(html).toContain("Loaded upcoming events");
    expect(html).toContain("Show next scheduled");
    expect(html).toContain("Pair Matrix markers / side");
    expect(html).toContain("Selected pair");
    expect(html).toContain("All currencies");

    const replayHtml = renderToStaticMarkup(
      createElement(ChartSettingsDrawer, {
        open: true,
        mode: "replay",
        onModeChange: () => {},
        onClose: () => {},
        preferences: DEFAULT_CHART_PREFERENCES,
        onCursorModeChange: () => {},
        onPreserveZoomChange: () => {},
        onAppearanceChange: () => {},
        onEventOverlayChange: () => {},
        onResetAppearance: () => {},
        replayData: {
          defaultSpeed: 1,
          stepCandles: 1,
          futureCandleOpacity: 0.6,
          speedOptions: [0.5, 1, 2, 4],
          stepOptions: [1, 2, 4, 8],
          onDefaultSpeedChange: () => {},
          onStepCandlesChange: () => {},
          onFutureCandleOpacityChange: () => {},
        },
      }),
    );
    const appearanceHtml = renderToStaticMarkup(
      createElement(ChartSettingsDrawer, {
        open: true,
        mode: "appearance",
        onModeChange: () => {},
        onClose: () => {},
        preferences: DEFAULT_CHART_PREFERENCES,
        onCursorModeChange: () => {},
        onPreserveZoomChange: () => {},
        onAppearanceChange: () => {},
        onEventOverlayChange: () => {},
        onResetAppearance: () => {},
      }),
    );

    expect(replayHtml).toContain("Future candle opacity");
    expect(appearanceHtml).not.toContain("Experimental");
    expect(appearanceHtml).toContain("Keep horizontal zoom when changing symbol or timeframe");
    expect(appearanceHtml).not.toContain("Pair compare");
    expect(appearanceHtml).not.toContain("Macro surprise");
  });

  it("derives session detail only from the active market status", () => {
    expect(getChartSessionDetail(null).label).toBe("Session unavailable");

    expect(
      getChartSessionDetail({
        symbol: "EURUSD",
        symbol_path: null,
        asset_class: "forex",
        session_state: "open",
        is_open: true,
        terminal_connected: true,
        checked_at: 0,
        server_time: null,
        last_tick_time: null,
        next_open_time: null,
        next_close_time: null,
        reason: null,
      }),
    ).toMatchObject({
      label: "Scheduled session closes in N/A",
    });

    expect(
      getChartSessionDetail({
        symbol: "EURUSD",
        symbol_path: null,
        asset_class: "forex",
        session_state: "closed",
        is_open: false,
        terminal_connected: true,
        checked_at: 0,
        server_time: null,
        last_tick_time: null,
        next_open_time: null,
        next_close_time: null,
        reason: null,
      }),
    ).toMatchObject({
      label: "Scheduled session opens in N/A",
    });
  });
});
