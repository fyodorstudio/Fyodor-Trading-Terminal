import { describe, expect, it } from "vitest";
import {
  getEventRadarSummary,
  getEventSensitivity,
  getMacroBackdropVerdict,
  getMacroSummary,
  getOverviewPipelineStatus,
  getOverviewSpecialistSummaries,
  getPairOpportunitySummary,
  getPairAttentionVerdict,
  getPriceAlignment,
  getStrengthDifferentialSummary,
  getTopEvents,
  getTrustInspectorSummary,
  getWhoIsWinningNow,
  sortOverviewPairs,
} from "@/app/lib/overview";
import { FX_PAIRS } from "@/app/config/fxPairs";
import { resolveTrustState } from "@/app/lib/status";
import type { BridgeCandle, BridgeHealth, CalendarEvent, CentralBankSnapshot, MarketStatusResponse } from "@/app/types";

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

function buildTrendCandles(direction: "up" | "down", count: number = 30): BridgeCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const base = direction === "up" ? 1 + index * 0.002 : 1.6 - index * 0.002;
    return {
      time: now - (count - index) * 3600,
      open: base,
      high: base + 0.0015,
      low: base - 0.0015,
      close: direction === "up" ? base + 0.001 : base - 0.001,
      volume: 100,
    };
  });
}

