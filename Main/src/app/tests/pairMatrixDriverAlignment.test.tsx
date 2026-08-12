// @ts-expect-error Vitest runs this in Node, but the app tsconfig intentionally omits Node typings.
import { readFileSync } from "node:fs";
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
  it("keeps Pair Matrix CSS grid overrides aligned to the six rendered row cells", () => {
    const chartsCss = readFileSync("src/styles/15-charts.css", "utf8");
    const gridDeclarations = [...chartsCss.matchAll(/--pair-matrix-columns:\s*([^;]+);/g)].map((match) => match[1] ?? "");
    const bottomPaneMatch = chartsCss.match(/\.chart-pair-matrix-lens\.is-bottom-pane \.chart-pair-matrix-scroll\s*\{\s*--pair-matrix-columns:\s*([^;]+);/);

    expect(gridDeclarations.length).toBeGreaterThanOrEqual(3);
    expect(bottomPaneMatch?.[1]?.match(/minmax\(/g)?.length).toBe(6);
    for (const declaration of gridDeclarations) {
      expect(declaration.match(/minmax\(/g)?.length).toBe(6);
    }
    expect(chartsCss).not.toContain(".chart-pair-matrix-lens.is-bottom-pane .chart-pair-matrix-signal-winner");
  });

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
    expect(rows[0]?.comparison?.base?.macroHealth.state).toBe("neutral");
    expect(rows[0]?.comparison?.quote?.macroHealth.state).toBe("neutral");
    expect(rows[0]?.comparison?.base?.macroHealth.title).toContain("Neutral");
    expect(rows[0]?.comparison?.base?.scoreLabel).toBe("0.0 pts");
    expect(rows[0]?.comparison?.quote?.scoreLabel).toBe("0.0 pts");
    expect(rows[0]?.comparison?.contextLabel).toBe("USD higher rate +1.10pp");
    expect(rows[0]?.comparison?.contextTitle).toContain("USD is higher by 1.10 percentage points");
    expect(rows[0]?.comparison?.levelState).toBe("quote");
    expect(rows[0]?.comparison?.levelLabel).toBe("Level: USD higher rate +1.1pp");
    expect(summary?.stateLabel).toBe("No surprise");
    expect(summary?.voteLabel).toBe("1/1 no surprise");
  });

  it("classifies macro health for CPI, unemployment, PMI, and unknown evidence", () => {
    const inflation = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "inflation")!;
    const labor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "labor")!;
    const pmi = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "pmi")!;
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor: inflation,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.5", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: inflation,
          currency: "USD",
          latestEvent: event({ currency: "USD", title: "CPI y/y", actual: "2.6", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: labor,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "Unemployment Rate", actual: "6.2", forecast: "6.5" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: labor,
          currency: "USD",
          latestEvent: event({ currency: "USD", title: "Initial Jobless Claims", actual: "240K", forecast: "220K" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: pmi,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "Manufacturing PMI", actual: "51.2", forecast: "51.2" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: pmi,
          currency: "USD",
          latestEvent: event({ currency: "USD", title: "ISM Manufacturing PMI", actual: "", forecast: "50.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [inflation, labor, pmi],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.102),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    const [inflationRow, laborRow, pmiRow] = rows;
    expect(inflationRow?.comparison?.base?.macroHealth.state).toBe("good");
    expect(inflationRow?.comparison?.base?.macroHealth.title).toContain("FX-policy pressure");
    expect(inflationRow?.comparison?.quote?.macroHealth.state).toBe("bad");
    expect(laborRow?.comparison?.base?.macroHealth.state).toBe("good");
    expect(laborRow?.comparison?.base?.macroHealth.title).toContain("unemployment, claims, and claimant counts lower are Good");
    expect(laborRow?.comparison?.quote?.macroHealth.state).toBe("bad");
    expect(pmiRow?.comparison?.base?.macroHealth.state).toBe("good");
    expect(pmiRow?.comparison?.base?.macroHealth.title).toContain("PMI/ISM above 50");
    expect(pmiRow?.comparison?.quote?.macroHealth.state).toBe("unknown");
    expect(pmiRow?.comparison?.quote?.macroHealth.title).toContain("no actual value yet");
  });

  it("does not fake a raw cross-currency level winner for same-health trade rows", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "trade")!;
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor,
          currency: "EUR",
          latestEvent: event({ currency: "EUR", countryCode: "EU", title: "Trade Balance", actual: "2.55", forecast: "", previous: "3.84" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor,
          currency: "USD",
          latestEvent: event({ currency: "USD", title: "Goods Trade Balance", actual: "-101.46", forecast: "-94.7", previous: "-82.4" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: candles(1.1, 1.099),
      cursorChartTime: 1_600,
      sourceTimeOffsetSeconds: 0,
      preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
    });

    expect(rows[0]?.comparison?.base?.macroHealth.state).toBe("bad");
    expect(rows[0]?.comparison?.quote?.macroHealth.state).toBe("bad");
    expect(rows[0]?.comparison?.levelState).toBe("mixed");
    expect(rows[0]?.comparison?.levelLabel).toBe("Level: Both weak");
    expect(rows[0]?.comparison?.levelDetailLabel).toBe("EUR Bad / USD Bad");
    expect(rows[0]?.comparison?.levelTitle).toContain("does not compare raw 2.55 versus -101.46");
    expect(rows[0]?.comparison?.levelLabel).not.toContain("higher level");
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

  it("renders macro report-card header wording and row health explanations", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "inflation")!;
    const preferences = DEFAULT_PAIR_MATRIX_PREFERENCES;
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

    expect(rows[0]?.comparison?.base?.macroHealth.state).toBe("good");
    expect(rows[0]?.comparison?.quote?.macroHealth.state).toBe("neutral");
    expect(rows[0]?.comparison?.levelLabel).toBe("Level: EUR healthier");
    expect(html).toContain("EUR Macro");
    expect(html).toContain("USD Macro");
    expect(html).toContain("Compare");
    expect(html).toContain("1G / 0B / 0N / 0U");
    expect(html).toContain("0G / 0B / 1N / 0U");
    expect(html).toContain("EUR stronger");
    expect(html).toContain("EUR CPI - Good");
    expect(html).toContain("USD CPI - Neutral");
    expect(html).toContain("Inflation is treated as FX-policy pressure");
    expect(html).toContain("Level: EUR healthier");
    expect(html).toContain("Reaction: 1/0/0");
    expect(html).not.toContain("Bias:");
    expect(html).not.toContain("Setup:");
    expect(html).not.toContain(">Now<");
    expect(html).not.toContain("Long bias - current accepting");
    expect(html).not.toContain("Trade Read");
    expect(html).not.toContain(">Trade bias<");
  });

  it("keeps reaction separate from macro health when the current candle rejects the read", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "inflation")!;
    const releaseTime = Date.UTC(2026, 6, 28, 17, 0, 0) / 1000;
    const priorTime = Date.UTC(2026, 6, 29, 19, 0, 0) / 1000;
    const cursorTime = Date.UTC(2026, 6, 29, 20, 0, 0) / 1000;
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor,
          currency: "EUR",
          latestEvent: event({ time: releaseTime, currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "3.0", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor,
          currency: "USD",
          latestEvent: event({ time: releaseTime, currency: "USD", title: "CPI y/y", actual: "4.0", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: [
        { time: releaseTime, open: 1.15, high: 1.15, low: 1.15, close: 1.15, volume: 1 },
        { time: priorTime, open: 1.14, high: 1.14, low: 1.138, close: 1.138, volume: 1 },
        { time: cursorTime, open: 1.138, high: 1.146, low: 1.137, close: 1.145, volume: 1 },
      ],
      cursorChartTime: cursorTime,
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
          anchorLabel: "29 Jul 2026 20:00",
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

    expect(rows[0]?.summaryAlignment?.status).toBe("aligned");
    expect(rows[0]?.summaryAlignment?.currentCandleStatus).toBe("rejected");
    expect(rows[0]?.comparison?.base?.macroHealth.state).toBe("neutral");
    expect(rows[0]?.comparison?.quote?.macroHealth.state).toBe("good");
    expect(html).toContain("EUR Macro");
    expect(html).toContain("USD Macro");
    expect(html).toContain("USD stronger");
    expect(html).toContain("EUR CPI - Neutral");
    expect(html).toContain("USD CPI - Good");
    expect(html).toContain("Reaction: 1/0/0");
    expect(html).toContain("Expected down / price down");
    expect(html).not.toContain("Setup: Reversal Triggered");
    expect(html).not.toContain(">Now<");
    expect(html).not.toContain("EURUSD down bias - current rejecting");
    expect(html).not.toContain("Reversal Watch");
  });

  it("renders muted current-candle data without reintroducing setup wording", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "inflation")!;
    const releaseTime = Date.UTC(2026, 6, 28, 17, 0, 0) / 1000;
    const priorTime = Date.UTC(2026, 6, 29, 19, 0, 0) / 1000;
    const cursorTime = Date.UTC(2026, 6, 29, 20, 0, 0) / 1000;
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor,
          currency: "EUR",
          latestEvent: event({ time: releaseTime, currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "4.0", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor,
          currency: "USD",
          latestEvent: event({ time: releaseTime, currency: "USD", title: "CPI y/y", actual: "3.0", forecast: "3.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: [
        { time: releaseTime, open: 1.1, high: 1.1, low: 1.1, close: 1.1, volume: 1 },
        { time: priorTime, open: 1.101, high: 1.102, low: 1.101, close: 1.102, volume: 1 },
        { time: cursorTime, open: 1.102, high: 1.1021, low: 1.102, close: 1.10205, volume: 1 },
      ],
      cursorChartTime: cursorTime,
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
          comparisonSummary: buildPairMatrixComparisonSummary({ rows, currencies: ["EUR", "USD"], preferences: DEFAULT_PAIR_MATRIX_PREFERENCES }),
          preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          anchorLabel: "29 Jul 2026 20:00",
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

    expect(rows[0]?.summaryAlignment?.status).toBe("aligned");
    expect(rows[0]?.summaryAlignment?.currentCandleStatus).toBe("muted");
    expect(rows[0]?.comparison?.base?.macroHealth.state).toBe("good");
    expect(rows[0]?.comparison?.quote?.macroHealth.state).toBe("neutral");
    expect(html).toContain("EUR CPI - Good");
    expect(html).toContain("USD CPI - Neutral");
    expect(html).toContain("Reaction: 1/0/0");
    expect(html).not.toContain("Setup: Reversal Setup");
    expect(html).not.toContain("now fading");
    expect(html).not.toContain(">Now<");
  });

  it("grounds Level in macro health before falling back to raw level context", () => {
    const factor = MACRO_FACTOR_DEFINITIONS.find((item) => item.id === "policy")!;
    const releaseTime = Date.UTC(2026, 6, 28, 17, 0, 0) / 1000;
    const cursorTime = Date.UTC(2026, 6, 29, 20, 0, 0) / 1000;
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor,
          currency: "EUR",
          latestEvent: event({ time: releaseTime, currency: "EUR", countryCode: "EU", title: "ECB Interest Rate Decision", actual: "3.0", forecast: "2.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor,
          currency: "USD",
          latestEvent: event({ time: releaseTime, currency: "USD", title: "Fed Interest Rate Decision", actual: "4.0", forecast: "4.0" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [factor],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: [
        { time: releaseTime, open: 1.1, high: 1.1, low: 1.1, close: 1.1, volume: 1 },
        { time: cursorTime, open: 1.1, high: 1.103, low: 1.1, close: 1.103, volume: 1 },
      ],
      cursorChartTime: cursorTime,
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
          comparisonSummary: buildPairMatrixComparisonSummary({ rows, currencies: ["EUR", "USD"], preferences: DEFAULT_PAIR_MATRIX_PREFERENCES }),
          preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          anchorLabel: "29 Jul 2026 20:00",
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

    expect(rows[0]?.comparison?.base?.macroHealth.state).toBe("good");
    expect(rows[0]?.comparison?.quote?.macroHealth.state).toBe("neutral");
    expect(rows[0]?.comparison?.levelLabel).toBe("Level: EUR healthier");
    expect(html).toContain("EUR Rates - Good");
    expect(html).toContain("USD Rates - Neutral");
    expect(html).toContain("EUR stronger");
    expect(html).toContain("Shock: 1/0/0");
    expect(html).toContain("Level: 1/0/0");
    expect(html).not.toContain("Bias: Mixed Bias");
    expect(html).not.toContain("Setup: Conflict");
    expect(html).not.toContain("Shock and Level disagree");
  });

  it("shows low-confidence macro boxes when clean evidence is missing", () => {
    const html = renderToStaticMarkup(
      createElement(ChartPairMatrixTimeLens, {
        data: {
          open: true,
          pairLabel: "EURUSD",
          currencies: ["EUR", "USD"],
          rows: [],
          comparisonSummary: null,
          preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          anchorLabel: "29 Jul 2026 20:00",
          anchorBasisLabel: "cursor time",
          coverageLabel: "0/0 factor cells loaded",
          displayTimeMode: "server",
          sourceTimeOffsetSeconds: 0,
          calendarDiagnostics: {
            lookbackLabel: "Pair Matrix lookback: 400d current",
            loadStateLabel: "Using current app feed",
            loadedRangeLabel: "Loaded calendar: none",
            anchorStatusLabel: "Anchor outside loaded calendar range",
            canLoadOlder: false,
          },
          onPreferenceChange: () => {},
          onLoadOlderCalendarContext: () => {},
          onToggleOpen: () => {},
          onClose: () => {},
        },
      }),
    );

    expect(html).toContain("EUR Macro");
    expect(html).toContain("USD Macro");
    expect(html).toContain("Compare");
    expect(html).toContain("0G / 0B / 0N / 0U");
    expect(html).toContain("Low confidence");
    expect(html).not.toContain("Bias:");
    expect(html).not.toContain("Setup:");
    expect(html).not.toContain(">Now<");
  });

  it("uses the fallback visible row for header Reaction and Window instead of the strongest global move", () => {
    const policy = MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "policy")!;
    const inflation = MACRO_FACTOR_DEFINITIONS.find((factor) => factor.id === "inflation")!;
    const policyTime = Date.UTC(2026, 6, 16, 23, 0, 0) / 1000;
    const inflationTime = Date.UTC(2026, 7, 7, 23, 0, 0) / 1000;
    const cursorTime = Date.UTC(2026, 7, 12, 8, 0, 0) / 1000;
    const rows = buildPairMatrixViewRows({
      factorRows: [
        {
          factor: policy,
          currency: "EUR",
          latestEvent: event({ time: policyTime, currency: "EUR", countryCode: "EU", title: "ECB Interest Rate Decision", actual: "3", forecast: "2" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: policy,
          currency: "USD",
          latestEvent: event({ time: policyTime, currency: "USD", title: "Fed Interest Rate Decision", actual: "4", forecast: "4" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: inflation,
          currency: "EUR",
          latestEvent: event({ time: inflationTime, currency: "EUR", countryCode: "EU", title: "CPI y/y", actual: "8", forecast: "2" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
        {
          factor: inflation,
          currency: "USD",
          latestEvent: event({ time: inflationTime, currency: "USD", title: "CPI y/y", actual: "2", forecast: "2" }),
          nextEvent: null,
          coverageLabel: "Latest only",
          summary: "",
        },
      ],
      factors: [policy, inflation],
      currencies: ["EUR", "USD"],
      selectedSymbol: "EURUSD",
      visibleCandles: [
        { time: policyTime, open: 1.19, high: 1.19, low: 1.19, close: 1.19, volume: 1 },
        { time: inflationTime, open: 1.1, high: 1.1, low: 1.1, close: 1.1, volume: 1 },
        { time: cursorTime, open: 1.1, high: 1.2, low: 1.1, close: 1.2, volume: 1 },
      ],
      cursorChartTime: cursorTime,
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
          comparisonSummary: buildPairMatrixComparisonSummary({ rows, currencies: ["EUR", "USD"], preferences: DEFAULT_PAIR_MATRIX_PREFERENCES }),
          preferences: DEFAULT_PAIR_MATRIX_PREFERENCES,
          anchorLabel: "12 Aug 2026 08:00",
          anchorBasisLabel: "cursor time",
          coverageLabel: "4/4 factor cells loaded",
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

    expect(html).toContain("Selected row move: +100.0 pips / +0.84%");
    expect(html).toContain("Reaction:");
    expect(html).toContain("<em>+100.0 pips / +0.84%</em>");
    expect(html).toContain("Window</strong><em>16 Jul 23:00 -&gt; 12 Aug 08:00</em>");
    expect(html).not.toContain("<strong>Move</strong>");
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
    expect(html).toContain(">Level<");
    expect(html).toContain(">Shock<");
    expect(html).toContain("Price");
    expect(html).toContain("<strong>Compare</strong>");
    expect(html).not.toContain(">Driver<");
    expect(html).toContain("Pair Matrix settings");
    expect(html).toContain("chart-pair-matrix-summary-box");
    expect(html).toContain("EUR Macro");
    expect(html).toContain("USD Macro");
    expect(html).toContain("USD stronger");
    expect(html).toContain("Level: USD healthier");
    expect(html).toContain("Shock: USD +7.1 pts");
    expect(html).toContain("EUR - USD: -7.1 pts");
    expect(html).not.toContain("chart-pair-matrix-score-pair");
    expect(html).not.toContain("Bias: EURUSD Down");
    expect(html).not.toContain("USD evidence leads");
    expect(html).not.toContain("Setup: Continuation");
    expect(html).not.toContain("window and now agree");
    expect(html).toContain("Shock: 0/1/0");
    expect(html).toContain("Level: 0/1/0");
    expect(html).toContain("Base / Quote / Outlier");
    expect(html).toContain("is-state is-vote is-quote_leads");
    expect(html).toContain("is-state is-level is-level-quote");
    expect(html).toContain("chart-pair-matrix-signal-level is-level-quote");
    expect(html).toContain("chart-pair-matrix-signal-shock is-quote_leads");
    expect(html).not.toContain("chart-pair-matrix-counter");
    expect(html).not.toContain(">Quote leads<");
    expect(html).not.toContain(">Base leads<");
    expect(html).not.toContain(">No surprise<");
    expect(html).not.toContain(">Partial read<");
    expect(html).toContain("Reaction: 1/0/0");
    expect(html).toContain("Green 1, red 0");
    expect(html).toContain("is-state is-driver is-driver-green");
    expect(html).toContain("chart-pair-matrix-row is-signal-band  is-bearish-bias");
    expect(html).toContain("chart-pair-matrix-signal-reaction is-aligned");
    expect(html).not.toContain("Base 0 / Quote 1 /");
    expect(html).not.toContain("Green 1 / Red 0");
    expect(html).not.toContain("Other 0");
    expect(html).toContain("Window");
    expect(html).not.toContain(">Now<");
    expect(html).not.toContain("Continuation");
    expect(html).not.toContain("Trade Read");
    expect(html).not.toContain("<strong>Move</strong>");
    expect(html).not.toContain(">Latest<");
    expect(html).not.toContain(">Next<");
    expect(html).not.toContain("USD latest");
    expect(html).not.toContain("USD next");
    expect(html).not.toContain("EUR latest");
    expect(html).not.toContain("EUR next");
    expect(html).toContain("Fed Interest Rate Decision");
    expect(html).toContain("EUR Rates - Neutral");
    expect(html).toContain("USD Rates - Good");
    expect(html).toContain("chart-pair-matrix-signal-values");
    expect(html).toContain("<b>A 3.75%</b><b>P 3.5%</b><b>Surp +0.25%</b>");
    expect(html).toContain("A 3.75%");
    expect(html).toContain("F -");
    expect(html).toContain("P 3.5%");
    expect(html).toContain("F 3.75%");
    expect(html).toContain("30 Jul 2026");
    expect(html).toContain("17 Sept 2026");
    expect(html).toContain("Rel 30 Jul 04:00");
    expect(html).toContain("Next 17 Sept 04:00");
    expect(html).toContain("Cursor 30 Jul 05:00");
    expect(html).not.toContain(">30 Jul 2026 04:00<");
    expect(html).toContain("-20.0 pips");
    expect(html).toContain("-0.18%");
    expect(html).toContain("chart-pair-matrix-move-stack");
    expect(html).toContain("<b>-20.0 pips</b><em>-0.18%</em>");
    expect(html).toContain("Policy rate price move window");
    expect(html).toContain("30 Jul 2026 04:00 -&gt; 30 Jul 2026 05:00");
    expect(html).toContain("<em>30 Jul 04:00 -&gt; 30 Jul 05:00</em>");
    expect(html).not.toContain("<em>30 Jul 2026 04:00 -&gt; 30 Jul 2026 05:00</em>");
    expect(html).toContain("Expected down / price down");
    expect(html).toContain("EURUSD expected down");
    expect(html).not.toContain("<strong>Aligned</strong>");
    expect(html).not.toContain("<strong>Rejected</strong>");
    expect(html).not.toContain("<strong>Unclear</strong>");
    expect(html).toContain("chart-pair-matrix-settings-details");
    expect(html).toContain("Evidence Signal settings");
    expect(html).toContain("Hierarchy");
    expect(html).toContain("Toggle hierarchy view");
    expect(html).toContain("Macro boxes grade each currency first");
    expect(html).toContain("Good means FX-supportive");
    expect(html).toContain("Level = grounded macro-health comparison");
    expect(html).not.toContain("Bias shows what loaded economic evidence says the pair should do");
    expect(html).not.toContain("Setup: Continuation = Bias, Reaction, and Now agree");
    expect(html).toContain("Evidence Signal color guide");
    expect(html).toContain("Green row: EURUSD up bias");
    expect(html).toContain("Red row: EURUSD down bias");
    expect(html).toContain("Green reaction: accepted");
    expect(html).toContain("Red reaction: rejected");
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
    expect(html).not.toContain(">Signal<");
    expect(html).not.toContain(">Wording<");
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
