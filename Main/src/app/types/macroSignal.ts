export type MacroSignalDirection = "long" | "short" | "none";
export type MacroSignalRunStatus = "queued" | "running" | "completed" | "failed";
export type MacroSignalOutcomeStatus = "target_hit" | "stop_hit" | "expired" | "ambiguous" | "unevaluable" | "no_direction" | "pending";

export interface MacroSignalDistribution {
  minimum: number | null;
  p25: number | null;
  median: number | null;
  mean: number | null;
  p75: number | null;
  maximum: number | null;
}

export interface MacroSignalMarketContext {
  schema: "fms-market-context-v1";
  knownAt: number;
  eventTime: number;
  price: {
    regime: "uptrend" | "downtrend" | "range" | "transition" | "insufficient_history";
    relationToSignal: "aligned" | "opposed" | "neutral";
    shortChangeAtr: number | null;
    mediumChangeAtr: number | null;
    method: string;
  };
  volatility: {
    regime: "compressed" | "normal" | "expanded" | "extreme" | "insufficient_history";
    percentile: number | null;
    priorCount: number;
    method: string;
  };
  supportResistance: {
    method: string;
    lookbackCandles: number;
    confirmedZoneCount: number;
    support: null | MacroSignalPriceZone;
    resistance: null | MacroSignalPriceZone;
    directionalBarrier: null | MacroSignalPriceZone;
    directionalRoomAtr: number | null;
    roomState: "open" | "limited" | "blocked";
  };
  macroBackground: {
    direction: "long" | "short" | "none" | "unknown";
    pairVote: number | null;
    relationToSignal: "aligned" | "conflicted" | "neutral" | "unknown";
    method: string;
  };
  releaseEnvironment: {
    session: "asia" | "europe" | "us";
    packageSize: number;
    highestImpact?: "low" | "medium" | "high" | null;
  };
  limitations: string[];
}

export interface MacroSignalPriceZone {
  kind?: "support" | "resistance";
  level: number;
  touches: number;
  distanceAtr: number;
  touchTimes?: number[];
  lastTouchedAt?: number | null;
  medianRejectionAtr?: number | null;
  strength?: "confirmed" | "strong";
}

export interface MacroSignalContextResearch {
  schema: "fms-context-challenger-v1";
  researchExperimentId?: string;
  recipe: string;
  registryRevision: string;
  configurationHash: string;
  candleFingerprint: string;
  datasetFingerprint: string;
  activeArrowPreserved: true;
  dimensions: Array<{
    dimension: "priceRegime" | "trendRelation" | "volatilityRegime" | "directionalRoom" | "macroBackground" | "releaseSession";
    value: string;
    historicalN: number;
    developmentReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    laterReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    developmentExecution: Record<string, number | null>;
    laterExecution: Record<string, number | null>;
    outsideDevelopmentReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    outsideLaterReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    outsideDevelopmentExecution: Record<string, number | null>;
    outsideLaterExecution: Record<string, number | null>;
    developmentExecutionUpliftR: number;
    laterExecutionUpliftR: number;
    developmentAlignmentUplift: number;
    laterAlignmentUplift: number;
    status: "insufficient" | "promising_context" | "no_stable_improvement";
  }>;
  selection: string;
  selectedCandidate: null | {
    dimension: "priceRegime" | "trendRelation" | "volatilityRegime" | "directionalRoom" | "macroBackground" | "releaseSession";
    value: string;
    status: "later_supported" | "later_rejected";
    selectionBasis: string;
    developmentReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    laterReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    developmentExecution: Record<string, number | null>;
    laterExecution: Record<string, number | null>;
    outsideLaterReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    outsideLaterExecution: Record<string, number | null>;
    developmentExecutionUpliftR: number;
    laterExecutionUpliftR: number;
    developmentAlignmentUplift: number;
    laterAlignmentUplift: number;
    activeArrowChanged: false;
  };
  minimumSamples: { development: number; later: number };
  baseline: {
    developmentReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    laterReaction: { evaluableN: number; alignmentRate: number | null; medianAtr: number | null; averageAtr: number | null; ci95: { lower: number | null; upper: number | null } };
    developmentExecution: Record<string, number | null>;
    laterExecution: Record<string, number | null>;
  };
  activeContract: { managementFamily: string; stopAtr: number; targetR: number; holdingCandles: number; managementTriggerR: number | null };
  conditionedExecution?: {
    schema: "fms-context-conditioned-execution-v1";
    status: "not_run" | "research_only" | "approved_for_code_review";
    reason?: string;
    parentBehaviorWhenContextDoesNotMatch?: "retain_parent";
    condition?: { dimension: string; value: string; knownAt: "entry" };
    selectedExecutionSource?: "parent_contract" | "context_challenger";
    selectedExecution?: MacroSignalExecutionContract;
    selectedDevelopment?: Record<string, unknown> | null;
    selectedLater?: Record<string, unknown> | null;
    activeContextLater?: Record<string, unknown> | null;
    checks?: Record<string, boolean>;
  };
  activeRegistryPreserved: true;
}

export interface MacroSignalExecutionContract {
  stopAtr: number;
  targetR: number;
  expiryCandles: number;
  managementFamily?: "fixed" | "break_even";
  managementTriggerR?: number | null;
}

export interface MacroSignalContextRegistration {
  id: string;
  modelId: "FMS-CONTEXT-CONDITIONAL-H4-v1";
  status: "reviewed_active" | "blocked_artifact_mismatch";
  activatedAt: number;
  parentPatternId?: string;
  market?: string;
  condition?: { dimension: string; value: string; knownAt: "entry" };
  execution?: MacroSignalExecutionContract;
  parentBehaviorWhenContextDoesNotMatch?: "retain_parent";
  configurationHash?: string;
  researchExperimentId?: string;
  candleFingerprint?: string;
  datasetFingerprint?: string;
  development?: Record<string, unknown> | null;
  later?: Record<string, unknown> | null;
  parentOnSameContextLater?: Record<string, unknown> | null;
  reaction?: Record<string, unknown> | null;
  relationship?: string;
  limitations?: string;
  reason?: string;
}

