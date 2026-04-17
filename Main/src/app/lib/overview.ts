import { getFxPairByName } from "@/app/config/fxPairs";
import { deriveEventQualitySummary } from "@/app/lib/eventQuality";
import { parseNumericValue } from "@/app/lib/format";
import { deriveStrengthMeterResult, getStrengthSummaryForPair } from "@/app/lib/strengthMeter";
import type { BridgeCandle, BridgeStatus, CalendarEvent, CentralBankSnapshot, FxPairDefinition, MarketStatusResponse, TabId } from "@/app/types";
import type { TrustState, TrustTone } from "@/app/lib/status";

export interface OverviewEvent extends CalendarEvent {
  relevant: boolean;
  relevance: "base" | "quote" | "context";
}

export interface MacroSummary {
  title: string;
  detail: string;
  unresolved: boolean;
  favoredCurrency: string | null;
  rateGap: number | null;
  inflationGap: number | null;
  alignment: "aligned" | "mixed" | "unresolved";
}

export interface StrengthSummary {
  title: string;
  detail: string;
  unresolved: boolean;
  strongerCurrency: string | null;
  weakerCurrency: string | null;
  scoreGap: number | null;
  decisive: boolean;
}

export interface VerdictCard {
  label: string;
  detail: string;
  tone: TrustTone;
}

export interface EventSensitivitySummary {
  label: "Clear" | "Event-sensitive" | "High-risk soon";
  detail: string;
  tone: TrustTone;
  nextRelevantEvent: CalendarEvent | null;
}

export interface OverviewPipelineStatus {
  percent: number;
  tone: TrustTone;
  label: string;
  detail: string;
  factors: string[];
  explanation: string;
  weights: Array<{
    label: string;
    earned: number;
    max: number;
    state: string;
  }>;
}

export type OverviewPairSortMode = "favorites" | "volatility" | "alphabetical";
export type SortDirection = "asc" | "desc";

export interface EventRadarSummary {
  relevantCount: number;
  contextCount: number;
  nextRiskDetail: string;
}

export interface TrustInspectorSummary {
  title: string;
  supportingInputs: string[];
  limitingInputs: string[];
  affects: string[];
}

export interface SpecialistSummaryCard {
  id: "strength-meter" | "dashboard" | "event-tools";
  title: string;
  tab: TabId;
  summary: string;
  metrics: string[];
}

type PairBias = "base" | "quote" | "mixed" | "unresolved";
type WinningSide = "base" | "quote" | "conflicted" | "unresolved";
type ActionLabel = "Focus now" | "Study" | "Monitor" | "Avoid for now";

export interface PriceAlignmentSummary {
  direction: PairBias;
  label: string;
  detail: string;
  d1Bias: PairBias;
  h1Bias: PairBias;
}

export interface WinningNowSummary {
  winner: WinningSide;
  winnerLabel: string;
  conviction: "high" | "moderate" | "low";
  tone: TrustTone;
  reasons: string[];
  risks: string[];
  summary: string;
  actionLabel: ActionLabel;
}

export interface PairOpportunitySummary {
  pair: string;
  winner: WinningNowSummary["winner"];
  winnerLabel: string;
  score: number;
  label: WinningNowSummary["actionLabel"];
  summary: string;
  blockedBy: string[];
  eventLabel: EventSensitivitySummary["label"];
  atr14D: number | null;
  breakdown: Array<{ label: string; earned: number; max: number }>;
}

