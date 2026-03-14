import { formatDistanceToNow } from "date-fns";

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function getLocalTimezoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
  } catch {
    return "Local time";
  }
}

export function formatLocalClock(now: Date): string {
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const offset = minutes === 0 ? `${hours}` : `${hours}:${pad(minutes)}`;
  return `${time} ${date}  |  Local (UTC${sign}${offset} ${getLocalTimezoneLabel()})`;
}

export function formatUtcClock(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  const day = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${time} ${day}  |  MT5 feed (UTC)`;
}

export function formatUtcDateTime(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const day = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function formatLocalDateTime(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const day = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateOnly(timestampSeconds: number | null): string {
  if (timestampSeconds == null) return "N/A";
  return new Date(timestampSeconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeAge(timestampSeconds: number | null): string {
  if (timestampSeconds == null) return "never";
  return `${formatDistanceToNow(new Date(timestampSeconds * 1000), { addSuffix: false })} ago`;
}

export function formatCountdown(targetSeconds: number | null, nowMs = Date.now()): string {
  if (targetSeconds == null) return "N/A";
  const remaining = Math.max(0, targetSeconds * 1000 - nowMs);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  }
  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${minutes}m ${pad(seconds)}s`;
}

export function isStale(timestampSeconds: number | null, thresholdSeconds = 300): boolean {
  if (timestampSeconds == null) return true;
  return Date.now() / 1000 - timestampSeconds > thresholdSeconds;
}

export function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function parseNumericValue(raw: string): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}