export interface MacroSignalReactionContractAudit {
  stopAtr: number;
  targetR: number;
  holdingCandles: number;
  developmentAverageR: number | null;
  laterAverageR: number | null;
  laterTargetRate: number | null;
  laterStopRate: number | null;
}

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
  status: MacroSignalOutcomeStatus;
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

export interface MacroSignalPathDistribution {
  minimum: number | null;
  p25: number | null;
  median: number | null;
  mean: number | null;
  p75: number | null;
  p90: number | null;
  maximum: number | null;
}

export interface MacroSignalPathSummary {
  holdingCandles: number;
  evaluableCount: number;
  mfeR: MacroSignalPathDistribution;
  maeR: MacroSignalPathDistribution;
  timeToMfeCandles: MacroSignalPathDistribution;
  timeToMaeCandles: MacroSignalPathDistribution;
  adverseBeforeFavorableRate: number | null;
  thresholdReach: Array<{ thresholdR: number; count: number; rate: number | null }>;
  unmanagedCloseR?: MacroSignalPathDistribution;
  unmanagedPositiveRate?: number | null;
  directionalRoomAtr?: MacroSignalPathDistribution;
  supportResistanceCoverageRate?: number | null;
}

export interface MacroSignalStressMetrics {
  attemptedCount: number;
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
  grossAverageR: number | null;
  stressedAverageR: number | null;
  stressedMedianR: number | null;
  stressedExpectancyCi95: { lower: number; upper: number } | null;
}

export interface MacroSignalStressConfiguration {
  stopAtr: number;
  targetR: number;
  holdingCandles: number;
  overall: MacroSignalStressMetrics;
  development: MacroSignalStressMetrics;
  holdout: MacroSignalStressMetrics;
  recent: MacroSignalStressMetrics;
  yearStability: {
    evaluableYears: number;
    positiveYears: number;
    positiveYearShare: number;
  };
}

export interface MacroSignalConfigurationStabilityPartition {
  count: number;
  positiveCount: number;
  positiveShare: number | null;
  minimumR: number | null;
  medianR: number | null;
  maximumR: number | null;
}

export interface MacroSignalStressCandidate {
  sourceVersionId: string;
  signature: string;
  label: string;
  direction: "long" | "short";
  groups: string[];
  exampleTitles: string[];
  historicalN: number;
  currentRegistered: boolean;
  currentPatternId: string | null;
  registeredExecution?: {
    stopAtr: number;
    targetR: number;
    expiryCandles: number;
  } | null;
  registeredConfiguration?: MacroSignalStressConfiguration | null;
  path30: MacroSignalPathSummary;
  path60: MacroSignalPathSummary;
  selectedOn: "development_only";
  selectedConfiguration: MacroSignalStressConfiguration;
  configurationStability: {
    neighbourhoodCount: number;
    definition: string;
    development: MacroSignalConfigurationStabilityPartition;
    holdout: MacroSignalConfigurationStabilityPartition;
    recent: MacroSignalConfigurationStabilityPartition;
  };
  checks: Record<string, boolean>;
  passesExploratoryScreen: boolean;
  passesStrictHoldoutCheck: boolean;
  numericRobustness: {
    versionId: string;
    variantsTested: number;
    variants: MacroSignalRobustnessVariant[];
  };
  reusedHistory: true;
}

export interface MacroSignalRobustnessVariant {
  sourceVersionId?: string;
  signature?: string;
  label?: string;
  direction?: "long" | "short";
  currentRegistered?: boolean;
  dimension: "evidenceMode" | "revisionReliability" | "packageCompleteness" | "backgroundAlignment" | "scoreStrength" | "reaction";
  dimensionLabel: string;
  cohort: string;
  reaction: "continuation" | "contrarian";
  cohortFingerprint: string;
  historicalN: number;
  selectedOn: "development_only";
  selectedConfiguration: MacroSignalStressConfiguration;
  configurationStability: {
    neighbourhoodCount: number;
    definition: string;
    development: MacroSignalConfigurationStabilityPartition;
    holdout: MacroSignalConfigurationStabilityPartition;
    recent: MacroSignalConfigurationStabilityPartition;
  };
  checks: Record<string, boolean>;
  passesExploratoryScreen: boolean;
  passesStrictHoldoutCheck: boolean;
}

export interface MacroSignalExpansionReport {
  schemaVersion: number;
  generatedAt: number;
  modelId: string;
  researchVersionId: string;
  protocol: {
    pathHorizonCandles: number;
    maximumPathHorizonCandles: number;
    thresholdsR: number[];
    stopAtrValues: number[];
    targetRValues: number[];
    holdingCandles: number[];
    entry: string;
    selection: string;
    exploratoryScreen: string;
    intrabar: string;
    stressPips: number;
    primaryWindowDays: number;
  };
  protocolHash: string;
  sourceVersions: string[];
  sourceRunIds: string[];
  researchPriceCutoff: number;
  candleCoverage: { count: number; earliest: number | null; latest: number | null };
  configurationsTested: number;
  baseConfigurationsTested: number;
  robustnessConfigurationsTested: number;
  signaturesTested: number;
  robustnessVariantsTested: number;
  robustnessLeads: MacroSignalRobustnessVariant[];
  candidateCount: number;
  candidates: MacroSignalStressCandidate[];
  v12Challenger?: {
    versionId: string;
    selectedPolicy: "baseline" | "momentum_only" | "forecast_quality";
    policySelectionRule: string;
    policyComparisons: Array<{
      policy: "baseline" | "momentum_only" | "forecast_quality";
      signalCount: number;
      overall: MacroSignalStressMetrics;
      development: MacroSignalStressMetrics;
      holdout: MacroSignalStressMetrics;
      recent: MacroSignalStressMetrics;
      sequentialAccount: {
        takenTrades: number;
        cumulativeStressedR: number;
        maximumDrawdownR: number;
        skippedOverlap: number;
        skippedConflict: number;
        drawdownBasis: "intratrade_mae_when_available";
      };
    }>;
    forecastQualityAudits: Array<{
      sourceVersionId: string;
      excludedForecastCount: number;
      representativeExclusions: Array<{
        eventTime: number;
        currency: string;
        countryCode: string;
        title: string;
        actual: string | null;
        forecast: string | null;
        previous: string | null;
        gap: number;
        threshold: number;
        priorCount: number;
      }>;
      minimumHistory: number;
      madMultiplier: number;
      scaleMultiplier?: number;
    }>;
    candidateDefinitionsTested: number;
    candidates: Array<{
      id: string;
      label: string;
      sourceVersion: string;
      evidenceSignature: string;
      direction: "long" | "short";
      condition: string;
      historicalN: number;
      selectedConfiguration: MacroSignalStressConfiguration;
      configurationStability: MacroSignalStressCandidate["configurationStability"];
      prequentialAudit: { evaluableCount: number; stressedAverageR: number | null };
      boundaryAudit: { required: boolean; passed: boolean; configuration: MacroSignalStressConfiguration | null };
      path: MacroSignalPathSummary;
      typicalStopPips: number | null;
      typicalMfePips: number | null;
      typicalMaePips: number | null;
      checks: Record<string, boolean>;
      promoted: boolean;
    }>;
    promotedPatternIds: string[];
    registryDecision: "create_v12" | "retain_v10";
    reusedHistory: true;
  };
  limitations: string[];
  cached: boolean;
}

