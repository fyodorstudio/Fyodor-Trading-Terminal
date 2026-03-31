import { useEffect, useMemo, useState } from "react";
import { 
  AlertTriangle, ArrowRight, CalendarClock, ChartCandlestick, 
  ShieldCheck, Zap, Info, Target, TrendingUp, Check, X, MoveDown, MoveUp
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
} {
  if (!health.terminal_connected) {
    return {
      tone: "danger",
      title: "MT5 is currently disconnected",
      note: "The bridge is waiting for MetaTrader 5 to establish a secure link. Check your EA status.",
    };
  }

  if (!health.ok) {
    return {
      tone: "danger",
      title: "Bridge services are unavailable",
      note: "The terminal is unable to verify health markers. Trust is degraded until reconnection.",
    };
  }

  if (feedStatus === "error" || feedStatus === "no_data") {
    return {
      tone: "danger",
      title: "Calendar data is untrusted",
      note: "High-impact event timing cannot be verified. Use caution when reviewing timing risk.",
    };
  }

  if (feedStatus === "loading" || feedStatus === "stale") {
    return {
      tone: "warning",
      title: "Timing context is slightly delayed",
      note: "Data is available but timing markers may be stale. Review recent calendar activity manually.",
    };
  }

  if (!marketStatus || marketStatus.session_state === "unavailable") {
    return {
      tone: "warning",
      title: "Market context is limited",
      note: "System is healthy, but current symbol session data hasn't synchronized yet.",
    };
  }

  return {
    tone: "good",
    title: "All systems are ready for review",
    note: "The terminal has verified MT5 connectivity, calendar health, and current symbol context.",
  };
}

function getTopEvents(events: CalendarEvent[], reviewSymbol: string): Array<CalendarEvent & { relevant: boolean }> {
  const now = Date.now() / 1000;
  const symbolCurrencies = [reviewSymbol.slice(0, 3), reviewSymbol.slice(3, 6)];

  return events
    .filter((event) => event.impact === "high" && event.time >= now)
    .sort((a, b) => a.time - b.time)
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

function getMacroSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): PairSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) {
    return {
      title: `Macro data incomplete.`,
      detail: "Symbol not mapped in current data set.",
      unresolved: true,
    };
  }

  const baseSnapshot = snapshots.find((item) => item.currency === pair.base) ?? null;
  const quoteSnapshot = snapshots.find((item) => item.currency === pair.quote) ?? null;

  if (!baseSnapshot || !quoteSnapshot) {
    return {
      title: `Macro data incomplete.`,
      detail: "Missing central bank snapshots for this pair.",
      unresolved: true,
    };
  }

  const baseRate = parseNumericValue(baseSnapshot.currentPolicyRate ?? "");
  const quoteRate = parseNumericValue(quoteSnapshot.currentPolicyRate ?? "");
  const baseInflation = parseNumericValue(baseSnapshot.currentInflationRate ?? "");
  const quoteInflation = parseNumericValue(quoteSnapshot.currentInflationRate ?? "");
  const rateGap = baseRate != null && quoteRate != null ? baseRate - quoteRate : null;
  const inflationGap = baseInflation != null && quoteInflation != null ? baseInflation - quoteInflation : null;

  if (baseSnapshot.status !== "ok" || quoteSnapshot.status !== "ok") {
    return {
      title: `Macro data needs verification.`,
      detail: "Data exists but requires manual trust check.",
      unresolved: true,
    };
  }

  const sameSideBias =
    rateGap != null &&
    inflationGap != null &&
    ((rateGap > 0 && inflationGap > 0) || (rateGap < 0 && inflationGap < 0));

  const favoredSide = sameSideBias ? (rateGap! > 0 ? pair.base : pair.quote) : null;

  return {
    title: sameSideBias
      ? `${favoredSide} shows a cleaner macro bias.`
      : `The macro picture is currently mixed.`,
    detail: `Rate Diff: ${formatGap(rateGap)} | Inflation Diff: ${formatGap(inflationGap)}`,
    unresolved: false,
  };
}

function getStrengthDifferentialSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): PairSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) return { title: "Unresolved", detail: "Map unavailable", unresolved: true };

  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find((item) => item.currency === pair.base) ?? null;
  const quoteRank = ranks.find((item) => item.currency === pair.quote) ?? null;

  if (!baseRank || !quoteRank) return { title: "Unresolved", detail: "Ranks missing", unresolved: true };

  const stronger = baseRank.score >= quoteRank.score ? baseRank : quoteRank;
  const weaker = stronger.currency === baseRank.currency ? quoteRank : baseRank;

  return {
    title: `${stronger.currency} is currently outperforming ${weaker.currency}.`,
    detail: `Score Gap: ${(stronger.score - weaker.score).toFixed(1)} pts`,
    unresolved: false,
  };
}

function getAttentionActions(
  readinessTone: "good" | "warning" | "danger",
  reviewSymbol: string,
  events: Array<CalendarEvent & { relevant: boolean }>,
  macroSummary: PairSummary,
  strengthSummary: PairSummary,
): ActionItem[] {
  const actions: ActionItem[] = [];

  if (readinessTone !== "good") {
    actions.push({
      tab: "calendar",
      label: "Verify Bridge Health",
      detail: "Check ingest window and connectivity status.",
    });
  }

  if (events.some((event) => event.relevant)) {
    actions.push({
      tab: "calendar",
      label: `Review ${reviewSymbol} Risk`,
      detail: "High-impact events are approaching for this pair.",
    });
  }

  if (macroSummary.unresolved || strengthSummary.unresolved) {
    actions.push({
      tab: "central-banks",
      label: "Sync Macro Data",
      detail: "Perform a manual check on central bank snapshots.",
    });
  }

  actions.push({
    tab: "charts",
    label: "Analyze Technicals",
    detail: "Review price structure and key levels.",
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
  const readiness = getSystemReadiness(health, feedStatus, marketStatus);
  const topEvents = getTopEvents(events, reviewSymbol);
  const macroSummary = useMemo(() => getMacroSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const strengthSummary = useMemo(() => getStrengthDifferentialSummary(reviewSymbol, snapshots), [reviewSymbol, snapshots]);
  const actions = getAttentionActions(readiness.tone, reviewSymbol, topEvents, macroSummary, strengthSummary);
  const resolvedBanks = snapshots.filter((item) => item.status === "ok").length;
  const lastIngestLabel = formatRelativeAge(health.last_calendar_ingest_at ?? null);

  // Premium Calculations
  const pair = getFxPairByName(reviewSymbol);
  const baseSnap = snapshots.find(s => s.currency === pair?.base);
  const quoteSnap = snapshots.find(s => s.currency === pair?.quote);
  
  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find(r => r.currency === pair?.base);
  const quoteRank = ranks.find(r => r.currency === pair?.quote);

  const isBridgeValid = health.terminal_connected && health.ok;
  const isRiskValid = !topEvents.some(e => e.relevant && (e.time - currentTime.getTime()/1000) < 7200);
  const isMacroValid = !macroSummary.unresolved;
  const isStrengthValid = (baseRank?.score && quoteRank?.score) ? Math.abs(baseRank.score - quoteRank.score) > 3 : false;

  const needlePosition = useMemo(() => {
    if (!baseRank || !quoteRank) return 50;
    const diff = baseRank.score - quoteRank.score; // Range roughly -10 to +10
    const pos = 50 - (diff * 4); // Map to 10% - 90%
    return Math.min(Math.max(pos, 10), 90);
  }, [baseRank, quoteRank]);

  const atrValue = atrByPair[reviewSymbol];
  const atrGaugeWidth = useMemo(() => {
    if (!atrValue) return 0;
    // Assume 50 is quiet, 150 is extreme for common pairs
    const width = ((atrValue - 40) / 160) * 100;
    return Math.min(Math.max(width, 5), 100);
  }, [atrValue]);

  useEffect(() => {
    let cancelled = false;
    const loadAtr = async () => {
      const entries = await Promise.all(
        FX_PAIRS.map(async (pair) => {
          try {
            const candles = await fetchHistory(pair.name, "D1", 60);
            return [pair.name, calculateAtr14Pips(candles, pair.name)] as const;
          } catch {
            return [pair.name, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setAtrByPair(Object.fromEntries(entries));
    };
    void loadAtr();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="tab-panel overview-panel">
      <div className="narrative-container">
        {/* Hero Section */}
        <section className={`narrative-hero narrative-hero-${readiness.tone}`}>
          <div style={{ flex: 1 }}>
            <div className="narrative-hero-content">
              <h2>{readiness.title}</h2>
              <p>{readiness.note}</p>
            </div>
            
            {/* Readiness Checklist */}
            <div className="readiness-checklist">
              <div className={`check-item ${isBridgeValid ? "is-valid" : "is-invalid"}`}>
                <div className="check-dot">{isBridgeValid ? <Check size={10} /> : <X size={10} />}</div>
                Bridge Link
              </div>
              <div className={`check-item ${isRiskValid ? "is-valid" : "is-invalid"}`}>
                <div className="check-dot">{isRiskValid ? <Check size={10} /> : <AlertTriangle size={10} />}</div>
                Timing Risk
              </div>
              <div className={`check-item ${isMacroValid ? "is-valid" : "is-invalid"}`}>
                <div className="check-dot">{isMacroValid ? <Check size={10} /> : <Info size={10} />}</div>
                Macro Align
              </div>
              <div className={`check-item ${isStrengthValid ? "is-valid" : ""}`}>
                <div className="check-dot">{isStrengthValid ? <TrendingUp size={10} /> : <Activity size={10} />}</div>
                Strength Gap
              </div>
            </div>
          </div>

          <div className="narrative-hero-vitals">
            <div className="narrative-hero-stat">
              <label>MT5 Link</label>
              <span>{health.terminal_connected ? "Stable" : "Lost"}</span>
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
          {/* Main Story Column */}
          <div className="narrative-section">
            <div className="narrative-section-header">
              <Target size={14} />
              <h3>The Market Story</h3>
            </div>
            
            <div className="narrative-card">
              <div className="narrative-pair-banner">
                <div className="narrative-pair-info">
                  <h4>Target Symbol</h4>
                  <select 
                    className="narrative-pair-select"
                    value={reviewSymbol} 
                    onChange={(event) => onReviewSymbolChange(event.target.value)}
                  >
                    {FX_PAIRS.map((pair) => (
                      <option key={pair.name} value={pair.name}>{pair.name}</option>
                    ))}
                  </select>
                </div>
                <div className="narrative-atr-display">
                  <label>Volatility (14D ATR)</label>
                  <div className="narrative-atr-value">
                    {atrValue === undefined ? "..." : atrValue == null ? "--" : `${atrValue} pips`}
                  </div>
                  {/* Volatility Visualizer */}
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

              {/* Currency Duel Section */}
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

              <div className="narrative-story-block" style={{ marginTop: "24px" }}>
                <div className="narrative-story-item">
                  <div className="narrative-story-icon"><Zap size={22} /></div>
                  <div className="narrative-story-text">
                    <h5>Bias Synthesis</h5>
                    <p>{strengthSummary.title} {macroSummary.title}</p>
                    <div className="narrative-story-detail">{macroSummary.detail}</div>
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

          {/* Risk & Action Sidebar */}
          <div className="narrative-column" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="narrative-section">
              <div className="narrative-section-header">
                <CalendarClock size={14} />
                <h3>Risk Radar</h3>
              </div>
              <div className="narrative-event-card">
                {topEvents.length > 0 ? (
                  topEvents.map((event) => {
                    const diffMinutes = (event.time - currentTime.getTime() / 1000) / 60;
                    const isUrgent = diffMinutes > 0 && diffMinutes < 60;
                    return (
                      <button 
                        key={event.id} 
                        className={`narrative-event-row ${isUrgent ? "risk-alert-pulse" : ""}`} 
                        onClick={() => onNavigate("calendar")}
                      >
                        <div className="narrative-event-top">
                          <div className="narrative-event-title">
                            <strong>{event.title}</strong>
                            <span>{event.currency} • {formatUtcDateTime(event.time)}</span>
                          </div>
                          <div className="narrative-event-countdown">
                            {formatCountdown(event.time, currentTime.getTime())}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <FlagIcon countryCode={event.countryCode} className="h-4 w-6" />
                          {isUrgent && <span style={{ color: "#b91c1c", fontSize: "0.65rem", fontWeight: 800 }}>IMMINENT RISK</span>}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="narrative-event-row">
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>No high-impact events detected in the current window.</p>
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
          <button className="narrative-footer-link" onClick={() => onNavigate("OverviewTab" as any)}>Refresh Dashboard</button>
          <button className="narrative-footer-link">Sync Ingest Window</button>
          <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Last Ingest: {lastIngestLabel}</span>
        </div>
      </div>
    </section>
  );
}
