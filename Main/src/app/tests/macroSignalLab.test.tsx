import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MacroSignalLabView } from "@/app/tabs/secondary/MacroSignalLabTab";
import type {
  MacroSignalBacktestRun,
  MacroSignalCoverage,
  MacroSignalForwardPaper,
  MacroSignalExpansionReport,
  MacroSignalMetrics,
  MacroSignalVersion,
} from "@/app/types";

const metrics: MacroSignalMetrics = {
  candidateCount: 40,
  directionalCount: 38,
  evaluableCount: 35,
  targetHitCount: 14,
  stopHitCount: 17,
  expiredCount: 4,
  ambiguousCount: 2,
  unevaluableCount: 1,
  targetHitRate: 0.4,
  stopHitRate: 17 / 35,
  expiredRate: 4 / 35,
  ambiguousRate: 2 / 38,
  averageR: 0.18,
  medianR: -0.1,
  expectancyCi95: { lower: 0.02, upper: 0.34 },
  targetHitCi95: { lower: 0.25, upper: 0.56 },
};

const coverage: MacroSignalCoverage = {
  count: 640,
  earliest: 1_500_000_000,
  latest: 1_780_000_000,
  currencies: [],
  durable: true,
  versionId: "FMS-EURUSD-ECO-H4-v1",
  backfillRecommended: false,
  recommendedBackfill: {
    currenciesList: "USD,EUR",
    lookBackDays: 10000,
    maxEventsPerCurrency: 10000,
    restoreLookBackDays: 400,
  },
};

const version: MacroSignalVersion = {
  id: "FMS-EURUSD-ECO-H4-v1",
  hash: "1234567890abcdef",
  createdAt: 1_776_000_000,
  configuration: {},
};

const v2Version: MacroSignalVersion = {
  id: "FMS-EURUSD-LABOR-H4-v2",
  hash: "abcdef1234567890",
  createdAt: 1_780_045_252,
  configuration: { seriesIdentity: "currency_country_code_normalized_title" },
  active: true,
};

const forwardPaper: MacroSignalForwardPaper = {
  versionId: v2Version.id,
  activatedAt: 1_787_047_068,
  elapsedDays: 0,
  immutable: true,
  lastSuccessfulCycleAt: 1_787_047_100,
  lastCycleFailedBatches: 0,
  observationCount: 3,
  caseCount: 1,
  directionalCount: 1,
  monitoringCount: 1,
  completedCount: 0,
  noDirectionCount: 0,
  lateForContractCount: 0,
  targets: { "1.0": metrics, "1.5": metrics, "2.0": metrics },
  checks: { minimumElapsedDays: false, minimumEvaluable: false, maximumAmbiguousRate: true, positiveExpectancyLower95: false, costModel: false },
  eligible: false,
  gate: {},
  recentCases: [],
};

const stressMetrics = {
  attemptedCount: 40,
  evaluableCount: 38,
  targetHitCount: 18,
  stopHitCount: 17,
  expiredCount: 3,
  ambiguousCount: 2,
  unevaluableCount: 0,
  targetHitRate: 18 / 38,
  stopHitRate: 17 / 38,
  expiredRate: 3 / 38,
  ambiguousRate: 2 / 40,
  grossAverageR: 0.35,
  stressedAverageR: 0.3,
  stressedMedianR: 0.2,
  stressedExpectancyCi95: { lower: 0.01, upper: 0.59 },
};

const pathSummary = {
  holdingCandles: 30,
  evaluableCount: 40,
  mfeR: { minimum: 0, p25: 0.8, median: 1.7, mean: 2, p75: 2.8, p90: 4, maximum: 7 },
  maeR: { minimum: 0, p25: 0.3, median: 0.9, mean: 1, p75: 1.4, p90: 2, maximum: 4 },
  timeToMfeCandles: { minimum: 1, p25: 4, median: 9, mean: 10, p75: 15, p90: 22, maximum: 30 },
  timeToMaeCandles: { minimum: 1, p25: 3, median: 8, mean: 9, p75: 14, p90: 20, maximum: 30 },
  adverseBeforeFavorableRate: 0.45,
  thresholdReach: [{ thresholdR: 2, count: 18, rate: 0.45 }],
};

