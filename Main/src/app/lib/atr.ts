import type { BridgeCandle } from "@/app/types";

function getPipSize(symbol: string): number {
  return symbol.toUpperCase().includes("JPY") ? 0.01 : 0.0001;
}

export type AtrSmoothingMethod = "RMA" | "SMA" | "EMA" | "WMA";

export function calculateAtrPips(
  candles: BridgeCandle[],
  symbol: string,
  period: number = 14,
  method: AtrSmoothingMethod = "RMA"
): number | null {
  if (candles.length < period + 1) return null;

  const pipSize = getPipSize(symbol);
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const highLow = candles[i].high - candles[i].low;
    const highPrevClose = Math.abs(candles[i].high - candles[i - 1].close);
    const lowPrevClose = Math.abs(candles[i].low - candles[i - 1].close);
    trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
  }

  if (trueRanges.length < period) return null;

  let atr = 0;

  switch (method) {
    case "SMA":
      atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
      break;

    case "EMA": {
      const alpha = 2 / (period + 1);
      atr = trueRanges[0]; // Start with first TR
      for (let i = 1; i < trueRanges.length; i++) {
        atr = alpha * trueRanges[i] + (1 - alpha) * atr;
      }
      break;
    }

    case "WMA": {
      const latest = trueRanges.slice(-period);
      let sum = 0;
      let weightSum = 0;
      for (let i = 0; i < latest.length; i++) {
        const weight = i + 1;
        sum += latest[i] * weight;
        weightSum += weight;
      }
      atr = sum / weightSum;
      break;
    }

    case "RMA":
    default: {
      // TradingView RMA: Initial SMA, then alpha = 1/period
      atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
      for (let i = period; i < trueRanges.length; i++) {
        atr = (atr * (period - 1) + trueRanges[i]) / period;
      }
      break;
    }
  }

  const atrInPips = atr / pipSize;
  return Number.isFinite(atrInPips) ? Math.round(atrInPips) : null;
}

