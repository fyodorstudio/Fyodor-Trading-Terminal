import { getLocalTimezoneLabel, pad } from "@/app/lib/format";

export type DisplayTimezoneSelection = "local" | "server" | `utc-offset:${number}`;

export interface DisplayTimezoneOption {
  id: DisplayTimezoneSelection;
  label: string;
  shortLabel: string;
  description: string;
  isHighlighted: boolean;
}

const ACTUAL_UTC_OFFSET_MINUTES = [
  -12 * 60,
  -11 * 60,
  -10 * 60,
  -9 * 60 - 30,
  -9 * 60,
  -8 * 60,
  -7 * 60,
  -6 * 60,
  -5 * 60,
  -4 * 60,
  -3 * 60 - 30,
  -3 * 60,
  -2 * 60,
  -1 * 60,
  0,
  1 * 60,
  2 * 60,
  3 * 60,
  3 * 60 + 30,
  4 * 60,
  4 * 60 + 30,
  5 * 60,
  5 * 60 + 30,
  5 * 60 + 45,
  6 * 60,
  6 * 60 + 30,
  7 * 60,
  8 * 60,
  8 * 60 + 45,
  9 * 60,
  9 * 60 + 30,
  10 * 60,
  10 * 60 + 30,
  11 * 60,
  12 * 60,
  12 * 60 + 45,
  13 * 60,
  14 * 60,
] as const;

type TimeGetterMode = "local" | "utc";

function isDisplayTimezoneSelection(value: string): value is DisplayTimezoneSelection {
  if (value === "local" || value === "server") return true;
  if (!value.startsWith("utc-offset:")) return false;
  const raw = Number(value.slice("utc-offset:".length));
  return Number.isFinite(raw) && ACTUAL_UTC_OFFSET_MINUTES.includes(raw as (typeof ACTUAL_UTC_OFFSET_MINUTES)[number]);
}

function getLocalUtcOffsetMinutes(now: Date): number {
  return -now.getTimezoneOffset();
}

function getLocalUtcOffsetShort(now: Date): string {
  return formatUtcOffsetLabel(getLocalUtcOffsetMinutes(now));
}

function getDisplayDate(timestampSeconds: number, selection: DisplayTimezoneSelection): { date: Date; mode: TimeGetterMode } {
  if (selection === "local") {
    return { date: new Date(timestampSeconds * 1000), mode: "local" };
  }

  if (selection === "server") {
    return { date: new Date(timestampSeconds * 1000), mode: "utc" };
  }

  const offsetMinutes = parseUtcOffsetSelection(selection);
  const shiftedSeconds = timestampSeconds + offsetMinutes * 60;
  return { date: new Date(shiftedSeconds * 1000), mode: "utc" };
}

function getDatePart(date: Date, mode: TimeGetterMode, part: "year" | "month" | "date" | "hours" | "minutes" | "seconds"): number {
  if (mode === "local") {
    if (part === "year") return date.getFullYear();
    if (part === "month") return date.getMonth();
    if (part === "date") return date.getDate();
    if (part === "hours") return date.getHours();
    if (part === "minutes") return date.getMinutes();
    return date.getSeconds();
  }

  if (part === "year") return date.getUTCFullYear();
  if (part === "month") return date.getUTCMonth();
  if (part === "date") return date.getUTCDate();
  if (part === "hours") return date.getUTCHours();
  if (part === "minutes") return date.getUTCMinutes();
  return date.getUTCSeconds();
}

function formatMonthLabel(date: Date, mode: TimeGetterMode): string {
  return date.toLocaleDateString("en-GB", {
    month: "short",
    ...(mode === "utc" ? { timeZone: "UTC" } : {}),
  });
}

export function formatUtcOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildUtcOffsetSelection(offsetMinutes: number): DisplayTimezoneSelection {
  return `utc-offset:${offsetMinutes}`;
}

export function parseUtcOffsetSelection(selection: DisplayTimezoneSelection): number {
  if (!selection.startsWith("utc-offset:")) return 0;
  const raw = Number(selection.slice("utc-offset:".length));
  return Number.isFinite(raw) ? raw : 0;
}

export function loadDisplayTimezoneSelection(
  storageKey: string,
  fallback: DisplayTimezoneSelection = "local",
): DisplayTimezoneSelection {
  if (typeof window === "undefined") return fallback;
  const saved = window.localStorage.getItem(storageKey);
  return saved && isDisplayTimezoneSelection(saved) ? saved : fallback;
}

export function saveDisplayTimezoneSelection(storageKey: string, selection: DisplayTimezoneSelection) {
  try {
    window.localStorage.setItem(storageKey, selection);
  } catch {
    // ignore storage failures
  }
}

export function getLocalTimezoneSummary(now: Date): string {
  return `${formatUtcOffsetLabel(getLocalUtcOffsetMinutes(now))} ${getLocalTimezoneLabel()}`;
}