const robustnessVariant = {
  sourceVersionId: "v7",
  signature: "long|USD:pmi_manufacturing",
  label: "US manufacturing PMI",
  direction: "long" as const,
  currentRegistered: false,
  dimension: "evidenceMode" as const,
  dimensionLabel: "S/M evidence",
  cohort: "agreement",
  reaction: "continuation" as const,
  cohortFingerprint: "cohort123",
  historicalN: 48,
  selectedOn: "development_only" as const,
  selectedConfiguration: { stopAtr: 2, targetR: 3, holdingCandles: 60, overall: stressMetrics, development: stressMetrics, holdout: stressMetrics, recent: stressMetrics, yearStability: { evaluableYears: 11, positiveYears: 8, positiveYearShare: 8 / 11 } },
  configurationStability: { neighbourhoodCount: 12, definition: "adjacent grid", development: { count: 12, positiveCount: 10, positiveShare: 10 / 12, minimumR: -0.1, medianR: 0.2, maximumR: 0.5 }, holdout: { count: 12, positiveCount: 11, positiveShare: 11 / 12, minimumR: -0.1, medianR: 0.3, maximumR: 0.6 }, recent: { count: 12, positiveCount: 11, positiveShare: 11 / 12, minimumR: -0.1, medianR: 0.3, maximumR: 0.6 } },
  checks: { overallAverageR: true },
  passesExploratoryScreen: true,
  passesStrictHoldoutCheck: false,
};