function formatGap(value: number | null): string {
  if (value == null) return "Unresolved";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getPairCurrencies(reviewSymbol: string): [string, string] {
  return [reviewSymbol.slice(0, 3), reviewSymbol.slice(3, 6)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getEma(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const initial = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const result: number[] = [initial];
  for (let index = period; index < values.length; index += 1) {
    result.push((values[index] - result[result.length - 1]) * multiplier + result[result.length - 1]);
  }
  return result;
}

function getTimeframeBias(candles: BridgeCandle[]): PairBias {
  if (candles.length < 24) return "unresolved";
  const closes = candles.map((candle) => candle.close);
  const ema20 = getEma(closes, 20);
  if (ema20.length < 3) return "unresolved";

  const currentClose = closes[closes.length - 1];
  const priorClose = closes[closes.length - 4];
  const currentEma = ema20[ema20.length - 1];
  const previousEma = ema20[ema20.length - 3];

  const aboveEma = currentClose > currentEma;
  const emaRising = currentEma > previousEma;
  const recentCloseChange = currentClose - priorClose;

  if (aboveEma && emaRising && recentCloseChange > 0) return "base";
  if (!aboveEma && !emaRising && recentCloseChange < 0) return "quote";
  return "mixed";
}

function getDirectionLabel(direction: PairBias, pair: FxPairDefinition): string {
  switch (direction) {
    case "base":
      return `${pair.base} price confirmation`;
    case "quote":
      return `${pair.quote} price confirmation`;
    case "mixed":
      return "Mixed price structure";
    default:
      return "Price structure unresolved";
  }
}

function getActionRank(label: ActionLabel): number {
  switch (label) {
    case "Focus now":
      return 4;
    case "Study":
      return 3;
    case "Monitor":
      return 2;
    default:
      return 1;
  }
}

function getScoreLabel(score: number): ActionLabel {
  if (score >= 80) return "Focus now";
  if (score >= 60) return "Study";
  if (score >= 40) return "Monitor";
  return "Avoid for now";
}

function getWinnerTone(winner: WinningSide, conviction: WinningNowSummary["conviction"]): TrustTone {
  if (winner === "base" || winner === "quote") {
    return conviction === "high" ? "good" : "warning";
  }
  return winner === "conflicted" ? "danger" : "warning";
}

function formatActionSummary(pair: string, label: ActionLabel, winnerLabel: string): string {
  if (label === "Focus now") return `${pair} is one of the cleanest active candidates right now with ${winnerLabel.toLowerCase()}.`;
  if (label === "Study") return `${pair} is usable now, but still needs chart confirmation before routing.`;
  if (label === "Monitor") return `${pair} is directionally interesting, but timing or data quality still limits it.`;
  return `${pair} should stay low priority on the current evidence.`;
}

function getWinnerLabelFromSide(winner: WinningSide, pair: FxPairDefinition): string {
  switch (winner) {
    case "base":
      return `${pair.base} is winning now`;
    case "quote":
      return `${pair.quote} is winning now`;
    case "conflicted":
      return "Battle is conflicted";
    default:
      return "Winner unresolved";
  }
}

export function getPriceAlignment(
  reviewSymbol: string,
  d1Candles: BridgeCandle[],
  h1Candles: BridgeCandle[],
): PriceAlignmentSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) {
    return {
      direction: "unresolved",
      label: "Unresolved",
      detail: "Pair mapping is unavailable for price confirmation.",
      d1Bias: "unresolved",
      h1Bias: "unresolved",
    };
  }

  const d1Bias = getTimeframeBias(d1Candles);
  const h1Bias = getTimeframeBias(h1Candles);

  if (d1Bias === "unresolved" || h1Bias === "unresolved") {
    return {
      direction: "unresolved",
      label: "Unresolved",
      detail: "Candle depth is incomplete for at least one timeframe, so price confirmation stays unresolved.",
      d1Bias,
      h1Bias,
    };
  }

  if (d1Bias === h1Bias && (d1Bias === "base" || d1Bias === "quote")) {
    const side = d1Bias === "base" ? pair.base : pair.quote;
    return {
      direction: d1Bias,
      label: "Aligned",
      detail: `D1 and H1 both keep confirming ${side} through EMA-20 structure and recent close direction.`,
      d1Bias,
      h1Bias,
    };
  }

  if (d1Bias !== h1Bias) {
    return {
      direction: "mixed",
      label: "Short-term countertrend",
      detail: `D1 favors ${getDirectionLabel(d1Bias, pair).toLowerCase()}, while H1 is pulling the other way.`,
      d1Bias,
      h1Bias,
    };
  }

  return {
    direction: "mixed",
    label: "Mixed",
    detail: "Price structure is active but does not cleanly confirm one side across D1 and H1.",
    d1Bias,
    h1Bias,
  };
}

export function getWhoIsWinningNow(
  reviewSymbol: string,
  trustState: TrustState,
  macroSummary: MacroSummary,
  strengthSummary: StrengthSummary,
  eventSensitivity: EventSensitivitySummary,
  marketStatus: MarketStatusResponse | null,
  atr14D: number | null | undefined,
  atr14H: number | null | undefined,
  d1Candles: BridgeCandle[],
  h1Candles: BridgeCandle[],
): WinningNowSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) {
    return {
      winner: "unresolved",
      winnerLabel: "Winner unresolved",
      conviction: "low",
      tone: "warning",
      reasons: ["Pair mapping is unavailable."],
      risks: ["Symbol context could not be resolved."],
      summary: `The app cannot resolve a winning side for ${reviewSymbol}.`,
      actionLabel: "Avoid for now",
    };
  }

  const priceAlignment = getPriceAlignment(reviewSymbol, d1Candles, h1Candles);
  const reasons: string[] = [];
  const risks: string[] = [];
  let winner: WinningSide = "unresolved";
  let conviction: WinningNowSummary["conviction"] = "low";
  let actionLabel: ActionLabel = "Monitor";

  if (macroSummary.unresolved || strengthSummary.unresolved) {
    winner = "unresolved";
    reasons.push("Macro or strength inputs are still unresolved.");
  } else if (macroSummary.alignment === "aligned" && macroSummary.favoredCurrency === strengthSummary.strongerCurrency) {
    winner = macroSummary.favoredCurrency === pair.base ? "base" : "quote";
    conviction = "moderate";
    reasons.push(`${macroSummary.favoredCurrency} has macro and strength alignment.`);
  } else if (macroSummary.alignment === "aligned" && macroSummary.favoredCurrency !== strengthSummary.strongerCurrency) {
    winner = "conflicted";
    reasons.push(`Macro favors ${macroSummary.favoredCurrency}, but strength favors ${strengthSummary.strongerCurrency}.`);
  } else {
    winner = "conflicted";
    reasons.push("Rates and inflation do not form a clean same-side macro picture.");
  }

  if (priceAlignment.direction === "base" || priceAlignment.direction === "quote") {
    const priceCurrency = priceAlignment.direction === "base" ? pair.base : pair.quote;
    reasons.push(`Price structure still confirms ${priceCurrency} on D1 and H1.`);
    if (winner === priceAlignment.direction) {
      conviction = winner === "conflicted" ? "low" : "high";
    } else if (winner === "conflicted") {
      reasons.push(`Price currently leans toward ${priceCurrency}, but the core inputs still disagree.`);
    } else if (winner !== "unresolved") {
      risks.push(`Price confirmation is leaning toward ${priceCurrency}, not the current macro winner.`);
      conviction = "low";
    }
  } else if (priceAlignment.direction === "mixed") {
    risks.push("D1 and H1 price structure are not aligned.");
    if (conviction === "high") conviction = "moderate";
  } else {
    risks.push("Price confirmation is unresolved.");
    if (conviction === "high") conviction = "moderate";
  }

  if (strengthSummary.scoreGap != null) {
    reasons.push(`Board strength gap is ${strengthSummary.scoreGap.toFixed(1)} points${strengthSummary.decisive ? " and clear." : "."}`);
  }

  if (eventSensitivity.label !== "Clear") {
    risks.push(eventSensitivity.detail);
    if (conviction === "high") conviction = "moderate";
  }

  if (trustState.verdict !== "yes") {
    risks.push(`Trust state is ${trustState.verdictLabel.toLowerCase()}.`);
    conviction = "low";
  }

  if (!marketStatus || marketStatus.session_state === "unavailable") {
    risks.push("Selected symbol context is unavailable.");
    conviction = "low";
  }

  if (winner === "base" || winner === "quote") {
    if (
      conviction === "high" &&
      trustState.verdict === "yes" &&
      eventSensitivity.label === "Clear" &&
      atr14D != null &&
      atr14D >= 50 &&
      atr14H != null
    ) {
      actionLabel = "Focus now";
    } else if (trustState.verdict === "no") {
      actionLabel = "Avoid for now";
    } else if (eventSensitivity.label === "High-risk soon") {
      actionLabel = "Monitor";
    } else if (atr14D != null && atr14D < 45 && !strengthSummary.decisive) {
      actionLabel = "Avoid for now";
    } else if (conviction === "high" || conviction === "moderate") {
      actionLabel = "Study";
    } else {
      actionLabel = "Monitor";
    }
  } else if (winner === "conflicted") {
    actionLabel = eventSensitivity.label === "High-risk soon" ? "Avoid for now" : "Monitor";
  } else {
    actionLabel = trustState.verdict === "no" ? "Avoid for now" : "Monitor";
  }

  if (atr14D != null && atr14D < 45 && !strengthSummary.decisive) {
    risks.push(`${reviewSymbol} is currently quiet for routing with only ${atr14D} D1 ATR pips.`);
  }

  if (atr14H == null) {
    risks.push("H1 volatility context is unresolved.");
  }

  const winnerLabel = getWinnerLabelFromSide(winner, pair);
  return {
    winner,
    winnerLabel,
    conviction,
    tone: getWinnerTone(winner, conviction),
    reasons: reasons.slice(0, 3),
    risks: risks.slice(0, 3),
    summary:
      winner === "base" || winner === "quote"
        ? `${winner === "base" ? pair.base : pair.quote} currently has the cleaner edge in ${reviewSymbol}.`
        : winner === "conflicted"
          ? `${reviewSymbol} has active directional tension across the current inputs.`
          : `${reviewSymbol} does not have enough aligned evidence yet to name a winner.`,
    actionLabel,
  };
}

