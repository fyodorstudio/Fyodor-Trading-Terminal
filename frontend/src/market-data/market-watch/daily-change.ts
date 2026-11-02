export type DailyRecord = { open: number | null; high: number | null; low: number | null; checked_at: number }
export type DailySnapshot = { source_id: string; generation: number; day: number; observed_at: number; symbols: Record<string, DailyRecord> }

/** Largest excursion from the daily open. Equal excursions use the upward sign. */
export function maximumDailyChange(open: number | null | undefined, high: number | null | undefined, low: number | null | undefined) {
  if (open == null || high == null || low == null || ![open, high, low].every(value => Number.isFinite(value) && value > 0)
    || low > open || high < open) return null
  const up = (high - open) / open * 100, down = (low - open) / open * 100
  return Math.abs(down) > up ? down : up
}
