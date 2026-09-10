import { LineStyle, type SeriesMarker, type Time } from "lightweight-charts";
import { getMacroBiasActivationCandleOpen } from "@/app/features/fms-arrow-navigation/arrowNavigation";
import { formatUtcDisplayDate } from "@/app/lib/format";
import { getChartEventCoordinateTime } from "@/app/lib/chartEvents";
import { getPairMatrixCandleClose } from "@/app/lib/pairMatrixSnapshot";
import type {
  BridgeCandle,
  MacroSignalChartMode,
  MacroSignalChartSignal,
  MacroSignalChartSignalResponse,
  MacroSignalGlobalResponse,
  Timeframe,
} from "@/app/types";

const MACRO_BIAS_MARKETS = new Set(["AUDUSD", "EURUSD", "GBPUSD", "NZDUSD", "USDCAD", "USDCHF", "USDJPY"]);

export function isMacroBiasMarketSupported(symbol: string): boolean {
  return MACRO_BIAS_MARKETS.has(symbol.toUpperCase());
}

export function getMacroBiasRequestScope(args: {
  mode: MacroSignalChartMode;
  symbol: string;
  timeframe: string;
  from?: number;
  to?: number;
  calendarRevision: string;
}): string {
  return args.mode === "current"
    ? `${args.symbol}:H4:current:${args.calendarRevision}`
    : `${args.symbol}:${args.timeframe}:research_replay:${args.from ?? ""}:${args.to ?? ""}:${args.calendarRevision}`;
}

export function getMacroBiasInitialLoadPlan(
  cached: { generatedAt?: number } | null | undefined,
  visible: boolean,
  sameRevision: boolean,
  now: number,
) {
  if (!cached) return { readLastKnown: true, refreshDelay: null };
  const age = now - (cached.generatedAt ?? 0);
  return {
    readLastKnown: false,
    refreshDelay: visible ? (sameRevision && age >= 0 && age < 60 ? (60 - age) * 1000 : 300) : null,
  };
}

export function shouldApplyMacroBiasRefresh(
  current: MacroSignalChartSignalResponse | MacroSignalGlobalResponse | null,
  next: MacroSignalChartSignalResponse | MacroSignalGlobalResponse,
): boolean {
  if (!current) return true;
  if (current.generatedAt !== next.generatedAt) return true;
  if ("markets" in current && "markets" in next) {
    const currentForward = current.forwardValidation;
    const nextForward = next.forwardValidation;
    return currentForward?.qualifiedDecisions !== nextForward?.qualifiedDecisions
      || currentForward?.trackedCases !== nextForward?.trackedCases
      || currentForward?.resolvedCases !== nextForward?.resolvedCases
      || currentForward?.demoExecution?.captureStatus.checkedAt !== nextForward?.demoExecution?.captureStatus.checkedAt
      || currentForward?.demoExecution?.taggedDeals !== nextForward?.demoExecution?.taggedDeals
      || currentForward?.demoExecution?.totalNetAccountResult !== nextForward?.demoExecution?.totalNetAccountResult;
  }
  return false;
}

export function getMacroBiasReplayStatusLabel(
  summary: MacroSignalChartSignalResponse["evaluationSummary"],
): string {
  if (summary?.latestArrowAt) {
    const date = formatUtcDisplayDate(summary.latestArrowAt);
    return `Hindsight replay · last arrow ${date} · ${summary.laterUnmatchedPackageCount} later scored package${summary.laterUnmatchedPackageCount === 1 ? "" : "s"} did not match`;
  }
  if (summary && summary.evaluatedPackageCount > 0) {
    return `Hindsight replay · ${summary.evaluatedPackageCount} scored packages · none matched a frozen replay pattern`;
  }
  return "Historical replay · hindsight research";
}

export function mergeMacroBiasSignalDetail(
  signal: MacroSignalChartSignal,
  detail: MacroSignalChartSignal | null | undefined,
): MacroSignalChartSignal {
  if (!detail) return signal;
  return {
    ...signal,
    ...detail,
    // Detail enriches the selected arrow and must not erase base records when
    // an older durable target-ladder payload omits its release events.
    events: Array.isArray(detail.events) ? detail.events : Array.isArray(signal.events) ? signal.events : [],
    pathAudit: detail.pathAudit == null
      ? signal.pathAudit
      : { ...signal.pathAudit, ...detail.pathAudit },
  } as MacroSignalChartSignal;
}

