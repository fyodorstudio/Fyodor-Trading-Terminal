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
}

