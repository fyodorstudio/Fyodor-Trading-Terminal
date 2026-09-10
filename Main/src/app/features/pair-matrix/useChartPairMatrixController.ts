import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ChartPairMatrixTimeLensData, PairMatrixLoadState } from "@/app/components/ChartPairMatrixTimeLens";
import type {
  ChartPairMatrixContextMarkerData,
  ChartPairMatrixRangeOverlayData,
  PairMatrixRangePreview,
} from "@/app/features/pair-matrix/chartPairMatrixContracts";
import { CURRENCY_TO_COUNTRY_CODE } from "@/app/config/fxPairs";
import { fetchCalendar } from "@/app/lib/bridge";
import { formatChartFeedTime, type ChartDisplayTimeMode } from "@/app/lib/chartView";
import { indexPairMatrixContextMarkers, selectPairMatrixContextMarkerGroups } from "@/app/lib/pairMatrixContextMarkers";
import type { PairMatrixChartGeometryRuntime } from "@/app/lib/pairMatrixChartGeometry";
import { createPairMatrixHoverRuntime } from "@/app/lib/pairMatrixHoverRuntime";
import { buildPairMatrixMomentumSnapshot, type PairMatrixMomentumSnapshot } from "@/app/lib/pairMatrixMomentum";
import {
  buildPairMatrixTimelineFromIndex,
  calendarEventsCoverWindow,
  getPairMatrixCandleClose,
  getPairMatrixForexCurrencies,
  getPairMatrixRangePipMoveLabel,
  getPairMatrixRangePixelBounds,
  getPairMatrixTimelineWindow,
  indexPairMatrixCalendar,
  loadPairMatrixBeforeDays,
  mergePairMatrixCalendarEvents,
  normalizePairMatrixCandleRange,
  remapPairMatrixTimeInterval,
  savePairMatrixBeforeDays,
  type PairMatrixCalendarIndex,
  type PairMatrixCandleRange,
  type PairMatrixTimelineSnapshot,
  type PairMatrixTimeInterval,
} from "@/app/lib/pairMatrixSnapshot";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";
import type { IChartApi, Time } from "lightweight-charts";

const PAIR_MATRIX_HISTORY_DEBOUNCE_MS = 180;
const PAIR_MATRIX_HOVER_SETTLE_MS = 120;
const PAIR_MATRIX_HISTORY_CACHE_LIMIT = 8;

interface PairMatrixCalendarCacheEntry {
  currencyKey: string;
  from: number;
  to: number;
  events: CalendarEvent[];
}

interface PairMatrixDerivedSnapshot {
  timeline: PairMatrixTimelineSnapshot;
  momentum: PairMatrixMomentumSnapshot;
}

