import { AlertTriangle, ArrowRight, CalendarClock, ChartCandlestick, Landmark, ShieldCheck } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { getCountryDisplayName } from "@/app/config/currencyConfig";
import { formatCountdown, formatDateOnly, formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import type { BridgeHealth, BridgeStatus, CalendarEvent, CentralBankSnapshot, MarketStatusResponse, TabId } from "@/app/types";

interface OverviewTabProps {
  currentTime: Date;
  health: BridgeHealth;
  feedStatus: BridgeStatus;
  marketStatus: MarketStatusResponse | null;
  selectedSymbol: string;
  events: CalendarEvent[];
  snapshots: CentralBankSnapshot[];
  onNavigate: (tab: TabId) => void;
}

interface ActionItem {
  tab: TabId;
  label: string;
  detail: string;
}

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

function getTopEvents(events: CalendarEvent[], selectedSymbol: string): Array<CalendarEvent & { relevant: boolean }> {
  const now = Date.now() / 1000;
  const symbolCurrencies = [selectedSymbol.slice(0, 3), selectedSymbol.slice(3, 6)];

  return events
    .filter((event) => event.impact === "high" && event.time >= now)
    .sort((a, b) => a.time - b.time)
    .slice(0, 3)
    .map((event) => ({
      ...event,
      relevant: symbolCurrencies.includes(event.currency),
    }));
}

function getMacroAttentionList(snapshots: CentralBankSnapshot[]) {
  const now = Date.now() / 1000;

  return snapshots
    .map((snapshot) => {
      const nextEventAt = [snapshot.nextRateEventAt, snapshot.nextCpiEventAt]
        .filter((value): value is number => value != null)
        .sort((a, b) => a - b)[0] ?? null;

      const nextEventTitle =
        nextEventAt === snapshot.nextRateEventAt ? snapshot.nextRateEventTitle : snapshot.nextCpiEventTitle;

      const unresolvedCount =
        Number(snapshot.currentPolicyRate == null) +
        Number(snapshot.currentInflationRate == null);

      const urgencyScore =
        unresolvedCount * 10 +
        (nextEventAt != null && nextEventAt >= now && nextEventAt - now <= 7 * 24 * 60 * 60 ? 5 : 0) +
        (snapshot.status === "partial" ? 2 : 0) +
        (snapshot.status === "missing" ? 4 : 0);

      return {
        snapshot,
        nextEventAt,
        nextEventTitle,
        unresolvedCount,
        urgencyScore,
      };
    })
    .sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
      if (a.nextEventAt == null && b.nextEventAt == null) return a.snapshot.currency.localeCompare(b.snapshot.currency);
      if (a.nextEventAt == null) return 1;
      if (b.nextEventAt == null) return -1;
      return a.nextEventAt - b.nextEventAt;
    })
    .slice(0, 4);
}

