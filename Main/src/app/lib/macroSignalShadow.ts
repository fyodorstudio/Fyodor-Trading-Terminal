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
}

export interface MacroSignalShadowPosition {
  riskDollars: number;
  stopPips: number | null;
  lots: number | null;
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
  if (signal.activationTime != null) return signal.activationTime + signal.expiryCandles * H4_SECONDS;
  return signal.eventTime + (signal.expiryCandles + 1) * H4_SECONDS;
}

/** Sequential, one-position-at-a-time, gross account replay. */
export function buildMacroSignalShadowAccount(
  signals: readonly MacroSignalChartSignal[],
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

  const ordered = [...signals].sort((left, right) => (
    (left.activationTime ?? left.eventTime) - (right.activationTime ?? right.eventTime)
    || left.eventTime - right.eventTime
    || left.id.localeCompare(right.id)
  ));
  for (const signal of ordered) {
    const activationTime = signal.activationTime;
    if (activationTime == null || signal.outcomeStatus === "unevaluable") {
      unevaluable += 1;
      continue;
    }
    if (activationTime < unavailableUntil) {
      skippedOverlap += 1;
      continue;
    }
    unavailableUntil = availableAfter(signal);
    if (signal.outcomeStatus === "ambiguous") {
      ambiguous += 1;
      continue;
    }
    if (signal.outcomeStatus === "pending" || signal.resultR == null) continue;

    const riskDollars = roundMoney(balance * riskFraction);
    balance = roundMoney(balance + riskDollars * signal.resultR);
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
  };
}

export function buildMacroSignalShadowPosition(
  signal: MacroSignalChartSignal,
  balance: number,
  riskPercent: number,
): MacroSignalShadowPosition {
  const riskDollars = roundMoney(Math.max(0, Number.isFinite(balance) ? balance : 0) * (normalizeShadowRiskPercent(riskPercent) / 100));
  const entry = signal.entry;
  const stop = signal.stop;
  if (entry == null || stop == null || entry === stop) return { riskDollars, stopPips: null, lots: null };
  const stopPips = Math.abs(entry - stop) / 0.0001;
  const lots = stopPips > 0 ? riskDollars / (stopPips * 10) : null;
  return { riskDollars, stopPips, lots };
}