interface UseChartPairMatrixControllerOptions {
  selectedSymbol: string;
  timeframe: Timeframe;
  events: CalendarEvent[];
  visibleCandles: BridgeCandle[];
  lastCandleTime: number | null;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  marketCheckedAt: number | null;
  contextMarkersPerSide: number;
  chartRef: RefObject<IChartApi | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function resolvePairMatrixHoveredCandleUpdate(
  current: number | null,
  next: number | null,
  enabled: boolean,
): { shouldUpdate: boolean; value: number | null } {
  return { shouldUpdate: enabled && current !== next, value: next };
}

export function getChartRangeUpdateCadence(pairMatrixOpen: boolean): "animation_frame" | "settled" {
  return pairMatrixOpen ? "settled" : "animation_frame";
}

export function getPairMatrixHoverSettleDelay(
  lastMotionMs: number,
  nowMs: number,
  settleMs = PAIR_MATRIX_HOVER_SETTLE_MS,
): number {
  return Math.max(0, settleMs - Math.max(0, nowMs - lastMotionMs));
}

export function getPairMatrixAnalyzeCandleRange(
  candleTimes: number[],
  candleOpen: number,
  timeframe: Timeframe,
): PairMatrixCandleRange | null {
  if (!candleTimes.includes(candleOpen)) return null;
  return normalizePairMatrixCandleRange(candleTimes, candleOpen, candleOpen, timeframe);
}

export function useChartPairMatrixController({
  selectedSymbol,
  timeframe,
  events,
  visibleCandles,
  lastCandleTime,
  displayTimeMode,
  sourceTimeOffsetSeconds,
  marketCheckedAt,
  contextMarkersPerSide,
  chartRef,
  containerRef,
  onSelectEvent,
}: UseChartPairMatrixControllerOptions) {
  const [open, setOpen] = useState(false);
  const [beforeDays, setBeforeDays] = useState(loadPairMatrixBeforeDays);
  const [coverageAnchor, setCoverageAnchor] = useState<number | null>(null);
  const [rangeArmed, setRangeArmed] = useState(false);
  const [rangeEditing, setRangeEditing] = useState(false);
  const [rangeCancelRevision, setRangeCancelRevision] = useState(0);
  const [lockedRange, setLockedRange] = useState<PairMatrixCandleRange | null>(null);
  const [lockedInterval, setLockedInterval] = useState<PairMatrixTimeInterval | null>(null);
  const [calendarResult, setCalendarResult] = useState<{
    key: string | null;
    state: PairMatrixLoadState;
    events: CalendarEvent[];
  }>({ key: null, state: "idle", events: [] });
  const [markerCalendarEvents, setMarkerCalendarEvents] = useState<CalendarEvent[]>([]);
  const [markerCalendarState, setMarkerCalendarState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [chartRangeRevision, setChartRangeRevision] = useState(0);
  const [chartLayoutRevision, setChartLayoutRevision] = useState(0);
  const [chartInteracting, setChartInteracting] = useState(false);

  const hoveredCandleChartTimeRef = useRef<number | null>(null);
  const hoverRuntimeRef = useRef(createPairMatrixHoverRuntime());
  const pendingHoverRef = useRef<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const hoverLastMotionRef = useRef(0);
  const hoverEnabledRef = useRef(false);
  const openRef = useRef(false);
  const coverageWindowKeyRef = useRef("");
  const calendarCacheRef = useRef(new Map<string, PairMatrixCalendarCacheEntry>());
  const calendarPendingRef = useRef(new Map<string, Promise<CalendarEvent[]>>());
  const calendarRequestRef = useRef(0);
  const markerCalendarRequestRef = useRef(0);
  const geometryListenersRef = useRef(new Set<() => void>());
  const geometryFrameRef = useRef<number | null>(null);
  const derivedCacheRef = useRef<{
    index: PairMatrixCalendarIndex | null;
    values: Map<string, PairMatrixDerivedSnapshot>;
  }>({ index: null, values: new Map() });

  hoverEnabledRef.current = open && lockedRange == null;
  openRef.current = open;

  const geometryRuntime = useMemo<PairMatrixChartGeometryRuntime>(() => ({
    subscribe: (listener) => {
      geometryListenersRef.current.add(listener);
      return () => geometryListenersRef.current.delete(listener);
    },
    resolveRange: (range) => {
      const chart = chartRef.current;
      const container = containerRef.current;
      if (!chart || !container) return null;
      return getPairMatrixRangePixelBounds(
        chart.timeScale().timeToCoordinate(range.firstOpen as Time),
        chart.timeScale().timeToCoordinate(range.lastOpen as Time),
        chart.timeScale().options().barSpacing,
        container.clientWidth,
      );
    },
    resolveMarker: (candleOpens) => {
      const chart = chartRef.current;
      const width = containerRef.current?.clientWidth ?? 0;
      if (!chart || width <= 0 || candleOpens.length === 0) return null;
      const coordinates = candleOpens.flatMap((candleOpen) => {
        const coordinate = chart.timeScale().timeToCoordinate(candleOpen as Time);
        return coordinate == null || !Number.isFinite(Number(coordinate)) ? [] : [Number(coordinate)];
      });
      if (coordinates.length === 0) return null;
      const x = coordinates.reduce((sum, coordinate) => sum + coordinate, 0) / coordinates.length;
      return {
        x,
        visible: x >= -18 && x <= width + 18,
        placement: x < 220 ? "right" : x > width - 220 ? "left" : "center",
      };
    },
  }), [chartRef, containerRef]);

  const scheduleGeometryUpdate = useCallback(() => {
    if (!openRef.current || geometryFrameRef.current != null) return;
    geometryFrameRef.current = window.requestAnimationFrame(() => {
      geometryFrameRef.current = null;
      geometryListenersRef.current.forEach((listener) => listener());
    });
  }, []);

  const notifyChartLayoutChange = useCallback(() => {
    setChartLayoutRevision((current) => current + 1);
  }, []);

  const notifyChartRangeChange = useCallback(() => {
    setChartRangeRevision((current) => current + 1);
  }, []);

  useEffect(() => () => {
    if (geometryFrameRef.current != null) window.cancelAnimationFrame(geometryFrameRef.current);
    geometryListenersRef.current.clear();
  }, []);

  const cancelPendingHover = useCallback(() => {
    if (hoverTimeoutRef.current != null) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = null;
    pendingHoverRef.current = null;
  }, []);

  const resetHover = useCallback(() => {
    cancelPendingHover();
    hoveredCandleChartTimeRef.current = null;
    hoverRuntimeRef.current.publishAnchor(null);
  }, [cancelPendingHover]);

  const scheduleHover = useCallback((next: number | null) => {
    const hoverUpdate = resolvePairMatrixHoveredCandleUpdate(
      hoveredCandleChartTimeRef.current,
      next,
      hoverEnabledRef.current,
    );
    if (!hoverUpdate.shouldUpdate && hoverTimeoutRef.current == null) return;
    pendingHoverRef.current = next;
    hoverLastMotionRef.current = performance.now();
    if (hoverTimeoutRef.current != null) return;

    const commitWhenSettled = () => {
      const remaining = getPairMatrixHoverSettleDelay(hoverLastMotionRef.current, performance.now());
      if (remaining > 0) {
        hoverTimeoutRef.current = window.setTimeout(commitWhenSettled, remaining);
        return;
      }
      hoverTimeoutRef.current = null;
      const settled = pendingHoverRef.current;
      pendingHoverRef.current = null;
      if (!hoverEnabledRef.current || hoveredCandleChartTimeRef.current === settled) return;
      hoveredCandleChartTimeRef.current = settled;
      hoverRuntimeRef.current.publishAnchor(settled);
    };
    hoverTimeoutRef.current = window.setTimeout(commitWhenSettled, PAIR_MATRIX_HOVER_SETTLE_MS);
  }, []);

  useEffect(() => cancelPendingHover, [cancelPendingHover]);

  useEffect(() => {
    if (open) return;
    resetHover();
    coverageWindowKeyRef.current = "";
    setCoverageAnchor(null);
  }, [open, resetHover]);

  useEffect(() => {
    if (lockedRange) resetHover();
  }, [lockedRange, resetHover]);

  useEffect(() => {
    resetHover();
    coverageWindowKeyRef.current = "";
    setCoverageAnchor(null);
    setLockedRange(null);
    setLockedInterval(null);
    setRangeArmed(false);
    setRangeEditing(false);
    setRangeCancelRevision((current) => current + 1);
  }, [resetHover, selectedSymbol]);

  useEffect(() => {
    resetHover();
    coverageWindowKeyRef.current = "";
    setCoverageAnchor(null);
    setRangeArmed(false);
    setRangeEditing(false);
    setRangeCancelRevision((current) => current + 1);
  }, [resetHover, timeframe]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!rangeArmed && !lockedRange)) return;
      setLockedRange(null);
      setLockedInterval(null);
      setRangeArmed(false);
      setRangeEditing(false);
      setRangeCancelRevision((current) => current + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rangeArmed, lockedRange]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const selecting = rangeArmed || rangeEditing;
    chart.applyOptions({ handleScroll: !selecting, handleScale: !selecting });
  }, [chartRef, rangeArmed, rangeEditing]);

  const currencies = useMemo(() => getPairMatrixForexCurrencies(selectedSymbol), [selectedSymbol]);
  const candleTimes = useMemo(
    () => open ? visibleCandles.map((candle) => candle.time) : [],
    [open, visibleCandles],
  );
  const candleIndexByTime = useMemo(
    () => new Map(candleTimes.map((time, index) => [time, index])),
    [candleTimes],
  );

  useEffect(() => {
    if (!lockedInterval || candleTimes.length === 0) return;
    const remapped = remapPairMatrixTimeInterval(candleTimes, lockedInterval, timeframe);
    if (!remapped) return;
    setLockedRange((current) => (
      current
      && current.firstOpen === remapped.firstOpen
      && current.lastOpen === remapped.lastOpen
      && current.close === remapped.close
      && current.candleCount === remapped.candleCount
        ? current
        : remapped
    ));
  }, [candleTimes, lockedInterval, timeframe]);

  const fallbackOpen = open ? lastCandleTime : null;
  const fallbackRange = useMemo(
    () => fallbackOpen == null
      ? null
      : normalizePairMatrixCandleRange(candleTimes, fallbackOpen, fallbackOpen, timeframe),
    [candleTimes, fallbackOpen, timeframe],
  );
  const range = open ? lockedRange ?? fallbackRange : null;
  const coverageRange = useMemo(() => {
    if (!open) return null;
    if (lockedRange) return lockedRange;
    const anchor = coverageAnchor ?? fallbackOpen;
    return anchor == null ? null : normalizePairMatrixCandleRange(candleTimes, anchor, anchor, timeframe);
  }, [open, lockedRange, coverageAnchor, fallbackOpen, candleTimes, timeframe]);
  const rangeOpenCalendarTime = range == null ? null : range.firstOpen - sourceTimeOffsetSeconds;
  const rangeCloseCalendarTime = range == null ? null : range.close - sourceTimeOffsetSeconds;
  const duringThrough = rangeOpenCalendarTime == null || rangeCloseCalendarTime == null
    ? null
    : Math.min(
        rangeCloseCalendarTime - 1,
        Math.max(rangeOpenCalendarTime, marketCheckedAt ?? Math.floor(Date.now() / 1000)),
      );
  const coverageOpenCalendarTime = coverageRange == null
    ? null
    : coverageRange.firstOpen - sourceTimeOffsetSeconds;
  const coverageCloseCalendarTime = coverageRange == null
    ? null
    : coverageRange.close - sourceTimeOffsetSeconds;
  const timelineWindow = useMemo(
    () => coverageOpenCalendarTime == null || coverageCloseCalendarTime == null
      ? null
      : getPairMatrixTimelineWindow(coverageOpenCalendarTime, coverageCloseCalendarTime, beforeDays),
    [coverageOpenCalendarTime, coverageCloseCalendarTime, beforeDays],
  );
  const markerWindow = useMemo(() => {
    if (!open || candleTimes.length === 0) return null;
    const chart = chartRef.current;
    const visibleRange = chart?.timeScale().getVisibleRange();
    const firstCandle = candleTimes[0];
    const lastCandle = candleTimes[candleTimes.length - 1];
    const visibleFrom = typeof visibleRange?.from === "number" ? visibleRange.from : range?.firstOpen ?? firstCandle;
    const visibleTo = typeof visibleRange?.to === "number"
      ? visibleRange.to
      : range?.close ?? getPairMatrixCandleClose(lastCandle, timeframe);
    const fromChart = Math.max(firstCandle, visibleFrom);
    const toChart = Math.min(getPairMatrixCandleClose(lastCandle, timeframe), visibleTo);
    if (toChart < fromChart) return null;
    const day = 24 * 60 * 60;
    return {
      from: Math.floor((fromChart - sourceTimeOffsetSeconds) / day) * day,
      to: Math.ceil((toChart - sourceTimeOffsetSeconds) / day) * day,
    };
  }, [open, candleTimes, range, timeframe, sourceTimeOffsetSeconds, chartRangeRevision, chartLayoutRevision, chartRef]);
  const currencyKey = currencies?.join("|") ?? "unsupported";
  const calendarKey = timelineWindow ? `${currencyKey}:${timelineWindow.from}:${timelineWindow.to}` : null;
  const markerCalendarKey = markerWindow
    ? `markers:${currencyKey}:${markerWindow.from}:${markerWindow.to}`
    : null;

  useEffect(() => {
    if (!open || lockedRange || !currencies || candleTimes.length === 0) return;
    const considerAnchor = (publishedAnchor: number | null) => {
      const anchor = publishedAnchor ?? fallbackOpen;
      if (anchor == null) return;
      const anchorRange = normalizePairMatrixCandleRange(candleTimes, anchor, anchor, timeframe);
      if (!anchorRange) return;
      const anchorWindow = getPairMatrixTimelineWindow(
        anchorRange.firstOpen - sourceTimeOffsetSeconds,
        anchorRange.close - sourceTimeOffsetSeconds,
        beforeDays,
      );
      const key = `${currencyKey}:${anchorWindow.from}:${anchorWindow.to}`;
      if (key === coverageWindowKeyRef.current) return;
      coverageWindowKeyRef.current = key;
      setCoverageAnchor(anchor);
    };
    coverageWindowKeyRef.current = calendarKey ?? "";
    considerAnchor(hoverRuntimeRef.current.getAnchor());
    return hoverRuntimeRef.current.subscribe(considerAnchor);
  }, [open, lockedRange, currencies, candleTimes, fallbackOpen, timeframe, sourceTimeOffsetSeconds, beforeDays, currencyKey, calendarKey]);

  useEffect(() => {
    const requestId = ++calendarRequestRef.current;
    if (!open || !currencies || !timelineWindow || !calendarKey) {
      setCalendarResult({ key: calendarKey, state: "idle", events: [] });
      return;
    }

    const relevantCurrentEvents = events.filter((event) => currencies.includes(event.currency));
    if (calendarEventsCoverWindow(events, timelineWindow.from, timelineWindow.to)) {
      setCalendarResult({ key: calendarKey, state: "ready", events: relevantCurrentEvents });
      return;
    }

    const exactCached = calendarCacheRef.current.get(calendarKey);
    const coveringCachedMatch = exactCached
      ? [calendarKey, exactCached] as const
      : [...calendarCacheRef.current.entries()].find(
          ([, entry]) => entry.currencyKey === currencyKey && entry.from <= timelineWindow.from && entry.to >= timelineWindow.to,
        );
    if (coveringCachedMatch) {
      const [coveringKey, coveringCached] = coveringCachedMatch;
      calendarCacheRef.current.delete(coveringKey);
      calendarCacheRef.current.set(calendarKey, coveringCached);
      setCalendarResult({ key: calendarKey, state: "ready", events: coveringCached.events });
      return;
    }

    setCalendarResult({ key: calendarKey, state: "loading", events: [] });
    const timeoutId = window.setTimeout(() => {
      const countries = currencies
        .map((currency) => CURRENCY_TO_COUNTRY_CODE[currency as keyof typeof CURRENCY_TO_COUNTRY_CODE])
        .filter((country): country is string => Boolean(country));
      let pendingRequest = calendarPendingRef.current.get(calendarKey);
      if (!pendingRequest) {
        pendingRequest = fetchCalendar({
          from: timelineWindow.from,
          to: timelineWindow.to,
          impacts: ["low", "medium", "high"],
          countries,
        });
        calendarPendingRef.current.set(calendarKey, pendingRequest);
        void pendingRequest.finally(() => {
          if (calendarPendingRef.current.get(calendarKey) === pendingRequest) {
            calendarPendingRef.current.delete(calendarKey);
          }
        }).catch(() => undefined);
      }
      void pendingRequest
        .then((loadedEvents) => {
          const relevantLoadedEvents = loadedEvents.filter((event) => currencies.includes(event.currency));
          const overlappingEvents = [...calendarCacheRef.current.values()]
            .filter((entry) => entry.currencyKey === currencyKey && entry.from <= timelineWindow.to && entry.to >= timelineWindow.from)
            .flatMap((entry) => entry.events);
          const mergedEvents = mergePairMatrixCalendarEvents(relevantCurrentEvents, overlappingEvents, relevantLoadedEvents);
          calendarCacheRef.current.set(calendarKey, {
            currencyKey,
            from: timelineWindow.from,
            to: timelineWindow.to,
            events: mergedEvents,
          });
          while (calendarCacheRef.current.size > PAIR_MATRIX_HISTORY_CACHE_LIMIT) {
            const oldestKey = calendarCacheRef.current.keys().next().value as string | undefined;
            if (!oldestKey) break;
            calendarCacheRef.current.delete(oldestKey);
          }
          if (calendarRequestRef.current !== requestId) return;
          setCalendarResult({ key: calendarKey, state: "ready", events: mergedEvents });
        })
        .catch(() => {
          if (calendarRequestRef.current !== requestId) return;
          setCalendarResult({ key: calendarKey, state: "error", events: [] });
        });
    }, PAIR_MATRIX_HISTORY_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [open, currencies, currencyKey, timelineWindow?.from, timelineWindow?.to, calendarKey, events]);

  useEffect(() => {
    const requestId = ++markerCalendarRequestRef.current;
    if (!open || !currencies || !markerWindow || !markerCalendarKey) {
      setMarkerCalendarEvents([]);
      setMarkerCalendarState("idle");
      return;
    }
    const relevantCurrentEvents = events.filter((event) => currencies.includes(event.currency));
    const overlappingEntries = [...calendarCacheRef.current.values()].filter(
      (entry) => entry.currencyKey === currencyKey && entry.from <= markerWindow.to && entry.to >= markerWindow.from,
    );
    const baseline = mergePairMatrixCalendarEvents(relevantCurrentEvents, ...overlappingEntries.map((entry) => entry.events));
    const coveringCached = overlappingEntries.find(
      (entry) => entry.from <= markerWindow.from && entry.to >= markerWindow.to,
    );
    if (calendarEventsCoverWindow(events, markerWindow.from, markerWindow.to) || coveringCached) {
      setMarkerCalendarEvents(coveringCached ? mergePairMatrixCalendarEvents(baseline, coveringCached.events) : baseline);
      setMarkerCalendarState("ready");
      return;
    }

    setMarkerCalendarEvents(baseline);
    setMarkerCalendarState("loading");
    const timeoutId = window.setTimeout(() => {
      const countries = currencies
        .map((currency) => CURRENCY_TO_COUNTRY_CODE[currency as keyof typeof CURRENCY_TO_COUNTRY_CODE])
        .filter((country): country is string => Boolean(country));
      let pendingRequest = calendarPendingRef.current.get(markerCalendarKey);
      if (!pendingRequest) {
        pendingRequest = fetchCalendar({
          from: markerWindow.from,
          to: markerWindow.to,
          impacts: ["low", "medium", "high"],
          countries,
        });
        calendarPendingRef.current.set(markerCalendarKey, pendingRequest);
        void pendingRequest.finally(() => {
          if (calendarPendingRef.current.get(markerCalendarKey) === pendingRequest) {
            calendarPendingRef.current.delete(markerCalendarKey);
          }
        }).catch(() => undefined);
      }
      void pendingRequest.then((loadedEvents) => {
        if (markerCalendarRequestRef.current !== requestId) return;
        const relevantLoaded = loadedEvents.filter((event) => currencies.includes(event.currency));
        const merged = mergePairMatrixCalendarEvents(baseline, relevantLoaded);
        calendarCacheRef.current.set(markerCalendarKey, {
          currencyKey,
          from: markerWindow.from,
          to: markerWindow.to,
          events: merged,
        });
        while (calendarCacheRef.current.size > PAIR_MATRIX_HISTORY_CACHE_LIMIT) {
          const oldestKey = calendarCacheRef.current.keys().next().value as string | undefined;
          if (!oldestKey) break;
          calendarCacheRef.current.delete(oldestKey);
        }
        setMarkerCalendarEvents(merged);
        setMarkerCalendarState("ready");
      }).catch(() => {
        if (markerCalendarRequestRef.current === requestId) {
          setMarkerCalendarEvents(baseline);
          setMarkerCalendarState("error");
        }
      });
    }, PAIR_MATRIX_HISTORY_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [open, currencies, currencyKey, markerWindow?.from, markerWindow?.to, markerCalendarKey, events]);

  const loadState: PairMatrixLoadState = !currencies || rangeOpenCalendarTime == null
    ? "idle"
    : calendarResult.key === calendarKey
      ? calendarResult.state
      : "loading";
  const calendarIndex = useMemo(
    () => open && currencies && loadState === "ready"
      ? indexPairMatrixCalendar(calendarResult.events, currencies)
      : indexPairMatrixCalendar([], []),
    [open, currencies, loadState, calendarResult.events],
  );
  const resolveDerived = useCallback((
    rangeOpen: number | null,
    rangeClose: number | null,
    rangeDuringThrough: number | null,
  ): PairMatrixDerivedSnapshot => {
    if (!currencies || rangeOpen == null || rangeClose == null || rangeDuringThrough == null || loadState !== "ready") {
      const timeline = { during: [], before: [] } satisfies PairMatrixTimelineSnapshot;
      return { timeline, momentum: buildPairMatrixMomentumSnapshot(timeline, currencies ?? []) };
    }

    const cache = derivedCacheRef.current;
    if (cache.index !== calendarIndex) {
      cache.index = calendarIndex;
      cache.values.clear();
    }
    const cacheKey = `${currencies.join("|")}:${rangeOpen}:${rangeClose}:${rangeDuringThrough}:${beforeDays}`;
    const cached = cache.values.get(cacheKey);
    if (cached) return cached;

    const timeline = buildPairMatrixTimelineFromIndex({
      index: calendarIndex,
      currencies,
      rangeOpen,
      rangeClose,
      duringThrough: rangeDuringThrough,
      beforeDays,
    });
    const derived = { timeline, momentum: buildPairMatrixMomentumSnapshot(timeline, currencies) };
    cache.values.set(cacheKey, derived);
    while (cache.values.size > 128) cache.values.delete(cache.values.keys().next().value as string);
    return derived;
  }, [currencies, calendarIndex, beforeDays, loadState]);
  const derived = useMemo(
    () => resolveDerived(rangeOpenCalendarTime, rangeCloseCalendarTime, duringThrough),
    [resolveDerived, rangeOpenCalendarTime, rangeCloseCalendarTime, duringThrough],
  );

  const updateBeforeDays = useCallback((days: number) => {
    setBeforeDays(days);
    savePairMatrixBeforeDays(days);
  }, []);
  const rangeLabel = range == null
    ? "Waiting for candle"
    : `${formatChartFeedTime(range.firstOpen, displayTimeMode, sourceTimeOffsetSeconds)} → ${formatChartFeedTime(range.close, displayTimeMode, sourceTimeOffsetSeconds)} · ${range.candleCount} ${timeframe} ${range.candleCount === 1 ? "candle" : "candles"}`;
  const rangeMoveLabel = getPairMatrixRangePipMoveLabel(visibleCandles, range, currencies?.[1] ?? null);
  const rangeBasisLabel: ChartPairMatrixTimeLensData["rangeBasisLabel"] = lockedRange
    ? "Locked range"
    : "Latest candle";

  const timeLensBaseData = useMemo<ChartPairMatrixTimeLensData>(() => ({
    open,
    supported: currencies != null,
    pairLabel: selectedSymbol,
    currencies: currencies ?? [],
    timeline: derived.timeline,
    momentum: derived.momentum,
    rangeLabel,
    rangeMoveLabel,
    rangeOpenTimeSeconds: rangeOpenCalendarTime,
    rangeBasisLabel,
    loadState,
    displayTimeMode,
    sourceTimeOffsetSeconds,
    beforeDays,
    rangeSelectionArmed: rangeArmed,
    hasLockedRange: lockedRange != null,
    onBeforeDaysChange: updateBeforeDays,
    onStartRangeSelection: () => setRangeArmed(true),
    onReturnToCursor: () => {
      setLockedRange(null);
      setLockedInterval(null);
      setRangeArmed(false);
      setRangeEditing(false);
      setRangeCancelRevision((current) => current + 1);
    },
    onToggleOpen: () => {
      if (open) {
        setRangeArmed(false);
        setRangeEditing(false);
        setRangeCancelRevision((current) => current + 1);
      }
      setOpen(!open);
    },
    onClose: () => {
      setOpen(false);
      setRangeArmed(false);
      setRangeEditing(false);
      setRangeCancelRevision((current) => current + 1);
    },
  }), [
    open,
    currencies,
    selectedSymbol,
    derived,
    rangeLabel,
    rangeMoveLabel,
    rangeOpenCalendarTime,
    rangeBasisLabel,
    loadState,
    displayTimeMode,
    sourceTimeOffsetSeconds,
    beforeDays,
    rangeArmed,
    lockedRange,
    updateBeforeDays,
  ]);

  const resolveCursorData = useCallback((anchor: number | null): ChartPairMatrixTimeLensData => {
    if (lockedRange || anchor == null) return timeLensBaseData;
    const anchorRange = normalizePairMatrixCandleRange(candleTimes, anchor, anchor, timeframe);
    if (!anchorRange) return timeLensBaseData;
    const rangeOpen = anchorRange.firstOpen - sourceTimeOffsetSeconds;
    const rangeClose = anchorRange.close - sourceTimeOffsetSeconds;
    const rangeDuringThrough = Math.min(
      rangeClose - 1,
      Math.max(rangeOpen, marketCheckedAt ?? Math.floor(Date.now() / 1000)),
    );
    const requiredWindow = getPairMatrixTimelineWindow(rangeOpen, rangeClose, beforeDays);
    const requiredKey = `${currencyKey}:${requiredWindow.from}:${requiredWindow.to}`;
    const anchorLoadState: PairMatrixLoadState = calendarKey === requiredKey && calendarResult.key === requiredKey
      ? calendarResult.state
      : "loading";
    const anchorDerived = anchorLoadState === "ready"
      ? resolveDerived(rangeOpen, rangeClose, rangeDuringThrough)
      : (() => {
          const timeline = { during: [], before: [] } satisfies PairMatrixTimelineSnapshot;
          return { timeline, momentum: buildPairMatrixMomentumSnapshot(timeline, currencies ?? []) };
        })();
    return {
      ...timeLensBaseData,
      timeline: anchorDerived.timeline,
      momentum: anchorDerived.momentum,
      rangeLabel: `${formatChartFeedTime(anchorRange.firstOpen, displayTimeMode, sourceTimeOffsetSeconds)} → ${formatChartFeedTime(anchorRange.close, displayTimeMode, sourceTimeOffsetSeconds)} · ${anchorRange.candleCount} ${timeframe} ${anchorRange.candleCount === 1 ? "candle" : "candles"}`,
      rangeMoveLabel: getPairMatrixRangePipMoveLabel(visibleCandles, anchorRange, currencies?.[1] ?? null),
      rangeOpenTimeSeconds: rangeOpen,
      rangeBasisLabel: "Hovered candle",
      loadState: anchorLoadState,
    };
  }, [lockedRange, timeLensBaseData, candleTimes, timeframe, sourceTimeOffsetSeconds, marketCheckedAt, beforeDays, currencyKey, calendarKey, calendarResult.key, calendarResult.state, resolveDerived, currencies, displayTimeMode, visibleCandles]);
  const timeLensData = useMemo<ChartPairMatrixTimeLensData>(() => ({
    ...timeLensBaseData,
    cursorRuntime: {
      hover: hoverRuntimeRef.current,
      resolve: resolveCursorData,
    },
  }), [timeLensBaseData, resolveCursorData]);

  const resolveCandleAtX = useCallback((x: number): { index: number; time: number } | null => {
    const chart = chartRef.current;
    if (!chart || candleTimes.length === 0) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical == null) return null;
    const index = Math.min(candleTimes.length - 1, Math.max(0, Math.round(Number(logical))));
    return { index, time: candleTimes[index] };
  }, [chartRef, candleTimes]);

  const buildRangePreview = useCallback((
    previewRange: PairMatrixCandleRange,
    originTime: number,
  ): PairMatrixRangePreview | null => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return null;
    const firstCenter = chart.timeScale().timeToCoordinate(previewRange.firstOpen as Time);
    const lastCenter = chart.timeScale().timeToCoordinate(previewRange.lastOpen as Time);
    const bounds = getPairMatrixRangePixelBounds(
      firstCenter,
      lastCenter,
      chart.timeScale().options().barSpacing,
      container.clientWidth,
    );
    if (!bounds) return null;
    return {
      key: `${previewRange.firstOpen}:${previewRange.lastOpen}`,
      originTime,
      range: previewRange,
      bounds,
    };
  }, [chartRef, containerRef]);

  const resolvePreviewAtX = useCallback((x: number, originTime: number): PairMatrixRangePreview | null => {
    const target = resolveCandleAtX(x);
    const originIndex = candleIndexByTime.get(originTime);
    if (!target || originIndex == null) return null;
    const fromIndex = Math.min(originIndex, target.index);
    const throughIndex = Math.max(originIndex, target.index);
    const previewRange: PairMatrixCandleRange = {
      firstOpen: candleTimes[fromIndex],
      lastOpen: candleTimes[throughIndex],
      close: getPairMatrixCandleClose(candleTimes[throughIndex], timeframe),
      candleCount: throughIndex - fromIndex + 1,
    };
    return buildRangePreview(previewRange, originTime);
  }, [buildRangePreview, candleIndexByTime, candleTimes, resolveCandleAtX, timeframe]);

  const lockedBounds = useMemo(
    () => lockedRange ? buildRangePreview(lockedRange, lockedRange.firstOpen)?.bounds ?? null : null,
    [lockedRange, buildRangePreview, chartRangeRevision, chartLayoutRevision, candleTimes],
  );
  const contextMarkerEvents = useMemo(
    () => open ? mergePairMatrixCalendarEvents(events, calendarResult.events, markerCalendarEvents) : [],
    [open, events, calendarResult.events, markerCalendarEvents],
  );
  const contextMarkerIndex = useMemo(() => open ? indexPairMatrixContextMarkers({
    events: contextMarkerEvents,
    currencies: currencies ?? [],
    candleTimes,
    timeframe,
    sourceTimeOffsetSeconds,
  }) : [], [open, contextMarkerEvents, currencies, candleTimes, timeframe, sourceTimeOffsetSeconds]);
  const contextMarkerGroups = useMemo(() => open ? selectPairMatrixContextMarkerGroups({
    groups: contextMarkerIndex,
    range,
    contextPerSide: contextMarkersPerSide,
  }) : [], [open, contextMarkerIndex, range, contextMarkersPerSide]);
  const mapMarkerViews = useCallback((groups: ReturnType<typeof selectPairMatrixContextMarkerGroups>) => {
    const chart = chartRef.current;
    const width = containerRef.current?.clientWidth ?? 0;
    if (!open || !chart || width <= 0) return [];
    return groups.flatMap((group) => {
      const x = chart.timeScale().timeToCoordinate(group.candleOpen as Time);
      if (x == null) return [];
      return [{
        ...group,
        x,
        placement: x < 220 ? "right" as const : x > width - 220 ? "left" as const : "center" as const,
      }];
    });
  }, [open, chartRangeRevision, chartLayoutRevision, chartRef, containerRef]);
  const contextMarkerViews = useMemo(
    () => mapMarkerViews(contextMarkerGroups),
    [mapMarkerViews, contextMarkerGroups],
  );
  const resolveCursorMarkerViews = useCallback((anchor: number | null) => {
    if (lockedRange || anchor == null) return contextMarkerViews;
    const anchorRange = normalizePairMatrixCandleRange(candleTimes, anchor, anchor, timeframe);
    if (!anchorRange) return contextMarkerViews;
    return mapMarkerViews(selectPairMatrixContextMarkerGroups({
      groups: contextMarkerIndex,
      range: anchorRange,
      contextPerSide: contextMarkersPerSide,
    }));
  }, [lockedRange, contextMarkerViews, candleTimes, timeframe, contextMarkerIndex, contextMarkersPerSide, mapMarkerViews]);
  const selectionOriginRange = lockedRange ?? fallbackRange;

  const rangeOverlay = useMemo<ChartPairMatrixRangeOverlayData>(() => ({
    armed: open && rangeArmed,
    cancelRevision: rangeCancelRevision,
    lockedBounds: open ? lockedBounds : null,
    lockedRange: open ? lockedRange : null,
    geometryRuntime,
    startPreview: (x, edge) => {
      const target = resolveCandleAtX(x);
      if (!target) return null;
      const current = selectionOriginRange;
      const originTime = edge === "start" && current
        ? current.lastOpen
        : edge === "end" && current
          ? current.firstOpen
          : target.time;
      return resolvePreviewAtX(x, originTime);
    },
    updatePreview: resolvePreviewAtX,
    onCommit: (committedRange) => {
      setLockedRange(committedRange);
      setLockedInterval({ from: committedRange.firstOpen, toExclusive: committedRange.close });
      setRangeArmed(false);
      setRangeEditing(false);
    },
    onCancel: () => {
      setRangeArmed(false);
      setRangeEditing(false);
    },
    onInteractionChange: setRangeEditing,
  }), [open, rangeArmed, rangeCancelRevision, lockedBounds, lockedRange, geometryRuntime, resolveCandleAtX, selectionOriginRange, resolvePreviewAtX]);

  const analyzeCandle = useCallback((candleOpen: number) => {
    const analyzedRange = getPairMatrixAnalyzeCandleRange(candleTimes, candleOpen, timeframe);
    if (!analyzedRange) return;
    cancelPendingHover();
    setLockedRange(analyzedRange);
    setLockedInterval({ from: analyzedRange.firstOpen, toExclusive: analyzedRange.close });
    setRangeArmed(false);
    setRangeEditing(false);
    setRangeCancelRevision((current) => current + 1);
  }, [cancelPendingHover, candleTimes, timeframe]);

  const contextMarkerData = useMemo<ChartPairMatrixContextMarkerData>(() => ({
    markers: contextMarkerViews,
    passive: rangeArmed || rangeEditing,
    displayTimeMode,
    sourceTimeOffsetSeconds,
    loadState: markerCalendarState,
    onSelectEvent,
    onAnalyzeCandle: analyzeCandle,
    geometryRuntime,
    cursorRuntime: {
      hover: hoverRuntimeRef.current,
      resolve: resolveCursorMarkerViews,
    },
  }), [contextMarkerViews, rangeArmed, rangeEditing, displayTimeMode, sourceTimeOffsetSeconds, markerCalendarState, onSelectEvent, analyzeCandle, geometryRuntime, resolveCursorMarkerViews]);

  return {
    open,
    openRef,
    chartInteracting,
    chartLayoutRevision,
    chartRangeRevision,
    contextMarkerData,
    rangeOverlay,
    timeLensData,
    cancelPendingHover,
    resetHover,
    scheduleHover,
    scheduleGeometryUpdate,
    notifyChartLayoutChange,
    notifyChartRangeChange,
    setChartInteracting,
  };
}