export function getDisplayTimezoneOptions(now: Date): DisplayTimezoneOption[] {
  return [
    {
      id: "local",
      label: getLocalTimezoneSummary(now),
      shortLabel: "Local",
      description: "Show timestamps in this browser's local timezone.",
      isHighlighted: true,
    },
    {
      id: "server",
      label: "MT5 / Server Time",
      shortLabel: "MT5/Server",
      description: "Keep the feed's native chart/calendar time convention.",
      isHighlighted: false,
    },
    ...ACTUAL_UTC_OFFSET_MINUTES.map((offsetMinutes) => ({
      id: buildUtcOffsetSelection(offsetMinutes),
      label: formatUtcOffsetLabel(offsetMinutes),
      shortLabel: formatUtcOffsetLabel(offsetMinutes),
      description: `Show timestamps in fixed ${formatUtcOffsetLabel(offsetMinutes)} time.`,
      isHighlighted: false,
    })),
  ];
}

export function getDisplayTimezoneLabel(selection: DisplayTimezoneSelection, now = new Date()): string {
  if (selection === "local") return getLocalTimezoneSummary(now);
  if (selection === "server") return "MT5 / Server Time";
  return formatUtcOffsetLabel(parseUtcOffsetSelection(selection));
}

export function getDisplayTimezoneShortLabel(selection: DisplayTimezoneSelection, now = new Date()): string {
  if (selection === "local") return `Local (${getLocalUtcOffsetShort(now)})`;
  if (selection === "server") return "MT5/Server";
  return formatUtcOffsetLabel(parseUtcOffsetSelection(selection));
}

export function formatDateTimeForDisplayTimezone(timestampSeconds: number, selection: DisplayTimezoneSelection): string {
  const { date, mode } = getDisplayDate(timestampSeconds, selection);
  const day = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(mode === "utc" ? { timeZone: "UTC" } : {}),
  });
  return `${day} ${pad(getDatePart(date, mode, "hours"))}:${pad(getDatePart(date, mode, "minutes"))}`;
}

export function formatTimeForDisplayTimezone(
  timestampSeconds: number,
  selection: DisplayTimezoneSelection,
  includeSeconds = false,
): string {
  const { date, mode } = getDisplayDate(timestampSeconds, selection);
  const hours = pad(getDatePart(date, mode, "hours"));
  const minutes = pad(getDatePart(date, mode, "minutes"));
  if (!includeSeconds) return `${hours}:${minutes}`;
  return `${hours}:${minutes}:${pad(getDatePart(date, mode, "seconds"))}`;
}

export function formatDayMonthForDisplayTimezone(timestampSeconds: number, selection: DisplayTimezoneSelection): string {
  const { date, mode } = getDisplayDate(timestampSeconds, selection);
  return `${pad(getDatePart(date, mode, "date"))} ${formatMonthLabel(date, mode)}`;
}

export function formatMonthYearForDisplayTimezone(timestampSeconds: number, selection: DisplayTimezoneSelection): string {
  const { date, mode } = getDisplayDate(timestampSeconds, selection);
  return `${formatMonthLabel(date, mode)} ${String(getDatePart(date, mode, "year")).slice(-2)}`;
}

export function formatYearForDisplayTimezone(timestampSeconds: number, selection: DisplayTimezoneSelection): string {
  const { date, mode } = getDisplayDate(timestampSeconds, selection);
  return String(getDatePart(date, mode, "year"));
}

export function formatHoverTimezoneSuffix(selection: DisplayTimezoneSelection, now = new Date()): string {
  if (selection === "local") return getLocalTimezoneLabel();
  if (selection === "server") return "MT5/Server";
  return formatUtcOffsetLabel(parseUtcOffsetSelection(selection));
}

export function formatCurrentTimeForDisplayTimezone(params: {
  nowMs: number;
  selection: DisplayTimezoneSelection;
  serverTimeSeconds?: number | null;
  serverFetchedAtMs?: number | null;
}): string {
  const now = new Date(params.nowMs);
  if (params.selection === "local") {
    return `${pad(now.getHours())}:${pad(now.getMinutes())} (${getLocalUtcOffsetShort(now)})`;
  }

  if (params.selection === "server") {
    if (params.serverTimeSeconds == null || params.serverFetchedAtMs == null) {
      return "MT5 unavailable";
    }
    const elapsedSeconds = Math.max(0, Math.floor((params.nowMs - params.serverFetchedAtMs) / 1000));
    return `${formatTimeForDisplayTimezone(params.serverTimeSeconds + elapsedSeconds, "server")} (MT5)`;
  }

  const offsetLabel = formatUtcOffsetLabel(parseUtcOffsetSelection(params.selection));
  const timestampSeconds = Math.floor(params.nowMs / 1000);
  return `${formatTimeForDisplayTimezone(timestampSeconds, params.selection)} (${offsetLabel})`;
}
