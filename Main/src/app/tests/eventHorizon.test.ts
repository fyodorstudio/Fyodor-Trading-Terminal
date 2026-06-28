import { describe, expect, it } from "vitest";
import { getNextHighImpactEvent } from "@/app/lib/eventHorizon";
import type { CalendarEvent } from "@/app/types";

const baseEvent: CalendarEvent = {
  id: 1,
  time: 1_800_000_000,
  countryCode: "US",
  currency: "USD",
  title: "CPI y/y",
  impact: "high",
  actual: "",
  forecast: "",
  previous: "",
};

describe("event horizon helpers", () => {
  it("returns the nearest future high-impact event without mutating the input order", () => {
    const events: CalendarEvent[] = [
      { ...baseEvent, id: 1, time: 1_800_000_300, title: "FOMC Statement" },
      { ...baseEvent, id: 2, time: 1_800_000_100, currency: "EUR", title: "ECB Rate Decision" },
      { ...baseEvent, id: 3, time: 1_800_000_200, impact: "medium", title: "Retail Sales m/m" },
    ];

    expect(getNextHighImpactEvent(events, 1_800_000_000)).toEqual({
      title: "ECB Rate Decision",
      currency: "EUR",
      time: 1_800_000_100,
    });
    expect(events.map((event) => event.id)).toEqual([1, 2, 3]);
  });

  it("ignores past high-impact events", () => {
    expect(
      getNextHighImpactEvent(
        [
          { ...baseEvent, time: 1_799_999_900, title: "Old CPI" },
          { ...baseEvent, time: 1_800_000_300, title: "Upcoming NFP" },
        ],
        1_800_000_000,
      ),
    ).toEqual({
      title: "Upcoming NFP",
      currency: "USD",
      time: 1_800_000_300,
    });
  });

  it("returns null when no future high-impact event exists", () => {
    expect(
      getNextHighImpactEvent(
        [
          { ...baseEvent, time: 1_799_999_900 },
          { ...baseEvent, time: 1_800_000_300, impact: "low" },
        ],
        1_800_000_000,
      ),
    ).toBeNull();
  });
});
