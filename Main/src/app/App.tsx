import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fetchCalendar, fetchHealth, fetchMarketStatus } from "@/app/lib/bridge";
import { deriveCentralBankSnapshots } from "@/app/lib/centralBankDerive";
import { createCalendarNavigationIntent } from "@/app/lib/calendarNavigation";
import { resolveCalendarStatus } from "@/app/lib/status";
import { MinimalHeader } from "@/app/components/MinimalHeader";
import { TabNavigation } from "@/app/components/TabNavigation";
import { UiCommandPanel } from "@/app/components/UiCommandPanel";
import { OverviewTab } from "@/app/tabs/OverviewTab";
import { DashboardTab } from "@/app/tabs/DashboardTab";
import { StrengthMeterTab } from "@/app/tabs/StrengthMeterTab";
import { EventQualityTab } from "@/app/tabs/EventQualityTab";
import { EventReactionTab } from "@/app/tabs/EventReactionTab";
import { CentralBanksTab } from "@/app/tabs/CentralBanksTab";
import { ChartsTab } from "@/app/tabs/ChartsTab";
import { EconomicCalendarTab } from "@/app/tabs/EconomicCalendarTab";
import { FONT_OPTIONS, COLOR_PALETTES, FontId, ColorPaletteId } from "@/app/config/themeConfig";
import type { BridgeHealth, BridgeStatus, CalendarEvent, CalendarNavigationIntent, MarketStatusResponse, TabId } from "@/app/types";

const ANALYSIS_TAB_ORDER: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Differential Calculator" },
  { id: "strength-meter", label: "Strength Meter" },
  { id: "event-quality", label: "Event Quality" },
  { id: "reaction-engine", label: "Event Reaction Engine" },
];

const TAB_ORDER: Array<{ id: TabId; label: string; children?: { id: TabId; label: string }[] }> = [
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [health, setHealth] = useState<BridgeHealth>({ ok: false, terminal_connected: false });
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
        animate={{ paddingLeft: isUiPanelOpen ? 340 : 64 }}
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
            {activeTab === "overview" && (
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
            {activeTab === "event-quality" && (
              <EventQualityTab
                events={feedEvents}
                status={feedStatus}
                lastCalendarIngestAt={health.last_calendar_ingest_at ?? null}
              />
            )}
            {activeTab === "reaction-engine" && <EventReactionTab events={feedEvents} />}
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
          </main>
        </div>
      </motion.div>
    </div>
  );
}
