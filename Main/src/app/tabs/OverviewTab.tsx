import { useEffect, useMemo, useState } from "react";
import { 
  AlertTriangle, ArrowRight, CalendarClock, ChartCandlestick, 
  ShieldCheck, Zap, Info, Target, TrendingUp, Cpu, 
  Activity, Globe, ChevronRight 
} from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { getCountryDisplayName } from "@/app/config/currencyConfig";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { fetchHistory } from "@/app/lib/bridge";
import { formatCountdown, formatDateOnly, formatRelativeAge, formatUtcDateTime, parseNumericValue } from "@/app/lib/format";
import { calculateAtr14Pips } from "@/app/lib/atr";
import { adaptDashboardCurrencies, deriveStrengthCurrencyRanks } from "@/app/lib/macroViews";
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

interface PairSummary {
  title: string;
  detail: string;
  unresolved: boolean;
  value?: number; // Normalized 0-100 for gauges
}

type AtrByPair = Record<string, number | null | undefined>;

function getSystemReadiness(
  health: BridgeHealth,
  feedStatus: BridgeStatus,
  marketStatus: MarketStatusResponse | null,
): {
  tone: "good" | "warning" | "danger";
  title: string;
  note: string;
  color: string;
} {
  if (!health.terminal_connected) {
    return {
      tone: "danger",
      title: "MT5 LINK SEVERED",
      note: "Establish secure connection with MetaTrader 5 to begin analysis.",
      color: "#f87171"
    };
  }

  if (!health.ok) {
    return {
      tone: "danger",
      title: "BRIDGE CRITICAL",
      note: "Internal health checks failed. Data integrity is unverified.",
      color: "#f87171"
    };
  }

  if (feedStatus === "error" || feedStatus === "no_data") {
    return {
      tone: "danger",
      title: "TIMING DATA LOST",
      note: "High-impact event feed is offline. Risk radar is inactive.",
      color: "#f87171"
    };
  }

  if (feedStatus === "loading" || feedStatus === "stale") {
    return {
      tone: "warning",
      title: "CONTEXT LAG DETECTED",
      note: "Calendar feed is slightly behind. Cross-reference manually.",
      color: "#fbbf24"
    };
  }

  return {
    tone: "good",
    title: "MISSION READY",
    note: "All systems reporting green. Pair context and risk radar are active.",
    color: "#4ade80"
  };
}

function getTopEvents(events: CalendarEvent[], reviewSymbol: string): Array<CalendarEvent & { relevant: boolean }> {
  const now = Date.now() / 1000;
  const symbolCurrencies = [reviewSymbol.slice(0, 3), reviewSymbol.slice(3, 6)];

  return events
    .filter((event) => event.impact === "high" && event.time >= now)
    .sort((a, b) => a.time - b.time)
    .slice(0, 4)
    .map((event) => ({
      ...event,
      relevant: symbolCurrencies.includes(event.currency),
    }));
}

function getMacroSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): PairSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) return { title: "N/A", detail: "N/A", unresolved: true };

  const baseSnapshot = snapshots.find((item) => item.currency === pair.base) ?? null;
  const quoteSnapshot = snapshots.find((item) => item.currency === pair.quote) ?? null;

  if (!baseSnapshot || !quoteSnapshot) return { title: "INCOMPLETE", detail: "Missing Snapshots", unresolved: true };

  const baseRate = parseNumericValue(baseSnapshot.currentPolicyRate ?? "");
  const quoteRate = parseNumericValue(quoteSnapshot.currentPolicyRate ?? "");
  const rateGap = baseRate != null && quoteRate != null ? baseRate - quoteRate : 0;
  
  // Normalize rateGap (-5% to +5%) to 0-100%
  const normalized = Math.min(Math.max(((rateGap + 5) / 10) * 100, 0), 100);

  return {
    title: "Macro Gap",
    detail: `${rateGap >= 0 ? "+" : ""}${rateGap.toFixed(2)}%`,
    unresolved: baseSnapshot.status !== "ok" || quoteSnapshot.status !== "ok",
    value: normalized
  };
}

function getStrengthSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): PairSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) return { title: "N/A", detail: "N/A", unresolved: true };

  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find((item) => item.currency === pair.base) ?? null;
  const quoteRank = ranks.find((item) => item.currency === pair.quote) ?? null;

  if (!baseRank || !quoteRank) return { title: "INCOMPLETE", detail: "Ranks Missing", unresolved: true };

  const diff = baseRank.score - quoteRank.score;
  // Normalize diff (-20 to +20) to 0-100%
  const normalized = Math.min(Math.max(((diff + 20) / 40) * 100, 0), 100);

  return {
    title: "Strength Diff",
    detail: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pts`,
    unresolved: false,
    value: normalized
  };
}

function getAttentionActions(
  readinessTone: string,
  reviewSymbol: string,
  events: Array<CalendarEvent & { relevant: boolean }>,
): ActionItem[] {
  const actions: ActionItem[] = [];
  if (readinessTone !== "good") actions.push({ tab: "calendar", label: "System Health", detail: "Check connectivity" });
  if (events.some(e => e.relevant)) actions.push({ tab: "calendar", label: "Risk Event", detail: "High impact detected" });
  actions.push({ tab: "central-banks", label: "Macro Deep-Dive", detail: "Review snapshots" });
  actions.push({ tab: "charts", label: "Open Charts", detail: "Technical setup" });
  return actions.slice(0, 3);
}

export function OverviewTab({
  currentTime, health, feedStatus, marketStatus, 
  reviewSymbol, onReviewSymbolChange, events, snapshots, onNavigate
}: OverviewTabProps) {
  const [atrByPair, setAtrByPair] = useState<AtrByPair>({});
  const readiness = getSystemReadiness(health, feedStatus, marketStatus);
  const topEvents = getTopEvents(events, reviewSymbol);
  const macro = useMemo(() => getMacroSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const strength = useMemo(() => getStrengthSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const actions = getAttentionActions(readiness.tone, reviewSymbol, topEvents);
  const lastIngestLabel = formatRelativeAge(health.last_calendar_ingest_at ?? null);

  useEffect(() => {
    let cancelled = false;
    const loadAtr = async () => {
      const entries = await Promise.all(FX_PAIRS.map(async (pair) => {
        try {
          const candles = await fetchHistory(pair.name, "D1", 60);
          return [pair.name, calculateAtr14Pips(candles, pair.name)] as const;
        } catch { return [pair.name, null] as const; }
      }));
      if (!cancelled) setAtrByPair(Object.fromEntries(entries));
    };
    void loadAtr();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="tab-panel overview-panel" style={{ background: "#08090d", padding: "20px", borderRadius: "24px" }}>
      <div className="hud-container">
        {/* Topbar */}
        <div className="hud-topbar">
          <div className="hud-system-status">
            <div className="hud-status-node">
              <label>MT5 Link</label>
              <div className="hud-status-value">
                <div className="hud-glow-dot" style={{ color: health.terminal_connected ? "#4ade80" : "#f87171" }} />
                {health.terminal_connected ? "ACTIVE" : "OFFLINE"}
              </div>
            </div>
            <div className="hud-status-node">
              <label>Risk Feed</label>
              <div className="hud-status-value">
                <div className="hud-glow-dot" style={{ color: feedStatus === "live" ? "#4ade80" : "#fbbf24" }} />
                {feedStatus.toUpperCase()}
              </div>
            </div>
          </div>
          <div className="hud-system-status">
            <div className="hud-status-node" style={{ textAlign: "right" }}>
              <label>Session</label>
              <div className="hud-status-value" style={{ justifyContent: "flex-end" }}>
                {marketStatus?.session_state.toUpperCase() || "UNKNOWN"}
              </div>
            </div>
          </div>
        </div>

        <div className="hud-main-layout">
          {/* Left Column: Gauges */}
          <div className="hud-column">
            <div className="hud-card">
              <div className="hud-card-head">
                <Activity size={12} />
                <h4>Synthesized Backdrop</h4>
              </div>
              <div className="hud-gauge-group">
                <div className="hud-gauge">
                  <div className="hud-gauge-labels">
                    <span>{macro.title}</span>
                    <span>{macro.detail}</span>
                  </div>
                  <div className="hud-gauge-track">
                    <div className="hud-gauge-center" />
                    <div className="hud-gauge-fill" style={{ width: `${macro.value}%`, background: macro.unresolved ? "#64748b" : "#38bdf8" }} />
                  </div>
                </div>
                <div className="hud-gauge">
                  <div className="hud-gauge-labels">
                    <span>{strength.title}</span>
                    <span>{strength.detail}</span>
                  </div>
                  <div className="hud-gauge-track">
                    <div className="hud-gauge-center" />
                    <div className="hud-gauge-fill" style={{ width: `${strength.value}%`, background: "#818cf8" }} />
                  </div>
                </div>
              </div>
              <div className="terminal-link-strip" style={{ marginTop: "24px", borderTop: "1px solid #1e293b" }}>
                <button onClick={() => onNavigate("central-banks")}>Banks</button>
                <button onClick={() => onNavigate("strength-meter")}>Meter</button>
              </div>
            </div>
          </div>

          {/* Center Column: Core Hub */}
          <div className="hud-core-widget">
            <div className={`hud-core-ring ${readiness.tone === "good" ? "hud-core-ring-active" : ""}`} />
            <div className="hud-pair-display">
              <select 
                className="hud-pair-select"
                value={reviewSymbol} 
                onChange={(event) => onReviewSymbolChange(event.target.value)}
              >
                {FX_PAIRS.map((pair) => (
                  <option key={pair.name} value={pair.name}>{pair.name}</option>
                ))}
              </select>
              <div className="hud-atr-vol">
                {atrByPair[reviewSymbol] || "--"} PIPS ATR
              </div>
            </div>
            <div className="hud-verdict-tag" style={{ color: readiness.color, borderColor: readiness.color }}>
              {readiness.title}
            </div>
          </div>

          {/* Right Column: Radar & Actions */}
          <div className="hud-column">
            <div className="hud-card">
              <div className="hud-card-head">
                <CalendarClock size={12} />
                <h4>Risk Radar</h4>
              </div>
              <div className="hud-event-list">
                {topEvents.map(event => (
                  <button key={event.id} className="hud-event-row" onClick={() => onNavigate("calendar")}>
                    <FlagIcon countryCode={event.countryCode} className="h-3 w-4" />
                    <div className="hud-event-info">
                      <strong>{event.title}</strong>
                      <span>{event.currency} • {formatUtcDateTime(event.time)}</span>
                    </div>
                    <div className="hud-event-countdown">{formatCountdown(event.time, currentTime.getTime())}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="hud-card">
              <div className="hud-card-head">
                <Cpu size={12} />
                <h4>Next Directive</h4>
              </div>
              <div className="hud-action-list">
                {actions.map(action => (
                  <button key={action.label} className="hud-action-button" onClick={() => onNavigate(action.tab)}>
                    <div style={{ flex: 1 }}>
                      <strong>{action.label}</strong>
                      <span>{action.detail}</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="hud-footer">
          <div className="hud-footer-item">
            <Globe size={12} />
            INGEST: {lastIngestLabel.toUpperCase()}
          </div>
          <div className="hud-footer-item">
            <Target size={12} />
            NODES: {snapshots.filter(s => s.status === "ok").length}/8
          </div>
        </div>
      </div>
    </section>
  );
}
