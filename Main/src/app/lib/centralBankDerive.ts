import { CENTRAL_BANK_RULES } from "@/app/config/currencyConfig";
import type {
  CalendarEvent,
  CentralBankDeriveResult,
  CentralBankMappingRule,
  CentralBankSnapshot,
  EventMatcherRule,
  MetricMatcherRule,
  MetricSourceKind,
} from "@/app/types";
import { parseNumericValue } from "@/app/lib/format";

interface ResolvedMetric {
  currentValue: string | null;
  previousValue: string | null;
  source: MetricSourceKind;
  sourceTitle: string | null;
  sourceTime: number | null;
  lastReleasedAt: number | null;
  nextEventAt: number | null;
  nextEventTitle: string | null;
  matchedCount: number;
  usedFallback: boolean;
  matchedPastActualCount: number;
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function matchesRule(title: string, rule: EventMatcherRule): boolean {
  const normalized = normalizeTitle(title);
  if (rule.excludeAny.some((token) => normalized.includes(token))) {
    return false;
  }

  if (rule.exactTitles.some((candidate) => normalizeTitle(candidate) === normalized)) {
    return true;
  }

  return rule.includeAll.some((group) => group.every((token) => normalized.includes(token)));
}

function hasUsableActual(event: CalendarEvent): boolean {
  return parseNumericValue(event.actual) != null || event.actual.trim() !== "";
}

function hasUsablePrevious(event: CalendarEvent): boolean {
  return parseNumericValue(event.previous) != null || event.previous.trim() !== "";
}

function sortDescByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => b.time - a.time);
}

function sortAscByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.time - b.time);
}

function firstPastActual(events: CalendarEvent[], now: number): CalendarEvent | null {
  return sortDescByTime(events.filter((event) => event.time <= now)).find(hasUsableActual) ?? null;
}

function firstUpcomingPrevious(events: CalendarEvent[], now: number): CalendarEvent | null {
  return sortAscByTime(events.filter((event) => event.time > now)).find(hasUsablePrevious) ?? null;
}

function previousReleasedActual(events: CalendarEvent[], beforeTime: number): CalendarEvent | null {
  return sortDescByTime(events.filter((event) => event.time < beforeTime)).find(hasUsableActual) ?? null;
}

function nextEvent(events: CalendarEvent[], now: number): CalendarEvent | null {
  return sortAscByTime(events.filter((event) => event.time > now))[0] ?? null;
}

function emptyMetric(events: CalendarEvent[], now: number): ResolvedMetric {
  const next = nextEvent(events, now);
  return {
    currentValue: null,
    previousValue: null,
    source: "none",
    sourceTitle: null,
    sourceTime: null,
    lastReleasedAt: null,
    nextEventAt: next?.time ?? null,
    nextEventTitle: next?.title ?? null,
    matchedCount: events.length,
    usedFallback: false,
    matchedPastActualCount: 0,
  };
}

function resolveMetric(events: CalendarEvent[]): ResolvedMetric {
  const now = Date.now() / 1000;
  if (events.length === 0) {
    return emptyMetric(events, now);
  }

  const pastActual = firstPastActual(events, now);
  const futurePrevious = firstUpcomingPrevious(events, now);
  const next = nextEvent(events, now);
  const matchedPastActualCount = events.filter((event) => event.time <= now && hasUsableActual(event)).length;

  if (pastActual) {
    const previousRelease = previousReleasedActual(events, pastActual.time);
    return {
      currentValue: pastActual.actual.trim() || null,
      previousValue: hasUsablePrevious(pastActual) ? pastActual.previous : previousRelease?.actual.trim() || null,
      source: "released_actual",
      sourceTitle: pastActual.title,
      sourceTime: pastActual.time,
      lastReleasedAt: pastActual.time,
      nextEventAt: next?.time ?? null,
      nextEventTitle: next?.title ?? null,
      matchedCount: events.length,
      usedFallback: false,
      matchedPastActualCount,
    };
  }

  if (futurePrevious) {
    const previousRelease = previousReleasedActual(events, futurePrevious.time);
    return {
      currentValue: futurePrevious.previous.trim() || null,
      previousValue: previousRelease?.actual.trim() || null,
      source: "upcoming_previous",
      sourceTitle: futurePrevious.title,
      sourceTime: futurePrevious.time,
      lastReleasedAt: previousRelease?.time ?? null,
      nextEventAt: futurePrevious.time,
      nextEventTitle: futurePrevious.title,
      matchedCount: events.length,
      usedFallback: false,
      matchedPastActualCount,
    };
  }

  return {
    ...emptyMetric(events, now),
    matchedPastActualCount,
  };
}

