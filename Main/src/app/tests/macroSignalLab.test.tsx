import { renderToStaticMarkup } from "react-dom/server";
// @ts-expect-error Vitest runs this source-contract check in Node; the app intentionally does not ship Node typings.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MacroSignalLabView } from "@/app/tabs/secondary/MacroSignalLabTab";
import type { FmsCatalogItem, FmsExperiment, FmsWorkbench, MacroSignalStressMetrics } from "@/app/types";

const metrics: MacroSignalStressMetrics = {
  attemptedCount: 42,
  evaluableCount: 40,
  targetHitCount: 18,
  stopHitCount: 18,
  expiredCount: 4,
  ambiguousCount: 2,
  unevaluableCount: 0,
  targetHitRate: .45,
  stopHitRate: .45,
  expiredRate: .1,
  ambiguousRate: 2 / 42,
  grossAverageR: .31,
  stressedAverageR: .24,
  stressedMedianR: .1,
  stressedExpectancyCi95: { lower: -.02, upper: .5 },
};

const selectedConfiguration = {
  stopAtr: 2,
  targetR: 3,
  holdingCandles: 60,
  overall: metrics,
  development: { ...metrics, stressedAverageR: .39 },
  holdout: { ...metrics, stressedAverageR: .59 },
  recent: { ...metrics, stressedAverageR: .47 },
  yearStability: { evaluableYears: 11, positiveYears: 8, positiveYearShare: 8 / 11 },
};

const catalogItem: FmsCatalogItem = {
  id: "catalog-1",
  sourceVersionId: "FMS-EURUSD-GROWTH-H4-v7",
  signature: "long|EUR:pmi_manufacturing",
  signatures: ["long|EUR:pmi_manufacturing"],
  label: "Euro-area manufacturing PMI",
  direction: "long",
  family: "pmi manufacturing",
  groups: ["EUR:pmi_manufacturing"],
  exactTitles: ["Manufacturing PMI"],
  historicalN: 48,
  registered: false,
  registeredExecution: null,
  directionVariants: [{
    direction: "long",
    signature: "long|EUR:pmi_manufacturing",
    historicalN: 48,
    treatments: [
      { id: "base", dimension: "none", value: "all", reaction: "continuation", label: "All matching cases", historicalN: 48 },
      { id: "agreement", dimension: "evidenceMode", value: "agreement", reaction: "continuation", label: "S/M evidence: agreement", historicalN: 42 },
    ],
  }],
  treatments: [
    { id: "base", dimension: "none", value: "all", reaction: "continuation", label: "All matching cases", historicalN: 48 },
    { id: "agreement", dimension: "evidenceMode", value: "agreement", reaction: "continuation", label: "S/M evidence: agreement", historicalN: 42 },
  ],
};