export type FmsExperimentStatus = "queued" | "running" | "completed" | "failed";
export type FmsResearchMarket = "EURUSD" | "GBPUSD" | "USDJPY" | "AUDUSD" | "USDCAD" | "NZDUSD" | "USDCHF";

export interface FmsCatalogTreatment {
  id: string;
  dimension: "none" | "evidenceMode" | "revisionReliability" | "packageCompleteness" | "backgroundAlignment" | "scoreStrength" | "relativeMagnitude" | "reaction";
  value: string;
  reaction: "continuation" | "contrarian";
  label: string;
  historicalN: number;
}

export interface FmsCatalogItem {
  market?: FmsResearchMarket;
  id: string;
  sourceVersionId: string;
  signature: string;
  label: string;
  signatures: string[];
  direction: "long" | "short" | "both";
  family: string;
  groups: string[];
  exactTitles: string[];
  historicalN: number;
  registered: boolean;
  registeredExecution: { stopAtr: number; targetR: number; expiryCandles: number } | null;
  directionVariants: Array<{
    direction: "long" | "short";
    signature: string;
    historicalN: number;
    treatments: FmsCatalogTreatment[];
  }>;
  treatments: FmsCatalogTreatment[];
}

export interface FmsExperimentConfiguration {
  market?: FmsResearchMarket;
  sourceVersionId: string;
  signature: string;
  signatures?: string[];
  directionSelection?: "long" | "short" | "both";
  scoringPolicy: "baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality";
  cohort: { dimension: FmsCatalogTreatment["dimension"]; value: string };
  reaction: "continuation" | "contrarian";
  execution: {
    mode: "single" | "matrix";
    stopAtrValues: number[];
    targetRValues: number[];
    holdingCandles: number[];
  };
  entry: "first_h4_open_strictly_after_release";
  sourceRunIds: string[];
  researchPriceCutoff: number;
  candleRevision: string;
}

export interface FmsExperimentResult {
  market?: FmsResearchMarket;
  experimentId: string;
  generatedAt: number;
  sourceVersionId: string;
  signature: string;
  signatures?: string[];
  directionSelection?: "long" | "short" | "both";
  scoringPolicy: string;
  cohort: { dimension: string; value: string };
  reaction: string;
  historicalN: number;
  splitTime: number;
  selection: string;
  configurationsTested: number;
  configurations?: MacroSignalStressConfiguration[];
  selectedConfiguration: MacroSignalStressConfiguration;
  configurationStability: MacroSignalStressCandidate["configurationStability"];
  path: MacroSignalPathSummary;
  pathByHorizon?: Record<string, MacroSignalPathSummary>;
  sequentialAccount: {
    takenTrades: number;
    cumulativeStressedR: number;
    maximumDrawdownR: number;
    skippedOverlap: number;
    skippedConflict: number;
    drawdownBasis: string;
    resultsR: number[];
    grossResultsR: number[];
  };
  checks: Record<string, boolean>;
  passesExploratoryScreen: boolean;
  passesStrictHoldoutCheck: boolean;
  forecastQualityAudit: { excludedForecastCount: number };
  limitations: string[];
  configurationHash: string;
  datasetFingerprint: string;
  catalogSnapshot: FmsCatalogItem;
  reusedResultFrom?: string;
}

export interface FmsRawContract {
  key: string;
  stopAtr: number;
  targetR: number;
  targetAtr: number;
  holdingCandles: number;
  overall: MacroSignalStressMetrics;
  development: MacroSignalStressMetrics;
  holdout: MacroSignalStressMetrics;
  recent: MacroSignalStressMetrics;
}

export interface FmsRawCaseEvent {
  currency?: string;
  countryCode?: string;
  title?: string;
  actual?: unknown;
  forecast?: unknown;
  previous?: unknown;
  surprisePoint?: number | null;
  momentumPoint?: number | null;
  surpriseRaw?: string | null;
  momentumRaw?: string | null;
  agreementBonus?: number | null;
  score?: number | null;
  forecastSuspect?: boolean;
  forecastGap?: number | null;
  forecastAnomalyThreshold?: number | null;
  scoringPolicy?: string;
  surpriseMagnitude?: FmsRelativeMagnitude;
  momentumMagnitude?: FmsRelativeMagnitude;
}

