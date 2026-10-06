import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'

const seconds: Record<ChartTimeframe, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 }
// End is exclusive: a publication at the next candle's open belongs to that candle.
// Chart times are broker wall-clock coordinates, distinct from UTC release times.
export function candleContextCutoff(open: number, timeframe: ChartTimeframe, now: number, brokerOffsetSeconds: number) {
  return Math.min((open + seconds[timeframe]) * 1000 - 1, now + brokerOffsetSeconds * 1000)
}
