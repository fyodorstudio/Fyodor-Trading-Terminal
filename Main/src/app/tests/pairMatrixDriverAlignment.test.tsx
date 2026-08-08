import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartPairMatrixTimeLens } from "@/app/components/ChartPairMatrixTimeLens";
import { MACRO_FACTOR_DEFINITIONS } from "@/app/lib/macroDrivers";
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
    expect(read.expectedDirectionLabel).toBe("pair down");
    expect(read.actualDirectionLabel).toBe("price down");
    expect(read.pipsLabel).toBe("-20.0 pips");
    expect(read.percentLabel).toBe("-0.18%");
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
    expect(read.expectedDirectionLabel).toBe("pair up");
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

  it("renders the open popover with compact value rows and driver details", () => {
    const factorRows = [
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
          onPreferenceChange: () => {},
          onToggleOpen: () => {},
          onClose: () => {},
        },
      }),
    );

    expect(html).toContain("Driver");
    expect(html).toContain("Compare");
    expect(html).toContain("Pair Matrix settings");
    expect(html).toContain("chart-pair-matrix-summary-box");
    expect(html).toMatch(/\/1 factors/);
    expect(html).toContain("Evidence");
    expect(html).toContain("Latest");
    expect(html).toContain("Next");
    expect(html).not.toContain("USD latest");
    expect(html).not.toContain("USD next");
    expect(html).not.toContain("EUR latest");
    expect(html).not.toContain("EUR next");
    expect(html).toContain("Fed Interest Rate Decision");
    expect(html).toContain("A: 3.75%");
    expect(html).toContain("F: -");
    expect(html).toContain("P: 3.5%");
    expect(html).toContain("A: -");
    expect(html).toContain("F: 3.75%");
    expect(html).toContain("P: 3.75%");
    expect(html).toContain("30 Jul 2026");
    expect(html).toContain("17 Sept 2026");
    expect(html).toContain("-20.0 pips");
    expect(html).toContain("-0.18%");
    expect(html).toContain("chart-pair-matrix-settings-details");
    expect(html).toContain("1/1 factor cells loaded");
    expect(html).toContain("Loaded broker/MT5 rows only");
    expect(html).not.toContain('class="chart-pair-matrix-summary-box " title="1/1 factor cells loaded');
    expect(html).not.toContain('class="chart-pair-matrix-summary-box " title="Loaded broker/MT5 rows only');
    expect(html).toContain(">Read<");
    expect(html).toContain(">Sensitivity<");
    expect(html).toContain(">Sort<");
    expect(html).not.toContain("Density");
    expect(html).not.toContain("04:0004:00");
  });
});
