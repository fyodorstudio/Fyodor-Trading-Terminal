export const ids = ['840020010', '840020011', '840020012', '840020021', '840020025']
export const raw = value => value === null ? null : String(Math.round(value * 1e6))
export function reading(year, month, values = [.2, .2, .2, .2, 3]) {
  const at = Date.UTC(year, month + 1, 17, 12, 30), period = Date.UTC(year, month, 1) / 1000
  return ids.map((id, i) => ({ value_id: `${period}:${id}`, event_id: id, name: id, event_code: id,
    currency: 'USD', country_code: 'US', country_name: 'United States', release_at: at,
    server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800,
    period_seconds: period, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: 1, multiplier: 0, digits: 1, actual: values[i], previous: .2, revised_previous: null, forecast: 999,
    actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(.2) }))
}
export const history = Array.from({ length: 132 }, (_, i) => {
  const cycle = [-.3, 0, .1, .4, .8], value = cycle[i % cycle.length]
  return reading(2015 + Math.floor(i / 12), i % 12, [value, value, value, value, 3])
}).flat()
export const withMonths = values => [...history, ...[3, 4, 5].flatMap((month, i) => reading(2026, month, [values[i], values[i], values[i], values[i], 3]))]
export const settings = Object.fromEntries(['control-pace', 'ex-autos-gas-pace', 'headline-pace'].map(id => [id, [.1, .2, .3]]))
