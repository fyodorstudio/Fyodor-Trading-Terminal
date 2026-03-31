import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, ChartCandlestick, ShieldCheck } from "lucide-react";
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
      title: "MT5 is not connected",
      note: "Keep the app open, then reopen MT5 and confirm the bridge and EA are running.",
    };
  }

  if (!health.ok) {
    return {
      tone: "danger",
      title: "Bridge is unavailable",
      note: "The app is open, but the bridge is not healthy enough to trust deeper analysis yet.",
    };
  }

  if (feedStatus === "error" || feedStatus === "no_data") {
    return {
      tone: "danger",
      title: "Calendar feed is not trustworthy",
      note: "Use the calendar tab only after the bridge can ingest events again.",
    };
  }

  if (feedStatus === "loading" || feedStatus === "stale") {
    return {
      tone: "warning",
      title: "System is running with stale timing context",
      note: "Live enough to inspect, but the calendar should be treated carefully until the next successful ingest.",
    };
  }

  if (!marketStatus || marketStatus.session_state === "unavailable") {
    return {
      tone: "warning",
      title: "System is healthy, but market context is incomplete",
      note: "Bridge and calendar are up, but the selected symbol does not have a clean market-status signal yet.",
    };
  }

  return {
    tone: "good",
    title: "System is ready for pre-trade review",
    note: "MT5, bridge, calendar, and current symbol context are aligned well enough for daily use.",
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

function getNearestNode(snapshot: CentralBankSnapshot | null): { at: number | null; label: string | null } {
  if (!snapshot) return { at: null, label: null };

  const nextAt = [snapshot.nextRateEventAt, snapshot.nextCpiEventAt]
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)[0] ?? null;

  if (nextAt == null) return { at: null, label: null };
  if (nextAt === snapshot.nextRateEventAt) return { at: nextAt, label: snapshot.nextRateEventTitle || formatDateOnly(nextAt) };
  if (nextAt === snapshot.nextCpiEventAt) return { at: nextAt, label: snapshot.nextCpiEventTitle || formatDateOnly(nextAt) };
  return { at: nextAt, label: formatDateOnly(nextAt) };
}

function getMacroSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): PairSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) {
    return {
      title: `Macro picture is incomplete for ${reviewSymbol}.`,
      detail: "The selected pair is not part of the current major-pair map.",
      unresolved: true,
    };
  }

  const baseSnapshot = snapshots.find((item) => item.currency === pair.base) ?? null;
  const quoteSnapshot = snapshots.find((item) => item.currency === pair.quote) ?? null;

  if (!baseSnapshot || !quoteSnapshot) {
    return {
      title: `Macro picture is incomplete for ${reviewSymbol}.`,
      detail: "One side of the pair is missing from the current central-bank snapshot set.",
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
    const baseNode = getNearestNode(baseSnapshot);
    const quoteNode = getNearestNode(quoteSnapshot);
    const unresolvedSide =
      baseSnapshot.status !== "ok" && quoteSnapshot.status !== "ok"
        ? `${pair.base} and ${pair.quote}`
        : baseSnapshot.status !== "ok"
          ? pair.base
          : pair.quote;

    const nextNodeDetail =
      baseNode.label && quoteNode.label
        ? `${pair.base}: ${baseNode.label} | ${pair.quote}: ${quoteNode.label}`
        : baseNode.label
          ? `${pair.base}: ${baseNode.label}`
          : quoteNode.label
            ? `${pair.quote}: ${quoteNode.label}`
            : "No matched next node in the current MT5 window.";

    return {
      title: `Macro picture is usable but partly unresolved for ${reviewSymbol}.`,
      detail: `${unresolvedSide} still need${unresolvedSide.includes(" and ") ? "" : "s"} a closer trust check. ${nextNodeDetail}`,
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
      ? `${favoredSide} has the cleaner macro picture vs ${favoredSide === pair.base ? pair.quote : pair.base}.`
      : `Macro picture is mixed for ${reviewSymbol}.`,
    detail: `Rate gap: ${formatGap(rateGap)} | Inflation gap: ${formatGap(inflationGap)}`,
    unresolved: false,
  };
}

function getStrengthDifferentialSummary(reviewSymbol: string, snapshots: CentralBankSnapshot[]): PairSummary {
  const pair = getFxPairByName(reviewSymbol);
  if (!pair) {
    return {
      title: `Strength ranking is unresolved for one side of ${reviewSymbol}.`,
      detail: "Pair map is unavailable for the selected symbol.",
      unresolved: true,
    };
  }

  const currencies = adaptDashboardCurrencies(snapshots);
  const { ranks } = deriveStrengthCurrencyRanks(currencies);
  const baseRank = ranks.find((item) => item.currency === pair.base) ?? null;
  const quoteRank = ranks.find((item) => item.currency === pair.quote) ?? null;

  const baseSnapshot = snapshots.find((item) => item.currency === pair.base) ?? null;
  const quoteSnapshot = snapshots.find((item) => item.currency === pair.quote) ?? null;
  const baseRate = parseNumericValue(baseSnapshot?.currentPolicyRate ?? "");
  const quoteRate = parseNumericValue(quoteSnapshot?.currentPolicyRate ?? "");
  const baseInflation = parseNumericValue(baseSnapshot?.currentInflationRate ?? "");
  const quoteInflation = parseNumericValue(quoteSnapshot?.currentInflationRate ?? "");
  const rateGap = baseRate != null && quoteRate != null ? baseRate - quoteRate : null;
  const inflationGap = baseInflation != null && quoteInflation != null ? baseInflation - quoteInflation : null;

  if (!baseRank || !quoteRank) {
    return {
      title: `Strength ranking is unresolved for one side of ${reviewSymbol}.`,
      detail: `Rate difference: ${formatGap(rateGap)} | Inflation difference: ${formatGap(inflationGap)}`,
      unresolved: true,
    };
  }

  const stronger = baseRank.score >= quoteRank.score ? baseRank : quoteRank;
  const weaker = stronger.currency === baseRank.currency ? quoteRank : baseRank;

  return {
    title: `${stronger.currency} ranks stronger than ${weaker.currency} by ${(stronger.score - weaker.score).toFixed(1)} points.`,
    detail: `Rate difference: ${formatGap(rateGap)} | Inflation difference: ${formatGap(inflationGap)}`,
    unresolved: rateGap == null || inflationGap == null,
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
      label: "Resolve feed or timing trust first",
      detail: "Confirm the ingest window and timing context before leaning on the rest of the terminal.",
    });
  }

  if (events.some((event) => event.relevant)) {
    actions.push({
      tab: "calendar",
      label: `Review Economic Calendar for ${reviewSymbol}`,
      detail: "A high-impact event touches this pair, so timing risk deserves a closer look.",
    });
  }

  if (macroSummary.unresolved) {
    actions.push({
      tab: "central-banks",
      label: `Check Central Banks Data for ${reviewSymbol}`,
      detail: "At least one side of the pair still needs a deeper macro trust check.",
    });
  }

  if (strengthSummary.unresolved) {
    actions.push({
      tab: "dashboard",
      label: `Check Differential Calculator for ${reviewSymbol}`,
      detail: "Compare the raw rate and inflation differences directly before you move into technical analysis.",
    });
  }

  actions.push({
    tab: "charts",
    label: "Review Charts for technical setup",
    detail: "Move into price structure, levels, and risk-to-reward only after the pair still looks worth attention.",
  });

  return actions.slice(0, 3);
}

