import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, ChevronDown, ChevronRight, CircleHelp, Layers, Monitor, Search, Target, TrendingUp, Zap } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { TERMINOLOGY } from "@/app/config/terminology";
import { calculateAtr14Pips } from "@/app/lib/atr";
import { fetchHistory } from "@/app/lib/bridge";
import { formatCountdown, formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import {
  getEventRadarSummary,
  getEventSensitivity,
  getMacroBackdropVerdict,
  getMacroSummary,
  getOverviewPipelineStatus,
  getOverviewSpecialistSummaries,
  getPairAttentionVerdict,
  getStrengthDifferentialSummary,
  getTopEvents,
  getTrustInspectorSummary,
  sortOverviewPairs,
  type OverviewPairSortMode,
} from "@/app/lib/overview";
import { adaptDashboardCurrencies, deriveStrengthCurrencyRanks } from "@/app/lib/macroViews";
import { resolveTrustState, type TrustState } from "@/app/lib/status";
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
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

interface ActionItem {
  tab: TabId;
  label: string;
  detail: string;
}

type AtrByPair = Record<string, number | null | undefined>;
type SpecialistCardId = "strength-meter" | "dashboard" | "event-quality";

const CHART_FAVORITES_KEY = "fyodor-main-chart-favorites";

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
  const [showPipelineInspector, setShowPipelineInspector] = useState(false);
  const [showTrustInspector, setShowTrustInspector] = useState(false);
  const [showEventInspector, setShowEventInspector] = useState(false);
  const [showPairSelector, setShowPairSelector] = useState(false);
  const [pairSearchQuery, setPairSearchQuery] = useState("");
  const [pairSortMode, setPairSortMode] = useState<OverviewPairSortMode>("favorites");
  const [favoritePairs, setFavoritePairs] = useState<string[]>(() => loadChartFavorites());
  const [expandedSpecialists, setExpandedSpecialists] = useState<Record<SpecialistCardId, boolean>>({
    "strength-meter": false,
    dashboard: false,
    "event-quality": false,
  });

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
  const pairAttentionVerdict = useMemo(
    () => getPairAttentionVerdict(reviewSymbol, trustState, macroVerdict, macroSummary, strengthSummary, eventSensitivity, atrValue),
    [reviewSymbol, trustState, macroVerdict, macroSummary, strengthSummary, eventSensitivity, atrValue],
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
    () => sortOverviewPairs(FX_PAIRS, pairSearchQuery, pairSortMode, atrByPair, favoritePairs),
    [pairSearchQuery, pairSortMode, atrByPair, favoritePairs],
  );

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
    <section className="tab-panel overview-panel">
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
              <div className="hub-brief-stat">
                <label>{TERMINOLOGY.labels.volatility}</label>
                <span>{atrValue ?? "--"} pips</span>
              </div>
              <div className="hub-brief-stat">
                <label>{TERMINOLOGY.labels.bridge}</label>
                <span style={{ color: isBridgeValid ? "#10b981" : "#ef4444" }}>{isBridgeValid ? "Live" : "Issue"}</span>
              </div>
              <div className="hub-brief-stat">
                <label>{TERMINOLOGY.calendarTiming.sectionLabel}</label>
                <span>{renderFeedLabel(feedStatus)}</span>
              </div>
            </div>
          </header>

          <article className={`hub-verdict-banner is-${pairAttentionVerdict.tone}`}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", opacity: 0.7, letterSpacing: "0.15em" }}>{TERMINOLOGY.pairAttention.sectionLabel}</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: 1, marginTop: "4px" }}>{pairAttentionVerdict.label}</div>
              <p style={{ fontSize: "1.1rem", marginTop: "12px", opacity: 0.9, lineHeight: 1.5, maxWidth: "540px" }}>
                {pairAttentionVerdict.detail}
              </p>
            </div>
            <Target size={48} strokeWidth={2.5} opacity={0.2} />
          </article>

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
            </div>
            <div className="hub-matrix-divider" />
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
            </div>
          </div>

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
            const isExpanded = expandedSpecialists[card.id];
            const SpecialistIcon = card.id === "strength-meter" ? Activity : card.id === "dashboard" ? Layers : ShieldCheck;
            return (
              <section key={card.id} className={`hub-specialist-card ${isExpanded ? "is-expanded" : ""}`}>
                <button
                  type="button"
                  className="hub-specialist-toggle"
                  onClick={() =>
                    setExpandedSpecialists((current) => ({
                      ...current,
                      [card.id]: !current[card.id],
                    }))
                  }
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
                {isExpanded ? (
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
                ) : null}
              </section>
            );
          })}
        </div>
      </section>

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
                onClick={() => setPairSortMode("volatility")}
              >
                Volatility
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
                      <div className="hub-selector-item-flags">
                        <FlagIcon countryCode={snapshots.find(s => s.currency === p.base)?.countryCode || ""} className="h-4 w-6" />
                        <FlagIcon countryCode={snapshots.find(s => s.currency === p.quote)?.countryCode || ""} className="h-4 w-6" />
                      </div>
                      <div className="hub-selector-item-copy">
                        <span className="hub-selector-item-name">{p.name}</span>
                        {isFavorite ? <span className="hub-selector-item-badge">Favorite</span> : null}
                      </div>
                    </div>
                    <div className="hub-selector-item-meta">
                      <span className="hub-selector-item-atr">{atr ?? "--"} pips</span>
                      <span className="hub-selector-item-label">14D VOLATILITY</span>
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