const experiment: FmsExperiment = {
  id: "FMS-EURUSD-H4-E001",
  friendlyName: "EUR PMI Agreement",
  createdAt: 1_780_000_000,
  status: "completed",
  configuration: {
    sourceVersionId: catalogItem.sourceVersionId,
    signature: catalogItem.signature,
    scoringPolicy: "forecast_quality",
    cohort: { dimension: "evidenceMode", value: "agreement" },
    reaction: "continuation",
    execution: { mode: "matrix", stopAtrValues: [1, 2], targetRValues: [1, 2], holdingCandles: [18, 30] },
    entry: "first_h4_open_strictly_after_release",
    sourceRunIds: ["run-v7"],
    researchPriceCutoff: 1_780_000_000,
    candleRevision: "30000:1780000000",
  },
  configurationHash: "experimenthash",
  catalogSnapshot: catalogItem,
  datasetFingerprint: "dataset",
  error: null,
  result: {
    experimentId: "FMS-EURUSD-H4-E001",
    generatedAt: 1_780_000_100,
    sourceVersionId: catalogItem.sourceVersionId,
    signature: catalogItem.signature,
    scoringPolicy: "forecast_quality",
    cohort: { dimension: "evidenceMode", value: "agreement" },
    reaction: "continuation",
    historicalN: 42,
    splitTime: 1_700_000_000,
    selection: "development_lower95_then_average",
    configurationsTested: 8,
    configurations: [selectedConfiguration, { ...selectedConfiguration, stopAtr: 1, targetR: 2, holdingCandles: 30 }],
    selectedConfiguration,
    configurationStability: {
      neighbourhoodCount: 8,
      definition: "adjacent grid",
      development: { count: 8, positiveCount: 7, positiveShare: 7 / 8, minimumR: -.1, medianR: .2, maximumR: .6 },
      holdout: { count: 8, positiveCount: 8, positiveShare: 1, minimumR: .1, medianR: .4, maximumR: .8 },
      recent: { count: 8, positiveCount: 8, positiveShare: 1, minimumR: .1, medianR: .4, maximumR: .8 },
    },
    path: {
      holdingCandles: 60,
      evaluableCount: 42,
      mfeR: { minimum: 0, p25: .8, median: 2.1, mean: 2.4, p75: 3, p90: 4, maximum: 7 },
      maeR: { minimum: 0, p25: .3, median: .9, mean: 1, p75: 1.4, p90: 2, maximum: 4 },
      timeToMfeCandles: { minimum: 1, p25: 4, median: 9, mean: 10, p75: 15, p90: 22, maximum: 30 },
      timeToMaeCandles: { minimum: 1, p25: 3, median: 8, mean: 9, p75: 14, p90: 20, maximum: 30 },
      adverseBeforeFavorableRate: .45,
      thresholdReach: [{ thresholdR: 2, count: 18, rate: .45 }],
    },
    sequentialAccount: { takenTrades: 35, cumulativeStressedR: 8.2, maximumDrawdownR: 3.1, skippedOverlap: 4, skippedConflict: 0, drawdownBasis: "intratrade_mae_when_available", resultsR: [2, -1], grossResultsR: [2, -1] },
    checks: { overallAverageR: true, holdoutLower95Positive: false },
    passesExploratoryScreen: true,
    passesStrictHoldoutCheck: false,
    forecastQualityAudit: { excludedForecastCount: 2 },
    limitations: ["Reused history"],
    configurationHash: "experimenthash",
    datasetFingerprint: "dataset",
    catalogSnapshot: catalogItem,
  },
};

const workbench: FmsWorkbench = {
  currentModel: {
    id: "FMS-EURUSD-FORECAST-GUARD-H4-v13",
    friendlyName: "Forecast Guard",
    displayId: "Legacy v13",
    hash: "modelhash",
    activatedAt: 1_787_714_200,
    timeframe: "H4",
    registeredSetups: [{
      id: "sentiment",
      label: "Euro-area consumer sentiment",
      condition: "Directional sentiment",
      sourceVersionId: "FMS-EURUSD-SENTIMENT-H4-v3",
      signatures: ["long|EUR:consumer_sentiment", "short|EUR:consumer_sentiment"],
      scoringPolicy: "baseline",
      reaction: "continuation",
      cohort: { dimension: "none", value: "all" },
      execution: { stopAtr: 1, targetR: 2, expiryCandles: 30 },
      registrationEvidence: {
        scoringPolicy: "baseline",
        cohort: { dimension: "none", value: "all" },
        reaction: "continuation",
        evaluable: 99,
        targetFirst: 40,
        stopFirst: 57,
        expired: 2,
        stressedAverageR: .133,
        developmentAverageR: .068,
        holdoutAverageR: .327,
        recentAverageR: .523,
        positiveYears: 8,
        evaluatedYears: 11,
        stressPips: 3,
      },
    }],
  },
  catalog: { items: [catalogItem], advancedTreatmentsReady: true, generatedAt: 1_780_000_000 },
  protocol: { stopAtrValues: [.5, 1, 2], targetRValues: [.5, 1, 2, 4], holdingCandles: [6, 18, 30, 60], scoringPolicies: ["baseline", "momentum_only", "forecast_quality"], entry: "first_h4_open_strictly_after_release", selection: "development_lower95_then_average" },
  experiments: [],
  candidates: [],
  archive: [{ id: "FMS-EURUSD-ECO-H4-v1", createdAt: 1_776_000_000, configuration: {}, configurationHash: "legacyhash", latestRun: { id: "run-v1", createdAt: 1_780_000_000, status: "completed", datasetFingerprint: "legacydata", error: null } }],
  reactionAtlas: {
    version: "FMS-SEVEN-PAIR-REACTION-ATLAS-v1",
    artifactHash: "atlashash",
    generatedAt: 1_780_000_000,
    counts: { historically_profitable_candidate: 1, directional_contender: 2, avoid_standalone_direction: 3, insufficient_evidence: 4 },
    rows: [{ id: "atlas-1", label: "Industrial output", classification: "historically_profitable_candidate", classificationLabel: "Historically profitable candidate", policy: "forecast_quality", reaction: "continuation", historicalN: 105, horizonH4: 3, holdoutAverageR: .12, recentAverageR: .16 }],
  },
  dataPeriods: {
    durableCalendar: { start: 1_168_126_200, end: 1_795_554_000 },
    workbenchResearch: { start: 1_471_564_800, end: 1_787_241_600 },
    h4Prices: { start: 1_168_041_600, end: 1_787_241_600 },
  },
  datasetFingerprint: "dataset",
  sourceRunIds: ["run-v7"],
  candleRevision: "30000:1780000000",
};

