import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MacroStatePrototypeTab } from "@/app/tabs/secondary/MacroStatePrototypeTab";
import type { CentralBankSnapshot } from "@/app/types";

const snapshots: CentralBankSnapshot[] = [
  {
    currency: "USD",
    countryCode: "US",
    bankName: "Federal Reserve",
    flag: "US",
    currentPolicyRate: "5.00",
    previousPolicyRate: "4.75",
    currentInflationRate: "2.00",
    previousInflationRate: "2.20",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "EUR",
    countryCode: "EU",
    bankName: "European Central Bank",
    flag: "EU",
    currentPolicyRate: "2.00",
    previousPolicyRate: "2.00",
    currentInflationRate: "2.60",
    previousInflationRate: "2.80",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "GBP",
    countryCode: "GB",
    bankName: "Bank of England",
    flag: "GB",
    currentPolicyRate: "4.25",
    previousPolicyRate: "4.25",
    currentInflationRate: "2.20",
    previousInflationRate: "2.40",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "JPY",
    countryCode: "JP",
    bankName: "Bank of Japan",
    flag: "JP",
    currentPolicyRate: "0.10",
    previousPolicyRate: "0.00",
    currentInflationRate: "2.80",
    previousInflationRate: "2.60",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "AUD",
    countryCode: "AU",
    bankName: "Reserve Bank of Australia",
    flag: "AU",
    currentPolicyRate: "4.10",
    previousPolicyRate: "4.10",
    currentInflationRate: "3.10",
    previousInflationRate: "3.30",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "CAD",
    countryCode: "CA",
    bankName: "Bank of Canada",
    flag: "CA",
    currentPolicyRate: "3.25",
    previousPolicyRate: "3.25",
    currentInflationRate: "2.40",
    previousInflationRate: "2.50",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "NZD",
    countryCode: "NZ",
    bankName: "Reserve Bank of New Zealand",
    flag: "NZ",
    currentPolicyRate: "3.80",
    previousPolicyRate: "3.80",
    currentInflationRate: "3.40",
    previousInflationRate: "3.50",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "CHF",
    countryCode: "CH",
    bankName: "Swiss National Bank",
    flag: "CH",
    currentPolicyRate: "1.00",
    previousPolicyRate: "1.00",
    currentInflationRate: "1.20",
    previousInflationRate: "1.30",
    policyRateSource: "released_actual",
    policyRateSourceTitle: null,
    policyRateSourceTime: null,
    inflationSource: "released_actual",
    inflationSourceTitle: null,
    inflationSourceTime: null,
    lastRateReleaseAt: null,
    lastCpiReleaseAt: null,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
];

describe("MacroStatePrototypeTab", () => {
  it("renders the macro state shell with pair summary and comparison table", () => {
    const html = renderToStaticMarkup(
      <MacroStatePrototypeTab snapshots={snapshots} onBack={() => {}} />,
    );

    expect(html).toContain("Macro State");
    expect(html).toContain("Macro state of the selected pair.");
    expect(html).toContain("Select Pair");
    expect(html).toContain("View the macro state for the selected pair.");
    expect(html).toContain("Composite Score Methodology");
    expect(html).toContain("Formula + pair breakdown");
    expect(html).toContain("Formula Sheet");
    expect(html).toContain("Show calculation");
    expect(html).toContain("35% real-rate");
    expect(html).toContain("30% policy rate");
    expect(html).toContain("20% policy change");
    expect(html).toContain("15% inflation change");
    expect(html).toContain("Composite Score Formula");
    expect(html).toContain("100.0%");
    expect(html).toContain("Currency");
    expect(html).toContain("Composite");
    expect(html).toContain("Real-rate");
    expect(html).toContain("Prev Policy");
    expect(html).toContain("Policy Change");
    expect(html).toContain("Prev Inflation");
    expect(html).toContain("Regime");
    expect(html).toContain("Regime Metric");
    expect(html).toContain("Regime Output");
    expect(html).toContain("Real-rate proxy");
    expect(html).toContain("Macro Gap");
    expect(html).toContain("Stronger Side");
    expect(html).toContain("AUDJPY");
    expect(html).toContain("Pair Selector");
    expect(html).toContain("Bias");
    expect(html).not.toContain("Event Replay");
    expect(html).not.toContain("What This Means For Manual TA");
    expect(html).not.toContain("Cautions / Limits");
    expect(html).not.toContain("Why AUD vs CAD");
    expect(html).not.toContain("Current Active Regime");
    expect(html).not.toContain("Coverage");
    expect(html).not.toContain("Step 3 in the workflow");
    expect(html).not.toContain("Choose the pair you already inspected in TradingView");
  });
});
