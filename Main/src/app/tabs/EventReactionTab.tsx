import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarClock, ChevronLeft, ChevronRight, Clock3, Pause, Play } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { fetchHistoryRange } from "@/app/lib/bridge";
import { getCurrencyCountryCode } from "@/app/lib/eventQuality";
import {
  REACTION_WINDOWS,
  REPLAY_TIMEFRAME_OPTIONS,
  deriveAssetFirstStudy,
  deriveEventFirstStudy,
  discoverEventTemplates,
  getAllReactionFamilies,
  getHistoricalReplaySamples,
  getMonthlyChunkKeys,
  getMonthlyChunkRange,
  getPairTemplateMap,
  getReplayWindowCandles,
  getRelevantPairsForCurrency,
  getSampleQualityLabel,
  getTemplateEvents,
  getUpcomingReactionEvents,
} from "@/app/lib/eventReaction";
import { formatCountdown, formatUtcDateTime } from "@/app/lib/format";
import type {
  BridgeCandle,
  CalendarEvent,
  EventQualityFamily,
  EventReactionMode,
  FxPairDefinition,
  ReactionReplaySample,
  ReactionStudySummary,
  ReactionWindow,
  ReplayChartTimeframe,
  SampleQuality,
} from "@/app/types";

interface EventReactionTabProps {
  events: CalendarEvent[];
}

const TASK_OPTIONS: Array<{ id: EventReactionMode; label: string; helper: string }> = [
  {
    id: "event-first",
    label: "Study an upcoming event",
    helper: "Pick a release that is coming up, then replay how price behaved after past occurrences.",
  },
  {
    id: "asset-first",
    label: "Study a pair",
    helper: "Start from one FX pair and inspect which event releases have historically moved it.",
  },
];

const STORAGE_KEYS = {
  task: "reaction-engine-task",
  pair: "reaction-engine-pair",
  eventCurrency: "reaction-engine-event-currency",
  eventFamily: "reaction-engine-event-family",
  pairFamily: "reaction-engine-pair-family",
  weak: "reaction-engine-show-weak",
  template: "reaction-engine-template",
  replayTimeframe: "reaction-engine-replay-tf",
};

const BEFORE_CANDLES = 14;
const AFTER_CANDLES = 14;
const PLAYBACK_INTERVAL_MS = 500;

const REPLAY_WINDOW_BY_TIMEFRAME: Record<ReplayChartTimeframe, ReactionWindow> = {
  M15: "15m",
  H1: "1h",
  H4: "4h",
  D1: "1d",
};

function getInitialTask(): EventReactionMode {
  if (typeof window === "undefined") return "event-first";
  return window.localStorage.getItem(STORAGE_KEYS.task) === "asset-first" ? "asset-first" : "event-first";
}

function getInitialPair(): FxPairDefinition {
  if (typeof window === "undefined") return FX_PAIRS[0];
  return getFxPairByName(window.localStorage.getItem(STORAGE_KEYS.pair) ?? "EURUSD") ?? FX_PAIRS[0];
}

function getInitialFamily(storageKey: string): EventQualityFamily | "all" {
  if (typeof window === "undefined") return "all";
  const saved = window.localStorage.getItem(storageKey);
  const families = new Set(getAllReactionFamilies().map((item) => item.id));
  return families.has((saved ?? "all") as EventQualityFamily | "all")
    ? ((saved ?? "all") as EventQualityFamily | "all")
    : "all";
}

function getInitialTemplateKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEYS.template) ?? "";
}

function getInitialReplayTimeframe(): ReplayChartTimeframe {
  if (typeof window === "undefined") return "H1";
  const saved = window.localStorage.getItem(STORAGE_KEYS.replayTimeframe);
  return REPLAY_TIMEFRAME_OPTIONS.some((option) => option.id === saved) ? (saved as ReplayChartTimeframe) : "H1";
}

function getInitialShowWeak(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEYS.weak) === "true";
}

function formatCount(value: number): string {
  return value === 1 ? "1 sample" : `${value} samples`;
}

function formatPips(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pips`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`;
}

function mergeCandleArrays(arrays: BridgeCandle[][]): BridgeCandle[] {
  const byTime = new Map<number, BridgeCandle>();
  arrays.forEach((rows) => {
    rows.forEach((row) => {
      byTime.set(row.time, row);
    });
  });
  return [...byTime.values()].sort((left, right) => left.time - right.time);
}

