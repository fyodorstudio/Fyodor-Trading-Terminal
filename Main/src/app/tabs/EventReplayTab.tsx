import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pause,
  Play,
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
  FxPairDefinition,
  ReplayChartTimeframe,
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
  const cacheRef = useRef<Map<string, Promise<BridgeCandle[]>>>(new Map());
  const pairRailRef = useRef<HTMLDivElement | null>(null);
  const globalRailRef = useRef<HTMLDivElement | null>(null);

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

  const scrollTemplateRail = (rail: "pair" | "global", direction: -1 | 1) => {
    const node = rail === "pair" ? pairRailRef.current : globalRailRef.current;
    node?.scrollBy({ left: direction * 360, behavior: "smooth" });
  };

  const feedAgeLabel = lastCalendarIngestAt == null ? "Broker feed unknown" : `Broker feed ${formatRelativeAge(lastCalendarIngestAt)}`;
  const samplePosition = replaySamples.length > 0 ? `${selectedSampleIndex + 1} of ${replaySamples.length}` : "0 of 0";

  return (
    <section className="tab-panel event-replay-workspace relative left-1/2 flex w-[calc(100vw-24px)] max-w-none -translate-x-1/2 flex-col gap-4 overflow-x-hidden pb-6">
      <header className="grid gap-3 border border-slate-200 bg-white px-4 py-3 shadow-sm lg:grid-cols-[minmax(320px,1fr)_auto] lg:items-center">
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
            <p className="mt-1 text-sm text-slate-600">
              Pick the pair, choose the event type below, then replay how candles behaved around prior releases.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[180px_auto] sm:items-center">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pair</span>
            <select
              value={selectedPair.name}
              onChange={(event) => {
                setSelectedPairName(event.target.value);
                setSelectedEventKey("");
                setSelectedSampleIndex(0);
                setIsPlaying(false);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 outline-none"
              aria-label="Replay pair"
            >
              {FX_PAIRS.map((pair) => (
                <option key={pair.name} value={pair.name}>
                  {pair.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.base)} className="h-4 w-6" />
              Base {selectedPair.base}
            </span>
            <span className="inline-flex items-center gap-2">
              <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.quote)} className="h-4 w-6" />
              Quote {selectedPair.quote}
            </span>
            <span className="text-slate-500">MT5 candles + broker calendar</span>
          </div>
        </div>
      </header>

      <section className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <h3 className="m-0 text-base font-black text-slate-950">Replay Chart</h3>
            <p className="mt-1 truncate text-sm text-slate-600">
              {selectedTemplate
                ? `${selectedPair.name} around prior ${selectedTemplate.currency} ${selectedTemplate.title} releases.`
                : "Select an event type below to load prior releases."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:grid-cols-[110px_110px_minmax(160px,1fr)_minmax(150px,0.7fr)_minmax(120px,0.5fr)_auto] lg:items-end">
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
          <div className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Release</span>
            <strong className="mt-1 block truncate text-sm text-slate-950">
              {selectedSample ? formatUtcDateTime(selectedSample.eventTime) : "No release selected"}
            </strong>
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Comparison</span>
            <strong className="mt-1 block truncate text-sm text-slate-950">{selectedSample?.comparisonLabel ?? "N/A"}</strong>
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sample</span>
            <strong className="mt-1 block truncate text-sm text-slate-950">{samplePosition}</strong>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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

        {replayError ? (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{replayError}</div>
        ) : null}

        <div className="min-w-0 p-3">
          {!selectedTemplate ? (
            <div className="flex min-h-[420px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
              Select an event type below to start replay study.
            </div>
          ) : replayLoading ? (
            <div className="flex min-h-[420px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
              Loading historical MT5 candles for this release...
            </div>
          ) : !replayWindow || !selectedSample ? (
            <div className="flex min-h-[420px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
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
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,360px)_minmax(340px,0.95fr)]">
        <section className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="m-0 text-base font-black text-slate-950">Base/Quote Events</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {selectedPair.base} and {selectedPair.quote} releases appear first. Use the arrows or horizontal rail to browse.
            </p>
          </div>
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pair event types</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                  onClick={() => scrollTemplateRail("pair", -1)}
                  aria-label="Scroll pair events left"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                  onClick={() => scrollTemplateRail("pair", 1)}
                  aria-label="Scroll pair events right"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            <div ref={pairRailRef} className="flex min-w-0 snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2">
              {groups.pairTemplates.length === 0 ? (
                <div className="w-full border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No replayable base/quote event types are available in the current calendar window.
                </div>
              ) : (
                groups.pairTemplates.map((template) => (
                  <div key={template.key} className="w-[min(320px,82vw)] shrink-0 snap-start">
                    <EventTemplateButton
                      template={template}
                      active={selectedTemplate?.key === template.key}
                      onSelect={() => handleTemplateSelect(template.key)}
                    />
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="m-0 text-sm font-black text-slate-950">Major Global Movers</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">High-impact USD/EUR macro that can move broad FX risk.</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                    onClick={() => scrollTemplateRail("global", -1)}
                    aria-label="Scroll global movers left"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                    onClick={() => scrollTemplateRail("global", 1)}
                    aria-label="Scroll global movers right"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <div ref={globalRailRef} className="flex min-w-0 snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2">
                {groups.globalTemplates.length === 0 ? (
                  <div className="w-full border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No separate global mover templates are available for this pair right now.
                  </div>
                ) : (
                  groups.globalTemplates.map((template) => (
                    <div key={template.key} className="w-[min(320px,82vw)] shrink-0 snap-start">
                      <EventTemplateButton
                        template={template}
                        active={selectedTemplate?.key === template.key}
                        onSelect={() => handleTemplateSelect(template.key)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-base font-black text-slate-950">Past Releases</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Newest samples first.</p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                {samplePosition}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={selectedSampleIndex === 0 || replaySamples.length === 0}
                onClick={() => setSelectedSampleIndex((index) => Math.max(0, index - 1))}
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={replaySamples.length === 0 || selectedSampleIndex >= replaySamples.length - 1}
                onClick={() => setSelectedSampleIndex((index) => Math.min(replaySamples.length - 1, index + 1))}
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="max-h-[390px] overflow-y-auto px-3 py-3">
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
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <BarChart3 size={16} />
              </div>
              <div>
                <h3 className="m-0 text-base font-black text-slate-950">Replay Brief</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Descriptive context for the selected historical release.</p>
              </div>
            </div>
          </div>

          <div className="grid max-h-[510px] gap-2 overflow-y-auto px-4 py-3">
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
            <EventExplainerMiniBrief explainer={selectedSampleExplainer} />
          </div>
        </section>
      </section>

      <section className="grid gap-0 border border-slate-200 bg-white text-sm shadow-sm md:grid-cols-3">
        <div className="border-b border-slate-200 px-4 py-3 md:border-b-0 md:border-r">
          <strong className="block text-slate-950">Read the marker first</strong>
          <span className="mt-1 block text-slate-600">Before shows positioning; after shows acceptance or rejection.</span>
        </div>
        <div className="border-b border-slate-200 px-4 py-3 md:border-b-0 md:border-r">
          <strong className="block text-slate-950">Check the comparison basis</strong>
          <span className="mt-1 block text-slate-600">Forecast is preferred; previous is fallback only.</span>
        </div>
        <div className="px-4 py-3">
          <strong className="block text-slate-950">Study behavior</strong>
          <span className="mt-1 block text-slate-600">Use replay to understand reaction shape, volatility, and follow-through.</span>
        </div>
      </section>
    </section>
  );
}
