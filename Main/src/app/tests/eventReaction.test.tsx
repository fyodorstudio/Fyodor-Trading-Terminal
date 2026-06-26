import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EventToolsTab } from "@/app/tabs/EventToolsTab";
import {
  deriveAssetFirstStudy,
  deriveEventFirstStudy,
  discoverEventTemplates,
  getEventComparison,
  getHistoricalReplaySamples,
  getPairFirstReplayGroups,
  getPipSize,
  getPairTemplateMap,
  getReplayFetchRange,
  getReplayWindowCandles,
  getTemplateEvents,
  getUpcomingReactionEvents,
} from "@/app/lib/eventReaction";
import type { BridgeCandle, CalendarEvent, ReactionWindow } from "@/app/types";

function buildEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: overrides.id ?? 1,
    time: overrides.time ?? 1_763_200_000,
    countryCode: overrides.countryCode ?? "US",
    currency: overrides.currency ?? "USD",
    title: overrides.title ?? "CPI y/y",
    impact: overrides.impact ?? "high",
    actual: overrides.actual ?? "2.5",
    forecast: overrides.forecast ?? "2.3",
    previous: overrides.previous ?? "2.2",
  };
}

function buildCandles(rows: Array<[number, number]>): BridgeCandle[] {
  return rows.map(([time, close]) => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));
}

function buildWindowMap(scale = 1): Record<ReactionWindow, BridgeCandle[]> {
  return {
    "15m": buildCandles([
      [900, 1.0],
      [1000, 1.0],
      [1900, 1.0 + 0.01 * scale],
      [2000, 1.0],
      [2900, 1.0 + 0.008 * scale],
    ]),
    "1h": buildCandles([
      [900, 1.0],
      [1000, 1.0],
      [2000, 1.0],
      [4600, 1.0 + 0.02 * scale],
      [5600, 1.0 + 0.015 * scale],
    ]),
    "4h": buildCandles([
      [900, 1.0],
      [2000, 1.0],
      [15400, 1.0 + 0.03 * scale],
      [16400, 1.0 + 0.025 * scale],
    ]),
    "1d": buildCandles([
      [900, 1.0],
      [2000, 1.0],
      [87400, 1.0 + 0.05 * scale],
      [88400, 1.0 + 0.04 * scale],
    ]),
  };
}

describe("eventReaction template discovery", () => {
  it("discovers usable MT5 event templates and filters weak ones by default", () => {
    const events = [
      buildEvent({ id: 1, time: 1_763_100_000, currency: "USD", title: "CPI y/y" }),
      buildEvent({ id: 2, time: 1_763_000_000, currency: "USD", title: "CPI y/y" }),
      buildEvent({ id: 3, time: 1_762_900_000, currency: "USD", title: "CPI y/y" }),
      buildEvent({ id: 4, time: 1_762_800_000, currency: "USD", title: "CPI y/y" }),
      buildEvent({ id: 5, time: 1_762_700_000, currency: "USD", title: "CPI y/y" }),
      buildEvent({ id: 6, time: 1_763_050_000, currency: "EUR", title: "ECB Interest Rate Decision" }),
    ];

    const hiddenWeak = discoverEventTemplates({ events });
    const allTemplates = discoverEventTemplates({ events, includeWeak: true });

    expect(hiddenWeak).toHaveLength(1);
    expect(hiddenWeak[0].key).toBe("USD|CPI y/y");
    expect(allTemplates.some((template) => template.key === "EUR|ECB Interest Rate Decision")).toBe(true);
  });

  it("groups base/quote event templates before separate global movers", () => {
    const now = 10_000;
    const events = [
      buildEvent({ id: 1, time: 1000, currency: "GBP", countryCode: "GB", title: "Employment Change", impact: "high" }),
      buildEvent({ id: 2, time: 2000, currency: "JPY", countryCode: "JP", title: "Tokyo CPI y/y", impact: "high" }),
      buildEvent({ id: 3, time: 3000, currency: "USD", countryCode: "US", title: "CPI y/y", impact: "high" }),
      buildEvent({ id: 4, time: 4000, currency: "EUR", countryCode: "EU", title: "GDP q/q", impact: "medium" }),
      buildEvent({ id: 5, time: 5000, currency: "AUD", countryCode: "AU", title: "Retail Sales m/m", impact: "high" }),
    ];

    const groups = getPairFirstReplayGroups({
      events,
      pair: { name: "GBPJPY", base: "GBP", quote: "JPY" },
      includeWeak: true,
      nowSeconds: now,
    });

    expect(groups.pairTemplates.map((template) => template.currency)).toEqual(["GBP", "JPY"]);
    expect(groups.globalTemplates.map((template) => template.key)).toEqual(["USD|CPI y/y"]);
    expect(groups.globalTemplates.some((template) => template.currency === "GBP")).toBe(false);
  });

  it("builds upcoming shortcut rows only for supported core macro events", () => {
    const now = 1_763_200_000;
    const templates = discoverEventTemplates({
      events: [
        buildEvent({ id: 1, time: now - 5000, currency: "USD", title: "CPI y/y" }),
        buildEvent({ id: 2, time: now - 4000, currency: "USD", title: "CPI y/y" }),
        buildEvent({ id: 3, time: now - 3000, currency: "USD", title: "CPI y/y" }),
        buildEvent({ id: 4, time: now - 2000, currency: "USD", title: "CPI y/y" }),
        buildEvent({ id: 5, time: now - 1000, currency: "USD", title: "CPI y/y" }),
      ],
      nowSeconds: now,
    });

    const upcoming = getUpcomingReactionEvents({
      events: [
        buildEvent({ id: 6, time: now + 3600, currency: "USD", title: "CPI y/y" }),
        buildEvent({ id: 7, time: now + 7200, currency: "USD", title: "Fed Chair Speech" }),
      ],
      templates,
      nowSeconds: now,
    });

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].templateKey).toBe("USD|CPI y/y");
    expect(upcoming[0].familyLabel).toBe("Inflation");
  });
});

