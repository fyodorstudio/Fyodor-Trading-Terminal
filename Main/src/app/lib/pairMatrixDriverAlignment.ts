import { FX_PAIRS, MAJOR_CURRENCY_ORDER, getFxPairByName } from "@/app/config/fxPairs";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { getEventComparison } from "@/app/lib/eventReaction";
import type { MacroFactorDefinition, MacroFactorRow } from "@/app/lib/macroDrivers";
import type { BridgeCandle, CalendarEvent } from "@/app/types";

export type PairMatrixDriverReadMode = "strongest" | "separate";
export type PairMatrixSurpriseSensitivity = "low" | "normal" | "high";
export type PairMatrixSortMode = "factor" | "driver_strength";
export type PairMatrixDisplayDensity = "compact" | "comfortable";
export type PairMatrixAlignmentStatus = "aligned" | "rejected" | "muted" | "unclear";
export type PairMatrixComparisonMode = "macro_surprise" | "macro_price" | "raw_values";
export type PairMatrixWinnerMode = "factor_vote" | "normalized_score" | "per_factor";
export type PairMatrixComparisonState =
  | "base_leads"
  | "quote_leads"
  | "both_supportive"
  | "both_weak"
  | "split"
  | "mixed"
  | "unclear";

export interface PairMatrixPreferences {
  driverReadMode: PairMatrixDriverReadMode;
  surpriseSensitivity: PairMatrixSurpriseSensitivity;
  rowSortMode: PairMatrixSortMode;
  displayDensity: PairMatrixDisplayDensity;
  comparisonMode: PairMatrixComparisonMode;
  comparisonWinnerMode: PairMatrixWinnerMode;
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
  expectedDirectionLabel: string;
  actualDirectionLabel: string;
  strengthScore: number;
  reason: string;
}

export interface PairMatrixCurrencyCell {
  currency: string;
  latestEvent: CalendarEvent | null;
  nextEvent: CalendarEvent | null;
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
  actualLabel: string;
  comparisonLabel: string;
  basisLabel: string;
  rawSurpriseLabel: string;
  relativeSurpriseLabel: string;
  score: number | null;
  scoreLabel: string;
  acceptanceLabel: string;
  formulaLabel: string;
}

export interface PairMatrixFactorComparison {
  factorId: string;
  factorLabel: string;
  state: PairMatrixComparisonState;
  stateLabel: string;
  base: PairMatrixComparisonSide | null;
  quote: PairMatrixComparisonSide | null;
  detailLabel: string;
}

export interface PairMatrixComparisonSummary {
  state: PairMatrixComparisonState;
  stateLabel: string;
  modeLabel: string;
  winnerModeLabel: string;
  baseCurrency: string | null;
  quoteCurrency: string | null;
  baseScoreLabel: string;
  quoteScoreLabel: string;
  detailLabel: string;
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
  if (value == null) return "relative N/A";
  return `${formatSignedFixed(value, 1, "%")} rel`;
}

