import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarClock, ChevronDown, ChevronRight, ChevronUp, CircleHelp, Layers, Monitor, Search, Settings, ShieldCheck, Star, Target, TrendingUp, Zap } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { TERMINOLOGY } from "@/app/config/terminology";
import { calculateAtrPips, type AtrSmoothingMethod } from "@/app/lib/atr";
import { fetchHistory } from "@/app/lib/bridge";
import { formatCountdown, formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import {
  getEventRadarSummary,
  getEventSensitivity,
  getMacroBackdropVerdict,
  getMacroSummary,
  getOverviewPipelineStatus,
  getOverviewSpecialistSummaries,
  getPairOpportunitySummary,
  getPriceAlignment,
  getStrengthDifferentialSummary,
  getTopEvents,
  getTrustInspectorSummary,
  getWhoIsWinningNow,
  sortOverviewPairs,
  type OverviewPairSortMode,
  type PairOpportunitySummary,
  type PriceAlignmentSummary,
  type SortDirection,
  type WinningNowSummary,
} from "@/app/lib/overview";
import { adaptDashboardCurrencies, deriveStrengthCurrencyRanks } from "@/app/lib/macroViews";
import { resolveTrustState, type TrustState } from "@/app/lib/status";
import type { BridgeCandle, BridgeHealth, BridgeStatus, CalendarEvent, CentralBankSnapshot, MarketStatusResponse, TabId } from "@/app/types";

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
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

interface ActionItem {
  tab: TabId;
  label: string;
  detail: string;
}

type AtrByPair = Record<string, { d1: number | null; h1: number | null }>;
type CandlesByPair = Record<string, { d1: BridgeCandle[]; h1: BridgeCandle[] }>;
type SpecialistCardId = "strength-meter" | "dashboard" | "event-quality";
type ViewMode = "strategic" | "command";

interface AtrConfig {
  d1Period: number;
  h1Period: number;
  method: AtrSmoothingMethod;
}

const CHART_FAVORITES_KEY = "fyodor-main-chart-favorites";
const OVERVIEW_VIEW_MODE_KEY = "fyodor-overview-view-mode";
const OVERVIEW_ATR_CONFIG_KEY = "fyodor-overview-atr-config";

const DEFAULT_ATR_CONFIG: AtrConfig = { d1Period: 14, h1Period: 14, method: "RMA" };

const ATR_METHOD_DESCRIPTIONS: Record<AtrSmoothingMethod, string> = {
  RMA: "Standard 'Smoothed' ATR used by TradingView. Filters out noise and prevents spikes from distorting the reading. (Recommended)",
  SMA: "Simple average. Reacts slowly and treats every day in the period with equal importance.",
  EMA: "Exponentially weighted. 'Fast' and highly reactive to recent volatility shifts.",
  WMA: "Linearly weighted. A middle ground that prioritizes recent data without being as jumpy as EMA.",
};

const ACTION_LABEL_COLORS: Record<WinningNowSummary["actionLabel"], string> = {
  "Focus now": "#166534",
  Study: "#1d4ed8",
  Monitor: "#92400e",
  "Avoid for now": "#991b1b",
};

const CONVICTION_LABELS: Record<WinningNowSummary["conviction"], string> = {
  high: "High Conviction",
  moderate: "Moderate Conviction",
  low: "Low Conviction",
};

function getActionRank(label: WinningNowSummary["actionLabel"]): number {
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

function getWinnerRank(winner: WinningNowSummary["winner"]): number {
  switch (winner) {
    case "base":
    case "quote":
      return 3;
    case "conflicted":
      return 2;
    default:
      return 1;
  }
}

function loadChartFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHART_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function loadViewMode(): ViewMode {
  if (typeof window === "undefined") return "command";
  return (window.localStorage.getItem(OVERVIEW_VIEW_MODE_KEY) as ViewMode) || "command";
}

function loadAtrConfig(): AtrConfig {
  if (typeof window === "undefined") return DEFAULT_ATR_CONFIG;
  try {
    const raw = window.localStorage.getItem(OVERVIEW_ATR_CONFIG_KEY);
    if (!raw) return DEFAULT_ATR_CONFIG;
    return { ...DEFAULT_ATR_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ATR_CONFIG;
  }
}

function getAttentionActions(
  trustState: TrustState,
  reviewSymbol: string,
  eventSensitivity: ReturnType<typeof getEventSensitivity>,
  macroSummary: ReturnType<typeof getMacroSummary>,
  strengthSummary: ReturnType<typeof getStrengthDifferentialSummary>,
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
  return TERMINOLOGY.calendarTiming.states[status].short.toUpperCase();
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
  onOpenCalendarEvent,
}: OverviewTabProps) {
  const [atrByPair, setAtrByPair] = useState<AtrByPair>({});
  const [candlesByPair, setCandlesByPair] = useState<CandlesByPair>({});
  const [atrConfig, setAtrConfig] = useState<AtrConfig>(() => loadAtrConfig());
  const [showAtrSettings, setShowAtrSettings] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const [showPipelineInspector, setShowPipelineInspector] = useState(false);
  const [showTrustInspector, setShowTrustInspector] = useState(false);
  const [showEventInspector, setShowEventInspector] = useState(false);
  const [showPairSelector, setShowPairSelector] = useState(false);
  const [pairSearchQuery, setPairSearchQuery] = useState("");
  const [pairSortMode, setPairSortMode] = useState<OverviewPairSortMode>("favorites");
  const [pairSortDirection, setPairSortDirection] = useState<SortDirection>("desc");
  const [favoritePairs, setFavoritePairs] = useState<string[]>(() => loadChartFavorites());
  const [expandedSpecialistId, setExpandedSpecialistId] = useState<SpecialistCardId | null>(null);

  const toggleFavorite = (symbol: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const current = loadChartFavorites();
    const next = current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol];
    window.localStorage.setItem(CHART_FAVORITES_KEY, JSON.stringify(next));
    setFavoritePairs(next);
    window.dispatchEvent(new Event("storage"));
  };

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(OVERVIEW_VIEW_MODE_KEY, mode);
  };

  const nowUnix = currentTime.getTime() / 1000;
  const trustState = useMemo(() => resolveTrustState(health, feedStatus, marketStatus), [health, feedStatus, marketStatus]);
  const topEvents = useMemo(() => getTopEvents(events, reviewSymbol, nowUnix), [events, reviewSymbol, nowUnix]);
  const macroSummary = useMemo(() => getMacroSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const strengthSummary = useMemo(() => getStrengthDifferentialSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const eventSensitivity = useMemo(() => getEventSensitivity(events, reviewSymbol, nowUnix), [events, reviewSymbol, nowUnix]);
  const macroVerdict = useMemo(
    () => getMacroBackdropVerdict(reviewSymbol, macroSummary, strengthSummary),
    [reviewSymbol, macroSummary, strengthSummary],
  );
  const pair = useMemo(() => getFxPairByName(reviewSymbol), [reviewSymbol]);
  const atrValue = atrByPair[reviewSymbol];
  const pairCandles = candlesByPair[reviewSymbol] ?? { d1: [], h1: [] };
  const priceAlignment = useMemo<PriceAlignmentSummary>(
    () => getPriceAlignment(reviewSymbol, pairCandles.d1, pairCandles.h1),
    [reviewSymbol, pairCandles.d1, pairCandles.h1],
  );
  const winningNow = useMemo<WinningNowSummary>(
    () =>
      getWhoIsWinningNow(
        reviewSymbol,
        trustState,
        macroSummary,
        strengthSummary,
        eventSensitivity,
        marketStatus,
        atrValue?.d1,
        atrValue?.h1,
        pairCandles.d1,
        pairCandles.h1,
      ),
    [reviewSymbol, trustState, macroSummary, strengthSummary, eventSensitivity, marketStatus, atrValue?.d1, atrValue?.h1, pairCandles.d1, pairCandles.h1],
  );
  const actions = useMemo(
    () => getAttentionActions(trustState, reviewSymbol, eventSensitivity, macroSummary, strengthSummary),
    [trustState, reviewSymbol, eventSensitivity, macroSummary, strengthSummary],
  );
  const resolvedBanks = snapshots.filter((snapshot) => snapshot.status === "ok").length;
  const pipelineStatus = useMemo(
    () => getOverviewPipelineStatus(trustState, feedStatus, marketStatus, resolvedBanks),
    [trustState, feedStatus, marketStatus, resolvedBanks],
  );
  const trustInspector = useMemo(
    () => getTrustInspectorSummary(trustState, feedStatus, marketStatus),
    [trustState, feedStatus, marketStatus],
  );
  const radarSummary = useMemo(
    () => getEventRadarSummary(reviewSymbol, topEvents, eventSensitivity),
    [reviewSymbol, topEvents, eventSensitivity],
  );
  const specialistSummaries = useMemo(
    () => getOverviewSpecialistSummaries(reviewSymbol, snapshots, events, nowUnix),
    [reviewSymbol, snapshots, events, nowUnix],
  );
  const relevantEvents = useMemo(
    () => events
      .filter((event) => event.impact === "high" && event.time >= nowUnix && (event.currency === pair?.base || event.currency === pair?.quote))
      .sort((left, right) => left.time - right.time),
    [events, nowUnix, pair?.base, pair?.quote],
  );
  const sortedPairs = useMemo(
    () => sortOverviewPairs(FX_PAIRS, pairSearchQuery, pairSortMode, Object.fromEntries(Object.entries(atrByPair).map(([k, v]) => [k, v.d1])), favoritePairs, pairSortDirection),
    [pairSearchQuery, pairSortMode, atrByPair, favoritePairs, pairSortDirection],
  );
  const topOpportunities = useMemo<PairOpportunitySummary[]>(() => {
    return FX_PAIRS.map((fxPair) => {
      const atr = atrByPair[fxPair.name];
      const candles = candlesByPair[fxPair.name] ?? { d1: [], h1: [] };
      return getPairOpportunitySummary(
        fxPair.name,
        trustState,
        snapshots,
        events,
        marketStatus,
        atr?.d1,
        atr?.h1,
        candles.d1,
        candles.h1,
        nowUnix,
      );
    })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        const actionGap = getActionRank(right.label) - getActionRank(left.label);
        if (actionGap !== 0) return actionGap;
        const winnerGap = getWinnerRank(right.winner) - getWinnerRank(left.winner);
        if (winnerGap !== 0) return winnerGap;
        return left.pair.localeCompare(right.pair);
      })
      .filter((item, index) => item.winner !== "unresolved" || index < 5)
      .slice(0, 5);
  }, [atrByPair, candlesByPair, trustState, snapshots, events, marketStatus, nowUnix]);

  const baseSnap = snapshots.find((s) => s.currency === pair?.base);
  const quoteSnap = snapshots.find((s) => s.currency === pair?.quote);
  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find((rank) => rank.currency === pair?.base);
  const quoteRank = ranks.find((rank) => rank.currency === pair?.quote);

  const isBridgeValid = health.terminal_connected && health.ok;

  useEffect(() => {
    let cancelled = false;
    const loadAtr = async () => {
      const entries = await Promise.all(
        FX_PAIRS.map(async (fxPair) => {
          try {
            const [d1Candles, h1Candles] = await Promise.all([
              fetchHistory(fxPair.name, "D1", 60),
              fetchHistory(fxPair.name, "H1", 60),
            ]);
            return [
              fxPair.name,
              {
                candles: { d1: d1Candles, h1: h1Candles },
                d1: calculateAtrPips(d1Candles, fxPair.name, atrConfig.d1Period, atrConfig.method),
                h1: calculateAtrPips(h1Candles, fxPair.name, atrConfig.h1Period, atrConfig.method),
              },
            ] as const;
          } catch {
            return [fxPair.name, { candles: { d1: [], h1: [] }, d1: null, h1: null }] as const;
          }
        }),
      );
      if (cancelled) return;
      setAtrByPair(
        Object.fromEntries(entries.map(([pairName, value]) => [pairName, { d1: value.d1, h1: value.h1 }])),
      );
      setCandlesByPair(
        Object.fromEntries(entries.map(([pairName, value]) => [pairName, value.candles])),
      );
    };
    void loadAtr();
    return () => {
      cancelled = true;
    };
  }, [atrConfig]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFavorites = () => setFavoritePairs(loadChartFavorites());
    syncFavorites();
    window.addEventListener("storage", syncFavorites);
    return () => window.removeEventListener("storage", syncFavorites);
  }, []);

  useEffect(() => {
    if (showPairSelector) {
      setFavoritePairs(loadChartFavorites());
    }
  }, [showPairSelector]);

  return (
    <section className={`tab-panel overview-panel is-view-${viewMode}`}>
      <div className="hub-container">
        {/* Left Column: Vitals & Action Plan */}
        <aside className="hub-column">
          <section className="hub-card">
            <header className="hub-card-header">
              <Monitor size={14} />
              <h3>{TERMINOLOGY.trustState.sectionLabel}</h3>
              <button
                type="button"
                className="hub-inline-help"
                aria-label="Explain trust state"
                onClick={() => setShowTrustInspector(true)}
              >
                <CircleHelp size={14} />
              </button>
            </header>
            <div className="hub-vitals-box">
              <div className="hub-vital-row">
                <label>{TERMINOLOGY.trustState.sectionLabel}</label>
                <span
                  style={{ color: trustState.tone === "good" ? "#10b981" : trustState.tone === "danger" ? "#ef4444" : "#f59e0b" }}
                >
                  {trustState.verdictLabel}
                </span>
              </div>
              <div className="hub-vital-row">
                <label>Bridge</label>
                <span style={{ color: isBridgeValid ? "#10b981" : "#ef4444" }}>{isBridgeValid ? "CONNECTED" : "OFFLINE"}</span>
              </div>
              <div className="hub-vital-row">
                <label>{TERMINOLOGY.calendarTiming.sectionLabel}</label>
                <span>{renderFeedLabel(feedStatus)}</span>
              </div>
              <div className="hub-vital-row">
                <label>{TERMINOLOGY.symbolContext.sectionLabel}</label>
                <span>{marketStatus?.session_state ? TERMINOLOGY.symbolContext.states[marketStatus.session_state].short.toUpperCase() : "---"}</span>
              </div>
            </div>
          </section>

          <section className="hub-card">
            <header className="hub-card-header">
              <Zap size={14} />
              <h3>Action Plan</h3>
            </header>
            <div className="hub-action-plan">
              {actions.map((action) => (
                <button key={action.label} className="hub-action-card" onClick={() => onNavigate(action.tab)}>
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                  <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontWeight: 800, color: "#6366f1" }}>
                    EXECUTE <ArrowRight size={12} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="hub-card" style={{ marginTop: "auto" }}>
            <header className="hub-card-header">
              <Layers size={14} />
              <h3>Terminal Ingest</h3>
            </header>
            <div className="hub-vitals-box">
              <div className="hub-vital-row">
                <label>{TERMINOLOGY.labels.resolvedBanks}</label>
                <span>{resolvedBanks}/8</span>
              </div>
              <div className="hub-vital-row">
                <label>{TERMINOLOGY.labels.lastIngest}</label>
                <span>{formatRelativeAge(health.last_calendar_ingest_at ?? null)}</span>
              </div>
            </div>
          </section>
        </aside>

        {/* Center Column: Main Analysis Hub */}
        <main className="hub-column">
          <header className="hub-main-header">
            <div className="hub-pair-selector">
              <span>Mission Control</span>
              <button className="hub-selector-button" onClick={() => setShowPairSelector(true)}>
                {reviewSymbol}
                <ChevronDown size={24} />
              </button>
            </div>
            <div className="hub-brief-vitals">
              <div className="hub-view-toggle">
                <button 
                  className={viewMode === "strategic" ? "is-active" : ""} 
                  onClick={() => switchViewMode("strategic")}
                >
                  STRATEGIC
                </button>
                <button 
                  className={viewMode === "command" ? "is-active" : ""} 
                  onClick={() => switchViewMode("command")}
                >
                  COMMAND
                </button>
              </div>
              <div className="hub-brief-stat">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label>VOL ({atrConfig.d1Period}D/{atrConfig.h1Period}H)</label>
                  <button 
                    className="hub-settings-trigger"
                    onClick={() => setShowAtrSettings(true)}
                    aria-label="Edit ATR Settings"
                  >
                    <Settings size={12} />
                  </button>
                </div>
                <span>{atrValue?.d1 ?? "--"}/{atrValue?.h1 ?? "--"} PIPS</span>
              </div>
            </div>
          </header>

          <article className={`hub-verdict-banner is-${winningNow.tone}`}>
            <div style={{ flex: 1 }}>
              <div className="hub-verdict-kicker">Who Is Winning Now</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: 1.05, marginTop: "4px" }}>{winningNow.winnerLabel}</div>
              <p style={{ fontSize: "1.02rem", marginTop: "12px", opacity: 0.92, lineHeight: 1.55, maxWidth: "680px" }}>
                {winningNow.summary}
              </p>
              <div className="hub-verdict-chip-row">
                <span className={`hub-banner-chip is-${winningNow.tone}`}>{CONVICTION_LABELS[winningNow.conviction]}</span>
                <span className="hub-banner-chip is-neutral" style={{ color: ACTION_LABEL_COLORS[winningNow.actionLabel] }}>{winningNow.actionLabel}</span>
                <span className="hub-banner-chip is-neutral">{eventSensitivity.label}</span>
              </div>
              <div className="hub-verdict-reasons">
                {winningNow.reasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </div>
              {winningNow.risks.length > 0 ? (
                <div className="hub-verdict-riskline">
                  Risk check: {winningNow.risks.join(" ")}
                </div>
              ) : null}
            </div>
            <Target size={48} strokeWidth={2.5} opacity={0.2} />
          </article>

          {viewMode === "strategic" ? (
            <div className="hub-dominance-pillars">
              <div className="hub-pillar">
                <label>MACRO PILLAR</label>
                <div className={`hub-pillar-badge is-${macroVerdict.tone}`}>
                  {macroVerdict.label}
                </div>
                <span>{macroSummary.rateGap != null ? `Rate Gap ${macroSummary.rateGap > 0 ? "+" : ""}${macroSummary.rateGap.toFixed(2)}%` : "Unresolved"}</span>
              </div>
              <div className="hub-pillar">
                <label>PRICE PILLAR</label>
                <div className={`hub-pillar-badge is-${priceAlignment.direction === winningNow.winner ? "good" : priceAlignment.direction === "unresolved" ? "warning" : "danger"}`}>
                  {priceAlignment.label}
                </div>
                <span>{priceAlignment.detail}</span>
              </div>
              <div className="hub-pillar">
                <label>TIMING PILLAR</label>
                <div className={`hub-pillar-badge is-${eventSensitivity.tone}`}>
                  {eventSensitivity.label}
                </div>
                <span>{winningNow.actionLabel}</span>
              </div>
            </div>
          ) : (
            <div className="hub-matrix">
              <div className="hub-matrix-cell">
                <div className="hub-matrix-header">
                  <FlagIcon countryCode={baseSnap?.countryCode || ""} className="h-5 w-8" />
                  <span className="hub-matrix-currency">{pair?.base}</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Strength Score</label>
                  <span style={{ fontSize: "1.1rem" }}>{baseRank?.score.toFixed(1) || "0.0"} pts</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Policy Rate</label>
                  <span>{baseSnap?.currentPolicyRate || "---"}</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Inflation (CPI)</label>
                  <span>{baseSnap?.currentInflationRate || "---"}</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Winning Now</label>
                  <span>{winningNow.winner === "base" ? winningNow.actionLabel : winningNow.winner === "quote" ? "Under pressure" : winningNow.winnerLabel}</span>
                </div>
              </div>
              <div className="hub-matrix-divider">
                <div className={`hub-dominance-arrow is-${winningNow.tone}`}>
                  {winningNow.winner === "base" ? (
                    <ChevronRight size={20} style={{ transform: "rotate(180deg)" }} />
                  ) : winningNow.winner === "quote" ? (
                    <ChevronRight size={20} />
                  ) : (
                    <div className="hub-conflict-dot" />
                  )}
                </div>
              </div>
              <div className="hub-matrix-cell">
                <div className="hub-matrix-header" style={{ flexDirection: "row-reverse" }}>
                  <FlagIcon countryCode={quoteSnap?.countryCode || ""} className="h-5 w-8" />
                  <span className="hub-matrix-currency">{pair?.quote}</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Strength Score</label>
                  <span style={{ fontSize: "1.1rem" }}>{quoteRank?.score.toFixed(1) || "0.0"} pts</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Policy Rate</label>
                  <span>{quoteSnap?.currentPolicyRate || "---"}</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Inflation (CPI)</label>
                  <span>{quoteSnap?.currentInflationRate || "---"}</span>
                </div>
                <div className="hub-matrix-stat">
                  <label>Winning Now</label>
                  <span>{winningNow.winner === "quote" ? winningNow.actionLabel : winningNow.winner === "base" ? "Under pressure" : winningNow.winnerLabel}</span>
                </div>
              </div>
            </div>
          )}

          <section className="hub-opportunity-box">
            <div className="hub-opportunity-head">
              <div>
                <div className="hub-opportunity-kicker">Routing Shortlist</div>
                <h3>Best Pairs Right Now</h3>
              </div>
              <span>Top 5 by current evidence</span>
            </div>
            <div className="hub-opportunity-list">
              {topOpportunities.map((item) => (
                <button
                  key={item.pair}
                  type="button"
                  className={`hub-opportunity-row ${item.pair === reviewSymbol ? "is-active" : ""}`}
                  onClick={() => onReviewSymbolChange(item.pair)}
                >
                  <div className="hub-opportunity-main">
                    <strong>{item.pair}</strong>
                    <span>{item.winnerLabel}</span>
                  </div>
                  <div className="hub-opportunity-meta">
                    <span>{item.score}</span>
                    <span>{item.label}</span>
                    <span>{item.eventLabel}</span>
                    <span>{item.atr14D ?? "--"} D1 ATR</span>
                  </div>
                  <p>{item.summary}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="hub-macro-box">
            <div className="hub-macro-title">
              <TrendingUp size={16} />
              {TERMINOLOGY.macroBackdrop.questionLabel}
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>
              {macroVerdict.label}: {macroSummary.title}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: "0.95rem", color: "#64748b", lineHeight: 1.6 }}>
              {macroVerdict.detail}
            </p>
          </div>
        </main>

        {/* Right Column: Timeline Radar & Status */}
        <aside className="hub-column" style={{ height: "100%" }}>
          <section className="hub-card" style={{ flex: 1 }}>
            <header className="hub-card-header">
              <CalendarClock size={14} />
              <h3>{TERMINOLOGY.eventSensitivity.sectionLabel}</h3>
              <button
                type="button"
                className="hub-inline-link"
                onClick={() => setShowEventInspector(true)}
              >
                View All
              </button>
            </header>
            <div className="hub-timeline">
              {topEvents.length > 0 ? (
                topEvents.map((event) => {
                  const isBase = event.currency === pair?.base;
                  const isQuote = event.currency === pair?.quote;
                  const diffMinutes = (event.time - currentTime.getTime() / 1000) / 60;
                  const isUrgent = diffMinutes > 0 && diffMinutes < 120; // Less than 2 hours

                  return (
                    <button 
                      key={event.id} 
                      className={`hub-timeline-item ${isUrgent ? "radar-urgency-pulse" : ""}`} 
                      onClick={() => onOpenCalendarEvent(event)}
                    >
                      <div className="hub-timeline-content">
                        <span className="hub-timeline-title">{event.title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="hub-timeline-meta">{event.currency} | {formatUtcDateTime(event.time)}</span>
                          {isBase && <span className="radar-relevance-tag radar-relevance-base">Base Impact</span>}
                          {isQuote && <span className="radar-relevance-tag radar-relevance-quote">Quote Impact</span>}
                          {!isBase && !isQuote && <span className="radar-relevance-tag radar-relevance-context">Broader Context</span>}
                        </div>
                      </div>
                      <span className="hub-timeline-time">{formatCountdown(event.time, currentTime.getTime())}</span>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                  Event horizon clear of high-impact releases.
                </div>
              )}
            </div>
            {topEvents.length > 0 ? (
              <div className="hub-radar-summary">
                <span>{radarSummary.relevantCount} pair-relevant, {radarSummary.contextCount} broader context</span>
                <strong>{radarSummary.nextRiskDetail}</strong>
              </div>
            ) : null}
          </section>

          <section className="hub-status-bar">
            <div className="hub-status-head">
              <div className="hub-status-label">{TERMINOLOGY.pipeline.sectionLabel}</div>
              <button
                type="button"
                className="hub-help-trigger"
                aria-label="Explain differential pipeline status"
                onClick={() => setShowPipelineInspector(true)}
              >
                <CircleHelp size={14} />
                <div className="hub-help-popover" role="tooltip">
                  <strong>What this means</strong>
                  <p>{pipelineStatus.explanation}</p>
                  <strong>Current factors</strong>
                  {pipelineStatus.factors.length > 0 ? (
                    <ul>
                      {pipelineStatus.factors.map((factor) => (
                        <li key={factor}>{factor}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No limiting factors are active right now.</p>
                  )}
                </div>
              </button>
            </div>
            <div className="hub-progress-track">
              <div className={`hub-progress-fill is-${pipelineStatus.tone}`} style={{ width: `${pipelineStatus.percent}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "10px" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: pipelineStatus.tone === "good" ? "#10b981" : pipelineStatus.tone === "danger" ? "#ef4444" : "#f59e0b" }}>
                {pipelineStatus.label}
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#1e293b" }}>
                {pipelineStatus.percent}%
              </div>
            </div>
            <div style={{ fontSize: "0.78rem", lineHeight: 1.4, color: "#94a3b8", marginTop: "8px" }}>
              {pipelineStatus.detail}
            </div>
          </section>
        </aside>
      </div>

      <section className="hub-specialists">
        <div className="hub-specialists-head">
          <div>
            <h3>Analytical Deep-Dive</h3>
            <p>Direct output from specialist modules synchronized with the {reviewSymbol} context.</p>
          </div>
        </div>
        <div className="hub-specialists-list">
          {specialistSummaries.map((card) => {
            const isExpanded = expandedSpecialistId === card.id;
            const SpecialistIcon = card.id === "strength-meter" ? Activity : card.id === "dashboard" ? Layers : ShieldCheck;
            return (
              <section key={card.id} className={`hub-specialist-card ${isExpanded ? "is-expanded" : ""}`}>
                <button
                  type="button"
                  className="hub-specialist-toggle"
                  onClick={() => setExpandedSpecialistId(isExpanded ? null : card.id)}
                >
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div className="hub-specialist-icon-box" style={{ color: "#6366f1" }}>
                      <SpecialistIcon size={20} />
                    </div>
                    <div className="hub-specialist-copy">
                      <strong>{card.title}</strong>
                      <span>{card.summary}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                {isExpanded && (
                  <div className="hub-specialist-body">
                    <ul>
                      {card.metrics.map((metric) => (
                        <li key={metric}>{metric}</li>
                      ))}
                    </ul>
                    <button type="button" className="hub-specialist-link" onClick={() => onNavigate(card.tab)}>
                      Launch {card.title}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>

      {showAtrSettings && (
        <div className="hub-inspector-overlay" onClick={() => setShowAtrSettings(false)}>
          <div
            className="hub-inspector-panel hub-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="ATR Indicator settings"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hub-inspector-top">
              <div>
                <div className="hub-inspector-kicker">TECHNICAL CONFIG</div>
                <h3>ATR INDICATOR</h3>
              </div>
              <button
                type="button"
                className="hub-inspector-close"
                onClick={() => setShowAtrSettings(false)}
                aria-label="Close ATR settings"
              >
                Close
              </button>
            </div>

            <div className="hub-detail-summary" style={{ background: "#f8fafc" }}>
              <strong>Method Intelligence</strong>
              <p>{ATR_METHOD_DESCRIPTIONS[atrConfig.method]}</p>
            </div>

            <div className="hub-inspector-grid" style={{ padding: "32px" }}>
              <section className="hub-inspector-card">
                <div className="hub-settings-field">
                  <label>SMOOTHING METHOD</label>
                  <select
                    value={atrConfig.method}
                    onChange={(e) => {
                      const next = { ...atrConfig, method: e.target.value as AtrSmoothingMethod };
                      setAtrConfig(next);
                      window.localStorage.setItem(OVERVIEW_ATR_CONFIG_KEY, JSON.stringify(next));
                    }}
                  >
                    <option value="RMA">RMA (Smoothed)</option>
                    <option value="SMA">SMA (Simple)</option>
                    <option value="EMA">EMA (Exponential)</option>
                    <option value="WMA">WMA (Weighted)</option>
                  </select>
                </div>
              </section>

              <section className="hub-inspector-card">
                <div className="hub-settings-field">
                  <label>D1 PERIOD (STRUCTURAL)</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={50}
                    value={atrConfig.d1Period}
                    onChange={(e) => {
                      const next = { ...atrConfig, d1Period: parseInt(e.target.value) || 14 };
                      setAtrConfig(next);
                      window.localStorage.setItem(OVERVIEW_ATR_CONFIG_KEY, JSON.stringify(next));
                    }}
                  />
                </div>
              </section>

              <section className="hub-inspector-card">
                <div className="hub-settings-field">
                  <label>H1 PERIOD (SESSION)</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={50}
                    value={atrConfig.h1Period}
                    onChange={(e) => {
                      const next = { ...atrConfig, h1Period: parseInt(e.target.value) || 14 };
                      setAtrConfig(next);
                      window.localStorage.setItem(OVERVIEW_ATR_CONFIG_KEY, JSON.stringify(next));
                    }}
                  />
                </div>
              </section>

              <section className="hub-inspector-card">
                <span>Configuration Note</span>
                <p>These settings influence volatility-based prioritization and sorting throughout the terminal.</p>
              </section>
            </div>
          </div>
        </div>
      )}

      {showTrustInspector && (
        <div className="hub-inspector-overlay" onClick={() => setShowTrustInspector(false)}>
          <div
            className="hub-inspector-panel hub-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Trust state details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hub-inspector-top">
              <div>
                <div className="hub-inspector-kicker">{TERMINOLOGY.trustState.sectionLabel}</div>
                <h3>{trustState.verdictLabel}</h3>
              </div>
              <button
                type="button"
                className="hub-inspector-close"
                onClick={() => setShowTrustInspector(false)}
                aria-label="Close trust state details"
              >
                Close
              </button>
            </div>

            <div className="hub-detail-summary">
              <strong>{trustInspector.title}</strong>
              <p>{trustState.detail}</p>
            </div>

            <div className="hub-inspector-grid">
              <section className="hub-inspector-card">
                <span>Analytical Context</span>
                <p>{TERMINOLOGY.trustState.states[trustState.verdict].detail}</p>
              </section>

              <section className="hub-inspector-card">
                <span>Trust-Supporting Inputs</span>
                <ul>
                  {trustInspector.supportingInputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="hub-inspector-card">
                <span>Trust-Limiting Factors</span>
                <ul>
                  {trustInspector.limitingInputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="hub-inspector-card">
                <span>System Dependencies</span>
                <ul>
                  {trustInspector.affects.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {showEventInspector && (
        <div className="hub-inspector-overlay" onClick={() => setShowEventInspector(false)}>
          <div
            className="hub-inspector-panel hub-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Relevant event sensitivity details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hub-inspector-top">
              <div>
                <div className="hub-inspector-kicker">{TERMINOLOGY.eventSensitivity.sectionLabel}</div>
                <h3>{reviewSymbol} Relevant Risk</h3>
              </div>
              <button
                type="button"
                className="hub-inspector-close"
                onClick={() => setShowEventInspector(false)}
                aria-label="Close relevant events details"
              >
                Close
              </button>
            </div>

            <div className="hub-detail-summary">
              <strong>{eventSensitivity.label} Status</strong>
              <p>{eventSensitivity.detail}</p>
            </div>

            <div className="hub-event-inspector-list">
              {relevantEvents.length > 0 ? (
                relevantEvents.map((event) => {
                  const sideLabel = event.currency === pair?.base ? "Base Impact" : "Quote Impact";
                  return (
                    <button
                      key={`${event.id}-${event.time}`}
                      type="button"
                      className="hub-event-inspector-item"
                      onClick={() => {
                        setShowEventInspector(false);
                        onOpenCalendarEvent(event);
                      }}
                    >
                      <div className="hub-event-inspector-copy">
                        <strong>{event.title}</strong>
                        <span>{event.currency} | {formatUtcDateTime(event.time)}</span>
                      </div>
                      <div className="hub-event-inspector-meta">
                        <span className={`radar-relevance-tag ${event.currency === pair?.base ? "radar-relevance-base" : "radar-relevance-quote"}`}>{sideLabel}</span>
                        <strong>{formatCountdown(event.time, currentTime.getTime())}</strong>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="hub-event-inspector-empty">
                  No future pair-relevant high-impact events are active for {reviewSymbol}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPipelineInspector && (
        <div className="hub-inspector-overlay" onClick={() => setShowPipelineInspector(false)}>
          <div
            className="hub-inspector-panel hub-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Overview confidence details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hub-inspector-top">
              <div>
                <div className="hub-inspector-kicker">{TERMINOLOGY.pipeline.sectionLabel}</div>
                <h3>{pipelineStatus.label} Confidence</h3>
              </div>
              <button
                type="button"
                className="hub-inspector-close"
                onClick={() => setShowPipelineInspector(false)}
                aria-label="Close pipeline status details"
              >
                Close
              </button>
            </div>

            <div className="hub-inspector-metric-row">
              <div className="hub-inspector-meter">
                <div className="hub-inspector-meter-head">
                  <span>Trust Score</span>
                  <strong>{pipelineStatus.label}</strong>
                </div>
                <div className="hub-progress-track">
                  <div className={`hub-progress-fill is-${pipelineStatus.tone}`} style={{ width: `${pipelineStatus.percent}%` }} />
                </div>
                <p>{pipelineStatus.detail}</p>
              </div>
              <div className="hub-inspector-percent">{pipelineStatus.percent}%</div>
            </div>

            <div className="hub-inspector-grid">
              <section className="hub-inspector-card hub-inspector-card-wide">
                <span>Weighted Methodology</span>
                <p>{pipelineStatus.explanation}</p>
                <div className="hub-inspector-weight-list">
                  {pipelineStatus.weights.map((weight) => (
                    <div key={weight.label} className="hub-inspector-weight-row">
                      <div className="hub-inspector-weight-main">
                        <strong>{weight.label}</strong>
                        <span>{weight.state}</span>
                      </div>
                      <div className="hub-inspector-weight-score">
                        {weight.earned}/{weight.max}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="hub-inspector-card">
                <span>Active Limiting Factors</span>
                {pipelineStatus.factors.length > 0 ? (
                  <ul>
                    {pipelineStatus.factors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No limiting factors are active right now.</p>
                )}
              </section>

              <section className="hub-inspector-card">
                <span>Live Feed Context</span>
                <ul>
                  <li>{TERMINOLOGY.trustState.sectionLabel}: {trustState.verdictLabel}</li>
                  <li>{TERMINOLOGY.calendarTiming.sectionLabel}: {TERMINOLOGY.calendarTiming.states[feedStatus].medium}</li>
                  <li>{TERMINOLOGY.symbolContext.sectionLabel}: {marketStatus?.session_state ? TERMINOLOGY.symbolContext.states[marketStatus.session_state].medium : TERMINOLOGY.symbolContext.states.missing.medium}</li>
                  <li>{TERMINOLOGY.labels.resolvedBanks}: {resolvedBanks}/8</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {showPairSelector && (
        <div className="hub-selector-overlay" onClick={() => setShowPairSelector(false)}>
          <div 
            className="hub-selector-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="hub-selector-search">
              <Search size={18} />
              <input 
                type="text" 
                autoFocus
                placeholder="Search pairs (e.g. EUR, JPY)..."
                value={pairSearchQuery}
                onChange={(e) => setPairSearchQuery(e.target.value)}
              />
            </div>
            <div className="hub-selector-sortbar">
              <button
                type="button"
                className={`hub-sort-chip ${pairSortMode === "favorites" ? "is-active" : ""}`}
                onClick={() => setPairSortMode("favorites")}
              >
                Favorites First
              </button>
              <button
                type="button"
                className={`hub-sort-chip ${pairSortMode === "volatility" ? "is-active" : ""}`}
                onClick={() => {
                  if (pairSortMode === "volatility") {
                    setPairSortDirection(pairSortDirection === "desc" ? "asc" : "desc");
                  } else {
                    setPairSortMode("volatility");
                    setPairSortDirection("desc");
                  }
                }}
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                Volatility {pairSortMode === "volatility" && (pairSortDirection === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
              </button>
              <button
                type="button"
                className={`hub-sort-chip ${pairSortMode === "alphabetical" ? "is-active" : ""}`}
                onClick={() => setPairSortMode("alphabetical")}
              >
                A-Z
              </button>
            </div>
            <div className="hub-selector-list">
              {sortedPairs.map((p) => {
                const isSelected = p.name === reviewSymbol;
                const atr = atrByPair[p.name];
                const isFavorite = favoritePairs.includes(p.name);
                return (
                  <button 
                    key={p.name}
                    className={`hub-selector-item ${isSelected ? "is-active" : ""}`}
                    onClick={() => {
                      onReviewSymbolChange(p.name);
                      setShowPairSelector(false);
                      setPairSearchQuery("");
                    }}
                  >
                    <div className="hub-selector-item-main">
                      <button
                        type="button"
                        className={`hub-favorite-toggle ${isFavorite ? "is-active" : ""}`}
                        onClick={(e) => toggleFavorite(p.name, e)}
                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
                      </button>
                      <div className="hub-selector-item-flags">
                        <FlagIcon countryCode={snapshots.find(s => s.currency === p.base)?.countryCode || ""} className="h-4 w-6" />
                        <FlagIcon countryCode={snapshots.find(s => s.currency === p.quote)?.countryCode || ""} className="h-4 w-6" />
                      </div>
                      <div className="hub-selector-item-copy">
                        <span className="hub-selector-item-name">{p.name}</span>
                      </div>
                    </div>
                    <div className="hub-selector-item-meta">
                      <span className="hub-selector-item-atr">{atr?.d1 ?? "--"} PIPS</span>
                      <span className="hub-selector-item-label">{atrConfig.d1Period}D VOLATILITY</span>
                    </div>
                  </button>
                );
              })}
              {sortedPairs.length === 0 && (
                <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>
                  No pairs found matching "{pairSearchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