const expansionReport: MacroSignalExpansionReport = {
  schemaVersion: 6,
  generatedAt: 1_780_000_000,
  modelId: "FMS-EURUSD-MULTI-H4-CQ-v10",
  researchVersionId: "FMS-EURUSD-NUMERIC-ROBUST-H4-v11",
  protocol: {
    pathHorizonCandles: 30,
    maximumPathHorizonCandles: 60,
    thresholdsR: [0.5, 1, 2, 3, 4],
    stopAtrValues: [1, 2],
    targetRValues: [1, 2],
    holdingCandles: [6, 30],
    entry: "first_h4_open_strictly_after_release",
    selection: "development only",
    exploratoryScreen: "fixed screen",
    intrabar: "ambiguous",
    stressPips: 3,
    primaryWindowDays: 3650,
  },
  protocolHash: "abcdef1234567890",
  sourceVersions: ["v5"],
  sourceRunIds: ["run-5"],
  researchPriceCutoff: 1_780_000_000,
  candleCoverage: { count: 30_000, earliest: 1_500_000_000, latest: 1_780_000_000 },
  configurationsTested: 23_004,
  baseConfigurationsTested: 23_004,
  robustnessConfigurationsTested: 648,
  signaturesTested: 71,
  robustnessVariantsTested: 1,
  robustnessLeads: [robustnessVariant],
  candidateCount: 64,
  candidates: [
    {
      sourceVersionId: "v5",
      signature: "short|EUR:consumer_sentiment",
      label: "Euro-area consumer sentiment",
      direction: "short",
      groups: ["EUR:consumer_sentiment"],
      exampleTitles: ["Consumer Confidence"],
      historicalN: 44,
      currentRegistered: true,
      currentPatternId: "sentiment-short",
      registeredExecution: { stopAtr: 1, targetR: 2, expiryCandles: 30 },
      path30: pathSummary,
      path60: { ...pathSummary, holdingCandles: 60 },
      selectedOn: "development_only",
      selectedConfiguration: { stopAtr: 2, targetR: 1, holdingCandles: 30, overall: stressMetrics, development: stressMetrics, holdout: stressMetrics, recent: stressMetrics, yearStability: { evaluableYears: 11, positiveYears: 7, positiveYearShare: 7 / 11 } },
      configurationStability: { neighbourhoodCount: 12, definition: "adjacent grid", development: { count: 12, positiveCount: 10, positiveShare: 10 / 12, minimumR: -0.1, medianR: 0.2, maximumR: 0.5 }, holdout: { count: 12, positiveCount: 11, positiveShare: 11 / 12, minimumR: -0.1, medianR: 0.3, maximumR: 0.6 }, recent: { count: 12, positiveCount: 11, positiveShare: 11 / 12, minimumR: -0.1, medianR: 0.3, maximumR: 0.6 } },
      checks: { overallAverageR: true },
      passesExploratoryScreen: true,
      passesStrictHoldoutCheck: false,
      numericRobustness: { versionId: "FMS-EURUSD-NUMERIC-ROBUST-H4-v11", variantsTested: 0, variants: [] },
      reusedHistory: true,
    },
    {
      sourceVersionId: "v5",
      signature: "long|USD:producer_inflation",
      label: "Core PPI m/m package",
      direction: "long",
      groups: ["USD:producer_inflation"],
      exampleTitles: ["Core PPI m/m"],
      historicalN: 46,
      currentRegistered: false,
      currentPatternId: null,
      registeredExecution: null,
      path30: pathSummary,
      path60: { ...pathSummary, holdingCandles: 60 },
      selectedOn: "development_only",
      selectedConfiguration: { stopAtr: 2, targetR: 1.25, holdingCandles: 18, overall: stressMetrics, development: stressMetrics, holdout: stressMetrics, recent: stressMetrics, yearStability: { evaluableYears: 11, positiveYears: 9, positiveYearShare: 9 / 11 } },
      configurationStability: { neighbourhoodCount: 18, definition: "adjacent grid", development: { count: 18, positiveCount: 17, positiveShare: 17 / 18, minimumR: -0.1, medianR: 0.3, maximumR: 0.7 }, holdout: { count: 18, positiveCount: 18, positiveShare: 1, minimumR: 0.1, medianR: 0.5, maximumR: 0.8 }, recent: { count: 18, positiveCount: 18, positiveShare: 1, minimumR: 0.1, medianR: 0.5, maximumR: 0.8 } },
      checks: { overallAverageR: true },
      passesExploratoryScreen: true,
      passesStrictHoldoutCheck: false,
      numericRobustness: { versionId: "FMS-EURUSD-NUMERIC-ROBUST-H4-v11", variantsTested: 0, variants: [] },
      reusedHistory: true,
    },
  ],
  limitations: ["Reused history"],
  cached: true,
};

