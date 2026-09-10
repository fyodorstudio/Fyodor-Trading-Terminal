import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import {
  createFmsArrowNavigationRequest,
  describeFmsArrowNavigationStage,
  resolveFmsArrowNavigationStage,
  type FmsArrowNavigationRequest,
} from "@/app/features/fms-arrow-navigation/arrowNavigation";
import type { BridgeCandle, MacroSignalChartSignal, MacroSignalChartSignalResponse, Timeframe } from "@/app/types";

interface FmsArrowNavigationOptions {
  selectedSymbol: string;
  timeframe: Timeframe;
  onSelectedSymbolChange: (symbol: string) => void;
  setTimeframe: Dispatch<SetStateAction<Timeframe>>;
  historyState: "loading" | "ready" | "no_data" | "error";
  currentResponse: MacroSignalChartSignalResponse | null;
  currentError: string | null;
  historicalResponse: MacroSignalChartSignalResponse | null;
  historicalError: string | null;
  displayedSignals: MacroSignalChartSignal[];
  visibleCandles: BridgeCandle[];
  sourceTimeOffsetSeconds: number;
  chartRef: MutableRefObject<IChartApi | null>;
  seriesRef: MutableRefObject<ISeriesApi<"Candlestick"> | null>;
  ensureHistoryCoverage: (targetChartTime: number) => Promise<boolean>;
  addLog: (line: string) => void;
  setMacroBiasVisible: Dispatch<SetStateAction<boolean>>;
  setHistoricalMatchesVisible: Dispatch<SetStateAction<boolean>>;
  setHiddenHistoricalPatterns: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSelectedSignalId: Dispatch<SetStateAction<string | null>>;
}

const MACRO_BIAS_VISIBILITY_KEY = "fyodor.charts.macro-bias-visible";
const MACRO_BIAS_HISTORICAL_MATCHES_KEY = "fyodor.charts.macro-bias-historical-matches";

export function useFmsArrowNavigation({
  selectedSymbol,
  timeframe,
  onSelectedSymbolChange,
  setTimeframe,
  historyState,
  currentResponse,
  currentError,
  historicalResponse,
  historicalError,
  displayedSignals,
  visibleCandles,
  sourceTimeOffsetSeconds,
  chartRef,
  seriesRef,
  ensureHistoryCoverage,
  addLog,
  setMacroBiasVisible,
  setHistoricalMatchesVisible,
  setHiddenHistoricalPatterns,
  setSelectedSignalId,
}: FmsArrowNavigationOptions) {
  const pendingRequestRef = useRef<FmsArrowNavigationRequest | null>(null);
  const reportedStageRef = useRef<string | null>(null);
  const coverageAttemptRef = useRef<string | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);

  useEffect(() => {
    const pending = pendingRequestRef.current;
    if (!pending) return;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const resolution = resolveFmsArrowNavigationStage({
      request: pending,
      selectedMarket: selectedSymbol,
      selectedTimeframe: timeframe,
      historyState,
      signalState: pending.signal.historicalReplay
        ? historicalError
          ? "error"
          : historicalResponse?.symbol.toUpperCase() === selectedSymbol.toUpperCase()
            ? "ready"
            : "loading"
        : currentError
          ? "error"
          : currentResponse
            ? "ready"
            : "loading",
      signals: displayedSignals,
      candles: visibleCandles,
      sourceTimeOffsetSeconds,
      chartMounted: Boolean(chart && series),
    });
    if (reportedStageRef.current !== resolution.stage) {
      reportedStageRef.current = resolution.stage;
      addLog(`Go to arrow: ${describeFmsArrowNavigationStage(resolution.stage)}`);
    }
    if (resolution.stage === "coverage_unavailable") {
      const attemptKey = `${pending.market}:${pending.signal.id}:${pending.signal.activationTime ?? pending.signal.eventTime}`;
      if (coverageAttemptRef.current !== attemptKey) {
        coverageAttemptRef.current = attemptKey;
        addLog("Go to arrow: requesting the missing activation-candle window");
        const targetChartTime = (pending.signal.activationTime ?? pending.signal.eventTime) + sourceTimeOffsetSeconds;
        void ensureHistoryCoverage(targetChartTime).then((loaded) => {
          if (pendingRequestRef.current !== pending) return;
          if (!loaded) {
            pendingRequestRef.current = null;
            addLog("Go to arrow: the broker did not return the required activation-candle window");
            return;
          }
          setFocusRevision((current) => current + 1);
        });
        return;
      }
      pendingRequestRef.current = null;
      addLog("Go to arrow: returned history still does not contain the activation candle");
      return;
    }
    if (resolution.stage === "history_unavailable" || resolution.stage === "signal_unavailable") {
      pendingRequestRef.current = null;
      return;
    }
    if (resolution.stage !== "ready" || !resolution.signal || !resolution.range || !chart || !series) return;
    pendingRequestRef.current = null;
    setSelectedSignalId(resolution.signal.id);
    chart.timeScale().setVisibleLogicalRange(resolution.range);
    series.priceScale().setAutoScale(true);
  }, [
    addLog,
    currentError,
    currentResponse,
    displayedSignals,
    ensureHistoryCoverage,
    focusRevision,
    historicalError,
    historicalResponse,
    historyState,
    selectedSymbol,
    setSelectedSignalId,
    sourceTimeOffsetSeconds,
    timeframe,
    visibleCandles,
    chartRef,
    seriesRef,
  ]);

  return useCallback((market: string, signal: MacroSignalChartSignal) => {
    const request = createFmsArrowNavigationRequest(market, signal);
    pendingRequestRef.current = request;
    reportedStageRef.current = null;
    coverageAttemptRef.current = null;
    setMacroBiasVisible(true);
    setHistoricalMatchesVisible(true);
    setHiddenHistoricalPatterns((current) => {
      const hidden = current[request.market] ?? [];
      return hidden.includes(signal.patternId)
        ? { ...current, [request.market]: hidden.filter((patternId) => patternId !== signal.patternId) }
        : current;
    });
    try {
      window.localStorage.setItem(MACRO_BIAS_VISIBILITY_KEY, "true");
      window.localStorage.setItem(MACRO_BIAS_HISTORICAL_MATCHES_KEY, "true");
    } catch {
      // Visibility persistence is optional; navigation itself remains active.
    }
    if (selectedSymbol.toUpperCase() !== request.market) onSelectedSymbolChange(request.market);
    if (timeframe !== request.timeframe) setTimeframe(request.timeframe);
    setFocusRevision((current) => current + 1);
  }, [
    onSelectedSymbolChange,
    selectedSymbol,
    setHiddenHistoricalPatterns,
    setHistoricalMatchesVisible,
    setMacroBiasVisible,
    setTimeframe,
    timeframe,
  ]);
}