function buildBoardCandleMap(): Partial<Record<string, { d1: BridgeCandle[]; h4: BridgeCandle[] }>> {
  return {
    EURUSD: { d1: buildTrendCandles("up"), h4: buildTrendCandles("up", 20) },
    USDJPY: { d1: buildTrendCandles("up"), h4: buildTrendCandles("up", 20) },
    GBPUSD: { d1: buildTrendCandles("down"), h4: buildTrendCandles("down", 20) },
    USDCHF: { d1: buildTrendCandles("up"), h4: buildTrendCandles("up", 20) },
    AUDUSD: { d1: buildTrendCandles("down"), h4: buildTrendCandles("down", 20) },
    USDCAD: { d1: buildTrendCandles("up"), h4: buildTrendCandles("up", 20) },
    NZDUSD: { d1: buildTrendCandles("down"), h4: buildTrendCandles("down", 20) },
    EURJPY: { d1: buildTrendCandles("up"), h4: buildTrendCandles("up", 20) },
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

  it("resolves base price alignment when D1 and H1 both confirm the base side", () => {
    const summary = getPriceAlignment("EURUSD", buildTrendCandles("up"), buildTrendCandles("up"));

    expect(summary.direction).toBe("base");
    expect(summary.label).toBe("Aligned");
  });

  it("resolves mixed price alignment when D1 and H1 disagree", () => {
    const summary = getPriceAlignment("EURUSD", buildTrendCandles("up"), buildTrendCandles("down"));

    expect(summary.direction).toBe("mixed");
  });

  it("returns a high-conviction base winner when macro, strength, and price align", () => {
    const snapshots = [snapshot("EUR", "4.00", "3.00"), snapshot("USD", "2.00", "1.00"), snapshot("GBP", "3.00", "2.00")];
    const trustState = resolveTrustState(liveHealth, "live", marketStatus("open"));
    const macroSummary = getMacroSummary("EURUSD", snapshots);
    const strengthSummary = getStrengthDifferentialSummary("EURUSD", snapshots);
    const eventSensitivity = getEventSensitivity([], "EURUSD", now);

    const summary = getWhoIsWinningNow(
      "EURUSD",
      trustState,
      macroSummary,
      strengthSummary,
      eventSensitivity,
      marketStatus("open"),
      85,
      18,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
    );

    expect(summary.winner).toBe("base");
    expect(summary.conviction).toBe("high");
    expect(summary.actionLabel).toBe("Focus now");
  });

  it("returns conflicted when macro and strength disagree", () => {
    const snapshots = [snapshot("EUR", "4.00", "1.00"), snapshot("USD", "2.00", "3.00"), snapshot("GBP", "3.00", "2.00")];
    const trustState = resolveTrustState(liveHealth, "live", marketStatus("open"));
    const macroSummary = getMacroSummary("EURUSD", snapshots);
    const strengthSummary = getStrengthDifferentialSummary("EURUSD", snapshots);

    const summary = getWhoIsWinningNow(
      "EURUSD",
      trustState,
      macroSummary,
      strengthSummary,
      getEventSensitivity([], "EURUSD", now),
      marketStatus("open"),
      70,
      15,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
    );

    expect(summary.winner).toBe("conflicted");
  });

  it("downgrades conviction under limited trust", () => {
    const snapshots = [snapshot("EUR", "4.00", "3.00"), snapshot("USD", "2.00", "1.00"), snapshot("GBP", "3.00", "2.00")];
    const trustState = resolveTrustState(liveHealth, "stale", marketStatus("open"));
    const summary = getWhoIsWinningNow(
      "EURUSD",
      trustState,
      getMacroSummary("EURUSD", snapshots),
      getStrengthDifferentialSummary("EURUSD", snapshots),
      getEventSensitivity([], "EURUSD", now),
      marketStatus("open"),
      75,
      16,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
    );

    expect(summary.conviction).toBe("low");
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

  it("caps pair opportunity at monitor when a relevant event is inside 2 hours", () => {
    const snapshots = [snapshot("EUR", "4.00", "3.00"), snapshot("USD", "2.00", "1.00"), snapshot("GBP", "3.00", "2.00")];
    const trustState = resolveTrustState(liveHealth, "live", marketStatus("open"));
    const summary = getPairOpportunitySummary(
      "EURUSD",
      trustState,
      snapshots,
      [event(1, "USD", 60 * 60)],
      buildBoardCandleMap(),
      marketStatus("open"),
      85,
      18,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
      now,
    );

    expect(summary.label).toBe("Monitor");
  });

  it("caps pair opportunity at avoid when trust is no", () => {
    const snapshots = [snapshot("EUR", "4.00", "3.00"), snapshot("USD", "2.00", "1.00"), snapshot("GBP", "3.00", "2.00")];
    const trustState = resolveTrustState({ ...liveHealth, terminal_connected: false }, "live", marketStatus("open"));
    const summary = getPairOpportunitySummary(
      "EURUSD",
      trustState,
      snapshots,
      [],
      buildBoardCandleMap(),
      marketStatus("open"),
      85,
      18,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
      now,
    );

    expect(summary.label).toBe("Avoid for now");
  });

  it("prefers aligned pairs over unresolved high-atr pairs in shortlist-style sorting", () => {
    const snapshots = [snapshot("EUR", "4.00", "3.00"), snapshot("USD", "2.00", "1.00"), snapshot("GBP", "3.00", "2.00"), snapshot("JPY", "0.50", "1.20")];
    const trustState = resolveTrustState(liveHealth, "live", marketStatus("open"));
    const aligned = getPairOpportunitySummary(
      "EURUSD",
      trustState,
      snapshots,
      [],
      buildBoardCandleMap(),
      marketStatus("open"),
      70,
      15,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
      now,
    );
    const unresolved = getPairOpportunitySummary(
      "USDJPY",
      trustState,
      snapshots,
      [],
      {},
      marketStatus("open"),
      100,
      20,
      [],
      [],
      now,
    );

    expect(aligned.score).toBeGreaterThan(unresolved.score);
  });

  it("keeps price alignment unresolved when candle history is missing", () => {
    const summary = getPriceAlignment("EURUSD", [], []);
    expect(summary.direction).toBe("unresolved");
  });

  it("reduces pair opportunity quality when market session context is unavailable", () => {
    const snapshots = [snapshot("EUR", "4.00", "3.00"), snapshot("USD", "2.00", "1.00"), snapshot("GBP", "3.00", "2.00")];
    const trustState = resolveTrustState(liveHealth, "live", marketStatus("open"));
    const openSummary = getPairOpportunitySummary(
      "EURUSD",
      trustState,
      snapshots,
      [],
      buildBoardCandleMap(),
      marketStatus("open"),
      85,
      18,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
      now,
    );
    const unavailableSummary = getPairOpportunitySummary(
      "EURUSD",
      trustState,
      snapshots,
      [],
      buildBoardCandleMap(),
      { ...marketStatus("open"), session_state: "unavailable", is_open: null },
      85,
      18,
      buildTrendCandles("up"),
      buildTrendCandles("up"),
      now,
    );

    expect(unavailableSummary.score).toBeLessThan(openSummary.score);
    expect(["Monitor", "Avoid for now"]).toContain(unavailableSummary.label);
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
      buildBoardCandleMap(),
      now,
    );

    expect(summaries).toHaveLength(3);
    expect(summaries[0].id).toBe("strength-meter");
    expect(summaries[1].id).toBe("dashboard");
    expect(summaries[2].id).toBe("event-tools");
  });
});
