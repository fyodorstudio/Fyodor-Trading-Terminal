import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import { createCalendarNavigationIntent } from "@/app/lib/calendarNavigation";
import { MinimalHeader } from "@/app/components/MinimalHeader";
import { TabNavigation } from "@/app/components/TabNavigation";
import { UiCommandPanel } from "@/app/components/UiCommandPanel";
import { OverviewPlaceholderTab } from "@/app/tabs/primary/OverviewPlaceholderTab";
import { ANALYSIS_TAB_ORDER, TAB_ORDER } from "@/app/config/navigation";
import { useCalendarFeed } from "@/app/hooks/useCalendarFeed";
import { useMarketStatus } from "@/app/hooks/useMarketStatus";
import { useTerminalTheme } from "@/app/hooks/useTerminalTheme";
import type { CalendarEvent, CalendarNavigationIntent, TabId } from "@/app/types";

const OverviewTab = lazy(() => import("@/app/tabs/secondary/OverviewTab").then((module) => ({ default: module.OverviewTab })));
const DashboardTab = lazy(() => import("@/app/tabs/secondary/DashboardTab").then((module) => ({ default: module.DashboardTab })));
const StrengthMeterTab = lazy(() => import("@/app/tabs/secondary/StrengthMeterTab").then((module) => ({ default: module.StrengthMeterTab })));
const EventReplayTab = lazy(() => import("@/app/tabs/secondary/EventReplayTab").then((module) => ({ default: module.EventReplayTab })));
const CentralBanksTab = lazy(() => import("@/app/tabs/primary/CentralBanksTab").then((module) => ({ default: module.CentralBanksTab })));
const ChartsTab = lazy(() => import("@/app/tabs/primary/ChartsTab").then((module) => ({ default: module.ChartsTab })));
const EconomicCalendarTab = lazy(() => import("@/app/tabs/primary/EconomicCalendarTab").then((module) => ({ default: module.EconomicCalendarTab })));
const WorkInProgressTab = lazy(() => import("@/app/tabs/secondary/WorkInProgressTab").then((module) => ({ default: module.WorkInProgressTab })));
const PrototypingTab = lazy(() => import("@/app/tabs/secondary/PrototypingTab").then((module) => ({ default: module.PrototypingTab })));
const TerminalQuestionsTab = lazy(() => import("@/app/tabs/secondary/TerminalQuestionsTab").then((module) => ({ default: module.TerminalQuestionsTab })));
const CurrencyCandleStrengthTab = lazy(() =>
  import("@/app/tabs/secondary/CurrencyCandleStrengthTab").then((module) => ({ default: module.CurrencyCandleStrengthTab })),
);
const MacroStatePrototypeTab = lazy(() =>
  import("@/app/tabs/secondary/MacroStatePrototypeTab").then((module) => ({ default: module.MacroStatePrototypeTab })),
);
const WatchlistEnginePrototypeTab = lazy(() =>
  import("@/app/tabs/secondary/WatchlistEnginePrototypeTab").then((module) => ({ default: module.WatchlistEnginePrototypeTab })),
);

export { ANALYSIS_TAB_ORDER, TAB_ORDER };

const transition = { type: "spring", stiffness: 300, damping: 30 };

function TabLoadingFallback() {
  return (
    <div className="mx-auto max-w-[1460px] rounded-2xl border border-slate-200 bg-white/80 px-6 py-8 text-sm font-semibold text-slate-600 shadow-sm">
      Loading workspace...
    </div>
  );
}

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
            <Suspense fallback={<TabLoadingFallback />}>
              {activeTab === "overview" && <OverviewPlaceholderTab />}
              {activeTab === "legacy-overview" && (
                <OverviewTab
                  currentTime={currentTime}
                  health={health}
                  feedStatus={feedStatus}
                  marketStatus={overviewMarketStatus}
                  reviewSymbol={overviewSymbol}
                  onReviewSymbolChange={setOverviewSymbol}
                  events={feedEvents}
                  snapshots={centralBankResult.snapshots}
                  onNavigate={setActiveTab}
                  onOpenCalendarEvent={openCalendarForEvent}
                />
              )}
              {activeTab === "dashboard" && <DashboardTab snapshots={centralBankResult.snapshots} />}
              {activeTab === "strength-meter" && (
                <StrengthMeterTab
                  snapshots={centralBankResult.snapshots}
                  events={feedEvents}
                  status={feedStatus}
                  onOpenCalendarEvent={openCalendarForEvent}
                />
              )}
              {activeTab === "event-tools" && (
                <EventReplayTab
                  events={feedEvents}
                  status={feedStatus}
                  lastCalendarIngestAt={health.last_calendar_ingest_at ?? null}
                />
              )}
              {activeTab === "work-in-progress" && <WorkInProgressTab />}
              {activeTab === "terminal-questions" && <TerminalQuestionsTab onNavigate={setActiveTab} />}
              {activeTab === "prototyping" && <PrototypingTab onNavigate={setActiveTab} />}
              {activeTab === "currency-candle-strength" && (
                <CurrencyCandleStrengthTab onBack={() => setActiveTab("prototyping")} />
              )}
              {activeTab === "watchlist-engine-prototype" && (
                <WatchlistEnginePrototypeTab
                  snapshots={centralBankResult.snapshots}
                  onBack={() => setActiveTab("prototyping")}
                />
              )}
              {activeTab === "macro-state-prototype" && (
                <MacroStatePrototypeTab
                  snapshots={centralBankResult.snapshots}
                  onBack={() => setActiveTab("prototyping")}
                />
              )}
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
                  marketStatus={chartMarketStatus}
                  selectedSymbol={chartSymbol}
                  onSelectedSymbolChange={setChartSymbol}
                />
              )}
              {activeTab === "calendar" && (
                <EconomicCalendarTab
                  health={health}
                  persistedLastSyncedAt={calendarTabLastSyncedAt}
                  onSyncSuccess={setCalendarTabLastSyncedAt}
                  navigationIntent={calendarNavigationIntent}
                  onConsumeNavigationIntent={() => setCalendarNavigationIntent(null)}
                />
              )}
            </Suspense>
          </main>
        </div>
      </motion.div>
    </div>
  );
}
