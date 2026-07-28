import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Clock3,
  Settings2,
} from "lucide-react";
import { ChartSettingsDrawer, type ChartDrawerMode } from "@/app/components/ChartSettingsDrawer";
import { EventReplayCandlestickChart } from "@/app/components/EventReplayCandlestickChart";
import { EventReplayControlRail } from "@/app/components/EventReplayControlRail";
import { EventReplayBriefModal } from "@/app/components/EventReplayBriefModal";
import { EventReplayReleaseListModal } from "@/app/components/EventReplayReleaseListModal";
import {
  EventReplaySelectEventModal,
} from "@/app/components/EventReplaySelectEventModal";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { fetchHistoryRange } from "@/app/lib/bridge";
import { getCalendarEventExplainer } from "@/app/lib/calendarEventExplain";
import {
  DEFAULT_CHART_PREFERENCES,
  loadChartPreferences,
  saveChartPreferences,
  type ChartAppearancePreferences,
  type ChartCursorReadoutMode,
  type ChartPreferences,
} from "@/app/lib/chartView";
import {
  getEventReplayStatusLabel,
  getEventTemplateTimingMap,
  getInitialEventReplayPair,
  getInitialEventReplaySampleIndex,
  getInitialEventReplayTimeframe,
  sortEventTemplates,
  type EventTemplateFilter,
} from "@/app/lib/eventReplayDisplay";
import {
  DEFAULT_REPLAY_AFTER_CANDLES,
  DEFAULT_REPLAY_BEFORE_CANDLES,
  EVENT_REPLAY_STORAGE_KEYS,
  clampReplayCount,
  getInitialReplayCount,
  getStorageItem,
  setStorageItem,
} from "@/app/lib/eventReplayStorage";
import {
  buildReplayReleaseCalendar,
  buildReplaySampleCalendarEvent,
  formatReplayPercent,
  formatReplayPips,
  getReplayMove,
  getUtcDateKey,
} from "@/app/lib/eventReplayView";
import {
  getHistoricalReplaySamples,
  getPairFirstReplayGroups,
  getReplayFetchRange,
  getReplayWindowCandles,
} from "@/app/lib/eventReaction";
import { formatRelativeAge } from "@/app/lib/format";
import type {
  BridgeCandle,
  BridgeStatus,
  CalendarEvent,
  ReplayChartTimeframe,
} from "@/app/types";

interface EventReplayTabProps {
  events: CalendarEvent[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
  pairIntent?: string | null;
  onConsumePairIntent?: () => void;
}

const STORAGE_KEYS = EVENT_REPLAY_STORAGE_KEYS;
const PLAYBACK_INTERVAL_MS = 550;
const DEFAULT_BEFORE_CANDLES = DEFAULT_REPLAY_BEFORE_CANDLES;
const DEFAULT_AFTER_CANDLES = DEFAULT_REPLAY_AFTER_CANDLES;

export function EventReplayTab({
  events,
  status,
  lastCalendarIngestAt,
  pairIntent = null,
  onConsumePairIntent,
}: EventReplayTabProps) {
  const [selectedPairName, setSelectedPairName] = useState(() => getInitialEventReplayPair().name);
  const selectedPair = useMemo(() => getFxPairByName(selectedPairName) ?? FX_PAIRS[0], [selectedPairName]);
  const [selectedEventKey, setSelectedEventKey] = useState(() => getStorageItem(STORAGE_KEYS.eventKey) ?? "");
  const [replayTimeframe, setReplayTimeframe] = useState<ReplayChartTimeframe>(() => getInitialEventReplayTimeframe());
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(() => getInitialEventReplaySampleIndex());
  const [beforeCount, setBeforeCount] = useState(() => getInitialReplayCount(STORAGE_KEYS.beforeCandles, DEFAULT_BEFORE_CANDLES));
  const [afterCount, setAfterCount] = useState(() => getInitialReplayCount(STORAGE_KEYS.afterCandles, DEFAULT_AFTER_CANDLES));
  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayWindow, setReplayWindow] = useState<{ candles: BridgeCandle[]; eventIndex: number } | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [releaseListOpen, setReleaseListOpen] = useState(false);
  const [eventListOpen, setEventListOpen] = useState(false);
  const [eventTemplateFilter, setEventTemplateFilter] = useState<EventTemplateFilter>("all");
  const [hoveredReleaseIndex, setHoveredReleaseIndex] = useState<number | null>(null);
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  const [chartPreferences, setChartPreferences] = useState<ChartPreferences>(() => loadChartPreferences());
  const [chartDrawerOpen, setChartDrawerOpen] = useState(false);
  const [chartDrawerMode, setChartDrawerMode] = useState<ChartDrawerMode>("appearance");
  const cacheRef = useRef<Map<string, Promise<BridgeCandle[]>>>(new Map());

