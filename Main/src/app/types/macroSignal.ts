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
  active?: boolean;
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
  pendingCount?: number;
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
  countryCode: string;
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
  status: "target_hit" | "stop_hit" | "expired" | "ambiguous" | "unevaluable" | "no_direction" | "pending";
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
  development: MacroSignalMetrics | null;
  holdout: MacroSignalMetrics | null;
}

export interface MacroSignalDataQuality {
  pairRows: number;
  historicalRows: number;
  futureScheduledRows: number;
  registeredEconomyRows: number;
  scoredEconomyRows: number;
  unregisteredHistoricalRows: number;
  candidatePackages: number;
  missingActualRows: number;
  missingForecastRows: number;
  missingPreviousRows: number;
  unparsableActualRows: number;
  unparsableForecastRows: number;
  unparsablePreviousRows: number;
  duplicateExactSeriesTimestampRows: number;
  countryTitleCollisionRows: number;
  countryTitleCollisionGroups: Array<{
    currency: string;
    normalizedTitle: string;
    title: string;
    time: number;
    rows: number;
    countryCodes: string[];
  }>;
  seriesIdentity: string;
  countryScope: Record<string, string[]> | string;
  registeredByFactor: Array<{ factor: string; rows: number }>;
}

export interface MacroSignalConclusion {
  code: "eligible_for_paper_validation" | "no_validated_edge" | "forward_observation_required" | "forward_paper_validated";
  title: string;
  summary: string;
  developmentAverageR: number | null;
  holdoutAverageR: number | null;
  holdoutExpectancyCi95: { lower: number; upper: number } | null;
  exploratoryFactorLeads: Array<{
    key: string;
    developmentAverageR: number;
    holdoutAverageR: number;
    developmentN: number;
    holdoutN: number;
  }>;
  selectionWarning: string;
}

export interface MacroSignalBacktestResult {
  resultSchemaVersion: number;
  versionId: string;
  versionHash: string;
  datasetFingerprint: string;
  eventFingerprint: string;
  generatedAt: number;
  symbol: "EURUSD";
  timeframe: "H4";
  status: "research" | "eligible_for_paper_validation" | "exploratory_reused_history";
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
    historicalGatePassed?: boolean;
    historicalEligibilityDisabled?: boolean;
  };
  forwardPaper: {
    start: number;
    elapsedDays: number;
    metrics: MacroSignalMetrics;
    checks: Record<string, boolean>;
    gate: Record<string, unknown>;
    eligible: boolean;
    outcomes: MacroSignalOutcome[];
  };
  robustness: {
    latestFiveYears?: MacroSignalMetrics;
    earlierFiveYears?: MacroSignalMetrics;
    fullAvailable: MacroSignalMetrics;
    byYear: Array<{ year: number; metrics: MacroSignalMetrics }>;
  };
  cohorts: Record<string, MacroSignalCohortRow[]>;
  dataQuality: MacroSignalDataQuality;
  conclusion: MacroSignalConclusion;
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

export interface MacroSignalForwardCase {
  versionId: string;
  eventTime: number;
  frozenAt: number;
  state: "monitoring" | "completed" | "no_direction" | "late_for_contract" | "unevaluable";
  candidate: {
    eventTime: number;
    direction: MacroSignalDirection;
    agreement: "consensus" | "conflicted_weak" | "no_direction";
    pairVote: number;
    events: MacroSignalScoredEvent[];
  };
  outcomes: Record<string, MacroSignalOutcome>;
  updatedAt: number;
}

export interface MacroSignalForwardPaper {
  versionId: string;
  activatedAt: number;
  elapsedDays: number;
  immutable: boolean;
  lastSuccessfulCycleAt: number | null;
  lastCycleFailedBatches: number;
  observationCount: number;
  caseCount: number;
  directionalCount: number;
  monitoringCount: number;
  completedCount: number;
  noDirectionCount: number;
  lateForContractCount: number;
  targets: Record<string, MacroSignalMetrics>;
  checks: Record<string, boolean>;
  eligible: boolean;
  gate: Record<string, unknown>;
  recentCases: MacroSignalForwardCase[];
}

export interface MacroSignalChartPattern {
  id: string;
  signature: string;
  label: string;
  direction: "long" | "short";
  groups: string[];
  overall: MacroSignalMetrics;
  development: MacroSignalMetrics;
  holdout: MacroSignalMetrics;
  qualification: Record<string, number>;
  exampleTitles: string[];
}

export interface MacroSignalChartSignal {
  id: string;
  patternId: string;
  eventTime: number;
  direction: "long" | "short";
  label: string;
  agreement: "consensus" | "conflicted_weak" | "no_direction";
  pairVote: number;
  events: MacroSignalScoredEvent[];
}

export interface MacroSignalChartSignalResponse {
  supported: boolean;
  versionId: string;
  versionHash?: string;
  symbol: string;
  timeframe: string;
  targetR: number;
  generatedAt?: number;
  patterns: MacroSignalChartPattern[];
  signals: MacroSignalChartSignal[];
  message: string;
}
