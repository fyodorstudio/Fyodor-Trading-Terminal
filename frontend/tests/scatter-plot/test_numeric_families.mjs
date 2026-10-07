import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const mount = (Component, props) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, render: (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}
const change = (element, value) => React.act(async () => {
  assert.ok(element)
  const props = element[Object.getOwnPropertyNames(element).find((key) => key.startsWith('__reactProps$'))]
  if (props?.onChange) props.onChange({ target: { value: String(value) } })
  else { element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true })) }
})
const click = (element) => React.act(async () => { assert.ok(element); element.click() })
const requests = []
globalThis.fetch = (url, options = {}) => new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
const respond = (request, body) => React.act(async () => { assert.ok(request); request.resolve({ ok: true, json: async () => body }) })
const at = Date.UTC(2026, 9, 1, 12), now = at + 1000, clockOffsetMs = now - Date.now()

try {
  const { magnitudeFamilies: families, expandedMagnitudeFamilies: expanded } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { inspectorFamilies, groupInspectorReleases, hasRevisedPreviousChange, inspectorDelta, defaultInspectorPreferences, readInspectorPreferences, inspectorStorageKey } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { gradeFamilyReading, revisedFamilyComparison } = await server.ssrLoadModule('./src/inspector/grading/reading-grading.ts')
  const { familyMagnitudeHistory, scaledMagnitudeDelta } = await server.ssrLoadModule('./src/inspector/magnitude/family-magnitude-history.ts')
  const { familyScatterModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/family-scatter-model.ts')
  const { InspectorFiltersModal } = await server.ssrLoadModule('./src/inspector/InspectorFiltersModal.tsx')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { scatterReleaseTarget } = await server.ssrLoadModule('./src/scatter-plot/navigation/scatter-release-target.ts')
  const { normalizeCurrencyColors, currencyColorStyle } = await server.ssrLoadModule('./src/inspector/currency-colors.ts')
  const { exportWorkspace, parseWorkspaceSnapshot, restoreWorkspace } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  assert.equal(families.length, 19)
  assert.equal(new Set(families.map((family) => family.settings.key)).size, families.length)
  for (const option of inspectorFamilies) {
    assert.equal(families.some((family) => family.familyId === option.id), !['fed-chair', 'ecb-president'].includes(option.id), option.id)
  }
  const row = (family, id = family.seriesIds[0], time = at, overrides = {}) => ({
    value_id: `${time}-${id}`, event_id: id, name: family.readingRules[id].name,
    currency: family.currency, country_code: family.country, country_name: family.country, event_code: id,
    server_time_seconds: time / 1000 + 10800, chart_time_seconds: time / 1000 + 10800, release_at: time,
    period_seconds: 0, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: 1, multiplier: 0, digits: 3, actual: 2.5, previous: 2, revised_previous: 2.25, forecast: 999, ...overrides,
  })
  for (const family of expanded) for (const id of family.seriesIds) {
    const current = row(family, id), earlier = row(family, id, at - 86400000)
    const selected = groupInspectorReleases([current])[0]
    const settings = { [id]: family.deltaScale === 100 ? [25, 50, 100] : [.25, .5, 1] }
    const events = [earlier, current, row(family, id, at + 86400000)]
    const history = familyMagnitudeHistory(events, selected, family, settings, now)
    const model = familyScatterModel(events, now, id, null, family, settings)
    assert.ok(model.inspection, `${family.familyId}/${id}: latest usable series can stand alone`)
    assert.equal(model.inspection.releaseId, selected.id)
    assert.equal(model.inspection.delta, family.deltaScale === 100 ? 50 : .5)
    assert.equal(model.points.length, 2)
    assert.equal(history[current.value_id].count, 2)
    assert.equal(history[current.value_id].earlierCount, 1)
    assert.deepEqual(history[current.value_id].distribution, model.inspection.distribution)
    assert.equal(model.inspection.distribution.currentSize, 'Medium')
    if (family.deltaScale === 100) { assert.equal(model.deltaUnit, 'bp'); assert.equal(model.formatDelta(25), '+25 bp') }
    assert.equal(gradeFamilyReading(current, family.familyId, family).grade, 'higher')
    assert.equal(gradeFamilyReading({ ...current, actual: 1 }, family.familyId, family).grade, 'lower')
    assert.equal(revisedFamilyComparison(current, family.familyId, family).delta, .25)
    assert.equal(revisedFamilyComparison({ ...current, revised_previous: 0 }, family.familyId, family).grade, 'higher')
    assert.equal(revisedFamilyComparison({ ...current, revised_previous: current.previous }, family.familyId, family), null,
      `${family.familyId}/${id}: repeated Previous hides A−RevP`)
    assert.equal(hasRevisedPreviousChange({ ...current, previous: 0, revised_previous: 0 }), false)
    assert.equal(hasRevisedPreviousChange({ ...current, previous: null }), true)
    assert.equal(hasRevisedPreviousChange({ ...current, revised_previous: current.previous,
      previous_raw_scaled_1e6: '02000000', revised_previous_raw_scaled_1e6: '+2000000' }), false)
    const preciseRevision = { ...current, previous: 9000000000000, revised_previous: 9000000000000,
      actual: 9000000000000, previous_raw_scaled_1e6: '9000000000000000000',
      revised_previous_raw_scaled_1e6: '9000000000000000001', actual_raw_scaled_1e6: '9000000000000000002' }
    assert.equal(hasRevisedPreviousChange(preciseRevision), true, 'Distinct exact revisions survive rounded numeric fields')
    assert.equal(revisedFamilyComparison(preciseRevision, family.familyId, family).delta, .000001)
    assert.equal(revisedFamilyComparison({ ...current, revised_previous: null }, family.familyId, family), null)
    assert.equal(revisedFamilyComparison({ ...current, revised_previous: NaN }, family.familyId, family), null)
    assert.equal(revisedFamilyComparison({ ...current, country_code: 'XX' }, family.familyId, family), null)
    assert.equal(gradeFamilyReading({ ...current, event_id: 'unknown' }, family.familyId, family).grade, 'unrated')
    const changed = events.map((event) => ({ ...event, revised_previous: 999, forecast: -999 }))
    assert.deepEqual(JSON.parse(JSON.stringify(familyScatterModel(changed, now, id, null, family, settings))), JSON.parse(JSON.stringify(model)),
      `${family.familyId}/${id}: revisions and forecast do not change primary samples`)
  }
  // Model functions are fresh closures; compare data fields rather than function identity.
  const claims = families.find((family) => family.familyId === 'claims')
  const precise = row(claims, undefined, at, { actual: 1234567890.123456, previous: 0,
    actual_raw_scaled_1e6: '1234567890123456', previous_raw_scaled_1e6: '0' })
  assert.equal(scaledMagnitudeDelta(precise), inspectorDelta(precise), 'Native magnitudes retain all source precision')
  const retail = families.find((family) => family.familyId === 'retail')
  const labor = families.find((family) => family.familyId === 'euro-labor')
  const wage = families.find((family) => family.familyId === 'euro-wages')
  const last = row(labor, '999030020'), first = row(labor, '999030020', at - 31 * 86400000)
  const unrelated = row(labor, '999030001', at - 10 * 86400000)
  const model = familyScatterModel([first, unrelated, last], now, '999030020', null, labor)
  assert.equal(model.inspection.at, at)
  assert.equal(model.points[1].breakBefore, false, 'Other publication schedules never break the selected series line')
  const missing = row(labor, '999030020', at - 20 * 86400000, { actual: null })
  assert.equal(familyScatterModel([first, missing, unrelated, last], now, '999030020', null, labor).points[1].breakBefore, true)
  const mixed = [row(claims, claims.seriesIds[0], at, { unit: 0, multiplier: 1, actual: 207, previous: 219, revised_previous: 218 }),
    row(claims, claims.seriesIds[1], at, { unit: 0, multiplier: 2, actual: 1.818, previous: 1.794, revised_previous: 1.787 }),
    row(claims, claims.seriesIds[2], at, { unit: 0, multiplier: 1, actual: 209.75, previous: 209.5, revised_previous: null })]
  assert.equal(familyScatterModel(mixed, now, claims.seriesIds[1], null, claims).formatDelta(.024), '+0.024M')
  const claimsSettings = { [claims.seriesIds[0]]: [5, 12, 20], [claims.seriesIds[1]]: [.01, .03, .05], [claims.seriesIds[2]]: [.1, .25, .5] }
  const retailRows = retail.seriesIds.map((id) => row(retail, id, at, { actual: 1.7, previous: .6, revised_previous: .7 }))
  const renderedRows = (container) => [...container.querySelectorAll('.inspector-table-scroll tbody tr')]
  function InspectorApp({ rows = mixed, family = claims, settings = claimsSettings }) {
    const view = useInspector({ events: rows, symbol: 'EURUSD', bars: [], timeframe: 'H1', timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, clockOffsetMs })
    return React.createElement(InspectorPanel, { view: { ...view, magnitudeHistory: {
      rows: familyMagnitudeHistory(rows, view.selectedRelease, family, settings, now), partial: false, message: null, error: null } },
      symbol: 'EURUSD', source: null, error: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter: () => {} })
  }
  const inspector = mount(InspectorApp, {})
  await inspector.render(); await click(inspector.container.querySelector('.inspector-release'))
  let rows = renderedRows(inspector.container)
  assert.match(rows[0].children[3].textContent, /-12kLowerA−RevP: -11kLower/)
  assert.match(rows[1].children[3].textContent, /\+0.024MHigherA−RevP: \+0.031MHigher/)
  assert.match(rows[0].lastElementChild.textContent, /Medium.*A−RevP: Medium/)
  assert.match(rows[1].lastElementChild.textContent, /Medium.*A−RevP: Large/)
  assert.equal(rows[2].querySelector('.inspector-secondary-reading'), null)
  assert.equal(inspector.container.querySelector('option[value="scoring"]').disabled, false, 'Claims now has a standalone scorer; raw table grading remains unchanged')
  await click(inspector.container.querySelector('[aria-label="Hide histogram"]'))
  assert.equal(inspector.container.querySelector('.magnitude-histogram'), null)
  assert.match(rows[0].lastElementChild.textContent, /Medium.*A−RevP: Medium/)
  for (const [family, source] of [[retail, retailRows], [wage, [row(wage)]], [families.find((f) => f.familyId === 'german-pmi'), null]]) {
    await inspector.render({ family, rows: source ?? [row(family, undefined, at, { unit: 0, actual: 50.6, previous: 50, revised_previous: 49.9 })], settings: {} })
    await click(inspector.container.querySelector('.inspector-release'))
    rows = renderedRows(inspector.container)
    assert.equal(rows[0].querySelector('.inspector-row-grade').textContent, 'Higher')
    assert.equal(rows[0].lastElementChild.getAttribute('aria-label'), 'Magnitude undefined')
    assert.match(rows[0].children[3].textContent, /A−RevP/)
  }
  // Both ISM screenshots: the upstream revised field repeats Previous for every row.
  for (const familyId of ['ism-manufacturing', 'ism-services']) {
    const family = families.find((candidate) => candidate.familyId === familyId)
    const source = family.seriesIds.map((id) => row(family, id, at, {
      actual: 54.4, previous: 52.6, revised_previous: 52.6,
      unit: 0, previous_raw_scaled_1e6: '52600000', revised_previous_raw_scaled_1e6: '52600000' }))
    const settings = Object.fromEntries(family.seriesIds.map((id) => [id, [.5, 1, 2]]))
    await inspector.render({ family, rows: source, settings })
    await click(inspector.container.querySelector('.inspector-release'))
    assert.equal(inspector.container.querySelector('.inspector-secondary-reading'), null)
    assert.doesNotMatch(inspector.container.querySelector('.inspector-table-scroll tbody').textContent, /Rev:/)
    assert.ok(inspector.container.querySelector('.magnitude-size'), 'Primary magnitude stays visible')
    const revised = source.map((event) => ({ ...event, revised_previous: 52.5, revised_previous_raw_scaled_1e6: '52500000' }))
    await inspector.render({ family, rows: revised, settings })
    assert.equal(inspector.container.querySelectorAll('td.inspector-graded-delta .inspector-secondary-reading').length, source.length)
    assert.equal(inspector.container.querySelectorAll('.inspector-magnitude-cell .inspector-secondary-reading').length, source.length)
    assert.match(inspector.container.querySelector('.inspector-table-scroll tbody').textContent, /Rev: 52.5 pts/)
    await inspector.render({ family, rows: source, settings })
    assert.equal(inspector.container.querySelector('.inspector-secondary-reading'), null, 'Live removal hides delta and revised size together')
  }
  const fed = families.find((family) => family.familyId === 'fomc')
  const policyRows = [row(fed, undefined, at, { actual: 5, previous: 4.75, revised_previous: 4.5 }),
    { ...row(fed), value_id: 'speech', event_id: '840050018', name: 'Press conference', release_at: at + 1800000,
      server_time_seconds: at / 1000 + 12600, chart_time_seconds: at / 1000 + 12600, actual: null, previous: null, revised_previous: null }]
  await inspector.render({ family: fed, rows: policyRows, settings: { [fed.seriesIds[0]]: [10, 25, 50] } })
  await click(inspector.container.querySelector('.inspector-release'))
  rows = renderedRows(inspector.container)
  assert.match(rows[0].children[5].textContent, /\+25 bpHigherA−RevP: \+50 bpHigher/)
  assert.match(rows[0].lastElementChild.textContent, /Medium.*A−RevP: Large/)
  assert.equal(rows[1].lastElementChild.textContent, 'Not applicable')

  const commentaryRelease = groupInspectorReleases([policyRows[1]])[0]
  assert.equal(scatterReleaseTarget(commentaryRelease, 'Broker-A', now + 1800000), null)
  await inspector.render({ family: fed, rows: [policyRows[1]], settings: {} })
  await click(inspector.container.querySelector('.inspector-release'))
  assert.equal(inspector.container.querySelector('option[value="scatter"]').disabled, true)
  assert.equal(inspector.container.querySelector('.inspector-magnitude-cell'), null)

  // Draft identity colors remain separate from sign and magnitude colors, preview immediately and persist only on Save.
  let applied = null, savedColors = null
  const prefs = defaultInspectorPreferences()
  const modal = mount(InspectorFiltersModal, { preferences: prefs, onApply: (next, mode) => { applied = next; if (mode === 'save') savedColors = next.currencyColors }, onClose: () => {} })
  await modal.render()
  for (const name of ['Monetary policy', 'Inflation', 'Labor / wages', 'Growth / activity']) {
    const eur = document.querySelector(`[aria-label="EUR ${name}"]`).closest('fieldset')
    const usd = document.querySelector(`[aria-label="USD ${name}"]`).closest('fieldset')
    assert.equal(eur.style.gridRow, usd.style.gridRow)
    assert.equal(eur.style.gridColumn, '1'); assert.equal(usd.style.gridColumn, '2')
  }
  await change(document.querySelector('[aria-label="EUR Base color"]'), '#123456')
  await change(document.querySelector('[aria-label="USD Quote color"]'), '#654321')
  assert.equal(document.querySelector('dialog').style.getPropertyValue('--inspector-eur-color'), '#123456')
  await click([...document.querySelectorAll('dialog button')].find((b) => b.textContent === 'Cancel'))
  assert.deepEqual(applied.currencyColors, {}); assert.deepEqual(prefs.currencyColors, {})
  assert.equal(savedColors, null, 'Preview and Cancel do not persist colors')
  await click([...document.querySelectorAll('dialog button')].find((b) => b.textContent === 'Save'))
  assert.deepEqual(applied.currencyColors, { EUR: '#123456', USD: '#654321' })
  assert.deepEqual(savedColors, applied.currencyColors)
  localStorage.setItem(inspectorStorageKey, JSON.stringify(applied))
  assert.deepEqual(readInspectorPreferences().currencyColors, applied.currencyColors)
  assert.deepEqual(currencyColorStyle(applied.currencyColors), { '--inspector-eur-color': '#123456', '--inspector-usd-color': '#654321' })
  assert.deepEqual(normalizeCurrencyColors({ EUR: 'red', USD: '#abcdef', JPY: '#123456' }), { USD: '#abcdef' })
  localStorage.setItem(inspectorStorageKey, JSON.stringify({ ...prefs, currencyColors: undefined }))
  assert.deepEqual(readInspectorPreferences().currencyColors, {})
  localStorage.setItem(inspectorStorageKey, JSON.stringify(applied))
  // All new settings and identity colors survive workspace export/restore.
  await React.act(async () => { for (const family of expanded) family.settings.save(family.seriesIds[0], [1, 2, 3]) })
  const snapshot = parseWorkspaceSnapshot(JSON.stringify(exportWorkspace()))
  await React.act(async () => { for (const family of expanded) family.settings.save(family.seriesIds[0], null) })
  localStorage.removeItem(inspectorStorageKey)
  await React.act(async () => restoreWorkspace(snapshot))
  for (const family of expanded) assert.deepEqual(family.settings.read()[family.seriesIds[0]], [1, 2, 3])
  assert.deepEqual(readInspectorPreferences().currencyColors, applied.currencyColors)
  await React.act(async () => { for (const family of expanded) family.settings.save(family.seriesIds[0], null) })

  const dock = mount(ScatterPlotDock, { brokerId: 'Broker-A', clockOffsetMs, target: scatterReleaseTarget(groupInspectorReleases(mixed)[0], 'Broker-A', now) })
  await dock.render()
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Family"]').value, 'CLAIMS')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Base/Quote"]').options.length, 2)
  await respond(requests.at(-1), { revision: 1, collector_error: null, sources: [{ id: 'Broker-A', publisher_status: 'live' }] })
  let params = new URL('http://localhost' + requests.at(-1).url).searchParams
  assert.equal(params.get('currency'), 'USD'); assert.deepEqual(params.get('event_ids').split(',').sort(), claims.seriesIds.slice().sort())
  await respond(requests.at(-1), { source_id: 'Broker-A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: claims.seriesIds, events: mixed, coverage: { USD: { missing: [] } }, next_cursor: null })
  assert.equal(dock.container.querySelector('[data-sample-count]').textContent, '0 / 1')
  await change(dock.container.querySelector('[aria-label="Scatter Plot Base/Quote"]'), 'EUR/BASE')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Family"]').value, 'ECB')
  assert.equal(dock.container.querySelector('option[value="CLAIMS"]'), null)
  await change(dock.container.querySelector('[aria-label="Scatter Plot Family"]'), 'EURO-LABOR')
  await respond(requests.at(-1), { revision: 1, collector_error: null, sources: [{ id: 'Broker-A', publisher_status: 'live' }] })
  params = new URL('http://localhost' + requests.at(-1).url).searchParams
  assert.equal(params.get('currency'), 'EUR'); assert.deepEqual(params.get('event_ids').split(',').sort(), labor.seriesIds.slice().sort())
  await respond(requests.at(-1), { source_id: 'Broker-A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: labor.seriesIds, events: [first, unrelated, last], coverage: { EUR: { missing: [] } }, next_cursor: null })
  await change(dock.container.querySelector('[aria-label="Scatter Plot Series"]'), '999030020')
  assert.equal(dock.container.querySelector('[data-sample-count]').textContent, '1 / 2')
  await change(dock.container.querySelector('[aria-label="Magnitude mode"]'), 'custom')
  for (const [label, value] of [['Small', .1], ['Medium', .5], ['Large', 1]]) await change(dock.container.querySelector(`[aria-label="${label} upper boundary"]`), value)
  await click([...dock.container.querySelectorAll('button')].find((b) => b.textContent === 'Freeze'))
  assert.deepEqual(labor.settings.read()['999030020'], [.1, .5, 1])
  assert.equal(dock.container.querySelector('[aria-label="Small upper boundary"]').disabled, true)
  await click([...dock.container.querySelectorAll('button')].find((b) => b.textContent === 'Unfreeze'))
  assert.equal(dock.container.querySelector('[aria-label="Small upper boundary"]').disabled, false)
  await change(dock.container.querySelector('[aria-label="Large upper boundary"]'), 2)
  assert.deepEqual(labor.settings.read()['999030020'], [.1, .5, 1], 'Unfrozen drafts never overwrite saved magnitudes')
  console.log('✓ All 19 numeric families, native-unit magnitudes/bp rates, series-specific schedules, optional revised comparisons, stable N, live color preview/Save/Cancel/portability, aligned filter categories, EUR/USD scatter and Freeze')
} finally {
  await React.act(async () => roots.forEach((root) => root.unmount()))
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
