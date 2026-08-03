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

const DeprecatedOverviewTab = lazy(() =>
  import("@/styles/garbage.css").then(() =>
    import("@/app/tabs/garbage/DeprecatedOverviewTab").then((module) => ({ default: module.DeprecatedOverviewTab })),
  ),
);
const DifferentialCalculatorTab = lazy(() =>
  import("@/app/tabs/secondary/DifferentialCalculatorTab").then((module) => ({ default: module.DifferentialCalculatorTab })),
);
const MacroDriversTab = lazy(() =>
  import("@/app/tabs/secondary/MacroDriversTab").then((module) => ({ default: module.MacroDriversTab })),
);
const StrengthMeterTab = lazy(() =>
  import("@/styles/garbage.css").then(() =>
    import("@/app/tabs/garbage/StrengthMeterTab").then((module) => ({ default: module.StrengthMeterTab })),
  ),
);
const EventReplayTab = lazy(() => import("@/app/tabs/secondary/EventReplayTab").then((module) => ({ default: module.EventReplayTab })));
const CentralBanksTab = lazy(() => import("@/app/tabs/primary/CentralBanksTab").then((module) => ({ default: module.CentralBanksTab })));
const ChartsTab = lazy(() => import("@/app/tabs/primary/ChartsTab").then((module) => ({ default: module.ChartsTab })));
const EconomicCalendarTab = lazy(() => import("@/app/tabs/primary/EconomicCalendarTab").then((module) => ({ default: module.EconomicCalendarTab })));
const WipMapArchiveTab = lazy(() =>
  import("@/styles/garbage.css").then(() =>
    import("@/app/tabs/garbage/WipMapArchiveTab").then((module) => ({ default: module.WipMapArchiveTab })),
  ),
);
const PrototypingTab = lazy(() => import("@/app/tabs/secondary/PrototypingTab").then((module) => ({ default: module.PrototypingTab })));
const SixQuestionsDraftTab = lazy(() =>
  import("@/styles/garbage.css").then(() =>
    import("@/app/tabs/garbage/SixQuestionsDraftTab").then((module) => ({ default: module.SixQuestionsDraftTab })),
  ),
);
const CurrencyStrengthFromCandlesTab = lazy(() =>
  import("@/styles/garbage.css").then(() =>
    import("@/app/tabs/garbage/CurrencyStrengthFromCandlesTab").then((module) => ({ default: module.CurrencyStrengthFromCandlesTab })),
  ),
);
const MacroStateTab = lazy(() =>
  import("@/styles/garbage.css").then(() =>
    import("@/app/tabs/garbage/MacroStateTab").then((module) => ({ default: module.MacroStateTab })),
  ),
);
const WatchlistEngineTab = lazy(() =>
  import("@/styles/garbage.css").then(() =>
    import("@/app/tabs/garbage/WatchlistEngineTab").then((module) => ({ default: module.WatchlistEngineTab })),
  ),
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
  eventReplayPairIntent: string | null;
  onConsumeEventReplayPairIntent: () => void;
  chartSymbol: string;
  onChartSymbolChange: (symbol: string) => void;
  chartMarketStatus: MarketStatusResponse | null;
  calendarTabLastSyncedAt: number | null;
  onCalendarSyncSuccess: (syncedAt: number | null) => void;
  calendarNavigationIntent: CalendarNavigationIntent | null;
  onConsumeCalendarNavigationIntent: () => void;
  onNavigate: (tab: TabId) => void;
  onOpenCalendarEvent: (event: CalendarEvent, source: CalendarNavigationIntent["source"]) => void;
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
  eventReplayPairIntent,
  onConsumeEventReplayPairIntent,
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
      {activeTab === "overview" && (
        <OverviewPlaceholderTab
          selectedSymbol={overviewSymbol}
          onSelectedSymbolChange={onOverviewSymbolChange}
          events={feedEvents}
          snapshots={centralBankResult.snapshots}
          marketStatus={overviewMarketStatus}
          currentTime={currentTime}
          onOpenCalendarEvent={(event) => onOpenCalendarEvent(event, "overview")}
        />
      )}
      {activeTab === "legacy-overview" && (
        <DeprecatedOverviewTab
          currentTime={currentTime}
          health={health}
          feedStatus={feedStatus}
          marketStatus={overviewMarketStatus}
          reviewSymbol={overviewSymbol}
          onReviewSymbolChange={onOverviewSymbolChange}
          events={feedEvents}
          snapshots={centralBankResult.snapshots}
          onNavigate={onNavigate}
          onOpenCalendarEvent={(event) => onOpenCalendarEvent(event, "overview")}
        />
      )}
      {activeTab === "dashboard" && <DifferentialCalculatorTab snapshots={centralBankResult.snapshots} />}
      {activeTab === "macro-drivers" && (
        <MacroDriversTab
          events={feedEvents}
          snapshots={centralBankResult.snapshots}
          currentTime={currentTime}
          initialSymbol={overviewSymbol}
        />
      )}
      {activeTab === "strength-meter" && (
        <StrengthMeterTab
          snapshots={centralBankResult.snapshots}
          events={feedEvents}
          status={feedStatus}
          onOpenCalendarEvent={(event) => onOpenCalendarEvent(event, "strength-meter")}
        />
      )}
      {activeTab === "event-tools" && (
        <EventReplayTab
          events={feedEvents}
          status={feedStatus}
          lastCalendarIngestAt={health.last_calendar_ingest_at ?? null}
          pairIntent={eventReplayPairIntent}
          onConsumePairIntent={onConsumeEventReplayPairIntent}
        />
      )}
      {activeTab === "work-in-progress" && <WipMapArchiveTab />}
      {activeTab === "terminal-questions" && <SixQuestionsDraftTab onNavigate={onNavigate} />}
      {activeTab === "prototyping" && <PrototypingTab onNavigate={onNavigate} />}
      {activeTab === "currency-candle-strength" && (
        <CurrencyStrengthFromCandlesTab onBack={() => onNavigate("prototyping")} />
      )}
      {activeTab === "watchlist-engine-prototype" && (
        <WatchlistEngineTab
          snapshots={centralBankResult.snapshots}
          onBack={() => onNavigate("prototyping")}
        />
      )}
      {activeTab === "macro-state-prototype" && (
        <MacroStateTab
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
          events={feedEvents}
          onOpenCalendarEvent={(event) => onOpenCalendarEvent(event, "charts")}
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
