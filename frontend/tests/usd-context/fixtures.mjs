export const settings = { cpi: {}, nfp: {}, services: {}, manufacturing: {}, retail: {} }
export const families = ['jobs', 'us-cpi', 'ism-manufacturing', 'ism-services', 'retail']
const raw = value => value === null ? null : String(Math.round(value * 1e6))
function rows(year, month, ids, values, previous, units, day, hour = 12.5) {
  const at = Date.UTC(year, month + 1, day, Math.floor(hour), hour % 1 * 60), period = Date.UTC(year, month, 1) / 1000
  return ids.map((id, i) => ({ value_id: `${period}:${id}`, event_id: id, name: id, event_code: id,
    currency: 'USD', country_code: 'US', country_name: 'United States', server_time_seconds: at / 1000 + 10800,
    chart_time_seconds: at / 1000 + 10800, release_at: at, period_seconds: period, revision: 0, time_mode: 0,
    importance: 'high', impact: 'none', availability: 'observed', unit: units[i][0], multiplier: units[i][1], digits: 1,
    actual: values[i], previous: previous[i], forecast: 999, revised_previous: null,
    actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(previous[i]) }))
}
export const cpi = (year, month, values, previous = [.2, .2, 3]) =>
  rows(year, month, ['840030005', '840030006', '840030008'], values, previous, [[1, 0], [1, 0], [1, 0]], 12)
export const nfp = (year, month, values, previous = [150, 4.1, 62.3, .3, 34.3]) =>
  rows(year, month, ['840030016', '840030015', '840030017', '840030018', '840030020'], values, previous,
    [[4, 1], [1, 0], [1, 0], [1, 0], [3, 0]], 7).map(e => e.event_id === '840030016' ?
      { ...e, revised_previous: 130, revised_previous_raw_scaled_1e6: raw(130) } : e)
export const ism = (sector, year, month, values) => {
  const services = sector === 'services'
  const ids = services ? ['840040003', '840040005', '840040007', '840040008', '840040009'] :
    ['840040001', '840040002', '840040004', '840040006']
  return rows(year, month, ids, values, ids.map(() => 55), ids.map(() => [0, 0]), services ? 5 : 3, 14)
}
export const retail = (year, month, values) => rows(year, month,
  ['840020010', '840020011', '840020012', '840020021', '840020025'], values,
  [.2, .2, .2, .2, 3], [[1, 0], [1, 0], [1, 0], [1, 0], [1, 0]], 17)
export const history = Array.from({ length: 40 }, (_, i) => [
  ...cpi(2015, i, [.1 + i % 4 * .1, .1 + (i + 1) % 4 * .1, 3 + i % 3 * .1]),
  ...nfp(2015, i, [100 + i % 4 * 50, 4 + i % 3 * .1, 62.3, .1 + i % 4 * .1, 34.2 + i % 3 * .1]),
  ...ism('manufacturing', 2015, i, [55, 51 + i % 5, 51 + (i + 1) % 5, 51 + (i + 2) % 5]),
  ...ism('services', 2015, i, [55, 51 + i % 5, 51 + (i + 1) % 5, 51 + (i + 2) % 5, 51 + (i + 3) % 5]),
  ...retail(2015, i, [.1 + i % 4 * .1, .2, .1 + i % 4 * .1, .1 + i % 4 * .1, 3]),
]).flat()
export const latestRows = [...cpi(2018, 4, [.1, .1, 2.9]), ...nfp(2018, 4, [20, 4.3, 62.3, .1, 34.2]),
  ...ism('manufacturing', 2018, 4, [55, 56, 57, 57]), ...ism('services', 2018, 4, [55, 53, 53, 53, 53]),
  ...retail(2018, 4, [.1, .1, .1, .1, 3])]
