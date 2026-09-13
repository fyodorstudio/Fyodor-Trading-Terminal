import { useEffect, useMemo, useState } from "react";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import { createCalendarNavigationIntent } from "@/app/lib/calendarNavigation";
import { getNextHighImpactEvent } from "@/app/lib/eventHorizon";
import { AppRoutes } from "@/app/AppRoutes";
import { UiCommandPanel } from "@/app/components/UiCommandPanel";
import { SecondaryWorkspaceBar } from "@/app/features/chart-shell/SecondaryWorkspaceBar";
import { useCalendarFeed } from "@/app/hooks/useCalendarFeed";
import { useCurrentTime } from "@/app/hooks/useCurrentTime";
import { useMarketStatus } from "@/app/hooks/useMarketStatus";
import { useTerminalTheme } from "@/app/hooks/useTerminalTheme";
import type { CalendarEvent, CalendarNavigationIntent, TabId } from "@/app/types";

const PROTOTYPE_CHILD_TABS = new Set<TabId>([
  "overview",
  "legacy-overview",
  "currency-candle-strength",
  "watchlist-engine-prototype",
  "dashboard",
  "macro-drivers",
  "strength-meter",
  "event-tools",
  "terminal-questions",
  "work-in-progress",
  "macro-state-prototype",
  "central-banks",
]);

const SECONDARY_TITLES: Partial<Record<TabId, string>> = {
  overview: "Overview Prototype",
  "legacy-overview": "Deprecated Overview",
  "currency-candle-strength": "Currency Strength From Candles",
  "watchlist-engine-prototype": "Watchlist Engine Prototype",
  dashboard: "Differential Calculator",
  "macro-drivers": "Macro Drivers Prototype",
  "macro-signal-lab": "FMS Experiment Workbench",
  "strength-meter": "Strength Meter Prototype",
  "event-tools": "Event Replay Prototype",
  "terminal-questions": "Six Questions Draft",
  "work-in-progress": "WIP Map Archive",
  prototyping: "Retained Prototypes",
  "macro-state-prototype": "Macro State Prototype",
  "central-banks": "Central Banks Prototype",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("charts");
  const [chartSymbol, setChartSymbol] = useState("EURUSD");
  const [overviewSymbol, setOverviewSymbol] = useState("EURUSD");
  const [eventReplayPairIntent, setEventReplayPairIntent] = useState<string | null>(null);
  const [calendarTabLastSyncedAt, setCalendarTabLastSyncedAt] = useState<number | null>(null);
  const [calendarNavigationIntent, setCalendarNavigationIntent] = useState<CalendarNavigationIntent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarDockOpen, setCalendarDockOpen] = useState(false);
  const { health, feedEvents, feedStatus } = useCalendarFeed();
  const chartMarketStatus = useMarketStatus(chartSymbol);
  const overviewMarketStatus = useMarketStatus(overviewSymbol);
  const terminalTheme = useTerminalTheme();

  const centralBankResult = useMemo(() => deriveCentralBankSnapshots(feedEvents), [feedEvents]);

  const nextHighImpact = useMemo(() => getNextHighImpactEvent(feedEvents), [feedEvents]);
  const currentTime = useCurrentTime();

  const openCalendarForEvent = (event: CalendarEvent, source: CalendarNavigationIntent["source"]) => {
    setCalendarNavigationIntent(createCalendarNavigationIntent(event, source));
    setCalendarDockOpen(true);
    setActiveTab("charts");
  };

  const navigate = (tab: TabId) => {
    if (tab === "calendar") {
      setCalendarDockOpen(true);
      setActiveTab("charts");
      return;
    }
    setActiveTab(tab);
  };

  const secondaryTitle = SECONDARY_TITLES[activeTab] ?? "Retained workspace";

  return (
    <div className="flex min-h-screen bg-[var(--bg)] transition-colors duration-300 overflow-hidden">
      <div className="flex-1 min-h-screen">
        <div className={activeTab === "charts" ? "app-shell app-shell-charts" : "app-shell"}>
          {activeTab !== "charts" ? (
            <SecondaryWorkspaceBar
              title={secondaryTitle}
              onBackToCharts={() => setActiveTab("charts")}
              onBackToPrototypes={PROTOTYPE_CHILD_TABS.has(activeTab) ? () => setActiveTab("prototyping") : undefined}
              onOpenAppSettings={() => setSettingsOpen(true)}
            />
          ) : null}

          <main className={`main-area ${activeTab === "charts" ? "main-area-charts" : "mt-4"}`}>
            <AppRoutes
              activeTab={activeTab}
              currentTime={currentTime}
              health={health}
              feedStatus={feedStatus}
              feedEvents={feedEvents}
              centralBankResult={centralBankResult}
              overviewSymbol={overviewSymbol}
              onOverviewSymbolChange={setOverviewSymbol}
              overviewMarketStatus={overviewMarketStatus}
              eventReplayPairIntent={eventReplayPairIntent}
              onConsumeEventReplayPairIntent={() => setEventReplayPairIntent(null)}
              chartSymbol={chartSymbol}
              onChartSymbolChange={setChartSymbol}
              chartMarketStatus={chartMarketStatus}
              calendarTabLastSyncedAt={calendarTabLastSyncedAt}
              onCalendarSyncSuccess={setCalendarTabLastSyncedAt}
              calendarNavigationIntent={calendarNavigationIntent}
              onConsumeCalendarNavigationIntent={() => setCalendarNavigationIntent(null)}
              calendarDockOpen={calendarDockOpen}
              onCalendarDockOpenChange={setCalendarDockOpen}
              resolvedBanks={centralBankResult.snapshots.filter((item) => item.status === "ok").length}
              nextHighImpact={nextHighImpact}
              onOpenAppSettings={() => setSettingsOpen(true)}
              onNavigate={navigate}
              onOpenCalendarEvent={openCalendarForEvent}
            />
          </main>

          <UiCommandPanel
            currentFont={terminalTheme.currentFont}
            currentColor={terminalTheme.currentColor}
            onFontChange={terminalTheme.setCurrentFont}
            onColorChange={terminalTheme.setCurrentColor}
            isOpen={settingsOpen}
            onOpenChange={setSettingsOpen}
            showClosedTrigger={false}
          />
        </div>
      </div>
    </div>
  );
}