export function getPairOpportunitySummary(
  reviewSymbol: string,
  trustState: TrustState,
  snapshots: CentralBankSnapshot[],
  events: CalendarEvent[],
  candleMap: Partial<Record<string, { d1: BridgeCandle[]; h4: BridgeCandle[] }>>,
  marketStatus: MarketStatusResponse | null,
  atr14D: number | null | undefined,
  atr14H: number | null | undefined,
  d1Candles: BridgeCandle[],
  h1Candles: BridgeCandle[],
  nowUnix: number,
): PairOpportunitySummary {
  const macroSummary = getMacroSummary(reviewSymbol, snapshots);
  const strengthSummary = getStrengthDifferentialSummary(reviewSymbol, snapshots, events, candleMap, nowUnix);
  const eventSensitivity = getEventSensitivity(events, reviewSymbol, nowUnix);
  const priceAlignment = getPriceAlignment(reviewSymbol, d1Candles, h1Candles);
  const winningNow = getWhoIsWinningNow(
    reviewSymbol,
    trustState,
    macroSummary,
    strengthSummary,
    eventSensitivity,
    marketStatus,
    atr14D,
    atr14H,
    d1Candles,
    h1Candles,
  );

  let directionalClarity = 0;
  if (!macroSummary.unresolved && !strengthSummary.unresolved && macroSummary.alignment === "aligned" && macroSummary.favoredCurrency === strengthSummary.strongerCurrency) {
    directionalClarity = strengthSummary.decisive ? 35 : 28;
  } else if (!macroSummary.unresolved && !strengthSummary.unresolved && macroSummary.alignment !== "unresolved") {
    directionalClarity = 12;
  }

  let priceConfirmation = 0;
  if (priceAlignment.direction === winningNow.winner) {
    priceConfirmation = 25;
  } else if (priceAlignment.direction === "mixed") {
    priceConfirmation = 10;
  } else if (priceAlignment.direction !== "unresolved") {
    priceConfirmation = 6;
  }

  let tradeability = 0;
  if (atr14D != null && atr14D >= 50 && atr14H != null) {
    tradeability = 20;
  } else if (atr14D != null && atr14D >= 45) {
    tradeability = 14;
  } else if (atr14D != null && atr14D < 45 && !strengthSummary.decisive) {
    tradeability = 4;
  } else if (atr14D != null) {
    tradeability = 8;
  }

  let eventSafety = 15;
  if (eventSensitivity.label === "High-risk soon") eventSafety = 0;
  else if (eventSensitivity.label === "Event-sensitive") eventSafety = 7;

  let trustQuality = trustState.verdict === "yes" ? 5 : trustState.verdict === "limited" ? 2 : 0;
  if (!marketStatus || marketStatus.session_state === "unavailable") {
    tradeability = Math.max(0, tradeability - 6);
  }

  let score = directionalClarity + priceConfirmation + tradeability + eventSafety + trustQuality;
  const blockedBy: string[] = [];
  let label = getScoreLabel(score);

  if (trustState.verdict === "no") {
    blockedBy.push("Trust state is degraded.");
    label = "Avoid for now";
  }
  if (eventSensitivity.label === "High-risk soon") {
    blockedBy.push("A relevant high-impact event is too close.");
    if (getActionRank(label) > getActionRank("Monitor")) label = "Monitor";
  }
  if (macroSummary.unresolved || strengthSummary.unresolved) {
    blockedBy.push("Macro or strength inputs are unresolved.");
    if (getActionRank(label) > getActionRank("Monitor")) label = "Monitor";
  }
  if (!marketStatus || marketStatus.session_state === "unavailable") {
    blockedBy.push("Selected market session context is unavailable.");
    if (getActionRank(label) > getActionRank("Monitor")) label = "Monitor";
  }
  if (atr14D != null && atr14D < 45 && !strengthSummary.decisive) {
    blockedBy.push("Volatility is too quiet for a clean route.");
  }

  if (label === "Avoid for now" && score > 39) score = 39;
  if (label === "Monitor") score = clamp(score, 40, 59);
  if (label === "Study") score = clamp(score, 60, 79);
  if (label === "Focus now") score = clamp(score, 80, 100);

  return {
    pair: reviewSymbol,
    winner: winningNow.winner,
    winnerLabel: winningNow.winnerLabel,
    score,
    label,
    summary: blockedBy.length > 0 ? `${formatActionSummary(reviewSymbol, label, winningNow.winnerLabel)} ${blockedBy[0]}` : formatActionSummary(reviewSymbol, label, winningNow.winnerLabel),
    blockedBy,
    eventLabel: eventSensitivity.label,
    atr14D: atr14D ?? null,
    breakdown: [
      { label: "Directional clarity", earned: directionalClarity, max: 35 },
      { label: "Price confirmation", earned: priceConfirmation, max: 25 },
      { label: "Tradeability", earned: tradeability, max: 20 },
      { label: "Event safety", earned: eventSafety, max: 15 },
      { label: "Trust quality", earned: trustQuality, max: 5 },
    ],
  };
}

