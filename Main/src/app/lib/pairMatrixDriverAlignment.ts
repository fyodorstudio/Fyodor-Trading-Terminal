import { FX_PAIRS, MAJOR_CURRENCY_ORDER, getFxPairByName } from "@/app/config/fxPairs";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { getEventComparison } from "@/app/lib/eventReaction";
import { parseNumericValue } from "@/app/lib/format";
import type { MacroFactorDefinition, MacroFactorRow } from "@/app/lib/macroDrivers";
import type { BridgeCandle, CalendarEvent } from "@/app/types";

export type PairMatrixDriverReadMode = "strongest" | "separate";
export type PairMatrixSurpriseSensitivity = "low" | "normal" | "high";
export type PairMatrixSortMode = "factor" | "driver_strength";
export type PairMatrixDisplayDensity = "compact" | "comfortable";
export type PairMatrixAlignmentStatus = "aligned" | "rejected" | "muted" | "unclear";
export type PairMatrixComparisonMode = "macro_surprise" | "macro_price" | "raw_values";
export type PairMatrixWinnerMode = "factor_vote" | "normalized_score" | "per_factor";
export type PairMatrixCalendarLookback = "current_400d" | "two_year";
export type PairMatrixLayoutMode = "signal_bands" | "audit_lines" | "top_drivers";
export type PairMatrixSignalBiasMode = "macro_plus_acceptance" | "macro_vote" | "accepted_drivers";
export type PairMatrixSignalWordingMode = "evidence_bias" | "trade_bias";
export type PairMatrixBundleDisplayMode = "strongest_with_count" | "all_in_details";
export type PairMatrixEvidenceReasonCode =
  | "loaded"
  | "outside_loaded_calendar_range"
  | "no_loaded_matching_release"
  | "actual_not_released"
  | "actual_not_numeric"
  | "no_comparison_basis"
  | "no_directional_surprise"
  | "no_release_to_cursor_candle_window"
  | "release_after_cursor"
  | "symbol_not_mapped_to_base_quote";
export type PairMatrixComparisonState =
  | "base_leads"
  | "quote_leads"
  | "both_supportive"
  | "both_weak"
  | "partial_read"
  | "no_surprise"
  | "split"
  | "mixed"
  | "unclear";
export type PairMatrixLevelState = "base" | "quote" | "even" | "mixed" | "unavailable";

export interface PairMatrixPreferences {
  driverReadMode: PairMatrixDriverReadMode;
  surpriseSensitivity: PairMatrixSurpriseSensitivity;
  rowSortMode: PairMatrixSortMode;
  displayDensity: PairMatrixDisplayDensity;
  comparisonMode: PairMatrixComparisonMode;
  comparisonWinnerMode: PairMatrixWinnerMode;
  calendarLookback: PairMatrixCalendarLookback;
  layoutMode: PairMatrixLayoutMode;
  signalBiasMode: PairMatrixSignalBiasMode;
  signalWordingMode: PairMatrixSignalWordingMode;
  bundleDisplayMode: PairMatrixBundleDisplayMode;
}

export interface PairMatrixAlignmentRead {
  status: PairMatrixAlignmentStatus;
  statusLabel: string;
  currency: string;
  eventTitle: string;
  eventTime: number | null;
  basisLabel: string;
  surpriseLabel: string;
  priceMoveLabel: string;
  pipsLabel: string;
  percentLabel: string;
  releaseChartTime: number | null;
  cursorChartTime: number | null;
  expectedDirectionLabel: string;
  actualDirectionLabel: string;
  strengthScore: number;
  reason: string;
  reasonCode: PairMatrixEvidenceReasonCode;
  reasonLabel: string;
}

export interface PairMatrixCurrencyCell {
  currency: string;
  latestEvent: CalendarEvent | null;
  nextEvent: CalendarEvent | null;
  latestBundleEvents: CalendarEvent[];
  nextBundleEvents: CalendarEvent[];
  latestReasonCode: PairMatrixEvidenceReasonCode;
  latestReasonLabel: string;
  latestReasonDetail: string;
  nextReasonCode: PairMatrixEvidenceReasonCode;
  nextReasonLabel: string;
  nextReasonDetail: string;
  latestBundleCount: number;
  nextBundleCount: number;
  alignment: PairMatrixAlignmentRead | null;
}

export interface PairMatrixFactorViewRow {
  factor: MacroFactorDefinition;
  cells: PairMatrixCurrencyCell[];
  alignmentReads: PairMatrixAlignmentRead[];
  summaryAlignment: PairMatrixAlignmentRead | null;
  comparison: PairMatrixFactorComparison | null;
}

export interface PairMatrixComparisonSide {
  currency: string;
  eventTitle: string;
  actualValue: number | null;
  actualLabel: string;
  comparisonLabel: string;
  basisLabel: string;
  rawSurpriseLabel: string;
  relativeSurpriseLabel: string;
  score: number | null;
  scoreLabel: string;
  acceptanceLabel: string;
  formulaLabel: string;
  reasonCode: PairMatrixEvidenceReasonCode;
  reasonLabel: string;
}

export interface PairMatrixFactorComparison {
  factorId: string;
  factorLabel: string;
  state: PairMatrixComparisonState;
  stateLabel: string;
  base: PairMatrixComparisonSide | null;
  quote: PairMatrixComparisonSide | null;
  detailLabel: string;
  contextLabel: string | null;
  contextTitle: string | null;
  levelState: PairMatrixLevelState;
  levelLabel: string;
  levelDetailLabel: string;
  levelTitle: string;
  reasonCodes: PairMatrixEvidenceReasonCode[];
}

export interface PairMatrixComparisonSummary {
  state: PairMatrixComparisonState;
  stateLabel: string;
  voteLabel: string;
  voteBreakdownLabel: string;
  modeLabel: string;
  winnerModeLabel: string;
  baseCurrency: string | null;
  quoteCurrency: string | null;
  baseScoreLabel: string;
  quoteScoreLabel: string;
  detailLabel: string;
  otherBreakdownLabel: string;
  factorReads: PairMatrixFactorComparison[];
}

