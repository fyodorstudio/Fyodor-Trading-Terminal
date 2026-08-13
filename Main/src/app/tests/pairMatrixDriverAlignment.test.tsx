import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartPairMatrixTimeLens, type ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import {
  PAIR_MATRIX_BEFORE_STORAGE_KEY,
  buildPairMatrixSeriesSnapshot,
  buildPairMatrixTimeline,
  classifyPairMatrixEvent,
  getPairMatrixCandleClose,
  getPairMatrixForexCurrencies,
  getPairMatrixRangePixelBounds,
  loadPairMatrixBeforeDays,
  normalizePairMatrixBeforeDays,
  normalizePairMatrixCandleRange,
  normalizePairMatrixSeriesTitle,
  savePairMatrixBeforeDays,
} from "@/app/lib/pairMatrixSnapshot";
import type { CalendarEvent } from "@/app/types";

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: overrides.id ?? 1,
    time: overrides.time ?? 1_000,
    countryCode: overrides.countryCode ?? "US",
    currency: overrides.currency ?? "USD",
    title: overrides.title ?? "CPI y/y",
    impact: overrides.impact ?? "high",
    actual: overrides.actual ?? "3.1%",
    forecast: overrides.forecast ?? "3.0%",
    previous: overrides.previous ?? "2.9%",
  };
}

function timeline(events: CalendarEvent[], overrides: Partial<Parameters<typeof buildPairMatrixTimeline>[0]> = {}) {
  return buildPairMatrixTimeline({
    events,
    currencies: ["EUR", "USD"],
    rangeOpen: 1_000,
    rangeClose: 1_400,
    duringThrough: 1_399,
    beforeDays: 90,
    ...overrides,
  });
}