export interface FmsRelativeMagnitude {
  status: "unavailable" | "insufficient" | "ready";
  rawDelta?: number;
  absoluteDelta?: number;
  priorCount: number;
  minimumHistory?: number;
  percentile?: number;
  category?: "ordinary" | "large" | "exceptional";
  typicalAbsoluteDelta?: number;
  relativeToTypical?: number | null;
  robustDistance?: number | null;
  histogram?: Array<{ lower: number; upper: number; count: number; containsCurrent: boolean }>;
}

export interface FmsRawCase {
  caseId: string;
  eventTime: number;
  direction: "long" | "short";
  included: boolean;
  inclusionReason: string;
  forecastUnreliable: boolean;
  entryTime: number | null;
  entry: number | null;
  atr: number | null;
  supportResistance?: null | {
    method: string;
    lookbackCandles: number;
    confirmedZoneCount: number;
    support: null | { level: number; touches: number; distanceAtr: number };
    resistance: null | { level: number; touches: number; distanceAtr: number };
  };
  events: FmsRawCaseEvent[];
  simulation: null | {
    status: string;
    grossResultR: number | null;
    stressedResultR: number | null;
    exitTime: number | null;
    entryTime: number;
    entry: number;
    stop: number;
    target: number;
    stopAtr: number;
    targetR: number;
    targetAtr: number;
    holdingCandles: number;
  };
}

export interface FmsRawCasesPage {
  experimentId: string;
  datasetFingerprint: string;
  selectedContractKey: string;
  activeContractKey: string;
  contracts: FmsRawContract[];
  page: number;
  pageSize: number;
  total: number;
  rows: FmsRawCase[];
}

export interface FmsExperiment {
  id: string;
  friendlyName: string;
  createdAt: number;
  status: FmsExperimentStatus;
  configuration: FmsExperimentConfiguration;
  configurationHash: string;
  catalogSnapshot: FmsCatalogItem;
  datasetFingerprint: string;
  result: FmsExperimentResult | null;
  resultSummary?: Pick<FmsExperimentResult, "historicalN" | "selectedConfiguration" | "checks" | "passesExploratoryScreen" | "passesStrictHoldoutCheck"> | null;
  error: string | null;
}

export interface FmsExperimentListItem {
  id: string;
  friendlyName: string;
  createdAt: number;
  status: FmsExperimentStatus;
  configurationHash: string;
  catalogSnapshot: Pick<FmsCatalogItem, "id" | "label">;
  datasetFingerprint: string;
  error: string | null;
}

export interface FmsFrozenCandidate {
  id: string;
  experimentId: string;
  friendlyName: string;
  createdAt: number;
  failedGateAcknowledged: boolean;
  checks: Record<string, boolean>;
  configurationHash: string;
  datasetFingerprint: string;
  experimentStatus: FmsExperimentStatus;
  result: FmsExperimentResult;
  configuration: FmsExperimentConfiguration;
  catalogSnapshot: FmsCatalogItem;
}

export interface FmsLegacyArchiveItem {
  id: string;
  createdAt: number;
  configuration: Record<string, unknown>;
  configurationHash: string;
  latestRun: null | {
    id: string;
    createdAt: number;
    status: string;
    datasetFingerprint: string;
    error: string | null;
  };
}

export interface FmsWorkbench {
  market?: FmsResearchMarket;
  currentModel: {
    id: string;
    researchEngineId?: string;
    friendlyName: string;
    displayId: string;
    hash: string;
    activatedAt: number;
    timeframe: "H4";
    registeredSetups: Array<{
      id: string;
      label: string;
      condition: string;
      sourceVersionId: string;
      signatures: string[];
      scoringPolicy: "baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality";
      reaction: "continuation" | "contrarian";
      cohort: { dimension: string; value: string };
      execution: { stopAtr: number; targetR: number; expiryCandles: number };
      registrationEvidence: null | {
        scoringPolicy: "baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality";
        cohort: { dimension: string; value: string };
        reaction: "continuation" | "contrarian";
        evaluable: number;
        targetFirst: number;
        stopFirst: number;
        expired: number;
        stressedAverageR: number;
        developmentAverageR: number;
        holdoutAverageR: number;
        recentAverageR: number;
        positiveYears: number;
        evaluatedYears: number;
        stressPips: number;
      };
    }>;
  };
  catalog: {
    items: FmsCatalogItem[];
    advancedTreatmentsReady: boolean;
    generatedAt: number;
  };
  protocol: {
    stopAtrValues: number[];
    targetRValues: number[];
    holdingCandles: number[];
    scoringPolicies: Array<"baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality">;
    entry: string;
    selection: string;
  };
  experiments: FmsExperimentListItem[];
  candidates: FmsFrozenCandidate[];
  archive: FmsLegacyArchiveItem[];
  reactionAtlas?: null | {
    version: string;
    artifactHash: string;
    generatedAt: number;
    counts: Record<string, number>;
    rows: Array<{
      id: string;
      label: string;
      classification: "historically_profitable_candidate" | "directional_contender" | "avoid_standalone_direction" | "insufficient_evidence";
      classificationLabel: string;
      policy: string;
      reaction: "continuation" | "rejection";
      historicalN: number;
      horizonH4: number;
      holdoutAverageR: number | null;
      recentAverageR: number | null;
    }>;
  };
  contextFollowup?: {
    schema: "fms-context-followup-index-v1";
    generatedAt: number | null;
    refreshPolicy: string | null;
    recipesAudited: number;
    policyInflationSupported: number;
    boundedInteractionsSupported: number;
    transferCandidates: Array<{
      id: string; sourceRegistrationId: string; targetMarket: string; targetLabel: string;
      condition: { dimension?: string; value?: string };
      laterExecution: { evaluableN: number; averageR: number | null };
      laterReaction: { alignmentRate: number | null };
    }>;
    activeRegistryPreserved: true;
  };
  dataPeriods?: {
    durableCalendar: { start: number | null; end: number | null };
    workbenchResearch: { start: number | null; end: number | null };
    h4Prices: { start: number | null; end: number | null };
  };
  datasetFingerprint: string;
  sourceRunIds: string[];
  candleRevision: string;
  availability?: {
    ready: boolean;
    missingSourceVersions: string[];
    missingH4Prices: boolean;
    message: string;
  };
}

