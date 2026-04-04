import { describe, expect, it } from "vitest";
import { buildCalendarEventKey, createCalendarNavigationIntent, getCalendarIntentDayRange } from "@/app/lib/calendarNavigation";
import { getCalendarEventExplainer } from "@/app/lib/calendarEventExplain";
import { CALENDAR_EVENT_KNOWLEDGE_BACKLOG } from "@/app/lib/calendarEventKnowledge";
import type { CalendarEvent } from "@/app/types";

const event: CalendarEvent = {
  id: 42,
  time: 1_710_000_000,
  countryCode: "US",
  currency: "USD",
  title: "Nonfarm Payrolls",
  impact: "high",
  actual: "275K",
  forecast: "198K",
  previous: "229K",
};

describe("calendar navigation helpers", () => {
  it("builds a stable calendar event key", () => {
    expect(buildCalendarEventKey(event)).toBe("42:1710000000:USD:Nonfarm Payrolls");
  });

  it("creates a calendar navigation intent from an event", () => {
    expect(createCalendarNavigationIntent(event, "overview")).toEqual({
      eventKey: "42:1710000000:USD:Nonfarm Payrolls",
      eventId: 42,
      eventTime: 1_710_000_000,
      currency: "USD",
      title: "Nonfarm Payrolls",
      countryCode: "US",
      source: "overview",
    });
  });

  it("returns a same-day focused range for a target event", () => {
    const range = getCalendarIntentDayRange(event.time);
    expect(range.from.getFullYear()).toBe(range.to.getFullYear());
    expect(range.from.getMonth()).toBe(range.to.getMonth());
    expect(range.from.getDate()).toBe(range.to.getDate());
  });
});

describe("calendar event explainer", () => {
  it("explains known event families", () => {
    const explainer = getCalendarEventExplainer(event);
    expect(explainer.family).toBe("labor");
    expect(explainer.whyTradersCare).toContain("labor");
  });

  it("prefers title-specific overrides for key events", () => {
    const explainer = getCalendarEventExplainer({ ...event, title: "Nonfarm Payrolls" });
    expect(explainer.whatItIs).toContain("outside farm work");
    expect(explainer.mayAffect).toContain("USD pairs");
  });

  it("falls back cleanly for unclassified events", () => {
    const fallback = getCalendarEventExplainer({ ...event, title: "Official Reserves" });
    expect(fallback.family).toBe("generic");
    expect(fallback.whatItIs).toContain("economic or policy-related");
  });

  it("keeps a visible backlog for niche events to add later", () => {
    expect(CALENDAR_EVENT_KNOWLEDGE_BACKLOG).toContain("Producer Price Index (PPI)");
  });
});