function renderFeedLabel(status: BridgeStatus): string {
  if (status === "live") return "Live";
  if (status === "stale") return "Stale";
  if (status === "loading") return "Loading";
  if (status === "no_data") return "No data";
  return "Error";
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
  const marketLabel =
    marketStatus?.session_state === "open"
      ? `${reviewSymbol} session is open`
      : marketStatus?.session_state === "closed"
        ? `${reviewSymbol} session is closed`
        : `${reviewSymbol} session is unavailable`;
  const panelSummary =
    readiness.tone === "good"
      ? "System healthy"
      : readiness.tone === "warning"
        ? "Needs caution"
        : "Trust degraded";
  const featuredEvent = topEvents[0] ?? null;
  const followupEvents = topEvents.slice(1);
  const primaryActions = actions.slice(0, 2);
  const overflowAction = actions[2] ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadAtr = async () => {
      const initialState = FX_PAIRS.reduce<AtrByPair>((accumulator, pair) => {
        accumulator[pair.name] = undefined;
        return accumulator;
      }, {});

      setAtrByPair(initialState);

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

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="tab-panel overview-panel">
      <div className="terminal-grid">
        {/* Column 1: System Vitals */}
        <div className="terminal-column">
          <div className="terminal-card">
            <div className="terminal-card-header">
              <ShieldCheck size={14} />
              <h3>System Vitals</h3>
            </div>
            <div className="terminal-card-body">
              <div className={`terminal-verdict-banner terminal-verdict-banner-${readiness.tone}`}>
                <strong>{readiness.title}</strong>
                <p>{readiness.note}</p>
              </div>
              <div className="terminal-vitals-list">
                <div className="terminal-vital-item">
                  <label>MT5 Bridge</label>
                  <span className={health.terminal_connected ? "status-text-live" : "status-text-error"}>
                    {health.terminal_connected ? "CONNECTED" : "DISCONNECTED"}
                  </span>
                </div>
                <div className="terminal-vital-item">
                  <label>Data Feed</label>
                  <span className={`status-text-${feedStatus}`}>
                    {renderFeedLabel(feedStatus).toUpperCase()}
                  </span>
                </div>
                <div className="terminal-vital-item">
                  <label>Session</label>
                  <span className={marketStatus?.session_state === "open" ? "status-text-live" : "status-text-stale"}>
                    {(marketStatus?.session_state || "unknown").toUpperCase()}
                  </span>
                </div>
                <div className="terminal-vital-item">
                  <label>Ingest</label>
                  <span className="terminal-mono">{lastIngestLabel}</span>
                </div>
                <div className="terminal-vital-item">
                  <label>Bank Data</label>
                  <span className="terminal-mono">{resolvedBanks}/8 RESOLVED</span>
                </div>
              </div>
            </div>
          </div>

          <div className="terminal-card">
            <div className="terminal-card-header">
              <ArrowRight size={14} />
              <h3>Next Move</h3>
            </div>
            <div className="terminal-card-body" style={{ padding: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {actions.map((action) => (
                  <button
                    key={`${action.tab}-${action.label}`}
                    type="button"
                    className="terminal-action-button"
                    onClick={() => onNavigate(action.tab)}
                  >
                    <strong>{action.label}</strong>
                    <span>{action.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Pair Intel */}
        <div className="terminal-column">
          <div className="terminal-card" style={{ minHeight: "100%" }}>
            <div className="terminal-card-header">
              <ChartCandlestick size={14} />
              <h3>Pair Intel</h3>
            </div>
            <div className="terminal-card-body">
              <div className="terminal-pair-header">
                <div className="terminal-pair-select-wrapper">
                  <span>Target Symbol</span>
                  <select 
                    className="terminal-pair-select"
                    value={reviewSymbol} 
                    onChange={(event) => onReviewSymbolChange(event.target.value)}
                  >
                    {FX_PAIRS.map((pair) => (
                      <option key={pair.name} value={pair.name}>{pair.name}</option>
                    ))}
                  </select>
                </div>
                <div className="terminal-atr-badge">
                  <span>ATR (14D)</span>
                  <div className="terminal-atr-value terminal-mono">
                    {atrByPair[reviewSymbol] === undefined ? "..." : atrByPair[reviewSymbol] == null ? "--" : `${atrByPair[reviewSymbol]} pips`}
                  </div>
                </div>
              </div>

              <div className="terminal-intel-section">
                <div className="terminal-intel-block">
                  <strong>Macro Backdrop</strong>
                  <p>{macroSummary.title}</p>
                  <div className="terminal-intel-meta terminal-mono">{macroSummary.detail}</div>
                </div>

                <div className="terminal-intel-block">
                  <strong>Strength Differential</strong>
                  <p>{strengthSummary.title}</p>
                  <div className="terminal-intel-meta terminal-mono">{strengthSummary.detail}</div>
                </div>

                <div className="terminal-link-strip">
                  <button onClick={() => onNavigate("central-banks")}>Banks</button>
                  <button onClick={() => onNavigate("strength-meter")}>Meter</button>
                  <button onClick={() => onNavigate("dashboard")}>Diff</button>
                  <button onClick={() => onNavigate("charts")}>Charts</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Event Horizon */}
        <div className="terminal-column">
          <div className="terminal-card">
            <div className="terminal-card-header">
              <CalendarClock size={14} />
              <h3>Event Horizon</h3>
            </div>
            <div className="terminal-event-list">
              {topEvents.length > 0 ? (
                topEvents.map((event) => (
                  <button
                    key={event.id}
                    className="terminal-event-row"
                    onClick={() => onNavigate("calendar")}
                  >
                    <div className="terminal-event-top">
                      <div className="terminal-event-identity">
                        <FlagIcon countryCode={event.countryCode} className="h-4 w-6" />
                        <strong>{event.title}</strong>
                      </div>
                      <div className="terminal-event-countdown terminal-mono">
                        {formatCountdown(event.time, currentTime.getTime())}
                      </div>
                    </div>
                    <div className="terminal-event-details">
                      <span>{event.currency} • {formatUtcDateTime(event.time)}</span>
                      <span className={`terminal-relevance-pill ${event.relevant ? "is-active" : ""}`}>
                        {event.relevant ? "RELEVANT" : "GLOBAL"}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="terminal-card-body">
                  <p className="status-text-subtle" style={{ margin: 0, fontSize: "0.84rem" }}>
                    No high-impact events in window.
                  </p>
                </div>
              )}
            </div>
            {topEvents.length > 0 && (
              <div className="terminal-card-body" style={{ borderTop: "1px solid var(--line)", padding: "8px 12px" }}>
                <button 
                  className="overview-inline-link" 
                  onClick={() => onNavigate("calendar")}
                  style={{ fontSize: "0.75rem" }}
                >
                  View full calendar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
