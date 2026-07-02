import { getCountryDisplayName } from "@/app/config/currencyConfig";
import { formatRelativeAge } from "@/app/lib/format";
import type { CalendarEvent, ImpactLevel } from "@/app/types";

export type CalendarFreshnessState = "unknown" | "fresh" | "aging" | "stale";

export function buildCalendarQueryKey(params: {
  from: Date | null;
  to: Date | null;
  impacts: ImpactLevel[];
  countries: string[];
}): string {
  return JSON.stringify({
    from: params.from ? Math.floor(params.from.getTime() / 1000) : null,
    to: params.to ? Math.floor(params.to.getTime() / 1000) : null,
    impacts: [...params.impacts].sort(),
    countries: [...params.countries].sort(),
  });
}

export function getImpactLabel(level: ImpactLevel): string {
  return level[0].toUpperCase() + level.slice(1);
}

export function groupByUtcDay(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const key = new Date(event.time * 1000).toISOString().slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function stripToLocalDate(date: Date | null): Date | null {
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toUtcRangeSeconds(from: Date | null, to: Date | null): { from: number | null; to: number | null } {
  if (!from && !to) return { from: null, to: null };

  const start = stripToLocalDate(from ?? to);
  const end = stripToLocalDate(to ?? from);

  if (!start || !end) return { from: null, to: null };

  const normalizedFrom = start <= end ? start : end;
  const normalizedTo = start <= end ? end : start;

  return {
    from: Math.floor(
      Date.UTC(
        normalizedFrom.getFullYear(),
        normalizedFrom.getMonth(),
        normalizedFrom.getDate(),
        0,
        0,
        0,
      ) / 1000,
    ),
    to: Math.floor(
      Date.UTC(
        normalizedTo.getFullYear(),
        normalizedTo.getMonth(),
        normalizedTo.getDate(),
        23,
        59,
        59,
      ) / 1000,
    ),
  };
}

export function getTodayUtcRangeSeconds(now: Date): { from: number; to: number } {
  return {
    from: Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) / 1000),
    to: Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59) / 1000),
  };
}

export function formatUiAge(timestampSeconds: number | null, nowMs: number): string {
  if (timestampSeconds == null) return "never";
  const diff = Math.max(0, Math.floor(nowMs / 1000 - timestampSeconds));
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  if (mins < 60) return `${mins}m ${secs}s ago`;
  return formatRelativeAge(timestampSeconds);
}

export function getCalendarFreshness(timestampSeconds: number | null, nowMs: number): {
  state: CalendarFreshnessState;
  label: string;
  ageLabel: string;
} {
  if (timestampSeconds == null) {
    return { state: "unknown", label: "Unknown", ageLabel: "never" };
  }

  const ageSeconds = Math.max(0, Math.floor(nowMs / 1000 - timestampSeconds));
  if (ageSeconds <= 120) {
    return { state: "fresh", label: "Fresh", ageLabel: formatUiAge(timestampSeconds, nowMs) };
  }
  if (ageSeconds <= 300) {
    return { state: "aging", label: "Aging", ageLabel: formatUiAge(timestampSeconds, nowMs) };
  }
  return { state: "stale", label: "Stale", ageLabel: formatUiAge(timestampSeconds, nowMs) };
}

export interface EventValueDisplay {
  display: string;
  raw: string;
  inferredUnit: "percent" | "thousand" | null;
  title: string;
}

function trimTrailingZeros(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function parsePlainNumber(raw: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(raw.replace(/,/g, ""))) return null;
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inferEventValueUnit(raw: string, eventTitle = ""): EventValueDisplay["inferredUnit"] {
  const normalizedTitle = eventTitle.toLowerCase();
  const normalizedRaw = raw.toLowerCase();
  if (/[a-z%]/i.test(normalizedRaw)) return null;

  if (
    /\b(y\/y|m\/m|q\/q|mom|yoy|annual|rate|inflation|cpi|pce|ppi|deflator|wage|earnings)\b/.test(normalizedTitle)
  ) {
    return "percent";
  }

  if (/\b(payroll|employment change|jobs?|jobless claims|unemployment claims|claimant count)\b/.test(normalizedTitle)) {
    return "thousand";
  }

  return null;
}

export function getEventValueDisplay(value: string, eventTitle = ""): EventValueDisplay {
  const raw = value.trim();
  if (!raw) {
    return {
      display: "-",
      raw,
      inferredUnit: null,
      title: "No value supplied by the MT5 calendar feed.",
    };
  }

  const compactRaw = raw.replace(/\s+/g, " ");
  const number = parsePlainNumber(compactRaw);
  const inferredUnit = number == null ? null : inferEventValueUnit(compactRaw, eventTitle);
  const display =
    number == null || inferredUnit == null
      ? compactRaw
      : inferredUnit === "percent"
        ? `${trimTrailingZeros(number)}%`
        : `${trimTrailingZeros(number)}K`;

  const title =
    display === compactRaw
      ? `MT5 raw value: ${compactRaw}`
      : `MT5 raw value: ${compactRaw}. Display unit inferred from event title: ${eventTitle || "unknown event"}.`;

  return {
    display,
    raw: compactRaw,
    inferredUnit,
    title,
  };
}

export function formatEventValue(value: string, eventTitle = ""): string {
  return getEventValueDisplay(value, eventTitle).display;
}

export function formatImpactSummary(impacts: ImpactLevel[]) {
  if (impacts.length >= 3) return "All";
  if (impacts.length === 0) return "None";
  return impacts.map(getImpactLabel).join(" + ");
}

export function formatRangeLabel(from: Date | null, to: Date | null): string {
  if (!from || !to) return "Select range";

  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) {
    return from.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const sameYear = from.getFullYear() === to.getFullYear();
  if (sameYear) {
    return `${from.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${to.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return `${from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} - ${to.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function formatRangeLabelFromSeconds(fromSeconds: number | null, toSeconds: number | null): string {
  if (fromSeconds == null || toSeconds == null) return "Select range";

  const from = new Date(fromSeconds * 1000);
  const to = new Date(toSeconds * 1000);

  const formatDay = (date: Date, withYear: boolean) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });

  const sameDay = from.toISOString().slice(0, 10) === to.toISOString().slice(0, 10);
  if (sameDay) {
    return formatDay(from, true);
  }

  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  return sameYear ? `${formatDay(from, false)} - ${formatDay(to, true)}` : `${formatDay(from, true)} - ${formatDay(to, true)}`;
}

export function formatCurrentMt5Time(serverTimeSeconds: number | null, fetchedAtMs: number | null, nowMs: number): string {
  if (serverTimeSeconds == null || fetchedAtMs == null) return "MT5 unavailable";

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
  const liveTime = new Date((serverTimeSeconds + elapsedSeconds) * 1000);
  const hours = String(liveTime.getUTCHours()).padStart(2, "0");
  const minutes = String(liveTime.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes} (MT5)`;
}

export function summarizeCountries(countries: string[]): string {
  if (countries.length === 0) return "All countries";
  if (countries.length === 1) {
    return getCountryDisplayName(countries[0]);
  }

  const first = getCountryDisplayName(countries[0]);
  return `${first} + ${countries.length - 1}`;
}
