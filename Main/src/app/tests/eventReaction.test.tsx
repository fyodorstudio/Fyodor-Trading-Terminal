import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EventToolsTab } from "@/app/tabs/EventToolsTab";
import {
  deriveAssetFirstStudy,
  deriveEventFirstStudy,
  discoverEventTemplates,
  getHistoricalReplaySamples,
  getPipSize,
  getPairTemplateMap,
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
});

describe("EventToolsTab", () => {
  it("renders the merged event prep shell", () => {
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
    expect(html).toContain("Upcoming Events");
    expect(html).toContain("Replay Chart");
    expect(html).toContain("Actionable Study Brief");
    expect(html).toContain("Analyst Dashboard");
    expect(html).toContain("Manual Event Selector");
  });
});
