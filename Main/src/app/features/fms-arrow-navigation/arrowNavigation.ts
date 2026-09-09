import { getChartEventCoordinateTime } from "@/app/lib/chartEvents";
import { getPairMatrixCandleClose } from "@/app/lib/pairMatrixSnapshot";
import type { BridgeCandle, MacroSignalChartSignal, Timeframe } from "@/app/types";

export interface FmsArrowNavigationRequest {
  market: string;
  signal: MacroSignalChartSignal;
  timeframe: "H1" | "H4";
}

export type FmsArrowNavigationStage =
  | "selecting_market"
  | "selecting_timeframe"
  | "loading_history"
  | "loading_signal"
  | "mounting_chart"
  | "history_unavailable"
  | "signal_unavailable"
  | "coverage_unavailable"
  | "ready";

export function createFmsArrowNavigationRequest(
  market: string,
  signal: MacroSignalChartSignal,
): FmsArrowNavigationRequest {
  return {
    market: market.toUpperCase(),
    signal,
    timeframe: signal.activationTime == null ? "H4" : signal.entryTimeframe ?? "H4",
  };
}

export function getMacroBiasActivationCandleOpen(
  signal: MacroSignalChartSignal,
  candles: BridgeCandle[],
  sourceTimeOffsetSeconds: number,
  chartTimeframe: Timeframe = "H4",
): number | null {
  const activationTime = signal.activationTime == null
    ? null
    : getChartEventCoordinateTime(signal.activationTime, sourceTimeOffsetSeconds);
  const releaseTime = getChartEventCoordinateTime(signal.eventTime, sourceTimeOffsetSeconds);
  if (activationTime == null && chartTimeframe !== "H4") return null;
  const target = activationTime ?? releaseTime;
  if (activationTime != null) {
    let low = 0;
    let high = candles.length - 1;
    let containingIndex = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (candles[middle].time <= target) {
        containingIndex = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    if (containingIndex >= 0) {
      const candleOpen = candles[containingIndex].time;
      const nextOpen = candles[containingIndex + 1]?.time;
      const nominalClose = getPairMatrixCandleClose(candleOpen, chartTimeframe);
      const containingClose = nextOpen == null ? nominalClose : Math.min(nextOpen, nominalClose);
      if (target < containingClose) return candleOpen;
    }
  }
  const nextIndex = candles.findIndex((candle) => activationTime == null ? candle.time > target : candle.time >= target);
  return nextIndex >= 0 ? candles[nextIndex].time : null;
}

export function getMacroBiasArrowFocusRange(
  signal: MacroSignalChartSignal,
  candles: BridgeCandle[],
  sourceTimeOffsetSeconds: number,
  chartTimeframe: Timeframe = "H4",
): { from: number; to: number } | null {
  const activationOpen = getMacroBiasActivationCandleOpen(signal, candles, sourceTimeOffsetSeconds, chartTimeframe);
  if (activationOpen == null) return null;
  const activationIndex = candles.findIndex((candle) => candle.time === activationOpen);
  if (activationIndex < 0) return null;
  const windowBars = Math.min(Math.max(Math.round(candles.length * 0.12), 56), 88);
  const leadBars = Math.max(18, Math.round(windowBars * 0.34));
  return {
    from: Math.max(-0.5, activationIndex - (windowBars - leadBars)),
    to: Math.min(candles.length - 0.5, activationIndex + leadBars),
  };
}

export function resolveFmsArrowNavigationStage(params: {
  request: FmsArrowNavigationRequest;
  selectedMarket: string;
  selectedTimeframe: Timeframe;
  historyState: "loading" | "ready" | "no_data" | "error";
  signalState: "loading" | "ready" | "error";
  signals: MacroSignalChartSignal[];
  candles: BridgeCandle[];
  sourceTimeOffsetSeconds: number;
  chartMounted: boolean;
}): {
  stage: FmsArrowNavigationStage;
  signal: MacroSignalChartSignal | null;
  range: { from: number; to: number } | null;
} {
  if (params.selectedMarket.toUpperCase() !== params.request.market) {
    return { stage: "selecting_market", signal: null, range: null };
  }
  if (params.selectedTimeframe !== params.request.timeframe) {
    return { stage: "selecting_timeframe", signal: null, range: null };
  }
  if (params.historyState === "loading") return { stage: "loading_history", signal: null, range: null };
  if (params.historyState === "no_data" || params.historyState === "error") {
    return { stage: "history_unavailable", signal: null, range: null };
  }
  const signal = params.signals.find((candidate) => candidate.id === params.request.signal.id)
    ?? params.signals.find((candidate) => (
      candidate.patternId === params.request.signal.patternId
      && candidate.eventTime === params.request.signal.eventTime
    ))
    ?? null;
  if (!signal) {
    return { stage: params.signalState === "loading" ? "loading_signal" : "signal_unavailable", signal: null, range: null };
  }
  const range = getMacroBiasArrowFocusRange(
    signal,
    params.candles,
    params.sourceTimeOffsetSeconds,
    params.selectedTimeframe,
  );
  if (!range) return { stage: "coverage_unavailable", signal, range: null };
  if (!params.chartMounted) return { stage: "mounting_chart", signal, range };
  return { stage: "ready", signal, range };
}

export function describeFmsArrowNavigationStage(stage: FmsArrowNavigationStage): string {
  switch (stage) {
    case "selecting_market": return "selecting the arrow’s broker symbol";
    case "selecting_timeframe": return "selecting the arrow’s registered entry timeframe";
    case "loading_history": return "loading candle coverage for the arrow";
    case "loading_signal": return "loading the immutable arrow record";
    case "mounting_chart": return "waiting for the chart surface";
    case "history_unavailable": return "candle history is unavailable for the arrow’s symbol/timeframe";
    case "signal_unavailable": return "the immutable arrow record is absent from the loaded response";
    case "coverage_unavailable": return "loaded candles do not cover the arrow’s activation candle";
    case "ready": return "arrow focused";
  }
}