function buildWindowMap(
  timeframeMap: Map<string, BridgeCandle[]>,
  symbol: string,
): Record<ReactionWindow, BridgeCandle[]> {
  return {
    "15m": timeframeMap.get(`${symbol}|M1`) ?? [],
    "1h": timeframeMap.get(`${symbol}|M1`) ?? [],
    "4h": timeframeMap.get(`${symbol}|M15`) ?? [],
    "1d": timeframeMap.get(`${symbol}|H1`) ?? [],
  };
}

function qualityTone(quality: SampleQuality): string {
  if (quality === "usable") return "is-usable";
  if (quality === "limited") return "is-limited";
  return "is-weak";
}

function getReplayMetricWindow(timeframe: ReplayChartTimeframe): ReactionWindow {
  return REPLAY_WINDOW_BY_TIMEFRAME[timeframe];
}

function formatSampleOrdinal(index: number, total: number): string {
  return `Sample ${index + 1} of ${total}`;
}

function CandleReplayChart(props: {
  candles: BridgeCandle[];
  eventIndex: number;
  visibleCount: number;
}) {
  const width = 760;
  const height = 320;
  const top = 16;
  const bottom = 28;
  const chartHeight = height - top - bottom;
  const candleStep = width / Math.max(props.candles.length, 1);
  const candleWidth = Math.max(6, Math.min(16, candleStep * 0.56));
  const visibleCandles = props.candles.slice(0, props.visibleCount);
  const visibleRange = props.candles.slice(0, Math.max(props.eventIndex + 1, props.visibleCount));
  const lows = visibleRange.map((candle) => candle.low);
  const highs = visibleRange.map((candle) => candle.high);
  const minPrice = Math.min(...lows);
  const maxPrice = Math.max(...highs);
  const range = Math.max(maxPrice - minPrice, 0.00001);
  const priceToY = (price: number) => top + ((maxPrice - price) / range) * chartHeight;
  const gridLines = 4;
  const eventX = props.eventIndex * candleStep + candleStep / 2;

  return (
    <div className="replay-canvas-shell">
      <svg viewBox={`0 0 ${width} ${height}`} className="replay-canvas" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: gridLines + 1 }, (_, index) => {
          const y = top + (chartHeight / gridLines) * index;
          return <line key={`grid-${index}`} x1="0" y1={y} x2={width} y2={y} className="replay-grid-line" />;
        })}
        <rect x={eventX} y={top} width={Math.max(0, width - eventX)} height={chartHeight} className="replay-post-zone" />
        <line x1={eventX} y1={top} x2={eventX} y2={top + chartHeight} className="replay-event-line" />
        <text x={Math.min(width - 54, eventX + 6)} y={18} className="replay-event-label">
          Release
        </text>
        {visibleCandles.map((candle, index) => {
          const x = index * candleStep + candleStep / 2;
          const openY = priceToY(candle.open);
          const closeY = priceToY(candle.close);
          const highY = priceToY(candle.high);
          const lowY = priceToY(candle.low);
          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(openY - closeY), 2);
          const isUp = candle.close >= candle.open;

          return (
            <g key={`candle-${candle.time}`} className={isUp ? "replay-candle is-up" : "replay-candle is-down"}>
              <line x1={x} y1={highY} x2={x} y2={lowY} className="replay-candle-wick" />
              <rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyHeight} rx="1" className="replay-candle-body" />
            </g>
          );
        })}
      </svg>
      <div className="replay-axis">
        <span>{formatUtcDateTime(props.candles[0]?.time ?? 0)}</span>
        <span>Release</span>
        <span>{formatUtcDateTime(props.candles.at(-1)?.time ?? 0)}</span>
      </div>
    </div>
  );
}