export function getTopEvents(
  events: CalendarEvent[],
  reviewSymbol: string,
  nowUnix: number,
): OverviewEvent[] {
  const symbolCurrencies = getPairCurrencies(reviewSymbol);

  return events
    .filter((event) => event.impact === "high" && event.time >= nowUnix)
    .sort((a, b) => {
      const aRelevant = symbolCurrencies.includes(a.currency);
      const bRelevant = symbolCurrencies.includes(b.currency);
      if (aRelevant !== bRelevant) return aRelevant ? -1 : 1;
      return a.time - b.time;
    })
    .slice(0, 4)
    .map((event) => ({
      ...event,
      relevant: symbolCurrencies.includes(event.currency),
      relevance:
        event.currency === symbolCurrencies[0]
          ? "base"
          : event.currency === symbolCurrencies[1]
            ? "quote"
            : "context",
    }));
}

export function getEventRadarSummary(
  reviewSymbol: string,
  topEvents: OverviewEvent[],
  eventSensitivity: EventSensitivitySummary,
): EventRadarSummary {
  const relevantCount = topEvents.filter((event) => event.relevant).length;
  const contextCount = topEvents.length - relevantCount;

  if (eventSensitivity.nextRelevantEvent) {
    return {
      relevantCount,
      contextCount,
      nextRiskDetail: `${eventSensitivity.nextRelevantEvent.currency} risk is the nearest timing check for ${reviewSymbol}.`,
    };
  }

  return {
    relevantCount,
    contextCount,
    nextRiskDetail: `No immediate pair-relevant high-impact timing risk is active for ${reviewSymbol}.`,
  };
}