export interface MacroSignalChartPattern {
  id: string;
  market?: string;
  signature: string;
  signatures: string[];
  sourceVersionId: string;
  label: string;
  condition: string;
  scoringPolicy?: "baseline" | "surprise_only" | "momentum_only" | "agreement_no_bonus" | "forecast_quality";
  reaction?: "continuation" | "contrarian";
  cohort?: { dimension: string; value: string };
  historicalBenchmark?: null | {
    experimentId: string;
    historicalN: number;
    walkForwardN: number;
    walkForwardAverageR: number;
    targetFirstRate: number;
    stopFirstRate: number;
    status: "historically_profitable";
    basis?: "qualification_pooled" | "chronological_holdout";
    strength?: "stronger_history" | "positive_but_fragile";
  };
  reactionAudit?: null | {
    schema: "registered-reaction-audit-v1";
    scope: "chronological later-test cases";
    horizonCandles: number;
    evaluableN: number;
    directionWorkedTradeProfited: number;
    directionWorkedTradeLost: number;
    directionFailedTradeProfited: number;
    directionFailedTradeLost: number;
    positiveResponseRate: number;
    medianResponseR: number;
    profile?: {
      schema: "registered-reaction-profile-v1" | "registered-reaction-profile-v2";
      scope: "chronological later-test cases";
      experimentId: string;
      evaluableN: number;
      standardWindowCandles: number;
      classification: "continuation" | "short_lived_impulse" | "delayed_continuation" | "initial_rejection" | "volatility_only" | "no_dependable_reaction";
      horizons: Array<{
        holdingCandles: number;
        evaluableN: number;
        alignmentRate: number;
        atr: MacroSignalDistribution;
        r: MacroSignalDistribution;
        pips: MacroSignalDistribution;
      }>;
      mfe: { atr: MacroSignalDistribution; r: MacroSignalDistribution; pips: MacroSignalDistribution; timeCandles: MacroSignalDistribution };
      mae: { atr: MacroSignalDistribution; r: MacroSignalDistribution; pips: MacroSignalDistribution; timeCandles: MacroSignalDistribution };
      givebackAtr: MacroSignalDistribution;
      contractResearch: {
        selectionRule: string;
        status: "historically_improved_candidate" | "keep_frozen_contract";
        frozen: MacroSignalReactionContractAudit | null;
        developmentSelected: MacroSignalReactionContractAudit | null;
      };
      contextResearch?: MacroSignalContextResearch;
      executionChallenger?: {
        schema: "fms-execution-challenger-v1" | "fms-execution-challenger-v2";
        declaredConfigurationCount: number;
        selection: string;
        activeLater: Record<string, unknown> | null;
        familyWinners: Array<Record<string, unknown>>;
        bestChallenger: Record<string, unknown> | null;
        reviewWorthy: boolean;
        recipe: string;
        registryRevision: string;
        configurationHash: string;
        candleFingerprint: string;
        datasetFingerprint: string;
        activeContractPreserved: true;
        unresolvedByReason: Record<string, number>;
        costsExcluded: string[];
      };
    };
  };
  registrationProvenance?: {
    status: "verified" | "mismatch" | "unavailable" | "legacy_snapshot";
    experimentId: string | null;
    configurationHash: string | null;
    datasetFingerprint: string | null;
    qualificationAuditId: string | null;
    checks: Record<string, boolean>;
    note: string;
  };
  readiness?: {
    auditStatus: "complete" | "incomplete";
    historicalStatus: "historically_qualified" | "historically_positive_fragile" | "unverified";
    liveStatus: "not_live_validated";
    orientationAudited?: boolean;
    label: string;
    actionableInShadowTrader: boolean;
  };
  execution?: {
    stopAtr: number;
    targetR: number;
    expiryCandles: number;
    managementFamily?: "fixed" | "break_even";
    managementTriggerR?: number | null;
  };
  baseExecution?: null | {
    stopAtr: number;
    targetR: number;
    expiryCandles: number;
  };
  executionReview?: null | {
    status: "reviewed_active" | "blocked_artifact_mismatch";
    activatedAt: number;
    reason: string;
    limitations?: string;
    artifactSchema?: string;
    configurationHash?: string;
    candleFingerprint?: string;
    datasetFingerprint?: string;
    previousExecution?: { stopAtr: number; targetR: number; expiryCandles: number };
    currentExecution?: { stopAtr: number; targetR: number; expiryCandles: number; managementFamily: "fixed" | "break_even"; managementTriggerR: number | null };
    later?: Record<string, unknown>;
    nearbyStability?: Record<string, unknown>;
  };
  contextRegistration?: null | MacroSignalContextRegistration;
  requiredExactTitles?: string[];
  direction: "long" | "short" | "both";
  groups: string[];
  overall: MacroSignalMetrics;
  development: MacroSignalMetrics;
  holdout: MacroSignalMetrics;
  qualification: Record<string, number>;
  exampleTitles: string[];
  modelStatus: "current" | "research_only";
  currentEligible: boolean;
  modelChecks: Record<string, boolean>;
  executionStress: {
    pips: number;
    overall: MacroSignalMetrics;
    development: MacroSignalMetrics;
    holdout: MacroSignalMetrics;
    recent: MacroSignalMetrics;
  };
  recentWindow: { from: number; to: number; metrics: MacroSignalMetrics };
  yearStability: {
    evaluableYears: number;
    positiveYears: number;
    positiveYearShare: number;
    byYear: Array<{ year: number; metrics: MacroSignalMetrics }>;
  };
  prequentialAudit: {
    evaluableCount: number;
    gross: MacroSignalMetrics;
    executionStress: MacroSignalMetrics;
    firstEligibleEventTime: number | null;
    lastEligibleEventTime: number | null;
  };
  targetRobustness: Array<{
    targetR: number;
    gross: MacroSignalMetrics;
    executionStress: MacroSignalMetrics;
  }>;
  estimatedBreakEvenStressPips: number | null;
  uncertaintyIncludesNoEdge: boolean;
  selectionNote: string;
}

