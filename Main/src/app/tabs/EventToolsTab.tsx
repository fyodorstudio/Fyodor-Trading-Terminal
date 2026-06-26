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
} from "lucide-react";
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
  formatReplayAxisTime,
  formatReplayCount,
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
  getSampleQualityLabel,
} from "@/app/lib/eventReaction";
import { formatRelativeAge, formatUtcDateTime } from "@/app/lib/format";
import type {
  BridgeCandle,
  BridgeStatus,
  CalendarEvent,
  CalendarEventExplainer,
  EventTemplate,
  FxPairDefinition,
  ReactionReplaySample,
  ReplayChartTimeframe,
  SampleQuality,
} from "@/app/types";

interface EventToolsTabProps {
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

function qualityTone(quality: SampleQuality): string {
  if (quality === "usable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (quality === "limited") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function EventExplainerMiniBrief(props: { explainer: CalendarEventExplainer | null }) {
  if (!props.explainer) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">What This Event Is</span>
        <p className="mt-1 text-sm leading-6 text-slate-700">{props.explainer.whatItIs}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Why Traders Care</span>
        <p className="mt-1 text-sm leading-6 text-slate-700">{props.explainer.whyTradersCare}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">What To Compare</span>
        <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-slate-700">
          {(props.explainer.whatToCompare ?? []).slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
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
      upColor: "#10b981",
      downColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
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
    <div className="rounded-[20px] border border-slate-200 bg-white p-2 shadow-sm">
      <div ref={containerRef} className="h-[360px] w-full rounded-[14px]" />
    </div>
  );
}

function TemplateButton(props: {
  template: EventTemplate;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={`grid w-full gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
        props.active
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <FlagIcon countryCode={getCurrencyCountryCode(props.template.currency)} className="mt-0.5 h-5 w-8 shrink-0" />
          <div className="min-w-0">
            <strong className="block truncate text-sm">{props.template.currency} | {props.template.title}</strong>
            <span className={`mt-1 block text-xs ${props.active ? "text-slate-300" : "text-slate-500"}`}>
              {props.template.familyLabel}
            </span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            props.active ? "border-slate-700 bg-slate-800 text-slate-100" : qualityTone(props.template.quality)
          }`}
        >
          {getSampleQualityLabel(props.template.quality)}
        </span>
      </div>
      <span className={`text-xs font-semibold ${props.active ? "text-slate-300" : "text-slate-500"}`}>
        {formatReplayCount(props.template.sampleCount)}
      </span>
    </button>
  );
}

function SampleButton(props: {
  sample: ReactionReplaySample;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
        props.active
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <strong className="block text-sm">{formatUtcDateTime(props.sample.eventTime)}</strong>
        <span className={`text-xs font-semibold ${props.active ? "text-slate-300" : "text-slate-500"}`}>
          {props.sample.comparisonBasis === "forecast" ? "Forecast" : "Previous"}
        </span>
      </div>
      <div className={`mt-2 text-xs ${props.active ? "text-slate-300" : "text-slate-500"}`}>
        Actual {props.sample.actual || "N/A"} vs {props.sample.comparisonBasis === "forecast" ? props.sample.forecast : props.sample.previous || "N/A"}
      </div>
    </button>
  );
}

export function EventToolsTab({ events, status, lastCalendarIngestAt }: EventToolsTabProps) {
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

  const feedAgeLabel = lastCalendarIngestAt == null ? "Broker feed unknown" : `Broker feed ${formatRelativeAge(lastCalendarIngestAt)}`;
  const samplePosition = replaySamples.length > 0 ? `${selectedSampleIndex + 1} of ${replaySamples.length}` : "0 of 0";

  return (
    <section className="tab-panel mx-auto flex max-w-[1460px] flex-col gap-4 pb-10">
      <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <CalendarClock size={20} />
            </div>
            <div>
              <h2 className="m-0 text-2xl font-bold text-slate-950">Event Replay</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Pair-first replay for studying how price behaved around prior scheduled releases.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Clock3 size={14} />
              {renderStatusLabel(status)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              {feedAgeLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-end">
          <label className="grid gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Pair</span>
            <select
              value={selectedPair.name}
              onChange={(event) => {
                setSelectedPairName(event.target.value);
                setSelectedEventKey("");
                setSelectedSampleIndex(0);
                setIsPlaying(false);
              }}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-950 outline-none"
              aria-label="Replay pair"
            >
              {FX_PAIRS.map((pair) => (
                <option key={pair.name} value={pair.name}>
                  {pair.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:grid-cols-3">
            <div>
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Base</span>
              <strong className="mt-1 flex items-center gap-2 text-slate-950">
                <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.base)} className="h-4 w-6" />
                {selectedPair.base}
              </strong>
            </div>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Quote</span>
              <strong className="mt-1 flex items-center gap-2 text-slate-950">
                <FlagIcon countryCode={getCurrencyCountryCode(selectedPair.quote)} className="h-4 w-6" />
                {selectedPair.quote}
              </strong>
            </div>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Replay Source</span>
              <strong className="mt-1 block text-slate-950">MT5 candles + broker calendar</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="grid min-w-0 content-start gap-4">
          <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h3 className="m-0 text-lg font-bold text-slate-950">Base/Quote Events</h3>
              <p className="mt-1 text-sm text-slate-600">{selectedPair.base} and {selectedPair.quote} releases appear first.</p>
            </div>
            <div className="grid max-h-[330px] gap-3 overflow-auto pr-1">
              {groups.pairTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No replayable base/quote event types are available in the current calendar window.
                </div>
              ) : (
                groups.pairTemplates.map((template) => (
                  <TemplateButton
                    key={template.key}
                    template={template}
                    active={selectedTemplate?.key === template.key}
                    onSelect={() => handleTemplateSelect(template.key)}
                  />
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h3 className="m-0 text-lg font-bold text-slate-950">Major Global Movers</h3>
              <p className="mt-1 text-sm text-slate-600">High-impact USD/EUR macro that can move broad FX risk.</p>
            </div>
            <div className="grid max-h-[230px] gap-3 overflow-auto pr-1">
              {groups.globalTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No separate global mover templates are available for this pair right now.
                </div>
              ) : (
                groups.globalTemplates.map((template) => (
                  <TemplateButton
                    key={template.key}
                    template={template}
                    active={selectedTemplate?.key === template.key}
                    onSelect={() => handleTemplateSelect(template.key)}
                  />
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="m-0 text-lg font-bold text-slate-950">Replay Chart</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedTemplate
                    ? `${selectedPair.name} around prior ${selectedTemplate.currency} ${selectedTemplate.title} releases.`
                    : "Select an event type to load prior releases."}
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
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 grid gap-3 md:grid-cols-4">
              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Before</span>
                <input
                  type="number"
                  min={MIN_REPLAY_CANDLES}
                  max={MAX_REPLAY_CANDLES}
                  value={beforeCount}
                  onChange={(event) => handleBeforeChange(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-950 outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">After</span>
                <input
                  type="number"
                  min={MIN_REPLAY_CANDLES}
                  max={MAX_REPLAY_CANDLES}
                  value={afterCount}
                  onChange={(event) => handleAfterChange(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-950 outline-none"
                />
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Sample</span>
                <strong className="mt-1 block text-sm text-slate-950">{samplePosition}</strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Comparison</span>
                <strong className="mt-1 block text-sm text-slate-950">{selectedSample?.comparisonLabel ?? "N/A"}</strong>
              </div>
            </div>

            {replayError ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{replayError}</div>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Selected Release</span>
                <strong className="mt-1 block truncate text-sm text-slate-950">
                  {selectedSample ? formatUtcDateTime(selectedSample.eventTime) : "No release selected"}
                </strong>
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-900 bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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

            {!selectedTemplate ? (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
                Select an event type to start replay study.
              </div>
            ) : replayLoading ? (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
                Loading historical MT5 candles for this release...
              </div>
            ) : !replayWindow || !selectedSample ? (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
                No replayable candle window is available for this event, pair, and timeframe.
              </div>
            ) : (
              <>
                <ReplayCandlestickChart
                  candles={replayWindow.candles}
                  eventIndex={replayWindow.eventIndex}
                  visibleCount={visibleCount}
                  pair={selectedPair}
                  timeframe={replayTimeframe}
                />
              </>
            )}
          </section>

          <aside className="grid min-w-0 content-start gap-4">
            <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="m-0 text-lg font-bold text-slate-950">Past Releases</h3>
                  <p className="mt-1 text-sm text-slate-600">Newest samples first.</p>
                </div>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {samplePosition}
                </span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={selectedSampleIndex === 0 || replaySamples.length === 0}
                  onClick={() => setSelectedSampleIndex((index) => Math.max(0, index - 1))}
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={replaySamples.length === 0 || selectedSampleIndex >= replaySamples.length - 1}
                  onClick={() => setSelectedSampleIndex((index) => Math.min(replaySamples.length - 1, index + 1))}
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="grid max-h-[300px] gap-3 overflow-auto pr-1">
                {replaySamples.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No historical releases with usable actual/comparison values.
                  </div>
                ) : (
                  replaySamples.map((sample, index) => (
                    <SampleButton
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
            </section>

            <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <BarChart3 size={17} />
                </div>
                <div>
                  <h3 className="m-0 text-lg font-bold text-slate-950">Replay Brief</h3>
                  <p className="mt-1 text-sm text-slate-600">Descriptive context for the selected historical release.</p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Event Type</span>
                  <strong className="mt-1 block text-sm text-slate-950">{selectedTemplate ? `${selectedTemplate.currency} ${selectedTemplate.title}` : "N/A"}</strong>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Historical Release</span>
                  <strong className="mt-1 block text-sm text-slate-950">{selectedSample ? formatUtcDateTime(selectedSample.eventTime) : "N/A"}</strong>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Actual / Forecast / Previous</span>
                  <strong className="mt-1 block text-sm text-slate-950">
                    {selectedSample ? `${selectedSample.actual || "N/A"} / ${selectedSample.forecast || "N/A"} / ${selectedSample.previous || "N/A"}` : "N/A"}
                  </strong>
                  {selectedSample ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      Compared by {selectedSample.comparisonLabel.toLowerCase()}; surprise {selectedSample.surprise >= 0 ? "+" : ""}{selectedSample.surprise.toFixed(4)}.
                    </span>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Observed Move</span>
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

          </aside>
        </section>
      </section>

      <section className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <strong className="block text-sm text-slate-950">Read the marker first</strong>
          <span className="mt-1 block text-sm text-slate-600">The release marker is the anchor; the candles before it show positioning, and the candles after it show acceptance or rejection.</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <strong className="block text-sm text-slate-950">Check the comparison basis</strong>
          <span className="mt-1 block text-sm text-slate-600">Forecast is preferred. Previous is used only when the broker feed has no numeric forecast.</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <strong className="block text-sm text-slate-950">Study behavior, not certainty</strong>
          <span className="mt-1 block text-sm text-slate-600">Use replay to understand reaction shape, volatility, and follow-through before judging a live setup.</span>
        </div>
      </section>
    </section>
  );
}
