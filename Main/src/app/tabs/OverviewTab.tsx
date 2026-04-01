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
