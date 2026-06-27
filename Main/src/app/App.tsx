import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fetchCalendar, fetchHealth, fetchMarketStatus } from "@/app/lib/bridge";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import { createCalendarNavigationIntent } from "@/app/lib/calendarNavigation";
import { resolveCalendarStatus } from "@/app/lib/status";
import { MinimalHeader } from "@/app/components/MinimalHeader";
import { TabNavigation } from "@/app/components/TabNavigation";
import { UiCommandPanel } from "@/app/components/UiCommandPanel";
import { OverviewPlaceholderTab } from "@/app/tabs/primary/OverviewPlaceholderTab";
import { FONT_OPTIONS, COLOR_PALETTES, FontId, ColorPaletteId } from "@/app/config/themeConfig";
import type { BridgeHealth, BridgeStatus, CalendarEvent, CalendarNavigationIntent, MarketStatusResponse, TabId } from "@/app/types";

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

export const ANALYSIS_TAB_ORDER: { id: TabId; label: string; groupLabel?: string }[] = [
  { id: "event-tools", label: "EVENT REPLAY", groupLabel: "Active Experiment" },
  { id: "prototyping", label: "PROTOTYPING", groupLabel: "Archived / Ignore" },
];

export const TAB_ORDER: Array<{ id: TabId; label: string; children?: { id: TabId; label: string; groupLabel?: string }[] }> = [
  { id: "overview", label: "Overview" },
  { id: "central-banks", label: "Central Banks Data" },
  { id: "charts", label: "Charts" },
  { id: "calendar", label: "Economic Calendar" },
  { id: "dashboard", label: "Specialist Tools", children: ANALYSIS_TAB_ORDER },
];

function getFeedWindow() {
  const now = new Date();
  const from = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return {
    from: Math.floor(from.getTime() / 1000),
    to: Math.floor(to.getTime() / 1000),
  };
}

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
  const [health, setHealth] = useState<BridgeHealth>({ ok: false, bridge_connected: false, terminal_connected: false });
  const [feedEvents, setFeedEvents] = useState<CalendarEvent[]>([]);
  const [feedStatus, setFeedStatus] = useState<BridgeStatus>("loading");
  const [chartSymbol, setChartSymbol] = useState("EURUSD");
  const [overviewSymbol, setOverviewSymbol] = useState("EURUSD");
  const [chartMarketStatus, setChartMarketStatus] = useState<MarketStatusResponse | null>(null);
  const [overviewMarketStatus, setOverviewMarketStatus] = useState<MarketStatusResponse | null>(null);
  const [calendarTabLastSyncedAt, setCalendarTabLastSyncedAt] = useState<number | null>(null);
  const [calendarNavigationIntent, setCalendarNavigationIntent] = useState<CalendarNavigationIntent | null>(null);
  const feedEventsRef = useRef<CalendarEvent[]>([]);

  // Independent Aesthetic Forge
  const [currentFont, setCurrentFont] = useState<FontId>(() => {
    const saved = localStorage.getItem('terminal-font') as FontId;
    return FONT_OPTIONS.some(f => f.id === saved) ? saved : 'geist';
  });

  const [currentColor, setCurrentColor] = useState<ColorPaletteId>(() => {
    const saved = localStorage.getItem('terminal-color') as ColorPaletteId;
    return COLOR_PALETTES.some(c => c.id === saved) ? saved : 'sovereign-blue';
  });

  useEffect(() => {
    const font = FONT_OPTIONS.find(f => f.id === currentFont) || FONT_OPTIONS[0];
    const palette = COLOR_PALETTES.find(c => c.id === currentColor) || COLOR_PALETTES[0];
    const theme = palette.colors;
    const root = document.documentElement;
    
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--panel', theme.panel);
    root.style.setProperty('--panel-strong', theme.panelStrong);
    root.style.setProperty('--line', theme.line);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--muted', theme.muted);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--primary', theme.primary);
    
    // Navigation
    root.style.setProperty('--nav-bg', theme.navBg);
    root.style.setProperty('--tab-active-bg', theme.tabActiveBg);
    root.style.setProperty('--tab-active-text', theme.tabActiveText);
    root.style.setProperty('--tab-inactive-text', theme.tabInactiveText);
    
    root.style.setProperty('--font-main', font.family);
    
    localStorage.setItem('terminal-font', currentFont);
    localStorage.setItem('terminal-color', currentColor);
  }, [currentFont, currentColor]);

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
          : ({ ok: false, bridge_connected: false, terminal_connected: false } satisfies BridgeHealth);

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
      setChartMarketStatus(next);
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [chartSymbol]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next = await fetchMarketStatus(overviewSymbol);
      if (cancelled) return;
      setOverviewMarketStatus(next);
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [overviewSymbol]);

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