interface InstrumentContext {
  base: string;
  quote: string;
  pipSize: number;
}

const MAJOR_CURRENCIES = new Set<string>(MAJOR_CURRENCY_ORDER);

export const DEFAULT_PAIR_MATRIX_PREFERENCES: PairMatrixPreferences = {
  driverReadMode: "strongest",
  surpriseSensitivity: "normal",
  rowSortMode: "factor",
  displayDensity: "compact",
  comparisonMode: "macro_surprise",
  comparisonWinnerMode: "factor_vote",
  calendarLookback: "current_400d",
  layoutMode: "signal_bands",
  signalBiasMode: "macro_plus_acceptance",
  signalWordingMode: "evidence_bias",
  bundleDisplayMode: "strongest_with_count",
};

function normalizeSymbolToken(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z]/g, "");
}

export function normalizePairMatrixPreferences(raw: unknown): PairMatrixPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PAIR_MATRIX_PREFERENCES;
  const row = raw as Record<string, unknown>;
  const fallback = DEFAULT_PAIR_MATRIX_PREFERENCES;

  return {
    driverReadMode: row.driverReadMode === "separate" || row.driverReadMode === "strongest"
      ? row.driverReadMode
      : fallback.driverReadMode,
    surpriseSensitivity:
      row.surpriseSensitivity === "low" || row.surpriseSensitivity === "normal" || row.surpriseSensitivity === "high"
        ? row.surpriseSensitivity
        : fallback.surpriseSensitivity,
    rowSortMode: row.rowSortMode === "driver_strength" || row.rowSortMode === "factor"
      ? row.rowSortMode
      : fallback.rowSortMode,
    displayDensity: row.displayDensity === "comfortable" || row.displayDensity === "compact"
      ? row.displayDensity
      : fallback.displayDensity,
    comparisonMode:
      row.comparisonMode === "macro_price" || row.comparisonMode === "raw_values" || row.comparisonMode === "macro_surprise"
        ? row.comparisonMode
        : fallback.comparisonMode,
    comparisonWinnerMode:
      row.comparisonWinnerMode === "normalized_score" ||
      row.comparisonWinnerMode === "per_factor" ||
      row.comparisonWinnerMode === "factor_vote"
        ? row.comparisonWinnerMode
        : fallback.comparisonWinnerMode,
    calendarLookback:
      row.calendarLookback === "two_year" || row.calendarLookback === "current_400d"
        ? row.calendarLookback
        : fallback.calendarLookback,
    layoutMode:
      row.layoutMode === "audit_lines" || row.layoutMode === "top_drivers" || row.layoutMode === "signal_bands"
        ? row.layoutMode
        : fallback.layoutMode,
    signalBiasMode:
      row.signalBiasMode === "macro_vote" ||
      row.signalBiasMode === "accepted_drivers" ||
      row.signalBiasMode === "macro_plus_acceptance"
        ? row.signalBiasMode
        : fallback.signalBiasMode,
    signalWordingMode:
      row.signalWordingMode === "trade_bias" || row.signalWordingMode === "evidence_bias"
        ? row.signalWordingMode
        : fallback.signalWordingMode,
    bundleDisplayMode:
      row.bundleDisplayMode === "all_in_details" || row.bundleDisplayMode === "strongest_with_count"
        ? row.bundleDisplayMode
        : fallback.bundleDisplayMode,
  };
}

function resolveInstrumentContext(symbol: string): InstrumentContext | null {
  const normalized = normalizeSymbolToken(symbol);
  const directPair = getFxPairByName(symbol.toUpperCase());
  const inferredPair = directPair ?? FX_PAIRS.find((pair) => normalized.startsWith(pair.name)) ?? null;
  if (inferredPair) {
    return {
      base: inferredPair.base,
      quote: inferredPair.quote,
      pipSize: inferredPair.quote === "JPY" ? 0.01 : 0.0001,
    };
  }

  if (normalized.startsWith("XAUUSD")) {
    return { base: "XAU", quote: "USD", pipSize: 0.01 };
  }

  const base = normalized.slice(0, 3);
  const quote = normalized.slice(3, 6);
  if (MAJOR_CURRENCIES.has(base) && MAJOR_CURRENCIES.has(quote)) {
    return { base, quote, pipSize: quote === "JPY" ? 0.01 : 0.0001 };
  }

  return null;
}

function getCandleAtOrAfter(candles: BridgeCandle[], time: number): BridgeCandle | null {
  return candles.find((candle) => candle.time >= time) ?? null;
}

function getCandleAtOrBefore(candles: BridgeCandle[], time: number): BridgeCandle | null {
  for (let index = candles.length - 1; index >= 0; index -= 1) {
    if (candles[index].time <= time) return candles[index];
  }
  return null;
}

function formatSignedValue(value: number, eventTitle: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const rounded = Number(absolute.toFixed(4)).toString();
  return `${sign}${getEventValueDisplay(rounded, eventTitle).display}`;
}

function formatRelative(value: number | null): string {
  if (value == null) return "relative unavailable";
  return `${formatSignedFixed(value, 1, "%")} rel`;
}