export function getMacroSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): MacroSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) {
    return {
      title: "Macro data incomplete.",
      detail: "Symbol is not mapped in the current FX pair set.",
      unresolved: true,
      favoredCurrency: null,
      rateGap: null,
      inflationGap: null,
      alignment: "unresolved",
    };
  }

  const baseSnapshot = snapshots.find((item) => item.currency === pair.base) ?? null;
  const quoteSnapshot = snapshots.find((item) => item.currency === pair.quote) ?? null;

  if (!baseSnapshot || !quoteSnapshot) {
    return {
      title: `Macro data incomplete for ${reviewSymbol}.`,
      detail: "Missing central-bank snapshots for one or both currencies.",
      unresolved: true,
      favoredCurrency: null,
      rateGap: null,
      inflationGap: null,
      alignment: "unresolved",
    };
  }

  const baseRate = parseNumericValue(baseSnapshot.currentPolicyRate ?? "");
  const quoteRate = parseNumericValue(quoteSnapshot.currentPolicyRate ?? "");
  const baseInflation = parseNumericValue(baseSnapshot.currentInflationRate ?? "");
  const quoteInflation = parseNumericValue(quoteSnapshot.currentInflationRate ?? "");
  const rateGap = baseRate != null && quoteRate != null ? baseRate - quoteRate : null;
  const inflationGap = baseInflation != null && quoteInflation != null ? baseInflation - quoteInflation : null;

  if (baseSnapshot.status !== "ok" || quoteSnapshot.status !== "ok" || rateGap == null || inflationGap == null) {
    return {
      title: `Macro data needs verification for ${reviewSymbol}.`,
      detail: "At least one rate or inflation input is partial, missing, or unresolved.",
      unresolved: true,
      favoredCurrency: null,
      rateGap,
      inflationGap,
      alignment: "unresolved",
    };
  }

  const sameSideBias = (rateGap > 0 && inflationGap > 0) || (rateGap < 0 && inflationGap < 0);
  const favoredCurrency = sameSideBias ? (rateGap > 0 ? pair.base : pair.quote) : null;

  if (!sameSideBias) {
    return {
      title: `The macro picture for ${reviewSymbol} is mixed.`,
      detail: `Rate Diff: ${formatGap(rateGap)} | Inflation Diff: ${formatGap(inflationGap)}`,
      unresolved: false,
      favoredCurrency: null,
      rateGap,
      inflationGap,
      alignment: "mixed",
    };
  }

  return {
    title: `${favoredCurrency} has the cleaner macro backdrop in ${reviewSymbol}.`,
    detail: `Rate Diff: ${formatGap(rateGap)} | Inflation Diff: ${formatGap(inflationGap)}`,
    unresolved: false,
    favoredCurrency,
    rateGap,
    inflationGap,
    alignment: "aligned",
  };
}

export function getStrengthDifferentialSummary(
  reviewSymbol: string,
  snapshots: CentralBankSnapshot[],
  events: CalendarEvent[] = [],
  candleMap: Partial<Record<string, { d1: BridgeCandle[]; h4: BridgeCandle[] }>> = {},
  nowSeconds?: number,
): StrengthSummary {
  return getStrengthSummaryForPair({
    reviewSymbol,
    snapshots,
    events,
    candleMap,
    nowSeconds,
  });
}

export function getEventSensitivity(
  events: CalendarEvent[],
  reviewSymbol: string,
  nowUnix: number,
): EventSensitivitySummary {
  const symbolCurrencies = getPairCurrencies(reviewSymbol);
  const nextRelevant = events
    .filter((event) => event.impact === "high" && event.time >= nowUnix && symbolCurrencies.includes(event.currency))
    .sort((a, b) => a.time - b.time)[0] ?? null;

  if (!nextRelevant) {
    return {
      label: "Clear",
      tone: "good",
      detail: `No relevant high-impact event is scheduled soon for ${reviewSymbol}.`,
      nextRelevantEvent: null,
    };
  }

  const secondsUntil = nextRelevant.time - nowUnix;
  if (secondsUntil <= 2 * 60 * 60) {
    return {
      label: "High-risk soon",
      tone: "danger",
      detail: `${nextRelevant.currency} ${nextRelevant.title} is too close for a clean timing window.`,
      nextRelevantEvent: nextRelevant,
    };
  }

  if (secondsUntil <= 24 * 60 * 60) {
    return {
      label: "Event-sensitive",
      tone: "warning",
      detail: `${nextRelevant.currency} ${nextRelevant.title} is within the next 24 hours.`,
      nextRelevantEvent: nextRelevant,
    };
  }

  return {
    label: "Clear",
    tone: "good",
    detail: `Relevant high-impact events for ${reviewSymbol} are not immediate.`,
    nextRelevantEvent: nextRelevant,
  };
}

