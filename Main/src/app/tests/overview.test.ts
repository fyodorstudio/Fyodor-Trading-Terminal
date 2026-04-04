import { describe, expect, it } from "vitest";
import {
  getEventRadarSummary,
  getEventSensitivity,
  getMacroBackdropVerdict,
  getMacroSummary,
  getOverviewPipelineStatus,
  getOverviewSpecialistSummaries,
  getPairAttentionVerdict,
  getStrengthDifferentialSummary,
  getTopEvents,
  getTrustInspectorSummary,
  sortOverviewPairs,
} from "@/app/lib/overview";
import { FX_PAIRS } from "@/app/config/fxPairs";
import { resolveTrustState } from "@/app/lib/status";
import type { BridgeHealth, CalendarEvent, CentralBankSnapshot, MarketStatusResponse } from "@/app/types";

const now = 1_710_000_000;

const liveHealth: BridgeHealth = {
  ok: true,
  terminal_connected: true,
  last_calendar_ingest_at: now,
  calendar_events_count: 12,
  last_error: null,
};

function marketStatus(session_state: MarketStatusResponse["session_state"]): MarketStatusResponse {
  return {
    symbol: "EURUSD",
    symbol_path: "Forex Majors\\EURUSD",
    asset_class: "forex",
    session_state,
    is_open: session_state === "open" ? true : session_state === "closed" ? false : null,
    terminal_connected: true,
    checked_at: now,
    server_time: now,
    last_tick_time: now,
    next_open_time: now + 3600,
    next_close_time: now + 3600,
    reason: null,
  };
}

function snapshot(currency: string, rate: string, inflation: string): CentralBankSnapshot {
  return {
    currency,
    countryCode: currency === "EUR" ? "EU" : currency === "USD" ? "US" : "GB",
    bankName: `${currency} Bank`,
    flag: currency === "EUR" ? "EU" : currency === "USD" ? "US" : "GB",
    currentPolicyRate: rate,
    previousPolicyRate: rate,
    currentInflationRate: inflation,
    previousInflationRate: inflation,
    policyRateSource: "released_actual",
    policyRateSourceTitle: "Policy",
    policyRateSourceTime: now,
    inflationSource: "released_actual",
    inflationSourceTitle: "CPI",
    inflationSourceTime: now,
    lastRateReleaseAt: now,
    lastCpiReleaseAt: now,
    nextRateEventAt: now + 100_000,
    nextRateEventTitle: "Rate Decision",
    nextCpiEventAt: now + 100_000,
    nextCpiEventTitle: "CPI",
    status: "ok",
    notes: [],
  };
}

function event(id: number, currency: string, offsetSeconds: number): CalendarEvent {
  return {
    id,
    time: now + offsetSeconds,
    countryCode: currency === "EUR" ? "EU" : currency === "USD" ? "US" : "GB",
    currency,
    title: `${currency} Event`,
    impact: "high",
    actual: "",
    forecast: "",
    previous: "",
  };
}