export function EventReactionTab({ events }: EventReactionTabProps) {
  const [task, setTask] = useState<EventReactionMode>(() => getInitialTask());
  const [selectedPair, setSelectedPair] = useState<FxPairDefinition>(() => getInitialPair());
  const [eventCurrency, setEventCurrency] = useState("");
  const [eventFamily, setEventFamily] = useState<EventQualityFamily | "all">(() => getInitialFamily(STORAGE_KEYS.eventFamily));
  const [pairFamily, setPairFamily] = useState<EventQualityFamily | "all">(() => getInitialFamily(STORAGE_KEYS.pairFamily));
  const [showWeak, setShowWeak] = useState(() => getInitialShowWeak());
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(() => getInitialTemplateKey());
  const [selectedUpcomingId, setSelectedUpcomingId] = useState<string | null>(null);
  const [replayTimeframe, setReplayTimeframe] = useState<ReplayChartTimeframe>(() => getInitialReplayTimeframe());
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [study, setStudy] = useState<ReactionStudySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replayCandles, setReplayCandles] = useState<BridgeCandle[]>([]);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [selectionNote, setSelectionNote] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const cacheRef = useRef<Map<string, Promise<BridgeCandle[]>>>(new Map());
  const lastEventTemplateRef = useRef<string | null>(null);

  const familyOptions = useMemo(() => getAllReactionFamilies(), []);
  const templateUniverse = useMemo(() => discoverEventTemplates({ events, includeWeak: true }), [events]);
  const templates = useMemo(() => discoverEventTemplates({ events, includeWeak: showWeak }), [events, showWeak]);
  const upcomingEvents = useMemo(() => getUpcomingReactionEvents({ events, templates, horizonDays: 7 }), [events, templates]);
  const availableCurrencies = useMemo(() => {
    const values = new Set<string>();
    templateUniverse.forEach((template) => values.add(template.currency));
    upcomingEvents.forEach((event) => values.add(event.currency));
    return [...values].sort();
  }, [templateUniverse, upcomingEvents]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!eventCurrency && availableCurrencies.length > 0) {
      setEventCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, eventCurrency]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.task, task);
  }, [task]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.pair, selectedPair.name);
  }, [selectedPair]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.eventCurrency, eventCurrency);
  }, [eventCurrency]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.eventFamily, eventFamily);
  }, [eventFamily]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.pairFamily, pairFamily);
  }, [pairFamily]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.weak, showWeak ? "true" : "false");
  }, [showWeak]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedTemplateKey) {
      window.localStorage.setItem(STORAGE_KEYS.template, selectedTemplateKey);
    }
  }, [selectedTemplateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.replayTimeframe, replayTimeframe);
  }, [replayTimeframe]);

  const manualTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (eventCurrency && template.currency !== eventCurrency) return false;
        if (eventFamily !== "all" && template.family !== eventFamily) return false;
        return true;
      }),
    [eventCurrency, eventFamily, templates],
  );

  const pairTemplateMap = useMemo(
    () =>
      getPairTemplateMap({
        events,
        pair: selectedPair,
        family: pairFamily,
        includeWeak: showWeak,
      }),
    [events, pairFamily, selectedPair, showWeak],
  );

  useEffect(() => {
    if (task !== "event-first") return;
    if (manualTemplates.length === 0) {
      setSelectedTemplateKey("");
      return;
    }

    if (!manualTemplates.some((template) => template.key === selectedTemplateKey)) {
      setSelectedTemplateKey(manualTemplates[0].key);
    }
  }, [manualTemplates, selectedTemplateKey, task]);

  useEffect(() => {
    if (task !== "asset-first") return;
    const options = [...pairTemplateMap.values()].map((entry) => entry.template);
    if (options.length === 0) {
      setSelectedTemplateKey("");
      return;
    }

    if (!options.some((template) => template.key === selectedTemplateKey)) {
      setSelectedTemplateKey(options[0].key);
    }
  }, [pairTemplateMap, selectedTemplateKey, task]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateKey) return null;
    return pairTemplateMap.get(selectedTemplateKey)?.template ?? templateUniverse.find((template) => template.key === selectedTemplateKey) ?? null;
  }, [pairTemplateMap, selectedTemplateKey, templateUniverse]);

  const templateEvents = useMemo(() => {
    if (!selectedTemplate) return [];
    if (task === "asset-first") {
      return pairTemplateMap.get(selectedTemplate.key)?.events ?? [];
    }
    return getTemplateEvents({
      events,
      templateKey: selectedTemplate.key,
    });
  }, [events, pairTemplateMap, selectedTemplate, task]);

  const selectedUpcoming = useMemo(
    () => upcomingEvents.find((event) => event.id === selectedUpcomingId) ?? null,
    [selectedUpcomingId, upcomingEvents],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (task === "event-first" && (!selectedTemplate || templateEvents.length === 0)) {
        setStudy(null);
        setLoading(false);
        setLoadError(null);
        return;
      }

      if (task === "asset-first" && pairTemplateMap.size === 0) {
        setStudy(null);
        setLoading(false);
        setLoadError(null);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const timeframeMap = new Map<string, BridgeCandle[]>();
        const specs = new Map<string, { symbol: string; timeframe: "M1" | "M15" | "H1"; chunkKey: string }>();
        const eventTimes =
          task === "event-first"
            ? templateEvents.map((event) => event.time)
            : [...pairTemplateMap.values()].flatMap((entry) => entry.events.map((event) => event.time));
        const chunkKeys = getMonthlyChunkKeys(eventTimes);
        const symbols =
          task === "event-first"
            ? getRelevantPairsForCurrency(selectedTemplate!.currency).map((pair) => pair.name)
            : [selectedPair.name];
        const timeframes: Array<"M1" | "M15" | "H1"> = [...new Set(REACTION_WINDOWS.map((window) => window.timeframe))];

        symbols.forEach((symbol) => {
          timeframes.forEach((timeframe) => {
            chunkKeys.forEach((chunkKey) => {
              specs.set(`${symbol}|${timeframe}|${chunkKey}`, { symbol, timeframe, chunkKey });
            });
          });
        });

        const results = await Promise.all(
          [...specs.values()].map(async (spec) => {
            const cacheKey = `${spec.symbol}|${spec.timeframe}|${spec.chunkKey}`;
            const cached = cacheRef.current.get(cacheKey);
            if (cached) {
              return cached.then((rows) => ({ spec, rows }));
            }

            const range = getMonthlyChunkRange(spec.chunkKey, spec.timeframe);
            const request = fetchHistoryRange({
              symbol: spec.symbol,
              tf: spec.timeframe,
              from: range.from,
              to: range.to,
            }).catch((error) => {
              cacheRef.current.delete(cacheKey);
              throw error;
            });

            cacheRef.current.set(cacheKey, request);
            return request.then((rows) => ({ spec, rows }));
          }),
        );

        if (cancelled) return;

        const grouped = new Map<string, BridgeCandle[][]>();
        results.forEach(({ spec, rows }) => {
          const key = `${spec.symbol}|${spec.timeframe}`;
          const list = grouped.get(key) ?? [];
          list.push(rows);
          grouped.set(key, list);
        });

        grouped.forEach((rows, key) => {
          timeframeMap.set(key, mergeCandleArrays(rows));
        });

        if (task === "event-first") {
          const pairCandles = new Map<string, Record<ReactionWindow, BridgeCandle[]>>();
          getRelevantPairsForCurrency(selectedTemplate!.currency).forEach((pair) => {
            pairCandles.set(pair.name, buildWindowMap(timeframeMap, pair.name));
          });

          setStudy(
            deriveEventFirstStudy({
              template: selectedTemplate!,
              templateEvents,
              pairCandles,
            }),
          );
        } else {
          setStudy(
            deriveAssetFirstStudy({
              pair: selectedPair,
              templateMap: pairTemplateMap,
              candlesByWindow: buildWindowMap(timeframeMap, selectedPair.name),
            }),
          );
        }
      } catch (error) {
        if (cancelled) return;
        setStudy(null);
        setLoadError(error instanceof Error ? error.message : "Failed to load historical MT5 candles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [pairTemplateMap, selectedPair, selectedTemplate, task, templateEvents]);

  const eventPairRows = useMemo(() => (task === "event-first" ? study?.rows ?? [] : []), [study, task]);

  useEffect(() => {
    if (task !== "event-first" || eventPairRows.length === 0) return;
    const biggestMoverPair = getFxPairByName(eventPairRows[0].key);
    if (!biggestMoverPair) return;

    if (lastEventTemplateRef.current !== selectedTemplateKey) {
      setSelectedPair(biggestMoverPair);
      lastEventTemplateRef.current = selectedTemplateKey;
      return;
    }

    if (!eventPairRows.some((row) => row.key === selectedPair.name)) {
      setSelectedPair(biggestMoverPair);
    }
  }, [eventPairRows, selectedPair.name, selectedTemplateKey, task]);

  const selectedStudyRow = useMemo(() => {
    if (!study) return null;
    if (task === "event-first") {
      return study.rows.find((row) => row.key === selectedPair.name) ?? study.rows[0] ?? null;
    }
    return study.rows.find((row) => row.key === selectedTemplateKey) ?? study.rows[0] ?? null;
  }, [selectedPair.name, selectedTemplateKey, study, task]);

  const pairManualTemplates = useMemo(
    () =>
      [...pairTemplateMap.values()]
        .map((entry) => entry.template)
        .sort((left, right) => {
          if (right.sampleCount !== left.sampleCount) return right.sampleCount - left.sampleCount;
          return left.title.localeCompare(right.title);
        }),
    [pairTemplateMap],
  );

  const historicalSamples = useMemo(() => {
    if (!selectedTemplateKey) return [];
    return getHistoricalReplaySamples({
      events,
      templateKey: selectedTemplateKey,
    });
  }, [events, selectedTemplateKey]);

  useEffect(() => {
    let cancelled = false;

    const loadReplay = async () => {
      if (!selectedTemplateKey || historicalSamples.length === 0) {
        setReplayCandles([]);
        setReplayLoading(false);
        setReplayError(null);
        return;
      }

      setReplayLoading(true);
      setReplayError(null);

      try {
        const chunkKeys = getMonthlyChunkKeys(historicalSamples.map((sample) => sample.eventTime));
        const results = await Promise.all(
          chunkKeys.map(async (chunkKey) => {
            const cacheKey = `${selectedPair.name}|${replayTimeframe}|${chunkKey}`;
            const cached = cacheRef.current.get(cacheKey);
            if (cached) return cached;

            const range = getMonthlyChunkRange(chunkKey, replayTimeframe);
            const request = fetchHistoryRange({
              symbol: selectedPair.name,
              tf: replayTimeframe,
              from: range.from,
              to: range.to,
            }).catch((error) => {
              cacheRef.current.delete(cacheKey);
              throw error;
            });

            cacheRef.current.set(cacheKey, request);
            return request;
          }),
        );

        if (cancelled) return;
        setReplayCandles(mergeCandleArrays(results));
      } catch (error) {
        if (cancelled) return;
        setReplayCandles([]);
        setReplayError(error instanceof Error ? error.message : "Failed to load replay candles.");
      } finally {
        if (!cancelled) setReplayLoading(false);
      }
    };

    void loadReplay();
    return () => {
      cancelled = true;
    };
  }, [historicalSamples, replayTimeframe, selectedPair.name, selectedTemplateKey]);

  const replayEntries = useMemo(
    () =>
      historicalSamples
        .map((sample) => {
          const window = getReplayWindowCandles({
            candles: replayCandles,
            eventTime: sample.eventTime,
            beforeCount: BEFORE_CANDLES,
            afterCount: AFTER_CANDLES,
          });

          if (!window) return null;
          return { sample, window };
        })
        .filter((entry): entry is { sample: ReactionReplaySample; window: { candles: BridgeCandle[]; eventIndex: number } } => entry !== null),
    [historicalSamples, replayCandles],
  );

  useEffect(() => {
    setSelectedSampleIndex(0);
    setIsPlaying(false);
  }, [selectedTemplateKey, selectedPair.name, replayTimeframe, task]);

  useEffect(() => {
    if (selectedSampleIndex >= replayEntries.length) {
      setSelectedSampleIndex(0);
    }
  }, [replayEntries.length, selectedSampleIndex]);

  const selectedReplayEntry = replayEntries[selectedSampleIndex] ?? null;

  useEffect(() => {
    if (!selectedReplayEntry) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount(selectedReplayEntry.window.eventIndex + 1);
    setIsPlaying(false);
  }, [selectedReplayEntry]);

  useEffect(() => {
    if (!isPlaying || !selectedReplayEntry) return;
    const totalCandles = selectedReplayEntry.window.candles.length;
    if (visibleCount >= totalCandles) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= totalCandles) {
          window.clearInterval(timer);
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, PLAYBACK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPlaying, selectedReplayEntry, visibleCount]);

  const selectedTask = TASK_OPTIONS.find((option) => option.id === task) ?? TASK_OPTIONS[0];
  const selectedReplayWindow = getReplayMetricWindow(replayTimeframe);
  const selectedWindowStats = selectedStudyRow?.summaryWindows[selectedReplayWindow] ?? null;
  const pairRankingPreview = useMemo(() => {
    if (!study?.rows.length) return [];
    return study.rows.slice(0, 5);
  }, [study]);

  const handleUpcomingSelect = (params: {
    upcomingId: string;
    templateKey: string | null;
    currency: string;
    family: EventQualityFamily;
    title: string;
  }) => {
    setTask("event-first");
    setSelectedUpcomingId(params.upcomingId);
    setEventCurrency(params.currency);
    setEventFamily(params.family);

    if (!params.templateKey) {
      setSelectedTemplateKey("");
      setStudy(null);
      setSelectionNote(`${params.currency} ${params.title} has not built enough historical samples yet.`);
      return;
    }

    setSelectedTemplateKey(params.templateKey);
    setSelectionNote(null);
  };

  return (
    <section className="tab-panel reaction-panel">
      <section className="replay-shell">
        <header className="replay-header">
          <div className="replay-header-copy">
            <div className="replay-header-icon">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2>Event Reaction Engine</h2>
              <p>{selectedTask.helper}</p>
            </div>
          </div>

          <div className="replay-task-switch">
            {TASK_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`replay-task-button ${task === option.id ? "is-active" : ""}`}
                onClick={() => {
                  setTask(option.id);
                  setSelectionNote(null);
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.helper}</span>
              </button>
            ))}
          </div>
        </header>

        {task === "event-first" ? (
          <>
            <section className="replay-block">
              <div className="replay-block-head">
                <div>
                  <h3>Upcoming Events</h3>
                  <p>Pick an upcoming release to study how price reacted to past occurrences of the same event.</p>
                </div>
                <div className="replay-block-tag">
                  <Clock3 size={14} />
                  <span>Next 7 days</span>
                </div>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="replay-empty">No supported macro events are scheduled in the next 7 days.</div>
              ) : (
                <div className="replay-upcoming-list">
                  {upcomingEvents.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`replay-upcoming-row ${selectedUpcoming?.id === item.id ? "is-active" : ""}`}
                      onClick={() =>
                        handleUpcomingSelect({
                          upcomingId: item.id,
                          templateKey: item.templateKey,
                          currency: item.currency,
                          family: item.family,
                          title: item.title,
                        })
                      }
                    >
                      <div className="replay-upcoming-time">
                        <strong>{formatUtcDateTime(item.time)}</strong>
                        <span>{formatCountdown(item.time, nowMs)}</span>
                      </div>
                      <div className="replay-upcoming-main">
                        <div className="replay-upcoming-flag">
                          <FlagIcon countryCode={getCurrencyCountryCode(item.currency)} className="h-5 w-8" />
                          <strong>{item.currency}</strong>
                        </div>
                        <div className="replay-upcoming-copy">
                          <strong>{item.title}</strong>
                          <span>{item.familyLabel}</span>
                        </div>
                      </div>
                      <div className="replay-upcoming-side">
                        {item.templateKey ? (
                          <>
                            <div className={`replay-quality-pill ${qualityTone(item.quality ?? "weak")}`}>{getSampleQualityLabel(item.quality ?? "weak")}</div>
                            <span>{formatCount(item.sampleCount)}</span>
                          </>
                        ) : (
                          <span className="replay-side-muted">No usable historical sample yet</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="replay-block">
              <div className="replay-block-head">
                <div>
                  <h3>Manual Event Selector</h3>
                  <p>Use this only when you want to jump to a specific title instead of starting from the upcoming list.</p>
                </div>
              </div>

              <div className="replay-manual-grid">
                <label className="replay-field">
                  <span>Currency</span>
                  <select
                    value={eventCurrency}
                    onChange={(event) => {
                      setEventCurrency(event.target.value);
                      setSelectedUpcomingId(null);
                      setSelectionNote(null);
                    }}
                  >
                    {availableCurrencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="replay-field">
                  <span>Family</span>
                  <select
                    value={eventFamily}
                    onChange={(event) => {
                      setEventFamily(event.target.value as EventQualityFamily | "all");
                      setSelectedUpcomingId(null);
                      setSelectionNote(null);
                    }}
                  >
                    {familyOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="replay-field replay-field-wide">
                  <span>Exact event</span>
                  <select
                    value={selectedTemplateKey}
                    onChange={(event) => {
                      setSelectedTemplateKey(event.target.value);
                      setSelectedUpcomingId(null);
                      setSelectionNote(null);
                    }}
                    disabled={manualTemplates.length === 0}
                  >
                    {manualTemplates.length === 0 ? (
                      <option value="">No matching historical event</option>
                    ) : (
                      manualTemplates.map((template) => (
                        <option key={template.key} value={template.key}>
                          {template.title} ({template.sampleCount})
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="replay-checkbox">
                  <input type="checkbox" checked={showWeak} onChange={(event) => setShowWeak(event.target.checked)} />
                  <span>Include weak templates</span>
                </label>
              </div>
            </section>
          </>
        ) : (
          <section className="replay-block">
            <div className="replay-block-head">
              <div>
                <h3>Study a Pair</h3>
                <p>Choose one FX pair first, then pick the event release you want to replay.</p>
              </div>
            </div>

            <div className="replay-manual-grid replay-manual-grid-pair">
              <label className="replay-field">
                <span>FX pair</span>
                <select value={selectedPair.name} onChange={(event) => setSelectedPair(getFxPairByName(event.target.value) ?? FX_PAIRS[0])}>
                  {FX_PAIRS.map((pair) => (
                    <option key={pair.name} value={pair.name}>
                      {pair.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="replay-field">
                <span>Family</span>
                <select value={pairFamily} onChange={(event) => setPairFamily(event.target.value as EventQualityFamily | "all")}>
                  {familyOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="replay-field replay-field-wide">
                <span>Exact event</span>
                <select value={selectedTemplateKey} onChange={(event) => setSelectedTemplateKey(event.target.value)} disabled={pairManualTemplates.length === 0}>
                  {pairManualTemplates.length === 0 ? (
                    <option value="">No matching event for this pair</option>
                  ) : (
                    pairManualTemplates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.currency} | {template.title} ({template.sampleCount})
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="replay-checkbox">
                <input type="checkbox" checked={showWeak} onChange={(event) => setShowWeak(event.target.checked)} />
                <span>Include weak templates</span>
              </label>
            </div>
          </section>
        )}

        {task === "event-first" && selectedTemplate && study?.rows.length ? (
          <section className="replay-block">
            <div className="replay-block-head">
              <div>
                <h3>Relevant FX Pairs</h3>
                <p>We pick the biggest historical mover first, but you can switch to any relevant major pair.</p>
              </div>
            </div>

            <div className="replay-pair-strip">
              {eventPairRows.map((row) => {
                const pair = getFxPairByName(row.key);
                if (!pair) return null;

                return (
                  <button
                    key={row.key}
                    type="button"
                    className={`replay-pair-chip ${selectedPair.name === pair.name ? "is-active" : ""}`}
                    onClick={() => setSelectedPair(pair)}
                  >
                    <div className="replay-pair-chip-flags">
                      <FlagIcon countryCode={getCurrencyCountryCode(pair.base)} className="h-4 w-6" />
                      <FlagIcon countryCode={getCurrencyCountryCode(pair.quote)} className="h-4 w-6" />
                    </div>
                    <div className="replay-pair-chip-copy">
                      <strong>{pair.name}</strong>
                      <span>{formatPips(row.summaryWindows["1h"].medianAbsolutePips)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="replay-main-grid">
          <section className="replay-main-card">
            <div className="replay-block-head">
              <div>
                <h3>Historical Replay</h3>
                <p>
                  {selectedTemplate
                    ? `Showing how ${selectedPair.name} moved before and after past ${selectedTemplate.currency} ${selectedTemplate.title} releases.`
                    : "Choose an event first, then the replay panel will load here."}
                </p>
              </div>

              <div className="replay-timeframe-row">
                {REPLAY_TIMEFRAME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`replay-timeframe-button ${replayTimeframe === option.id ? "is-active" : ""}`}
                    onClick={() => setReplayTimeframe(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {selectionNote ? <div className="replay-note">{selectionNote}</div> : null}
            {loadError ? <div className="replay-note is-danger">{loadError}</div> : null}
            {replayError ? <div className="replay-note is-danger">{replayError}</div> : null}

            {!selectedTemplate ? (
              <div className="replay-empty">Pick an upcoming event or one exact event first.</div>
            ) : replayLoading || loading ? (
              <div className="replay-empty">Loading historical MT5 candles for the replay...</div>
            ) : !selectedReplayEntry ? (
              <div className="replay-empty">No replayable historical samples were resolved for this pair and timeframe.</div>
            ) : (
              <>
                <div className="replay-meta-grid">
                  <div>
                    <span>Selected pair</span>
                    <strong>{selectedPair.name}</strong>
                  </div>
                  <div>
                    <span>Event</span>
                    <strong>{selectedTemplate.currency} | {selectedTemplate.title}</strong>
                  </div>
                  <div>
                    <span>Historical release</span>
                    <strong>{formatUtcDateTime(selectedReplayEntry.sample.eventTime)}</strong>
                  </div>
                  {selectedUpcoming ? (
                    <>
                      <div>
                        <span>Upcoming release</span>
                        <strong>{formatUtcDateTime(selectedUpcoming.time)}</strong>
                      </div>
                      <div>
                        <span>Countdown</span>
                        <strong>{formatCountdown(selectedUpcoming.time, nowMs)}</strong>
                      </div>
                    </>
                  ) : null}
                  <div>
                    <span>Actual / Forecast / Previous</span>
                    <strong>
                      {selectedReplayEntry.sample.actual} / {selectedReplayEntry.sample.forecast} / {selectedReplayEntry.sample.previous || "N/A"}
                    </strong>
                  </div>
                </div>

                <div className="replay-controls">
                  <div className="replay-sample-nav">
                    <button
                      type="button"
                      className="replay-control-button"
                      disabled={selectedSampleIndex === 0}
                      onClick={() => setSelectedSampleIndex((index) => Math.max(0, index - 1))}
                    >
                      <ChevronLeft size={15} />
                      Previous
                    </button>

                    <div className="replay-sample-pill">{formatSampleOrdinal(selectedSampleIndex, replayEntries.length)}</div>

                    <button
                      type="button"
                      className="replay-control-button"
                      disabled={selectedSampleIndex >= replayEntries.length - 1}
                      onClick={() => setSelectedSampleIndex((index) => Math.min(replayEntries.length - 1, index + 1))}
                    >
                      Next
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="replay-play-button"
                    onClick={() => {
                      if (visibleCount >= selectedReplayEntry.window.candles.length) {
                        setVisibleCount(selectedReplayEntry.window.eventIndex + 1);
                      }
                      setIsPlaying((value) => !value);
                    }}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    <span>{isPlaying ? "Pause" : "Play"}</span>
                  </button>
                </div>

                <CandleReplayChart
                  candles={selectedReplayEntry.window.candles}
                  eventIndex={selectedReplayEntry.window.eventIndex}
                  visibleCount={visibleCount}
                />
              </>
            )}
          </section>

          <aside className="replay-side-stack">
            <section className="replay-side-card">
              <div className="replay-side-head">
                <h3>Historical Context</h3>
                {selectedStudyRow ? <div className={`replay-quality-pill ${qualityTone(selectedStudyRow.quality)}`}>{getSampleQualityLabel(selectedStudyRow.quality)}</div> : null}
              </div>

              {selectedStudyRow ? (
                <div className="replay-side-metrics">
                  <div>
                    <span>Usable samples</span>
                    <strong>{selectedStudyRow.sampleCount}</strong>
                  </div>
                  <div>
                    <span>Typical move ({replayTimeframe})</span>
                    <strong>{formatPips(selectedWindowStats?.medianPips ?? null)}</strong>
                    <small>{formatPercent(selectedWindowStats?.medianReturn ?? null)}</small>
                  </div>
                  <div>
                    <span>Typical absolute move ({replayTimeframe})</span>
                    <strong>{formatPips(selectedWindowStats?.medianAbsolutePips ?? null)}</strong>
                    <small>{formatCount(selectedWindowStats?.sampleSize ?? 0)}</small>
                  </div>
                </div>
              ) : (
                <div className="replay-empty">No context is available until a study is loaded.</div>
              )}
            </section>

            <section className="replay-side-card">
              <div className="replay-side-head">
                <h3>{task === "event-first" ? "Pair Order" : "Related Events"}</h3>
              </div>

              {pairRankingPreview.length > 0 ? (
                <div className="replay-order-list">
                  {pairRankingPreview.map((row) => (
                    <div key={row.key} className={`replay-order-row ${selectedStudyRow?.key === row.key ? "is-active" : ""}`}>
                      <div>
                        <strong>{row.label}</strong>
                        <span>{getSampleQualityLabel(row.quality)}</span>
                      </div>
                      <div>
                        <strong>{formatPips(row.summaryWindows["1h"].medianAbsolutePips)}</strong>
                        <span>1h typical</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="replay-empty">
                  {task === "event-first"
                    ? "Relevant pair ordering appears here after you choose an event."
                    : "Related event templates appear here after you choose a pair."}
                </div>
              )}
            </section>

            <section className="replay-side-card">
              <div className="replay-side-head">
                <h3>How To Use This</h3>
              </div>

              <div className="replay-guidance">
                <div>
                  <CalendarClock size={14} />
                  <span>Start with an upcoming event whenever possible.</span>
                </div>
                <div>
                  <Play size={14} />
                  <span>Press play to reveal candles after the release one by one.</span>
                </div>
                <div>
                  <BarChart3 size={14} />
                  <span>Use the side metrics only as context while you study price behavior.</span>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </section>
    </section>
  );
}