export function getMacroBackdropVerdict(
  reviewSymbol: string,
  macroSummary: MacroSummary,
  strengthSummary: StrengthSummary,
): VerdictCard {
  if (macroSummary.unresolved || strengthSummary.unresolved) {
    return {
      label: "Unclear",
      tone: "warning",
      detail: `Macro inputs for ${reviewSymbol} are still incomplete or unresolved.`,
    };
  }

  if (macroSummary.alignment === "aligned" && macroSummary.favoredCurrency === strengthSummary.strongerCurrency) {
    return {
      label: "Supportive",
      tone: "good",
      detail: `${macroSummary.favoredCurrency} has the cleaner rate and inflation backdrop, and the board-strength read agrees.`,
    };
  }

  if (macroSummary.alignment === "aligned" && macroSummary.favoredCurrency !== strengthSummary.strongerCurrency) {
    return {
      label: "Hostile",
      tone: "danger",
      detail: `Rate and inflation favor ${macroSummary.favoredCurrency}, but the board-strength read currently points toward ${strengthSummary.strongerCurrency}.`,
    };
  }

  return {
    label: "Unclear",
    tone: "warning",
    detail: `Rates and inflation do not yet form a clean same-side macro backdrop for ${reviewSymbol}.`,
  };
}

export interface PillarAnalysis {
  macro: { label: string; status: "good" | "warning" | "danger" };
  strength: { label: string; status: "good" | "warning" | "danger" };
  context: { label: string; status: "good" | "warning" | "danger" };
}

export interface DominanceProfile {
  winner: string | "Conflicted" | "Unresolved";
  tone: TrustTone;
  pillars: PillarAnalysis;
}

export function getDominanceProfile(
  reviewSymbol: string,
  macroVerdict: VerdictCard,
  strengthSummary: StrengthSummary,
  eventSensitivity: EventSensitivitySummary,
  atr14D: number | null | undefined,
  atr14H: number | null | undefined,
): DominanceProfile {
  const [base, quote] = getPairCurrencies(reviewSymbol);
  
  // 1. Winner Determination
  let winner: string | "Conflicted" | "Unresolved" = "Unresolved";
  let tone: TrustTone = "warning";

  const macroFavors = macroVerdict.tone === "good" ? macroVerdict.detail.includes(base) ? base : quote : null;
  const strengthFavors = strengthSummary.scoreGap != null ? strengthSummary.strongerCurrency : null;

  if (macroVerdict.label === "Unclear" || strengthSummary.unresolved) {
    winner = "Unresolved";
    tone = "warning";
  } else if (macroFavors === strengthFavors && macroFavors !== null) {
    winner = `${macroFavors} Dominant`;
    tone = "good";
  } else if (macroFavors !== strengthFavors && macroFavors !== null && strengthFavors !== null) {
    winner = "Conflicted";
    tone = "danger";
  } else {
    winner = strengthFavors ? `${strengthFavors} Advantage` : "Conflicted";
    tone = "warning";
  }

  // 2. Pillars Analysis
  const pillars: PillarAnalysis = {
    macro: {
      label: macroVerdict.label === "Supportive" ? "Aligned" : macroVerdict.label === "Hostile" ? "Opposed" : "Unclear",
      status: macroVerdict.tone,
    },
    strength: {
      label: strengthSummary.decisive ? "Clear" : "Mixed",
      status: strengthSummary.decisive ? "good" : "warning",
    },
    context: {
      label: eventSensitivity.label === "Clear" ? (atr14D && atr14D > 50 ? "Ready" : "Quiet") : "Risk-On",
      status: eventSensitivity.tone,
    },
  };

  return { winner, tone, pillars };
}

export function getPairAttentionVerdict(
  reviewSymbol: string,
  trustState: TrustState,
  macroVerdict: VerdictCard,
  macroSummary: MacroSummary,
  strengthSummary: StrengthSummary,
  eventSensitivity: EventSensitivitySummary,
  atrValue: number | null | undefined,
): VerdictCard {
  if (trustState.verdict === "no") {
    return {
      label: "Wait for data",
      tone: "danger",
      detail: `The app trust state is ${trustState.verdictLabel.toLowerCase()}, so ${reviewSymbol} should not be routed yet.`,
    };
  }

  if (eventSensitivity.label === "High-risk soon") {
    return {
      label: "Wait until event passes",
      tone: "danger",
      detail: `${reviewSymbol} is event-sensitive right now because a relevant high-impact release is too close.`,
    };
  }

  if (trustState.verdict === "limited" || macroSummary.unresolved || strengthSummary.unresolved) {
    return {
      label: "Wait for data",
      tone: "warning",
      detail: `${reviewSymbol} still needs cleaner trust or macro inputs before it earns attention.`,
    };
  }

  if (macroVerdict.label === "Supportive" && strengthSummary.decisive && atrValue != null && atrValue >= 50) {
    return {
      label: "Study now",
      tone: "good",
      detail: `${reviewSymbol} has a supportive macro backdrop, a clear board-strength gap, and enough volatility to study now.`,
    };
  }

  if (macroVerdict.label === "Hostile" && !strengthSummary.decisive) {
    return {
      label: "Ignore for now",
      tone: "danger",
      detail: `${reviewSymbol} does not currently show a clean macro or board-strength case worth prioritizing.`,
    };
  }

  if (eventSensitivity.label === "Event-sensitive" || macroVerdict.label === "Unclear") {
    return {
      label: "Monitor later",
      tone: "warning",
      detail: `${reviewSymbol} is watchable, but the backdrop is not clean enough yet for immediate focus.`,
    };
  }

  if (atrValue != null && atrValue < 45 && !strengthSummary.decisive) {
    return {
      label: "Ignore for now",
      tone: "danger",
      detail: `${reviewSymbol} is currently quiet and lacks a clear enough board-strength gap to prioritize.`,
    };
  }

  return {
    label: "Monitor later",
    tone: "warning",
    detail: `${reviewSymbol} is usable to monitor, but it is not the cleanest candidate on the current evidence.`,
  };
}

