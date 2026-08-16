import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartPairMatrixTimeLens, PairMatrixTimelineEntry, type ChartPairMatrixTimeLensData } from "@/app/components/ChartPairMatrixTimeLens";
import { PairMatrixScoringGuideDialog, handlePairMatrixGuideEscape } from "@/app/components/ChartPairMatrixScoringGuide";
import {
  buildPairMatrixMomentumSnapshot,
  groupPairMatrixReleaseRailByCandle,
  scorePairMatrixSeries,
} from "@/app/lib/pairMatrixMomentum";
import {
  findPairMatrixMomentumRule,
  PAIR_MATRIX_MOMENTUM_REGISTRY,
  PAIR_MATRIX_MOMENTUM_SOURCE_REFERENCES,
} from "@/app/lib/pairMatrixMomentumRegistry";
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
import {
  buildPairMatrixTimelineGroups,
  getPairMatrixTimelineExpansionKey,
  isPairMatrixTimelineGroupExpandable,
  togglePairMatrixTimelineExpansion,
} from "@/app/lib/pairMatrixTimelineGrouping";
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
  const currencies = overrides.currencies ?? ["EUR", "USD"];
  const timelineValue = overrides.timeline ?? { during: [], before: [] };
  return {
    open: true,
    supported: true,
    pairLabel: "EURUSD",
    currencies,
    timeline: timelineValue,
    momentum: overrides.momentum ?? buildPairMatrixMomentumSnapshot(timelineValue, currencies),
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
    onReturnToCursor: () => {},
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

  it("classifies GDP as activity and PPI as inflation while keeping unmatched pair releases in Other", () => {
    const speech = event({ id: 1, time: 1_100, title: "FOMC Member Speech" });
    const result = timeline([
      speech,
      event({ id: 2, time: 1_120, currency: "JPY", countryCode: "JP", title: "Industrial Production" }),
    ]);
    expect(classifyPairMatrixEvent(event({ title: "GDP y/y" })).id).toBe("pmi");
    expect(classifyPairMatrixEvent(event({ title: "Gross Domestic Product q/q" })).id).toBe("pmi");
    expect(classifyPairMatrixEvent(event({ title: "PPI y/y" })).id).toBe("inflation");
    expect(classifyPairMatrixEvent(event({ title: "Producer Price Index m/m" })).id).toBe("inflation");
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

  it("scores equal-weight Surprise and Momentum with agreement, inversion, equality, and missing inputs", () => {
    const score = (overrides: Partial<CalendarEvent>) => scorePairMatrixSeries(buildPairMatrixSeriesSnapshot(event(overrides)));
    expect(score({ title: "GDP q/q", actual: "2.0", forecast: "1.5", previous: "1.0" })?.score).toBe(3);
    const conflict = score({ title: "GDP q/q", actual: "1.5", forecast: "1.0", previous: "2.0" });
    expect(conflict?.score).toBe(0);
    expect(conflict?.audit).toContain("better than forecast (+1); weakening from previous (-1)");
    expect(score({ title: "GDP q/q", actual: "2.0", forecast: "", previous: "1.0" })?.score).toBe(1);
    expect(score({ title: "GDP q/q", actual: "1.0", forecast: "1.5", previous: "2.0" })?.score).toBe(-3);
    expect(score({ title: "GDP q/q", actual: "2.0", forecast: "2.0", previous: "2.0" })?.score).toBe(0);
    expect(score({ title: "Unemployment Rate", actual: "4.0%", forecast: "4.2%", previous: "4.3%" })?.score).toBe(3);
    expect(score({ title: "GDP q/q", actual: "bad", forecast: "1.0", previous: "2.0" })?.score).toBeNull();
    expect(score({ title: "FOMC Statement", actual: "", forecast: "", previous: "" })).toBeNull();
  });

  it("scores each exact series against only its own baselines regardless of decimal scale", () => {
    const small = scorePairMatrixSeries(buildPairMatrixSeriesSnapshot(event({ title: "GDP q/q", actual: "0.6", forecast: "0.5", previous: "0.4" })));
    const large = scorePairMatrixSeries(buildPairMatrixSeriesSnapshot(event({ title: "GDP y/y", actual: "3121500", forecast: "3000000", previous: "2900000" })));
    expect(small?.score).toBe(3);
    expect(large?.score).toBe(3);
  });

  it("caps related release groups and lets every economy factor cast only one currency vote", () => {
    const result = timeline([
      event({ id: 20, time: 1_010, title: "GDP q/q", actual: "2.0", forecast: "1.5", previous: "1.0" }),
      event({ id: 21, time: 1_020, title: "GDP y/y", actual: "3.0", forecast: "2.5", previous: "2.0" }),
      event({ id: 22, time: 1_030, title: "Nonfarm Payrolls", actual: "100K", forecast: "200K", previous: "210K" }),
      event({ id: 23, time: 1_040, title: "Employment Change", actual: "10K", forecast: "20K", previous: "30K" }),
      event({ id: 24, time: 1_050, title: "Retail Sales m/m", actual: "1.0%", forecast: "0.5%", previous: "0.2%" }),
    ]);
    const momentum = buildPairMatrixMomentumSnapshot(result, ["EUR", "USD"]);
    const usd = momentum.during.find((read) => read.currency === "USD")!;
    const activity = usd.economy.factors.find((factor) => factor.factor === "activity")!;
    expect(activity.groups.find((group) => group.id === "gdp")?.score).toBe(3);
    expect(usd.economy.upCount).toBe(2);
    expect(usd.economy.downCount).toBe(1);
    expect(usd.economy.netVotes).toBe(1);
    expect(usd.economy.state).toBe("improving");
  });

  it("keeps New Evidence and Background separate and derives inflation and latest policy action independently", () => {
    const result = timeline([
      event({ id: 30, time: 1_050, title: "Retail Sales m/m", actual: "1.0%", forecast: "0.5%", previous: "0.2%" }),
      event({ id: 31, time: 1_060, title: "CPI y/y", actual: "3.2%", forecast: "3.0%", previous: "2.9%" }),
      event({ id: 32, time: 1_100, title: "Fed Interest Rate Decision", actual: "3.75%", forecast: "", previous: "3.75%" }),
      event({ id: 33, time: 1_200, title: "Fed Interest Rate Decision", actual: "4.00%", forecast: "", previous: "3.75%" }),
      event({ id: 34, time: 900, title: "Retail Sales m/m", actual: "-0.5%", forecast: "0.1%", previous: "0.2%" }),
      event({ id: 35, time: 920, title: "CPI y/y", actual: "2.8%", forecast: "3.0%", previous: "3.1%" }),
      event({ id: 36, time: 940, title: "Fed Interest Rate Decision", actual: "3.75%", forecast: "", previous: "3.75%" }),
    ]);
    const momentum = buildPairMatrixMomentumSnapshot(result, ["EUR", "USD"]);
    const during = momentum.during.find((read) => read.currency === "USD")!;
    const background = momentum.background.find((read) => read.currency === "USD")!;
    expect(during.economy.state).toBe("improving");
    expect(background.economy.state).toBe("weakening");
    expect(during.inflation.state).toBe("heating");
    expect(background.inflation.state).toBe("cooling");
    expect(during.policy.state).toBe("tightening");
    expect(during.policy.priorEvents).toHaveLength(1);
    expect(background.policy.state).toBe("holding");
  });

  it.each([
    ["USD", "Fed Interest Rate Decision"],
    ["EUR", "ECB Deposit Facility Rate Decision"],
    ["GBP", "BoE Interest Rate Decision"],
    ["JPY", "BoJ Interest Rate Decision"],
    ["AUD", "RBA Interest Rate Decision"],
    ["CAD", "BoC Interest Rate Decision"],
    ["NZD", "Official Cash Rate"],
    ["CHF", "SNB Policy Rate"],
  ])("recognizes %s canonical policy title", (currency, title) => {
    const rule = findPairMatrixMomentumRule(event({ currency, title }));
    expect(rule?.canonicalPolicy).toBe(true);
    expect(rule?.currencies).toContain(currency);
  });

  it("ignores broker impact in scoring and leaves unmatched Other releases unscored", () => {
    const low = scorePairMatrixSeries(buildPairMatrixSeriesSnapshot(event({ title: "GDP q/q", impact: "low" })));
    const high = scorePairMatrixSeries(buildPairMatrixSeriesSnapshot(event({ title: "GDP q/q", impact: "high" })));
    expect(low?.score).toBe(high?.score);
    expect(scorePairMatrixSeries(buildPairMatrixSeriesSnapshot(event({ title: "EIA Crude Oil Imports Change" })))).toBeNull();
    expect(scorePairMatrixSeries(buildPairMatrixSeriesSnapshot(event({ title: "GDP Price Index" })))).toBeNull();
  });

  it("keeps every exclusive registry rule auditable through a rationale and source reference", () => {
    for (const rule of PAIR_MATRIX_MOMENTUM_REGISTRY) {
      expect(rule.rationale.length).toBeGreaterThan(20);
      expect(PAIR_MATRIX_MOMENTUM_SOURCE_REFERENCES[rule.sourceKey]).toMatch(/^https:\/\//);
    }
  });

  it("places every scored During release on a candle rail and clusters contributors within the same candle", () => {
    const result = buildPairMatrixTimeline({
      events: [
        event({ id: 40, time: 1_010, title: "GDP q/q" }),
        event({ id: 41, time: 1_020, title: "CPI y/y" }),
        event({ id: 42, time: 15_410, title: "Retail Sales m/m" }),
        event({ id: 43, time: 1_030, title: "FOMC Statement", actual: "", forecast: "", previous: "" }),
      ],
      currencies: ["USD"],
      rangeOpen: 1_000,
      rangeClose: 29_800,
      duringThrough: 29_799,
      beforeDays: 90,
    });
    const groups = groupPairMatrixReleaseRailByCandle({
      momentum: buildPairMatrixMomentumSnapshot(result, ["USD"]),
      candleTimes: [1_000, 15_400],
      timeframe: "H4",
      sourceTimeOffsetSeconds: 0,
    });
    expect(groups.map((group) => [group.candleOpen, group.count])).toEqual([[1_000, 2], [15_400, 1]]);
  });

  it("groups entries into the fixed non-empty factor order while preserving child order", () => {
    const entries = [
      event({ id: 50, time: 1_040, title: "EIA Crude Oil Stocks Change" }),
      event({ id: 51, time: 1_010, title: "GDP q/q" }),
      event({ id: 52, time: 1_020, title: "CPI y/y" }),
      event({ id: 53, time: 1_030, title: "GDP y/y" }),
      event({ id: 54, time: 1_050, title: "Fed Interest Rate Decision" }),
    ].map(buildPairMatrixSeriesSnapshot);
    const groups = buildPairMatrixTimelineGroups(entries, "factor");
    expect(groups.map((group) => group.id)).toEqual(["policy", "inflation", "pmi", "other"]);
    expect(groups.find((group) => group.id === "pmi")?.entries.map((entry) => entry.event.title)).toEqual(["GDP q/q", "GDP y/y"]);
    expect(groups.some((group) => group.id === "labor")).toBe(false);
  });

  it("groups only exact same-time releases and leaves single release packages identifiable", () => {
    const entries = [
      event({ id: 60, currency: "EUR", time: 1_010, title: "GDP y/y" }),
      event({ id: 61, currency: "EUR", time: 1_010, title: "GDP q/q" }),
      event({ id: 62, currency: "EUR", time: 1_020, title: "CPI y/y" }),
      event({ id: 63, currency: "USD", time: 1_010, title: "GDP q/q" }),
    ].map(buildPairMatrixSeriesSnapshot);
    const groups = buildPairMatrixTimelineGroups(entries, "release_time");
    expect(groups.map((group) => [group.id, group.entries.length])).toEqual([["EUR:1010", 2], ["EUR:1020", 1], ["USD:1010", 1]]);
    expect(groups[0]?.entries.map((entry) => entry.event.title)).toEqual(["GDP q/q", "GDP y/y"]);
    expect(isPairMatrixTimelineGroupExpandable(groups[0])).toBe(true);
    expect(isPairMatrixTimelineGroupExpandable(groups[1])).toBe(false);
  });

  it("uses fully independent expansion keys and preserves opened keys across data/view changes", () => {
    const eurDuring = getPairMatrixTimelineExpansionKey({ section: "during", currency: "EUR", mode: "factor", groupId: "inflation" });
    const usdDuring = getPairMatrixTimelineExpansionKey({ section: "during", currency: "USD", mode: "factor", groupId: "inflation" });
    const eurBefore = getPairMatrixTimelineExpansionKey({ section: "before", currency: "EUR", mode: "factor", groupId: "inflation" });
    const eurTime = getPairMatrixTimelineExpansionKey({ section: "during", currency: "EUR", mode: "release_time", groupId: "EUR:1010" });
    let expanded = togglePairMatrixTimelineExpansion(new Set(), eurDuring);
    expanded = togglePairMatrixTimelineExpansion(expanded, eurTime);
    expect(new Set([eurDuring, usdDuring, eurBefore, eurTime]).size).toBe(4);
    expect(expanded.has(eurDuring)).toBe(true);
    expect(expanded.has(eurTime)).toBe(true);
    expect(togglePairMatrixTimelineExpansion(expanded, eurDuring).has(eurDuring)).toBe(false);
  });

  it("recognizes configured forex pairs and rejects other instruments", () => {
    expect(getPairMatrixForexCurrencies("EURUSD.a")).toEqual(["EUR", "USD"]);
    expect(getPairMatrixForexCurrencies("XAUUSD")).toBeNull();
    expect(getPairMatrixForexCurrencies("BTCUSD")).toBeNull();
  });

  it("renders compact auditable momentum summaries above independent raw timelines", () => {
    const result = timeline([
      event({ id: 1, currency: "EUR", countryCode: "EU", time: 1_120, title: "Jobseekers Total", actual: "3121500", forecast: "3081.5", previous: "3115.6" }),
      event({ id: 2, currency: "USD", time: 1_180, title: "Goods Trade Balance", actual: "-101.461", forecast: "-94.697", previous: "-105.755" }),
      event({ id: 3, currency: "EUR", countryCode: "EU", time: 880, title: "Retail Sales m/m" }),
      event({ id: 4, currency: "USD", time: 940, title: "FOMC Member Speech" }),
    ]);
    const html = renderToStaticMarkup(createElement(ChartPairMatrixTimeLens, { data: renderData({ timeline: result }) }));
    const lockedHtml = renderToStaticMarkup(createElement(ChartPairMatrixTimeLens, { data: renderData({ timeline: result, hasLockedRange: true, rangeBasisLabel: "Locked range" }) }));
    expect(html).toContain("Economic timeline");
    expect(html).toContain("Select range");
    expect(html).toContain("> Cursor</button>");
    expect(html).toContain("return Pair Matrix to candle hover");
    expect(html).toContain("During this candle");
    expect(html).toContain("Known before candle");
    expect(html).toContain("Known before range lookback days");
    expect(html).toContain("Group by");
    expect(html).toContain('aria-label="Group Pair Matrix timeline by"');
    expect(html).toContain('<option value="factor" selected="">Factor</option>');
    expect(html).toContain('<option value="release_time">Release time</option>');
    expect(html).toContain('data-pair-matrix-group-parent="factor"');
    expect(html).toContain('data-pair-matrix-group-side="base"');
    expect(html).toContain('data-pair-matrix-group-side="quote"');
    expect(html).not.toContain('data-pair-matrix-timeline-entry="base"');
    expect(html).toContain("Other releases");
    expect(html).toContain("During-candle economy: EUR Weakening");
    expect(lockedHtml).toContain("During-range economy: EUR Weakening");
    expect(html).toContain("USD Net 0");
    expect(html).toContain(">Economy</span>");
    expect(html).toContain(">Inflation</span>");
    expect(html).toContain(">Policy</span>");
    expect(html).toContain(">During</span>");
    expect(html).toContain(">Known before</span>");
    expect(html).toContain("Economy scoring help");
    expect(html).toContain("Inflation scoring help");
    expect(html).toContain("Policy scoring help");
    expect(html).toContain("Economy arrows count factor votes");
    expect(html).toContain("Inflation arrows count capped inflation groups");
    expect(html).toContain("latest canonical rate decision Actual with its Previous value");
    expect(html).toContain('data-pair-matrix-shared-help="hidden"');
    expect(html).toContain('data-pair-matrix-help-trigger=""');
    expect(html).not.toContain("group-hover:block");
    expect(html).toContain("How scoring works");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toMatch(/NEW ECON|BG ECON|NEW INFL|BG INFL|NEW RATE|BG RATE/);
    expect(html).toContain("text-[18px]");
    expect(html).toContain("h-5 w-8");
    expect(html).toContain("text-[13px]");
    expect(html).toContain("WEAKENING");
    expect(html).toContain("IMPROVING");
    expect(html).toContain("agreement bonus -1; event score -3");
    expect(html).toContain("overflow-x-hidden overflow-y-auto");
    expect(html).not.toContain("min-w-[1920px]");
    expect(html).not.toMatch(/Base stronger|Quote stronger|>Winner<|Evidence Signal|>Shock<|>Reaction<|Pair compare|caused price|buy|sell/i);
    expect(ChartPairMatrixTimeLens).toHaveProperty("type");
  });

  it("keeps the complete mirrored raw-row contract for expanded group children", () => {
    const series = buildPairMatrixSeriesSnapshot(event({ currency: "EUR", countryCode: "EU", time: 1_120, title: "Jobseekers Total", actual: "3121500", forecast: "3081.5", previous: "3115.6" }));
    const data = renderData();
    const base = renderToStaticMarkup(createElement(PairMatrixTimelineEntry, { series, side: "base", mode: "during", data, hideFactor: true }));
    const quote = renderToStaticMarkup(createElement(PairMatrixTimelineEntry, { series, side: "quote", mode: "during", data }));
    expect(base).toContain('data-pair-matrix-timeline-entry="base"');
    expect(quote).toContain('data-pair-matrix-timeline-entry="quote"');
    expect(base).toContain("A 3121500");
    expect(base).toContain("S +3118418.5");
    expect(base).toContain("M +3118384.4");
    expect(base).toContain("+2m");
    expect(base).toContain("grid-cols-[88px_minmax(80px,1fr)_64px_64px_64px_72px_72px_168px]");
    expect(quote).toContain("grid-cols-[168px_64px_64px_64px_72px_72px_minmax(80px,1fr)_88px]");
    expect(base).toContain("block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap");
  });

  it("renders the full-screen scoring guide, fixed examples, workflow, registry, and limitations", () => {
    const html = renderToStaticMarkup(createElement(PairMatrixScoringGuideDialog, { onClose: () => {} }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("fixed inset-0 z-[1600]");
    expect(html).toContain("How scoring works");
    expect(html).toContain("Start with when the evidence was known");
    expect(html).toContain("Read three separate outputs");
    expect(html).toContain("Read the raw event first");
    expect(html).toContain("Surprise +1");
    expect(html).toContain("Momentum +1");
    expect(html).toContain("Agreement +1");
    expect(html).toContain("Event +3");
    expect(html).toContain("Conflicting evidence = 0");
    expect(html).toContain("Lower-is-better is inverted");
    expect(html).toContain("2↑ 1↓ = Improving");
    expect(html).toContain("Use Pair Matrix on the chart");
    expect(html).toContain("Return to Cursor");
    expect(html).toContain("Group rows by Factor or Release time");
    expect(html).toContain("What gets scored?");
    expect(html).toContain("Exclusive registry · collapsed by default");
    expect(html).toContain("GDP");
    expect(html).toContain("Official reference");
    expect(html).toContain("Unregistered releases remain visible but unscored");
    expect(html).toContain("does not prove why price moved and is not a trade signal");
    expect(html).not.toMatch(/>Winner<|Base stronger|Quote stronger|buy|sell/i);
  });

  it("consumes tutorial Escape and closes only the guide", () => {
    const onClose = vi.fn();
    const event = { key: "Escape", preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
    expect(handlePairMatrixGuideEscape(event, onClose)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(handlePairMatrixGuideEscape({ ...event, key: "Enter" }, onClose)).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
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
