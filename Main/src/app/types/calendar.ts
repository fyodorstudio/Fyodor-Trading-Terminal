import type { EventQualityFamily } from "@/app/types/eventQuality";

export type ImpactLevel = "low" | "medium" | "high";

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

export interface CalendarNavigationIntent {
  eventKey: string;
  eventId: number;
  eventTime: number;
  currency: string;
  title: string;
  countryCode: string;
  source: "overview" | "strength-meter";
}

export interface CalendarEventExplainer {
  family: EventQualityFamily | "generic";
  familyLabel: string;
  knowledgeDepth?: "specific" | "family" | "generic";
  marketSensitivity?: string;
  whatItIs: string;
  whyTradersCare: string;
  mayAffect: string[];
  priceCaveats: string[];
  educationalSummary: string;
  strongerOutcome: string;
  weakerOutcome: string;
  contextNote: string;
  releaseStatus?: string;
  resultSnapshot?: string;
  resultInterpretation?: string;
  whatToCompare?: string[];
  tradingWorkflow?: string[];
  commonTraps?: string[];
}

export interface CalendarQueryState {
  preset: DatePreset;
  from: Date | null;
  to: Date | null;
  impacts: ImpactLevel[];
  countries: string[];
  search: string;
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