export function getOverviewPipelineStatus(
  trustState: TrustState,
  feedStatus: BridgeStatus,
  marketStatus: MarketStatusResponse | null,
  resolvedBanks: number,
): OverviewPipelineStatus {
  const factors: string[] = [];
  const coverageRatio = Math.max(0, Math.min(resolvedBanks, 8));

  if (trustState.verdict !== "yes") {
    factors.push(`Trust is ${trustState.verdictLabel.toLowerCase()}`);
  }
  if (feedStatus !== "live") {
    factors.push(`Calendar feed is ${feedStatus.replace("_", " ")}`);
  }
  if (!marketStatus || !marketStatus.terminal_connected) {
    factors.push("Selected symbol context is unavailable");
  } else if (marketStatus.session_state === "unavailable") {
    factors.push("Selected symbol session is unresolved");
  }
  if (coverageRatio < 8) {
    factors.push(`Macro coverage is ${coverageRatio}/8 resolved`);
  }

  const trustPoints = trustState.verdict === "yes" ? 40 : trustState.verdict === "limited" ? 22 : 0;
  const feedPoints =
    feedStatus === "live"
      ? 25
      : feedStatus === "stale"
        ? 15
        : feedStatus === "loading"
          ? 10
          : 0;
  const marketPoints =
    !marketStatus || !marketStatus.terminal_connected
      ? 4
      : marketStatus.session_state === "unavailable"
        ? 8
        : 15;
  const coveragePoints = Math.round((coverageRatio / 8) * 20);
  const percent = Math.max(0, Math.min(100, trustPoints + feedPoints + marketPoints + coveragePoints));
  const explanation =
    "This meter combines trust state, calendar timing, selected symbol context, and resolved macro coverage.";
  const weights = [
    {
      label: "Trust state",
      earned: trustPoints,
      max: 40,
      state: trustState.verdictLabel,
    },
    {
      label: "Calendar timing",
      earned: feedPoints,
      max: 25,
      state: feedStatus.replace("_", " "),
    },
    {
      label: "Selected symbol context",
      earned: marketPoints,
      max: 15,
      state:
        !marketStatus || !marketStatus.terminal_connected
          ? "Unavailable"
          : marketStatus.session_state === "unavailable"
            ? "Unresolved"
            : marketStatus.session_state,
    },
    {
      label: "Macro coverage",
      earned: coveragePoints,
      max: 20,
      state: `${coverageRatio}/8 resolved`,
    },
  ];

  if (trustState.verdict === "no") {
    return {
      percent,
      tone: "danger",
      label: "Pipeline degraded",
      detail: "Core trust checks are failing, so Overview outputs should not be treated as fully reliable.",
      factors,
      explanation,
      weights,
    };
  }

  if (feedStatus === "error" || feedStatus === "no_data") {
    return {
      percent,
      tone: "danger",
      label: "Calendar pipeline degraded",
      detail: "Event timing is unavailable, so the Overview briefing is missing a critical timing input.",
      factors,
      explanation,
      weights,
    };
  }

  if (trustState.verdict === "limited" || feedStatus === "stale" || feedStatus === "loading" || resolvedBanks < 8) {
    return {
      percent,
      tone: "warning",
      label: "Pipeline limited",
      detail: "Overview is usable, but at least one trust, timing, or macro coverage input is still partial.",
      factors,
      explanation,
      weights,
    };
  }

  return {
    percent,
    tone: "good",
    label: "Pipeline healthy",
    detail: "Trust, timing, symbol context, and macro coverage are all aligned for normal Overview use.",
    factors,
    explanation,
    weights,
  };
}

