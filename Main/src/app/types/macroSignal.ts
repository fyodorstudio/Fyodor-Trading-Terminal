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
      schema: "registered-reaction-profile-v1";
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
  };
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
  };
  stopAtr?: number;
  targetR?: number;
  expiryCandles: number;
  entry?: number | null;
  atr?: number | null;
  stop?: number | null;
  target?: number | null;
  outcomeStatus?: MacroSignalOutcomeStatus | null;
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
    status: "awaiting_observation" | "qualified" | "no_trade" | "pre_activation_audit";
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
  currentPatternCount?: number;
  researchPatternCount?: number;
  realtime?: MacroSignalRealtimeWatch;
  policyInflationContext?: MacroSignalPolicyInflationContext;
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
    status: "qualified" | "no_trade";
    direction: "long" | "short" | null;
    assessment: MacroSignalPatternAssessment;
    signal: MacroSignalChartSignal | null;
  }>;
  researchIntelligence: MacroSignalResearchIntelligence[];
  explanation: string;
}