function formatSignedFixed(value: number, decimals: number, suffix = ""): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}${suffix}`;
}

export function getPairMatrixReasonLabel(code: PairMatrixEvidenceReasonCode): string {
  if (code === "loaded") return "loaded";
  if (code === "outside_loaded_calendar_range") return "outside loaded calendar range";
  if (code === "no_loaded_matching_release") return "no loaded matching release";
  if (code === "actual_not_released") return "actual not released";
  if (code === "actual_not_numeric") return "actual not numeric";
  if (code === "no_comparison_basis") return "no forecast/previous basis";
  if (code === "no_directional_surprise") return "no directional surprise";
  if (code === "no_release_to_cursor_candle_window") return "no release-to-cursor candle window";
  if (code === "release_after_cursor") return "release after cursor";
  return "symbol not mapped to base/quote";
}

function getPairMatrixReasonDetail(code: PairMatrixEvidenceReasonCode): string {
  if (code === "outside_loaded_calendar_range") {
    return "The cursor anchor is outside the loaded broker/MT5 calendar range for this Pair Matrix lookback.";
  }
  if (code === "no_loaded_matching_release") {
    return "No loaded broker/MT5 calendar row matched this currency and macro factor.";
  }
  if (code === "actual_not_released") {
    return "The loaded row has no actual value yet, so release surprise cannot be scored.";
  }
  if (code === "actual_not_numeric") {
    return "The loaded actual value is present but cannot be safely converted into a number.";
  }
  if (code === "no_comparison_basis") {
    return "The actual value is numeric, but neither forecast nor previous is numeric enough to compare.";
  }
  if (code === "no_directional_surprise") {
    return "Actual matched the comparison basis closely enough that this release does not imply a pair direction.";
  }
  if (code === "no_release_to_cursor_candle_window") {
    return "Loaded candles do not cover the release-close to cursor-close window.";
  }
  if (code === "release_after_cursor") {
    return "The release is after the cursor anchor, so there is no observed reaction yet.";
  }
  if (code === "symbol_not_mapped_to_base_quote") {
    return "The selected chart symbol cannot be mapped to a base/quote currency direction.";
  }
  return "Loaded release evidence is available.";
}

function getMissingEventReason(
  row: MacroFactorRow | null,
  side: "latest" | "next",
): PairMatrixEvidenceReasonCode {
  const rawReason = side === "latest" ? row?.latestMissingReason : row?.nextMissingReason;
  return rawReason === "outside_loaded_calendar_range" ? "outside_loaded_calendar_range" : "no_loaded_matching_release";
}

function getEventComparisonMissingReason(event: CalendarEvent): PairMatrixEvidenceReasonCode {
  const rawActual = event.actual.trim();
  const actual = parseNumericValue(event.actual);
  if (!rawActual) return "actual_not_released";
  if (actual == null) return "actual_not_numeric";
  return "no_comparison_basis";
}

function inferCurrencySupportDirection(event: CalendarEvent, surprise: number): 1 | -1 | 0 {
  if (surprise === 0) return 0;
  const title = event.title.toLowerCase();
  const lowerSupports =
    title.includes("unemployment") ||
    title.includes("jobless") ||
    title.includes("claimant") ||
    title.includes("initial claims") ||
    title.includes("continuing claims");
  return lowerSupports ? (surprise < 0 ? 1 : -1) : surprise > 0 ? 1 : -1;
}

function getAcceptanceMultiplier(read: PairMatrixAlignmentRead | null): { multiplier: number; label: string } {
  if (!read) return { multiplier: 1, label: "acceptance unavailable" };
  if (read.status === "aligned") return { multiplier: 1.25, label: "aligned x1.25" };
  if (read.status === "rejected") return { multiplier: 0.5, label: "rejected x0.50" };
  if (read.status === "muted") return { multiplier: 0.75, label: "muted x0.75" };
  return { multiplier: 1, label: "unclear x1.00" };
}

function getExpectedPairDirection(currency: string, currencySupportDirection: 1 | -1, instrument: InstrumentContext): 1 | -1 | null {
  if (currency === instrument.base) return currencySupportDirection;
  if (currency === instrument.quote) return currencySupportDirection === 1 ? -1 : 1;
  return null;
}

function getPriceThreshold(params: {
  sensitivity: PairMatrixSurpriseSensitivity;
  pipSize: number;
  releaseClose: number;
}): number {
  const pipThreshold =
    params.sensitivity === "low" ? 1 : params.sensitivity === "high" ? 8 : 3;
  const percentThreshold =
    params.sensitivity === "low" ? 0.01 : params.sensitivity === "high" ? 0.08 : 0.03;
  return Math.max(pipThreshold * params.pipSize, params.releaseClose * (percentThreshold / 100));
}

function getSurpriseThreshold(sensitivity: PairMatrixSurpriseSensitivity, comparisonValue: number): number {
  if (sensitivity === "low" || comparisonValue === 0) return 0;
  const relativeThreshold = Math.abs(comparisonValue) * (sensitivity === "high" ? 0.02 : 0.0025);
  return Number(relativeThreshold.toFixed(4));
}

function makeUnclearRead(
  event: CalendarEvent | null,
  currency: string,
  reasonCode: PairMatrixEvidenceReasonCode,
  reason: string = getPairMatrixReasonDetail(reasonCode),
): PairMatrixAlignmentRead {
  return {
    status: "unclear",
    statusLabel: "Unclear",
    currency,
    eventTitle: event?.title ?? "No loaded release",
    eventTime: event?.time ?? null,
    basisLabel: "-",
    surpriseLabel: "-",
    priceMoveLabel: "-",
    pipsLabel: "-",
    percentLabel: "-",
    releaseChartTime: null,
    cursorChartTime: null,
    expectedDirectionLabel: "-",
    actualDirectionLabel: "-",
    strengthScore: 0,
    reason,
    reasonCode,
    reasonLabel: getPairMatrixReasonLabel(reasonCode),
  };
}

function buildComparisonSide(
  cell: PairMatrixCurrencyCell | null,
  mode: PairMatrixComparisonMode,
): PairMatrixComparisonSide | null {
  const event = cell?.latestEvent ?? null;
  if (!cell) return null;
  if (!event) {
    return {
      currency: cell.currency,
      eventTitle: "No loaded release",
      actualValue: null,
      actualLabel: "-",
      comparisonLabel: "-",
      basisLabel: cell.latestReasonLabel,
      rawSurpriseLabel: "-",
      relativeSurpriseLabel: "relative unavailable",
      score: null,
      scoreLabel: cell.latestReasonLabel,
      acceptanceLabel: "acceptance unavailable",
      formulaLabel: cell.latestReasonDetail,
      reasonCode: cell.latestReasonCode,
      reasonLabel: cell.latestReasonLabel,
    };
  }
  const comparison = getEventComparison(event);
  const actualValue = parseNumericValue(event.actual);
  const actualLabel = getEventValueDisplay(event.actual, event.title).display;
  if (!comparison) {
    const reasonCode = getEventComparisonMissingReason(event);
    return {
      currency: event.currency,
      eventTitle: event.title,
      actualValue,
      actualLabel,
      comparisonLabel: "-",
      basisLabel: getPairMatrixReasonLabel(reasonCode),
      rawSurpriseLabel: "-",
      relativeSurpriseLabel: "relative unavailable",
      score: null,
      scoreLabel: getPairMatrixReasonLabel(reasonCode),
      acceptanceLabel: "acceptance unavailable",
      formulaLabel: getPairMatrixReasonDetail(reasonCode),
      reasonCode,
      reasonLabel: getPairMatrixReasonLabel(reasonCode),
    };
  }

  const supportDirection = inferCurrencySupportDirection(event, comparison.surprise);
  const rawScore = supportDirection === 0 ? 0 : Math.abs(comparison.surprise) * supportDirection;
  const relativeScore =
    comparison.comparisonValue === 0
      ? null
      : (Math.abs(comparison.surprise) / Math.abs(comparison.comparisonValue)) * 100 * supportDirection;
  const baseScore = relativeScore ?? rawScore;
  const acceptance = mode === "macro_price" ? getAcceptanceMultiplier(cell?.alignment ?? null) : { multiplier: 1, label: "macro only" };
  const score = mode === "raw_values" ? baseScore : baseScore * acceptance.multiplier;
  const basisLabel = comparison.basis === "forecast" ? "Actual vs forecast" : "Actual vs previous";
  const comparisonLabel = getEventValueDisplay(String(comparison.comparisonValue), event.title).display;
  const rawSurpriseLabel = formatSignedValue(comparison.surprise, event.title);
  const relativeSurpriseLabel = formatRelative(relativeScore);

  return {
    currency: event.currency,
    eventTitle: event.title,
    actualValue,
    actualLabel,
    comparisonLabel,
    basisLabel,
    rawSurpriseLabel,
    relativeSurpriseLabel,
    score,
    scoreLabel: `${formatSignedFixed(score, 1)} pts`,
    acceptanceLabel: acceptance.label,
    formulaLabel:
      mode === "raw_values"
        ? `${basisLabel}: actual ${actualLabel}, compare ${comparisonLabel}, surprise ${rawSurpriseLabel}.`
        : `${basisLabel}: ${relativeSurpriseLabel} ${mode === "macro_price" ? `x ${acceptance.label}` : "macro surprise"} = ${formatSignedFixed(score, 1)} pts.`,
    reasonCode: "loaded",
    reasonLabel: getPairMatrixReasonLabel("loaded"),
  };
}

function isFactorTitle(eventTitle: string, keywords: string[]): boolean {
  const title = eventTitle.toLowerCase();
  return keywords.some((keyword) => title.includes(keyword));
}

function formatSideLevel(side: PairMatrixComparisonSide | null): string | null {
  if (!side || side.actualValue == null) return null;
  return `${side.currency} ${side.actualLabel}`;
}

function getLevelUnit(side: PairMatrixComparisonSide): "percent" | "thousand" | "plain" {
  const display = side.actualLabel.toLowerCase();
  if (display.includes("%")) return "percent";
  if (display.endsWith("k")) return "thousand";
  return "plain";
}

function formatLevelDelta(value: number, unit: "percent" | "thousand" | "plain"): string {
  if (unit === "percent") return `+${Math.abs(value).toFixed(2).replace(/\.?0+$/, "")}pp`;
  if (unit === "thousand") return `+${Math.abs(value).toFixed(1).replace(/\.?0+$/, "")}K`;
  return `+${Math.abs(value).toFixed(2).replace(/\.?0+$/, "")}`;
}

function getLevelPolarity(factor: MacroFactorDefinition, side: PairMatrixComparisonSide): 1 | -1 | null {
  const title = side.eventTitle.toLowerCase();
  if (factor.id === "policy") return 1;
  if (factor.id === "pmi") {
    return isFactorTitle(side.eventTitle, ["pmi", "ism"]) ? 1 : null;
  }
  if (factor.id === "labor") {
    if (
      title.includes("unemployment") ||
      title.includes("jobless") ||
      title.includes("claims") ||
      title.includes("claimant")
    ) {
      return -1;
    }
    if (
      title.includes("payroll") ||
      title.includes("employment") ||
      title.includes("wage") ||
      title.includes("earnings")
    ) {
      return 1;
    }
    return null;
  }
  if (factor.id === "inflation" || factor.id === "retail" || factor.id === "sentiment" || factor.id === "trade") {
    return 1;
  }
  return null;
}

function getLevelFamily(factor: MacroFactorDefinition, side: PairMatrixComparisonSide): string {
  const title = side.eventTitle.toLowerCase();
  if (factor.id === "policy") return "policy";
  if (factor.id === "pmi") return title.includes("ism") ? "activity" : title.includes("pmi") ? "activity" : "other";
  if (factor.id === "labor") {
    if (title.includes("unemployment")) return "unemployment";
    if (title.includes("jobless") || title.includes("claims") || title.includes("claimant")) return "claims";
    if (title.includes("payroll") || title.includes("employment")) return "employment";
    if (title.includes("wage") || title.includes("earnings")) return "earnings";
    return "labor";
  }
  if (factor.id === "inflation") {
    if (title.includes("cpi")) return "cpi";
    if (title.includes("pce")) return "pce";
    if (title.includes("ppi")) return "ppi";
    return "inflation";
  }
  return factor.id;
}

function buildLevelComparison(
  factor: MacroFactorDefinition,
  base: PairMatrixComparisonSide | null,
  quote: PairMatrixComparisonSide | null,
): { state: PairMatrixLevelState; label: string; detailLabel: string; title: string } {
  const baseLevel = formatSideLevel(base);
  const quoteLevel = formatSideLevel(quote);
  const valuesLabel = [baseLevel, quoteLevel].filter(Boolean).join(" / ") || "level unavailable";
  const unavailable = {
    state: "unavailable" as const,
    label: "Level: N/A",
    detailLabel: valuesLabel,
    title: "Level context needs numeric actual values on both sides.",
  };

  if (!base || !quote || base.actualValue == null || quote.actualValue == null) return unavailable;

  const basePolarity = getLevelPolarity(factor, base);
  const quotePolarity = getLevelPolarity(factor, quote);
  const baseUnit = getLevelUnit(base);
  const quoteUnit = getLevelUnit(quote);
  const baseFamily = getLevelFamily(factor, base);
  const quoteFamily = getLevelFamily(factor, quote);
  const fullTitle = `${factor.label} level context: ${base.currency} ${base.eventTitle} actual ${base.actualLabel}; ${quote.currency} ${quote.eventTitle} actual ${quote.actualLabel}.`;

  if (factor.id !== "policy" && factor.id !== "pmi" && (baseUnit !== quoteUnit || basePolarity == null || quotePolarity == null || baseFamily !== quoteFamily)) {
    return {
      state: "mixed",
      label: "Level: Mixed units",
      detailLabel: valuesLabel,
      title: `${fullTitle} These rows are not the same comparable unit/family, so Pair Matrix does not fake a level winner.`,
    };
  }

  if (basePolarity == null || quotePolarity == null || basePolarity !== quotePolarity) {
    return {
      state: "mixed",
      label: "Level: Mixed",
      detailLabel: valuesLabel,
      title: `${fullTitle} Direction cannot be compared honestly across these loaded row types.`,
    };
  }

  const baseLevelScore = base.actualValue * basePolarity;
  const quoteLevelScore = quote.actualValue * quotePolarity;
  const delta = baseLevelScore - quoteLevelScore;
  const absoluteDelta = Math.abs(delta);
  const tolerance = baseUnit === "percent" ? 0.005 : 0.0001;
  if (absoluteDelta <= tolerance) {
    return {
      state: "even",
      label: "Level: Even",
      detailLabel: valuesLabel,
      title: `${fullTitle} Comparable levels are effectively even.`,
    };
  }

  const leader = delta > 0 ? base : quote;
  const leaderActualValue = leader.actualValue ?? 0;
  const adjective =
    factor.id === "policy"
      ? "higher rate"
      : factor.id === "pmi"
        ? leaderActualValue >= 50
          ? "stronger activity"
          : "less weak activity"
        : basePolarity > 0
          ? "higher level"
          : "lower level";
  return {
    state: delta > 0 ? "base" : "quote",
    label: `Level: ${leader.currency} ${adjective} ${formatLevelDelta(absoluteDelta, baseUnit)}`,
    detailLabel: valuesLabel,
    title: `${fullTitle} ${leader.currency} leads the comparable level read by ${formatLevelDelta(absoluteDelta, baseUnit)}.`,
  };
}

function formatMacroLevelContext(
  factor: MacroFactorDefinition,
  base: PairMatrixComparisonSide | null,
  quote: PairMatrixComparisonSide | null,
): { label: string; title: string } | null {
  if (base?.actualValue == null && quote?.actualValue == null) return null;
  const baseLevel = formatSideLevel(base);
  const quoteLevel = formatSideLevel(quote);

  if (factor.id === "policy" && base?.actualValue != null && quote?.actualValue != null) {
    const delta = quote.actualValue - base.actualValue;
    const absoluteDelta = Math.abs(delta);
    const leader =
      absoluteDelta <= 0.005
        ? null
        : delta > 0
          ? quote
          : base;
    const label = leader
      ? `${leader.currency} higher rate +${absoluteDelta.toFixed(2)}pp`
      : "Rate level even";
    const title = leader
      ? `Policy-rate level context only: ${base.currency} actual ${base.actualLabel}, ${quote.currency} actual ${quote.actualLabel}; ${leader.currency} is higher by ${absoluteDelta.toFixed(2)} percentage points. Surprise scores stay separate.`
      : `Policy-rate level context only: ${base.currency} actual ${base.actualLabel}, ${quote.currency} actual ${quote.actualLabel}; rate levels are effectively even. Surprise scores stay separate.`;

    return { label, title };
  }

  if (factor.id === "pmi") {
    const parts = [base, quote]
      .filter((side): side is PairMatrixComparisonSide => side?.actualValue != null)
      .filter((side) => isFactorTitle(side.eventTitle, ["pmi", "ism"]))
      .map((side) => {
        const value = side.actualValue as number;
        return `${side.currency} ${side.actualLabel} ${value >= 50 ? "above 50" : "below 50"}`;
      });
    if (parts.length > 0) {
      return {
        label: parts.join(" / "),
        title: "PMI/ISM level context only: above 50 usually indicates expansion, below 50 contraction. Surprise scores stay separate.",
      };
    }
  }

  if (factor.id === "inflation" && (baseLevel || quoteLevel)) {
    return {
      label: `Levels: ${[baseLevel, quoteLevel].filter(Boolean).join(" / ")}`,
      title: "Inflation level context only. Units are displayed from loaded MT5 values and surprise scores stay separate.",
    };
  }

  if (factor.id === "labor" && (baseLevel || quoteLevel)) {
    return {
      label: `Levels: ${[baseLevel, quoteLevel].filter(Boolean).join(" / ")}`,
      title: "Labor level context only. Labor event units can differ, so this is not a normalized cross-currency score.",
    };
  }

  return null;
}

function compareFactorSides(params: {
  factor: MacroFactorDefinition;
  base: PairMatrixComparisonSide | null;
  quote: PairMatrixComparisonSide | null;
}): PairMatrixFactorComparison {
  const { factor, base, quote } = params;
  const closeThreshold = 0.25;
  const baseScore = base?.score ?? null;
  const quoteScore = quote?.score ?? null;
  let state: PairMatrixComparisonState = "unclear";

  if (baseScore == null && quoteScore == null) {
    state = "unclear";
  } else if (baseScore != null && quoteScore == null) {
    state = "partial_read";
  } else if (baseScore == null && quoteScore != null) {
    state = "partial_read";
  } else if (baseScore != null && quoteScore != null) {
    const delta = baseScore - quoteScore;
    if (Math.abs(baseScore) <= closeThreshold && Math.abs(quoteScore) <= closeThreshold) state = "no_surprise";
    else if (baseScore > 0 && quoteScore > 0 && Math.abs(delta) <= closeThreshold) state = "both_supportive";
    else if (baseScore < 0 && quoteScore < 0 && Math.abs(delta) <= closeThreshold) state = "both_weak";
    else if (Math.abs(delta) <= closeThreshold) state = "split";
    else state = delta > 0 ? "base_leads" : "quote_leads";
  }

  const stateLabel = getComparisonStateLabel(state);
  const context = formatMacroLevelContext(factor, base, quote);
  const level = buildLevelComparison(factor, base, quote);
  const reasonCodes = [base?.reasonCode, quote?.reasonCode]
    .filter((code): code is PairMatrixEvidenceReasonCode => Boolean(code) && code !== "loaded");
  return {
    factorId: factor.id,
    factorLabel: factor.label,
    state,
    stateLabel,
    base,
    quote,
    detailLabel: `${base?.currency ?? "Base"} ${base?.scoreLabel ?? "missing side"} / ${quote?.currency ?? "Quote"} ${quote?.scoreLabel ?? "missing side"}`,
    contextLabel: context?.label ?? null,
    contextTitle: context?.title ?? null,
    levelState: level.state,
    levelLabel: level.label,
    levelDetailLabel: level.detailLabel,
    levelTitle: level.title,
    reasonCodes,
  };
}

export function getComparisonStateLabel(state: PairMatrixComparisonState): string {
  if (state === "base_leads") return "Base leads";
  if (state === "quote_leads") return "Quote leads";
  if (state === "both_supportive") return "Both supportive";
  if (state === "both_weak") return "Both weak";
  if (state === "partial_read") return "Partial read";
  if (state === "no_surprise") return "No surprise";
  if (state === "split") return "Split";
  if (state === "mixed") return "Mixed";
  return "Unclear";
}

export function derivePairMatrixAlignment(params: {
  event: CalendarEvent | null;
  selectedSymbol: string;
  visibleCandles: BridgeCandle[];
  cursorChartTime: number | null;
  sourceTimeOffsetSeconds: number;
  sensitivity: PairMatrixSurpriseSensitivity;
  missingReasonCode?: PairMatrixEvidenceReasonCode;
}): PairMatrixAlignmentRead {
  const event = params.event;
  if (!event) return makeUnclearRead(null, "", params.missingReasonCode ?? "no_loaded_matching_release");

  const comparison = getEventComparison(event);
  if (!comparison) {
    const reasonCode = getEventComparisonMissingReason(event);
    return makeUnclearRead(event, event.currency, reasonCode);
  }

  const instrument = resolveInstrumentContext(params.selectedSymbol);
  if (!instrument) return makeUnclearRead(event, event.currency, "symbol_not_mapped_to_base_quote");

  const currencySupportDirection = inferCurrencySupportDirection(event, comparison.surprise);
  if (currencySupportDirection === 0) {
    return makeUnclearRead(event, event.currency, "no_directional_surprise");
  }
  const expectedPairDirection =
    getExpectedPairDirection(event.currency, currencySupportDirection, instrument);
  if (!expectedPairDirection) {
    return makeUnclearRead(event, event.currency, "symbol_not_mapped_to_base_quote", `${event.currency} is not a mapped base or quote driver for ${params.selectedSymbol}.`);
  }

  if (params.visibleCandles.length === 0 || params.cursorChartTime == null) {
    return makeUnclearRead(event, event.currency, "no_release_to_cursor_candle_window", "Loaded candles are required to compare release close against cursor close.");
  }

  const releaseChartTime = event.time + params.sourceTimeOffsetSeconds;
  if (params.cursorChartTime < releaseChartTime) {
    return makeUnclearRead(event, event.currency, "release_after_cursor");
  }
  const releaseCandle = getCandleAtOrAfter(params.visibleCandles, releaseChartTime);
  const cursorCandle = getCandleAtOrBefore(params.visibleCandles, params.cursorChartTime);
  if (!releaseCandle || !cursorCandle || cursorCandle.time < releaseCandle.time) {
    return makeUnclearRead(event, event.currency, "no_release_to_cursor_candle_window");
  }

  const priceDelta = cursorCandle.close - releaseCandle.close;
  const percentMove = releaseCandle.close === 0 ? 0 : (priceDelta / releaseCandle.close) * 100;
  const pips = priceDelta / instrument.pipSize;
  const threshold = getPriceThreshold({
    sensitivity: params.sensitivity,
    pipSize: instrument.pipSize,
    releaseClose: releaseCandle.close,
  });
  const surpriseThreshold = getSurpriseThreshold(params.sensitivity, comparison.comparisonValue);
  const actualDirection = priceDelta > 0 ? 1 : priceDelta < 0 ? -1 : 0;
  const status: PairMatrixAlignmentStatus =
    Math.abs(comparison.surprise) < surpriseThreshold || Math.abs(priceDelta) < threshold || actualDirection === 0
      ? "muted"
      : actualDirection === expectedPairDirection
        ? "aligned"
        : "rejected";

  const basisLabel = comparison.basis === "forecast" ? "Actual vs forecast" : "Actual vs previous";
  const symbolLabel = params.selectedSymbol.toUpperCase();
  const expectedDirectionLabel = `${symbolLabel} expected ${expectedPairDirection > 0 ? "up" : "down"}`;
  const actualDirectionLabel = actualDirection > 0 ? "price up" : actualDirection < 0 ? "price down" : "flat";
  const pipsLabel = `${formatSignedFixed(pips, 1)} pips`;
  const percentLabel = `${formatSignedFixed(percentMove, 2, "%")}`;

  return {
    status,
    statusLabel: status === "aligned" ? "Aligned" : status === "rejected" ? "Rejected" : "Muted",
    currency: event.currency,
    eventTitle: event.title,
    eventTime: event.time,
    basisLabel,
    surpriseLabel: `${basisLabel} ${formatSignedValue(comparison.surprise, event.title)}`,
    priceMoveLabel: `${pipsLabel} / ${percentLabel}`,
    pipsLabel,
    percentLabel,
    releaseChartTime: releaseCandle.time,
    cursorChartTime: cursorCandle.time,
    expectedDirectionLabel,
    actualDirectionLabel,
    strengthScore: Math.abs(pips) + Math.abs(percentMove),
    reason:
      Math.abs(comparison.surprise) < surpriseThreshold
        ? `${event.currency} surprise was below the selected sensitivity; price moved ${pipsLabel} / ${percentLabel}.`
        : `${event.currency} data implied ${expectedDirectionLabel}; ${actualDirectionLabel} by ${pipsLabel} / ${percentLabel}.`,
    reasonCode: "loaded",
    reasonLabel: getPairMatrixReasonLabel("loaded"),
  };
}

function sortAlignmentReads(left: PairMatrixAlignmentRead, right: PairMatrixAlignmentRead): number {
  const rank: Record<PairMatrixAlignmentStatus, number> = {
    aligned: 0,
    rejected: 1,
    muted: 2,
    unclear: 3,
  };
  return rank[left.status] - rank[right.status] || right.strengthScore - left.strengthScore;
}

export function buildPairMatrixViewRows(params: {
  factorRows: MacroFactorRow[];
  factors: MacroFactorDefinition[];
  currencies: string[];
  selectedSymbol: string;
  visibleCandles: BridgeCandle[];
  cursorChartTime: number | null;
  sourceTimeOffsetSeconds: number;
  preferences: PairMatrixPreferences;
}): PairMatrixFactorViewRow[] {
  const rowsByCurrencyAndFactor = new Map(
    params.factorRows.map((row) => [`${row.currency}:${row.factor.id}`, row]),
  );

  const viewRows = params.factors.map((factor) => {
    const cells = params.currencies.map((currency) => {
      const row = rowsByCurrencyAndFactor.get(`${currency}:${factor.id}`) ?? null;
      const latestReasonCode: PairMatrixEvidenceReasonCode = row?.latestEvent
        ? "loaded"
        : getMissingEventReason(row, "latest");
      const nextReasonCode: PairMatrixEvidenceReasonCode = row?.nextEvent
        ? "loaded"
        : getMissingEventReason(row, "next");
      return {
        currency,
        latestEvent: row?.latestEvent ?? null,
        nextEvent: row?.nextEvent ?? null,
        latestBundleEvents: row?.latestBundleEvents ?? (row?.latestEvent ? [row.latestEvent] : []),
        nextBundleEvents: row?.nextBundleEvents ?? (row?.nextEvent ? [row.nextEvent] : []),
        latestReasonCode,
        latestReasonLabel: getPairMatrixReasonLabel(latestReasonCode),
        latestReasonDetail: getPairMatrixReasonDetail(latestReasonCode),
        nextReasonCode,
        nextReasonLabel: getPairMatrixReasonLabel(nextReasonCode),
        nextReasonDetail: getPairMatrixReasonDetail(nextReasonCode),
        latestBundleCount: row?.latestBundleCount ?? 0,
        nextBundleCount: row?.nextBundleCount ?? 0,
        alignment: derivePairMatrixAlignment({
          event: row?.latestEvent ?? null,
          selectedSymbol: params.selectedSymbol,
          visibleCandles: params.visibleCandles,
          cursorChartTime: params.cursorChartTime,
          sourceTimeOffsetSeconds: params.sourceTimeOffsetSeconds,
          sensitivity: params.preferences.surpriseSensitivity,
          missingReasonCode: latestReasonCode,
        }),
      };
    });
    const alignmentReads = cells
      .map((cell) => cell.alignment)
      .filter((read): read is PairMatrixAlignmentRead => read != null)
      .sort(sortAlignmentReads);
    const baseCell = cells[0] ?? null;
    const quoteCell = cells[1] ?? null;
    const comparison =
      baseCell && quoteCell
        ? compareFactorSides({
            factor,
            base: buildComparisonSide(baseCell, params.preferences.comparisonMode),
            quote: buildComparisonSide(quoteCell, params.preferences.comparisonMode),
          })
        : null;

    return {
      factor,
      cells,
      alignmentReads,
      summaryAlignment: alignmentReads[0] ?? null,
      comparison,
    };
  });

  if (params.preferences.rowSortMode !== "driver_strength") return viewRows;

  return [...viewRows].sort((left, right) => {
    const leftRead = left.summaryAlignment;
    const rightRead = right.summaryAlignment;
    if (!leftRead && !rightRead) return 0;
    if (!leftRead) return 1;
    if (!rightRead) return -1;
    return sortAlignmentReads(leftRead, rightRead);
  });
}

export function buildPairMatrixComparisonSummary(params: {
  rows: PairMatrixFactorViewRow[];
  currencies: string[];
  preferences: PairMatrixPreferences;
}): PairMatrixComparisonSummary | null {
  const [baseCurrency, quoteCurrency] = params.currencies;
  if (!baseCurrency || !quoteCurrency) return null;
  const factorReads = params.rows
    .map((row) => row.comparison)
    .filter((comparison): comparison is PairMatrixFactorComparison => comparison != null);
  if (factorReads.length === 0) return null;

  const counts = factorReads.reduce<Record<PairMatrixComparisonState, number>>(
    (current, read) => ({ ...current, [read.state]: current[read.state] + 1 }),
    {
      base_leads: 0,
      quote_leads: 0,
      both_supportive: 0,
      both_weak: 0,
      partial_read: 0,
      no_surprise: 0,
      split: 0,
      mixed: 0,
      unclear: 0,
    },
  );
  const baseScoreTotal = factorReads.reduce((sum, read) => sum + (read.base?.score ?? 0), 0);
  const quoteScoreTotal = factorReads.reduce((sum, read) => sum + (read.quote?.score ?? 0), 0);
  const scoredReadCount = factorReads.filter((read) => read.base?.score != null || read.quote?.score != null).length;
  let state: PairMatrixComparisonState = "unclear";

  if (params.preferences.comparisonWinnerMode === "per_factor") {
    state = "mixed";
  } else if (params.preferences.comparisonWinnerMode === "normalized_score") {
    const delta = baseScoreTotal - quoteScoreTotal;
    state = scoredReadCount === 0 ? "unclear" : Math.abs(delta) <= 0.5 ? "split" : delta > 0 ? "base_leads" : "quote_leads";
  } else if (counts.base_leads > counts.quote_leads) {
    state = "base_leads";
  } else if (counts.quote_leads > counts.base_leads) {
    state = "quote_leads";
  } else if (counts.both_supportive > 0 && counts.base_leads === 0 && counts.quote_leads === 0) {
    state = "both_supportive";
  } else if (counts.both_weak > 0 && counts.base_leads === 0 && counts.quote_leads === 0) {
    state = "both_weak";
  } else if (counts.partial_read > 0 && counts.base_leads === 0 && counts.quote_leads === 0) {
    state = "partial_read";
  } else if (counts.no_surprise > 0 && counts.base_leads === 0 && counts.quote_leads === 0) {
    state = "no_surprise";
  } else if (counts.unclear > 0 && counts.base_leads === 0 && counts.quote_leads === 0) {
    state = "unclear";
  } else if (counts.base_leads === counts.quote_leads && counts.base_leads > 0) {
    state = "split";
  } else {
    state = "mixed";
  }

  const modeLabel =
    params.preferences.comparisonMode === "macro_price"
      ? "Macro + price"
      : params.preferences.comparisonMode === "raw_values"
        ? "Raw values"
        : "Macro surprise";
  const winnerModeLabel =
    params.preferences.comparisonWinnerMode === "normalized_score"
      ? "Normalized experiment"
      : params.preferences.comparisonWinnerMode === "per_factor"
        ? "Per-factor only"
        : "Factor vote";
  const totalReadableFactors = factorReads.length;
  const otherVoteCount = totalReadableFactors - counts.base_leads - counts.quote_leads;
  const otherReasonCounts = factorReads.reduce<Record<string, number>>((current, read) => {
    if (read.state === "base_leads" || read.state === "quote_leads") return current;
    const reasons = read.reasonCodes.length > 0 ? read.reasonCodes : [read.state as PairMatrixEvidenceReasonCode | PairMatrixComparisonState];
    reasons.forEach((reason) => {
      const label = reason in counts ? getComparisonStateLabel(reason as PairMatrixComparisonState) : getPairMatrixReasonLabel(reason as PairMatrixEvidenceReasonCode);
      current[label] = (current[label] ?? 0) + 1;
    });
    return current;
  }, {});
  const otherBreakdownLabel = Object.entries(otherReasonCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => `${label} ${count}`)
    .join(" / ");
  const voteLabel =
    state === "base_leads"
      ? `${counts.base_leads}/${totalReadableFactors} factors`
      : state === "quote_leads"
        ? `${counts.quote_leads}/${totalReadableFactors} factors`
        : state === "split"
          ? `${counts.base_leads}-${counts.quote_leads}/${totalReadableFactors}`
          : state === "both_supportive"
            ? `${counts.both_supportive}/${totalReadableFactors} both`
            : state === "both_weak"
              ? `${counts.both_weak}/${totalReadableFactors} weak`
              : state === "partial_read"
                ? `${counts.partial_read}/${totalReadableFactors} partial`
                : state === "no_surprise"
                  ? `${counts.no_surprise}/${totalReadableFactors} no surprise`
              : state === "mixed"
                ? `${counts.base_leads}-${counts.quote_leads}/${totalReadableFactors} mixed`
                : `${counts.unclear}/${totalReadableFactors} unclear`;
  const voteBreakdownLabel = `Base ${counts.base_leads} / Quote ${counts.quote_leads}${
    otherVoteCount > 0 ? ` / Other ${otherVoteCount}` : ""
  }`;

  return {
    state,
    stateLabel: getComparisonStateLabel(state),
    voteLabel,
    voteBreakdownLabel,
    modeLabel,
    winnerModeLabel,
    baseCurrency,
    quoteCurrency,
    baseScoreLabel: `${baseCurrency} ${formatSignedFixed(baseScoreTotal, 1)} pts`,
    quoteScoreLabel: `${quoteCurrency} ${formatSignedFixed(quoteScoreTotal, 1)} pts`,
    detailLabel: `${winnerModeLabel}: ${baseCurrency} ${counts.base_leads}, ${quoteCurrency} ${counts.quote_leads}, both ${counts.both_supportive}, weak ${counts.both_weak}, partial ${counts.partial_read}, no surprise ${counts.no_surprise}, unclear ${counts.unclear}.`,
    otherBreakdownLabel,
    factorReads,
  };
}