function formatSignedFixed(value: number, decimals: number, suffix = ""): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}${suffix}`;
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
  if (!read) return { multiplier: 1, label: "acceptance N/A" };
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

function makeUnclearRead(event: CalendarEvent | null, currency: string, reason: string): PairMatrixAlignmentRead {
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
    expectedDirectionLabel: "-",
    actualDirectionLabel: "-",
    strengthScore: 0,
    reason,
  };
}

function buildComparisonSide(
  cell: PairMatrixCurrencyCell | null,
  mode: PairMatrixComparisonMode,
): PairMatrixComparisonSide | null {
  const event = cell?.latestEvent ?? null;
  if (!event) return null;
  const comparison = getEventComparison(event);
  const actualLabel = getEventValueDisplay(event.actual, event.title).display;
  if (!comparison) {
    return {
      currency: event.currency,
      eventTitle: event.title,
      actualLabel,
      comparisonLabel: "-",
      basisLabel: "No numeric comparison",
      rawSurpriseLabel: "-",
      relativeSurpriseLabel: "relative N/A",
      score: null,
      scoreLabel: "score N/A",
      acceptanceLabel: "acceptance N/A",
      formulaLabel: "Actual/forecast/previous values are not numeric enough to compare.",
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
  };
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
    state = baseScore > 0 ? "base_leads" : baseScore < 0 ? "both_weak" : "unclear";
  } else if (baseScore == null && quoteScore != null) {
    state = quoteScore > 0 ? "quote_leads" : quoteScore < 0 ? "both_weak" : "unclear";
  } else if (baseScore != null && quoteScore != null) {
    const delta = baseScore - quoteScore;
    if (baseScore > 0 && quoteScore > 0 && Math.abs(delta) <= closeThreshold) state = "both_supportive";
    else if (baseScore < 0 && quoteScore < 0 && Math.abs(delta) <= closeThreshold) state = "both_weak";
    else if (Math.abs(delta) <= closeThreshold) state = "split";
    else state = delta > 0 ? "base_leads" : "quote_leads";
  }

  const stateLabel = getComparisonStateLabel(state);
  return {
    factorId: factor.id,
    factorLabel: factor.label,
    state,
    stateLabel,
    base,
    quote,
    detailLabel: `${base?.currency ?? "Base"} ${base?.scoreLabel ?? "N/A"} / ${quote?.currency ?? "Quote"} ${quote?.scoreLabel ?? "N/A"}`,
  };
}

export function getComparisonStateLabel(state: PairMatrixComparisonState): string {
  if (state === "base_leads") return "Base leads";
  if (state === "quote_leads") return "Quote leads";
  if (state === "both_supportive") return "Both supportive";
  if (state === "both_weak") return "Both weak";
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
}): PairMatrixAlignmentRead {
  const event = params.event;
  if (!event) return makeUnclearRead(null, "", "No loaded release for this factor.");

  const comparison = getEventComparison(event);
  if (!comparison) return makeUnclearRead(event, event.currency, "Actual/forecast/previous values are not numeric enough to compare.");

  const instrument = resolveInstrumentContext(params.selectedSymbol);
  if (!instrument) return makeUnclearRead(event, event.currency, "This chart symbol cannot be mapped to base/quote direction.");

  const currencySupportDirection = inferCurrencySupportDirection(event, comparison.surprise);
  const expectedPairDirection =
    currencySupportDirection === 0 ? null : getExpectedPairDirection(event.currency, currencySupportDirection, instrument);
  if (!expectedPairDirection) {
    return makeUnclearRead(event, event.currency, `${event.currency} is not a mapped base or quote driver for ${params.selectedSymbol}.`);
  }

  if (params.visibleCandles.length === 0 || params.cursorChartTime == null) {
    return makeUnclearRead(event, event.currency, "Loaded candles are required to compare release close against cursor close.");
  }

  const releaseChartTime = event.time + params.sourceTimeOffsetSeconds;
  const releaseCandle = getCandleAtOrAfter(params.visibleCandles, releaseChartTime);
  const cursorCandle = getCandleAtOrBefore(params.visibleCandles, params.cursorChartTime);
  if (!releaseCandle || !cursorCandle || cursorCandle.time < releaseCandle.time) {
    return makeUnclearRead(event, event.currency, "No loaded candle window from the release close to the cursor close.");
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
  const expectedDirectionLabel = expectedPairDirection > 0 ? "pair up" : "pair down";
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
    expectedDirectionLabel,
    actualDirectionLabel,
    strengthScore: Math.abs(pips) + Math.abs(percentMove),
    reason:
      Math.abs(comparison.surprise) < surpriseThreshold
        ? `${event.currency} surprise was below the selected sensitivity; price moved ${pipsLabel} / ${percentLabel}.`
        : `${event.currency} data implied ${expectedDirectionLabel}; ${actualDirectionLabel} by ${pipsLabel} / ${percentLabel}.`,
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
      return {
        currency,
        latestEvent: row?.latestEvent ?? null,
        nextEvent: row?.nextEvent ?? null,
        alignment: derivePairMatrixAlignment({
          event: row?.latestEvent ?? null,
          selectedSymbol: params.selectedSymbol,
          visibleCandles: params.visibleCandles,
          cursorChartTime: params.cursorChartTime,
          sourceTimeOffsetSeconds: params.sourceTimeOffsetSeconds,
          sensitivity: params.preferences.surpriseSensitivity,
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
      split: 0,
      mixed: 0,
      unclear: 0,
    },
  );
  const baseScoreTotal = factorReads.reduce((sum, read) => sum + (read.base?.score ?? 0), 0);
  const quoteScoreTotal = factorReads.reduce((sum, read) => sum + (read.quote?.score ?? 0), 0);
  let state: PairMatrixComparisonState = "unclear";

  if (params.preferences.comparisonWinnerMode === "per_factor") {
    state = "mixed";
  } else if (params.preferences.comparisonWinnerMode === "normalized_score") {
    const delta = baseScoreTotal - quoteScoreTotal;
    state = Math.abs(delta) <= 0.5 ? "split" : delta > 0 ? "base_leads" : "quote_leads";
  } else if (counts.base_leads > counts.quote_leads) {
    state = "base_leads";
  } else if (counts.quote_leads > counts.base_leads) {
    state = "quote_leads";
  } else if (counts.both_supportive > 0 && counts.base_leads === 0 && counts.quote_leads === 0) {
    state = "both_supportive";
  } else if (counts.both_weak > 0 && counts.base_leads === 0 && counts.quote_leads === 0) {
    state = "both_weak";
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

  return {
    state,
    stateLabel: getComparisonStateLabel(state),
    modeLabel,
    winnerModeLabel,
    baseCurrency,
    quoteCurrency,
    baseScoreLabel: `${baseCurrency} ${formatSignedFixed(baseScoreTotal, 1)} pts`,
    quoteScoreLabel: `${quoteCurrency} ${formatSignedFixed(quoteScoreTotal, 1)} pts`,
    detailLabel: `${winnerModeLabel}: ${baseCurrency} ${counts.base_leads}, ${quoteCurrency} ${counts.quote_leads}, both ${counts.both_supportive}, weak ${counts.both_weak}, unclear ${counts.unclear}.`,
    factorReads,
  };
}
