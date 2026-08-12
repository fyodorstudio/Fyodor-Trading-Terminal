import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartPairMatrixTimeLens } from "@/app/components/ChartPairMatrixTimeLens";
import { MACRO_FACTOR_DEFINITIONS, buildMacroFactorRowsAsOf } from "@/app/lib/macroDrivers";
import {
  DEFAULT_PAIR_MATRIX_PREFERENCES,
  buildPairMatrixComparisonSummary,
  buildPairMatrixViewRows,
  derivePairMatrixAlignment,
} from "@/app/lib/pairMatrixDriverAlignment";
import type { BridgeCandle, CalendarEvent } from "@/app/types";

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: overrides.id ?? 1,
    time: overrides.time ?? 1_000,
    countryCode: overrides.countryCode ?? "US",
    currency: overrides.currency ?? "USD",
    title: overrides.title ?? "Nonfarm Payrolls",
    impact: overrides.impact ?? "high",
    actual: overrides.actual ?? "200",
    forecast: overrides.forecast ?? "180",
    previous: overrides.previous ?? "170",
  };
}

function candles(releaseClose: number, cursorClose: number): BridgeCandle[] {
  return [
    { time: 1_000, open: releaseClose, high: releaseClose, low: releaseClose, close: releaseClose, volume: 1 },
    { time: 1_600, open: releaseClose, high: cursorClose, low: releaseClose, close: cursorClose, volume: 1 },
  ];
}

