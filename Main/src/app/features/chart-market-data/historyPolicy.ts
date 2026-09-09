import type { Timeframe } from "@/app/types";

export const INITIAL_CHART_CANDLES = 1500;
export const QUICK_INITIAL_CHART_CANDLES = 350;
export const CHART_CACHE_WRITE_DELAY_MS = 1500;
export const RESIDENT_QUICK_CANDLES = 350;

const MIN_REFRESH_CANDLES = 12;
const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14_400,
  D1: 86_400,
  W1: 604_800,
  MN1: 2_592_000,
};

export function getChartRefreshBars(
  cachedLatest: number | null,
  timeframe: Timeframe,
  nowSeconds: number,
): number {
  if (cachedLatest == null) return INITIAL_CHART_CANDLES;
  const missingBars = Math.ceil(Math.max(0, nowSeconds - cachedLatest) / TIMEFRAME_SECONDS[timeframe]) + 4;
  return Math.min(INITIAL_CHART_CANDLES, Math.max(MIN_REFRESH_CANDLES, missingBars));
}
