import type { MacroSignalChartSignal } from "@/app/types";

export const DEFAULT_SHADOW_STARTING_BALANCE = 1_000;
export const DEFAULT_SHADOW_RISK_PERCENT = 0.5;
export const MIN_SHADOW_STARTING_BALANCE = 1;
export const MAX_SHADOW_STARTING_BALANCE = 1_000_000_000;
export const MIN_SHADOW_RISK_PERCENT = 0.01;
export const MAX_SHADOW_RISK_PERCENT = 100;
const H4_SECONDS = 4 * 60 * 60;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface MacroSignalShadowSettings {
  startingBalance: number;
  riskPercent: number;
}

export interface MacroSignalShadowAccount {
  startingBalance: number;
  balance: number;
  profit: number;
  returnPercent: number;
  maxDrawdownPercent: number;
  takenTrades: number;
  targetHits: number;
  stopHits: number;
  expired: number;
  ambiguous: number;
  unevaluable: number;
  skippedOverlap: number;
  skippedConflict: number;
  skippedSimultaneousAlternative: number;
  drawdownBasis: "intratrade_mae_when_available";
}

export type MacroSignalShadowAccountSignal = MacroSignalChartSignal & {
  /** Required when replaying more than one market so pair-local conflicts stay pair-local. */
  market?: string;
};

export interface MacroSignalShadowPosition {
  riskDollars: number;
  stopPips: number | null;
  lots: number | null;
  sizingNote: string;
}

export function normalizeShadowStartingBalance(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_SHADOW_STARTING_BALANCE, Math.max(MIN_SHADOW_STARTING_BALANCE, Math.round(value * 100) / 100))
    : DEFAULT_SHADOW_STARTING_BALANCE;
}

export function normalizeShadowRiskPercent(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_SHADOW_RISK_PERCENT, Math.max(MIN_SHADOW_RISK_PERCENT, Math.round(value * 100) / 100))
    : DEFAULT_SHADOW_RISK_PERCENT;
}

function availableAfter(signal: MacroSignalChartSignal): number {
  if (signal.exitTime != null) return signal.exitTime;
  if (signal.expiryTime != null) return signal.expiryTime;
  if (signal.activationTime != null) return signal.activationTime + signal.expiryCandles * H4_SECONDS;
  return signal.eventTime + (signal.expiryCandles + 1) * H4_SECONDS;
}

