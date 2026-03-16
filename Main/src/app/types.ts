export type TabId = "overview" | "dashboard" | "strength-meter" | "central-banks" | "charts" | "calendar";

export type ImpactLevel = "low" | "medium" | "high";

export type BridgeStatus = "loading" | "live" | "no_data" | "stale" | "error";

export type MarketSessionState = "open" | "closed" | "unavailable";

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1" | "MN1";

export interface BridgeCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BridgeSymbol {
  name: string;
  path: string | null;
}

export interface BridgeHealth {
  ok: boolean;
  terminal_connected: boolean;
  last_calendar_ingest_at?: number | null;
  calendar_events_count?: number;
  last_error?: {
    code?: number;
    message?: string;
  } | null;
}

export interface MarketStatusResponse {
  symbol: string;
  symbol_path: string | null;
  asset_class: string | null;
  session_state: MarketSessionState;
  is_open: boolean | null;
  terminal_connected: boolean;
  checked_at: number;
  server_time: number | null;
  last_tick_time: number | null;
  next_open_time: number | null;
  next_close_time: number | null;
  reason: string | null;
}

export interface CalendarEvent {
  id: number;
  time: number;
  countryCode: string;
  currency: string;
  title: string;
  impact: ImpactLevel;
  actual: string;
  forecast: string;
  previous: string;
}

export interface CalendarQueryState {
  preset: DatePreset;
  from: Date | null;
  to: Date | null;
  impacts: ImpactLevel[];
  countries: string[];
  search: string;
}

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

export interface DashboardCurrencySnapshot {
  currency: string;
  countryCode: string;
  bankName: string;
  flag: string;
  currentPolicyRate: number | null;
  previousPolicyRate: number | null;
  currentInflationRate: number | null;
  previousInflationRate: number | null;
  sourceStatus: CentralBankSnapshot["status"];
  unresolvedFields: string[];
}

export interface FxPairDefinition {
  name: string;
  base: string;
  quote: string;
}

export type DashboardSortMode = "absDesc" | "absAsc" | "default";
export type StrengthSuggestionSortMode = "spreadDesc" | "spreadAsc";

export interface DashboardRateCard {
  pair: FxPairDefinition;
  currentGap: number | null;
  previousGap: number | null;
  trend: number | null;
  isWidening: boolean | null;
  status: "ok" | "partial" | "missing";
}

export interface DashboardInflationCard {
  pair: FxPairDefinition;
  bias: number | null;
  status: "ok" | "missing";
}

export interface StrengthCurrencyRank {
  currency: string;
  countryCode: string;
  score: number;
  rateScore: number;
  inflationScore: number;
  currentPolicyRate: number;
  currentInflationRate: number;
}

export interface SuggestedStrengthPair {
  strong: StrengthCurrencyRank;
  weak: StrengthCurrencyRank;
  spread: number;
}

export type DatePreset =
  | "today"
  | "this_week"
  | "next_week"
  | "last_week"
  | "this_month"
  | "before_today"
  | "custom";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}