function getAttentionActions(
  readinessTone: "good" | "warning" | "danger",
  events: Array<CalendarEvent & { relevant: boolean }>,
  snapshots: CentralBankSnapshot[],
): ActionItem[] {
  const actions: ActionItem[] = [];
  const unresolvedCount = snapshots.filter((item) => item.status !== "ok").length;

  if (readinessTone !== "good") {
    actions.push({
      tab: "calendar",
      label: "Verify the feed",
      detail: "Start with the calendar tab and confirm the current ingest window and event coverage.",
    });
  }

  if (events.some((event) => event.relevant)) {
    actions.push({
      tab: "calendar",
      label: "Inspect the next major event",
      detail: "A high-impact release touches the currently selected symbol, so timing risk deserves a closer look.",
    });
  }

  if (unresolvedCount > 0) {
    actions.push({
      tab: "central-banks",
      label: "Check unresolved macro nodes",
      detail: `${unresolvedCount} central-bank snapshot${unresolvedCount === 1 ? "" : "s"} still need a manual trust check.`,
    });
  }

  actions.push({
    tab: "charts",
    label: "Confirm price context",
    detail: "Use charts after trust and timing look acceptable for the current market.",
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

function renderSnapshotMetric(value: string | null, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

function renderMacroFollowUp(unresolvedCount: number, nextEventTitle: string | null): string {
  if (unresolvedCount > 0) {
    return `${unresolvedCount} unresolved field${unresolvedCount === 1 ? "" : "s"}`;
  }

  return nextEventTitle || "Data mapped cleanly";
}

export function OverviewTab({
  currentTime,
  health,
  feedStatus,
  marketStatus,
  selectedSymbol,
  events,
  snapshots,
  onNavigate,
}: OverviewTabProps) {
  const readiness = getSystemReadiness(health, feedStatus, marketStatus);
  const topEvents = getTopEvents(events, selectedSymbol);
  const attentionBanks = getMacroAttentionList(snapshots);
  const actions = getAttentionActions(readiness.tone, topEvents, snapshots);
  const resolvedBanks = snapshots.filter((item) => item.status === "ok").length;
  const lastIngestLabel = formatRelativeAge(health.last_calendar_ingest_at ?? null);
  const marketLabel =
    marketStatus?.session_state === "open"
      ? `${selectedSymbol} session is open`
      : marketStatus?.session_state === "closed"
        ? `${selectedSymbol} session is closed`
        : `${selectedSymbol} session is unavailable`;

  return (
    <section className="tab-panel overview-panel">
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
        <div className="overview-brief-metrics">
          <div className="overview-brief-metric">
            <span>Calendar ingest</span>
            <strong>{lastIngestLabel}</strong>
          </div>
          <div className="overview-brief-metric">
            <span>Macro resolution</span>
            <strong>{resolvedBanks}/8 banks resolved</strong>
          </div>
          <div className="overview-brief-metric">
            <span>Selected symbol</span>
            <strong>{marketLabel}</strong>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <section className="overview-card">
          <div className="overview-card-head">
            <div className="overview-card-icon" aria-hidden="true">
              <CalendarClock size={18} />
            </div>
            <div>
              <h3>Event horizon</h3>
              <p>The next high-impact events that may change today&apos;s priorities.</p>
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
                    <div className="overview-event-flag">
                      <FlagIcon countryCode={event.countryCode} className="h-5 w-7" />
                    </div>
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

        <section className="overview-card">
          <div className="overview-card-head">
            <div className="overview-card-icon" aria-hidden="true">
              <Landmark size={18} />
            </div>
            <div>
              <h3>Macro backdrop</h3>
              <p>The closest or least-resolved central-bank nodes worth checking next.</p>
            </div>
          </div>

          <div className="overview-bank-list">
            {attentionBanks.map(({ snapshot, nextEventAt, nextEventTitle, unresolvedCount }) => (
              <button
                key={snapshot.currency}
                type="button"
                className="overview-bank-row"
                onClick={() => onNavigate("central-banks")}
              >
                <div className="overview-bank-head">
                  <div className="overview-bank-identity">
                    <FlagIcon countryCode={snapshot.countryCode} className="h-5 w-7" />
                    <div>
                      <strong>{snapshot.bankName}</strong>
                      <span>{snapshot.currency}</span>
                    </div>
                  </div>
                  <span className={`overview-status-tag is-${snapshot.status}`}>{snapshot.status}</span>
                </div>
                <div className="overview-bank-metrics">
                  <div>
                    <span>Rate</span>
                    <strong>{renderSnapshotMetric(snapshot.currentPolicyRate, "Unresolved")}</strong>
                  </div>
                  <div>
                    <span>CPI</span>
                    <strong>{renderSnapshotMetric(snapshot.currentInflationRate, "Unresolved")}</strong>
                  </div>
                  <div>
                    <span>Next node</span>
                    <strong>{nextEventAt ? formatDateOnly(nextEventAt) : "Not scheduled"}</strong>
                  </div>
                </div>
                <div className="overview-bank-foot">
                  <span className="overview-bank-followup">{renderMacroFollowUp(unresolvedCount, nextEventTitle)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="overview-grid overview-grid-secondary">
        <section className="overview-card">
          <div className="overview-card-head">
            <div className="overview-card-icon" aria-hidden="true">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3>Trust checklist</h3>
              <p>Quick answers before you let the rest of the terminal influence a trade decision.</p>
            </div>
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

        <section className="overview-card">
          <div className="overview-card-head">
            <div className="overview-card-icon" aria-hidden="true">
              <ChartCandlestick size={18} />
            </div>
            <div>
              <h3>Where to go next</h3>
              <p>Use the specialist tabs only after the mission-control page tells you where attention belongs.</p>
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
    </section>
  );
}