describe("eventReaction studies", () => {
  const events = [
    buildEvent({ id: 1, time: 1000, currency: "USD", title: "CPI y/y", actual: "2.6", forecast: "2.3" }),
    buildEvent({ id: 2, time: 2000, currency: "USD", title: "CPI y/y", actual: "2.1", forecast: "2.3" }),
    buildEvent({ id: 3, time: 3000, currency: "EUR", title: "ECB Interest Rate Decision", actual: "2.0", forecast: "2.0" }),
    buildEvent({ id: 4, time: 4000, currency: "JPY", title: "Tokyo CPI y/y", actual: "2.0", forecast: "1.8" }),
  ];

  it("ranks relevant FX pairs in event-first mode", () => {
    const template = discoverEventTemplates({ events, nowSeconds: 10_000, includeWeak: true }).find(
      (item) => item.key === "USD|CPI y/y",
    )!;
    const templateEvents = getTemplateEvents({ events, templateKey: template.key, nowSeconds: 10_000 });
    const pairCandles = new Map([
      ["EURUSD", buildWindowMap(1.4)],
      ["USDJPY", buildWindowMap(0.6)],
      ["GBPUSD", buildWindowMap(1.0)],
    ]);

    const summary = deriveEventFirstStudy({
      template,
      templateEvents,
      pairCandles,
    });

    expect(summary.rows).toHaveLength(3);
    expect(summary.rows[0].label).toBe("EURUSD");
    expect(summary.beatCount).toBe(1);
    expect(summary.missCount).toBe(1);
    expect(summary.rows[0].summaryWindows["1h"].medianAbsolutePips).toBeGreaterThan(
      summary.rows[1].summaryWindows["1h"].medianAbsolutePips ?? 0,
    );
  });

  it("keeps asset-first scope restricted to the selected pair currencies", () => {
    const templateMap = getPairTemplateMap({
      events,
      pair: { name: "EURUSD", base: "EUR", quote: "USD" },
      includeWeak: true,
      nowSeconds: 10_000,
    });

    const summary = deriveAssetFirstStudy({
      pair: { name: "EURUSD", base: "EUR", quote: "USD" },
      templateMap,
      candlesByWindow: buildWindowMap(1),
    });

    expect(summary.rows.some((row) => row.currency === "JPY")).toBe(false);
    expect(summary.rows.map((row) => row.label)).toContain("CPI y/y");
    expect(summary.rows.map((row) => row.label)).toContain("ECB Interest Rate Decision");
  });

  it("uses the correct pip size for JPY and non-JPY pairs", () => {
    expect(getPipSize({ name: "EURUSD", base: "EUR", quote: "USD" })).toBe(0.0001);
    expect(getPipSize({ name: "USDJPY", base: "USD", quote: "JPY" })).toBe(0.01);
  });

  it("returns historical replay samples newest first", () => {
    const samples = getHistoricalReplaySamples({
      events,
      templateKey: "USD|CPI y/y",
      nowSeconds: 10_000,
    });

    expect(samples).toHaveLength(2);
    expect(samples[0].eventTime).toBe(2000);
    expect(samples[1].eventTime).toBe(1000);
  });

  it("prefers forecast comparison and falls back to previous when forecast is missing", () => {
    const forecastEvent = buildEvent({ id: 8, time: 1000, actual: "2.6", forecast: "2.3", previous: "2.1" });
    const previousOnlyEvent = buildEvent({ id: 9, time: 2000, actual: "8.6", forecast: "-", previous: "7.9" });

    expect(getEventComparison(forecastEvent)).toMatchObject({
      basis: "forecast",
      comparisonValue: 2.3,
      surprise: 0.3,
    });
    expect(getEventComparison(previousOnlyEvent)).toMatchObject({
      basis: "previous",
      comparisonValue: 7.9,
      surprise: 0.7,
    });

    const samples = getHistoricalReplaySamples({
      events: [forecastEvent, previousOnlyEvent],
      templateKey: "USD|CPI y/y",
      nowSeconds: 10_000_000_000,
    });

    expect(samples[0].comparisonBasis).toBe("previous");
    expect(samples[1].comparisonBasis).toBe("forecast");
  });

  it("builds a fixed replay candle window around the event", () => {
    const candles = Array.from({ length: 40 }, (_, index) => ({
      time: index * 3600,
      open: 1 + index * 0.001,
      high: 1 + index * 0.0015,
      low: 1 + index * 0.0005,
      close: 1 + index * 0.0012,
      volume: 1,
    }));

    const replay = getReplayWindowCandles({
      candles,
      eventTime: 20 * 3600,
      beforeCount: 14,
      afterCount: 14,
    });

    expect(replay).not.toBeNull();
    expect(replay?.candles).toHaveLength(29);
    expect(replay?.eventIndex).toBe(14);
  });

  it("respects configurable replay candle counts", () => {
    const candles = Array.from({ length: 30 }, (_, index) => ({
      time: index * 900,
      open: 1 + index * 0.001,
      high: 1 + index * 0.0015,
      low: 1 + index * 0.0005,
      close: 1 + index * 0.0012,
      volume: 1,
    }));

    const replay = getReplayWindowCandles({
      candles,
      eventTime: 12 * 900,
      beforeCount: 4,
      afterCount: 6,
    });

    expect(replay?.candles).toHaveLength(11);
    expect(replay?.eventIndex).toBe(4);
  });

  it("keeps replay history fetch ranges within the bridge limit for H4 and D1", () => {
    const eventTime = 1_763_200_000;
    const h4Range = getReplayFetchRange({
      eventTime,
      timeframe: "H4",
      beforeCount: 14,
      afterCount: 14,
    });
    const d1Range = getReplayFetchRange({
      eventTime,
      timeframe: "D1",
      beforeCount: 14,
      afterCount: 14,
    });
    const cappedD1Range = getReplayFetchRange({
      eventTime,
      timeframe: "D1",
      beforeCount: 80,
      afterCount: 80,
    });
    const maxRangeSeconds = 40 * 24 * 60 * 60;

    expect(h4Range.to - h4Range.from).toBeLessThanOrEqual(maxRangeSeconds);
    expect(d1Range.to - d1Range.from).toBeLessThanOrEqual(maxRangeSeconds);
    expect(cappedD1Range.to - cappedD1Range.from).toBeLessThanOrEqual(maxRangeSeconds);
    expect(cappedD1Range.capped).toBe(true);
  });
});

