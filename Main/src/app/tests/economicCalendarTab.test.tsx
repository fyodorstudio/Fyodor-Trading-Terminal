import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarEventInspectorDrawer,
  EconomicCalendarTab,
  ImpactPill,
  getCalendarFreshness,
} from "@/app/tabs/EconomicCalendarTab";
import type { BridgeHealth, CalendarEvent, CalendarEventExplainer } from "@/app/types";

const nowMs = 1_800_000_000_000;

const health: BridgeHealth = {
  ok: true,
  bridge_connected: true,
  terminal_connected: true,
  last_calendar_ingest_at: Math.floor(nowMs / 1000) - 60,
  calendar_events_count: 4,
  last_error: null,
};

const event: CalendarEvent = {
  id: 1,
  time: 1_800_000_000,
  countryCode: "NZ",
  currency: "NZD",
  title: "Exports",
  impact: "medium",
  actual: "8.620",
  forecast: "",
  previous: "7.944",
};

const explainer: CalendarEventExplainer = {
  family: "generic",
  familyLabel: "General Macro Event",
  knowledgeDepth: "generic",
  releaseStatus: "Released / no numeric forecast",
  resultSnapshot: "Actual is 8.620. Actual is above the previous reading.",
  resultInterpretation: "Judge the reaction against previous value, broader context, and price acceptance.",
  marketSensitivity: "Context-dependent.",
  whatItIs: "This event updates the market on an economic or policy-related data point.",
  whyTradersCare: "New macro information can change expectations for growth, inflation, policy, and currency strength.",
  mayAffect: ["The event currency", "Theme-related assets"],
  priceCaveats: ["Not every release moves price meaningfully."],
  educationalSummary: "Macro events matter when they change market expectations.",
  strongerOutcome: "A stronger result can support the currency if traders see it as growth-positive.",
  weakerOutcome: "A weaker result can hurt the currency if traders see it as growth-negative.",
  contextNote: "Always compare the event to the existing macro story.",
  whatToCompare: ["Actual versus previous", "Whether price holds the first reaction"],
  tradingWorkflow: ["Classify the surprise", "Wait for price confirmation"],
  commonTraps: ["Forcing a trade when price does not confirm"],
};

describe("EconomicCalendarTab redesign", () => {
  it("derives state-first freshness labels", () => {
    expect(getCalendarFreshness(null, nowMs)).toMatchObject({ state: "unknown", label: "Unknown" });
    expect(getCalendarFreshness(Math.floor(nowMs / 1000) - 120, nowMs)).toMatchObject({ state: "fresh", label: "Fresh" });
    expect(getCalendarFreshness(Math.floor(nowMs / 1000) - 121, nowMs)).toMatchObject({ state: "aging", label: "Aging" });
    expect(getCalendarFreshness(Math.floor(nowMs / 1000) - 301, nowMs)).toMatchObject({ state: "stale", label: "Stale" });
  });

  it("renders the operational calendar header with human freshness labels", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let html = "";
    try {
      html = renderToStaticMarkup(
        <EconomicCalendarTab
          health={health}
          persistedLastSyncedAt={Math.floor(nowMs / 1000) - 44}
        />,
      );
    } finally {
      consoleError.mockRestore();
    }

    expect(html).toContain("Economic Calendar");
    expect(html).toContain("View refreshed");
    expect(html).toContain("Broker feed");
    expect(html).toContain("events in current view");
    expect(html).not.toContain("Sync Age");
    expect(html).not.toContain("Ingest Age");
    expect(html).not.toContain("MT5 Server-Time Audit Feed");
  });

  it("renders quiet impact labels", () => {
    const html = renderToStaticMarkup(<ImpactPill level="high" />);

    expect(html).toContain("calendar-impact-pill");
    expect(html).toContain("calendar-impact-high");
    expect(html).toContain("calendar-impact-dot");
    expect(html).toContain("High");
  });

  it("renders selected event details as a right drawer trading brief", () => {
    const html = renderToStaticMarkup(
      <CalendarEventInspectorDrawer
        event={event}
        explainer={explainer}
        timezoneMode="local"
        onClose={() => {}}
      />,
    );

    expect(html).toContain("calendar-event-drawer");
    expect(html).toContain("Trading Brief");
    expect(html).toContain("Learn");
    expect(html).toContain("Trading Workflow");
    expect(html).toContain("What To Compare");
    expect(html).toContain("Caveats");
    expect(html).toContain("Stronger / Weaker Outcome");
    expect(html).toContain("Treat this as a cautious signal");
    expect(html).not.toContain("calendar-event-panel");
  });
});
