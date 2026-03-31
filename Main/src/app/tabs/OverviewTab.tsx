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
  const reviewAtr = atrByPair[reviewSymbol];

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
      <div className="overview-workspace">
        <aside className={`overview-rail overview-rail-${readiness.tone}`}>
          <section className="overview-selector-card overview-rail-card">
            <label className="overview-selector-label" htmlFor="overview-pair-select">
              <span>Select Pair to Review</span>
              <select id="overview-pair-select" value={reviewSymbol} onChange={(event) => onReviewSymbolChange(event.target.value)}>
                {FX_PAIRS.map((pair) => (
                  <option key={pair.name} value={pair.name}>
                    {pair.name}  {atrByPair[pair.name] === undefined ? "..." : atrByPair[pair.name] == null ? "--" : `${atrByPair[pair.name]} pips`}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="overview-rail-card overview-atr-card">
            <span className="overview-rail-kicker">ATR14 daily range</span>
            <strong>
              {reviewAtr === undefined ? "Loading..." : reviewAtr == null ? "--" : `${reviewAtr} pips`}
            </strong>
            <p>Average daily range for {reviewSymbol}, useful when you want lower-volatility pairs first.</p>
          </section>

          <section className={`overview-rail-card overview-rail-status overview-rail-status-${readiness.tone}`}>
            <div className="overview-rail-status-head">
              <span className="overview-rail-kicker">System trust</span>
              <strong>{panelSummary}</strong>
            </div>
            <p>{readiness.note}</p>
          </section>

          <section className="overview-rail-card">
            <div className="overview-rail-head">
              <strong>Data health checklist</strong>
              <span>Trust details for {reviewSymbol}</span>
            </div>

            <div className="overview-checklist">
              <div className="overview-check-row">
                <span>MT5 connection</span>
                <strong>{health.terminal_connected ? "Connected" : "Waiting for MT5"}</strong>
              </div>
              <div className="overview-check-row">
                <span>Bridge state</span>
                <strong>{health.ok ? "Healthy" : "Unavailable"}</strong>
              </div>
              <div className="overview-check-row">
                <span>Calendar feed</span>
                <strong>{renderFeedLabel(feedStatus)}</strong>
              </div>
              <div className="overview-check-row">
                <span>Current symbol context</span>
                <strong>{marketLabel}</strong>
              </div>
            </div>
          </section>

          <section className="overview-rail-card overview-rail-meta">
            <div className="overview-health-meta-row">
              <span>Calendar ingest</span>
              <strong>{lastIngestLabel}</strong>
            </div>
            <div className="overview-health-meta-row">
              <span>Macro resolution</span>
              <strong>{resolvedBanks}/8</strong>
            </div>
            <div className="overview-health-meta-row">
              <span>Selected symbol</span>
              <strong>{reviewSymbol}</strong>
            </div>
          </section>
        </aside>

        <div className="overview-main">
          <div className={`overview-brief overview-brief-${readiness.tone}`}>
            <div className="overview-brief-copy">
              <div className="overview-brief-icon" aria-hidden="true">
                {readiness.tone === "danger" ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
              </div>
              <div>
                <h2>{readiness.title}</h2>
                <p>{readiness.note}</p>
              </div>
            </div>
          </div>

          <section className="overview-card">
            <div className="overview-card-head">
              <div className="overview-card-icon" aria-hidden="true">
                <CalendarClock size={18} />
              </div>
              <div>
                <h3>Event horizon</h3>
                <p>The next high-impact events that may change your priorities for {reviewSymbol}.</p>
              </div>
            </div>

            {topEvents.length === 0 ? (
              <div className="overview-empty">
                <p>No high-impact events are scheduled in the current bridge window.</p>
              </div>
            ) : (
              <div className="overview-event-list">
                {topEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="overview-event-row"
                    onClick={() => onNavigate("calendar")}
                  >
                    <div className="overview-event-main">
                      <FlagIcon countryCode={event.countryCode} className="h-5 w-7" />
                      <div>
                        <strong>{event.title}</strong>
                        <span>
                          {event.currency} - {getCountryDisplayName(event.countryCode)} - {formatUtcDateTime(event.time)}
                        </span>
                      </div>
                    </div>
                    <div className="overview-event-meta">
                      <strong>{formatCountdown(event.time, currentTime.getTime())}</strong>
                      <span className={event.relevant ? "overview-relevance is-relevant" : "overview-relevance"}>
                        {event.relevant ? "Touches current pair" : "Global watch"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="overview-grid-summary">
            <section className="overview-card">
              <div className="overview-card-head">
                <div className="overview-card-icon" aria-hidden="true">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3>Macro snapshot</h3>
                  <p>Plain-English macro context for the pair you are about to review.</p>
                </div>
              </div>

              <div className="overview-summary-card">
                <strong>{macroSummary.title}</strong>
                <p>{macroSummary.detail}</p>
                <button type="button" className="overview-inline-link" onClick={() => onNavigate("central-banks")}>
                  Open Central Banks Data
                </button>
              </div>
            </section>

            <section className="overview-card">
              <div className="overview-card-head">
                <div className="overview-card-icon" aria-hidden="true">
                  <ChartCandlestick size={18} />
                </div>
                <div>
                  <h3>Strength &amp; differential summary</h3>
                  <p>Quick pair edge context before you move into deeper review or technical analysis.</p>
                </div>
              </div>

              <div className="overview-summary-card">
                <strong>{strengthSummary.title}</strong>
                <p>{strengthSummary.detail}</p>
                <div className="overview-inline-actions">
                  <button type="button" className="overview-inline-link" onClick={() => onNavigate("strength-meter")}>
                    Open Strength Meter
                  </button>
                  <button type="button" className="overview-inline-link" onClick={() => onNavigate("dashboard")}>
                    Open Differential Calculator
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="overview-card">
            <div className="overview-card-head">
              <div className="overview-card-icon" aria-hidden="true">
                <ChartCandlestick size={18} />
              </div>
              <div>
                <h3>Priority next actions</h3>
                <p>Use these only after the pair still looks worth your attention at a glance.</p>
              </div>
            </div>

            <div className="overview-action-list">
              {actions.map((action) => (
                <button
                  key={`${action.tab}-${action.label}`}
                  type="button"
                  className="overview-action-row"
                  onClick={() => onNavigate(action.tab)}
                >
                  <div>
                    <strong>{action.label}</strong>
                    <span>{action.detail}</span>
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
