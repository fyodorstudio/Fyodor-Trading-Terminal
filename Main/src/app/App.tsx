import { useMemo, useState } from "react";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import { createCalendarNavigationIntent } from "@/app/lib/calendarNavigation";
import { getNextHighImpactEvent } from "@/app/lib/eventHorizon";
import { AppRoutes } from "@/app/AppRoutes";
import { MinimalHeader } from "@/app/components/MinimalHeader";
import { UiCommandPanel } from "@/app/components/UiCommandPanel";
import { TAB_ORDER } from "@/app/config/navigation";
import { useCalendarFeed } from "@/app/hooks/useCalendarFeed";
import { useCurrentTime } from "@/app/hooks/useCurrentTime";
import { useMarketStatus } from "@/app/hooks/useMarketStatus";
import { useTerminalTheme } from "@/app/hooks/useTerminalTheme";
import type { CalendarEvent, CalendarNavigationIntent, TabId } from "@/app/types";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [chartSymbol, setChartSymbol] = useState("EURUSD");
  const [overviewSymbol, setOverviewSymbol] = useState("EURUSD");
  const [eventReplayPairIntent, setEventReplayPairIntent] = useState<string | null>(null);
  const [calendarTabLastSyncedAt, setCalendarTabLastSyncedAt] = useState<number | null>(null);
  const [calendarNavigationIntent, setCalendarNavigationIntent] = useState<CalendarNavigationIntent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { health, feedEvents, feedStatus } = useCalendarFeed();
  const chartMarketStatus = useMarketStatus(chartSymbol);
  const overviewMarketStatus = useMarketStatus(overviewSymbol);
  const terminalTheme = useTerminalTheme();

  const centralBankResult = useMemo(() => deriveCentralBankSnapshots(feedEvents), [feedEvents]);

  const nextHighImpact = useMemo(() => getNextHighImpactEvent(feedEvents), [feedEvents]);
  const currentTime = useCurrentTime();

  const openCalendarForEvent = (event: CalendarEvent) => {
    setCalendarNavigationIntent(createCalendarNavigationIntent(event, "overview"));
    setActiveTab("calendar");
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] transition-colors duration-300 overflow-hidden">
      <div className="flex-1 min-h-screen">
        <div className="app-shell">
          <MinimalHeader
            activeTab={activeTab}
            currentTime={currentTime}
            health={health}
            feedStatus={feedStatus}
            marketStatus={overviewMarketStatus}
            setActiveTab={setActiveTab}
            selectedSymbol={overviewSymbol}
            tabOrder={TAB_ORDER}
            resolvedBanks={centralBankResult.snapshots.filter((item) => item.status === "ok").length}
            nextHighImpact={nextHighImpact}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <main className="main-area mt-4">
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
              onOpenEventReplay={(symbol) => {
                setEventReplayPairIntent(symbol);
                setActiveTab("event-tools");
              }}
              onConsumeEventReplayPairIntent={() => setEventReplayPairIntent(null)}
              chartSymbol={chartSymbol}
              onChartSymbolChange={setChartSymbol}
              chartMarketStatus={chartMarketStatus}
              calendarTabLastSyncedAt={calendarTabLastSyncedAt}
              onCalendarSyncSuccess={setCalendarTabLastSyncedAt}
              calendarNavigationIntent={calendarNavigationIntent}
              onConsumeCalendarNavigationIntent={() => setCalendarNavigationIntent(null)}
              onNavigate={setActiveTab}
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
