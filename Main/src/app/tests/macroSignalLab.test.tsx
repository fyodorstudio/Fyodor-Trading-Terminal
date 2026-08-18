import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MacroSignalLabView } from "@/app/tabs/secondary/MacroSignalLabTab";
import type {
  MacroSignalBacktestRun,
  MacroSignalCoverage,
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
      <MacroSignalLabView coverage={coverage} version={v2Version} versions={[version, v2Version]} run={v2Run} loading={false} error={null} onRun={() => {}} onRefresh={() => {}} onSelectVersion={() => {}} />,
    );

    expect(html).toContain("v1 · Economy baseline");
    expect(html).toContain("v2 · Country-aware Labor");
    expect(html).toContain("Forward paper evidence");
    expect(html).toContain("Only post-registration releases count");
    expect(html).toContain("currency + country/region + title");
    expect(html).toContain("Collisions");
  });
});
