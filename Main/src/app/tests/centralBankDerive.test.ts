import { describe, expect, it } from "vitest";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import type { CalendarEvent } from "@/app/types";

const NOW = Math.floor(Date.now() / 1000);

function buildEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10_000),
    time: overrides.time ?? NOW,
    countryCode: overrides.countryCode ?? "US",
    currency: overrides.currency ?? "USD",
    title: overrides.title ?? "Inflation Rate YoY",
    impact: overrides.impact ?? "high",
    actual: overrides.actual ?? "",
    forecast: overrides.forecast ?? "",
    previous: overrides.previous ?? "",
  };
}

describe("deriveCentralBankSnapshots", () => {
  it("maps current and previous USD rate/CPI values from strict MT5 titles", () => {
    const events: CalendarEvent[] = [
      buildEvent({
        id: 1,
        title: "Fed Interest Rate Decision",
        actual: "5.50%",
        previous: "5.25%",
        time: NOW - 10_000,
      }),
      buildEvent({
        id: 2,
        title: "Inflation Rate YoY",
        actual: "3.2%",
        previous: "3.1%",
        time: NOW - 5_000,
      }),
      buildEvent({
        id: 3,
        title: "Fed Interest Rate Decision",
        actual: "",
        forecast: "5.50%",
        time: NOW + 20_000,
      }),
    ];

    const result = deriveCentralBankSnapshots(events);
    const usd = result.snapshots.find((item) => item.currency === "USD");

    expect(usd).toBeDefined();
    expect(usd?.currentPolicyRate).toBe("5.50%");
    expect(usd?.previousPolicyRate).toBe("5.25%");
    expect(usd?.currentInflationRate).toBe("3.2%");
    expect(usd?.previousInflationRate).toBe("3.1%");
    expect(usd?.status).toBe("ok");
  });

  it("keeps ambiguous currencies as missing instead of guessing", () => {
    const events: CalendarEvent[] = [
      buildEvent({
        id: 10,
        currency: "USD",
        countryCode: "US",
        title: "Core Inflation Rate YoY",
        actual: "3.5%",
        previous: "3.6%",
        time: NOW - 3_000,
      }),
    ];

    const result = deriveCentralBankSnapshots(events);
    const usd = result.snapshots.find((item) => item.currency === "USD");

    expect(usd?.currentInflationRate).toBeNull();
    expect(usd?.status).toBe("missing");
    expect(result.logs.some((line) => line.includes("USD"))).toBe(true);
  });
});
