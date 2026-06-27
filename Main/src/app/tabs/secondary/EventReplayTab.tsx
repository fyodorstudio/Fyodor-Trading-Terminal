import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  Pause,
  Play,
  X,
} from "lucide-react";
import { EventReplayCandlestickChart } from "@/app/components/EventReplayCandlestickChart";
import { EventExplainerMiniBrief, EventSampleButton, EventTemplateButton } from "@/app/components/EventReplayPanels";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { fetchHistoryRange } from "@/app/lib/bridge";
import { getCalendarEventExplainer } from "@/app/lib/calendarEventExplain";
import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import {
  DEFAULT_REPLAY_AFTER_CANDLES,
  DEFAULT_REPLAY_BEFORE_CANDLES,
  EVENT_REPLAY_STORAGE_KEYS,
  MAX_REPLAY_CANDLES,
  MIN_REPLAY_CANDLES,
  clampReplayCount,
  getInitialReplayCount,
  getStorageItem,
  setStorageItem,
} from "@/app/lib/eventReplayStorage";
import {
  buildReplaySampleCalendarEvent,
  formatReplayPercent,
  formatReplayPips,
  getReplayMove,
} from "@/app/lib/eventReplayView";
import {
  REPLAY_TIMEFRAME_OPTIONS,
  getHistoricalReplaySamples,
  getPairFirstReplayGroups,
  getReplayFetchRange,
  getReplayWindowCandles,
} from "@/app/lib/eventReaction";
import { formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import type {
  BridgeCandle,
  BridgeStatus,
  CalendarEvent,
  EventTemplate,
  FxPairDefinition,
  ReplayChartTimeframe,
  SampleQuality,
} from "@/app/types";

interface EventReplayTabProps {
  events: CalendarEvent[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
}

const STORAGE_KEYS = EVENT_REPLAY_STORAGE_KEYS;
const PLAYBACK_INTERVAL_MS = 550;
const DEFAULT_BEFORE_CANDLES = DEFAULT_REPLAY_BEFORE_CANDLES;
const DEFAULT_AFTER_CANDLES = DEFAULT_REPLAY_AFTER_CANDLES;
const QUALITY_ORDER: Record<SampleQuality, number> = { usable: 0, limited: 1, weak: 2 };

type EventTemplateFilter = "all" | SampleQuality;
type EventTemplateSort = "quality" | "sample_count" | "currency";

function getInitialPair(): FxPairDefinition {
  return getFxPairByName(getStorageItem(STORAGE_KEYS.pair) ?? "EURUSD") ?? FX_PAIRS[0];
}

function getInitialReplayTimeframe(): ReplayChartTimeframe {
  const saved = getStorageItem(STORAGE_KEYS.replayTimeframe);
  return REPLAY_TIMEFRAME_OPTIONS.some((option) => option.id === saved) ? (saved as ReplayChartTimeframe) : "H1";
}

function getInitialSampleIndex(): number {
  const saved = Number(getStorageItem(STORAGE_KEYS.sampleIndex) ?? "0");
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
}

function renderStatusLabel(status: BridgeStatus): string {
  if (status === "live") return "Calendar live";
  if (status === "stale") return "Calendar stale";
  if (status === "loading") return "Loading events";
  if (status === "no_data") return "No calendar rows";
  return "Bridge unavailable";
}

function sortEventTemplates(templates: EventTemplate[], sortMode: EventTemplateSort): EventTemplate[] {
  return [...templates].sort((left, right) => {
    if (sortMode === "quality") {
      const qualityDelta = QUALITY_ORDER[left.quality] - QUALITY_ORDER[right.quality];
      if (qualityDelta !== 0) return qualityDelta;
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      return left.title.localeCompare(right.title);
    }
    if (sortMode === "sample_count") {
      if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
      const qualityDelta = QUALITY_ORDER[left.quality] - QUALITY_ORDER[right.quality];
      if (qualityDelta !== 0) return qualityDelta;
      return left.title.localeCompare(right.title);
    }
    if (left.currency !== right.currency) return left.currency.localeCompare(right.currency);
    return left.title.localeCompare(right.title);
  });
}

export function EventReplayTab({ events, status, lastCalendarIngestAt }: EventReplayTabProps) {
  const [selectedPairName, setSelectedPairName] = useState(() => getInitialPair().name);
  const selectedPair = useMemo(() => getFxPairByName(selectedPairName) ?? FX_PAIRS[0], [selectedPairName]);
  const [selectedEventKey, setSelectedEventKey] = useState(() => getStorageItem(STORAGE_KEYS.eventKey) ?? "");
  const [replayTimeframe, setReplayTimeframe] = useState<ReplayChartTimeframe>(() => getInitialReplayTimeframe());
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(() => getInitialSampleIndex());
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
  const [eventTemplateSort, setEventTemplateSort] = useState<EventTemplateSort>("quality");
  const cacheRef = useRef<Map<string, Promise<BridgeCandle[]>>>(new Map());

  const groups = useMemo(
    () => getPairFirstReplayGroups({ events, pair: selectedPair, includeWeak: true }),
    [events, selectedPair],
  );
  const allTemplates = useMemo(
    () => [...groups.pairTemplates, ...groups.globalTemplates],
    [groups.globalTemplates, groups.pairTemplates],
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
  const visiblePairTemplates = useMemo(
    () =>
      sortEventTemplates(
        groups.pairTemplates.filter((template) => eventTemplateFilter === "all" || template.quality === eventTemplateFilter),
        eventTemplateSort,
      ),
    [eventTemplateFilter, eventTemplateSort, groups.pairTemplates],
  );
  const visibleGlobalTemplates = useMemo(
    () =>
      sortEventTemplates(
        groups.globalTemplates.filter((template) => eventTemplateFilter === "all" || template.quality === eventTemplateFilter),
        eventTemplateSort,
      ),
    [eventTemplateFilter, eventTemplateSort, groups.globalTemplates],
  );

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

  const feedAgeLabel = lastCalendarIngestAt == null ? "Broker feed unknown" : `Broker feed ${formatRelativeAge(lastCalendarIngestAt)}`;
  const samplePosition = replaySamples.length > 0 ? `${selectedSampleIndex + 1} of ${replaySamples.length}` : "0 of 0";

  return (
    <section className="tab-panel event-replay-workspace relative left-1/2 flex w-[calc(100vw-24px)] max-w-none -translate-x-1/2 flex-col gap-3 overflow-x-hidden pb-4">
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
                {renderStatusLabel(status)}
              </span>
              <span className="text-xs font-bold text-slate-500">{feedAgeLabel}</span>
            </div>
          </div>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">MT5 candles + broker calendar</span>
      </header>

      <section className="grid min-h-[calc(100vh-190px)] min-w-0 gap-3 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pair</span>
              <select
                value={selectedPair.name}
                onChange={(event) => {
                  setSelectedPairName(event.target.value);
                  setSelectedEventKey("");
                  setSelectedSampleIndex(0);
                  setIsPlaying(false);
                }}
                className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-2xl font-black tracking-tight text-slate-950 outline-none"
                aria-label="Replay pair"
              >
                {FX_PAIRS.map((pair) => (
                  <option key={pair.name} value={pair.name}>
                    {pair.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-black text-slate-800">
              <span className="inline-flex items-center gap-2">
                <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.base)} className="h-7 w-10 shadow-sm" />
                Base {selectedPair.base}
              </span>
              <span className="inline-flex items-center gap-2">
                <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.quote)} className="h-7 w-10 shadow-sm" />
                Quote {selectedPair.quote}
              </span>
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {REPLAY_TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReplayTimeframe(option.id)}
                  className={`h-9 rounded-xl border px-3 text-xs font-black ${
                    replayTimeframe === option.id
                      ? "border-slate-900 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Before</span>
                <input
                  type="number"
                  min={MIN_REPLAY_CANDLES}
                  max={MAX_REPLAY_CANDLES}
                  value={beforeCount}
                  onChange={(event) => handleBeforeChange(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">After</span>
                <input
                  type="number"
                  min={MIN_REPLAY_CANDLES}
                  max={MAX_REPLAY_CANDLES}
                  value={afterCount}
                  onChange={(event) => handleAfterChange(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none"
                />
              </label>
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-3">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Release</span>
            <strong className="mt-1 block text-sm text-slate-950">
              {selectedSample ? formatUtcDateTime(selectedSample.eventTime) : "No release selected"}
            </strong>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block font-black uppercase tracking-[0.12em] text-slate-400">Sample</span>
                <strong className="mt-0.5 block text-slate-900">{samplePosition}</strong>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block font-black uppercase tracking-[0.12em] text-slate-400">Compare</span>
                <strong className="mt-0.5 block truncate text-slate-900">{selectedSample?.comparisonLabel ?? "N/A"}</strong>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={selectedSampleIndex === 0 || replaySamples.length === 0}
                onClick={() => setSelectedSampleIndex((index) => Math.max(0, index - 1))}
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={replaySamples.length === 0 || selectedSampleIndex >= replaySamples.length - 1}
                onClick={() => setSelectedSampleIndex((index) => Math.min(replaySamples.length - 1, index + 1))}
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800"
                onClick={() => setReleaseListOpen(true)}
              >
                <List size={15} />
                Past Releases
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800"
                onClick={() => setDetailsOpen(true)}
              >
                <BarChart3 size={15} />
                Replay Brief
              </button>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!replayWindow}
              onClick={() => {
                if (!replayWindow) return;
                if (visibleCount >= replayWindow.candles.length) setVisibleCount(replayWindow.eventIndex + 1);
                setIsPlaying((value) => !value);
              }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>

          <div className="min-h-0 flex-1 px-4 py-3">
            <div className="border border-slate-200 bg-slate-50 px-3 py-3">
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Event</span>
              <strong className="mt-1 block break-words text-sm text-slate-950">
                {selectedTemplate ? `${selectedTemplate.currency} | ${selectedTemplate.title}` : "No event selected"}
              </strong>
              <span className="mt-1 block text-xs text-slate-500">
                {selectedTemplate ? `${selectedTemplate.familyLabel} / ${selectedTemplate.sampleCount} releases` : "Choose an event type to study."}
              </span>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 hover:border-slate-300"
              onClick={() => setEventListOpen(true)}
            >
              <List size={16} />
              Select Event
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <h3 className="m-0 text-base font-black text-slate-950">Preview</h3>
              <p className="mt-1 truncate text-sm text-slate-600">
                {selectedTemplate ? `${selectedTemplate.currency} ${selectedTemplate.title}` : "Select an event type"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
            >
              <BarChart3 size={15} />
              Details
            </button>
          </div>

          {replayError ? (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{replayError}</div>
          ) : null}

          <div className="min-h-0 flex-1 p-3">
            {!selectedTemplate ? (
              <div className="flex h-full min-h-[520px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                Select an event type to start replay study.
              </div>
            ) : replayLoading ? (
              <div className="flex h-full min-h-[520px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                Loading historical MT5 candles for this release...
              </div>
            ) : !replayWindow || !selectedSample ? (
              <div className="flex h-full min-h-[520px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                No replayable candle window is available for this event, pair, and timeframe.
              </div>
            ) : (
              <EventReplayCandlestickChart
                candles={replayWindow.candles}
                eventIndex={replayWindow.eventIndex}
                visibleCount={visibleCount}
                pair={selectedPair}
                timeframe={replayTimeframe}
              />
            )}
          </div>
        </main>
      </section>

      {eventListOpen ? (
        <div className="fixed inset-0 z-[1200] bg-slate-950/20 backdrop-blur-sm" onClick={() => setEventListOpen(false)}>
          <aside
            className="absolute bottom-4 right-4 top-4 flex w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="m-0 text-lg font-black text-slate-950">Select Event</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {groups.pairTemplates.length} pair events / {groups.globalTemplates.length} global movers
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
                  onClick={() => setEventListOpen(false)}
                  aria-label="Close event selector"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
                <div className="flex flex-wrap gap-2">
                  {(["all", "usable", "limited", "weak"] as EventTemplateFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`h-9 rounded-xl border px-3 text-xs font-black capitalize ${
                        eventTemplateFilter === filter
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                      onClick={() => setEventTemplateFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sort</span>
                  <select
                    value={eventTemplateSort}
                    onChange={(event) => setEventTemplateSort(event.target.value as EventTemplateSort)}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 outline-none"
                  >
                    <option value="quality">Quality first</option>
                    <option value="sample_count">Most releases</option>
                    <option value="currency">Currency</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="m-0 text-sm font-black text-slate-950">Base/Quote Events</h4>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{visiblePairTemplates.length} shown</span>
              </div>
              <div className="grid gap-2">
                {visiblePairTemplates.length === 0 ? (
                  <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No pair events match this filter.
                  </div>
                ) : (
                  visiblePairTemplates.map((template) => (
                    <EventTemplateButton
                      key={template.key}
                      template={template}
                      active={selectedTemplate?.key === template.key}
                      onSelect={() => {
                        handleTemplateSelect(template.key);
                        setEventListOpen(false);
                      }}
                    />
                  ))
                )}
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="m-0 text-sm font-black text-slate-950">Major Global Movers</h4>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{visibleGlobalTemplates.length} shown</span>
                </div>
                <div className="grid gap-2">
                  {visibleGlobalTemplates.length === 0 ? (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No global movers match this filter.
                    </div>
                  ) : (
                    visibleGlobalTemplates.map((template) => (
                      <EventTemplateButton
                        key={template.key}
                        template={template}
                        active={selectedTemplate?.key === template.key}
                        onSelect={() => {
                          handleTemplateSelect(template.key);
                          setEventListOpen(false);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {releaseListOpen ? (
        <div className="fixed inset-0 z-[1200] bg-slate-950/20 backdrop-blur-sm" onClick={() => setReleaseListOpen(false)}>
          <section
            className="absolute bottom-4 right-4 top-4 flex w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="m-0 text-base font-black text-slate-950">Past Releases</h3>
                <p className="mt-1 text-xs text-slate-600">{samplePosition}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                onClick={() => setReleaseListOpen(false)}
                aria-label="Close release list"
              >
                <X size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="grid gap-2">
                {replaySamples.length === 0 ? (
                  <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No historical releases with usable actual/comparison values.
                  </div>
                ) : (
                  replaySamples.map((sample, index) => (
                    <EventSampleButton
                      key={sample.eventId}
                      sample={sample}
                      active={index === selectedSampleIndex}
                      onSelect={() => {
                        setSelectedSampleIndex(index);
                        setIsPlaying(false);
                        setReleaseListOpen(false);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {detailsOpen ? (
        <div className="fixed inset-0 z-[1200] bg-slate-950/20 backdrop-blur-sm" onClick={() => setDetailsOpen(false)}>
          <aside
            className="absolute bottom-4 right-4 top-4 flex w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <BarChart3 size={17} />
                </div>
                <div>
                  <h3 className="m-0 text-lg font-black text-slate-950">Replay Brief</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Context for the selected historical release.</p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
                onClick={() => setDetailsOpen(false)}
                aria-label="Close replay brief"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto px-5 py-4">
              <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Event Type</span>
                <strong className="mt-1 block break-words text-sm text-slate-950">{selectedTemplate ? `${selectedTemplate.currency} ${selectedTemplate.title}` : "N/A"}</strong>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Actual / Forecast / Previous</span>
                <strong className="mt-1 block break-words text-sm text-slate-950">
                  {selectedSample ? `${selectedSample.actual || "N/A"} / ${selectedSample.forecast || "N/A"} / ${selectedSample.previous || "N/A"}` : "N/A"}
                </strong>
                {selectedSample ? (
                  <span className="mt-1 block text-xs text-slate-500">
                    Compared by {selectedSample.comparisonLabel.toLowerCase()}; surprise {selectedSample.surprise >= 0 ? "+" : ""}{selectedSample.surprise.toFixed(4)}.
                  </span>
                ) : null}
              </div>
              <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Observed Move</span>
                <strong className="mt-1 block text-sm text-slate-950">
                  {replayMove ? `${formatReplayPips(replayMove.pips)} (${formatReplayPercent(replayMove.percent)})` : "N/A"}
                </strong>
                <span className="mt-1 block text-xs text-slate-500">
                  {replayMove ? `Price finished ${replayMove.label} over the loaded replay window after the release marker.` : "Loads after candles resolve."}
                </span>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
                <strong className="block text-sm text-slate-950">Read the marker first</strong>
                <span className="mt-1 block text-sm text-slate-600">Before shows positioning; after shows acceptance or rejection.</span>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
                <strong className="block text-sm text-slate-950">Check the comparison basis</strong>
                <span className="mt-1 block text-sm text-slate-600">Forecast is preferred; previous is fallback only.</span>
              </div>
              <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
                <strong className="block text-sm text-slate-950">Study behavior</strong>
                <span className="mt-1 block text-sm text-slate-600">Use replay to understand reaction shape, volatility, and follow-through.</span>
              </div>
              <EventExplainerMiniBrief explainer={selectedSampleExplainer} />
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
