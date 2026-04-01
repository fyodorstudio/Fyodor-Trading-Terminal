import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, CalendarClock, Check, Info, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { calculateAtr14Pips } from "@/app/lib/atr";
import { fetchHistory } from "@/app/lib/bridge";
import { formatCountdown, formatRelativeAge, formatUtcDateTime, parseNumericValue } from "@/app/lib/format";
import { adaptDashboardCurrencies, deriveStrengthCurrencyRanks } from "@/app/lib/macroViews";
import { resolveTrustState, type TrustState, type TrustTone } from "@/app/lib/status";
import type { BridgeHealth, BridgeStatus, CalendarEvent, CentralBankSnapshot, MarketStatusResponse, TabId } from "@/app/types";

interface OverviewTabProps {
  currentTime: Date;
  health: BridgeHealth;
  feedStatus: BridgeStatus;
  marketStatus: MarketStatusResponse | null;
  reviewSymbol: string;
  onReviewSymbolChange: (symbol: string) => void;
  events: CalendarEvent[];
  snapshots: CentralBankSnapshot[];
  onNavigate: (tab: TabId) => void;
}

interface ActionItem {
  tab: TabId;
  label: string;
  detail: string;
}

type AtrByPair = Record<string, number | null | undefined>;

interface MacroSummary {
  title: string;
  detail: string;
  unresolved: boolean;
  favoredCurrency: string | null;
  rateGap: number | null;
  inflationGap: number | null;
  alignment: "aligned" | "mixed" | "unresolved";
}

interface StrengthSummary {
  title: string;
  detail: string;
  unresolved: boolean;
  strongerCurrency: string | null;
  weakerCurrency: string | null;
  scoreGap: number | null;
  decisive: boolean;
}

interface VerdictCard {
  label: string;
  detail: string;
  tone: TrustTone;
}

interface EventSensitivitySummary {
  label: "Clear" | "Event-sensitive" | "High-risk soon";
  detail: string;
  tone: TrustTone;
}