describe("overview logic", () => {
  it("prioritizes pair-relevant events in the top events list", () => {
    const rows = getTopEvents(
      [event(1, "GBP", 600), event(2, "USD", 1_200), event(3, "EUR", 1_800), event(4, "GBP", 300), event(5, "USD", 2_400)],
      "EURUSD",
      now,
    );

    expect(rows).toHaveLength(4);
    expect(rows[0].currency).toBe("USD");
    expect(rows[0].relevant).toBe(true);
    expect(rows[0].relevance).toBe("quote");
    expect(rows[1].currency).toBe("EUR");
    expect(rows[1].relevant).toBe(true);
    expect(rows[1].relevance).toBe("base");
    expect(rows[2].currency).toBe("USD");
    expect(rows[3].currency).toBe("GBP");
    expect(rows[3].relevance).toBe("context");
  });

  it("summarizes the visible radar mix and nearest risk", () => {
    const rows = getTopEvents([event(1, "USD", 600), event(2, "GBP", 1_200), event(3, "EUR", 1_800)], "EURUSD", now);
    const sensitivity = getEventSensitivity([event(1, "USD", 600)], "EURUSD", now);
    const summary = getEventRadarSummary("EURUSD", rows, sensitivity);

    expect(summary).toEqual({
      relevantCount: 2,
      contextCount: 1,
      nextRiskDetail: "USD risk is the nearest timing check for EURUSD.",
    });
  });

  it("marks near relevant events as high-risk soon", () => {
    const summary = getEventSensitivity([event(1, "USD", 60 * 60)], "EURUSD", now);
    expect(summary.label).toBe("High-risk soon");
  });

  it("derives a supportive macro backdrop when macro and strength align", () => {
    const snapshots = [
      snapshot("EUR", "4.00", "3.00"),
      snapshot("USD", "2.00", "1.00"),
      snapshot("GBP", "3.00", "2.00"),
    ];

    const macroSummary = getMacroSummary("EURUSD", snapshots);
    const strengthSummary = getStrengthDifferentialSummary("EURUSD", snapshots);
    const verdict = getMacroBackdropVerdict("EURUSD", macroSummary, strengthSummary);

    expect(macroSummary.alignment).toBe("aligned");
    expect(strengthSummary.strongerCurrency).toBe("EUR");
    expect(verdict.label).toBe("Supportive");
  });

  it("waits until the event passes when a relevant release is too close", () => {
    const snapshots = [
      snapshot("EUR", "4.00", "3.00"),
      snapshot("USD", "2.00", "1.00"),
      snapshot("GBP", "3.00", "2.00"),
    ];

    const trustState = resolveTrustState(liveHealth, "live", marketStatus("open"));
    const macroSummary = getMacroSummary("EURUSD", snapshots);
    const strengthSummary = getStrengthDifferentialSummary("EURUSD", snapshots);
    const macroVerdict = getMacroBackdropVerdict("EURUSD", macroSummary, strengthSummary);
    const eventSensitivity = getEventSensitivity([event(1, "USD", 30 * 60)], "EURUSD", now);
    const verdict = getPairAttentionVerdict(
      "EURUSD",
      trustState,
      macroVerdict,
      macroSummary,
      strengthSummary,
      eventSensitivity,
      80,
    );

    expect(verdict.label).toBe("Wait until event passes");
  });

  it("reports a healthy pipeline only when core inputs are fully aligned", () => {
    const trustState = resolveTrustState(liveHealth, "live", marketStatus("open"));
    const pipeline = getOverviewPipelineStatus(trustState, "live", marketStatus("open"), 8);

    expect(pipeline).toMatchObject({
      percent: 100,
      tone: "good",
      label: "Pipeline healthy",
    });
    expect(pipeline.factors).toHaveLength(0);
    expect(pipeline.weights).toEqual([
      { label: "Trust state", earned: 40, max: 40, state: "Yes" },
      { label: "Calendar timing", earned: 25, max: 25, state: "live" },
      { label: "Selected symbol context", earned: 15, max: 15, state: "open" },
      { label: "Macro coverage", earned: 20, max: 20, state: "8/8 resolved" },
    ]);
  });

  it("degrades the pipeline when trust is limited and macro coverage is partial", () => {
    const trustState = resolveTrustState(liveHealth, "stale", marketStatus("open"));
    const pipeline = getOverviewPipelineStatus(trustState, "stale", marketStatus("open"), 5);

    expect(pipeline.percent).toBeLessThan(100);
    expect(pipeline.tone).toBe("warning");
    expect(pipeline.label).toBe("Pipeline limited");
    expect(pipeline.factors).toContain("Trust is limited");
    expect(pipeline.factors).toContain("Calendar feed is stale");
    expect(pipeline.factors).toContain("Macro coverage is 5/8 resolved");
    expect(pipeline.weights[0]).toMatchObject({ earned: 22, max: 40, state: "Limited" });
    expect(pipeline.weights[1]).toMatchObject({ earned: 15, max: 25, state: "stale" });
    expect(pipeline.weights[3]).toMatchObject({ earned: 13, max: 20, state: "5/8 resolved" });
  });

  it("reports a degraded pipeline when trust is no", () => {
    const trustState = resolveTrustState({ ...liveHealth, terminal_connected: false }, "live", marketStatus("open"));
    const pipeline = getOverviewPipelineStatus(trustState, "live", marketStatus("open"), 8);

    expect(pipeline.tone).toBe("danger");
    expect(pipeline.label).toBe("Pipeline degraded");
    expect(pipeline.percent).toBeLessThan(70);
  });

  it("builds trust inspector details from the shared trust state", () => {
    const trustState = resolveTrustState(liveHealth, "stale", marketStatus("open"));
    const inspector = getTrustInspectorSummary(trustState, "stale", marketStatus("open"));

    expect(inspector.title).toContain("Limited");
    expect(inspector.supportingInputs).toContain("MT5 terminal connection is available.");
    expect(inspector.limitingInputs).toContain("Calendar timing is delayed.");
    expect(inspector.affects).toHaveLength(3);
  });

  it("sorts pairs by volatility with unresolved ATR values last", () => {
    const pairs = FX_PAIRS.slice(0, 4);
    const sorted = sortOverviewPairs(
      pairs,
      "",
      "volatility",
      {
        EURUSD: 55,
        USDJPY: null,
        GBPUSD: 72,
        USDCHF: 41,
      },
      [],
    );

    expect(sorted.map((pair) => pair.name)).toEqual(["GBPUSD", "EURUSD", "USDCHF", "USDJPY"]);
  });

  it("sorts pairs alphabetically after search filtering", () => {
    const sorted = sortOverviewPairs(FX_PAIRS.slice(0, 6), "usd", "alphabetical", {}, []);
    expect(sorted.map((pair) => pair.name)).toEqual(["AUDUSD", "EURUSD", "GBPUSD", "USDCAD", "USDCHF", "USDJPY"]);
  });

  it("moves favorites to the top of the selector list", () => {
    const sorted = sortOverviewPairs(FX_PAIRS.slice(0, 4), "", "favorites", {}, ["USDJPY", "GBPUSD"]);
    expect(sorted.map((pair) => pair.name)).toEqual(["GBPUSD", "USDJPY", "EURUSD", "USDCHF"]);
  });

  it("builds compact specialist summaries for overview", () => {
    const summaries = getOverviewSpecialistSummaries(
      "EURUSD",
      [snapshot("EUR", "4.00", "3.00"), snapshot("USD", "2.00", "1.00"), snapshot("GBP", "3.00", "2.00")],
      [event(1, "USD", 3_600)],
      now,
    );

    expect(summaries).toHaveLength(3);
    expect(summaries[0].id).toBe("strength-meter");
    expect(summaries[1].id).toBe("dashboard");
    expect(summaries[2].id).toBe("event-quality");
  });
});
