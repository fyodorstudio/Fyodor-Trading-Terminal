import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardTab } from "@/app/tabs/DashboardTab";
import { StrengthMeterTab } from "@/app/tabs/StrengthMeterTab";
import type { CalendarEvent, CentralBankSnapshot } from "@/app/types";

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

const snapshots: CentralBankSnapshot[] = [
  buildSnapshot("USD", "US", "3.75", "3.50", "2.4", "2.3"),
  buildSnapshot("EUR", "EU", "2.00", "2.25", "2.0", "1.8"),
  buildSnapshot("GBP", "GB", "3.75", "4.00", "3.4", "3.8"),
  buildSnapshot("JPY", "JP", "0.80", "0.80", "1.5", "2.1"),
  buildSnapshot("AUD", "AU", "3.85", "3.60", "3.8", "3.6"),
  buildSnapshot("CAD", "CA", "2.00", "2.00", "2.3", "2.4"),
  buildSnapshot("NZD", "NZ", "2.25", "2.25", "3.1", "3.0"),
  buildSnapshot("CHF", "CH", "0.00", "0.00", "0.1", "0.2"),
];

const events: CalendarEvent[] = [
  {
    id: 1,
    time: 1_710_000_000,
    countryCode: "US",
    currency: "USD",
    title: "CPI y/y",
    impact: "high",
    actual: "3.4",
    forecast: "3.1",
    previous: "3.0",
  },
];

describe("DashboardTab", () => {
  it("renders dashboard sections and pair cards from MT5-backed snapshots", () => {
    const html = renderToStaticMarkup(<DashboardTab snapshots={snapshots} />);

    expect(html).toContain("Differential Calculator");
    expect(html).toContain("Interest Rate Differential + Trend");
    expect(html).toContain("Inflation Differential");
    expect(html).toContain("EURUSD");
    expect(html).toContain("-1.75%");
  });
});

describe("StrengthMeterTab", () => {
  it("renders the shortlist, currency board, and methodology shell", () => {
    const html = renderToStaticMarkup(
      <StrengthMeterTab
        snapshots={snapshots}
        events={events}
        status="live"
        onOpenCalendarEvent={() => {}}
      />,
    );

    expect(html).toContain("Open First");
    expect(html).toContain("Board Read");
    expect(html).toContain("Trust And Limits");
    expect(html).toContain("See why");
  });

  it("shows a partial coverage note instead of faking a complete board", () => {
    const broken = [...snapshots];
    broken[0] = buildSnapshot("USD", "US", null, "3.50", "2.4", "2.3");

    const html = renderToStaticMarkup(
      <StrengthMeterTab
        snapshots={broken}
        events={events}
        status="stale"
        onOpenCalendarEvent={() => {}}
      />,
    );

    expect(html).toContain("Some currencies still have partial data");
    expect(html).toContain("USD");
  });
});
