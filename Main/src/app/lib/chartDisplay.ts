import { CrosshairMode } from "lightweight-charts";
import type { ChartCursorReadoutMode } from "@/app/lib/chartView";
import type { BridgeSymbol, MarketStatusResponse, Timeframe } from "@/app/types";

export const DEFAULT_CHART_SYMBOL = "EURUSD";
export const CHART_TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];
export const PREFERRED_CHART_SYMBOLS = ["EURUSD", "USDJPY", "GBPUSD", "XAUUSD"];
export const CHART_HISTORY_RANGE_MAX_SECONDS = 40 * 24 * 60 * 60;

export function getChartConnectionLabel(params: {
  historyState: "loading" | "ready" | "no_data" | "error";
  marketStatus: MarketStatusResponse | null;
  streamConnected: boolean;
}): string {
  if (params.historyState === "loading") return "Loading";
  if (params.marketStatus?.terminal_connected === false) return "MT5 Disconnected";
  if (params.marketStatus?.session_state === "closed") return "Market Closed";
  if (params.historyState === "error") return "Bridge Unavailable";
  if (params.historyState === "no_data") return "Bridge Unavailable";
  return params.streamConnected ? "Market Open" : "Bridge Unavailable";
}

export function getChartPriceFormat(symbol: string, assetClass: string | null) {
  const normalized = symbol.toUpperCase();
  if (assetClass === "metals" || normalized.startsWith("XAU") || normalized.startsWith("XAG")) {
    return { type: "price" as const, precision: 2, minMove: 0.01 };
  }
  if (normalized.includes("JPY")) {
    return { type: "price" as const, precision: 3, minMove: 0.001 };
  }
  if (assetClass === "crypto") {
    return { type: "price" as const, precision: 2, minMove: 0.01 };
  }
  return { type: "price" as const, precision: 5, minMove: 0.00001 };
}

export function getCrosshairMode(readoutMode: ChartCursorReadoutMode) {
  return readoutMode === "nearest_candle" ? CrosshairMode.Magnet : CrosshairMode.Normal;
}

export function pickInitialChartSymbol(symbols: BridgeSymbol[]): string {
  for (const preferred of PREFERRED_CHART_SYMBOLS) {
    const found = symbols.find((symbol) => symbol.name.toUpperCase() === preferred);
    if (found) return found.name;
  }
  return symbols[0]?.name ?? DEFAULT_CHART_SYMBOL;
}
