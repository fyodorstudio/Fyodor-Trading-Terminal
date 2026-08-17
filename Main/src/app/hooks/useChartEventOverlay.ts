import { useMemo, type RefObject } from "react";
import type { IChartApi } from "lightweight-charts";
import {
  capChartEventCandidatesForOverlay,
  filterChartEventsForOverlay,
  formatChartEventDisplayTime,
  getChartEventKey,
  sliceChartEventsByTime,
} from "@/app/lib/chartEvents";
import {
  clusterChartEventPoints,
  getChartEventTooltipPlacement,
  resolveChartEventX,
  type ChartEventOverlayCluster,
  type ChartEventOverlayPoint,
} from "@/app/lib/chartEventOverlay";
import type {
  ChartDisplayTimeMode,
  ChartEventOverlayPreferences,
} from "@/app/lib/chartView";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";

interface UseChartEventOverlayArgs {
  enabled?: boolean;
  chartRef: RefObject<IChartApi | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  selectedSymbol: string;
  visibleCandles: BridgeCandle[];
  timeframe: Timeframe;
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  preferences: ChartEventOverlayPreferences;
  isInteracting: boolean;
  chartRangeRevision: number;
  chartLayoutRevision: number;
}

interface ChartEventOverlayData {
  points: ChartEventOverlayPoint[];
  visibleEventCount: number;
  renderedEventCount: number;
  isCapped: boolean;
  isInteracting: boolean;
}

export function useChartEventOverlay({
  enabled = true,
  chartRef,
  containerRef,
  events,
  selectedSymbol,
  visibleCandles,
  timeframe,
  displayTimeMode,
  sourceTimeOffsetSeconds,
  preferences,
  isInteracting,
  chartRangeRevision,
  chartLayoutRevision,
}: UseChartEventOverlayArgs): {
  candidatesCount: number;
  overlayData: ChartEventOverlayData;
  clusters: ChartEventOverlayCluster[];
} {
  const candidates = useMemo(
    () =>
      enabled ? filterChartEventsForOverlay({
        events,
        selectedSymbol,
        scope: preferences.scope,
        impactFilter: preferences.impactFilter,
        sourceTimeOffsetSeconds,
        latestCandleTime: visibleCandles[visibleCandles.length - 1]?.time ?? null,
      }) : [],
    [
      enabled,
      events,
      selectedSymbol,
      preferences.scope,
      preferences.impactFilter,
      sourceTimeOffsetSeconds,
      visibleCandles,
    ],
  );

  const overlayData = useMemo<ChartEventOverlayData>(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!enabled || !chart || !container || !preferences.visible || visibleCandles.length === 0) {
      return { points: [], visibleEventCount: 0, renderedEventCount: 0, isCapped: false, isInteracting };
    }

    const width = container.clientWidth;
    if (width <= 0) {
      return { points: [], visibleEventCount: 0, renderedEventCount: 0, isCapped: false, isInteracting };
    }

    const visibleRange = chart.timeScale().getVisibleRange();
    const firstCandle = visibleCandles[0];
    const lastCandle = visibleCandles[visibleCandles.length - 1];
    const fallbackFrom = firstCandle?.time ?? 0;
    const fallbackTo = lastCandle?.time ?? fallbackFrom;
    const visibleFrom = typeof visibleRange?.from === "number" ? visibleRange.from : fallbackFrom;
    const visibleTo = typeof visibleRange?.to === "number" ? visibleRange.to : fallbackTo;
    const candleSpacing =
      visibleCandles.length > 1
        ? Math.max(60, Math.abs((lastCandle.time - firstCandle.time) / Math.max(1, visibleCandles.length - 1)))
        : 3600;
    const rangeBuffer = candleSpacing * 2;
    const rangeMidpoint = (visibleFrom + visibleTo) / 2;
    const visibleCandidates = sliceChartEventsByTime(candidates, visibleFrom - rangeBuffer, visibleTo + rangeBuffer);
    const cappedCandidates = capChartEventCandidatesForOverlay({
      candidates: visibleCandidates,
      maxMarkers: preferences.maxMarkers,
      futureMarkerLimit: preferences.futureMarkerLimit,
      rangeMidpoint,
    });

    const points = cappedCandidates
      .map((candidate) => {
        const x = resolveChartEventX(chart, visibleCandles, timeframe, candidate.chartTime);
        if (x == null || x < -24 || x > width + 24) return null;

        return {
          key: getChartEventKey(candidate.event),
          event: candidate.event,
          x,
          timeLabel: formatChartEventDisplayTime(
            candidate.event.time,
            displayTimeMode,
            sourceTimeOffsetSeconds,
          ),
          isFuture: candidate.isFuture,
          tooltipPlacement: getChartEventTooltipPlacement(x, width),
        };
      })
      .filter((point): point is ChartEventOverlayPoint => point != null)
      .sort((left, right) => left.x - right.x);

    return {
      points,
      visibleEventCount: visibleCandidates.length,
      renderedEventCount: cappedCandidates.length,
      isCapped: visibleCandidates.length > cappedCandidates.length,
      isInteracting,
    };
  }, [
    enabled,
    candidates,
    preferences.visible,
    preferences.maxMarkers,
    preferences.futureMarkerLimit,
    visibleCandles,
    timeframe,
    displayTimeMode,
    sourceTimeOffsetSeconds,
    isInteracting,
    chartRangeRevision,
    chartLayoutRevision,
  ]);

  const clusters = useMemo<ChartEventOverlayCluster[]>(() => {
    const container = containerRef.current;
    return clusterChartEventPoints(overlayData.points, container?.clientWidth ?? 0);
  }, [containerRef, overlayData.points]);

  return {
    candidatesCount: candidates.length,
    overlayData,
    clusters,
  };
}