/** Sequential, one-position-at-a-time, gross account replay. */
export function buildMacroSignalShadowAccount(
  signals: readonly MacroSignalShadowAccountSignal[],
  settings: MacroSignalShadowSettings,
): MacroSignalShadowAccount {
  const startingBalance = normalizeShadowStartingBalance(settings.startingBalance);
  const riskFraction = normalizeShadowRiskPercent(settings.riskPercent) / 100;
  let balance = startingBalance;
  let peak = startingBalance;
  let maxDrawdownPercent = 0;
  let unavailableUntil = Number.NEGATIVE_INFINITY;
  let takenTrades = 0;
  let targetHits = 0;
  let stopHits = 0;
  let expired = 0;
  let ambiguous = 0;
  let unevaluable = 0;
  let skippedOverlap = 0;
  let skippedConflict = 0;
  let skippedSimultaneousAlternative = 0;

  const ordered = [...signals].sort((left, right) => (
    (left.activationTime ?? left.eventTime) - (right.activationTime ?? right.eventTime)
    || left.eventTime - right.eventTime
    || left.id.localeCompare(right.id)
  ));
  for (let index = 0; index < ordered.length;) {
    const activation = ordered[index].activationTime ?? ordered[index].eventTime;
    const simultaneous: MacroSignalShadowAccountSignal[] = [];
    while (index < ordered.length && (ordered[index].activationTime ?? ordered[index].eventTime) === activation) {
      simultaneous.push(ordered[index]);
      index += 1;
    }
    unevaluable += simultaneous.filter((signal) => signal.outcomeStatus === "unevaluable" || signal.activationTime == null).length;
    ambiguous += simultaneous.filter((signal) => signal.outcomeStatus === "ambiguous").length;
    const evaluable = simultaneous.filter((signal) => (
      signal.activationTime != null
      && signal.resultR != null
      && ["target_hit", "stop_hit", "expired"].includes(signal.outcomeStatus ?? "")
    ));
    if (!evaluable.length) continue;
    if (activation < unavailableUntil) {
      skippedOverlap += evaluable.length;
      continue;
    }
    const byMarket = new Map<string, MacroSignalShadowAccountSignal[]>();
    for (const signal of evaluable) {
      const market = signal.market ?? "__single_market__";
      const rows = byMarket.get(market) ?? [];
      rows.push(signal);
      byMarket.set(market, rows);
    }
    const nonConflicting = [...byMarket.entries()].flatMap(([, rows]) => {
      if (new Set(rows.map((signal) => signal.direction)).size <= 1) return rows;
      skippedConflict += rows.length;
      return [];
    });
    if (!nonConflicting.length) continue;
    const signal = [...nonConflicting].sort((left, right) => (
      (left.market ?? "").localeCompare(right.market ?? "")
      || left.patternId.localeCompare(right.patternId)
      || left.id.localeCompare(right.id)
    ))[0];
    skippedSimultaneousAlternative += nonConflicting.length - 1;
    const activationTime = signal.activationTime;
    if (activationTime == null) continue;
    unavailableUntil = availableAfter(signal);
    const riskDollars = roundMoney(balance * riskFraction);
    if (signal.maximumAdverseR != null) {
      const intratradeEquity = balance - riskDollars * Math.max(0, signal.maximumAdverseR);
      maxDrawdownPercent = Math.max(maxDrawdownPercent, peak > 0 ? ((peak - intratradeEquity) / peak) * 100 : 0);
    }
    const resultR = signal.resultR;
    if (resultR == null) continue;
    balance = roundMoney(balance + riskDollars * resultR);
    takenTrades += 1;
    if (signal.outcomeStatus === "target_hit") targetHits += 1;
    else if (signal.outcomeStatus === "stop_hit") stopHits += 1;
    else if (signal.outcomeStatus === "expired") expired += 1;
    peak = Math.max(peak, balance);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, peak > 0 ? ((peak - balance) / peak) * 100 : 0);
  }

  return {
    startingBalance,
    balance,
    profit: roundMoney(balance - startingBalance),
    returnPercent: ((balance - startingBalance) / startingBalance) * 100,
    maxDrawdownPercent,
    takenTrades,
    targetHits,
    stopHits,
    expired,
    ambiguous,
    unevaluable,
    skippedOverlap,
    skippedConflict,
    skippedSimultaneousAlternative,
    drawdownBasis: "intratrade_mae_when_available",
  };
}

export function buildMacroSignalShadowPosition(
  signal: MacroSignalChartSignal,
  balance: number,
  riskPercent: number,
  symbol = "EURUSD",
): MacroSignalShadowPosition {
  const riskDollars = roundMoney(Math.max(0, Number.isFinite(balance) ? balance : 0) * (normalizeShadowRiskPercent(riskPercent) / 100));
  const entry = signal.entry;
  const stop = signal.stop;
  const normalizedSymbol = symbol.toUpperCase();
  const isJpyQuote = normalizedSymbol.endsWith("JPY");
  const pipSize = isJpyQuote ? 0.01 : 0.0001;
  const usdQuoted = normalizedSymbol.endsWith("USD");
  const usdBased = normalizedSymbol.startsWith("USD");
  const sizingNote = usdQuoted
    ? `Indicative USD-account sizing at $10 per pip per standard ${normalizedSymbol} lot; MT5 margin and broker volume limits are not applied.`
    : usdBased
      ? `Indicative USD-account sizing converts ${normalizedSymbol}'s quote-currency pip value at the entry price; MT5 margin and broker volume limits are not applied.`
      : "Position size is unavailable because this USD-account estimate does not have a live quote-to-USD conversion.";
  if (entry == null || stop == null || entry === stop) return { riskDollars, stopPips: null, lots: null, sizingNote };
  const stopPips = Math.abs(entry - stop) / pipSize;
  const pipValueUsd = usdQuoted ? 10 : usdBased ? (pipSize * 100_000) / entry : null;
  const lots = stopPips > 0 && pipValueUsd != null ? riskDollars / (stopPips * pipValueUsd) : null;
  return { riskDollars, stopPips, lots, sizingNote };
}
