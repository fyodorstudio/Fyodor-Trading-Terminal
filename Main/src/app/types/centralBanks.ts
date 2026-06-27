export interface EventMatcherRule {
  exactTitles: string[];
  includeAll: string[][];
  excludeAny: string[];
}

export interface MetricMatcherRule {
  primary: EventMatcherRule;
  fallback?: EventMatcherRule | null;
}

export interface MetricEventScope {
  matcher: MetricMatcherRule;
  countryCodes?: string[];
}

export interface MetricRuleSet {
  current: MetricEventScope;
  nextSchedule?: MetricEventScope | null;
}

export type MetricSourceKind = "released_actual" | "upcoming_previous" | "none";

export interface CentralBankMappingRule {
  currency: string;
  countryCode: string;
  bankName: string;
  flag: string;
  policyRate: MetricRuleSet;
  inflation: MetricRuleSet;
}

export interface CentralBankSnapshot {
  currency: string;
  countryCode: string;
  bankName: string;
  flag: string;
  currentPolicyRate: string | null;
  previousPolicyRate: string | null;
  currentInflationRate: string | null;
  previousInflationRate: string | null;
  policyRateSource: MetricSourceKind;
  policyRateSourceTitle: string | null;
  policyRateSourceTime: number | null;
  inflationSource: MetricSourceKind;
  inflationSourceTitle: string | null;
  inflationSourceTime: number | null;
  lastRateReleaseAt: number | null;
  lastCpiReleaseAt: number | null;
  nextRateEventAt: number | null;
  nextRateEventTitle: string | null;
  nextCpiEventAt: number | null;
  nextCpiEventTitle: string | null;
  status: "ok" | "partial" | "missing";
  notes: string[];
}

export interface CentralBankDeriveResult {
  snapshots: CentralBankSnapshot[];
  logs: string[];
}
