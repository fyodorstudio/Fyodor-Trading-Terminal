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

const run: MacroSignalBacktestRun = {
  id: "run-1",
  versionId: version.id,
  datasetFingerprint: "dataset",
  createdAt: 1_780_000_100,
  status: "completed",
  error: null,
  result: {
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
      agreement: [{ key: "conflicted_weak", metrics }],
      backgroundAlignment: [{ key: "conflicted", metrics }],
      impact: [{ key: "high", metrics }],
      factor: [{ key: "activity", metrics }],
      exactSeries: [{ key: "EUR · GDP q/q", metrics }],
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
});