function renderData(overrides: Partial<ChartPairMatrixTimeLensData> = {}): ChartPairMatrixTimeLensData {
  return {
    open: true,
    supported: true,
    pairLabel: "EURUSD",
    currencies: ["EUR", "USD"],
    timeline: { during: [], before: [] },
    rangeLabel: "29 Jun 2026 16:00 · H4",
    rangeOpenTimeSeconds: 1_000,
    rangeBasisLabel: "Hovered candle",
    loadState: "ready",
    displayTimeMode: "utc-offset:0",
    sourceTimeOffsetSeconds: 0,
    beforeDays: 90,
    rangeSelectionArmed: false,
    hasLockedRange: false,
    onBeforeDaysChange: () => {},
    onStartRangeSelection: () => {},
    onToggleOpen: () => {},
    onClose: () => {},
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Pair Matrix candle-range timeline", () => {
  it("normalizes forward and reverse candle drags to the same complete range", () => {
    const candles = [100, 200, 300, 400];
    expect(normalizePairMatrixCandleRange(candles, 105, 395, "H1")).toEqual({ firstOpen: 100, lastOpen: 400, close: 4_000, candleCount: 4 });
    expect(normalizePairMatrixCandleRange(candles, 395, 105, "H1")).toEqual({ firstOpen: 100, lastOpen: 400, close: 4_000, candleCount: 4 });
  });

  it("uses nominal closes for intraday, daily, weekly, and monthly candles", () => {
    expect(getPairMatrixCandleClose(1_000, "H4")).toBe(15_400);
    expect(getPairMatrixCandleClose(1_000, "D1")).toBe(87_400);
    expect(getPairMatrixCandleClose(1_000, "W1")).toBe(605_800);
    const januaryOpen = Date.UTC(2026, 0, 1) / 1_000;
    expect(getPairMatrixCandleClose(januaryOpen, "MN1")).toBe(Date.UTC(2026, 1, 1) / 1_000);
  });

  it("builds visible one-candle and multi-candle bands from candle centers and bar spacing", () => {
    expect(getPairMatrixRangePixelBounds(100, 100, 12, 500)).toEqual({ left: 94, right: 106 });
    expect(getPairMatrixRangePixelBounds(100, 300, 12, 500)).toEqual({ left: 94, right: 306 });
    expect(getPairMatrixRangePixelBounds(2, 498, 12, 500)).toEqual({ left: 0, right: 500 });
    expect(getPairMatrixRangePixelBounds(null, 300, 12, 500)).toBeNull();
  });

  it("places open-time releases in During, excludes the close boundary, and retains every release", () => {
    const result = timeline([
      event({ id: 1, time: 999, title: "CPI y/y" }),
      event({ id: 2, time: 1_000, title: "CPI y/y" }),
      event({ id: 3, time: 1_200, title: "CPI y/y" }),
      event({ id: 4, time: 1_400, title: "CPI y/y" }),
    ]);
    expect(result.during.find((side) => side.currency === "USD")?.entries.map((item) => item.event.id)).toEqual([2, 3]);
    expect(result.before.find((side) => side.currency === "USD")?.entries.map((item) => item.event.id)).toEqual([1]);
  });

  it("caps an unfinished candle at feed time so later scheduled rows stay out", () => {
    const result = timeline([
      event({ id: 1, time: 1_100 }),
      event({ id: 2, time: 1_300 }),
    ], { duringThrough: 1_200 });
    expect(result.during.find((side) => side.currency === "USD")?.entries.map((item) => item.event.id)).toEqual([1]);
  });

  it("classifies unmatched pair releases as Other and excludes unrelated currencies", () => {
    const speech = event({ id: 1, time: 1_100, title: "FOMC Member Speech" });
    const result = timeline([
      speech,
      event({ id: 2, time: 1_120, currency: "JPY", countryCode: "JP", title: "Industrial Production" }),
    ]);
    expect(classifyPairMatrixEvent(speech).id).toBe("other");
    expect(result.during.find((side) => side.currency === "USD")?.entries[0]?.factor.label).toBe("Other releases");
    expect(result.during.flatMap((side) => side.entries).some((item) => item.event.currency === "JPY")).toBe(false);
  });

  it("sorts During chronologically and Before newest-first independently per currency", () => {
    const result = timeline([
      event({ id: 1, currency: "EUR", countryCode: "EU", time: 1_300, title: "HICP y/y" }),
      event({ id: 2, currency: "EUR", countryCode: "EU", time: 1_100, title: "Retail Sales m/m" }),
      event({ id: 3, currency: "USD", time: 1_250, title: "CPI y/y" }),
      event({ id: 4, currency: "USD", time: 1_050, title: "Initial Jobless Claims" }),
      event({ id: 5, currency: "EUR", countryCode: "EU", time: 900, title: "HICP y/y" }),
      event({ id: 6, currency: "EUR", countryCode: "EU", time: 800, title: "Retail Sales m/m" }),
      event({ id: 7, currency: "USD", time: 850, title: "CPI y/y" }),
      event({ id: 8, currency: "USD", time: 950, title: "Initial Jobless Claims" }),
    ]);
    expect(result.during.find((side) => side.currency === "EUR")?.entries.map((item) => item.event.id)).toEqual([2, 1]);
    expect(result.during.find((side) => side.currency === "USD")?.entries.map((item) => item.event.id)).toEqual([4, 3]);
    expect(result.before.find((side) => side.currency === "EUR")?.entries.map((item) => item.event.id)).toEqual([5, 6]);
    expect(result.before.find((side) => side.currency === "USD")?.entries.map((item) => item.event.id)).toEqual([8, 7]);
  });

  it("keeps only the latest normalized exact title inside the bounded Before window", () => {
    const day = 24 * 60 * 60;
    const rangeOpen = 200 * day;
    const result = timeline([
      event({ id: 1, time: rangeOpen - 10 * day, title: "CPI Y/Y" }),
      event({ id: 2, time: rangeOpen - 5 * day, title: "cpi-y/y" }),
      event({ id: 3, time: rangeOpen - 95 * day, title: "ZEW Economic Sentiment Indicator" }),
      event({ id: 4, time: rangeOpen - 20 * day, title: "Core CPI m/m" }),
    ], { rangeOpen, rangeClose: rangeOpen + 4 * 60 * 60, duringThrough: rangeOpen + 4 * 60 * 60 - 1, beforeDays: 90 });
    const ids = result.before.find((side) => side.currency === "USD")?.entries.map((item) => item.event.id);
    expect(ids).toEqual([2, 4]);
    expect(normalizePairMatrixSeriesTitle("CPI: Y/Y")).toBe(normalizePairMatrixSeriesTitle("cpi-y/y"));
  });

  it("normalizes and persists the custom lookback independently", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    expect(normalizePairMatrixBeforeDays("bad")).toBe(90);
    expect(normalizePairMatrixBeforeDays(0)).toBe(1);
    expect(normalizePairMatrixBeforeDays(999)).toBe(400);
    savePairMatrixBeforeDays(123);
    expect(values.get(PAIR_MATRIX_BEFORE_STORAGE_KEY)).toBe("123");
    expect(loadPairMatrixBeforeDays()).toBe(123);
  });

  it("retains raw-first A/F/P/S/M arithmetic", () => {
    const positive = buildPairMatrixSeriesSnapshot(event({ actual: "3.1%", forecast: "3.0%", previous: "3.2%" }));
    const zero = buildPairMatrixSeriesSnapshot(event({ actual: "2.5%", forecast: "2.5%", previous: "2.5%" }));
    const index = buildPairMatrixSeriesSnapshot(event({ title: "CPI Index", actual: "102.87", forecast: "102.80", previous: "102.90" }));
    expect(positive.surprise.label).toBe("+0.1pp");
    expect(positive.momentum.label).toBe("-0.1pp");
    expect(zero.surprise.label).toBe("0pp");
    expect(index.actualLabel).toBe("102.87");
    expect(index.surprise.label).toBe("+0.07");
    expect(index.actualLabel).not.toContain("%");
  });

  it("recognizes configured forex pairs and rejects other instruments", () => {
    expect(getPairMatrixForexCurrencies("EURUSD.a")).toEqual(["EUR", "USD"]);
    expect(getPairMatrixForexCurrencies("XAUUSD")).toBeNull();
    expect(getPairMatrixForexCurrencies("BTCUSD")).toBeNull();
  });

  it("renders independent During and Before timelines, range controls, ages, and no automated judgment", () => {
    const result = timeline([
      event({ id: 1, currency: "EUR", countryCode: "EU", time: 1_120, title: "HICP y/y" }),
      event({ id: 2, currency: "USD", time: 1_180, title: "CPI y/y" }),
      event({ id: 3, currency: "EUR", countryCode: "EU", time: 880, title: "Retail Sales m/m" }),
      event({ id: 4, currency: "USD", time: 940, title: "FOMC Member Speech" }),
    ]);
    const html = renderToStaticMarkup(createElement(ChartPairMatrixTimeLens, { data: renderData({ timeline: result }) }));
    expect(html).toContain("Economic timeline");
    expect(html).toContain("Select range");
    expect(html).toContain("During this candle");
    expect(html).toContain("Known before candle");
    expect(html).toContain("Known before range lookback days");
    expect(html).toContain('data-pair-matrix-timeline-entry="base"');
    expect(html).toContain('data-pair-matrix-timeline-entry="quote"');
    expect(html).toContain("Other releases");
    expect(html).toContain("+2m");
    expect(html).toContain("1m old");
    expect(html).toContain("S +0.1pp");
    expect(html).not.toMatch(/Base stronger|Quote stronger|>Winner<|Evidence Signal|>Shock<|>Reaction<|Pair compare/i);
    expect(ChartPairMatrixTimeLens).toHaveProperty("type");
  });

  it("renders honest empty, unsupported, loading, and failure states", () => {
    const empty = renderToStaticMarkup(createElement(ChartPairMatrixTimeLens, { data: renderData() }));
    const unsupported = renderToStaticMarkup(createElement(ChartPairMatrixTimeLens, { data: renderData({ supported: false, pairLabel: "XAUUSD" }) }));
    const loading = renderToStaticMarkup(createElement(ChartPairMatrixTimeLens, { data: renderData({ loadState: "loading" }) }));
    const error = renderToStaticMarkup(createElement(ChartPairMatrixTimeLens, { data: renderData({ loadState: "error" }) }));
    expect(empty).toContain("No loaded releases during this range");
    expect(empty).toContain("No loaded releases in the prior 90 days");
    expect(unsupported).toContain("currently supports forex pairs only");
    expect(loading).toContain("Loading economic data for this candle range");
    expect(error).toContain("Historical calendar data could not be loaded");
  });
});
