import { getFxPairByName } from "@/app/config/fxPairs";
import { adaptDashboardCurrencies, deriveStrengthCurrencyRanks } from "@/app/lib/macroViews";
import { parseNumericValue } from "@/app/lib/format";
import type { BridgeStatus, CalendarEvent, CentralBankSnapshot, MarketStatusResponse } from "@/app/types";
import type { TrustState, TrustTone } from "@/app/lib/status";

export interface OverviewEvent extends CalendarEvent {
  relevant: boolean;
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

function formatGap(value: number | null): string {
  if (value == null) return "Unresolved";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getPairCurrencies(reviewSymbol: string): [string, string] {
  return [reviewSymbol.slice(0, 3), reviewSymbol.slice(3, 6)];
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
    .slice(0, 3)
    .map((event) => ({
      ...event,
      relevant: symbolCurrencies.includes(event.currency),
    }));
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

export function getStrengthDifferentialSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): StrengthSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) {
    return {
      title: "Strength context unresolved.",
      detail: "Pair mapping is unavailable.",
      unresolved: true,
      strongerCurrency: null,
      weakerCurrency: null,
      scoreGap: null,
      decisive: false,
    };
  }

  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find((item) => item.currency === pair.base) ?? null;
  const quoteRank = ranks.find((item) => item.currency === pair.quote) ?? null;

  if (!baseRank || !quoteRank) {
    return {
      title: "Strength context unresolved.",
      detail: "At least one currency rank is missing.",
      unresolved: true,
      strongerCurrency: null,
      weakerCurrency: null,
      scoreGap: null,
      decisive: false,
    };
  }

  const stronger = baseRank.score >= quoteRank.score ? baseRank : quoteRank;
  const weaker = stronger.currency === baseRank.currency ? quoteRank : baseRank;
  const scoreGap = stronger.score - weaker.score;

  return {
    title: `${stronger.currency} is currently outperforming ${weaker.currency}.`,
    detail: `Score Gap: ${scoreGap.toFixed(1)} pts`,
    unresolved: false,
    strongerCurrency: stronger.currency,
    weakerCurrency: weaker.currency,
    scoreGap,
    decisive: scoreGap >= 3,
  };
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
      detail: `${macroSummary.favoredCurrency} has the cleaner rate and inflation backdrop, and the strength spread agrees.`,
    };
  }

  if (macroSummary.alignment === "aligned" && macroSummary.favoredCurrency !== strengthSummary.strongerCurrency) {
    return {
      label: "Hostile",
      tone: "danger",
      detail: `Rate and inflation favor ${macroSummary.favoredCurrency}, but live strength currently points toward ${strengthSummary.strongerCurrency}.`,
    };
  }

  return {
    label: "Unclear",
    tone: "warning",
    detail: `Rates and inflation do not yet form a clean same-side macro backdrop for ${reviewSymbol}.`,
  };
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
      detail: `${reviewSymbol} has a supportive macro backdrop, a decisive strength spread, and enough volatility to study now.`,
    };
  }

  if (macroVerdict.label === "Hostile" && !strengthSummary.decisive) {
    return {
      label: "Ignore for now",
      tone: "danger",
      detail: `${reviewSymbol} does not currently show a clean macro or strength case worth prioritizing.`,
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
      detail: `${reviewSymbol} is currently quiet and lacks a decisive enough strength spread to prioritize.`,
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