export type MacroSignalChartMode = "current" | "research_replay";

export interface MacroSignalChartSignal {
  id: string;
  observationMode?: "live_captured" | "recovered_offline" | "historical_replay";
  demoTag?: string;
  prospectiveCapture?: {
    eligible: boolean;
    reason: string;
    firstSeenAt: number | null;
    activationTime: number | null;
  } | null;
  releaseObservationQuote?: {
    bid: number;
    ask: number;
    spreadPrice: number;
    spreadPoints: number | null;
    quoteTime: number;
    capturedAt: number;
    entryLagSeconds: number;
    quality: "first_tick" | "near_entry" | "late_snapshot";
    source?: "first_tick_after_observation" | "current_snapshot";
    disclosure: string;
  } | null;
  entryTimingAudit?: {
    schema: "fms-prospective-entry-timing-v1";
    status: "prospective_observation_only";
    eventTime: number;
    firstSeenAt: number;
    firstSeenDelaySeconds: number;
    decisionAt: number | null;
    decisionDelaySeconds: number | null;
    processingDelaySeconds: number | null;
    quoteTime: number;
    quoteDelaySeconds: number;
    observedMid: number;
    entries: Array<{
      timeframe: "M1" | "H1" | "H4";
      status: "observed" | "waiting_for_candle" | "quote_captured_after_entry";
      entryTime: number | null;
      entryOpen: number | null;
      gapPips: number | null;
      directionAdjustedGapPips: number | null;
    }>;
    disclosure: string;
  } | null;
  patternId: string;
  sourceVersionId: string;
  eventTime: number;
  direction: "long" | "short";
  label: string;
  agreement: "consensus" | "conflicted_weak" | "no_direction";
  pairVote: number;
  backgroundDirection: MacroSignalDirection;
  backgroundPairVote: number;
  backgroundAlignment: "aligned" | "conflicted" | "neutral";
  backgroundCoverageComplete: boolean;
  highestImpact: "high" | "medium" | "low";
  events: MacroSignalScoredEvent[];
  activationTime: number | null;
  execution?: {
    stopAtr: number;
    targetR: number;
    expiryCandles: number;
    managementFamily?: "fixed" | "break_even";
    managementTriggerR?: number | null;
  };
  stopAtr?: number;
  targetR?: number;
  expiryCandles: number;
  entry?: number | null;
  atr?: number | null;
  stop?: number | null;
  initialStop?: number | null;
  target?: number | null;
  managementFamily?: "fixed" | "break_even";
  managementTriggerR?: number | null;
  breakEvenArmed?: boolean;
  outcomeStatus?: MacroSignalOutcomeStatus | null;
  outcomeReasonCode?: "waiting_for_entry_candle" | "trade_still_running" | "missing_atr_history" | "missing_outcome_candles" | "historical_price_data_unavailable" | "both_touched_order_unknown" | string | null;
  outcomeReason?: string | null;
  outcomeCoverage?: {
    requiredFrom: number | null;
    requiredTo: number | null;
    availableFrom: number | null;
    availableTo: number | null;
    requiredCandles: number | null;
    availableCandles: number;
  } | null;
  pendingLifecycle?: {
    phase: "waiting_entry" | "trade_running";
    asOf: number;
    entryTime?: number;
    requiredUntil: number;
  } | null;
  resultR?: number | null;
  exitTime?: number | null;
  expiryTime?: number | null;
  maximumAdverseR?: number | null;
  evidenceReaction?: "followed" | "rejected";
  pathAudit?: null | {
    evidenceReaction: "followed" | "rejected";
    reactionHorizonCandles: number;
    reactionResponseR: number | null;
    directionWorked: boolean | null;
    lossReview: Array<"favourable_then_giveback" | "target_not_reached_before_close" | "adverse_before_best_favourable_move" | "direction_not_working_at_six_h4" | "duration_ended_negative">;
    maximumFavorableR: number;
    maximumFavorablePips: number;
    maximumAdverseR: number;
    maximumAdversePips: number;
    timeToMfeCandles: number | null;
    timeToMaeCandles: number | null;
    givebackR: number | null;
    fixedHorizonResponses: Array<{ holdingCandles: number; responseR: number }>;
    targetLadder?: Array<{
      targetR: number;
      targetPrice: number;
      distanceAtr: number;
      distancePips: number;
      status: "target_before_sl" | "sl_before_target" | "ambiguous" | "not_reached" | "pending";
      reachedAt: number | null;
      timeToTargetCandles: number | null;
    }>;
  };
  marketContext?: MacroSignalMarketContext | null;
  contextOverlay?: null | {
    registrationId: string;
    modelId: "FMS-CONTEXT-CONDITIONAL-H4-v1";
    parentPatternId: string;
    condition: { dimension: string; value: string; knownAt: "entry" };
    observedValue: string | null;
    matched: boolean;
    activeForEvent: boolean;
    executionApplied: boolean;
    parentBehaviorWhenContextDoesNotMatch: "retain_parent";
    parentExecution: MacroSignalExecutionContract;
    contextExecution: MacroSignalExecutionContract;
    later?: Record<string, unknown> | null;
    parentOnSameContextLater?: Record<string, unknown> | null;
    reaction?: Record<string, unknown> | null;
    relationship?: string | null;
    limitations?: string | null;
  };
  historicalReplay: boolean;
}

