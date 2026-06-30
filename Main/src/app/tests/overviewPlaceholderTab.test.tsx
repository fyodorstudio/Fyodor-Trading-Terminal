import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OverviewPlaceholderTab } from "@/app/tabs/primary/OverviewPlaceholderTab";
import type { CalendarEvent, CentralBankSnapshot, MarketStatusResponse } from "@/app/types";

const events: CalendarEvent[] = [
  {
    id: 1,
    time: 1_783_000_000,
    countryCode: "US",
    currency: "USD",
    title: "CPI y/y",
    impact: "high",
    actual: "",
    forecast: "2.4%",
    previous: "2.3%",
  },
  {
    id: 2,
    time: 1_780_000_000,
    countryCode: "EU",
    currency: "EUR",
    title: "Main Refinancing Rate",
    impact: "high",
    actual: "2.00%",
    forecast: "2.00%",
    previous: "2.15%",
  },
];

const snapshots: CentralBankSnapshot[] = [
  {
    currency: "EUR",
    countryCode: "EU",
    bankName: "European Central Bank",
    flag: "EU",
    currentPolicyRate: "2.00%",
    previousPolicyRate: "2.15%",
    currentInflationRate: "1.9%",
    previousInflationRate: "2.0%",
    policyRateSource: "released_actual",
    policyRateSourceTitle: "Main Refinancing Rate",
    policyRateSourceTime: 1_780_000_000,
    inflationSource: "released_actual",
    inflationSourceTitle: "CPI y/y",
    inflationSourceTime: 1_779_000_000,
    lastRateReleaseAt: 1_780_000_000,
    lastCpiReleaseAt: 1_779_000_000,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: null,
    nextCpiEventTitle: null,
    status: "ok",
    notes: [],
  },
  {
    currency: "USD",
    countryCode: "US",
    bankName: "Federal Reserve",
    flag: "US",
    currentPolicyRate: "4.50%",
    previousPolicyRate: "4.75%",
    currentInflationRate: "2.3%",
    previousInflationRate: "2.4%",
    policyRateSource: "released_actual",
    policyRateSourceTitle: "Federal Funds Rate",
    policyRateSourceTime: 1_779_000_000,
    inflationSource: "upcoming_previous",
    inflationSourceTitle: "CPI y/y",
    inflationSourceTime: 1_783_000_000,
    lastRateReleaseAt: 1_779_000_000,
    lastCpiReleaseAt: 1_778_000_000,
    nextRateEventAt: null,
    nextRateEventTitle: null,
    nextCpiEventAt: 1_783_000_000,
    nextCpiEventTitle: "CPI y/y",
    status: "ok",
    notes: [],
  },
];

const marketStatus: MarketStatusResponse = {
  symbol: "EURUSD",
  symbol_path: null,
  asset_class: "forex",
  session_state: "open",
  is_open: true,
  terminal_connected: true,
  checked_at: 1_781_000_000,
  server_time: 1_781_000_000,
  last_tick_time: 1_781_000_000,
  next_open_time: null,
  next_close_time: null,
  reason: null,
};

describe("OverviewPlaceholderTab", () => {
  it("renders the fresh pair brief without legacy overview copy", () => {
    const html = renderToStaticMarkup(
      <OverviewPlaceholderTab
        selectedSymbol="EURUSD"
        onSelectedSymbolChange={() => {}}
        events={events}
        snapshots={snapshots}
        marketStatus={marketStatus}
        currentTime={new Date(1_781_000_000 * 1000)}
        onNavigate={() => {}}
        onOpenCalendarEvent={() => {}}
        onOpenEventReplay={() => {}}
        onOpenChart={() => {}}
      />,
    );

    expect(html).toContain("Pair Brief");
    expect(html).toContain("EURUSD");
    expect(html).toContain("Next Pair Event");
    expect(html).toContain("CPI y/y");
    expect(html).toContain("Recent releases");
    expect(html).toContain("Policy Rate");
    expect(html).not.toContain("Specialist Tools, then Prototyping, then Deprecated Overview");
    expect(html).not.toContain("WORK IN PROGRESS");
  });
});