  const groups = useMemo(
    () => getPairFirstReplayGroups({ events, pair: selectedPair, includeWeak: true }),
    [events, selectedPair],
  );
  const allTemplates = useMemo(
    () => [...groups.pairTemplates, ...groups.globalTemplates],
    [groups.globalTemplates, groups.pairTemplates],
  );
  const templateTiming = useMemo(
    () => getEventTemplateTimingMap(events, Math.floor(countdownNowMs / 1000)),
    [countdownNowMs, events],
  );
  const selectedTemplate = allTemplates.find((template) => template.key === selectedEventKey) ?? allTemplates[0] ?? null;
  const replaySamples = useMemo(
    () => (selectedTemplate ? getHistoricalReplaySamples({ events, templateKey: selectedTemplate.key }) : []),
    [events, selectedTemplate],
  );
  const selectedSample = replaySamples[selectedSampleIndex] ?? replaySamples[0] ?? null;
  const replayMove = useMemo(() => getReplayMove(replayWindow, selectedPair), [replayWindow, selectedPair]);
  const selectedSampleExplainer = useMemo(
    () => (selectedSample ? getCalendarEventExplainer(buildReplaySampleCalendarEvent(selectedSample)) : null),
    [selectedSample],
  );
  const overlayOpen = eventListOpen || releaseListOpen || detailsOpen || chartDrawerOpen;
  const visiblePairTemplates = useMemo(
    () =>
      sortEventTemplates(
        groups.pairTemplates.filter((template) => eventTemplateFilter === "all" || template.quality === eventTemplateFilter),
        "upcoming",
        templateTiming,
      ),
    [eventTemplateFilter, groups.pairTemplates, templateTiming],
  );
  const visibleGlobalTemplates = useMemo(
    () =>
      sortEventTemplates(
        groups.globalTemplates.filter((template) => eventTemplateFilter === "all" || template.quality === eventTemplateFilter),
        "upcoming",
        templateTiming,
      ),
    [eventTemplateFilter, groups.globalTemplates, templateTiming],
  );
  const recentlyReleasedTemplates = useMemo(
    () =>
      sortEventTemplates(
        allTemplates.filter((template) => eventTemplateFilter === "all" || template.quality === eventTemplateFilter),
        "recent",
        templateTiming,
      ).slice(0, 8),
    [allTemplates, eventTemplateFilter, templateTiming],
  );

