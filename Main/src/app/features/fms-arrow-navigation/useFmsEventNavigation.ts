import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { getChartEventCoordinateTime } from "@/app/lib/chartEvents";
import { getFmsEventFocusRange } from "@/app/features/fms-arrow-navigation/arrowNavigation";
import type { BridgeCandle, Timeframe } from "@/app/types";

interface FmsEventNavigationOptions {
  selectedSymbol: string;
  timeframe: Timeframe;
  onSelectedSymbolChange: (symbol: string) => void;
  setTimeframe: Dispatch<SetStateAction<Timeframe>>;
  historyState: "loading" | "ready" | "no_data" | "error";
  visibleCandles: BridgeCandle[];
  sourceTimeOffsetSeconds: number;
  focusBars: number;
  chartRef: MutableRefObject<IChartApi | null>;
  seriesRef: MutableRefObject<ISeriesApi<"Candlestick"> | null>;
  ensureHistoryCoverage: (targetChartTime: number) => Promise<boolean>;
  addLog: (line: string) => void;
}

type FmsEventNavigationRequest = { market: string; eventTime: number; marketObserved: boolean };

export function useFmsEventNavigation({
  selectedSymbol,
  timeframe,
  onSelectedSymbolChange,
  setTimeframe,
  historyState,
  visibleCandles,
  sourceTimeOffsetSeconds,
  focusBars,
  chartRef,
  seriesRef,
  ensureHistoryCoverage,
  addLog,
}: FmsEventNavigationOptions) {
  const pendingRef = useRef<FmsEventNavigationRequest | null>(null);
  const coverageAttemptRef = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (selectedSymbol.toUpperCase() !== pending.market) return;
    if (timeframe !== "H4") return;
    if (!pending.marketObserved) {
      pending.marketObserved = true;
      setRevision((current) => current + 1);
      return;
    }
    if (historyState === "loading") return;
    if (historyState === "no_data" || historyState === "error") {
      pendingRef.current = null;
      addLog("Go to event: candle history is unavailable for this release");
      return;
    }
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const range = getFmsEventFocusRange(pending.eventTime, visibleCandles, sourceTimeOffsetSeconds, "H4", focusBars);
    if (!range) {
      const requestKey = `${pending.market}:${pending.eventTime}`;
      if (coverageAttemptRef.current === requestKey) {
        pendingRef.current = null;
        addLog("Go to event: returned history does not contain the release candle");
        return;
      }
      coverageAttemptRef.current = requestKey;
      addLog("Go to event: requesting the missing release-candle window");
      void ensureHistoryCoverage(getChartEventCoordinateTime(pending.eventTime, sourceTimeOffsetSeconds)).then((loaded) => {
        if (pendingRef.current !== pending) return;
        if (!loaded) {
          pendingRef.current = null;
          addLog("Go to event: the broker did not return the release-candle window");
          return;
        }
        setRevision((current) => current + 1);
      });
      return;
    }
    pendingRef.current = null;
    chart.timeScale().setVisibleLogicalRange(range);
    series.priceScale().setAutoScale(true);
    addLog("Go to event: release candle focused");
  }, [
    addLog,
    chartRef,
    ensureHistoryCoverage,
    focusBars,
    historyState,
    revision,
    selectedSymbol,
    seriesRef,
    sourceTimeOffsetSeconds,
    timeframe,
    visibleCandles,
  ]);

  return useCallback((market: string, eventTime: number) => {
    const normalizedMarket = market.toUpperCase();
    pendingRef.current = { market: normalizedMarket, eventTime, marketObserved: selectedSymbol.toUpperCase() === normalizedMarket && timeframe === "H4" };
    coverageAttemptRef.current = null;
    addLog(`Go to event: opening ${normalizedMarket} at the recorded release`);
    if (selectedSymbol.toUpperCase() !== normalizedMarket) onSelectedSymbolChange(normalizedMarket);
    if (timeframe !== "H4") setTimeframe("H4");
    setRevision((current) => current + 1);
  }, [addLog, onSelectedSymbolChange, selectedSymbol, setTimeframe, timeframe]);
}
