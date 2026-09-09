import type { RefObject } from "react";
import type { IChartApi } from "lightweight-charts";
import type { ChartCacheSummary } from "@/app/lib/chartView";
import type {
  BridgeCandle,
  BridgeStatus,
  BridgeSymbol,
  BridgeSymbolSnapshot,
  MarketStatusResponse,
  Timeframe,
} from "@/app/types";

export type ChartHistoryState = "loading" | "ready" | "no_data" | "error";

export interface UseChartMarketDataArgs {
  selectedSymbol: string;
  onSelectedSymbolChange: (symbol: string) => void;
  timeframe: Timeframe;
  activeMarketStatus: MarketStatusResponse | null;
  chartRef: RefObject<IChartApi | null>;
  addLog: (line: string) => void;
}

export interface UseChartMarketDataResult {
  symbols: BridgeSymbol[];
  symbolSnapshot: BridgeSymbolSnapshot | null;
  refreshSymbols: (background?: boolean) => Promise<void>;
  setBackgroundHistoryPaused: (paused: boolean) => void;
  historyState: ChartHistoryState;
  visibleCandles: BridgeCandle[];
  lastCandleTime: number | null;
  streamConnected: boolean;
  boundaryTime: number | null;
  chartLoadError: string | null;
  cacheSummary: ChartCacheSummary;
  status: BridgeStatus;
  reachedBoundary: boolean;
  clearCurrentCache: () => void;
  ensureHistoryCoverage: (targetTime: number) => Promise<boolean>;
}
