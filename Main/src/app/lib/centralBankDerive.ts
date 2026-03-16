import { CENTRAL_BANK_RULES } from "@/app/config/currencyConfig";
import type {
  CalendarEvent,
  CentralBankDeriveResult,
  CentralBankMappingRule,
  CentralBankSnapshot,
  EventMatcherRule,
  MetricEventScope,
  MetricMatcherRule,
  MetricSourceKind,
  MetricRuleSet,
} from "@/app/types";
import { parseNumericValue } from "@/app/lib/format";

interface ResolvedMetric {
  currentValue: string | null;
  previousValue: string | null;
  source: MetricSourceKind;
  sourceTitle: string | null;
  sourceTime: number | null;
  lastReleasedAt: number | null;
  matchedCount: number;
  usedFallback: boolean;
}

interface ResolvedSchedule {
  nextEventAt: number | null;
  nextEventTitle: string | null;
  matchedCount: number;
  usedFallback: boolean;
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

function filterByScope(events: CalendarEvent[], scope: MetricEventScope): CalendarEvent[] {
  if (!scope.countryCodes || scope.countryCodes.length === 0) {
    return events;
  }

  const allowed = new Set(scope.countryCodes.map((code) => code.toUpperCase()));
  return events.filter((event) => allowed.has(event.countryCode.toUpperCase()));
}

function matchEvents(events: CalendarEvent[], matcher: MetricMatcherRule): { primary: CalendarEvent[]; fallback: CalendarEvent[] } {
  return {
    primary: events.filter((event) => matchesRule(event.title, matcher.primary)),
    fallback: matcher.fallback ? events.filter((event) => matchesRule(event.title, matcher.fallback!)) : [],
  };
}

function hasUsableActual(event: CalendarEvent): boolean {
  return parseNumericValue(event.actual) != null;
}

function hasUsablePrevious(event: CalendarEvent): boolean {
  return parseNumericValue(event.previous) != null;
}

function sortDescByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => b.time - a.time);
}

function sortAscByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.time - b.time);
}

function latestPastActual(events: CalendarEvent[], now: number): CalendarEvent | null {
  return sortDescByTime(events.filter((event) => event.time <= now)).find(hasUsableActual) ?? null;
}

function nearestFuturePrevious(events: CalendarEvent[], now: number): CalendarEvent | null {
  return sortAscByTime(events.filter((event) => event.time > now)).find(hasUsablePrevious) ?? null;
}

function priorReleasedActual(events: CalendarEvent[], beforeTime: number): CalendarEvent | null {
  return sortDescByTime(events.filter((event) => event.time < beforeTime)).find(hasUsableActual) ?? null;
}

function firstFutureEvent(events: CalendarEvent[], now: number): CalendarEvent | null {
  return sortAscByTime(events.filter((event) => event.time > now))[0] ?? null;
}

function emptyMetric(matchedCount: number): ResolvedMetric {
  return {
    currentValue: null,
    previousValue: null,
    source: "none",
    sourceTitle: null,
    sourceTime: null,
    lastReleasedAt: null,
    matchedCount,
    usedFallback: false,
  };
}

function resolveCurrentMetric(events: CalendarEvent[]): ResolvedMetric {
  const now = Date.now() / 1000;
  if (events.length === 0) {
    return emptyMetric(0);
  }

  const pastActual = latestPastActual(events, now);
  const futurePrevious = nearestFuturePrevious(events, now);

  if (pastActual) {
    const previousRelease = priorReleasedActual(events, pastActual.time);
    return {
      currentValue: pastActual.actual.trim() || null,
      previousValue: hasUsablePrevious(pastActual) ? pastActual.previous.trim() : previousRelease?.actual.trim() || null,
      source: "released_actual",
      sourceTitle: pastActual.title,
      sourceTime: pastActual.time,
      lastReleasedAt: pastActual.time,
      matchedCount: events.length,
      usedFallback: false,
    };
  }

  if (futurePrevious) {
    const previousRelease = priorReleasedActual(events, futurePrevious.time);
    return {
      currentValue: futurePrevious.previous.trim() || null,
      previousValue: previousRelease?.actual.trim() || null,
      source: "upcoming_previous",
      sourceTitle: futurePrevious.title,
      sourceTime: futurePrevious.time,
      lastReleasedAt: previousRelease?.time ?? null,
      matchedCount: events.length,
      usedFallback: false,
    };
  }

  return emptyMetric(events.length);
}

