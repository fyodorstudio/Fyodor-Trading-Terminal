import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import { createCalendarNavigationIntent } from "@/app/lib/calendarNavigation";
import { AppRoutes } from "@/app/AppRoutes";
import { MinimalHeader } from "@/app/components/MinimalHeader";
import { TabNavigation } from "@/app/components/TabNavigation";
import { UiCommandPanel } from "@/app/components/UiCommandPanel";
import { ANALYSIS_TAB_ORDER, TAB_ORDER } from "@/app/config/navigation";
import { useCalendarFeed } from "@/app/hooks/useCalendarFeed";
import { useMarketStatus } from "@/app/hooks/useMarketStatus";
import { useTerminalTheme } from "@/app/hooks/useTerminalTheme";
import type { CalendarEvent, CalendarNavigationIntent, TabId } from "@/app/types";

export { ANALYSIS_TAB_ORDER, TAB_ORDER };

const transition = { type: "spring", stiffness: 300, damping: 30 };

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [chartSymbol, setChartSymbol] = useState("EURUSD");
  const [overviewSymbol, setOverviewSymbol] = useState("EURUSD");
  const [calendarTabLastSyncedAt, setCalendarTabLastSyncedAt] = useState<number | null>(null);
  const [calendarNavigationIntent, setCalendarNavigationIntent] = useState<CalendarNavigationIntent | null>(null);
  const { health, feedEvents, feedStatus } = useCalendarFeed();
  const chartMarketStatus = useMarketStatus(chartSymbol);
  const overviewMarketStatus = useMarketStatus(overviewSymbol);
  const { currentFont, currentColor, setCurrentFont, setCurrentColor } = useTerminalTheme();

  const centralBankResult = useMemo(() => deriveCentralBankSnapshots(feedEvents), [feedEvents]);

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

  const [isUiPanelOpen, setIsUiPanelOpen] = useState(false);

  const openCalendarForEvent = (event: CalendarEvent) => {
    setCalendarNavigationIntent(createCalendarNavigationIntent(event, "overview"));
    setActiveTab("calendar");
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] transition-colors duration-300 overflow-hidden">
      <UiCommandPanel 
        currentFont={currentFont}
        currentColor={currentColor}
        onFontChange={setCurrentFont}
        onColorChange={setCurrentColor}
        isOpen={isUiPanelOpen}
        onOpenChange={setIsUiPanelOpen}
      />
      
      <motion.div 
        animate={{ paddingLeft: isUiPanelOpen ? 356 : 0 }}
        transition={transition}
        className="flex-1 min-h-screen"
      >
        <div className="app-shell max-w-[1460px] mx-auto p-6">
          <MinimalHeader
            currentTime={currentTime}
            health={health}
            feedStatus={feedStatus}
            marketStatus={overviewMarketStatus}
            selectedSymbol={overviewSymbol}
            resolvedBanks={centralBankResult.snapshots.filter((item) => item.status === "ok").length}
            nextHighImpact={nextHighImpact ? { title: nextHighImpact.title, currency: nextHighImpact.currency, time: nextHighImpact.time } : null}
          />

          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
          />

          <main className="main-area mt-6">
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
        </div>
      </motion.div>
    </div>
  );
}