export function buildMacroBiasSeriesMarkers(
  signals: MacroSignalChartSignal[],
  candles: BridgeCandle[],
  timeframe: Timeframe,
  sourceTimeOffsetSeconds: number,
): { markers: SeriesMarker<Time>[]; signalByMarkerId: Map<string, MacroSignalChartSignal> } {
  const signalByMarkerId = new Map<string, MacroSignalChartSignal>();
  const candleByTime = new Map(candles.map((candle) => [candle.time, candle] as const));
  const markers = signals.flatMap((signal): SeriesMarker<Time>[] => {
    const chartReleaseTime = getChartEventCoordinateTime(signal.eventTime, sourceTimeOffsetSeconds);
    let low = 0;
    let high = candles.length - 1;
    let releaseIndex = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (candles[middle].time <= chartReleaseTime) {
        releaseIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    const releaseCandleOpen = releaseIndex >= 0 ? candles[releaseIndex].time : null;
    const nextOpen = releaseIndex >= 0 ? candles[releaseIndex + 1]?.time : null;
    const nominalClose = releaseCandleOpen == null ? null : getPairMatrixCandleClose(releaseCandleOpen, timeframe);
    const containingClose = nominalClose == null ? null : nextOpen == null ? nominalClose : Math.min(nextOpen, nominalClose);
    if (containingClose == null || chartReleaseTime >= containingClose || releaseCandleOpen == null) return [];

    const activationCandleOpen = getMacroBiasActivationCandleOpen(signal, candles, sourceTimeOffsetSeconds, timeframe);
    const built: SeriesMarker<Time>[] = [];
    if (activationCandleOpen == null || activationCandleOpen < releaseCandleOpen) return built;
    if (!candleByTime.has(activationCandleOpen)) return built;
    const activationMarkerId = `macro-bias-activation:${signal.id}`;
    signalByMarkerId.set(activationMarkerId, signal);
    built.push({
      id: activationMarkerId,
      time: activationCandleOpen as Time,
      position: signal.direction === "long" ? "belowBar" : "aboveBar",
      shape: signal.direction === "long" ? "arrowUp" : "arrowDown",
      color: signal.historicalReplay
        ? signal.direction === "long" ? "#2563eb" : "#7c3aed"
        : signal.direction === "long" ? "#16a34a" : "#dc2626",
      text: `${signal.entryTimeframe ?? "H4"} ENTRY · ${signal.direction === "long" ? "LONG" : "SHORT"}${signal.observationMode === "recovered_offline" ? " · RECOVERED" : signal.contextOverlay?.matched ? " · CONTEXT" : ""}`,
      size: 1.4,
    });
    return built;
  });
  markers.sort((left, right) => Number(left.time) - Number(right.time));
  return { markers, signalByMarkerId };
}

export function buildMacroBiasPriceLineLevels(signal: MacroSignalChartSignal) {
  const structure = signal.marketContext?.supportResistance;
  const barrier = structure?.directionalBarrier;
  const h4Ladder = (signal.direction === "long" ? structure?.resistances : structure?.supports)
    ?.filter((zone) => zone.entryKnownState == null || zone.entryKnownState === "active")
    .slice(0, 3) ?? (barrier ? [barrier] : []);
  const higher = structure?.higherTimeframes;
  const higherLadder = (["D1", "W1"] as const).flatMap((timeframe) => ((signal.direction === "long"
    ? higher?.[timeframe].resistances
    : higher?.[timeframe].supports) ?? []).slice(0, 2).map((zone) => ({ ...zone, timeframe })));
  const ladder = [...h4Ladder.map((zone) => ({ ...zone, timeframe: zone.timeframe ?? "H4" as const })), ...higherLadder]
    .sort((left, right) => left.distanceAtr - right.distanceAtr)
    .slice(0, 6);
  const structureLines = ladder.map((zone, index) => ({
    value: zone.level,
    title: `${zone.timeframe} ${zone.kind === "support" ? "SUP" : "RES"} ${zone.touches}x${zone.role === "role_reversed" ? " RR" : ""}`,
    color: zone.timeframe === "W1" ? "#7c3aed" : zone.timeframe === "D1" ? "#2563eb" : index === 0 ? "#d97706" : "#92400e",
    lineStyle: LineStyle.Dotted,
  }));
  return [
    { value: signal.entry, title: "ENTRY", color: "#64748b", lineStyle: LineStyle.Dashed },
    { value: signal.stop, title: "SL", color: "#dc2626", lineStyle: LineStyle.Solid },
    { value: signal.target, title: "TP", color: "#16a34a", lineStyle: LineStyle.Solid },
    ...structureLines,
  ].filter((level): level is typeof level & { value: number } => level.value != null && Number.isFinite(level.value));
}

export interface MacroBiasActiveState {
  signal: MacroSignalChartSignal;
  remainingCandles: number | null;
  activationCandleOpen: number;
  expiryCandleOpen: number | null;
}

export function getMacroBiasActiveState(
  signals: MacroSignalChartSignal[],
  candles: BridgeCandle[],
  sourceTimeOffsetSeconds: number,
  chartTimeframe: Timeframe = "H4",
): MacroBiasActiveState | null {
  if (candles.length === 0) return null;
  const latestIndex = candles.length - 1;
  const active = signals.flatMap((signal): Array<MacroBiasActiveState & { activationIndex: number }> => {
    if (signal.outcomeStatus && signal.outcomeStatus !== "pending") return [];
    const activationCandleOpen = getMacroBiasActivationCandleOpen(signal, candles, sourceTimeOffsetSeconds, chartTimeframe);
    const activationIndex = activationCandleOpen == null ? -1 : candles.findIndex((candle) => candle.time === activationCandleOpen);
    if (activationCandleOpen == null || activationIndex < 0) return [];
    const chartCandlesPerModelCandle = ({ M1: 240, M5: 48, M15: 16, M30: 8, H1: 4, H4: 1 } as Partial<Record<Timeframe, number>>)[chartTimeframe];
    if (chartCandlesPerModelCandle == null) {
      if (latestIndex < activationIndex) return [];
      return [{ signal, activationIndex, activationCandleOpen, expiryCandleOpen: null, remainingCandles: null }];
    }
    const expiryIndex = activationIndex + signal.expiryCandles * chartCandlesPerModelCandle;
    if (latestIndex < activationIndex || latestIndex >= expiryIndex) return [];
    return [{
      signal,
      activationIndex,
      activationCandleOpen,
      expiryCandleOpen: candles[expiryIndex]?.time ?? null,
      remainingCandles: Math.ceil((expiryIndex - latestIndex) / chartCandlesPerModelCandle),
    }];
  });
  if (active.length === 0) return null;
  active.sort((left, right) => right.activationIndex - left.activationIndex || right.signal.eventTime - left.signal.eventTime);
  const { activationIndex: _activationIndex, ...state } = active[0];
  return state;
}
