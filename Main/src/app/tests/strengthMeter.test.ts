import { describe, expect, it } from "vitest";
import {
  deriveCurrencyEventPush,
  deriveCurrencyPriceStrength,
  deriveCurrencyStructuralBackdrop,
  deriveStrengthMeterResult,
} from "@/app/lib/strengthMeter";
import type { BridgeCandle, CalendarEvent, CentralBankSnapshot, StrengthPairCandleSet } from "@/app/types";

const now = 1_710_000_000;

function buildSnapshot(currency: string, rate: string | null, inflation: string | null): CentralBankSnapshot {
  return {
    currency,
    countryCode: currency === "EUR" ? "EU" : currency === "USD" ? "US" : currency.slice(0, 2),
    bankName: `${currency} Bank`,
    flag: currency === "EUR" ? "EU" : currency === "USD" ? "US" : currency.slice(0, 2),
    currentPolicyRate: rate,
    previousPolicyRate: rate,
    currentInflationRate: inflation,
    previousInflationRate: inflation,
    policyRateSource: rate ? "released_actual" : "none",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: inflation ? "released_actual" : "none",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: rate && inflation ? "ok" : rate || inflation ? "partial" : "missing",
    notes: [],
  };
}

function buildCandles(direction: "up" | "down", count: number, step: number): BridgeCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const base = direction === "up" ? 1 + index * step : 1.6 - index * step;
    return {
      time: now - (count - index) * 3600,
      open: base,
      high: base + step,
      low: base - step,
      close: direction === "up" ? base + step / 2 : base - step / 2,
      volume: 100,
    };
  });
}

function event(title: string, currency: string, actual: string, forecast: string, offsetSeconds: number, impact: CalendarEvent["impact"] = "high"): CalendarEvent {
  return {
    id: Math.abs(title.length + offsetSeconds),
    time: now - offsetSeconds,
    countryCode: currency === "EUR" ? "EU" : currency === "USD" ? "US" : "GB",
    currency,
    title,
    impact,
    actual,
    forecast,
    previous: forecast,
  };
}

describe("strengthMeter", () => {
  it("derives basket-based currency price strength from multiple pairs", () => {
    const candleMap: Record<string, StrengthPairCandleSet> = {
      EURUSD: { d1: buildCandles("up", 30, 0.01), h4: buildCandles("up", 20, 0.006) },
      EURJPY: { d1: buildCandles("up", 30, 0.009), h4: buildCandles("up", 20, 0.005) },
      GBPUSD: { d1: buildCandles("down", 30, 0.008), h4: buildCandles("down", 20, 0.004) },
    };

    const priceMap = deriveCurrencyPriceStrength(candleMap);

    expect((priceMap.get("EUR")?.value ?? 0)).toBeGreaterThan(0);
    expect((priceMap.get("USD")?.value ?? 0)).toBeLessThan(0);
  });

  it("treats unemployment-style releases as inverse directional events", () => {
    const push = deriveCurrencyEventPush(
      [event("Unemployment Rate", "USD", "3.8", "4.1", 4 * 3600)],
      now,
    );

    expect((push.get("USD")?.value ?? 0)).toBeGreaterThan(0);
  });

  it("applies recency decay and impact weighting to recent event push", () => {
    const push = deriveCurrencyEventPush(
      [
        event("CPI y/y", "EUR", "3.4", "3.1", 4 * 3600, "high"),
        event("CPI y/y", "EUR", "3.4", "3.1", 2 * 24 * 3600, "high"),
        event("CPI y/y", "EUR", "3.4", "3.1", 5 * 24 * 3600, "medium"),
      ],
      now,
    );

    expect((push.get("EUR")?.value ?? 0)).toBeGreaterThan(0.3);
  });

  it("degrades structural backdrop coverage when macro inputs are partial", () => {
    const structural = deriveCurrencyStructuralBackdrop([
      buildSnapshot("USD", "5.25", "3.2"),
      buildSnapshot("EUR", "4.00", null),
      buildSnapshot("GBP", "5.00", "3.8"),
      buildSnapshot("JPY", "0.10", "2.4"),
    ]);

    expect(structural.get("EUR")).toMatchObject({ coverage: 0.5, value: 0 });
    expect((structural.get("USD")?.coverage ?? 0)).toBe(1);
  });

  it("prefers large clean board gaps over event-blocked pairs in the shortlist", () => {
    const snapshots = [
      buildSnapshot("USD", "5.25", "3.1"),
      buildSnapshot("EUR", "4.00", "2.4"),
      buildSnapshot("GBP", "5.00", "3.6"),
      buildSnapshot("JPY", "0.10", "2.8"),
      buildSnapshot("AUD", "4.35", "3.5"),
      buildSnapshot("CAD", "4.75", "2.9"),
      buildSnapshot("NZD", "4.50", "4.1"),
      buildSnapshot("CHF", "1.25", "1.1"),
    ];

    const candleMap: Partial<Record<string, StrengthPairCandleSet>> = {
      EURUSD: { d1: buildCandles("up", 30, 0.01), h4: buildCandles("up", 20, 0.006) },
      GBPUSD: { d1: buildCandles("down", 30, 0.008), h4: buildCandles("down", 20, 0.004) },
      USDJPY: { d1: buildCandles("up", 30, 0.012), h4: buildCandles("up", 20, 0.007) },
      AUDUSD: { d1: buildCandles("down", 30, 0.007), h4: buildCandles("down", 20, 0.004) },
      USDCAD: { d1: buildCandles("up", 30, 0.006), h4: buildCandles("up", 20, 0.003) },
    };

    const result = deriveStrengthMeterResult({
      snapshots,
      events: [event("Interest Rate Decision", "JPY", "0.10", "0.10", -6 * 3600)],
      candleMap,
      nowSeconds: now,
    });

    expect(result.shortlist[0].score).toBeGreaterThan(result.lowerPriority[0].score);
    expect(result.shortlist.some((item) => item.pair.name === "USDJPY" && item.eventSensitiveSoon)).toBe(true);
  });
});
