import type { CalendarEvent, CalendarNavigationIntent } from "@/app/types";

export function buildCalendarEventKey(event: Pick<CalendarEvent, "id" | "time" | "currency" | "title">): string {
  return `${event.id}:${event.time}:${event.currency}:${event.title}`;
}

export function createCalendarNavigationIntent(event: CalendarEvent, source: CalendarNavigationIntent["source"]): CalendarNavigationIntent {
  return {
    eventKey: buildCalendarEventKey(event),
    eventId: event.id,
    eventTime: event.time,
    currency: event.currency,
    title: event.title,
    countryCode: event.countryCode,
    source,
  };
}

export function getCalendarIntentDayRange(eventTime: number): { from: Date; to: Date } {
  const eventDate = new Date(eventTime * 1000);
  const from = new Date(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate());
  const to = new Date(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate());
  return { from, to };
}
