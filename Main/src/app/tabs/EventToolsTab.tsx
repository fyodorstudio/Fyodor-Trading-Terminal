import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import {
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import { FX_PAIRS, getFxPairByName } from "@/app/config/fxPairs";
import { fetchHistoryRange } from "@/app/lib/bridge";
import {
  deriveEventQualitySummary,
  getCurrencyCountryCode,
  getEventQualityThresholds,
} from "@/app/lib/eventQuality";
import {
  REACTION_WINDOWS,
  REPLAY_TIMEFRAME_OPTIONS,
  buildEventTemplateKey,
  deriveEventFirstStudy,
  discoverEventTemplates,
  getAllReactionFamilies,
  getHistoricalReplaySamples,
  getMonthlyChunkKeys,
  getMonthlyChunkRange,
  getRelevantPairsForCurrency,
  getReplayWindowCandles,
  getSampleQualityLabel,
  getTemplateEvents,
  getUpcomingReactionEvents,
} from "@/app/lib/eventReaction";
import { formatCountdown, formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import type {
  BridgeCandle,
  BridgeStatus,
  CalendarEvent,
  EventQualityFamily,
  EventQualityHorizon,
  EventToolsStudy,
  FxPairDefinition,
  ReactionReplaySample,
  ReactionStats,
  ReactionStudyRow,
  ReactionWindow,
  ReplayChartTimeframe,
  SampleQuality,
} from "@/app/types";

interface EventToolsTabProps {
  events: CalendarEvent[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
}

const STORAGE_KEYS = {
  eventKey: "event-tools-event-key",
  upcomingId: "event-tools-upcoming-id",
  pair: "event-tools-pair",
  eventCurrency: "event-tools-event-currency",
  family: "event-tools-event-family",
  weak: "event-tools-show-weak",
  replayTimeframe: "event-tools-replay-tf",
  sampleIndex: "event-tools-sample-index",
  horizon: "event-tools-environment-horizon",
};

const PLAYBACK_INTERVAL_MS = 550;
const BEFORE_CANDLES = 14;
const AFTER_CANDLES = 14;

function getInitialPair(): FxPairDefinition {
  if (typeof window === "undefined") return FX_PAIRS[0];
  return getFxPairByName(window.localStorage.getItem(STORAGE_KEYS.pair) ?? "EURUSD") ?? FX_PAIRS[0];
}

function getInitialFamily(): EventQualityFamily | "all" {
  if (typeof window === "undefined") return "all";
  const saved = window.localStorage.getItem(STORAGE_KEYS.family);
  const families = new Set(getAllReactionFamilies().map((item) => item.id));
  return families.has((saved ?? "all") as EventQualityFamily | "all")
    ? ((saved ?? "all") as EventQualityFamily | "all")
    : "all";
}

function getInitialReplayTimeframe(): ReplayChartTimeframe {
  if (typeof window === "undefined") return "H1";
  const saved = window.localStorage.getItem(STORAGE_KEYS.replayTimeframe);
  return REPLAY_TIMEFRAME_OPTIONS.some((option) => option.id === saved) ? (saved as ReplayChartTimeframe) : "H1";
}

function getInitialHorizon(): EventQualityHorizon {
  if (typeof window === "undefined") return "24h";
  const saved = window.localStorage.getItem(STORAGE_KEYS.horizon);
  return saved === "72h" || saved === "this_week" ? saved : "24h";
}

function getInitialShowWeak(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEYS.weak) === "true";
}

function getInitialSampleIndex(): number {
  if (typeof window === "undefined") return 0;
  const saved = Number(window.localStorage.getItem(STORAGE_KEYS.sampleIndex) ?? "0");
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
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

function renderStatusLabel(status: BridgeStatus): string {
  if (status === "live") return "Calendar feed live";
  if (status === "stale") return "Calendar feed stale";
  if (status === "loading") return "Loading MT5 events";
  if (status === "no_data") return "No MT5 calendar rows";
  return "Bridge unavailable";
}

function qualityTone(quality: SampleQuality): string {
  if (quality === "usable") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (quality === "limited") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function eventEnvironmentTone(label: "clean" | "mixed" | "dirty"): string {
  if (label === "clean") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (label === "mixed") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function mergeCandleArrays(arrays: BridgeCandle[][]): BridgeCandle[] {
  const byTime = new Map<number, BridgeCandle>();
  arrays.forEach((rows) => {
    rows.forEach((row) => byTime.set(row.time, row));
  });
  return [...byTime.values()].sort((left, right) => left.time - right.time);
}

function buildMetricWindowMap(
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

function getChartTimeframe(timeframe: ReplayChartTimeframe): "M15" | "H1" | "H4" | "D1" {
  return timeframe;
}

function getMetricWindow(timeframe: ReplayChartTimeframe): ReactionWindow {
  if (timeframe === "M15") return "15m";
  if (timeframe === "H1") return "1h";
  if (timeframe === "H4") return "4h";
  return "1d";
}

function formatReplayAxisTime(time: number, timeframe: ReplayChartTimeframe): string {
  const date = new Date(time * 1000);
  if (timeframe === "M15") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  if (timeframe === "H1" || timeframe === "H4") {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getReactionTendency(row: ReactionStudyRow | null, window: ReactionWindow): string {
  if (!row) return "Historical tendency will appear after the study loads.";
  const beat = row.bucketStats.find((bucket) => bucket.bucket === "beat")?.windows[window].medianPips ?? null;
  const miss = row.bucketStats.find((bucket) => bucket.bucket === "miss")?.windows[window].medianPips ?? null;

  if (beat == null && miss == null) return "Beat/miss direction is not resolved from the current sample.";
  if (beat != null && miss != null) {
    if (beat > 0 && miss < 0) return "Beats tend to lift price, while misses tend to knock it lower in the selected window.";
    if (beat < 0 && miss > 0) return "Beats tend to press price lower, while misses tend to lift it in the selected window.";
  }
  return "The sample shows movement after release, but direction is not cleanly separated by beat versus miss.";
}

function getStudyBrief(study: EventToolsStudy | null, timeframe: ReplayChartTimeframe): Array<{ label: string; value: string; hint?: string }> {
  if (!study || !study.selectedRow) return [];
  const stats = study.selectedRow.summaryWindows[getMetricWindow(timeframe)];
  return [
    { label: "Sample quality", value: `${getSampleQualityLabel(study.selectedRow.quality)} (${study.selectedRow.sampleCount})`, hint: "Counts usable historical occurrences." },
    { label: `Typical move (${timeframe})`, value: formatPips(stats.medianAbsolutePips), hint: formatPercent(stats.medianAbsoluteReturn) },
    { label: "Best pair expression", value: study.pairRanking[0]?.label ?? "Unresolved", hint: "Ranked by 1h median absolute move." },
    { label: "Beat / miss tendency", value: getReactionTendency(study.selectedRow, getMetricWindow(timeframe)) },
  ];
}

function ReplayCandlestickChart(props: {
  candles: BridgeCandle[];
  eventIndex: number;
  visibleCount: number;
  pair: FxPairDefinition;
  timeframe: ReplayChartTimeframe;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartRef.current) return;

    const chart = createChart(container, {
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#64748b",
        fontFamily: "Geist, Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(100, 116, 139, 0.06)" },
        horzLines: { color: "rgba(100, 116, 139, 0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 4,
        barSpacing: 14,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
      crosshair: {
        vertLine: { labelBackgroundColor: "#111827" },
        horzLine: { labelBackgroundColor: "#111827" },
      },
      localization: {
        timeFormatter: (time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.applyOptions({ width: rect.width, height: rect.height });
      }
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const isJpy = props.pair.quote === "JPY";
    series.applyOptions({
      priceFormat: isJpy
        ? { type: "price", precision: 3, minMove: 0.001 }
        : { type: "price", precision: 5, minMove: 0.00001 },
    });
  }, [props.pair]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
      localization: {
        timeFormatter: (time) => formatReplayAxisTime(Number(time), props.timeframe),
      },
    });
  }, [props.timeframe]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const visible = props.candles.slice(0, props.visibleCount);
    series.setData(visible as CandlestickData[]);

    if (visible.length > 0 && props.visibleCount > props.eventIndex) {
      const markerTime = props.candles[props.eventIndex]?.time;
      if (markerTime != null) {
        createSeriesMarkers(series, [
          {
            time: markerTime,
            position: "aboveBar",
            color: "#2563eb",
            shape: "arrowDown",
            text: "Release",
          },
        ]);
      }
    } else {
      createSeriesMarkers(series, []);
    }

    chart.timeScale().fitContent();
  }, [props.candles, props.eventIndex, props.visibleCount]);

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-3 shadow-sm">
      <div ref={containerRef} className="h-[420px] w-full rounded-[18px]" />
    </div>
  );
}

export function EventToolsTab({ events, status, lastCalendarIngestAt }: EventToolsTabProps) {
  const [selectedPair, setSelectedPair] = useState<FxPairDefinition>(() => getInitialPair());
  const [eventCurrency, setEventCurrency] = useState("");
  const [eventFamily, setEventFamily] = useState<EventQualityFamily | "all">(() => getInitialFamily());
  const [showWeak, setShowWeak] = useState(() => getInitialShowWeak());
  const [selectedEventKey, setSelectedEventKey] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(STORAGE_KEYS.eventKey) ?? ""),
  );
  const [selectedUpcomingId, setSelectedUpcomingId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : (window.localStorage.getItem(STORAGE_KEYS.upcomingId) ?? null),
  );
  const [replayTimeframe, setReplayTimeframe] = useState<ReplayChartTimeframe>(() => getInitialReplayTimeframe());
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(() => getInitialSampleIndex());
  const [environmentHorizon, setEnvironmentHorizon] = useState<EventQualityHorizon>(() => getInitialHorizon());
  const [study, setStudy] = useState<EventToolsStudy | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectionNote, setSelectionNote] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayWindow, setReplayWindow] = useState<{ candles: BridgeCandle[]; eventIndex: number } | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, Promise<BridgeCandle[]>>>(new Map());

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

  const manualTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (eventCurrency && template.currency !== eventCurrency) return false;
        if (eventFamily !== "all" && template.family !== eventFamily) return false;
        return true;
      }),
    [eventCurrency, eventFamily, templates],
  );

  const selectedUpcoming = useMemo(
    () => upcomingEvents.find((event) => event.id === selectedUpcomingId) ?? null,
    [selectedUpcomingId, upcomingEvents],
  );

  const selectedTemplate = useMemo(
    () => templateUniverse.find((template) => template.key === selectedEventKey) ?? null,
    [selectedEventKey, templateUniverse],
  );

  const templateEvents = useMemo(
    () => (selectedTemplate ? getTemplateEvents({ events, templateKey: selectedTemplate.key }) : []),
    [events, selectedTemplate],
  );

  const replaySamples = useMemo<ReactionReplaySample[]>(
    () => (selectedEventKey ? getHistoricalReplaySamples({ events, templateKey: selectedEventKey }) : []),
    [events, selectedEventKey],
  );

  const selectedReplaySample = replaySamples[selectedSampleIndex] ?? replaySamples[0] ?? null;
  const selectedWindowStats: ReactionStats | null = study?.selectedRow
    ? study.selectedRow.summaryWindows[getMetricWindow(replayTimeframe)]
    : null;
  const thresholds = useMemo(() => getEventQualityThresholds(environmentHorizon), [environmentHorizon]);

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
    window.localStorage.setItem(STORAGE_KEYS.pair, selectedPair.name);
    window.localStorage.setItem(STORAGE_KEYS.eventCurrency, eventCurrency);
    window.localStorage.setItem(STORAGE_KEYS.family, eventFamily);
    window.localStorage.setItem(STORAGE_KEYS.weak, showWeak ? "true" : "false");
    window.localStorage.setItem(STORAGE_KEYS.replayTimeframe, replayTimeframe);
    window.localStorage.setItem(STORAGE_KEYS.sampleIndex, String(selectedSampleIndex));
    window.localStorage.setItem(STORAGE_KEYS.horizon, environmentHorizon);
    if (selectedEventKey) window.localStorage.setItem(STORAGE_KEYS.eventKey, selectedEventKey);
    if (selectedUpcomingId) window.localStorage.setItem(STORAGE_KEYS.upcomingId, selectedUpcomingId);
  }, [
    environmentHorizon,
    eventCurrency,
    eventFamily,
    replayTimeframe,
    selectedEventKey,
    selectedPair.name,
    selectedSampleIndex,
    selectedUpcomingId,
    showWeak,
  ]);

  useEffect(() => {
    if (selectedEventKey) return;
    if (upcomingEvents.length > 0) {
      const first = upcomingEvents[0];
      setSelectedUpcomingId(first.id);
      setSelectedEventKey(first.templateKey ?? buildEventTemplateKey(first.currency, first.title));
      return;
    }
    if (manualTemplates.length > 0) setSelectedEventKey(manualTemplates[0].key);
  }, [manualTemplates, selectedEventKey, upcomingEvents]);

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
    let cancelled = false;

    const loadStudy = async () => {
      if (!selectedTemplate || templateEvents.length === 0) {
        setStudy({
          selectedTemplate,
          selectedPair,
          selectedUpcomingEvent: selectedUpcoming,
          pairRanking: [],
          selectedRow: null,
          replaySamples,
          eventEnvironment:
            selectedTemplate && selectedPair
              ? deriveEventQualitySummary({ events, pair: selectedPair, horizon: environmentHorizon })
              : null,
        });
        setLoading(false);
        setLoadError(null);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const timeframeMap = new Map<string, BridgeCandle[]>();
        const chunkKeys = getMonthlyChunkKeys(templateEvents.map((event) => event.time));
        const symbols = getRelevantPairsForCurrency(selectedTemplate.currency).map((pair) => pair.name);
        const timeframes: Array<"M1" | "M15" | "H1"> = [...new Set(REACTION_WINDOWS.map((window) => window.timeframe))];
        const specs = new Map<string, { symbol: string; timeframe: "M1" | "M15" | "H1"; chunkKey: string }>();

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
            if (cached) return cached.then((rows) => ({ spec, rows }));

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

        grouped.forEach((rows, key) => timeframeMap.set(key, mergeCandleArrays(rows)));

        const pairCandles = new Map<string, Record<ReactionWindow, BridgeCandle[]>>();
        getRelevantPairsForCurrency(selectedTemplate.currency).forEach((pair) => {
          pairCandles.set(pair.name, buildMetricWindowMap(timeframeMap, pair.name));
        });

        const summary = deriveEventFirstStudy({
          template: selectedTemplate,
          templateEvents,
          pairCandles,
        });

        const topPair = getFxPairByName(summary.rows[0]?.key ?? "") ?? selectedPair;
        const activePair = summary.rows.some((row) => row.key === selectedPair.name) ? selectedPair : topPair;
        if (activePair.name !== selectedPair.name) setSelectedPair(activePair);

        setStudy({
          selectedTemplate,
          selectedPair: activePair,
          selectedUpcomingEvent: selectedUpcoming,
          pairRanking: summary.rows,
          selectedRow: summary.rows.find((row) => row.key === activePair.name) ?? summary.rows[0] ?? null,
          replaySamples,
          eventEnvironment: deriveEventQualitySummary({
            events,
            pair: activePair,
            horizon: environmentHorizon,
          }),
        });

        setSelectionNote(
          selectedTemplate.sampleCount < 5
            ? "This event is available, but the historical sample is still weak. Use the replay as context only."
            : null,
        );
      } catch (error) {
        if (cancelled) return;
        setStudy(null);
        setLoadError(error instanceof Error ? error.message : "Failed to load historical MT5 candles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStudy();
    return () => {
      cancelled = true;
    };
  }, [
    environmentHorizon,
    events,
    replaySamples,
    selectedPair,
    selectedTemplate,
    selectedUpcoming,
    templateEvents,
  ]);

  useEffect(() => {
    if (!study) return;
    const nextRow = study.pairRanking.find((row) => row.key === selectedPair.name) ?? study.pairRanking[0] ?? null;
    setStudy((current) =>
      current ? { ...current, selectedPair, selectedRow: nextRow, eventEnvironment: deriveEventQualitySummary({ events, pair: selectedPair, horizon: environmentHorizon }) } : current,
    );
  }, [environmentHorizon, events, selectedPair, study?.pairRanking]);

  useEffect(() => {
    if (!selectedReplaySample || !study?.selectedPair) {
      setReplayWindow(null);
      setReplayLoading(false);
      setReplayError(null);
      return;
    }

    let cancelled = false;

    const loadReplay = async () => {
      setReplayLoading(true);
      setReplayError(null);

      try {
        const chartTimeframe = getChartTimeframe(replayTimeframe);
        const chunkKey = getMonthlyChunkKeys([selectedReplaySample.eventTime])[0];
        const cacheKey = `${study.selectedPair.name}|${chartTimeframe}|${chunkKey}`;
        const cached = cacheRef.current.get(cacheKey);
        const request =
          cached ??
          fetchHistoryRange({
            symbol: study.selectedPair.name,
            tf: chartTimeframe,
            from: getMonthlyChunkRange(chunkKey, chartTimeframe).from,
            to: getMonthlyChunkRange(chunkKey, chartTimeframe).to,
          }).catch((error) => {
            cacheRef.current.delete(cacheKey);
            throw error;
          });

        if (!cached) cacheRef.current.set(cacheKey, request);
        const candles = await request;
        if (cancelled) return;

        const window = getReplayWindowCandles({
          candles,
          eventTime: selectedReplaySample.eventTime,
          beforeCount: BEFORE_CANDLES,
          afterCount: AFTER_CANDLES,
        });

        if (!window) {
          setReplayWindow(null);
          setReplayError("No replayable candle window was resolved for this sample and timeframe.");
          return;
        }

        setReplayWindow(window);
        setVisibleCount(window.eventIndex + 1);
        setIsPlaying(false);
      } catch (error) {
        if (cancelled) return;
        setReplayWindow(null);
        setReplayError(error instanceof Error ? error.message : "Failed to load replay candles.");
      } finally {
        if (!cancelled) setReplayLoading(false);
      }
    };

    void loadReplay();
    return () => {
      cancelled = true;
    };
  }, [replayTimeframe, selectedReplaySample, study?.selectedPair]);

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

  const briefRows = useMemo(() => getStudyBrief(study, replayTimeframe), [replayTimeframe, study]);

  return (
    <section className="tab-panel mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="rounded-[28px] border border-slate-200/80 bg-white/75 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <CalendarClock size={20} />
            </div>
            <div>
              <h2 className="m-0 text-[2rem] font-bold leading-tight text-slate-950">Event Tools</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Select an event, replay how price moved on prior releases, and use the timing and sample context below the chart as prep support.
              </p>
            </div>
          </div>

          <div className="grid min-w-[280px] grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Feed Status</span>
              <strong className="mt-1 block text-slate-900">{renderStatusLabel(status)}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Last Ingest</span>
              <strong className="mt-1 block text-slate-900">{formatRelativeAge(lastCalendarIngestAt)}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Loaded Event</span>
              <strong className="mt-1 block text-slate-900">{study?.selectedTemplate?.title ?? selectedUpcoming?.title ?? "Pick one below"}</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-[28px] border border-slate-200/80 bg-white/75 p-6 shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="m-0 text-xl font-bold text-slate-950">Upcoming Events</h3>
            <p className="mt-1 text-sm text-slate-600">Start here. Pick a supported release from the next 7 days, then study its historical reaction and replay.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            <Clock3 size={14} />
            Next 7 Days
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
            No supported macro events are scheduled in the next 7 days.
          </div>
        ) : (
          <div className="grid gap-3">
            {upcomingEvents.map((item) => {
              const exactKey = buildEventTemplateKey(item.currency, item.title);
              const isActive = selectedUpcomingId === item.id || selectedEventKey === exactKey;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedUpcomingId(item.id);
                    setSelectedEventKey(item.templateKey ?? exactKey);
                    setSelectedSampleIndex(0);
                    setSelectionNote(
                      item.templateKey
                        ? null
                        : "This event is on the calendar, but there is no usable historical template yet. The replay panel will stay empty until more bridge history exists.",
                    );
                  }}
                  className={`grid gap-4 rounded-[24px] border px-5 py-4 text-left transition-colors md:grid-cols-[200px_minmax(0,1fr)_220px] ${
                    isActive ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div>
                    <strong className="block text-sm">{formatUtcDateTime(item.time)}</strong>
                    <span className={`mt-1 block text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>{formatCountdown(item.time, nowMs)}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <FlagIcon countryCode={getCurrencyCountryCode(item.currency)} className="mt-0.5 h-5 w-8 shrink-0" />
                    <div>
                      <strong className="block text-sm">{item.currency} | {item.title}</strong>
                      <span className={`mt-1 block text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>{item.familyLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-start gap-2 md:justify-end">
                    {item.templateKey ? (
                      <>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${isActive ? "border-slate-700 bg-slate-800 text-slate-100" : qualityTone(item.quality ?? "weak")}`}>
                          {getSampleQualityLabel(item.quality ?? "weak")}
                        </span>
                        <span className={`text-xs font-semibold ${isActive ? "text-slate-300" : "text-slate-500"}`}>{formatCount(item.sampleCount)}</span>
                      </>
                    ) : (
                      <span className={`text-xs font-semibold ${isActive ? "text-slate-300" : "text-slate-500"}`}>No usable history yet</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/75 p-6 shadow-sm backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="m-0 text-xl font-bold text-slate-950">Replay Chart</h3>
              <p className="mt-1 text-sm text-slate-600">
                {study?.selectedTemplate
                  ? `Replaying ${study.selectedPair?.name ?? selectedPair.name} around past ${study.selectedTemplate.currency} ${study.selectedTemplate.title} releases.`
                  : "Pick an upcoming event or manual event below to load the replay."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {REPLAY_TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReplayTimeframe(option.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
                    replayTimeframe === option.id ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {selectionNote ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{selectionNote}</div> : null}
          {loadError ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div> : null}
          {replayError ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{replayError}</div> : null}

          {!study?.selectedTemplate ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              Choose one event first. The chart replay stays empty until an exact event template is selected.
            </div>
          ) : replayLoading || loading ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              Loading historical MT5 candles for the replay...
            </div>
          ) : !replayWindow || !study.selectedPair || !selectedReplaySample ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              No replayable historical sample was resolved for this event, pair, and timeframe.
            </div>
          ) : (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Pair</span>
                  <strong className="mt-1 block text-slate-900">{study.selectedPair.name}</strong>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Historical Release</span>
                  <strong className="mt-1 block text-slate-900">{formatUtcDateTime(selectedReplaySample.eventTime)}</strong>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Upcoming Release</span>
                  <strong className="mt-1 block text-slate-900">{selectedUpcoming ? formatUtcDateTime(selectedUpcoming.time) : "Manual study"}</strong>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Countdown</span>
                  <strong className="mt-1 block text-slate-900">{selectedUpcoming ? formatCountdown(selectedUpcoming.time, nowMs) : "Historical mode"}</strong>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Actual / Forecast / Previous</span>
                  <strong className="mt-1 block text-slate-900">{selectedReplaySample.actual} / {selectedReplaySample.forecast} / {selectedReplaySample.previous || "N/A"}</strong>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={selectedSampleIndex === 0} onClick={() => setSelectedSampleIndex((index) => Math.max(0, index - 1))}>
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Sample {selectedSampleIndex + 1} of {replaySamples.length}</div>
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={selectedSampleIndex >= replaySamples.length - 1} onClick={() => setSelectedSampleIndex((index) => Math.min(replaySamples.length - 1, index + 1))}>
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button type="button" className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => {
                  if (!replayWindow) return;
                  if (visibleCount >= replayWindow.candles.length) setVisibleCount(replayWindow.eventIndex + 1);
                  setIsPlaying((value) => !value);
                }}>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  {isPlaying ? "Pause" : "Play"}
                </button>
              </div>

              <ReplayCandlestickChart candles={replayWindow.candles} eventIndex={replayWindow.eventIndex} visibleCount={visibleCount} pair={study.selectedPair} timeframe={replayTimeframe} />
            </>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-[28px] border border-slate-200/80 bg-white/75 p-6 shadow-sm backdrop-blur-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-xl font-bold text-slate-950">Actionable Study Brief</h3>
                <p className="mt-1 text-sm text-slate-600">Short prep answers below the chart. Useful, but not a trade signal.</p>
              </div>
              {study?.eventEnvironment ? <span className={`rounded-full border px-3 py-1 text-xs font-bold ${eventEnvironmentTone(study.eventEnvironment.label)}`}>{study.eventEnvironment.label}</span> : null}
            </div>
            {study?.eventEnvironment ? (
              <div className="mb-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldAlert size={16} />Event Environment</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Pair</span>
                    <strong className="mt-1 block text-slate-900">{study.selectedPair?.name ?? selectedPair.name}</strong>
                  </div>
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Horizon</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["24h", "72h", "this_week"] as EventQualityHorizon[]).map((option) => (
                        <button key={option} type="button" onClick={() => setEnvironmentHorizon(option)} className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${environmentHorizon === option ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                          {option === "this_week" ? "This Week" : option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Weighted Score</span>
                    <strong className="mt-1 block text-slate-900">{study.eventEnvironment.totalScore.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Thresholds</span>
                    <strong className="mt-1 block text-slate-900">{`Mixed ${thresholds.mixed} | Dirty ${thresholds.dirty}`}</strong>
                  </div>
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Matched Events</span>
                    <strong className="mt-1 block text-slate-900">{study.eventEnvironment.rows.length}</strong>
                  </div>
                </div>
                {study.eventEnvironment.immediateTrigger ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Dirty override is active because a high-impact policy, inflation, or labor event is due inside the next 24 hours.</div> : null}
              </div>
            ) : null}

            <div className="grid gap-3">
              {briefRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  The study brief will populate after a usable event and pair context is loaded.
                </div>
              ) : (
                briefRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{row.label}</span>
                    <strong className="mt-1 block text-sm text-slate-900">{row.value}</strong>
                    {row.hint ? <span className="mt-1 block text-xs text-slate-500">{row.hint}</span> : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white/75 p-6 shadow-sm backdrop-blur-xl">
            <div className="mb-4">
              <h3 className="m-0 text-xl font-bold text-slate-950">Pair Switcher</h3>
              <p className="mt-1 text-sm text-slate-600">Pick which pair expresses the selected event best, then keep replaying from that pair.</p>
            </div>
            {study?.pairRanking.length ? (
              <div className="grid gap-2">
                {study.pairRanking.map((row) => {
                  const pair = getFxPairByName(row.key);
                  if (!pair) return null;
                  const isActive = study.selectedPair?.name === pair.name;
                  return (
                    <button key={row.key} type="button" onClick={() => setSelectedPair(pair)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${isActive ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <FlagIcon countryCode={getCurrencyCountryCode(pair.base)} className="h-4 w-6" />
                          <FlagIcon countryCode={getCurrencyCountryCode(pair.quote)} className="h-4 w-6" />
                        </div>
                        <div>
                          <strong className="block text-sm">{pair.name}</strong>
                          <span className={`block text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>{getSampleQualityLabel(row.quality)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <strong className="block text-sm">{formatPips(row.summaryWindows["1h"].medianAbsolutePips)}</strong>
                        <span className={`block text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>1h typical</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Pair ranking appears after a supported event with historical samples is selected.
              </div>
            )}
          </section>
        </aside>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white/75 p-6 shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"><BarChart3 size={18} /></div>
          <div>
            <h3 className="m-0 text-xl font-bold text-slate-950">Analyst Dashboard</h3>
            <p className="mt-1 text-sm text-slate-600">The rawer layer below the brief: ranking, sample counts, windows, and beat / inline / miss behavior.</p>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <h4 className="m-0 text-sm font-black uppercase tracking-[0.18em] text-slate-500">Window Stats</h4>
            {study?.selectedRow ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(["15m", "1h", "4h", "1d"] as ReactionWindow[]).map((window) => {
                  const stats = study.selectedRow!.summaryWindows[window];
                  return (
                    <div key={window} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <strong className="block text-sm text-slate-900">{window}</strong>
                      <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Median absolute</span>
                      <strong className="mt-1 block text-slate-900">{formatPips(stats.medianAbsolutePips)}</strong>
                      <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Median directional</span>
                      <strong className="mt-1 block text-slate-900">{formatPips(stats.medianPips)}</strong>
                      <span className="mt-2 block text-xs text-slate-500">{formatCount(stats.sampleSize)} | {formatPercent(stats.standardDeviation)}</span>
                    </div>
                  );
                })}
              </div>
            ) : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">Window stats appear after the event study resolves.</div>}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <h4 className="m-0 text-sm font-black uppercase tracking-[0.18em] text-slate-500">Beat / Inline / Miss Buckets</h4>
            {study?.selectedRow?.bucketStats.length ? (
              <div className="mt-4 grid gap-3">
                {study.selectedRow.bucketStats.map((bucket) => {
                  const stats = bucket.windows[getMetricWindow(replayTimeframe)];
                  return (
                    <div key={bucket.bucket} className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_120px]">
                      <div>
                        <strong className="block text-sm text-slate-900">{bucket.label}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{formatCount(stats.sampleSize)}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Median</span>
                        <strong className="mt-1 block text-slate-900">{formatPips(stats.medianPips)}</strong>
                      </div>
                      <div>
                        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Absolute</span>
                        <strong className="mt-1 block text-slate-900">{formatPips(stats.medianAbsolutePips)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">Bucket stats appear after the selected pair resolves a usable study row.</div>}
          </section>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white/75 p-6 shadow-sm backdrop-blur-xl">
        <div className="mb-4">
          <h3 className="m-0 text-xl font-bold text-slate-950">Manual Event Selector</h3>
          <p className="mt-1 text-sm text-slate-600">Fallback controls for jumping to a specific exact event title when you do not want to start from the upcoming list.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_220px_minmax(0,1fr)_180px]">
          <label className="grid gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Currency</span>
            <select value={eventCurrency} onChange={(event) => setEventCurrency(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none">
              {availableCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Family</span>
            <select value={eventFamily} onChange={(event) => setEventFamily(event.target.value as EventQualityFamily | "all")} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none">
              {familyOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Exact Event</span>
            <select value={selectedTemplate?.key ?? ""} onChange={(event) => {
              setSelectedUpcomingId(null);
              setSelectedEventKey(event.target.value);
              setSelectedSampleIndex(0);
              setSelectionNote(null);
            }} disabled={manualTemplates.length === 0} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50">
              {manualTemplates.length === 0 ? <option value="">No matching historical event</option> : manualTemplates.map((template) => <option key={template.key} value={template.key}>{template.currency} | {template.title} ({template.sampleCount})</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={showWeak} onChange={(event) => setShowWeak(event.target.checked)} />
            Include weak templates
          </label>
        </div>
        {selectedWindowStats ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Current replay context: {formatPips(selectedWindowStats.medianAbsolutePips)} typical absolute move and {formatPips(selectedWindowStats.medianPips)} median directional move on {replayTimeframe}.</div> : null}
      </section>
    </section>
  );
}
