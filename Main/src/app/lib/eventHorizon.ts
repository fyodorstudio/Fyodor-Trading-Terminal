import type { CalendarEvent } from "@/app/types";

export interface HighImpactEventSummary {
  title: string;
  currency: string;
  countryCode: string;
  time: number;
}

export function getNextHighImpactEvent(
  events: CalendarEvent[],
  nowUnix = Date.now() / 1000,
): HighImpactEventSummary | null {
  let nextEvent: CalendarEvent | null = null;

  for (const event of events) {
    if (event.impact !== "high" || event.time < nowUnix) continue;
    if (!nextEvent || event.time < nextEvent.time) {
      nextEvent = event;
    }
  }

  return nextEvent
    ? {
        title: nextEvent.title,
        currency: nextEvent.currency,
        countryCode: nextEvent.countryCode,
        time: nextEvent.time,
      }
    : null;
}