  useEffect(() => {
    const id = window.setInterval(() => setCountdownNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!overlayOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setEventListOpen(false);
      setReleaseListOpen(false);
      setDetailsOpen(false);
      setChartDrawerOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlayOpen]);

  useEffect(() => {
    if (!pairIntent) return;
    const nextPair = getFxPairByName(pairIntent);
    if (!nextPair) {
      onConsumePairIntent?.();
      return;
    }

    if (nextPair.name !== selectedPairName) {
      setSelectedPairName(nextPair.name);
      setSelectedEventKey("");
      setSelectedSampleIndex(0);
      setIsPlaying(false);
    }

    onConsumePairIntent?.();
  }, [onConsumePairIntent, pairIntent, selectedPairName]);

  useEffect(() => {
    const firstKey = allTemplates[0]?.key ?? "";
    if (!selectedEventKey || !allTemplates.some((template) => template.key === selectedEventKey)) {
      setSelectedEventKey(firstKey);
      setSelectedSampleIndex(0);
    }
  }, [allTemplates, selectedEventKey]);

  useEffect(() => {
    if (replaySamples.length === 0 && selectedSampleIndex !== 0) {
      setSelectedSampleIndex(0);
      return;
    }
    if (replaySamples.length > 0 && selectedSampleIndex >= replaySamples.length) {
      setSelectedSampleIndex(0);
    }
  }, [replaySamples.length, selectedSampleIndex]);

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.pair, selectedPair.name);
    setStorageItem(STORAGE_KEYS.replayTimeframe, replayTimeframe);
    setStorageItem(STORAGE_KEYS.sampleIndex, String(selectedSampleIndex));
    setStorageItem(STORAGE_KEYS.beforeCandles, String(beforeCount));
    setStorageItem(STORAGE_KEYS.afterCandles, String(afterCount));
    if (selectedEventKey) setStorageItem(STORAGE_KEYS.eventKey, selectedEventKey);
  }, [afterCount, beforeCount, replayTimeframe, selectedEventKey, selectedPair.name, selectedSampleIndex]);

  useEffect(() => {
    if (!selectedSample) {
      setReplayWindow(null);
      setReplayLoading(false);
      setReplayError(null);
      setVisibleCount(0);
      setIsPlaying(false);
      return;
    }

    let cancelled = false;

    const loadReplay = async () => {
      setReplayLoading(true);
      setReplayError(null);
      setIsPlaying(false);

      try {
        const range = getReplayFetchRange({
          eventTime: selectedSample.eventTime,
          timeframe: replayTimeframe,
          beforeCount,
          afterCount,
        });
        const cacheKey = `${selectedPair.name}|${replayTimeframe}|${range.from}|${range.to}`;
        const cached = cacheRef.current.get(cacheKey);
        const request =
          cached ??
          fetchHistoryRange({
            symbol: selectedPair.name,
            tf: replayTimeframe,
            from: range.from,
            to: range.to,
          }).catch((error) => {
            cacheRef.current.delete(cacheKey);
            throw error;
          });

        if (!cached) cacheRef.current.set(cacheKey, request);
        const candles = await request;
        if (cancelled) return;

        const window = getReplayWindowCandles({
          candles,
          eventTime: selectedSample.eventTime,
          beforeCount,
          afterCount,
        });

        if (!window) {
          setReplayWindow(null);
          setVisibleCount(0);
          setReplayError("No replayable candle window was resolved for this release, pair, and timeframe.");
          return;
        }

        setReplayWindow(window);
        setVisibleCount(window.eventIndex + 1);
      } catch (error) {
        if (cancelled) return;
        setReplayWindow(null);
        setVisibleCount(0);
        setReplayError(error instanceof Error ? error.message : "Failed to load replay candles.");
      } finally {
        if (!cancelled) setReplayLoading(false);
      }
    };

    void loadReplay();
    return () => {
      cancelled = true;
    };
  }, [afterCount, beforeCount, replayTimeframe, selectedPair.name, selectedSample]);

  useEffect(() => {
    if (!isPlaying || !replayWindow) return;
    const id = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= replayWindow.candles.length) {
          window.clearInterval(id);
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, PLAYBACK_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [isPlaying, replayWindow]);

  const handleTemplateSelect = (key: string) => {
    setSelectedEventKey(key);
    setSelectedSampleIndex(0);
    setIsPlaying(false);
  };

  const handleBeforeChange = (value: string) => {
    setBeforeCount(clampReplayCount(Number(value), DEFAULT_BEFORE_CANDLES));
  };

  const handleAfterChange = (value: string) => {
    setAfterCount(clampReplayCount(Number(value), DEFAULT_AFTER_CANDLES));
  };

  const updateChartPreferences = (updater: (current: ChartPreferences) => ChartPreferences) => {
    setChartPreferences((current) => {
      const next = updater(current);
      saveChartPreferences(next);
      return next;
    });
  };

  const updateAppearance = <K extends keyof ChartAppearancePreferences>(key: K, value: ChartAppearancePreferences[K]) => {
    updateChartPreferences((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        [key]: value,
      },
    }));
  };

  const handleCursorModeChange = (mode: ChartCursorReadoutMode) => {
    updateChartPreferences((current) => ({ ...current, cursorReadoutMode: mode }));
  };

  const resetChartPreferences = () => {
    setChartPreferences(DEFAULT_CHART_PREFERENCES);
    saveChartPreferences(DEFAULT_CHART_PREFERENCES);
  };

  const feedAgeLabel = lastCalendarIngestAt == null ? "Broker feed unknown" : `Broker feed ${formatRelativeAge(lastCalendarIngestAt)}`;
  const samplePosition = replaySamples.length > 0 ? `${selectedSampleIndex + 1} of ${replaySamples.length}` : "0 of 0";
  const canSelectOlderRelease = replaySamples.length > 0 && selectedSampleIndex < replaySamples.length - 1;
  const canSelectNewerRelease = replaySamples.length > 0 && selectedSampleIndex > 0;
  const releaseAgeLabel =
    replaySamples.length === 0
      ? "No releases"
      : selectedSampleIndex === 0
        ? "Newest release"
        : selectedSampleIndex === replaySamples.length - 1
          ? "Oldest release"
          : "Historical release";
  const comparisonBasisLabel =
    selectedSample?.comparisonBasis === "forecast"
      ? "Forecast"
      : selectedSample?.comparisonBasis === "previous"
        ? "Previous"
        : "N/A";
  const surpriseLabel = selectedSample ? `${selectedSample.surprise >= 0 ? "+" : ""}${selectedSample.surprise.toFixed(4)}` : "N/A";
  const observedMoveLabel = replayMove ? `${formatReplayPips(replayMove.pips)} (${formatReplayPercent(replayMove.percent)})` : "N/A";
  const observedMoveDescription = replayMove
    ? `Price finished ${replayMove.label} over the loaded replay window after the release marker.`
    : "Loads after candles resolve.";
  const resultStripItems = [
    { label: "Observed move", value: observedMoveLabel },
    { label: "Actual", value: selectedSample?.actual || "N/A" },
    { label: "Forecast", value: selectedSample?.forecast || "N/A" },
    { label: "Previous", value: selectedSample?.previous || "N/A" },
    { label: "Surprise", value: surpriseLabel },
  ];
  const hoveredReleaseSample = hoveredReleaseIndex == null ? null : replaySamples[hoveredReleaseIndex] ?? null;
  const calendarFocusTime = hoveredReleaseSample?.eventTime ?? selectedSample?.eventTime ?? replaySamples[0]?.eventTime ?? null;
  const releaseCalendarCells = buildReplayReleaseCalendar(replaySamples, calendarFocusTime);
  const selectedReleaseDateKey = selectedSample ? getUtcDateKey(selectedSample.eventTime) : null;
  const hoveredReleaseDateKey = hoveredReleaseSample ? getUtcDateKey(hoveredReleaseSample.eventTime) : null;

  return (
    <section className="tab-panel event-replay-workspace relative left-1/2 flex h-[calc(100vh-98px)] min-h-[560px] w-[calc(100vw-24px)] max-w-none -translate-x-1/2 flex-col gap-3 overflow-hidden pb-2">
      <header className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
            <CalendarClock size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="m-0 text-xl font-black text-slate-950">Event Replay</h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <Clock3 size={13} />
                {getEventReplayStatusLabel(status)}
              </span>
              <span className="text-xs font-bold text-slate-500">{feedAgeLabel}</span>
            </div>
          </div>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">MT5 candles + broker calendar</span>
      </header>

      <section className="grid min-h-0 min-w-0 flex-1 gap-3 lg:grid-cols-[380px_minmax(0,1fr)]">
        <EventReplayControlRail
          selectedPair={selectedPair}
          selectedTemplate={selectedTemplate}
          selectedSample={selectedSample}
          samplePosition={samplePosition}
          releaseAgeLabel={releaseAgeLabel}
          canSelectOlderRelease={canSelectOlderRelease}
          canSelectNewerRelease={canSelectNewerRelease}
          replayReady={Boolean(replayWindow)}
          isPlaying={isPlaying}
          onPairChange={(pairName) => {
            setSelectedPairName(pairName);
            setSelectedEventKey("");
            setSelectedSampleIndex(0);
            setIsPlaying(false);
          }}
          onOpenEventList={() => setEventListOpen(true)}
          onSelectOlderRelease={() => setSelectedSampleIndex((index) => Math.min(replaySamples.length - 1, index + 1))}
          onSelectNewerRelease={() => setSelectedSampleIndex((index) => Math.max(0, index - 1))}
          onOpenReleaseList={() => setReleaseListOpen(true)}
          onTogglePlayback={() => {
            if (!replayWindow) return;
            if (visibleCount >= replayWindow.candles.length) setVisibleCount(replayWindow.eventIndex + 1);
            setIsPlaying((value) => !value);
          }}
          onOpenBrief={() => setDetailsOpen(true)}
        />

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-[260px] flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="m-0 text-base font-black text-slate-950">Preview</h3>
                <p className="m-0 min-w-0 break-words text-sm leading-5 text-slate-600">
                  {selectedTemplate ? `${selectedTemplate.currency} ${selectedTemplate.title}` : "Select an event type"}
                </p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {resultStripItems.map((item) => (
                  <div key={item.label} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</span>
                    <strong className="mt-1 block break-words text-xs leading-5 text-slate-950">{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
              >
                <BarChart3 size={15} />
                Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartDrawerMode("appearance");
                  setChartDrawerOpen(true);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
                aria-label="Replay chart settings"
              >
                <Settings2 size={15} />
                Chart
              </button>
            </div>
          </div>

          {replayError ? (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{replayError}</div>
          ) : null}

          <div className="min-h-0 flex-1 p-3">
            {!selectedTemplate ? (
              <div className="flex h-full min-h-[360px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                Select an event type to start replay study.
              </div>
            ) : replayLoading ? (
              <div className="flex h-full min-h-[360px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                Loading historical MT5 candles for this release...
              </div>
            ) : !replayWindow || !selectedSample ? (
              <div className="flex h-full min-h-[360px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                No replayable candle window is available for this event, pair, and timeframe.
              </div>
            ) : (
              <EventReplayCandlestickChart
                candles={replayWindow.candles}
                eventIndex={replayWindow.eventIndex}
                visibleCount={visibleCount}
                pair={selectedPair}
                timeframe={replayTimeframe}
                appearance={chartPreferences.appearance}
                cursorReadoutMode={chartPreferences.cursorReadoutMode}
              />
            )}
          </div>
        </main>
      </section>

      <ChartSettingsDrawer
        open={chartDrawerOpen}
        mode={chartDrawerMode}
        onModeChange={setChartDrawerMode}
        onClose={() => setChartDrawerOpen(false)}
        preferences={chartPreferences}
        onCursorModeChange={handleCursorModeChange}
        onAppearanceChange={updateAppearance}
        onResetAppearance={resetChartPreferences}
        title="Replay Chart Settings"
        description="Shared chart appearance and cursor behavior. These settings also apply to the main Charts tab."
      />

      {eventListOpen ? (
        <EventReplaySelectEventModal
          pairTemplateCount={groups.pairTemplates.length}
          globalTemplateCount={groups.globalTemplates.length}
          pairTemplates={visiblePairTemplates}
          globalTemplates={visibleGlobalTemplates}
          recentlyReleasedTemplates={recentlyReleasedTemplates}
          selectedTemplateKey={selectedTemplate?.key ?? null}
          filter={eventTemplateFilter}
          templateTiming={templateTiming}
          countdownNowMs={countdownNowMs}
          onFilterChange={setEventTemplateFilter}
          onSelectTemplate={(key) => {
            handleTemplateSelect(key);
            setEventListOpen(false);
          }}
          onClose={() => setEventListOpen(false)}
        />
      ) : null}

      {releaseListOpen ? (
        <EventReplayReleaseListModal
          samplePosition={samplePosition}
          samples={replaySamples}
          selectedSampleIndex={selectedSampleIndex}
          calendarFocusTime={calendarFocusTime}
          calendarCells={releaseCalendarCells}
          selectedDateKey={selectedReleaseDateKey}
          hoveredDateKey={hoveredReleaseDateKey}
          onClose={() => setReleaseListOpen(false)}
          onHoverRelease={setHoveredReleaseIndex}
          onSelectRelease={(index) => {
            setSelectedSampleIndex(index);
            setIsPlaying(false);
            setReleaseListOpen(false);
          }}
        />
      ) : null}

      {detailsOpen ? (
        <EventReplayBriefModal
          selectedTemplate={selectedTemplate}
          selectedSample={selectedSample}
          selectedSampleExplainer={selectedSampleExplainer}
          replayTimeframe={replayTimeframe}
          beforeCount={beforeCount}
          afterCount={afterCount}
          releaseAgeLabel={releaseAgeLabel}
          surpriseLabel={surpriseLabel}
          observedMoveLabel={observedMoveLabel}
          observedMoveDescription={observedMoveDescription}
          comparisonBasisLabel={comparisonBasisLabel}
          onClose={() => setDetailsOpen(false)}
          onReplayTimeframeChange={setReplayTimeframe}
          onBeforeCountChange={handleBeforeChange}
          onAfterCountChange={handleAfterChange}
        />
      ) : null}
    </section>
  );
}
