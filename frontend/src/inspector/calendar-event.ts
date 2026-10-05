export type EconomicCalendarEvent = {
  value_id: string
  event_id: string
  server_time_seconds: number
  release_at: number | null
  period_seconds: number
  revision: number
  currency: string
  country_code: string
  country_name: string
  name: string
  event_code: string
  importance: 'none' | 'low' | 'medium' | 'high'
  unit: number
  multiplier: number
  digits: number
  time_mode: number
  impact: 'none' | 'positive' | 'negative'
  actual: number | null
  forecast: number | null
  previous: number | null
  revised_previous: number | null
  // Optional exact MT5 values; live feeds can omit these, storage preserves them.
  actual_raw_scaled_1e6?: string | null
  previous_raw_scaled_1e6?: string | null
  forecast_raw_scaled_1e6?: string | null
  revised_previous_raw_scaled_1e6?: string | null
}

