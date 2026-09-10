import { useMemo } from "react";
import type { ChartEventLensData, ChartEventReleaseRow } from "@/app/components/ChartEventLens";
import type { ChartEventLensDockData } from "@/app/features/chart-events/chartEventLensContracts";
import { getEventValueDisplay } from "@/app/lib/calendarDisplay";
import { formatChartEventDisplayTime, getChartEventKey, getChartEventRelevantCurrencies } from "@/app/lib/chartEvents";
import { getEventComparison } from "@/app/lib/eventReaction";
import { getNearestCandleIndex } from "@/app/features/chart-events/useChartEventReplay";
import type { BridgeCandle, CalendarEvent, Timeframe } from "@/app/types";
import type { ChartDisplayTimeMode, ChartEventOverlayPreferences } from "@/app/lib/chartView";
import type { MacroFactorRow } from "@/app/lib/macroDrivers";

const REPLAY_SPEED_OPTIONS = [0.5, 1, 2, 4];

function formatSignedPriceDelta(value: number, precision: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(precision)}`;
}

function formatObservedMove(
  anchor: BridgeCandle | null,
  current: BridgeCandle | null,
  precision: number,
): { label: string; detail: string } {
  if (!anchor || !current) {
    return {
      label: "N/A",
      detail: "Replay move is unavailable because the selected event is outside the loaded candle window.",
    };
  }
  const delta = current.close - anchor.close;
  const percent = anchor.close === 0 ? null : (delta / anchor.close) * 100;
  const percentLabel = percent == null ? "N/A" : `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
  return {
    label: `${formatSignedPriceDelta(delta, precision)} / ${percentLabel}`,
    detail: `Observed move compares the selected event candle close (${anchor.close.toFixed(precision)}) with the current replay cursor close (${current.close.toFixed(precision)}).`,
  };
}

function formatEventField(value: string, title: string): string {
  return getEventValueDisplay(value, title).display;
}

function getChartEventCurrencyLabel(symbol: string): string {
  const currencies = getChartEventRelevantCurrencies(symbol);
  return currencies.length === 0 ? symbol.toUpperCase() : currencies.join("/");
}

function isSameChartEventTemplate(left: CalendarEvent, right: CalendarEvent): boolean {
  return left.currency === right.currency && left.title === right.title;
}

interface ChartEventLensPresentationOptions {
  selectedSymbol: string;
  eventOverlayPreferences: ChartEventOverlayPreferences;
  visibleClusterCount: number;
  visibleEventCount: number;
  candidateCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onShowEvents: () => void;
  onOpenSettings: () => void;
  onShowHighMedium: () => void;
  selectedEvent: CalendarEvent | null;
  events: CalendarEvent[];
  displayTimeMode: ChartDisplayTimeMode;
  sourceTimeOffsetSeconds: number;
  lastCandleTime: number | null;
  candles: BridgeCandle[];
  timeframe: Timeframe;
  anchorIndex: number | null;
  cursorIndex: number | null;
  pricePrecision: number;
  playing: boolean;
  speed: number;
  factorRows: MacroFactorRow[];
  onSelectRelease: (event: CalendarEvent) => void;
  onClose: () => void;
  onTogglePlayback: () => void;
  onResetReplay: () => void;
  onStepReplay: () => void;
  onReplaySpeedChange: (speed: number) => void;
  onOpenCalendar: (event: CalendarEvent) => void;
}

