export const ids = ['840140001', '840140002', '840140003']
export const week = 7 * 86400000
export const start = Date.UTC(2025, 6, 5)
export const raw = value => value === null ? null : String(Math.round(value * 1e6))
export function reading(index, values = [200, 1.8, 200]) {
  const at = start + index * week + 5 * 86400000 + 12.5 * 3600000
  return ids.map((id, i) => ({ value_id: `${index}:${id}`, event_id: id, name: id, event_code: id,
    currency: 'USD', country_code: 'US', country_name: 'United States', release_at: at,
    server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800,
    period_seconds: (start + (index - (i === 1 ? 1 : 0)) * week) / 1000,
    revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: 0, multiplier: i === 1 ? 2 : 1, digits: i === 1 ? 3 : 0,
    actual: values[i], previous: i === 1 ? 1.8 : 200, revised_previous: null, forecast: 999,
    actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(i === 1 ? 1.8 : 200) }))
}
export const history = Array.from({ length: 52 }, (_, i) => {
  const value = [-10, -5, 0, 5, 10][i % 5]
  return reading(i, [200 + value, 1.8 + value / 1000, 200 + value])
}).flat()
export const flat = Array.from({ length: 52 }, (_, i) => reading(i)).flat()
export const settings = Object.fromEntries(['initial-trend', 'continuing-pressure', 'initial-week'].map(id => [id, [5, 10, 20]]))
