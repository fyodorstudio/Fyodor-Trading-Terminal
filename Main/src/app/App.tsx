import { useEffect, useMemo, useRef, useState } from "react";
import { fetchCalendar, fetchHealth, fetchMarketStatus } from "@/app/lib/bridge";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import { resolveCalendarStatus } from "@/app/lib/status";
import { LocalClock } from "@/app/components/LocalClock";
import { MarketStatusPill } from "@/app/components/MarketStatusPill";
import { Mt5Clock } from "@/app/components/Mt5Clock";
import { MinimalHeader } from "@/app/components/MinimalHeader";
import { OverviewTab } from "@/app/tabs/OverviewTab";
import { CentralBanksTab } from "@/app/tabs/CentralBanksTab";
import { ChartsTab } from "@/app/tabs/ChartsTab";
import { EconomicCalendarTab } from "@/app/tabs/EconomicCalendarTab";
import type { BridgeHealth, BridgeStatus, CalendarEvent, MarketStatusResponse, TabId } from "@/app/types";

const TAB_ORDER: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "central-banks", label: "Central Banks Data" },
  { id: "charts", label: "Charts" },
  { id: "calendar", label: "Economic Calendar" },
];

function getFeedWindow() {
  const now = new Date();
  const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    from: Math.floor(from.getTime() / 1000),
    to: Math.floor(to.getTime() / 1000),
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("charts");
  const [health, setHealth] = useState<BridgeHealth>({ ok: false, terminal_connected: false });
  const [feedEvents, setFeedEvents] = useState<CalendarEvent[]>([]);
  const [feedStatus, setFeedStatus] = useState<BridgeStatus>("loading");
  const [chartSymbol, setChartSymbol] = useState("EURUSD");
  const [marketStatus, setMarketStatus] = useState<MarketStatusResponse | null>(null);
  const feedEventsRef = useRef<CalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const windowRange = getFeedWindow();
      const [healthResult, calendarResult] = await Promise.allSettled([
        fetchHealth(),
        fetchCalendar({
          from: windowRange.from,
          to: windowRange.to,
          impacts: ["low", "medium", "high"],
        }),
      ]);

      if (cancelled) return;

      const nextHealth =
        healthResult.status === "fulfilled"
          ? healthResult.value
          : ({ ok: false, terminal_connected: false } satisfies BridgeHealth);

      setHealth(nextHealth);

      if (calendarResult.status === "fulfilled") {
        feedEventsRef.current = calendarResult.value;
        setFeedEvents(calendarResult.value);
        setFeedStatus(resolveCalendarStatus({ eventsCount: calendarResult.value.length, health: nextHealth }));
        return;
      }

      setFeedStatus(
        resolveCalendarStatus({
          eventsCount: feedEventsRef.current.length,
          health: nextHealth,
          calendarRequestFailed: true,
        }),
      );
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next = await fetchMarketStatus(chartSymbol);
      if (cancelled) return;
      setMarketStatus(next);
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [chartSymbol]);

  const centralBankResult = useMemo(() => deriveCentralBankSnapshots(feedEvents), [feedEvents]);

  const headerStatus = useMemo(() => {
    if (feedStatus === "live") return "Calendar feed live";
    if (feedStatus === "stale") return "Calendar feed stale";
    if (feedStatus === "loading") return "Loading live feed";
    if (feedStatus === "no_data") return "NO DATA";
    return "Bridge unavailable";
  }, [feedStatus]);

  const nextHighImpact = useMemo(() => {
    const now = Date.now() / 1000;
    return feedEvents
      .filter((event) => event.impact === "high" && event.time >= now)
      .sort((a, b) => a.time - b.time)[0] ?? null;
  }, [feedEvents]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app-shell">
      <MinimalHeader
        currentTime={currentTime}
        headerStatus={headerStatus}
        feedStatus={feedStatus}
        marketStatus={marketStatus}
        resolvedBanks={centralBankResult.snapshots.filter((item) => item.status === "ok").length}
        nextHighImpact={nextHighImpact}
      />

      <nav className="tab-nav" aria-label="Primary">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "tab-button is-active" : "tab-button"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main-area">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "central-banks" && (
          <CentralBanksTab
            snapshots={centralBankResult.snapshots}
            logs={centralBankResult.logs}
            status={feedStatus}
            lastCalendarIngestAt={health.last_calendar_ingest_at ?? null}
          />
        )}
        {activeTab === "charts" && (
          <ChartsTab
            marketStatus={marketStatus}
            selectedSymbol={chartSymbol}
            onSelectedSymbolChange={setChartSymbol}
          />
        )}
        {activeTab === "calendar" && <EconomicCalendarTab health={health} />}
      </main>
    </div>
  );
}
