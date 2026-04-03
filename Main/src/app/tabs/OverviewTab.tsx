import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, CalendarClock, Check, Info, ShieldCheck, Target, TrendingUp, Monitor, Zap, Layers, CircleHelp } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { calculateAtr14Pips } from "@/app/lib/atr";
import { fetchHistory } from "@/app/lib/bridge";
import { formatCountdown, formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import {
  getEventSensitivity,
  getMacroBackdropVerdict,
  getMacroSummary,
  getOverviewPipelineStatus,
  getPairAttentionVerdict,
  getStrengthDifferentialSummary,
  getTopEvents,
} from "@/app/lib/overview";
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
  if (status === "live") return "LIVE";
  if (status === "stale") return "STALE";
  if (status === "loading") return "SYNC";
  return "OFF";
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
  const [showPipelineInspector, setShowPipelineInspector] = useState(false);
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

  const pair = getFxPairByName(reviewSymbol);
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

  return (
    <section className="tab-panel overview-panel">
      <div className="hub-container">
        {/* Left Column: Vitals & Action Plan */}
        <aside className="hub-column">
          <section className="hub-card">
            <header className="hub-card-header">
              <Monitor size={14} />
              <h3>System Status</h3>
            </header>
            <div className="hub-vitals-box">
              <div className="hub-vital-row">
                <label>App Trust</label>
                <span style={{ color: trustState.tone === "good" ? "#10b981" : trustState.tone === "danger" ? "#ef4444" : "#f59e0b" }}>
                  {trustState.verdictLabel}
                </span>
              </div>
              <div className="hub-vital-row">
                <label>Bridge</label>
                <span style={{ color: isBridgeValid ? "#10b981" : "#ef4444" }}>{isBridgeValid ? "CONNECTED" : "OFFLINE"}</span>
              </div>
              <div className="hub-vital-row">
                <label>Calendar Feed</label>
                <span>{renderFeedLabel(feedStatus)}</span>
              </div>
              <div className="hub-vital-row">
                <label>Market Session</label>
                <span>{marketStatus?.session_state.toUpperCase() || "---"}</span>
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
                <label>CB Snapshots</label>
                <span>{snapshots.length}/8</span>
              </div>
              <div className="hub-vital-row">
                <label>Last Ingest</label>
                <span>{formatRelativeAge(health.last_calendar_ingest_at ?? null)}</span>
              </div>
            </div>
          </section>
        </aside>

        {/* Center Column: Main Analysis Hub */}
        <main className="hub-column">
          <header className="hub-main-header">
            <div className="hub-pair-selector">
              <span>Operational Briefing</span>
              <select value={reviewSymbol} onChange={(e) => onReviewSymbolChange(e.target.value)}>
                {FX_PAIRS.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="hub-brief-vitals">
              <div className="hub-brief-stat">
                <label>Volatility</label>
                <span>{atrValue ?? "--"} pips</span>
              </div>
              <div className="hub-brief-stat">
                <label>Bridge Conn</label>
                <span style={{ color: isBridgeValid ? "#10b981" : "#ef4444" }}>{isBridgeValid ? "Active" : "Issue"}</span>
              </div>
              <div className="hub-brief-stat">
                <label>Feed Pulse</label>
                <span>{renderFeedLabel(feedStatus)}</span>
              </div>
            </div>
          </header>

          <article className={`hub-verdict-banner is-${pairAttentionVerdict.tone}`}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", opacity: 0.8, letterSpacing: "0.1em" }}>Operational Status</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 900, lineHeight: 1.1 }}>{pairAttentionVerdict.label}</div>
              <p style={{ fontSize: "1rem", marginTop: "8px", opacity: 0.9, margin: "8px 0 0", maxWidth: "600px", lineHeight: 1.4 }}>
                {pairAttentionVerdict.detail}
              </p>
            </div>
            <Target size={32} />
          </article>

          <div className="hub-matrix">
            <div className="hub-matrix-cell">
              <div className="hub-matrix-header">
                <FlagIcon countryCode={baseSnap?.countryCode || ""} className="h-4 w-6" />
                <span className="hub-matrix-currency">{pair?.base}</span>
              </div>
              <div className="hub-matrix-stat">
                <label>Strength Score</label>
                <span>{baseRank?.score.toFixed(1) || "0.0"} pts</span>
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
                <FlagIcon countryCode={quoteSnap?.countryCode || ""} className="h-4 w-6" />
                <span className="hub-matrix-currency">{pair?.quote}</span>
              </div>
              <div className="hub-matrix-stat">
                <label>Strength Score</label>
                <span>{quoteRank?.score.toFixed(1) || "0.0"} pts</span>
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
              Macro Backdrop Verdict
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
              <h3>Timeline Radar</h3>
            </header>
            <div className="hub-timeline">
              {topEvents.length > 0 ? (
                topEvents.map((event) => (
                  <button key={event.id} className="hub-timeline-item" onClick={() => onNavigate("calendar")}>
                    <div className="hub-timeline-content">
                      <span className="hub-timeline-title">{event.title}</span>
                      <span className="hub-timeline-meta">{event.currency} | {formatUtcDateTime(event.time)}</span>
                    </div>
                    <span className="hub-timeline-time">{formatCountdown(event.time, currentTime.getTime())}</span>
                  </button>
                ))
              ) : (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                  Event horizon clear of high-impact releases.
                </div>
              )}
            </div>
          </section>

          <section className="hub-status-bar">
            <div className="hub-status-head">
              <div className="hub-status-label">Differential Pipeline Status</div>
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
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: pipelineStatus.tone === "good" ? "#34d399" : pipelineStatus.tone === "danger" ? "#f87171" : "#fbbf24" }}>
                {pipelineStatus.label}
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#f8fafc" }}>
                {pipelineStatus.percent}%
              </div>
            </div>
            <div style={{ fontSize: "0.78rem", lineHeight: 1.4, color: "#94a3b8", marginTop: "8px" }}>
              {pipelineStatus.detail}
            </div>
          </section>
        </aside>
      </div>

      {showPipelineInspector && (
        <div className="hub-inspector-overlay" onClick={() => setShowPipelineInspector(false)}>
          <div
            className="hub-inspector-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Differential pipeline status details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hub-inspector-top">
              <div>
                <div className="hub-inspector-kicker">Differential Pipeline Status</div>
                <h3>{pipelineStatus.label}</h3>
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
                <div className="hub-progress-track">
                  <div className={`hub-progress-fill is-${pipelineStatus.tone}`} style={{ width: `${pipelineStatus.percent}%` }} />
                </div>
                <p>{pipelineStatus.detail}</p>
              </div>
              <div className="hub-inspector-percent">{pipelineStatus.percent}%</div>
            </div>

            <div className="hub-inspector-grid">
              <section className="hub-inspector-card">
                <span>What this combines</span>
                <p>{pipelineStatus.explanation}</p>
              </section>

              <section className="hub-inspector-card">
                <span>Current live inputs</span>
                <ul>
                  <li>Trust state: {trustState.verdictLabel}</li>
                  <li>Calendar feed: {renderFeedLabel(feedStatus)}</li>
                  <li>Selected symbol context: {marketStatus?.session_state ?? "unavailable"}</li>
                  <li>Resolved macro coverage: {resolvedBanks}/8</li>
                </ul>
              </section>

              <section className="hub-inspector-card">
                <span>Current limiting factors</span>
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
                <span>What this affects</span>
                <ul>
                  <li>Overview trust confidence</li>
                  <li>Event timing confidence</li>
                  <li>Macro coverage confidence</li>
                  <li>Pair-routing confidence</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
