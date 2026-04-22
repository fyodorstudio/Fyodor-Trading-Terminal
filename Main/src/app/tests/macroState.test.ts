import { describe, expect, it } from "vitest";
import { deriveMacroState } from "@/app/lib/macroState";
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

describe("deriveMacroState", () => {
  it("returns the requested pair with deterministic macro verdict and guidance", () => {
    const result = deriveMacroState(fullBoard(), "AUDJPY");

    expect(result.pair.name).toBe("AUDJPY");
    expect(result.row.bias).toBe("bullish_base");
    expect(result.strongerCurrency).toBe("AUD");
    expect(result.leanSummary).toContain("supports long-side ideas");
    expect(result.taInterpretation).toContain("TradingView plan is long");
  });

  it("returns mixed guidance when divergence is too small", () => {
    const snapshots = fullBoard();
    snapshots[0] = buildSnapshot({ currency: "USD", countryCode: "US", currentPolicyRate: "3.00", previousPolicyRate: "3.00", currentInflationRate: "2.00", previousInflationRate: "2.00", policyRateSource: "released_actual", inflationSource: "released_actual" });
    snapshots[1] = buildSnapshot({ currency: "EUR", countryCode: "EU", currentPolicyRate: "3.00", previousPolicyRate: "3.00", currentInflationRate: "2.00", previousInflationRate: "2.00", policyRateSource: "released_actual", inflationSource: "released_actual" });

    const result = deriveMacroState(snapshots, "EURUSD");

    expect(result.row.bias).toBe("mixed");
    expect(result.regimeLabel).toBe("mixed");
    expect(result.leanSummary).toContain("does not provide a clean enough directional backdrop");
  });

  it("surfaces coverage-related caution when inputs are partial", () => {
    const snapshots = fullBoard();
    snapshots[0] = buildSnapshot({ currency: "USD", countryCode: "US", currentPolicyRate: "5.00", previousPolicyRate: null, currentInflationRate: null, previousInflationRate: null, policyRateSource: "released_actual", inflationSource: "none", status: "partial" });

    const result = deriveMacroState(snapshots, "USDJPY");

    expect(result.row.partial).toBe(true);
    expect(result.row.partialNote).toContain("partial macro inputs");
    expect(result.metrics.find((metric) => metric.label === "Coverage")?.baseValue).toBeLessThan(100);
  });
});
