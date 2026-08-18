export type MacroSignalDirection = "long" | "short" | "none";
export type MacroSignalRunStatus = "queued" | "running" | "completed" | "failed";

export interface MacroSignalCoverageCurrency {
  currency: string;
  count: number;
  earliest: number;
  latest: number;
}

export interface MacroSignalCoverage {
  count: number;
  earliest: number | null;
  latest: number | null;
  currencies: MacroSignalCoverageCurrency[];
  durable: boolean;
  versionId: string;
  backfillRecommended: boolean;
  recommendedBackfill: {
    currenciesList: string;
    lookBackDays: number;
    maxEventsPerCurrency: number;
    restoreLookBackDays: number;
  };
}

export interface MacroSignalVersion {
  id: string;
  hash: string;
  createdAt: number;
  configuration: Record<string, unknown>;
}

export interface MacroSignalMetrics {
  candidateCount: number;
  directionalCount: number;
  evaluableCount: number;
  targetHitCount: number;
  stopHitCount: number;
  expiredCount: number;
  ambiguousCount: number;
  unevaluableCount: number;
  targetHitRate: number | null;
  stopHitRate: number | null;
  expiredRate: number | null;
  ambiguousRate: number | null;
  averageR: number | null;
  medianR: number | null;
  expectancyCi95: { lower: number; upper: number } | null;
  targetHitCi95: { lower: number; upper: number } | null;
}

export interface MacroSignalFactorVote {
  currency: string;
  factor: string;
  score: number;
  vote: number;
  pairVote: number;
}

export interface MacroSignalScoredEvent {
  id: number;
  time: number;
  currency: string;
  title: string;
  impact: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  ruleId: string;
  ruleLabel: string;
  factor: string;
  scoreGroup: string;
  surprisePoint: number | null;
  momentumPoint: number | null;
  agreementBonus: number;
  score: number;
}

export interface MacroSignalOutcome {
  eventTime: number;
  direction: MacroSignalDirection;
  agreement: "consensus" | "conflicted_weak" | "no_direction";
  pairVote: number;
  backgroundDirection: MacroSignalDirection;
  backgroundPairVote: number;
  backgroundAlignment: "aligned" | "conflicted" | "neutral";
  highestImpact: string;
  targetR: number;
  factorVotes: MacroSignalFactorVote[];
  events: MacroSignalScoredEvent[];
  status: "target_hit" | "stop_hit" | "expired" | "ambiguous" | "unevaluable" | "no_direction";
  resultR: number | null;
  reason: string;
  entryTime?: number;
  exitTime?: number;
  entry?: number;
  atr?: number;
  stop?: number;
  target?: number;
}

export interface MacroSignalTargetResult {
  overall: MacroSignalMetrics;
  development: MacroSignalMetrics;
  holdout: MacroSignalMetrics;
  outcomes: MacroSignalOutcome[];
}

export interface MacroSignalCohortRow {
  key: string;
  metrics: MacroSignalMetrics;
}

export interface MacroSignalBacktestResult {
  versionId: string;
  versionHash: string;
  datasetFingerprint: string;
  eventFingerprint: string;
  generatedAt: number;
  symbol: "EURUSD";
  timeframe: "H4";
  status: "research" | "eligible_for_paper_validation";
  costs: string;
  coverage: {
    count: number;
    earliest: number | null;
    latest: number | null;
    currencies: MacroSignalCoverageCurrency[];
    coverageDays: number;
  };
  priceCoverage: {
    count: number;
    earliest: number | null;
    latest: number | null;
    coversPrimaryWindow: boolean;
  };
  candidateSummary: {
    allPackages: number;
    directional: number;
    noDirection: number;
    primaryWindowStart: number | null;
    developmentHoldoutBoundary: number | null;
  };
  targets: Record<string, MacroSignalTargetResult>;
  eligibility: {
    eligible: boolean;
    checks: Record<string, boolean>;
    gate: Record<string, unknown>;
  };
  robustness: {
    latestFiveYears?: MacroSignalMetrics;
    earlierFiveYears?: MacroSignalMetrics;
    fullAvailable: MacroSignalMetrics;
    byYear: Array<{ year: number; metrics: MacroSignalMetrics }>;
  };
  cohorts: Record<string, MacroSignalCohortRow[]>;
  limitations: string[];
}

export interface MacroSignalBacktestRun {
  id: string;
  versionId: string;
  datasetFingerprint: string;
  createdAt: number;
  status: MacroSignalRunStatus;
  result: MacroSignalBacktestResult | null;
  error: string | null;
  cached?: boolean;
}
