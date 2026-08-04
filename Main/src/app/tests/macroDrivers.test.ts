import { describe, expect, it } from "vitest";
import { buildMacroFactorRowsAsOf } from "@/app/lib/macroDrivers";
import type { CalendarEvent } from "@/app/types";

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: overrides.id ?? 1,
    time: overrides.time ?? 0,
    countryCode: overrides.countryCode ?? "US",
    currency: overrides.currency ?? "USD",
    title: overrides.title ?? "CPI",
    impact: overrides.impact ?? "high",
    actual: overrides.actual ?? "3.1",
    forecast: overrides.forecast ?? "3.0",
    previous: overrides.previous ?? "2.9",
  };
}

describe("buildMacroFactorRowsAsOf", () => {
  it("anchors latest and next matching releases around the requested chart time", () => {
    const rows = buildMacroFactorRowsAsOf({
      currencies: ["USD"],
      anchorTimeSeconds: 200,
      events: [
        event({ id: 1, time: 100, title: "CPI" }),
        event({ id: 2, time: 150, title: "Core CPI" }),
        event({ id: 3, time: 250, title: "CPI" }),
        event({ id: 4, time: 120, title: "Retail Sales" }),
      ],
    });

    const inflation = rows.find((row) => row.currency === "USD" && row.factor.id === "inflation");

    expect(inflation?.latestEvent?.id).toBe(2);
    expect(inflation?.nextEvent?.id).toBe(3);
    expect(inflation?.coverageLabel).toBe("Current + scheduled");
  });
});
