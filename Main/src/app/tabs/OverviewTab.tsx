import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, CalendarClock, Check, Info, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { calculateAtr14Pips } from "@/app/lib/atr";
import { fetchHistory } from "@/app/lib/bridge";
import { formatCountdown, formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import {
  getEventSensitivity,
  getMacroBackdropVerdict,
  getMacroSummary,
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
  if (status === "live") return "Live";
  if (status === "stale") return "Stale";
  if (status === "loading") return "Syncing";
  return "Disconnected";
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

  const pair = getFxPairByName(reviewSymbol);
  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find((rank) => rank.currency === pair?.base);
  const quoteRank = ranks.find((rank) => rank.currency === pair?.quote);

  const isBridgeValid = health.terminal_connected && health.ok;
  const isRiskValid = eventSensitivity.label === "Clear";
  const isMacroValid = !macroSummary.unresolved && macroVerdict.label !== "Supportive";
  const isStrengthValid = strengthSummary.decisive;

  const spreadPercentage = useMemo(() => {
    if (!baseRank || !quoteRank) return 50;
    const diff = baseRank.score - quoteRank.score;
    const pos = 50 + (diff * 5); // Expanded scale for visual impact
    return Math.min(Math.max(pos, 5), 95);
  }, [baseRank, quoteRank]);

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
      <div className="tactical-brief-container">
        <header className="tactical-header">
          <div className="tactical-pair-info">
            <span className="tactical-pair-sub">Operational Briefing</span>
            <select
              className="tactical-pair-select"
              value={reviewSymbol}
              onChange={(e) => onReviewSymbolChange(e.target.value)}
            >
              {FX_PAIRS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="tactical-vitals">
            <div className="tactical-vital-item">
              <span className="tactical-vital-label">Volatility</span>
              <span className="tactical-vital-value">{atrValue ?? "--"} pips</span>
            </div>
            <div className="tactical-vital-item">
              <span className="tactical-vital-label">Bridge</span>
              <span className="tactical-vital-value">{isBridgeValid ? "Active" : "Issue"}</span>
            </div>
            <div className="tactical-vital-item">
              <span className="tactical-vital-label">Feed</span>
              <span className="tactical-vital-value">{renderFeedLabel(feedStatus)}</span>
            </div>
          </div>
        </header>

        <article className={`tactical-verdict-hero is-${pairAttentionVerdict.tone}`}>
          <span className="tactical-verdict-label">Attention Verdict</span>
          <h2 className="tactical-verdict-title">{pairAttentionVerdict.label}</h2>
          <p className="tactical-verdict-desc">{pairAttentionVerdict.detail}</p>
          
          <div className="tactical-checklist">
            <div className={`tactical-check-item ${isBridgeValid ? "is-valid" : ""}`}>
              <div className="tactical-check-dot" /> Bridge
            </div>
            <div className={`tactical-check-item ${isRiskValid ? "is-valid" : ""}`}>
              <div className="tactical-check-dot" /> Event Risk
            </div>
            <div className={`tactical-check-item ${isMacroValid ? "is-valid" : ""}`}>
              <div className="tactical-check-dot" /> Macro Alignment
            </div>
            <div className={`tactical-check-item ${isStrengthValid ? "is-valid" : ""}`}>
              <div className="tactical-check-dot" /> Decisive Strength
            </div>
          </div>
        </article>

        <div className="tactical-grid">
          <section className="tactical-card">
            <div className="tactical-card-title"><Activity size={14} /> Strength Dynamics</div>
            <div className="tactical-spread-viz">
              <div className="tactical-spread-labels">
                <span>{pair?.base}</span>
                <span>{pair?.quote}</span>
              </div>
              <div className="tactical-spread-track">
                <div 
                  className="tactical-spread-bar" 
                  style={{ 
                    left: spreadPercentage > 50 ? "50%" : `${spreadPercentage}%`,
                    right: spreadPercentage > 50 ? `${100 - spreadPercentage}%` : "50%"
                  }} 
                />
              </div>
              <div className="tactical-spread-labels">
                <span>{baseRank?.score.toFixed(1) || "0.0"}</span>
                <span>{quoteRank?.score.toFixed(1) || "0.0"}</span>
              </div>
            </div>
            <div className="tactical-action-content">
              <span className="tactical-action-label">{strengthSummary.title}</span>
              <span className="tactical-action-detail">{strengthSummary.detail}</span>
            </div>
          </section>

          <section className="tactical-card">
            <div className="tactical-card-title"><CalendarClock size={14} /> Risk Radar</div>
            <div className="tactical-event-list">
              {topEvents.length > 0 ? (
                topEvents.map((event) => (
                  <button key={event.id} className="tactical-event-row" onClick={() => onNavigate("calendar")}>
                    <div className="tactical-event-info">
                      <span className="tactical-event-title">{event.title}</span>
                      <span className="tactical-event-meta">{event.currency} | {formatUtcDateTime(event.time)}</span>
                    </div>
                    <span className="tactical-event-time">{formatCountdown(event.time, currentTime.getTime())}</span>
                  </button>
                ))
              ) : (
                <p className="tactical-action-detail">No high-impact events detected.</p>
              )}
            </div>
          </section>

          <section className="tactical-card" style={{ gridColumn: "span 2" }}>
            <div className="tactical-card-title"><TrendingUp size={14} /> Macro Evidence</div>
            <div className="tactical-action-content">
              <span className="tactical-action-label">{macroVerdict.label}: {macroSummary.title}</span>
              <span className="tactical-action-detail">{macroVerdict.detail}</span>
            </div>
            <div className="tactical-action-list" style={{ marginTop: "12px" }}>
              {actions.map((action) => (
                <button key={action.label} className="tactical-action-item" onClick={() => onNavigate(action.tab)}>
                  <div className="tactical-action-content">
                    <span className="tactical-action-label">{action.label}</span>
                    <span className="tactical-action-detail">{action.detail}</span>
                  </div>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