export function getTrustInspectorSummary(
  trustState: TrustState,
  feedStatus: BridgeStatus,
  marketStatus: MarketStatusResponse | null,
): TrustInspectorSummary {
  const supportingInputs: string[] = [];
  const limitingInputs: string[] = [];

  if (trustState.verdict !== "no") {
    supportingInputs.push("MT5 terminal connection is available.");
    supportingInputs.push("Bridge health is currently usable.");
  }

  if (feedStatus === "live") {
    supportingInputs.push("Calendar timing is live.");
  } else {
    limitingInputs.push(
      feedStatus === "stale"
        ? "Calendar timing is delayed."
        : feedStatus === "loading"
          ? "Calendar timing is still syncing."
          : "Calendar timing is unavailable.",
    );
  }

  if (!marketStatus || !marketStatus.terminal_connected) {
    limitingInputs.push("Selected symbol context is unavailable.");
  } else if (marketStatus.session_state === "unavailable") {
    limitingInputs.push("Selected symbol session is unresolved.");
  } else {
    supportingInputs.push(`Selected symbol context is ${marketStatus.session_state}.`);
  }

  if (supportingInputs.length === 0) {
    supportingInputs.push("No trust-supporting inputs are fully confirmed right now.");
  }

  if (limitingInputs.length === 0) {
    limitingInputs.push("No trust-limiting inputs are active right now.");
  }

  return {
    title: trustState.title,
    supportingInputs,
    limitingInputs,
    affects: [
      "Whether Overview verdicts should be treated as usable for normal review.",
      "How confidently event timing should influence pair attention.",
      "How much weight to place on macro and pair-routing guidance.",
    ],
  };
}

export function sortOverviewPairs(
  pairs: FxPairDefinition[],
  searchQuery: string,
  sortMode: OverviewPairSortMode,
  atrByPair: Record<string, number | null | undefined>,
  favorites: string[],
  direction: SortDirection = "desc",
): FxPairDefinition[] {
  const query = searchQuery.trim().toLowerCase();
  const favoriteSet = new Set(favorites);

  const filtered = query
    ? pairs.filter((pair) => pair.name.toLowerCase().includes(query))
    : [...pairs];

  return filtered.sort((left, right) => {
    if (sortMode === "favorites") {
      const leftFavorite = favoriteSet.has(left.name);
      const rightFavorite = favoriteSet.has(right.name);
      if (leftFavorite !== rightFavorite) return leftFavorite ? -1 : 1;
      return left.name.localeCompare(right.name);
    }

    if (sortMode === "volatility") {
      const leftAtr = atrByPair[left.name];
      const rightAtr = atrByPair[right.name];
      const leftResolved = typeof leftAtr === "number";
      const rightResolved = typeof rightAtr === "number";
      if (leftResolved !== rightResolved) return leftResolved ? -1 : 1;
      if (leftResolved && rightResolved && leftAtr !== rightAtr) {
        return direction === "desc" ? (rightAtr ?? 0) - (leftAtr ?? 0) : (leftAtr ?? 0) - (rightAtr ?? 0);
      }
      return left.name.localeCompare(right.name);
    }

    return left.name.localeCompare(right.name);
  });
}

export function getOverviewSpecialistSummaries(
  reviewSymbol: string,
  snapshots: CentralBankSnapshot[],
  events: CalendarEvent[],
  candleMap: Partial<Record<string, { d1: BridgeCandle[]; h4: BridgeCandle[] }>>,
  nowUnix: number,
): SpecialistSummaryCard[] {
  const pair = getFxPairByName(reviewSymbol);
  const macroSummary = getMacroSummary(reviewSymbol, snapshots);
  const strengthSummary = getStrengthDifferentialSummary(reviewSymbol, snapshots, events, candleMap, nowUnix);
  const strengthBoard = deriveStrengthMeterResult({ snapshots, events, candleMap, nowSeconds: nowUnix });

  const eventQuality = pair
    ? deriveEventQualitySummary({
        events,
        pair,
        horizon: "24h",
        nowSeconds: nowUnix,
      })
    : null;

  return [
    {
      id: "strength-meter",
      title: "Strength Meter",
      tab: "strength-meter",
      summary: strengthSummary.title,
      metrics: [
        strengthSummary.scoreGap != null ? `Board gap ${strengthSummary.scoreGap.toFixed(1)} pts` : "Board gap unresolved",
        strengthSummary.decisive ? "Pair split is clear" : "Pair split is still mixed",
        strengthBoard.shortlist[0] ? `Top board pair ${strengthBoard.shortlist[0].pair.name}` : "Top board pair unresolved",
      ],
    },
    {
      id: "dashboard",
      title: "Differential Calculator",
      tab: "dashboard",
      summary: macroSummary.title,
      metrics: [
        macroSummary.rateGap != null ? `Rate diff ${formatGap(macroSummary.rateGap)}` : "Rate diff unresolved",
        macroSummary.inflationGap != null ? `Inflation diff ${formatGap(macroSummary.inflationGap)}` : "Inflation diff unresolved",
      ],
    },
    {
      id: "event-tools",
      title: "Event Tools",
      tab: "event-tools",
      summary:
        eventQuality == null
          ? `Event prep summary is unavailable for ${reviewSymbol}.`
          : eventQuality.label === "clean"
            ? `${reviewSymbol} looks clean enough for event prep over the next 24h.`
            : eventQuality.label === "mixed"
              ? `${reviewSymbol} has building event friction over the next 24h.`
              : `${reviewSymbol} has a dirty event environment over the next 24h.`,
      metrics:
        eventQuality == null
          ? ["24h horizon unavailable", "No pair mapping"]
          : [
              `24h score ${eventQuality.totalScore.toFixed(2)}`,
              `${eventQuality.rows.length} matched event${eventQuality.rows.length === 1 ? "" : "s"}`,
            ],
    },
  ];
}
