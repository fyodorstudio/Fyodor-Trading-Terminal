export const settings = { cpi: {}, nfp: {}, services: {}, manufacturing: {}, retail: {}, claims: {} }
export const families = ['jobs', 'us-cpi', 'claims', 'ism-manufacturing', 'ism-services', 'retail']
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
export const claims = (index, values = [220, 1.8, 220]) => {
  const reference = Date.UTC(2015, 0, 3) + index * 7 * 86400000, at = reference + 5 * 86400000 + 12.5 * 3600000
  return ['840140001', '840140002', '840140003'].map((id, i) => ({ ...cpi(2015, 0, [0, 0, 0])[0],
    value_id: `claims:${index}:${id}`, event_id: id, name: id, event_code: id,
    release_at: at, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800,
    period_seconds: (reference - (i === 1 ? 7 * 86400000 : 0)) / 1000, unit: 0, multiplier: i === 1 ? 2 : 1,
    actual: values[i], previous: i === 1 ? 1.8 : 220, actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(i === 1 ? 1.8 : 220) }))
}
export const history = [...Array.from({ length: 40 }, (_, i) => [
  ...cpi(2015, i, [.1 + i % 4 * .1, .1 + (i + 1) % 4 * .1, 3 + i % 3 * .1]),
  ...nfp(2015, i, [100 + i % 4 * 50, 4 + i % 3 * .1, 62.3, .1 + i % 4 * .1, 34.2 + i % 3 * .1]),
  ...ism('manufacturing', 2015, i, [55, 51 + i % 5, 51 + (i + 1) % 5, 51 + (i + 2) % 5]),
  ...ism('services', 2015, i, [55, 51 + i % 5, 51 + (i + 1) % 5, 51 + (i + 2) % 5, 51 + (i + 3) % 5]),
  ...retail(2015, i, [.1 + i % 4 * .1, .2, .1 + i % 4 * .1, .1 + i % 4 * .1, 3]),
]).flat(), ...Array.from({ length: 178 }, (_, i) => claims(i, [210 + i % 5 * 5, 1.79 + i % 5 * .005, 210 + i % 5 * 5])).flat()]
export const latestRows = [...cpi(2018, 4, [.1, .1, 2.9]), ...nfp(2018, 4, [20, 4.3, 62.3, .1, 34.2]),
  ...ism('manufacturing', 2018, 4, [55, 56, 57, 57]), ...ism('services', 2018, 4, [55, 53, 53, 53, 53]),
  ...retail(2018, 4, [.1, .1, .1, .1, 3]), ...claims(178, [240, 1.85, 235]), ...claims(179, [245, 1.86, 240])]