const run: MacroSignalBacktestRun = {
  id: "run-1",
  versionId: version.id,
  datasetFingerprint: "dataset",
  createdAt: 1_780_000_100,
  status: "completed",
  error: null,
  result: {
    resultSchemaVersion: 2,
    versionId: version.id,
    versionHash: version.hash,
    datasetFingerprint: "dataset",
    eventFingerprint: "events",
    generatedAt: 1_780_000_100,
    symbol: "EURUSD",
    timeframe: "H4",
    status: "research",
    costs: "Gross simulation; costs excluded.",
    coverage: {
      count: coverage.count,
      earliest: coverage.earliest,
      latest: coverage.latest,
      currencies: coverage.currencies,
      coverageDays: 3240,
    },
    priceCoverage: {
      count: 12_000,
      earliest: 1_500_000_000,
      latest: 1_780_000_000,
      coversPrimaryWindow: true,
    },
    candidateSummary: {
      allPackages: 40,
      directional: 38,
      noDirection: 2,
      primaryWindowStart: 1_500_000_000,
      developmentHoldoutBoundary: 1_700_000_000,
    },
    targets: {
      "1.0": { overall: metrics, development: metrics, holdout: metrics, outcomes: [] },
      "1.5": { overall: metrics, development: metrics, holdout: metrics, outcomes: [] },
      "2.0": {
        overall: metrics,
        development: metrics,
        holdout: metrics,
        outcomes: [{
          eventTime: 1_750_000_000,
          direction: "long",
          agreement: "conflicted_weak",
          pairVote: 1,
          backgroundDirection: "short",
          backgroundPairVote: -1,
          backgroundAlignment: "conflicted",
          highestImpact: "high",
          targetR: 2,
          factorVotes: [],
          events: [{
            id: 1,
            time: 1_750_000_000,
            currency: "EUR",
            countryCode: "EU",
            title: "GDP q/q",
            impact: "high",
            actual: "2.0",
            forecast: "1.5",
            previous: "1.0",
            ruleId: "gdp",
            ruleLabel: "GDP",
            factor: "activity",
            scoreGroup: "gdp",
            surprisePoint: 1,
            momentumPoint: 1,
            agreementBonus: 1,
            score: 3,
          }],
          status: "ambiguous",
          resultR: null,
          reason: "Both touched — order unknown",
          entryTime: 1_750_010_000,
          entry: 1.1,
          atr: 0.01,
          stop: 1.09,
          target: 1.12,
        }],
      },
    },
    eligibility: {
      eligible: false,
      checks: {
        coverage: true,
        priceCoverage: true,
        holdoutSample: true,
        developmentExpectancy: true,
        holdoutExpectancyLower95: false,
        ambiguity: false,
      },
      gate: {},
    },
    robustness: { fullAvailable: metrics, byYear: [] },
    cohorts: {
      agreement: [{ key: "conflicted_weak", metrics, development: metrics, holdout: metrics }],
      backgroundAlignment: [{ key: "conflicted", metrics, development: metrics, holdout: metrics }],
      impact: [{ key: "high", metrics, development: metrics, holdout: metrics }],
      factor: [{ key: "activity", metrics, development: metrics, holdout: metrics }],
      exactSeries: [{ key: "EUR · GDP q/q", metrics, development: metrics, holdout: metrics }],
    },
    dataQuality: {
      pairRows: 640,
      historicalRows: 620,
      futureScheduledRows: 20,
      registeredEconomyRows: 300,
      scoredEconomyRows: 280,
      unregisteredHistoricalRows: 320,
      candidatePackages: 40,
      missingActualRows: 5,
      missingForecastRows: 12,
      missingPreviousRows: 4,
      unparsableActualRows: 0,
      unparsableForecastRows: 1,
      unparsablePreviousRows: 0,
      duplicateExactSeriesTimestampRows: 0,
      countryTitleCollisionRows: 0,
      countryTitleCollisionGroups: [],
      seriesIdentity: "currency + title (legacy v1)",
      countryScope: "all EUR/USD country sources",
      registeredByFactor: [{ factor: "activity", rows: 100 }],
    },
    conclusion: {
      code: "no_validated_edge",
      title: "No validated edge in frozen v1",
      summary: "The frozen Economy-only rule did not pass its predeclared holdout gate. It must not be placed on Charts.",
      developmentAverageR: 0.08,
      holdoutAverageR: -0.04,
      holdoutExpectancyCi95: { lower: -0.1, upper: 0.02 },
      exploratoryFactorLeads: [{ key: "labor", developmentAverageR: 0.04, holdoutAverageR: 0.08, developmentN: 80, holdoutN: 40 }],
      selectionWarning: "Exploratory leads were noticed after viewing v1 and are not untouched validation evidence.",
    },
    forwardPaper: {
      start: 1_780_000_000,
      elapsedDays: 0,
      metrics,
      checks: { elapsedTime: false, sample: false, expectancyLower95: false, ambiguity: true, costModel: false },
      gate: {},
      eligible: false,
      outcomes: [],
    },
    limitations: ["Hypothetical results do not represent executed trades."],
  },
};