export interface MacroSignalScheduledEvent {
  id: number;
  time: number;
  currency: string;
  countryCode: string;
  title: string;
  impact: "high" | "medium" | "low";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

export interface MacroSignalUpcomingPatternWatch {
    time: number;
    patternId: string;
    label: string;
    condition: string;
    sourceVersionId: string;
    requiredGroups: string[];
    events: MacroSignalScheduledEvent[];
}

export interface MacroSignalPatternAssessment {
    time: number;
    patternId: string;
    label: string;
    condition: string;
    status: "awaiting_observation" | "qualified" | "no_trade" | "pre_activation_audit" | "late_for_contract";
    direction: "long" | "short" | null;
    reason: string;
    events: MacroSignalScheduledEvent[];
    calculations?: Array<{
      title: string;
      actual: string | null;
      forecast: string | null;
      previous: string | null;
      surprisePoint: number | null;
      momentumPoint: number | null;
      agreementBonus: number;
      score: number;
      forecastSuspect?: boolean;
      forecastGap?: number | null;
      forecastAnomalyThreshold?: number | null;
      scoringPolicy?: string | null;
      surpriseMagnitude?: FmsRelativeMagnitude;
      momentumMagnitude?: FmsRelativeMagnitude;
    }>;
    prospectiveCapture?: {
      eligible: boolean;
      reason: string;
      firstSeenAt: number | null;
      activationTime: number | null;
    };
}

export interface MacroSignalRealtimeWatch {
  asOf: number;
  nextPairEvent: MacroSignalScheduledEvent | null;
  nextPatternWatch: MacroSignalUpcomingPatternWatch | null;
  latestPatternAssessment?: MacroSignalPatternAssessment | null;
  upcomingPatternWatches?: MacroSignalUpcomingPatternWatch[];
  latestPatternAssessments?: MacroSignalPatternAssessment[];
}

export interface MacroSignalPolicyInflationContext {
  asOf: number;
  currencies: Record<"EUR" | "USD", {
    policy: {
      state: "tightening" | "holding" | "easing" | "unresolved";
      time: number | null;
      title: string | null;
      actual: string | null;
      previous: string | null;
    };
    inflation: {
      state: "heating" | "cooling" | "mixed" | "no_change" | "unresolved";
      time: number | null;
      heatingGroups: number;
      coolingGroups: number;
      titles: string[];
    };
  }>;
  usage: string;
}

export interface MacroSignalChartSignalResponse {
  supported: boolean;
  versionId: string;
  versionHash?: string;
  modelId: string;
  modelHash: string;
  modelActivatedAt: number;
  datasetFingerprint?: string;
  mode: MacroSignalChartMode;
  symbol: string;
  timeframe: string;
  modelTimeframe: "H4";
  targetR: number;
  generatedAt?: number;
  patterns: MacroSignalChartPattern[];
  signals: MacroSignalChartSignal[];
  recoveredSignals?: MacroSignalChartSignal[];
  currentPatternCount?: number;
  researchPatternCount?: number;
  realtime?: MacroSignalRealtimeWatch;
  policyInflationContext?: MacroSignalPolicyInflationContext;
  contextConditionalModel?: {
    id: "FMS-CONTEXT-CONDITIONAL-H4-v1";
    activatedAt: number;
    registeredSetups: number;
  };
  evaluationSummary?: {
    evaluatedPackageCount: number;
    matchingPackageCount: number;
    latestEvaluatedAt: number | null;
    latestMatchedEventAt: number | null;
    latestArrowAt: number | null;
    laterUnmatchedPackageCount: number;
  };
  message: string;
}

export interface MacroSignalResearchIntelligence {
  id: string;
  status: "registered" | "contender" | "avoid" | "insufficient";
  market: string;
  label: string;
  evidence: string;
  conclusion: string;
}

export interface MacroSignalGlobalResponse {
  modelId: string;
  modelHash: string;
  generatedAt: number;
  markets: MacroSignalChartSignalResponse[];
  liveDecisions?: Array<{
    modelId: string;
    market: string;
    patternId: string;
    eventTime: number;
    firstDecidedAt: number;
    status: "qualified" | "no_trade" | "late_for_contract";
    direction: "long" | "short" | null;
    prospectiveEligible: boolean;
    eligibilityReason: string;
    assessment: MacroSignalPatternAssessment;
    signal: MacroSignalChartSignal | null;
  }>;
  prospectiveContextLedger?: {
    schema: "fms-prospective-context-ledger-v1";
    immutableFirstSeen: true;
    matchedDecisions: number;
    resolvedMatchedCases: number;
    usage: string;
    rows: Array<{
      registrationId: string;
      market: string;
      patternId: string;
      label: string;
      condition: { dimension?: string; value?: string; knownAt?: string };
      historicalExpectation: { evaluableN: number | null; averageR: number | null; alignmentRate: number | null };
      prospective: {
        matched: { decisionCount: number; resolvedCount: number; averageR: number | null; positiveRate: number | null };
        notMatched: { decisionCount: number; resolvedCount: number; averageR: number | null; positiveRate: number | null };
      };
    }>;
  };
  contextFollowupResearch?: {
    schema: "fms-context-followup-index-v1";
    generatedAt: number | null;
    refreshPolicy: string | null;
    recipesAudited: number;
    policyInflationCandidates: Array<{
      recipe: string; dimension: string; value: string; status: string;
      laterExecution: { evaluableN: number; averageR: number | null };
      laterReaction: { evaluableN: number; alignmentRate: number | null; averageAtr: number | null };
      laterExecutionUpliftR: number;
    }>;
    boundedInteractionCandidates: Array<{
      recipe: string; status: string;
      conditions: Array<{ dimension: string; value: string }>;
      laterExecution: { evaluableN: number; averageR: number | null };
      laterReaction: { evaluableN: number; alignmentRate: number | null; averageAtr: number | null };
      laterExecutionUpliftR: number;
    }>;
    crossMarketTransferCandidates: Array<{
      id: string; sourceRegistrationId: string; sourceMarket: string; targetMarket: string;
      targetPatternId: string; targetLabel: string; family: string; status: string;
      condition: { dimension?: string; value?: string };
      laterExecution: { evaluableN: number; averageR: number | null };
      laterReaction: { evaluableN: number; alignmentRate: number | null; averageAtr: number | null };
      laterExecutionUpliftR: number;
    }>;
    activeRegistryPreserved: true;
  };
  forwardValidation?: {
    schema: "fms-forward-validation-v1";
    status: "collecting_forward_evidence" | "paper_evidence_ready" | "real_money_evidence_ready" | "demo_monitoring_ready";
    modelId: string;
    startedAt: number;
    qualifiedDecisions: number;
    trackedCases: number;
    resolvedCases: number;
    pendingCases: number;
    ambiguousOrUnavailableCases: number;
    representedSetups: number;
    paperReadySetups: number;
    degradedSetups?: number;
    collectingSetups?: number;
    manualLimitedLiveReviewCandidates?: number;
    setupForwardGate?: {
      id: string;
      minimumResolvedCases: number;
      minimumElapsedDays: number;
      minimumNearEntryQuoteCoverage: number;
    };
    setupSummaries: Array<{
      market: string;
      patternId: string;
      resolvedCases: number;
      averageR: number | null;
      nearEntryQuoteCoverage: number | null;
      firstObservedAt?: number | null;
      lastObservedAt?: number | null;
      elapsedDays?: number;
      status?: "collecting" | "supportive" | "coverage_incomplete" | "degraded";
      statusReason?: string;
      eligibleForPaperReliance: boolean;
      demoCompletedTrades?: number;
      demoAverageNetR?: number | null;
      demoContractAdherent?: boolean;
      eligibleForManualLimitedLiveReview?: boolean;
      manualLimitedLiveReviewBlockers?: string[];
    }>;
    averageR: number | null;
    nearEntryQuoteCount: number;
    quoteEligibleCount: number;
    paperChecks: Record<string, boolean>;
    eligibleForPaperReliance: boolean;
    demoTradingChecks: Record<string, boolean>;
    eligibleForDemoTrading: boolean;
    realMoneyChecks: Record<string, boolean>;
    demoExecution?: {
      schema: "fms-demo-execution-v1";
      captureStatus: { status: string; accountLogin?: number | null; orderTransmission?: boolean };
      taggedDeals: number;
      matchedTrades: number;
      completedTrades: number;
      representedSetups: number;
      demoReadySetups: number;
      setupSummaries: Array<{
        market: string;
        patternId: string;
        completedTrades: number;
        averageNetR: number | null;
        contractAdherent: boolean;
        eligibleForDemoReliance: boolean;
      }>;
      openOrPartialTrades: number;
      totalNetAccountResult: number;
      averageGrossFillR: number | null;
      averageNetR: number | null;
      executionComparison?: {
        completedComparableTrades: number;
        entryComparableTrades: number;
        averageEntryDelaySeconds: number | null;
        averageAdverseEntryDifferenceR: number | null;
        averageGrossResultDifferenceR: number | null;
        averageExecutionCostsR: number | null;
        contractAdherentTrades: number;
        note: string;
      };
      riskPolicy: {
        id: string;
        maximumRiskPerTradePercent: number;
        maximumOpenTrades: number;
        maximumPortfolioRiskPercent: number;
        maximumPeakToTroughDrawdownPercent: number;
        maximumConsecutiveLosingTrades: number;
        stopRequired: boolean;
        scope: string;
        observed: boolean;
        riskKnownForEveryCompletedTrade: boolean;
        contractAdherentForEveryTrade: boolean;
        excessiveRiskObserved: boolean;
        contractViolationObserved: boolean;
        duplicateTagObserved: boolean;
        maximumOpenTradesObserved: number;
        maximumDrawdownAccount: number;
        maximumDrawdownPercent: number | null;
        maximumConsecutiveLosingTradesObserved: number;
        killSwitchImplemented: boolean;
        killSwitchTriggered: boolean;
        operationalTradingAllowed: boolean;
      };
      trades?: Array<{
        signalTag: string;
        accountLogin: number;
        market: string;
        patternId: string;
        eventTime: number;
        positionId: number;
        status: "completed" | "open_or_partial";
        entryTime: number | null;
        exitTime: number | null;
        entryPrice: number | null;
        exitPrice: number | null;
        volume: number;
        grossFillR: number | null;
        modelEntryPrice: number | null;
        modelEntryTime: number | null;
        entryDelaySeconds: number | null;
        entryDifferencePrice: number | null;
        entryDifferencePoints: number | null;
        entryDifferenceR: number | null;
        expectedGrossR: number | null;
        grossResultDifferenceR: number | null;
        initialRiskAccount: number | null;
        riskPercent: number | null;
        actualStop: number | null;
        actualTarget: number | null;
        directionMatches: boolean;
        stopMatches: boolean;
        targetMatches: boolean;
        lifecycleMatches: boolean;
        contractAdherent: boolean;
        netR: number | null;
        profit: number;
        commission: number;
        swap: number;
        fee: number;
        netAccountResult: number;
        executionCostsAccount: number;
        executionCostsR: number | null;
        dealCount: number;
      }>;
      orderTransmission: false;
      instructions: string;
    } | null;
    operationalPreflight?: {
      schema: "fms-operational-preflight-v1";
      checkedAt: number;
      lastSuccessfulCalendarCycleAt: number | null;
      calendarCycleAgeSeconds: number | null;
      failedCalendarBatches: number;
      calendarFresh: boolean;
      signalMonitoringReadyNow: boolean;
      blockingReasons: string[];
      orderTransmission: false;
    } | null;
    manualLimitedLiveReview?: {
      schema: "fms-manual-limited-live-review-v1";
      eligibleSetups: number;
      globalDemoRiskPolicyObserved: boolean;
      operationalPreflightReady: boolean;
      orderTransmission: false;
      decision: string;
    };
    eligibleForRealMoneyReliance: boolean;
    decision: string;
    limitations: string[];
  };
  researchIntelligence: MacroSignalResearchIntelligence[];
  outcomeReview?: {
    unresolvedByReason: Record<string, number>;
    executionReviews: Array<{
      market: string;
      patternId: string;
      label: string;
      status: "review_worthy" | "active_evidence_weakened";
      active: Record<string, number | string | boolean | null>;
      challenger: Record<string, number | string | boolean | null>;
      reason: string;
      artifact: string;
    }>;
  };
  explanation: string;
}
