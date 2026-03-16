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
    title: overrides.title ?? "CPI y/y",
    impact: overrides.impact ?? "high",
    actual: overrides.actual ?? "",
    forecast: overrides.forecast ?? "",
    previous: overrides.previous ?? "",
  };
}

describe("deriveCentralBankSnapshots", () => {
  it("uses released actual values when present", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "USD",
        countryCode: "US",
        title: "Fed Interest Rate Decision",
        actual: "3.75",
        previous: "3.50",
        time: NOW - 20_000,
      }),
      buildEvent({
        currency: "USD",
        countryCode: "US",
        title: "CPI y/y",
        actual: "2.4",
        previous: "2.3",
        time: NOW - 10_000,
      }),
    ]);

    const usd = result.snapshots.find((item) => item.currency === "USD");
    expect(usd?.currentPolicyRate).toBe("3.75");
    expect(usd?.previousPolicyRate).toBe("3.50");
    expect(usd?.policyRateSource).toBe("released_actual");
    expect(usd?.currentInflationRate).toBe("2.4");
    expect(usd?.inflationSource).toBe("released_actual");
  });

  it("falls back to upcoming previous for policy and inflation when actual is blank", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "CAD",
        countryCode: "CA",
        title: "BoC Interest Rate Decision",
        actual: "",
        previous: "2.00",
        time: NOW + 20_000,
      }),
      buildEvent({
        currency: "CAD",
        countryCode: "CA",
        title: "CPI y/y",
        actual: "",
        previous: "2.3",
        time: NOW + 10_000,
      }),
    ]);

    const cad = result.snapshots.find((item) => item.currency === "CAD");
    expect(cad?.currentPolicyRate).toBe("2.00");
    expect(cad?.policyRateSource).toBe("upcoming_previous");
    expect(cad?.currentInflationRate).toBe("2.3");
    expect(cad?.inflationSource).toBe("upcoming_previous");
    expect(cad?.previousInflationRate).toBeNull();
  });

  it("prefers ECB deposit facility rate over the generic ECB interest rate", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "EUR",
        countryCode: "EU",
        title: "ECB Interest Rate Decision",
        actual: "2.15",
        previous: "2.40",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "EUR",
        countryCode: "EU",
        title: "ECB Deposit Facility Rate Decision",
        actual: "2.00",
        previous: "2.25",
        time: NOW - 9_000,
      }),
    ]);

    const eur = result.snapshots.find((item) => item.currency === "EUR");
    expect(eur?.currentPolicyRate).toBe("2.00");
    expect(eur?.policyRateSourceTitle).toBe("ECB Deposit Facility Rate Decision");
  });

  it("prefers EUR HICP y/y over CPI y/y", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "EUR",
        countryCode: "EU",
        title: "CPI y/y",
        actual: "1.9",
        previous: "1.8",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "EUR",
        countryCode: "EU",
        title: "HICP y/y",
        actual: "2.0",
        previous: "1.9",
        time: NOW - 5_000,
      }),
    ]);

    const eur = result.snapshots.find((item) => item.currency === "EUR");
    expect(eur?.currentInflationRate).toBe("2.0");
    expect(eur?.inflationSourceTitle).toBe("HICP y/y");
  });

  it("keeps EUR inflation scoped to EU rows only", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "EUR",
        countryCode: "DE",
        title: "HICP y/y",
        actual: "3.9",
        previous: "3.8",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "EUR",
        countryCode: "EU",
        title: "HICP y/y",
        actual: "1.9",
        previous: "1.7",
        time: NOW - 5_000,
      }),
    ]);

    const eur = result.snapshots.find((item) => item.currency === "EUR");
    expect(eur?.currentInflationRate).toBe("1.9");
  });

  it("resolves next policy schedule from a future title different from the released title", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "AUD",
        countryCode: "AU",
        title: "RBA Interest Rate Decision",
        actual: "3.85",
        previous: "3.60",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "AUD",
        countryCode: "AU",
        title: "RBA Rate Statement",
        actual: "",
        previous: "",
        time: NOW + 20_000,
      }),
    ]);

    const aud = result.snapshots.find((item) => item.currency === "AUD");
    expect(aud?.nextRateEventTitle).toBe("RBA Rate Statement");
    expect(aud?.nextRateEventAt).toBe(NOW + 20_000);
  });

  it("uses a future headline CPI row for next schedule even when values are blank", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "USD",
        countryCode: "US",
        title: "CPI y/y",
        actual: "2.4",
        previous: "2.4",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "USD",
        countryCode: "US",
        title: "CPI y/y",
        actual: "",
        previous: "",
        time: NOW + 20_000,
      }),
    ]);

    const usd = result.snapshots.find((item) => item.currency === "USD");
    expect(usd?.nextCpiEventAt).toBe(NOW + 20_000);
    expect(usd?.nextCpiEventTitle).toBe("CPI y/y");
  });

  it("excludes non-headline JPY variants", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "JPY",
        countryCode: "JP",
        title: "Tokyo CPI y/y",
        actual: "1.8",
        previous: "1.7",
        time: NOW - 20_000,
      }),
      buildEvent({
        currency: "JPY",
        countryCode: "JP",
        title: "Core CPI y/y",
        actual: "2.0",
        previous: "1.9",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "JPY",
        countryCode: "JP",
        title: "CPI y/y",
        actual: "1.5",
        previous: "1.4",
        time: NOW - 5_000,
      }),
    ]);

    const jpy = result.snapshots.find((item) => item.currency === "JPY");
    expect(jpy?.currentInflationRate).toBe("1.5");
    expect(jpy?.inflationSourceTitle).toBe("CPI y/y");
  });

  it("prefers monthly Australian CPI indicator when present", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "AUD",
        countryCode: "AU",
        title: "CPI y/y",
        actual: "3.6",
        previous: "3.2",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "AUD",
        countryCode: "AU",
        title: "Monthly CPI Indicator y/y",
        actual: "3.8",
        previous: "3.8",
        time: NOW - 5_000,
      }),
    ]);

    const aud = result.snapshots.find((item) => item.currency === "AUD");
    expect(aud?.currentInflationRate).toBe("3.8");
    expect(aud?.inflationSourceTitle).toBe("Monthly CPI Indicator y/y");
  });

  it("keeps unresolved metrics as missing instead of guessing from unrelated titles", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "NZD",
        countryCode: "NZ",
        title: "RBNZ 2-Year Inflation Expectations",
        actual: "2.37",
        previous: "2.28",
        time: NOW - 3_000,
      }),
    ]);

    const nzd = result.snapshots.find((item) => item.currency === "NZD");
    expect(nzd?.currentInflationRate).toBeNull();
    expect(nzd?.inflationSource).toBe("none");
    expect(result.logs.some((line) => line.includes("NZD"))).toBe(true);
  });

  it("ignores non-numeric actual and previous values instead of treating them as resolved", () => {
    const result = deriveCentralBankSnapshots([
      buildEvent({
        currency: "USD",
        countryCode: "US",
        title: "Fed Interest Rate Decision",
        actual: "pending",
        previous: "held",
        time: NOW - 10_000,
      }),
      buildEvent({
        currency: "USD",
        countryCode: "US",
        title: "CPI y/y",
        actual: "revised later",
        previous: "estimate",
        time: NOW - 5_000,
      }),
    ]);

    const usd = result.snapshots.find((item) => item.currency === "USD");
    expect(usd?.currentPolicyRate).toBeNull();
    expect(usd?.currentInflationRate).toBeNull();
    expect(usd?.policyRateSource).toBe("none");
    expect(usd?.inflationSource).toBe("none");
  });
});