describe("EventToolsTab", () => {
  it("renders the lean pair-first replay shell", () => {
    const html = renderToStaticMarkup(
      <EventToolsTab
        events={[
          buildEvent({ id: 1, time: 1_763_100_000, currency: "USD", title: "CPI y/y" }),
          buildEvent({ id: 2, time: 1_763_000_000, currency: "USD", title: "CPI y/y" }),
          buildEvent({ id: 3, time: 1_762_900_000, currency: "USD", title: "CPI y/y" }),
          buildEvent({ id: 4, time: 1_762_800_000, currency: "USD", title: "CPI y/y" }),
          buildEvent({ id: 5, time: 1_762_700_000, currency: "USD", title: "CPI y/y" }),
        ]}
        status="live"
        lastCalendarIngestAt={1_763_200_000}
      />,
    );

    expect(html).toContain("Event Tools");
    expect(html).toContain("Pair");
    expect(html).toContain("Base/Quote Events");
    expect(html).toContain("Major Global Movers");
    expect(html).toContain("Replay Chart");
    expect(html).toContain("Past Releases");
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).toContain("Play");
    expect(html).toContain("What This Event Is");
    expect(html).toContain("Why Traders Care");
    expect(html).toContain("Read the marker first");
    expect(html).toContain("Check the comparison basis");
    expect(html.indexOf("Past Releases")).toBeLessThan(html.indexOf("Replay Brief"));
    expect(html.indexOf("Previous")).toBeGreaterThan(html.indexOf("Past Releases"));
    expect(html).not.toContain("Analyst Dashboard");
    expect(html).not.toContain("Manual Event Selector");
  });
});