describe("Macro Signal Lab", () => {
  it("renders the frozen research contract and auditable 2R outcome without order language", () => {
    const html = renderToStaticMarkup(
      <MacroSignalLabView coverage={coverage} version={version} run={run} loading={false} error={null} onRun={() => {}} onRefresh={() => {}} />,
    );

    expect(html).toContain("Macro Signal Lab");
    expect(html).toContain("FMS-EURUSD-ECO-H4-v1");
    expect(html).toContain("Gross simulation");
    expect(html).toContain("Long bias");
    expect(html).toContain("Conflicted / weak");
    expect(html).toContain("Both touched — order unknown");
    expect(html).toContain("Paper-eligibility gate");
    expect(html).toContain("What v1 means");
    expect(html).toContain("No validated edge in frozen v1");
    expect(html).toContain("Development versus holdout");
    expect(html).toContain("Data-quality audit");
    expect(html).toContain("Ideas worth researching next—not proven signals");
    expect(html).not.toContain("Buy signal");
    expect(html).not.toContain("Sell signal");
  });

  it("shows the exact controlled backfill handoff when durable coverage is short", () => {
    const html = renderToStaticMarkup(
      <MacroSignalLabView
        coverage={{ ...coverage, count: 12, backfillRecommended: true }}
        version={version}
        run={null}
        loading={false}
        error={null}
        onRun={() => {}}
        onRefresh={() => {}}
      />,
    );

    expect(html).toContain("Historical backfill needed");
    expect(html).toContain("LookBackDays = 10000");
    expect(html).toContain("MaxEventsPerCur = 10000");
    expect(html).toContain("failed_batches=0");
  });

  it("exposes immutable version switching and the forward-only v2 boundary", () => {
    const v2Run: MacroSignalBacktestRun = {
      ...run,
      versionId: v2Version.id,
      result: run.result ? {
        ...run.result,
        versionId: v2Version.id,
        status: "exploratory_reused_history",
        conclusion: {
          ...run.result.conclusion,
          code: "forward_observation_required",
          title: "Exploratory history only — forward evidence required",
          summary: "Only post-registration observations count.",
        },
        dataQuality: {
          ...run.result.dataQuality,
          countryTitleCollisionRows: 7,
          seriesIdentity: "currency + country/region + title",
          countryScope: { EUR: ["EU"], USD: ["US"] },
        },
      } : null,
    };
    const html = renderToStaticMarkup(
      <MacroSignalLabView coverage={coverage} version={v2Version} versions={[version, v2Version]} run={v2Run} forwardPaper={forwardPaper} loading={false} error={null} onRun={() => {}} onRefresh={() => {}} onSelectVersion={() => {}} />,
    );

    expect(html).toContain("v1 · Economy baseline");
    expect(html).toContain("v2 · Country-aware Labor");
    expect(html).toContain("Automatic forward paper ledger");
    expect(html).toContain("Immutable first-seen releases only");
    expect(html).toContain("First-seen locked");
    expect(html).toContain("currency + country/region + title");
    expect(html).toContain("Collisions");
  });

  it("shows registered and potential setups in two functional tables", () => {
    const html = renderToStaticMarkup(
      <MacroSignalLabView coverage={coverage} version={version} run={run} expansionReport={expansionReport} loading={false} error={null} onRun={() => {}} onRefresh={() => {}} />,
    );

    expect(html).toContain("Path and exit stress research");
    expect(html).toContain("Registered setups");
    expect(html).toContain("Potential setups · not registered");
    expect(html).toContain("Frozen exit");
    expect(html).toContain("Best tested exit");
    expect(html).toContain("Registered v10");
    expect(html).toContain("Passed screen");
    expect(html).toContain("V11 numeric robustness cohorts");
    expect(html).toContain("S/M evidence");
    expect(html).toContain("US manufacturing PMI");
    expect(html).toContain("Charts stays v10");
    expect(html).not.toContain("Best next setup to discuss");
    expect(html).not.toContain("MFE");
  });
});