describe("Pair Matrix Driver Alignment", () => {
  it("aligns supportive quote-currency data with pair downside and shows pips, percent, and surprise", () => {
    const read = derivePairMatrixAlignment({
      event: event({ currency: "USD", title: "Nonfarm Payrolls", actual: "200", forecast: "180" }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.098),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });

    expect(read.status).toBe("aligned");
    expect(read.expectedDirectionLabel).toBe("EURUSD expected down");
    expect(read.actualDirectionLabel).toBe("price down");
    expect(read.pipsLabel).toBe("-20.0 pips");
    expect(read.percentLabel).toBe("-0.18%");
    expect(read.releaseChartTime).toBe(1_000);
    expect(read.cursorChartTime).toBe(1_600);
    expect(read.surpriseLabel).toBe("Actual vs forecast +20");
  });

  it("inverts unemployment-style data where lower is supportive", () => {
    const read = derivePairMatrixAlignment({
      event: event({
        currency: "EUR",
        countryCode: "EU",
        title: "Unemployment Rate",
        actual: "6.2",
        forecast: "6.5",
      }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.102),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });

    expect(read.status).toBe("aligned");
    expect(read.expectedDirectionLabel).toBe("EURUSD expected up");
    expect(read.surpriseLabel).toBe("Actual vs forecast -0.3%");
  });

  it("classifies opposite price follow-through as rejected and small moves as muted", () => {
    const rejected = derivePairMatrixAlignment({
      event: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.3", forecast: "3.0" }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.098),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });
    const muted = derivePairMatrixAlignment({
      event: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.3", forecast: "3.0" }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.1001),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });

    expect(rejected.status).toBe("rejected");
    expect(muted.status).toBe("muted");
  });

  it("lets high surprise sensitivity mute tiny data surprises even when price follows through", () => {
    const normal = derivePairMatrixAlignment({
      event: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.01", forecast: "3.0" }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.102),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });
    const high = derivePairMatrixAlignment({
      event: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.01", forecast: "3.0" }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.102),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "high",
    });

    expect(normal.status).toBe("aligned");
    expect(high.status).toBe("muted");
  });

  it("stays unclear when numeric data or loaded candle windows are missing", () => {
    const noNumeric = derivePairMatrixAlignment({
      event: event({ actual: "", forecast: "" }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.102),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });
    const noWindow = derivePairMatrixAlignment({
      event: event({ currency: "USD" }),
      selectedSymbol: "EURUSD",
      visibleCandles: [],
      cursorChartTime: null,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });

    expect(noNumeric.status).toBe("unclear");
    expect(noWindow.status).toBe("unclear");
  });

  it("labels zero-surprise driver reads without claiming the pair is unmapped", () => {
    const read = derivePairMatrixAlignment({
      event: event({
        currency: "EUR",
        countryCode: "EU",
        title: "ECB Marginal Lending Facility Rate Decision",
        actual: "2.65",
        forecast: "",
        previous: "2.65",
      }),
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.102),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      sensitivity: "normal",
    });

    expect(read.status).toBe("unclear");
    expect(read.reasonCode).toBe("no_directional_surprise");
    expect(read.reasonLabel).toBe("no directional surprise");
    expect(read.reason).not.toContain("mapped");
  });

  it("sorts factor rows by driver strength when configured", () => {
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.5", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "labor")!,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "Unemployment Rate", actual: "6.4", forecast: "6.5" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: MACRO_FACTOR_DEFINITIONS,
      currencies: ["EUR"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.104),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: { ...DEFAULT_PAIR_MATRIX_PREFERENCES, rowSortMode: "driver_strength" },
    });

    expect(rows[0]?.summaryAlignment?.status).toBe("aligned");
    expect(rows[0]?.factor.id).toBe("inflation");
  });

  it("builds transparent base-vs-quote comparison from cursor-anchored factor rows", () => {
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.6", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!,
          currency: "USD",
          latestEvent: event({ currency: "USD", title: "CPI y/y", actual: "3.1", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.103),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });
    const summary = buildPairMatrixComparisonSummary({
      rows,
      currencies: ["EUR", "USD"],
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    expect(rows[0]?.comparison?.state).toBe("base_leads");
    expect(rows[0]?.comparison?.base?.formulaLabel).toContain("Actual vs forecast");
    expect(rows[0]?.comparison?.base?.rawSurpriseLabel).toBe("+0.6%");
    expect(rows[0]?.comparison?.quote?.rawSurpriseLabel).toBe("+0.1%");
    expect(summary?.stateLabel).toBe("Base leads");
    expect(summary?.voteLabel).toBe("1/1 factors");
    expect(summary?.voteBreakdownLabel).toBe("Base 1 / Quote 0");
    expect(summary?.detailLabel).toContain("EUR 1, USD 0");
  });

  it("supports macro-plus-price comparison by exposing the acceptance multiplier", () => {
    const preferences = { ...DEFAULT_PAIR_MATRIX_PREFERENCES, comparisonMode: "macro_price" as const };
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.3", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!,
          currency: "USD",
          latestEvent: event({ currency: "USD", title: "CPI y/y", actual: "3.0", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.103),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences,
    });

    expect(rows[0]?.comparison?.base?.acceptanceLabel).toBe("aligned x1.25");
    expect(rows[0]?.comparison?.base?.formulaLabel).toContain("aligned x1.25");
  });

  it("keeps one-sided missing actual data as a partial comparison read", () => {
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!,
          currency: "EUR",
          latestEvent: event({
            currency: "EUR",
            countryCode: "EU",
            title: "CPI y/y",
            actual: "",
            forecast: "14.6%",
            previous: "10.5%",
          }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!,
          currency: "USD",
          latestEvent: event({
            currency: "USD",
            title: "Core PCE Price Index m/m",
            actual: "3.3%",
            forecast: "3.4%",
            previous: "3.3%",
          }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.094),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });
    const summary = buildPairMatrixComparisonSummary({
      rows,
      currencies: ["EUR", "USD"],
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    expect(rows[0]?.comparison?.state).toBe("partial_read");
    expect(rows[0]?.comparison?.stateLabel).toBe("Partial read");
    expect(rows[0]?.comparison?.base?.scoreLabel).toBe("actual not released");
    expect(rows[0]?.comparison?.quote?.scoreLabel).toBe("-2.9 pts");
    expect(summary?.stateLabel).toBe("Partial read");
    expect(summary?.voteBreakdownLabel).toBe("Base 0 / Quote 0 / Other 1");
  });

  it("labels equal actual-versus-previous policy reads as no surprise instead of split", () => {
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "policy")!,
          currency: "EUR",
          latestEvent: event({
            currency: "EUR",
            countryCode: "EU",
            title: "ECB Marginal Lending Facility Rate Decision",
            actual: "2.65%",
            forecast: "",
            previous: "2.65%",
          }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "policy")!,
          currency: "USD",
          latestEvent: event({
            currency: "USD",
            title: "Fed Interest Rate Decision",
            actual: "3.75%",
            forecast: "",
            previous: "3.75%",
          }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "policy")!],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.101),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });
    const summary = buildPairMatrixComparisonSummary({
      rows,
      currencies: ["EUR", "USD"],
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    expect(rows[0]?.comparison?.state).toBe("no_surprise");
    expect(rows[0]?.comparison?.stateLabel).toBe("No surprise");
    expect(rows[0]?.comparison?.base?.rawSurpriseLabel).toBe("0%");
    expect(rows[0]?.comparison?.quote?.rawSurpriseLabel).toBe("0%");
    expect(rows[0]?.comparison?.base?.scoreLabel).toBe("0.0 pts");
    expect(rows[0]?.comparison?.quote?.scoreLabel).toBe("0.0 pts");
    expect(rows[0]?.comparison?.contextLabel).toBe("USD higher rate +1.10pp");
    expect(rows[0]?.comparison?.contextTitle).toContain("USD is higher by 1.10 percentage points");
    expect(summary?.stateLabel).toBe("No surprise");
    expect(summary?.voteLabel).toBe("1/1 no surprise");
  });

  it("reason-codes old anchors before the loaded calendar window", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "policy")!;
    const factorRows = buildMacroFactorRowsAsOf({
      events: [
        event({
          time: 2_000,
          currency: "EUR",
          countryCode: "EU",
          title: "ECB Deposit Facility Rate Decision",
          actual: "2.5",
          forecast: "",
          previous: "2.5",
        }),
        event({
          time: 2_100,
          currency: "USD",
          title: "Fed Interest Rate Decision",
          actual: "4.5",
          forecast: "",
          previous: "4.5",
        }),
      ],
      currencies: ["EUR", "USD"],
      anchorTimeSeconds: 1_000,
    });
    const rows = buildPairMatrixViewRows({
      factorRows,
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.101),
      cursorChartTime: 1_000,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });
    const summary = buildPairMatrixComparisonSummary({
      rows,
      currencies: ["EUR", "USD"],
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    expect(rows[0]?.cells[0]?.latestReasonCode).toBe("outside_loaded_calendar_range");
    expect(rows[0]?.cells[1]?.latestReasonLabel).toBe("outside loaded calendar range");
    expect(rows[0]?.summaryAlignment?.reasonLabel).toBe("outside loaded calendar range");
    expect(rows[0]?.comparison?.base?.scoreLabel).toBe("outside loaded calendar range");
    expect(rows[0]?.comparison?.quote?.scoreLabel).toBe("outside loaded calendar range");
    expect(summary?.stateLabel).toBe("Unclear");
    expect(summary?.voteBreakdownLabel).toBe("Base 0 / Quote 0 / Other 1");
    expect(summary?.otherBreakdownLabel).toBe("outside loaded calendar range 2");
  });

  it("distinguishes missing actual, non-numeric actual, and missing comparison basis", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "inflation")!;
    const baseRows = [
      {
        factor,
        currency: "EUR",
        latestEvent: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "", forecast: "3.0", previous: "2.9" }),
        nextEvent: null,
        coverageLabel: "Latest only",
        summary: "",
      },
      {
        factor,
        currency: "USD",
        latestEvent: event({ currency: "USD", title: "CPI y/y", actual: "TBD", forecast: "3.0", previous: "2.9" }),
        nextEvent: null,
        coverageLabel: "Latest only",
        summary: "",
      },
    ];
    const basisRows = [
      {
        factor,
        currency: "EUR",
        latestEvent: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.1", forecast: "", previous: "" }),
        nextEvent: null,
        coverageLabel: "Latest only",
        summary: "",
      },
      {
        factor,
        currency: "USD",
        latestEvent: event({ currency: "USD", title: "CPI y/y", actual: "3.2", forecast: "3.0", previous: "" }),
        nextEvent: null,
        coverageLabel: "Latest only",
        summary: "",
      },
    ];
    const missingActualRows = buildPairMatrixViewRows({
      factorRows: baseRows,
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.101),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });
    const missingBasisRows = buildPairMatrixViewRows({
      factorRows: basisRows,
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.101),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    expect(missingActualRows[0]?.comparison?.base?.reasonLabel).toBe("actual not released");
    expect(missingActualRows[0]?.comparison?.quote?.reasonLabel).toBe("actual not numeric");
    expect(missingBasisRows[0]?.comparison?.base?.reasonLabel).toBe("no forecast/previous basis");
    expect(missingBasisRows[0]?.comparison?.quote?.reasonLabel).toBe("loaded");
  });

  it("renders same-time release bundles as visible limitations", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "pmi")!;
    const factorRows = buildMacroFactorRowsAsOf({
      events: [
        event({ id: 10, time: 1_000, currency: "EUR", countryCode: "EU", title: "S&P Global Manufacturing PMI", actual: "49", forecast: "48", previous: "47" }),
        event({ id: 11, time: 1_000, currency: "EUR", countryCode: "EU", title: "S&P Global Services PMI", actual: "53", forecast: "50", previous: "49" }),
        event({ id: 12, time: 1_000, currency: "USD", title: "ISM Manufacturing PMI", actual: "52", forecast: "51", previous: "50" }),
      ],
      currencies: ["EUR", "USD"],
      anchorTimeSeconds: 1_600,
    });
    const rows = buildPairMatrixViewRows({
      factorRows,
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.102),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    const html = renderToStaticMarkup(
      createElement(ChartPairMatrixTimeLens, {
        data: {
          open: true,
          pairLabel: "EURUSD",
          currencies: ["EUR", "USD"],
          rows,
          comparisonSummary: buildPairMatrixComparisonSummary({
            rows,
            currencies: ["EUR", "USD"],
            preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          }),
          preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          anchorLabel: "cursor",
          anchorBasisLabel: "cursor time",
          coverageLabel: "2/2 factor cells loaded",
          displayTimeMode: "server",
          sourceTimeOffsetSeconds: 0,
          calendarDiagnostics: {
            lookbackLabel: "Pair Matrix lookback: 400d current",
            loadStateLabel: "Using current app feed",
            loadedRangeLabel: "Loaded calendar: loaded",
            anchorStatusLabel: "Anchor inside loaded calendar range",
            canLoadOlder: false,
          },
          onPreferenceChange: () => {},
          onLoadOlderCalendarContext: () => {},
          onToggleOpen: () => {},
          onClose: () => {},
        },
      }),
    );

    expect(rows[0]?.cells[0]?.latestBundleCount).toBe(2);
    expect(rows[0]?.cells[0]?.latestEvent?.title).toBe("S&P Global Services PMI");
    expect(rows[0]?.comparison?.contextLabel).toContain("above 50");
    expect(html).toContain("EUR PMI +1");
    expect(html).toContain("S&amp;P Global Manufacturing PMI");
    expect(html).toContain("S&amp;P Global Services PMI");
    expect(html).not.toContain("bundle x2</em>");
  });

  it("renders configurable trade-bias headline wording", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "inflation")!;
    const preferences = { ...DEFAULT_PAIR_MATRIX_PREFERENCES, signalWordingMode: "trade_bias" as const };
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.6", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor,
          currency: "USD",
          latestEvent: event({ currency: "USD", title: "CPI y/y", actual: "3.0", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.103),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences,
    });
    const html = renderToStaticMarkup(
      createElement(ChartPairMatrixTimeLens, {
        data: {
          open: true,
          pairLabel: "EURUSD",
          currencies: ["EUR", "USD"],
          rows,
          comparisonSummary: buildPairMatrixComparisonSummary({ rows, currencies: ["EUR", "USD"], preferences }),
          preferences,
          anchorLabel: "30 Jul 2026 05:00",
          anchorBasisLabel: "cursor time",
          coverageLabel: "1/1 factor cells loaded",
          displayTimeMode: "server",
          sourceTimeOffsetSeconds: 0,
          calendarDiagnostics: {
            lookbackLabel: "Pair Matrix lookback: 400d current",
            loadStateLabel: "Using current app feed",
            loadedRangeLabel: "Loaded calendar: loaded",
            anchorStatusLabel: "Anchor inside loaded calendar range",
            canLoadOlder: false,
          },
          onPreferenceChange: () => {},
          onLoadOlderCalendarContext: () => {},
          onToggleOpen: () => {},
          onClose: () => {},
        },
      }),
    );

    expect(html).toContain("Long bias - price accepted");
    expect(html).toContain(">Trade bias<");
  });

  it("renders the open popover with compact value rows and driver details", () => {
    const factorRows = [
      {
        factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "policy")!,
        currency: "EUR",
        latestEvent: event({
          time: Date.UTC(2026, 6, 23, 22, 15, 0) / 1000,
          currency: "EUR",
          countryCode: "EU",
          title: "ECB Marginal Lending Facility Rate Decision",
          actual: "2.65",
          forecast: "",
          previous: "2.65",
        }),
        nextEvent: null,
        coverageLabel: "Latest only",
        summary: "",
      },
      {
        factor: MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "policy")!,
        currency: "USD",
        latestEvent: event({
          time: Date.UTC(2026, 6, 30, 4, 0, 0) / 1000,
          currency: "USD",
          title: "Fed Interest Rate Decision",
          actual: "3.75",
          forecast: "",
          previous: "3.5",
        }),
        nextEvent: event({
          time: Date.UTC(2026, 8, 17, 4, 0, 0) / 1000,
          currency: "USD",
          title: "Fed Interest Rate Decision",
          actual: "",
          forecast: "3.75",
          previous: "3.75",
        }),
        coverageLabel: "Latest only",
        summary: "",
      },
    ];
    const rows = buildPairMatrixViewRows({
      factorRows,
      factors: [factorRows[0].factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: [
        { time: Date.UTC(2026, 6, 30, 4, 0, 0) / 1000, open: 1.1, high: 1.1, low: 1.1, close: 1.1, volume: 1 },
        { time: Date.UTC(2026, 6, 30, 5, 0, 0) / 1000, open: 1.1, high: 1.101, low: 1.098, close: 1.098, volume: 1 },
      ],
      cursorChartTime: Date.UTC(2026, 6, 30, 5, 0, 0) / 1000,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    const html = renderToStaticMarkup(
      createElement(ChartPairMatrixTimeLens, {
        data: {
          open: true,
          pairLabel: "EURUSD",
          currencies: ["EUR", "USD"],
          rows,
          comparisonSummary: buildPairMatrixComparisonSummary({
            rows,
            currencies: ["EUR", "USD"],
            preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          }),
          preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          anchorLabel: "30 Jul 2026 05:00",
          anchorBasisLabel: "cursor time",
          coverageLabel: "1/1 factor cells loaded",
          displayTimeMode: "server",
          sourceTimeOffsetSeconds: 0,
          calendarDiagnostics: {
            lookbackLabel: "Pair Matrix lookback: 400d current",
            loadStateLabel: "Using current app feed",
            loadedRangeLabel: "Loaded calendar: 23 Jul 2026 22:15 -> 17 Sept 2026 04:00",
            anchorStatusLabel: "Anchor before loaded calendar (23 Jul 2026 22:15)",
            canLoadOlder: true,
          },
          onPreferenceChange: () => {},
          onLoadOlderCalendarContext: () => {},
          onToggleOpen: () => {},
          onClose: () => {},
        },
      }),
    );

    expect(html).toContain("EUR read");
    expect(html).toContain("USD read");
    expect(html).toContain("Winner");
    expect(html).toContain("Reaction");
    expect(html).not.toContain(">Compare<");
    expect(html).not.toContain(">Driver<");
    expect(html).toContain("Pair Matrix settings");
    expect(html).toContain("chart-pair-matrix-summary-box");
    expect(html).toContain("USD higher rate +1.10pp");
    expect(html).toContain("EURUSD down bias - price accepted");
    expect(html).toContain("Bias + reaction");
    expect(html).toContain("Macro Vote: 0/1/0");
    expect(html).toContain("Base / Quote / Outlier");
    expect(html).toContain("is-state is-vote is-quote_leads");
    expect(html).toContain("chart-pair-matrix-signal-winner is-quote_leads");
    expect(html).not.toContain("chart-pair-matrix-counter");
    expect(html).not.toContain(">Quote leads<");
    expect(html).not.toContain(">Base leads<");
    expect(html).not.toContain(">No surprise<");
    expect(html).not.toContain(">Partial read<");
    expect(html).toContain("Driver Read: 1/0/0");
    expect(html).toContain("Green / Red / Outlier");
    expect(html).not.toContain("Base 0 / Quote 1 /");
    expect(html).not.toContain("Green 1 / Red 0");
    expect(html).not.toContain("Other 0");
    expect(html).toContain("Move size");
    expect(html).toContain("Range");
    expect(html).not.toContain(">Latest<");
    expect(html).not.toContain(">Next<");
    expect(html).not.toContain("USD latest");
    expect(html).not.toContain("USD next");
    expect(html).not.toContain("EUR latest");
    expect(html).not.toContain("EUR next");
    expect(html).toContain("Fed Interest Rate Decision");
    expect(html).toContain("USD Rates");
    expect(html).toContain("chart-pair-matrix-signal-values");
    expect(html).toContain("<b>A 3.75%</b><b>P 3.5%</b><b>Surp +0.25%</b>");
    expect(html).toContain("A 3.75%");
    expect(html).toContain("F -");
    expect(html).toContain("P 3.5%");
    expect(html).toContain("F 3.75%");
    expect(html).toContain("30 Jul 2026");
    expect(html).toContain("17 Sept 2026");
    expect(html).toContain(">30 Jul 04:00<");
    expect(html).not.toContain(">30 Jul 2026 04:00<");
    expect(html).toContain("-20.0 pips");
    expect(html).toContain("-0.18%");
    expect(html).toContain("Range 30 Jul 2026 04:00 -&gt; 30 Jul 2026 05:00");
    expect(html).toContain("<em>30 Jul 04:00 -&gt; 30 Jul 05:00</em>");
    expect(html).not.toContain("<em>30 Jul 2026 04:00 -&gt; 30 Jul 2026 05:00</em>");
    expect(html).toContain("Expected down / price down");
    expect(html).toContain("EURUSD expected down");
    expect(html).not.toContain("<strong>Aligned</strong>");
    expect(html).not.toContain("<strong>Rejected</strong>");
    expect(html).not.toContain("<strong>Unclear</strong>");
    expect(html).toContain("chart-pair-matrix-settings-details");
    expect(html).toContain("Evidence Signal settings");
    expect(html).toContain("Evidence Signal combines macro vote");
    expect(html).toContain("Evidence Signal color guide");
    expect(html).toContain("Green: price accepted the read");
    expect(html).toContain("Red: price rejected the read");
    expect(html).toContain("Blue: base side stronger");
    expect(html).toContain("Purple: quote side stronger");
    expect(html).toContain("1/1 factor cells loaded");
    expect(html).toContain("Loaded broker/MT5 rows only");
    expect(html).toContain("Pair Matrix lookback: 400d current");
    expect(html).toContain("Using current app feed");
    expect(html).toContain("Loaded calendar: 23 Jul 2026 22:15 -&gt; 17 Sept 2026 04:00");
    expect(html).toContain("Anchor before loaded calendar");
    expect(html).toContain("Load 2y calendar context");
    expect(html).toContain(">Layout<");
    expect(html).toContain(">Signal<");
    expect(html).toContain(">Wording<");
    expect(html).toContain(">Bundles<");
    expect(html).toContain(">Lookback<");
    expect(html).toContain("Choose whether each factor shows the strongest driver read");
    expect(html).toContain("Controls how much data surprise and price movement");
    expect(html).toContain("Choose normal factor order");
    expect(html).not.toContain('class="chart-pair-matrix-summary-box " title="1/1 factor cells loaded');
    expect(html).not.toContain('class="chart-pair-matrix-summary-box " title="Loaded broker/MT5 rows only');
    expect(html).toContain(">Read<");
    expect(html).toContain(">Sensitivity<");
    expect(html).toContain(">Sort<");
    expect(html).not.toContain("Density");
    expect(html).not.toContain("04:0004:00");
  });
});
