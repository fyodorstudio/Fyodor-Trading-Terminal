import { CENTRAL_BANK_RULES } from "@/app/config/currencyConfig";
import type {
  CalendarEvent,
  CentralBankDeriveResult,
  CentralBankMappingRule,
  CentralBankSnapshot,
  EventMatcherRule,
} from "@/app/types";
import { parseNumericValue } from "@/app/lib/format";

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

function chooseLatestReleased(events: CalendarEvent[]): CalendarEvent | null {
  const sorted = events
    .filter((event) => event.time <= Date.now() / 1000)
    .sort((a, b) => b.time - a.time);
  return (
    sorted.find((event) => parseNumericValue(event.actual) != null) ??
    sorted.find((event) => event.actual.trim() !== "") ??
    null
  );
}

function choosePreviousValue(currentEvent: CalendarEvent | null, olderEvents: CalendarEvent[]): string | null {
  if (currentEvent && currentEvent.previous.trim() !== "") {
    return currentEvent.previous;
  }
  const older = olderEvents
    .filter((event) => event.time < (currentEvent?.time ?? Number.MAX_SAFE_INTEGER))
    .sort((a, b) => b.time - a.time);
  const previousRelease =
    older.find((event) => parseNumericValue(event.actual) != null) ??
    older.find((event) => event.actual.trim() !== "") ??
    null;
  return previousRelease ? previousRelease.actual : null;
}

function deriveForRule(rule: CentralBankMappingRule, events: CalendarEvent[]): CentralBankSnapshot {
  const byCurrency = events.filter((event) => event.currency === rule.currency);
  const rateEvents = byCurrency.filter((event) => matchesRule(event.title, rule.policyRate));
  const cpiEvents = byCurrency.filter((event) => matchesRule(event.title, rule.inflation));

  const latestRate = chooseLatestReleased(rateEvents);
  const latestCpi = chooseLatestReleased(cpiEvents);

  const nextRate =
    rateEvents.filter((event) => event.time > Date.now() / 1000).sort((a, b) => a.time - b.time)[0] ?? null;
  const nextCpi =
    cpiEvents.filter((event) => event.time > Date.now() / 1000).sort((a, b) => a.time - b.time)[0] ?? null;

  const notes: string[] = [];
  if (!latestRate) {
    notes.push(`${rule.currency}: no released policy-rate event matched current rules.`);
  }
  if (!latestCpi) {
    notes.push(`${rule.currency}: no released CPI event matched current rules.`);
  }
  if (rateEvents.length === 0) {
    notes.push(`${rule.currency}: rate rule matched zero events in current bridge window.`);
  }
  if (cpiEvents.length === 0) {
    notes.push(`${rule.currency}: CPI rule matched zero events in current bridge window.`);
  }

  const currentPolicyRate = latestRate?.actual.trim() ? latestRate.actual : null;
  const currentInflationRate = latestCpi?.actual.trim() ? latestCpi.actual : null;
  const previousPolicyRate = choosePreviousValue(latestRate, rateEvents);
  const previousInflationRate = choosePreviousValue(latestCpi, cpiEvents);

  let status: CentralBankSnapshot["status"] = "ok";
  if (!currentPolicyRate && !currentInflationRate) {
    status = "missing";
  } else if (!currentPolicyRate || !currentInflationRate) {
    status = "partial";
  }

  return {
    currency: rule.currency,
    countryCode: rule.countryCode,
    bankName: rule.bankName,
    flag: rule.flag,
    currentPolicyRate,
    previousPolicyRate,
    currentInflationRate,
    previousInflationRate,
    lastRateReleaseAt: latestRate?.time ?? null,
    lastCpiReleaseAt: latestCpi?.time ?? null,
    nextRateEventAt: nextRate?.time ?? null,
    nextRateEventTitle: nextRate?.title ?? null,
    nextCpiEventAt: nextCpi?.time ?? null,
    nextCpiEventTitle: nextCpi?.title ?? null,
    status,
    notes,
  };
}

export function deriveCentralBankSnapshots(events: CalendarEvent[]): CentralBankDeriveResult {
  const snapshots = CENTRAL_BANK_RULES.map((rule) => deriveForRule(rule, events));
  const logs = snapshots.flatMap((snapshot) => snapshot.notes);
  return { snapshots, logs };
}