export function useChartEventLensPresentation(options: ChartEventLensPresentationOptions): {
  dockData: ChartEventLensDockData;
  lensData: ChartEventLensData | null;
} {
  const {
    selectedSymbol,
    eventOverlayPreferences,
    visibleClusterCount,
    visibleEventCount,
    candidateCount,
    expanded,
    onToggleExpanded,
    onShowEvents,
    onOpenSettings,
    onShowHighMedium,
    selectedEvent,
    events,
    displayTimeMode,
    sourceTimeOffsetSeconds,
    lastCandleTime,
    candles,
    timeframe,
    anchorIndex,
    cursorIndex,
    pricePrecision,
    playing,
    speed,
    factorRows,
    onSelectRelease,
    onClose,
    onTogglePlayback,
    onResetReplay,
    onStepReplay,
    onReplaySpeedChange,
    onOpenCalendar,
  } = options;

  const coverageLabel = `Loaded events: ${candidateCount} / Visible: ${visibleEventCount}`;
  const dockData = useMemo<ChartEventLensDockData>(() => {
    const currencyLabel = getChartEventCurrencyLabel(selectedSymbol);
    const impactLabel = eventOverlayPreferences.impactFilter === "high"
      ? "high-impact"
      : eventOverlayPreferences.impactFilter === "high_medium" ? "high/medium-impact" : "loaded";
    const hasVisibleEvents = visibleClusterCount > 0;
    return {
      visible: true,
      title: !eventOverlayPreferences.visible
        ? "Event rail hidden"
        : hasVisibleEvents ? "Select an event marker to replay" : `No loaded ${impactLabel} ${currencyLabel} events in this visible range`,
      description: !eventOverlayPreferences.visible
        ? "Turn the event rail back on to inspect loaded calendar events against price."
        : hasVisibleEvents
          ? "Use the bottom event rail dots or badges to open replay for a loaded calendar event."
          : "The chart can only show calendar rows already loaded by the local bridge. Scroll, refocus, or broaden the impact filter if you expect more markers.",
      countLabel: coverageLabel,
      expanded,
      canEnableEvents: !eventOverlayPreferences.visible,
      canBroadenImpact: eventOverlayPreferences.visible && eventOverlayPreferences.impactFilter === "high",
      onToggleExpanded,
      onShowEvents,
      onOpenSettings,
      onShowHighMedium,
    };
  }, [coverageLabel, eventOverlayPreferences, expanded, onOpenSettings, onShowEvents, onShowHighMedium, onToggleExpanded, selectedSymbol, visibleClusterCount]);

  const releaseRows = useMemo<ChartEventReleaseRow[]>(() => {
    if (!selectedEvent) return [];
    return events
      .filter((event) => isSameChartEventTemplate(event, selectedEvent))
      .sort((left, right) => right.time - left.time)
      .map((event) => ({
        key: getChartEventKey(event),
        event,
        timeLabel: formatChartEventDisplayTime(event.time, displayTimeMode, sourceTimeOffsetSeconds),
        actualLabel: formatEventField(event.actual, event.title),
        forecastLabel: formatEventField(event.forecast, event.title),
        previousLabel: formatEventField(event.previous, event.title),
        isFuture: event.time > (lastCandleTime ?? Number.POSITIVE_INFINITY),
        replayAvailable: getNearestCandleIndex(candles, event, timeframe, sourceTimeOffsetSeconds) != null,
      }));
  }, [candles, displayTimeMode, events, lastCandleTime, selectedEvent, sourceTimeOffsetSeconds, timeframe]);

  const lensData = useMemo<ChartEventLensData | null>(() => {
    if (!selectedEvent) return null;
    const comparison = getEventComparison(selectedEvent);
    const selectedEventIsFuture = selectedEvent.time > (lastCandleTime ?? Number.POSITIVE_INFINITY);
    const anchorCandle = anchorIndex == null ? null : candles[anchorIndex] ?? null;
    const cursorCandle = cursorIndex == null ? anchorCandle : candles[cursorIndex] ?? anchorCandle;
    const observedMove = formatObservedMove(anchorCandle, cursorCandle, pricePrecision);
    const replayAvailable = anchorIndex != null && cursorIndex != null;
    const progressCurrent = anchorIndex == null || cursorIndex == null ? 0 : Math.max(0, cursorIndex - anchorIndex);
    const progressTotal = anchorIndex == null ? 0 : Math.max(0, candles.length - 1 - anchorIndex);
    return {
      releaseRows,
      selectedEvent,
      selectedEventKey: getChartEventKey(selectedEvent),
      selectedEventIsFuture,
      timeLabel: formatChartEventDisplayTime(selectedEvent.time, displayTimeMode, sourceTimeOffsetSeconds),
      actualLabel: formatEventField(selectedEvent.actual, selectedEvent.title),
      forecastLabel: formatEventField(selectedEvent.forecast, selectedEvent.title),
      previousLabel: formatEventField(selectedEvent.previous, selectedEvent.title),
      surpriseLabel: comparison ? `${comparison.surprise >= 0 ? "+" : ""}${comparison.surprise.toFixed(4)}` : "N/A",
      observedMoveLabel: observedMove.label,
      observedMoveDetail: observedMove.detail,
      replayAvailable,
      replayPlaying: playing,
      replayProgressLabel: replayAvailable
        ? `${progressCurrent} / ${progressTotal} candles revealed`
        : selectedEventIsFuture ? "Scheduled event" : "Event outside loaded candles",
      replaySpeed: speed,
      replaySpeedOptions: REPLAY_SPEED_OPTIONS,
      factorRows,
      coverageLabel,
      expanded,
      onSelectRelease,
      onToggleExpanded,
      onClose,
      onTogglePlayback,
      onResetReplay,
      onStepReplay,
      onReplaySpeedChange,
      onOpenCalendar,
    };
  }, [anchorIndex, candles, coverageLabel, cursorIndex, displayTimeMode, expanded, factorRows, lastCandleTime, onClose, onOpenCalendar, onReplaySpeedChange, onResetReplay, onSelectRelease, onStepReplay, onToggleExpanded, onTogglePlayback, playing, pricePrecision, releaseRows, selectedEvent, sourceTimeOffsetSeconds, speed]);

  return { dockData, lensData };
}
