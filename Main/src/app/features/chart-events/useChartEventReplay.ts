import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChartEventOverlayCluster } from "@/app/lib/chartEventOverlay";
import { getChartEventAnchorTime, getChartEventCoordinateTime, getChartEventKey } from "@/app/lib/chartEvents";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";

export function getDefaultClusterEvent(cluster: { events: Array<{ event: CalendarEvent }> }): CalendarEvent | null {
  const impactRank: Record<CalendarEvent["impact"], number> = { high: 0, medium: 1, low: 2 };
  return [...cluster.events]
    .sort((left, right) => {
      const impactDelta = impactRank[left.event.impact] - impactRank[right.event.impact];
      return impactDelta !== 0 ? impactDelta : left.event.time - right.event.time;
    })[0]?.event ?? null;
}

export function getNearestCandleIndex(
  candles: BridgeCandle[],
  event: CalendarEvent | null,
  timeframe: Timeframe,
  sourceTimeOffsetSeconds: number,
): number | null {
  if (!event || candles.length === 0) return null;
  const chartTime = getChartEventCoordinateTime(event.time, sourceTimeOffsetSeconds);
  const lastCandle = candles[candles.length - 1];
  if (lastCandle && chartTime > lastCandle.time) return null;
  const anchorTime = getChartEventAnchorTime(chartTime, candles, timeframe) ?? chartTime;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  candles.forEach((candle, index) => {
    const distance = Math.abs(candle.time - anchorTime);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

interface ChartEventReplayOptions {
  candles: BridgeCandle[];
  timeframe: Timeframe;
  sourceTimeOffsetSeconds: number;
}

export function useChartEventReplay({ candles, timeframe, sourceTimeOffsetSeconds }: ChartEventReplayOptions) {
  const [hoveredClusterKey, setHoveredClusterKey] = useState<string | null>(null);
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<ChartEventOverlayCluster | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [stepCandles, setStepCandles] = useState(1);
  const anchorIndex = useMemo(
    () => getNearestCandleIndex(candles, selectedEvent, timeframe, sourceTimeOffsetSeconds),
    [candles, selectedEvent, sourceTimeOffsetSeconds, timeframe],
  );
  const selectedEventKey = selectedEvent ? getChartEventKey(selectedEvent) : null;

  useEffect(() => {
    if (!selectedEvent || anchorIndex == null) {
      setCursorIndex(null);
      setPlaying(false);
      return;
    }
    setCursorIndex(anchorIndex);
    setPlaying(false);
  }, [anchorIndex, selectedEvent, selectedEventKey]);

  useEffect(() => {
    if (!playing || cursorIndex == null) return;
    if (cursorIndex >= candles.length - 1) {
      setPlaying(false);
      return;
    }
    const delayMs = Math.max(120, Math.round(850 / speed));
    const id = window.setInterval(() => {
      setCursorIndex((current) => {
        if (current == null) return current;
        const next = Math.min(candles.length - 1, current + 1);
        if (next >= candles.length - 1) setPlaying(false);
        return next;
      });
    }, delayMs);
    return () => window.clearInterval(id);
  }, [candles.length, cursorIndex, playing, speed]);

  const selectEvent = useCallback((event: CalendarEvent, cluster: ChartEventOverlayCluster | null = null) => {
    setActiveClusterKey(cluster?.key ?? null);
    setSelectedCluster(cluster);
    setSelectedEvent(event);
    setExpanded(true);
    setPlaying(false);
  }, []);

  const close = useCallback(() => {
    setActiveClusterKey(null);
    setHoveredClusterKey(null);
    setSelectedCluster(null);
    setSelectedEvent(null);
    setExpanded(false);
    setPlaying(false);
    setCursorIndex(null);
  }, []);

  const reset = useCallback(() => {
    if (anchorIndex == null) return;
    setCursorIndex(anchorIndex);
    setPlaying(false);
  }, [anchorIndex]);

  const step = useCallback(() => {
    if (cursorIndex == null) return;
    setPlaying(false);
    setCursorIndex((current) => current == null ? current : Math.min(candles.length - 1, current + stepCandles));
  }, [candles.length, cursorIndex, stepCandles]);

  const togglePlayback = useCallback(() => {
    if (anchorIndex == null) return;
    setCursorIndex((current) => current == null || current >= candles.length - 1 ? anchorIndex : current);
    setPlaying((current) => !current);
  }, [anchorIndex, candles.length]);

  return {
    activeClusterKey,
    anchorIndex,
    close,
    cursorIndex,
    expanded,
    hoveredClusterKey,
    playing,
    reset,
    selectEvent,
    selectedCluster,
    selectedEvent,
    setExpanded,
    setHoveredClusterKey,
    setSpeed,
    setStepCandles,
    speed,
    step,
    stepCandles,
    togglePlayback,
  };
}