function getTopEvents(events: CalendarEvent[], reviewSymbol: string): Array<CalendarEvent & { relevant: boolean }> {
  const now = Date.now() / 1000;
  const symbolCurrencies = [reviewSymbol.slice(0, 3), reviewSymbol.slice(3, 6)];

  return events
    .filter((event) => event.impact === "high" && event.time >= now)
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

function formatGap(value: number | null): string {
  if (value == null) return "Unresolved";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getMacroSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): MacroSummary {
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

  const sameSideBias =
    (rateGap > 0 && inflationGap > 0) ||
    (rateGap < 0 && inflationGap < 0);
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

function getStrengthDifferentialSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): StrengthSummary {
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

function getEventSensitivity(
  events: CalendarEvent[],
  reviewSymbol: string,
  currentTime: Date,
): EventSensitivitySummary {
  const now = currentTime.getTime() / 1000;
  const symbolCurrencies = [reviewSymbol.slice(0, 3), reviewSymbol.slice(3, 6)];
  const nextRelevant = events
    .filter((event) => event.impact === "high" && event.time >= now && symbolCurrencies.includes(event.currency))
    .sort((a, b) => a.time - b.time)[0] ?? null;

  if (!nextRelevant) {
    return {
      label: "Clear",
      tone: "good",
      detail: `No relevant high-impact event is scheduled soon for ${reviewSymbol}.`,
    };
  }

  const secondsUntil = nextRelevant.time - now;
  if (secondsUntil <= 2 * 60 * 60) {
    return {
      label: "High-risk soon",
      tone: "danger",
      detail: `${nextRelevant.currency} ${nextRelevant.title} is too close for a clean timing window.`,
    };
  }

  if (secondsUntil <= 24 * 60 * 60) {
    return {
      label: "Event-sensitive",
      tone: "warning",
      detail: `${nextRelevant.currency} ${nextRelevant.title} is within the next 24 hours.`,
    };
  }

  return {
    label: "Clear",
    tone: "good",
    detail: `Relevant high-impact events for ${reviewSymbol} are not immediate.`,
  };
}

function getMacroBackdropVerdict(
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

function getPairAttentionVerdict(
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

function getAttentionActions(
  trustState: TrustState,
  reviewSymbol: string,
  eventSensitivity: EventSensitivitySummary,
  macroSummary: MacroSummary,
  strengthSummary: StrengthSummary,
): ActionItem[] {
  const actions: ActionItem[] = [];

  if (trustState.verdict !== "yes") {
    actions.push({
      tab: "calendar",
      label: "Verify Trust Inputs",
      detail: "Check bridge, ingest timing, and selected-symbol context before routing the pair.",
    });
  }

  if (eventSensitivity.label !== "Clear") {
    actions.push({
      tab: "calendar",
      label: `Review ${reviewSymbol} Event Sensitivity`,
      detail: eventSensitivity.detail,
    });
  }

  if (macroSummary.unresolved || strengthSummary.unresolved) {
    actions.push({
      tab: "central-banks",
      label: "Verify Macro Coverage",
      detail: "Check central-bank snapshots and unresolved values for the selected pair.",
    });
  }

  actions.push({
    tab: "charts",
    label: `Open ${reviewSymbol} Chart`,
    detail: "Review price structure, session context, and execution levels.",
  });

  return actions.slice(0, 3);
}

function renderFeedLabel(status: BridgeStatus): string {
  if (status === "live") return "Live";
  if (status === "stale") return "Stale";
  if (status === "loading") return "Syncing";
  return "Disconnected";
}

function getVerdictClassName(tone: TrustTone): string {
  if (tone === "good") return "is-good";
  if (tone === "danger") return "is-danger";
  return "is-warning";
}

export function OverviewTab({
  currentTime,
  health,
  feedStatus,
  marketStatus,
  reviewSymbol,
  onReviewSymbolChange,
  events,
  snapshots,
  onNavigate,
}: OverviewTabProps) {
  const [atrByPair, setAtrByPair] = useState<AtrByPair>({});
  const trustState = useMemo(() => resolveTrustState(health, feedStatus, marketStatus), [health, feedStatus, marketStatus]);
  const topEvents = useMemo(() => getTopEvents(events, reviewSymbol), [events, reviewSymbol]);
  const macroSummary = useMemo(() => getMacroSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const strengthSummary = useMemo(() => getStrengthDifferentialSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const eventSensitivity = useMemo(() => getEventSensitivity(events, reviewSymbol, currentTime), [events, reviewSymbol, currentTime]);
  const macroVerdict = useMemo(
    () => getMacroBackdropVerdict(reviewSymbol, macroSummary, strengthSummary),
    [reviewSymbol, macroSummary, strengthSummary],
  );
  const atrValue = atrByPair[reviewSymbol];
  const pairAttentionVerdict = useMemo(
    () => getPairAttentionVerdict(reviewSymbol, trustState, macroVerdict, macroSummary, strengthSummary, eventSensitivity, atrValue),
    [reviewSymbol, trustState, macroVerdict, macroSummary, strengthSummary, eventSensitivity, atrValue],
  );
  const actions = useMemo(
    () => getAttentionActions(trustState, reviewSymbol, eventSensitivity, macroSummary, strengthSummary),
    [trustState, reviewSymbol, eventSensitivity, macroSummary, strengthSummary],
  );
  const resolvedBanks = snapshots.filter((item) => item.status === "ok").length;
  const lastIngestLabel = formatRelativeAge(health.last_calendar_ingest_at ?? null);

  const pair = getFxPairByName(reviewSymbol);
  const baseSnap = snapshots.find((snapshot) => snapshot.currency === pair?.base);
  const quoteSnap = snapshots.find((snapshot) => snapshot.currency === pair?.quote);

  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find((rank) => rank.currency === pair?.base);
  const quoteRank = ranks.find((rank) => rank.currency === pair?.quote);

  const isBridgeValid = health.terminal_connected && health.ok;
  const isRiskValid = eventSensitivity.label === "Clear";
  const isMacroValid = !macroSummary.unresolved && macroVerdict.label !== "Unclear";
  const isStrengthValid = strengthSummary.decisive;

  const needlePosition = useMemo(() => {
    if (!baseRank || !quoteRank) return 50;
    const diff = baseRank.score - quoteRank.score;
    const pos = 50 - (diff * 4);
    return Math.min(Math.max(pos, 10), 90);
  }, [baseRank, quoteRank]);

  const atrGaugeWidth = useMemo(() => {
    if (!atrValue) return 0;
    const width = ((atrValue - 40) / 160) * 100;
    return Math.min(Math.max(width, 5), 100);
  }, [atrValue]);

  useEffect(() => {
    let cancelled = false;
    const loadAtr = async () => {
      const entries = await Promise.all(
        FX_PAIRS.map(async (fxPair) => {
          try {
            const candles = await fetchHistory(fxPair.name, "D1", 60);
            return [fxPair.name, calculateAtr14Pips(candles, fxPair.name)] as const;
          } catch {
            return [fxPair.name, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setAtrByPair(Object.fromEntries(entries));
    };
    void loadAtr();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="tab-panel overview-panel">
      <div className="narrative-container">
        <section className={`narrative-hero narrative-hero-${trustState.tone}`}>
          <div className="overview-decision-grid">
            <article className={`overview-decision-card ${getVerdictClassName(trustState.tone)}`}>
              <span className="overview-decision-kicker">Can I trust the app right now?</span>
              <div className="overview-decision-head">
                <ShieldCheck size={16} />
                <strong>{trustState.verdictLabel}</strong>
              </div>
              <p>{trustState.detail}</p>
            </article>

            <article className={`overview-decision-card ${getVerdictClassName(pairAttentionVerdict.tone)}`}>
              <span className="overview-decision-kicker">Is {reviewSymbol} worth attention right now?</span>
              <div className="overview-decision-head">
                <Target size={16} />
                <strong>{pairAttentionVerdict.label}</strong>
              </div>
              <p>{pairAttentionVerdict.detail}</p>
            </article>

            <article className={`overview-decision-card ${getVerdictClassName(macroVerdict.tone)}`}>
              <span className="overview-decision-kicker">Macro Backdrop Verdict</span>
              <div className="overview-decision-head">
                <TrendingUp size={16} />
                <strong>{macroVerdict.label}</strong>
              </div>
              <p>{macroVerdict.detail}</p>
            </article>
          </div>

          <div className="readiness-checklist">
            <div className={`check-item ${isBridgeValid ? "is-valid" : "is-invalid"}`}>
              <div className="check-dot">{isBridgeValid ? <Check size={10} /> : <AlertTriangle size={10} />}</div>
              Bridge Link
            </div>
            <div className={`check-item ${isRiskValid ? "is-valid" : "is-invalid"}`}>
              <div className="check-dot">{isRiskValid ? <Check size={10} /> : <AlertTriangle size={10} />}</div>
              Event Sensitivity
            </div>
            <div className={`check-item ${isMacroValid ? "is-valid" : "is-invalid"}`}>
              <div className="check-dot">{isMacroValid ? <Check size={10} /> : <Info size={10} />}</div>
              Macro Backdrop
            </div>
            <div className={`check-item ${isStrengthValid ? "is-valid" : ""}`}>
              <div className="check-dot">{isStrengthValid ? <TrendingUp size={10} /> : <Activity size={10} />}</div>
              Strength Gap
            </div>
          </div>

          <div className="narrative-hero-vitals">
            <div className="narrative-hero-stat">
              <label>Trust</label>
              <span>{trustState.verdictLabel}</span>
            </div>
            <div className="narrative-hero-stat">
              <label>Calendar</label>
              <span>{renderFeedLabel(feedStatus)}</span>
            </div>
            <div className="narrative-hero-stat">
              <label>Banks</label>
              <span>{resolvedBanks}/8</span>
            </div>
          </div>
        </section>

        <div className="narrative-main-grid">
          <div className="narrative-section">
            <div className="narrative-section-header">
              <Target size={14} />
              <h3>The Pair Story</h3>
            </div>

            <div className="narrative-card">
              <div className="narrative-pair-banner">
                <div className="narrative-pair-info">
                  <h4>Selected Pair</h4>
                  <select
                    className="narrative-pair-select"
                    value={reviewSymbol}
                    onChange={(event) => onReviewSymbolChange(event.target.value)}
                  >
                    {FX_PAIRS.map((fxPair) => (
                      <option key={fxPair.name} value={fxPair.name}>{fxPair.name}</option>
                    ))}
                  </select>
                </div>
                <div className="narrative-atr-display">
                  <label>Volatility (14D ATR)</label>
                  <div className="narrative-atr-value">
                    {atrValue === undefined ? "..." : atrValue == null ? "--" : `${atrValue} pips`}
                  </div>
                  <div className="atr-gauge-container">
                    <div className="atr-gauge-track">
                      <div className="atr-gauge-fill" style={{ width: `${atrGaugeWidth}%` }} />
                    </div>
                    <div className="atr-labels">
                      <span>Quiet</span>
                      <span>Extreme</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overview-signal-strip">
                <div className={`overview-signal-pill ${getVerdictClassName(eventSensitivity.tone)}`}>
                  <span>Event Sensitivity</span>
                  <strong>{eventSensitivity.label}</strong>
                </div>
                <div className={`overview-signal-pill ${getVerdictClassName(pairAttentionVerdict.tone)}`}>
                  <span>Routing</span>
                  <strong>{pairAttentionVerdict.label}</strong>
                </div>
              </div>

              <div className="duel-container">
                <div className="duel-side">
                  <div className="duel-header">
                    <span className="duel-currency">{pair?.base || "---"}</span>
                    <FlagIcon countryCode={baseSnap?.countryCode || ""} className="h-4 w-6" />
                  </div>
                  <div className="duel-stat">
                    <label>Strength</label>
                    <span>{baseRank?.score.toFixed(1) || "0.0"} pts</span>
                  </div>
                  <div className="duel-stat">
                    <label>Policy Rate</label>
                    <span>{baseSnap?.currentPolicyRate || "---"}</span>
                  </div>
                </div>

                <div className="duel-needle-track">
                  <div className="duel-needle" style={{ top: `${needlePosition}%` }} />
                </div>

                <div className="duel-side">
                  <div className="duel-header" style={{ flexDirection: "row-reverse" }}>
                    <span className="duel-currency">{pair?.quote || "---"}</span>
                    <FlagIcon countryCode={quoteSnap?.countryCode || ""} className="h-4 w-6" />
                  </div>
                  <div className="duel-stat" style={{ textAlign: "right" }}>
                    <label>Strength</label>
                    <span>{quoteRank?.score.toFixed(1) || "0.0"} pts</span>
                  </div>
                  <div className="duel-stat" style={{ textAlign: "right" }}>
                    <label>Policy Rate</label>
                    <span>{quoteSnap?.currentPolicyRate || "---"}</span>
                  </div>
                </div>
              </div>

              <div className="overview-story-grid">
                <div className="narrative-story-item">
                  <div className="narrative-story-icon"><TrendingUp size={22} /></div>
                  <div className="narrative-story-text">
                    <h5>Macro Backdrop Verdict</h5>
                    <p>{macroSummary.title}</p>
                    <div className="narrative-story-detail">{macroSummary.detail}</div>
                  </div>
                </div>

                <div className="narrative-story-item">
                  <div className="narrative-story-icon"><CalendarClock size={22} /></div>
                  <div className="narrative-story-text">
                    <h5>Event Sensitivity</h5>
                    <p>{eventSensitivity.detail}</p>
                    <div className="narrative-story-detail">
                      Relevant event timing is treated as a routing input, not as a prediction signal.
                    </div>
                  </div>
                </div>

                <div className="narrative-story-item">
                  <div className="narrative-story-icon"><Activity size={22} /></div>
                  <div className="narrative-story-text">
                    <h5>Strength Context</h5>
                    <p>{strengthSummary.title}</p>
                    <div className="narrative-story-detail">{strengthSummary.detail}</div>
                  </div>
                </div>
              </div>

              <div className="terminal-link-strip" style={{ marginTop: "32px" }}>
                <button onClick={() => onNavigate("central-banks")}>Banks Analysis</button>
                <button onClick={() => onNavigate("strength-meter")}>Strength Meter</button>
                <button onClick={() => onNavigate("dashboard")}>Differential Calc</button>
                <button onClick={() => onNavigate("charts")}>Open Charts</button>
              </div>
            </div>
          </div>

          <div className="narrative-column" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="narrative-section">
              <div className="narrative-section-header">
                <CalendarClock size={14} />
                <h3>Risk Radar</h3>
              </div>
              <div className="narrative-event-card">
                <div className={`overview-risk-banner ${getVerdictClassName(eventSensitivity.tone)}`}>
                  <span>Near-Term Event Risk</span>
                  <strong>{eventSensitivity.label}</strong>
                  <p>{eventSensitivity.detail}</p>
                </div>
                {topEvents.length > 0 ? (
                  topEvents.map((event) => {
                    const diffMinutes = (event.time - currentTime.getTime() / 1000) / 60;
                    const isUrgent = event.relevant && diffMinutes > 0 && diffMinutes < 60;
                    return (
                      <button
                        key={event.id}
                        className={`narrative-event-row ${isUrgent ? "risk-alert-pulse" : ""}`}
                        onClick={() => onNavigate("calendar")}
                      >
                        <div className="narrative-event-top">
                          <div className="narrative-event-title">
                            <strong>{event.title}</strong>
                            <span>{event.currency} | {formatUtcDateTime(event.time)}</span>
                          </div>
                          <div className="narrative-event-countdown">
                            {formatCountdown(event.time, currentTime.getTime())}
                          </div>
                        </div>
                        <div className="overview-event-row-footer">
                          <FlagIcon countryCode={event.countryCode} className="h-4 w-6" />
                          <span className={`overview-relevance ${event.relevant ? "is-relevant" : ""}`}>
                            {event.relevant ? "Relevant to pair" : "Watchlist context"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="narrative-event-row">
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>
                      No high-impact events detected in the current window.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="narrative-section">
              <div className="narrative-section-header">
                <ArrowRight size={14} />
                <h3>Next Steps</h3>
              </div>
              <div className="narrative-next-move-list">
                {actions.map((action) => (
                  <button key={action.label} className="narrative-next-button" onClick={() => onNavigate(action.tab)}>
                    <div className="narrative-next-text">
                      <strong>{action.label}</strong>
                      <span>{action.detail}</span>
                    </div>
                    <ArrowRight size={16} color="#9ca3af" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="narrative-footer-links">
          <button className="narrative-footer-link" onClick={() => onNavigate("overview")}>Refresh Overview</button>
          <button className="narrative-footer-link">Sync Ingest Window</button>
          <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Last Ingest: {lastIngestLabel}</span>
        </div>
      </div>
    </section>
  );
}