function chooseCurrentMetric(events: CalendarEvent[], ruleSet: MetricRuleSet): ResolvedMetric {
  const scopedEvents = filterByScope(events, ruleSet.current);
  const matched = matchEvents(scopedEvents, ruleSet.current.matcher);
  const primaryResolved = resolveCurrentMetric(matched.primary);

  if (primaryResolved.source !== "none" || !ruleSet.current.matcher.fallback) {
    return primaryResolved;
  }

  const fallbackResolved = resolveCurrentMetric(matched.fallback);
  if (fallbackResolved.source === "none") {
    return {
      ...primaryResolved,
      matchedCount: matched.primary.length + matched.fallback.length,
    };
  }

  return {
    ...fallbackResolved,
    usedFallback: matched.fallback.length > 0,
    matchedCount: matched.primary.length + matched.fallback.length,
  };
}

function resolveNextSchedule(events: CalendarEvent[]): ResolvedSchedule {
  const next = firstFutureEvent(events, Date.now() / 1000);
  return {
    nextEventAt: next?.time ?? null,
    nextEventTitle: next?.title ?? null,
    matchedCount: events.length,
    usedFallback: false,
  };
}

function chooseNextSchedule(events: CalendarEvent[], ruleSet: MetricRuleSet): ResolvedSchedule {
  const scope = ruleSet.nextSchedule ?? ruleSet.current;
  const scopedEvents = filterByScope(events, scope);
  const matched = matchEvents(scopedEvents, scope.matcher);
  const primarySchedule = resolveNextSchedule(matched.primary);

  if (primarySchedule.nextEventAt != null || !scope.matcher.fallback) {
    return primarySchedule;
  }

  const fallbackSchedule = resolveNextSchedule(matched.fallback);
  if (fallbackSchedule.nextEventAt == null) {
    return {
      ...primarySchedule,
      matchedCount: matched.primary.length + matched.fallback.length,
    };
  }

  return {
    ...fallbackSchedule,
    usedFallback: matched.fallback.length > 0,
    matchedCount: matched.primary.length + matched.fallback.length,
  };
}

function logCurrentMetricState(
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

function logScheduleState(
  notes: string[],
  currency: string,
  label: "policy-rate" | "headline CPI",
  resolved: ResolvedSchedule,
): void {
  if (resolved.nextEventAt != null) {
    if (resolved.usedFallback && resolved.nextEventTitle) {
      notes.push(`${currency}: next ${label} schedule resolved via fallback title ${resolved.nextEventTitle}.`);
    }
    return;
  }

  notes.push(`${currency}: no future ${label} schedule matched in current MT5 bridge window.`);
}

function deriveForRule(rule: CentralBankMappingRule, events: CalendarEvent[]): CentralBankSnapshot {
  const byCurrency = events.filter((event) => event.currency === rule.currency);
  const rateMetric = chooseCurrentMetric(byCurrency, rule.policyRate);
  const rateSchedule = chooseNextSchedule(byCurrency, rule.policyRate);
  const inflationMetric = chooseCurrentMetric(byCurrency, rule.inflation);
  const inflationSchedule = chooseNextSchedule(byCurrency, rule.inflation);

  const notes: string[] = [];
  logCurrentMetricState(notes, rule.currency, "policy-rate", rateMetric);
  logCurrentMetricState(notes, rule.currency, "headline CPI", inflationMetric);
  logScheduleState(notes, rule.currency, "policy-rate", rateSchedule);
  logScheduleState(notes, rule.currency, "headline CPI", inflationSchedule);

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
    nextRateEventAt: rateSchedule.nextEventAt,
    nextRateEventTitle: rateSchedule.nextEventTitle,
    nextCpiEventAt: inflationSchedule.nextEventAt,
    nextCpiEventTitle: inflationSchedule.nextEventTitle,
    status,
    notes,
  };
}

export function deriveCentralBankSnapshots(events: CalendarEvent[]): CentralBankDeriveResult {
  const snapshots = CENTRAL_BANK_RULES.map((rule) => deriveForRule(rule, events));
  const logs = snapshots.flatMap((snapshot) => snapshot.notes);
  return { snapshots, logs };
}