function chooseMetric(events: CalendarEvent[], matcher: MetricMatcherRule): ResolvedMetric {
  const primaryEvents = events.filter((event) => matchesRule(event.title, matcher.primary));
  const primaryResolved = resolveMetric(primaryEvents);

  if (primaryResolved.source !== "none" || !matcher.fallback) {
    return primaryResolved;
  }

  const fallbackEvents = events.filter((event) => matchesRule(event.title, matcher.fallback));
  const fallbackResolved = resolveMetric(fallbackEvents);
  if (fallbackResolved.source === "none") {
    return {
      ...primaryResolved,
      matchedCount: primaryResolved.matchedCount + fallbackResolved.matchedCount,
      nextEventAt: primaryResolved.nextEventAt ?? fallbackResolved.nextEventAt,
      nextEventTitle: primaryResolved.nextEventTitle ?? fallbackResolved.nextEventTitle,
    };
  }
  return {
    ...fallbackResolved,
    usedFallback: fallbackResolved.matchedCount > 0,
  };
}

function logMetricState(
  notes: string[],
  currency: string,
  label: "policy-rate" | "headline CPI",
  resolved: ResolvedMetric,
): void {
  if (resolved.matchedCount === 0) {
    notes.push(`${currency}: ${label} rule matched zero events in current bridge window.`);
    return;
  }

  if (resolved.source === "released_actual") {
    if (resolved.usedFallback) {
      notes.push(`${currency}: ${label} resolved from released actual via fallback title ${resolved.sourceTitle}.`);
    }
    return;
  }

  if (resolved.source === "upcoming_previous") {
    notes.push(`${currency}: ${label} resolved from upcoming previous using ${resolved.sourceTitle}.`);
    return;
  }

  notes.push(`${currency}: ${label} matched events but no usable actual/previous values were found.`);
}

function deriveForRule(rule: CentralBankMappingRule, events: CalendarEvent[]): CentralBankSnapshot {
  const byCurrency = events.filter((event) => event.currency === rule.currency);
  const rateMetric = chooseMetric(byCurrency, rule.policyRate);
  const inflationMetric = chooseMetric(byCurrency, rule.inflation);

  const notes: string[] = [];
  logMetricState(notes, rule.currency, "policy-rate", rateMetric);
  logMetricState(notes, rule.currency, "headline CPI", inflationMetric);

  let status: CentralBankSnapshot["status"] = "ok";
  if (!rateMetric.currentValue && !inflationMetric.currentValue) {
    status = "missing";
  } else if (!rateMetric.currentValue || !inflationMetric.currentValue) {
    status = "partial";
  }

  return {
    currency: rule.currency,
    countryCode: rule.countryCode,
    bankName: rule.bankName,
    flag: rule.flag,
    currentPolicyRate: rateMetric.currentValue,
    previousPolicyRate: rateMetric.previousValue,
    currentInflationRate: inflationMetric.currentValue,
    previousInflationRate: inflationMetric.previousValue,
    policyRateSource: rateMetric.source,
    policyRateSourceTitle: rateMetric.sourceTitle,
    policyRateSourceTime: rateMetric.sourceTime,
    inflationSource: inflationMetric.source,
    inflationSourceTitle: inflationMetric.sourceTitle,
    inflationSourceTime: inflationMetric.sourceTime,
    lastRateReleaseAt: rateMetric.lastReleasedAt,
    lastCpiReleaseAt: inflationMetric.lastReleasedAt,
    nextRateEventAt: rateMetric.nextEventAt,
    nextRateEventTitle: rateMetric.nextEventTitle,
    nextCpiEventAt: inflationMetric.nextEventAt,
    nextCpiEventTitle: inflationMetric.nextEventTitle,
    status,
    notes,
  };
}

export function deriveCentralBankSnapshots(events: CalendarEvent[]): CentralBankDeriveResult {
  const snapshots = CENTRAL_BANK_RULES.map((rule) => deriveForRule(rule, events));
  const logs = snapshots.flatMap((snapshot) => snapshot.notes);
  return { snapshots, logs };
}