describe("FMS Experiment Workbench", () => {
  it("renders the guarded builder and current model without primary legacy switching", () => {
    const html = renderToStaticMarkup(<MacroSignalLabView workbench={workbench} selectedExperiment={null} loading={false} running={false} error={null} onRun={() => {}} onSelectExperiment={() => {}} onFreeze={() => {}} onRefresh={() => {}} />);
    expect(html).toContain("FMS Experiment Workbench");
    expect(html).toContain("Forecast Guard · Legacy v13");
    expect(html).toContain("Choose economic setup");
    expect(html).toContain("Single Contract");
    expect(html).toContain("Combined Contracts");
    expect(html).toContain("SL (ATR)");
    expect(html).toContain("TP (R + ATR)");
    expect(html).toContain("Maximum trade duration (H4 candles)");
    expect(html).toContain("Run recorded experiment");
    expect(html).toContain("How to use the Workbench");
    expect(html).toContain("Research Archive");
    expect(html).toContain("Current registered setups");
    expect(html).toContain("Reaction Atlas");
    expect(html).toContain("fms-inspector");
    expect(html).not.toContain("Historically profitable candidate");
    expect(html).toContain("How each release is scored");
    expect(html).toContain("Cases included");
    expect(html).toContain("How Forecast Guard works");
    expect(html).toContain("Durable EUR/USD calendar");
    expect(html).toContain("Workbench research cases");
    expect(html).toContain("Stored H4 prices");
    expect(html).toContain("2007 → 2026");
    expect(html).not.toContain("Source research versions");
    expect(html).not.toContain("Promote to Charts");
  });

  it("shows the original registration evidence and current safeguard for a registered signature", () => {
    const registeredCatalog = {
      ...catalogItem,
      sourceVersionId: "FMS-EURUSD-SENTIMENT-H4-v3",
      signature: "long|EUR:consumer_sentiment",
      signatures: ["long|EUR:consumer_sentiment", "short|EUR:consumer_sentiment"],
      label: "Euro-area consumer sentiment",
      family: "consumer sentiment",
      groups: ["EUR:consumer_sentiment"],
      exactTitles: ["Consumer Confidence Index"],
      historicalN: 99,
      registered: true,
      registeredExecution: { stopAtr: 1, targetR: 2, expiryCandles: 30 },
      direction: "both",
      directionVariants: [
        { direction: "long", signature: "long|EUR:consumer_sentiment", historicalN: 48, treatments: catalogItem.treatments },
        { direction: "short", signature: "short|EUR:consumer_sentiment", historicalN: 51, treatments: catalogItem.treatments },
      ],
    } satisfies FmsCatalogItem;
    const html = renderToStaticMarkup(<MacroSignalLabView workbench={{ ...workbench, catalog: { ...workbench.catalog, items: [registeredCatalog] } }} selectedExperiment={null} loading={false} running={false} error={null} onRun={() => {}} onSelectExperiment={() => {}} onFreeze={() => {}} onRefresh={() => {}} />);
    expect(html).toContain("Registered recipe");
    expect(html).toContain("Why it was registered");
    expect(html).toContain("99 cases");
    expect(html).toContain("40 target first");
    expect(html).toContain("Charts and Shadow Trader use this exact frozen scoring, reaction, and execution recipe.");
    expect(html).toContain("Long · N 48");
    expect(html).toContain("Short · N 51");
    expect(html).toContain("Both directions · N 99");
  });

  it("renders auditable results, handoff actions, and failed-gate freeze acknowledgement", () => {
    const html = renderToStaticMarkup(<MacroSignalLabView workbench={{ ...workbench, experiments: [experiment] }} selectedExperiment={experiment} loading={false} running={false} error={null} onRun={() => {}} onSelectExperiment={() => {}} onFreeze={() => {}} onRefresh={() => {}} />);
    expect(html).toContain("FMS-EURUSD-H4-E001");
    expect(html).toContain("Copy AI summary");
    expect(html).toContain("Download JSON");
    expect(html).toContain("View raw data");
    expect(html).toContain("TP 3R = 6 ATR");
    expect(html).toContain("Recorded recipe");
    expect(html).toContain("Immutable configuration");
    expect(html).toContain("Forecast Guard");
    expect(html).not.toContain("Forecast Quality");
    expect(html).toContain("Price reaction");
    expect(html).toContain("Continuation");
    expect(html).toContain("First strictly later H4 open");
    expect(html).toContain("Independent simulations · no partial exits");
    expect(html).toContain("2 Forecasts flagged unreliable");
    expect(html).toContain("Development");
    expect(html).toContain("Holdout");
    expect(html).toContain("Gross sequential account replay");
    expect(html).toContain("Freeze for review");
    expect(html).toContain("I acknowledge the failed checks");
    expect(html).not.toContain("Promote to Charts");
  });

  it("keeps the full-screen tutorial focused on the guarded E to C to M workflow", () => {
    const source = readFileSync(
      new URL("../components/FmsWorkbenchTutorial.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Recorded experiment");
    expect(source).toContain("Frozen candidate");
    expect(source).toContain("Reviewed Charts model");
    expect(source).toContain("E</strong> = test it");
    expect(source).toContain("C</strong> = shortlist it");
    expect(source).toContain("M</strong> = approve it for Charts");
    expect(source).toContain("does not mean better performance");
    expect(source).toContain("Surprise / Momentum");
    expect(source).toContain("MFE / MAE");
    expect(source).toContain("Combined Contracts");
    expect(source).toContain("Raw data audit");
    expect(source).toContain("Development");
    expect(source).toContain("Holdout");
    expect(source).toContain("Copy AI summary");
    expect(source).toContain("spread, commission, slippage, and swap");
    expect(source).toContain("role=\"dialog\"");
    expect(source).toContain("aria-modal=\"true\"");
    const rawAuditSource = readFileSync(
      new URL("../components/FmsRawDataAudit.tsx", import.meta.url),
      "utf8",
    );
    expect(rawAuditSource).toContain("Raw experiment audit");
    expect(rawAuditSource).toContain("Cases included");
    expect(rawAuditSource).toContain("Forecast unreliable");
    expect(rawAuditSource).toContain("TP first");
    expect(rawAuditSource).toContain("role=\"dialog\"");
    expect(rawAuditSource).toContain("aria-modal=\"true\"");
  });
});
