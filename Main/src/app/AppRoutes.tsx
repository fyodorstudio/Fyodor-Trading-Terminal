import { Suspense, lazy } from "react";
import { OverviewPlaceholderTab } from "@/app/tabs/primary/OverviewPlaceholderTab";
import type {
  BridgeHealth,
  BridgeStatus,
  CalendarEvent,
  CalendarNavigationIntent,
  CentralBankDeriveResult,
  MarketStatusResponse,
  TabId,
} from "@/app/types";

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

interface AppRoutesProps {
  activeTab: TabId;
  currentTime: Date;
  health: BridgeHealth;
  feedStatus: BridgeStatus;
  feedEvents: CalendarEvent[];
  centralBankResult: CentralBankDeriveResult;
  overviewSymbol: string;
  onOverviewSymbolChange: (symbol: string) => void;
  overviewMarketStatus: MarketStatusResponse | null;
  chartSymbol: string;
  onChartSymbolChange: (symbol: string) => void;
  chartMarketStatus: MarketStatusResponse | null;
  calendarTabLastSyncedAt: number | null;
  onCalendarSyncSuccess: (syncedAt: number | null) => void;
  calendarNavigationIntent: CalendarNavigationIntent | null;
  onConsumeCalendarNavigationIntent: () => void;
  onNavigate: (tab: TabId) => void;
  onOpenCalendarEvent: (event: CalendarEvent) => void;
}

function TabLoadingFallback() {
  return (
    <div className="mx-auto max-w-[1460px] rounded-2xl border border-slate-200 bg-white/80 px-6 py-8 text-sm font-semibold text-slate-600 shadow-sm">
      Loading workspace...
    </div>
  );
}

export function AppRoutes({
  activeTab,
  currentTime,
  health,
  feedStatus,
  feedEvents,
  centralBankResult,
  overviewSymbol,
  onOverviewSymbolChange,
  overviewMarketStatus,
  chartSymbol,
  onChartSymbolChange,
  chartMarketStatus,
  calendarTabLastSyncedAt,
  onCalendarSyncSuccess,
  calendarNavigationIntent,
  onConsumeCalendarNavigationIntent,
  onNavigate,
  onOpenCalendarEvent,
}: AppRoutesProps) {
  return (
    <Suspense fallback={<TabLoadingFallback />}>
      {activeTab === "overview" && <OverviewPlaceholderTab />}
      {activeTab === "legacy-overview" && (
        <OverviewTab
          currentTime={currentTime}
          health={health}
          feedStatus={feedStatus}
          marketStatus={overviewMarketStatus}
          reviewSymbol={overviewSymbol}
          onReviewSymbolChange={onOverviewSymbolChange}
          events={feedEvents}
          snapshots={centralBankResult.snapshots}
          onNavigate={onNavigate}
          onOpenCalendarEvent={onOpenCalendarEvent}
        />
      )}
      {activeTab === "dashboard" && <DashboardTab snapshots={centralBankResult.snapshots} />}
      {activeTab === "strength-meter" && (
        <StrengthMeterTab
          snapshots={centralBankResult.snapshots}
          events={feedEvents}
          status={feedStatus}
          onOpenCalendarEvent={onOpenCalendarEvent}
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
      {activeTab === "terminal-questions" && <TerminalQuestionsTab onNavigate={onNavigate} />}
      {activeTab === "prototyping" && <PrototypingTab onNavigate={onNavigate} />}
      {activeTab === "currency-candle-strength" && (
        <CurrencyCandleStrengthTab onBack={() => onNavigate("prototyping")} />
      )}
      {activeTab === "watchlist-engine-prototype" && (
        <WatchlistEnginePrototypeTab
          snapshots={centralBankResult.snapshots}
          onBack={() => onNavigate("prototyping")}
        />
      )}
      {activeTab === "macro-state-prototype" && (
        <MacroStatePrototypeTab
          snapshots={centralBankResult.snapshots}
          onBack={() => onNavigate("prototyping")}
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
          onSelectedSymbolChange={onChartSymbolChange}
        />
      )}
      {activeTab === "calendar" && (
        <EconomicCalendarTab
          health={health}
          persistedLastSyncedAt={calendarTabLastSyncedAt}
          onSyncSuccess={onCalendarSyncSuccess}
          navigationIntent={calendarNavigationIntent}
          onConsumeNavigationIntent={onConsumeCalendarNavigationIntent}
        />
      )}
    </Suspense>
  );
}
