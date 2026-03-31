import type { BridgeCandle } from "@/app/types";

function getPipSize(symbol: string): number {
  return symbol.toUpperCase().includes("JPY") ? 0.01 : 0.0001;
}

export function calculateAtr14Pips(candles: BridgeCandle[], symbol: string): number | null {
  if (candles.length < 15) return null;

  const trueRanges: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];

    const highLow = current.high - current.low;
    const highPrevClose = Math.abs(current.high - previous.close);
    const lowPrevClose = Math.abs(current.low - previous.close);
    const trueRange = Math.max(highLow, highPrevClose, lowPrevClose);

    if (!Number.isFinite(trueRange)) return null;
    trueRanges.push(trueRange);
  }

  const latestRanges = trueRanges.slice(-14);
  if (latestRanges.length < 14) return null;

  const averageTrueRange = latestRanges.reduce((sum, value) => sum + value, 0) / latestRanges.length;
  const atrInPips = averageTrueRange / getPipSize(symbol);

  if (!Number.isFinite(atrInPips)) return null;
  return Math.round(atrInPips);
}
