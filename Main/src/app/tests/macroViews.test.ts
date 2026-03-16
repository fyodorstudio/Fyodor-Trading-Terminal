import { describe, expect, it } from "vitest";
import {
  adaptDashboardCurrencies,
  deriveDashboardInflationCards,
  deriveDashboardRateCards,
  deriveStrengthCurrencyRanks,
  deriveStrengthSuggestions,
} from "@/app/lib/macroViews";
import type { CentralBankSnapshot } from "@/app/types";

function buildSnapshot(
  currency: string,
  countryCode: string,
  currentPolicyRate: string | null,
  previousPolicyRate: string | null,
  currentInflationRate: string | null,
  previousInflationRate: string | null,
): CentralBankSnapshot {
  return {
    currency,
    countryCode,
    bankName: currency,
    flag: countryCode,
    currentPolicyRate,
    previousPolicyRate,
    currentInflationRate,
    previousInflationRate,
    policyRateSource: currentPolicyRate ? "released_actual" : "none",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: currentInflationRate ? "released_actual" : "none",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: currentPolicyRate && currentInflationRate ? "ok" : "partial",
    notes: [],
  };
}

const baseSnapshots: CentralBankSnapshot[] = [
  buildSnapshot("USD", "US", "3.75", "3.50", "2.4", "2.3"),
  buildSnapshot("EUR", "EU", "2.00", "2.25", "2.0", "1.8"),
  buildSnapshot("GBP", "GB", "3.75", "4.00", "3.4", "3.8"),
  buildSnapshot("JPY", "JP", "0.80", "0.80", "1.5", "2.1"),
  buildSnapshot("AUD", "AU", "3.85", "3.60", "3.8", "3.6"),
  buildSnapshot("CAD", "CA", "2.00", "2.00", "2.3", "2.4"),
  buildSnapshot("NZD", "NZ", "2.25", "2.25", "3.1", "3.0"),
  buildSnapshot("CHF", "CH", "0.00", "0.00", "0.1", "0.2"),
];

describe("macroViews", () => {
  it("adapts MT5 snapshots into numeric dashboard currency snapshots", () => {
    const result = adaptDashboardCurrencies(baseSnapshots);
    const usd = result.find((item) => item.currency === "USD");

    expect(usd?.currentPolicyRate).toBe(3.75);
    expect(usd?.previousInflationRate).toBe(2.3);
    expect(usd?.unresolvedFields).toEqual([]);
  });

  it("derives dashboard rate and inflation cards using the old formulas", () => {
    const currencies = adaptDashboardCurrencies(baseSnapshots);
    const rateCards = deriveDashboardRateCards(currencies, new Set(), "default");
    const inflationCards = deriveDashboardInflationCards(currencies, new Set(), "default");

    const eurusd = rateCards.find((item) => item.pair.name === "EURUSD");
    const gbpusd = inflationCards.find((item) => item.pair.name === "GBPUSD");

    expect(eurusd?.currentGap).toBeCloseTo(-1.75, 6);
    expect(eurusd?.previousGap).toBeCloseTo(-1.25, 6);
    expect(eurusd?.trend).toBeCloseTo(-0.5, 6);
    expect(eurusd?.isWidening).toBe(false);

    expect(gbpusd?.bias).toBeCloseTo(1.0, 6);
  });

  it("excludes unresolved currencies from the strength-meter ranking and keeps note candidates", () => {
    const snapshots = [...baseSnapshots];
    snapshots[0] = buildSnapshot("USD", "US", null, "3.50", "2.4", "2.3");

    const { ranks, excluded } = deriveStrengthCurrencyRanks(adaptDashboardCurrencies(snapshots));

    expect(ranks.some((item) => item.currency === "USD")).toBe(false);
    expect(excluded.map((item) => item.currency)).toContain("USD");
  });

  it("builds strength suggestions from the current ranking spread", () => {
    const { ranks } = deriveStrengthCurrencyRanks(adaptDashboardCurrencies(baseSnapshots));
    const suggestions = deriveStrengthSuggestions(ranks, new Set(), "spreadDesc");

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].spread).toBeGreaterThanOrEqual(suggestions[1].spread);
  });
});
