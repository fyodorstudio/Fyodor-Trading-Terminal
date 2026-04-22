import { describe, expect, it } from "vitest";
import { deriveWatchlistEngine } from "@/app/lib/watchlistEngine";
import type { CentralBankSnapshot } from "@/app/types";

function buildSnapshot(params: Partial<CentralBankSnapshot> & Pick<CentralBankSnapshot, "currency" | "countryCode">): CentralBankSnapshot {
  return {
    currency: params.currency,
    countryCode: params.countryCode,
    bankName: params.bankName ?? params.currency,
    flag: params.flag ?? params.countryCode,
    currentPolicyRate: params.currentPolicyRate ?? null,
    previousPolicyRate: params.previousPolicyRate ?? null,
    currentInflationRate: params.currentInflationRate ?? null,
    previousInflationRate: params.previousInflationRate ?? null,
    policyRateSource: params.policyRateSource ?? "none",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: params.inflationSource ?? "none",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: params.status ?? "ok",
    notes: [],
  };
}

function fullBoard(): CentralBankSnapshot[] {
  return [
    buildSnapshot({ currency: "USD", countryCode: "US", currentPolicyRate: "5.00", previousPolicyRate: "4.75", currentInflationRate: "2.00", previousInflationRate: "2.20", policyRateSource: "released_actual", inflationSource: "released_actual" }),
    buildSnapshot({ currency: "EUR", countryCode: "EU", currentPolicyRate: "2.00", previousPolicyRate: "2.00", currentInflationRate: "2.60", previousInflationRate: "2.80", policyRateSource: "released_actual", inflationSource: "released_actual" }),
    buildSnapshot({ currency: "GBP", countryCode: "GB", currentPolicyRate: "4.25", previousPolicyRate: "4.25", currentInflationRate: "2.20", previousInflationRate: "2.40", policyRateSource: "released_actual", inflationSource: "released_actual" }),
    buildSnapshot({ currency: "JPY", countryCode: "JP", currentPolicyRate: "0.10", previousPolicyRate: "0.00", currentInflationRate: "2.80", previousInflationRate: "2.60", policyRateSource: "released_actual", inflationSource: "released_actual" }),
    buildSnapshot({ currency: "AUD", countryCode: "AU", currentPolicyRate: "4.10", previousPolicyRate: "4.10", currentInflationRate: "3.10", previousInflationRate: "3.30", policyRateSource: "released_actual", inflationSource: "released_actual" }),
    buildSnapshot({ currency: "CAD", countryCode: "CA", currentPolicyRate: "3.25", previousPolicyRate: "3.25", currentInflationRate: "2.40", previousInflationRate: "2.50", policyRateSource: "released_actual", inflationSource: "released_actual" }),
    buildSnapshot({ currency: "NZD", countryCode: "NZ", currentPolicyRate: "3.80", previousPolicyRate: "3.80", currentInflationRate: "3.40", previousInflationRate: "3.50", policyRateSource: "released_actual", inflationSource: "released_actual" }),
    buildSnapshot({ currency: "CHF", countryCode: "CH", currentPolicyRate: "1.00", previousPolicyRate: "1.00", currentInflationRate: "1.20", previousInflationRate: "1.30", policyRateSource: "released_actual", inflationSource: "released_actual" }),
  ];
}

describe("deriveWatchlistEngine", () => {
  it("ranks a pair with larger macro divergence above a smaller one", () => {
    const result = deriveWatchlistEngine(fullBoard());
    const eurusd = result.rows.find((row) => row.pair.name === "EURUSD");
    const audnzd = result.rows.find((row) => row.pair.name === "AUDNZD");

    expect(eurusd).toBeTruthy();
    expect(audnzd).toBeTruthy();
    expect((eurusd?.pairScore ?? 0)).toBeGreaterThan(audnzd?.pairScore ?? 0);
  });

  it("returns bullish_base when the base score is stronger", () => {
    const result = deriveWatchlistEngine(fullBoard());
    const usdjpy = result.rows.find((row) => row.pair.name === "USDJPY");

    expect(usdjpy?.bias).toBe("bullish_base");
    expect(usdjpy?.strongerSide).toBe("USD");
  });

  it("returns bullish_quote when the quote score is stronger", () => {
    const result = deriveWatchlistEngine(fullBoard());
    const eurusd = result.rows.find((row) => row.pair.name === "EURUSD");

    expect(eurusd?.bias).toBe("bullish_quote");
    expect(eurusd?.strongerSide).toBe("USD");
  });

  it("returns mixed when divergence is below threshold", () => {
    const snapshots = fullBoard();
    snapshots[0] = buildSnapshot({ currency: "USD", countryCode: "US", currentPolicyRate: "3.00", previousPolicyRate: "3.00", currentInflationRate: "2.00", previousInflationRate: "2.00", policyRateSource: "released_actual", inflationSource: "released_actual" });
    snapshots[1] = buildSnapshot({ currency: "EUR", countryCode: "EU", currentPolicyRate: "3.00", previousPolicyRate: "3.00", currentInflationRate: "2.00", previousInflationRate: "2.00", policyRateSource: "released_actual", inflationSource: "released_actual" });

    const result = deriveWatchlistEngine(snapshots);
    const eurusd = result.rows.find((row) => row.pair.name === "EURUSD");

    expect(eurusd?.bias).toBe("mixed");
  });

  it("handles partial snapshot inputs without crashing", () => {
    const snapshots = fullBoard();
    snapshots[0] = buildSnapshot({ currency: "USD", countryCode: "US", currentPolicyRate: "5.00", previousPolicyRate: null, currentInflationRate: null, previousInflationRate: null, policyRateSource: "released_actual", inflationSource: "none", status: "partial" });

    const result = deriveWatchlistEngine(snapshots);
    const usd = result.currencies.find((currency) => currency.currency === "USD");

    expect(result.rows.length).toBeGreaterThan(0);
    expect(usd?.partial).toBe(true);
  });

  it("keeps FX-only scope", () => {
    const result = deriveWatchlistEngine(fullBoard());
    expect(result.rows.every((row) => row.pair.name.length === 6)).toBe(true);
    expect(result.rows.some((row) => row.pair.name === "XAUUSD")).toBe(false);
  });
});
