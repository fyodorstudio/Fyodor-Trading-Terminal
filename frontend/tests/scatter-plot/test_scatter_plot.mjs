import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const day = 86400000, now = Date.UTC(2015, 3, 10, 14)
const domain = './src/scatter-plot/PAIR/EURUSD/USD/NFP/'
const mount = (Component, props) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, root, render: (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}
const click = (element) => { assert.ok(element); return React.act(async () => element.dispatchEvent(new dom.MouseEvent('click', { bubbles: true }))) }
const changeInput = (element, value) => {
  assert.ok(element)
  return React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(element, String(value))
    element.dispatchEvent(new dom.Event('input', { bubbles: true }))
    element.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
}

try {
  const { nfpScatterScope } = await server.ssrLoadModule(domain + 'nfp-scatter-config.ts')
  assert.equal(nfpScatterScope.series[0].id, '840030016', 'Headline payrolls is the default series, matching Inspector ordering')
  const { nfpScatterModel: buildNfpScatterModel } = await server.ssrLoadModule(domain + 'nfp-scatter-adapter.ts')
  const { nfpMagnitudeHistory: buildNfpMagnitudeHistory, nfpHistoryReleases } = await server.ssrLoadModule('./src/inspector/magnitude/nfp-magnitude-history.ts')
  // These regressions explicitly exercise the opt-in P95 mode, never an implicit default.
  const automaticSettings = Object.fromEntries(nfpScatterScope.series.map((series) => [series.id, 'p95']))
  const nfpScatterModel = (events, now, series, release, settings = automaticSettings) => buildNfpScatterModel(events, now, series, release, settings)
  const nfpMagnitudeHistory = (events, selected, settings = automaticSettings) => buildNfpMagnitudeHistory(events, selected, settings)
  const { scatterPlotGeometry } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-plot-geometry.ts')
  const { MagnitudeScatterPlot } = await server.ssrLoadModule('./src/scatter-plot/plot/MagnitudeScatterPlot.tsx')
  const { MagnitudeCalculationDetails } = await server.ssrLoadModule('./src/scatter-plot/inspection/MagnitudeCalculationDetails.tsx')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { defaultScatterAppearance, readScatterAppearance, normalizeScatterAppearance, scatterAppearanceKey,
    magnitudeBandGuideStyles, withMagnitudeBandColor } = await server.ssrLoadModule('./src/scatter-plot/settings/scatter-plot-appearance.ts')
  assert.equal(new Set(defaultScatterAppearance.customLevels.map((level) => level.color)).size, 3, 'New defaults distinguish Small, Medium and Large')
  const legacyAppearance = normalizeScatterAppearance({ levels: defaultScatterAppearance.levels.map((level) => ({ ...level, color: '#6366f1' })) })
  assert.ok(legacyAppearance.customLevels.every((level) => level.color === '#6366f1'), 'Saved legacy colors remain compatible')
  assert.equal(withMagnitudeBandColor(defaultScatterAppearance, 0, 'invalid', true), defaultScatterAppearance)
  const unrelatedLevels = [.1, .2, .4, .5, .7, .8, .9, 1.1].map((factor, index) => ({ ...defaultScatterAppearance.levels[0], id: index + 1, factor }))
  let restoredAppearance = { ...defaultScatterAppearance, levels: unrelatedLevels }
  for (const [index, color] of ['#112233', '#445566', '#778899'].entries()) restoredAppearance = withMagnitudeBandColor(restoredAppearance, index, color, false)
  assert.deepEqual(restoredAppearance.levels.slice(0, 8), unrelatedLevels, 'P95 color shortcuts preserve every unrelated guide')
  assert.deepEqual(normalizeScatterAppearance(restoredAppearance), restoredAppearance, 'Restored canonical P95 guides survive normalization and reopen')
  assert.deepEqual(magnitudeBandGuideStyles(restoredAppearance, false).map((level) => level.color), ['#112233', '#445566', '#778899'])
  const { magnitudeDistribution, selectedMagnitudeBin } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-distribution.ts')
  const { tallyNfpMagnitudes } = await server.ssrLoadModule('./src/inspector/magnitude/nfp-magnitude-tally.ts')
  const { normalizeNfpMagnitudeSettings, readNfpMagnitudeSettings, saveNfpMagnitudeLimits, nfpMagnitudeSettingsKey } =
    await server.ssrLoadModule(domain + 'magnitude/nfp-magnitude-settings.ts')
  assert.deepEqual(normalizeNfpMagnitudeSettings({ '840030016': [1, 4, 10], '840030015': [1, 1, 2], unknown: [1, 2, 3], '840030019': [0, 2, 3] }),
    { '840030016': [1, 4, 10] }, 'Invalid/unknown series cannot enter saved scoring settings')
  for (const bad of [[0, 1, 2], [-1, 1, 2], [1, 1, 2], [3, 2, 1], [1, 2, Infinity], [1, 2]]) {
    assert.throws(() => magnitudeDistribution([1], 1, bad), RangeError)
  }
  const customDistribution = magnitudeDistribution([-11, -10, -4, -1, 0, 1, 4, 10, 11], -4, [1, 4, 10])
  assert.deepEqual(customDistribution.bins, Array(7).fill(1))
  assert.equal(customDistribution.currentSize, 'Medium')
  assert.equal(selectedMagnitudeBin(customDistribution).index, 1)
  assert.equal(customDistribution.extremeBelow, 1); assert.equal(customDistribution.extremeAbove, 1)
  for (const sign of [-1, 1]) for (const [value, size] of [[0, 'Unchanged'], [1, 'Small'], [1.000001, 'Medium'],
    [4, 'Medium'], [4.000001, 'Large'], [10, 'Large'], [10.000001, 'Extreme']]) {
    assert.equal(magnitudeDistribution([], sign * value, [1, 4, 10]).currentSize, size)
  }
  const noEarlierCustom = magnitudeDistribution([], 2, [1, 4, 10])
  assert.equal(noEarlierCustom.count, 0); assert.equal(noEarlierCustom.min, null); assert.equal(noEarlierCustom.max, null)
  assert.equal(magnitudeDistribution([], null, [1, 4, 10]).currentSize, 'Unavailable')
  localStorage.setItem(nfpMagnitudeSettingsKey, '{broken')
  assert.deepEqual(readNfpMagnitudeSettings(), {})
  localStorage.removeItem(nfpMagnitudeSettingsKey)
  assert.deepEqual(readScatterAppearance(), defaultScatterAppearance)
  localStorage.setItem(scatterAppearanceKey, '{bad-json')
  assert.deepEqual(readScatterAppearance(), defaultScatterAppearance, 'Broken saved JSON falls back safely')
  localStorage.setItem(scatterAppearanceKey, 'null')
  assert.deepEqual(readScatterAppearance(), defaultScatterAppearance)
  localStorage.removeItem(scatterAppearanceKey)
  const malformed = normalizeScatterAppearance({ dotSize: 999, dotColor: 'invalid', levels: [null,
    { id: Number.MAX_SAFE_INTEGER, factor: 1 }, { id: Number.MAX_SAFE_INTEGER, factor: 2 }, { factor: 0 }, { factor: Infinity }] })
  assert.equal(malformed.dotSize, 32)
  assert.equal(malformed.dotColor, defaultScatterAppearance.dotColor)
  assert.equal(malformed.levels.length, 2)
  assert.equal(new Set(malformed.levels.map((level) => level.id)).size, 2)
  const release = (name, at, delta, extras = {}) => nfpScatterScope.series.map((series) => ({
    value_id: `${name}-${series.id}`, event_id: series.id, name: series.label,
    currency: 'USD', country_code: 'US', country_name: 'United States', event_code: series.id,
    server_time_seconds: at / 1000 + 10800, release_at: at, chart_time_seconds: at / 1000 + 10800,
    period_seconds: at / 1000 - 30 * 86400, revision: 0, time_mode: 0, impact: 'none', importance: 'high',
    availability: 'observed', unit: series.id === '840030020' ? 3 : ['840030016', '840030023', '840030022', '840030032'].includes(series.id) ? 0 : 1,
    multiplier: ['840030016', '840030023', '840030022', '840030032'].includes(series.id) ? 1 : 0, digits: 1,
    actual: delta === null ? null : 10 + delta, previous: 10, forecast: null, revised_previous: 500,
    actual_raw_scaled_1e6: delta === null ? null : String(Math.round((10 + delta) * 1e6)), previous_raw_scaled_1e6: '10000000',
    ...extras,
  }))
  const first = release('first', Date.UTC(2015, 0, 9, 13, 30), 1)
  const second = release('second', Date.UTC(2015, 1, 6, 13, 30), 3)
  const third = release('third', Date.UTC(2015, 2, 6, 13, 30), -2)
  const partial = release('partial', Date.UTC(2015, 3, 3, 12, 30), 7).map((row, index) => index === 9 ? { ...row, actual: null, actual_raw_scaled_1e6: null } : row)
  const excluded = [
    ...release('pre2015', Date.UTC(2014, 11, 5), 999), ...release('future', now + day, 1000),
    ...release('withdrawn', Date.UTC(2015, 2, 8), 999, { availability: 'not-returned-by-latest-query' }),
    ...release('uncertain', Date.UTC(2015, 2, 9), 999, { time_mode: 1 }),
    ...release('country', Date.UTC(2015, 2, 10), 999, { country_code: 'EU' }),
    ...release('currency', Date.UTC(2015, 2, 11), 999, { currency: 'EUR' }),
  ]
  const events = [...excluded, ...partial, ...second, ...first, ...third, first[0]]
  const seriesId = nfpScatterScope.series[0].id
  const model = nfpScatterModel(events, now, seriesId, null)
  assert.equal(model.deltaUnit, 'k')
  assert.equal(nfpScatterModel(events, now, '840030015', null).deltaUnit, 'pp')
  assert.equal(nfpScatterModel(events, now, '840030020', null).deltaUnit, 'h')
  assert.equal(model.formatDelta(304.830745, 2), '+304.83k')
  assert.equal(model.formatDelta(-632.875789, 2), '-632.88k')
  assert.equal(model.formatDelta(304.830745), '+304.830745k', 'Axis rounding does not alter precise inspection values')
  assert.equal(model.inspection.at, third[0].release_at, 'Default is the latest release with all ten usable Actual/Previous readings')
  assert.equal(model.inspection.point.delta, -2)
  assert.equal(model.inspection.distribution.count, 2)
  assert.equal(model.inspection.distribution.threshold, 2.9)
  assert.deepEqual(model.points.map((point) => point.delta), [1, 3, -2, 7], 'Dates sort chronologically; unobserved, uncertain, foreign, pre-2015 and future rows are excluded')
  assert.equal(model.inspection.quantile.lower.delta, 1)
  assert.equal(model.inspection.quantile.upper.delta, 3)
  assert.equal(model.inspection.quantile.fraction, .95)
  const partialReleaseId = nfpHistoryReleases(events, now + 1).find((r) => r.releaseAt === partial[0].release_at).id
  const unavailableSeries = nfpScatterModel(events, now, '840030024', partialReleaseId)
  assert.equal(unavailableSeries.inspection.actual, null)
  assert.equal(unavailableSeries.inspection.previous, 10, 'Known Previous remains inspectable when Actual is missing')
  assert.equal(unavailableSeries.inspection.distribution.currentSize, 'Unavailable')
  const missingWithoutHistory = nfpScatterModel(partial, now, '840030024', partialReleaseId)
  const missingApp = mount(MagnitudeCalculationDetails, { model: missingWithoutHistory, seriesLabel: 'U6 Unemployment Rate' })
  await missingApp.render()
  assert.match(missingApp.container.textContent, /Previous10%.*SizeUnavailable.*Earlier readings0/,
    'A missing reading stays Unavailable even without a prior baseline, while its known Previous remains visible')
  const groups = nfpHistoryReleases(events, now + 1)
  const oldestId = groups.find((r) => r.releaseAt === first[0].release_at).id
  const oldModel = nfpScatterModel(events, now, seriesId, oldestId)
  assert.equal(oldModel.inspection.distribution, null, 'The first release never enters its own baseline')
  assert.equal(oldModel.points.length, 4, 'Later points remain visible as context, independent of the baseline')
  for (const selected of groups) for (const series of nfpScatterScope.series) {
    const current = selected.events.find((e) => e.event_id === series.id)
    assert.deepEqual(nfpScatterModel(events, now, series.id, selected.id).inspection.distribution,
      nfpMagnitudeHistory(events, selected)[current.value_id].distribution, 'Every release/series uses exactly the Inspector distribution')
  }
  const duplicate = [...events, { ...second[0], value_id: 'duplicate-period', period_seconds: second[0].period_seconds - day / 1000 }]
  assert.equal(nfpScatterModel(duplicate, now, seriesId, null).inspection.excluded, 1)
  assert.equal(nfpScatterModel(duplicate, now, seriesId, null).inspection.distribution.count, 1)
  assert.equal(nfpScatterModel(duplicate, now, seriesId, null).points.length, 3)
  const incompatible = events.map((e) => e.value_id === first[0].value_id ? { ...e, multiplier: 0 } : e)
  assert.equal(nfpScatterModel(incompatible, now, seriesId, null).inspection.distribution.count, 1)
  assert.equal(nfpScatterModel([], now, seriesId, null).inspection, null)
  assert.equal(nfpScatterModel(release('upcoming', now + day, null), now, seriesId, null).inspection, null)
  assert.equal(nfpScatterModel(events, now, 'unknown-series', null).points.length, 0)
  const zeros = nfpScatterModel([...release('zero1', first[0].release_at, 0), ...release('zero2', second[0].release_at, 0)], now, seriesId, null)
  assert.equal(zeros.inspection.distribution.threshold, 0)
  assert.equal(zeros.inspection.distribution.currentSize, 'Unchanged')
  const customSettings = Object.fromEntries(nfpScatterScope.series.map((series) => [series.id, [1, 3, 8]]))
  for (const selected of groups) for (const series of nfpScatterScope.series) {
    const current = selected.events.find((e) => e.event_id === series.id)
    const scatter = nfpScatterModel(events, now, series.id, selected.id, customSettings).inspection
    assert.deepEqual(scatter.distribution, nfpMagnitudeHistory(events, selected, customSettings)[current.value_id].distribution)
    assert.deepEqual(scatter.distribution.limits, [1, 3, 8], 'Custom boundaries stay fixed across publication dates')
    assert.equal(scatter.quantile, null, 'Custom scoring has no P95 interpolation sources')
  }
  const lastComplete = groups.find((group) => group.releaseAt === third[0].release_at)
  const customTally = tallyNfpMagnitudes(lastComplete, nfpMagnitudeHistory(events, lastComplete, customSettings))
  assert.equal(customTally.good.Medium + customTally.bad.Medium, 10, 'The tally uses the same ten custom classifications')
  const separateSeries = { [seriesId]: [10, 20, 100] }
  assert.equal(nfpScatterModel(events, now, seriesId, null, separateSeries).inspection.distribution.currentSize, 'Small')
  assert.equal(nfpScatterModel(events, now, '840030015', null, separateSeries).inspection.distribution, null)
  assert.equal(nfpScatterModel(events, now, '840030015', null, separateSeries).inspection.magnitudeMode, 'undefined')
  console.log('✓ Shared Inspector sample admission, latest-completed selection, strict prior history and exact per-series distributions')

  const geom = scatterPlotGeometry(model.points, model.inspection.distribution, false, 900, 300)
  assert.ok(geom.x(first[0].release_at) < geom.x(third[0].release_at), 'X is chronological date')
  assert.ok(geom.y(3) < geom.y(-2), 'Y increases upward with signed A−P')
  const zoomed = scatterPlotGeometry(model.points, model.inspection.distribution, true, 900, 300)
  assert.equal(zoomed.extent, 2.9 * 1.12)
  assert.equal(zoomed.pointY(7), zoomed.top)
  assert.equal(scatterPlotGeometry(zeros.points, zeros.inspection.distribution, true, 900, 300).extent, 1.12,
    'Zero-history plot padding never changes its zero magnitude threshold')
  const svgApp = mount(MagnitudeScatterPlot, { model, zoom: false, onInspect: () => {} })
  await svgApp.render()
  const yTicks = [...svgApp.container.querySelectorAll('text.scatter-plot-tick[text-anchor="end"]')].slice(0, 5)
  const svgGeometry = scatterPlotGeometry(model.points, model.inspection.distribution, false, 900, 280, model.inspection.at)
  assert.deepEqual(yTicks.map((tick) => tick.textContent), svgGeometry.deltaTicks.map((delta) => model.formatDelta(delta, 2)),
    'The production axis uses at most two decimal places while retaining exact coordinates')
  await React.act(async () => svgApp.container.querySelector('svg').dispatchEvent(new dom.PointerEvent('pointermove', {
    clientX: svgGeometry.left + 50, clientY: svgGeometry.top + 35, pointerId: 1, isPrimary: true, bubbles: true,
  })))
  const roundedCrosshair = svgApp.container.querySelector('.scatter-plot-crosshair')
  assert.equal(roundedCrosshair.querySelector('text').textContent, model.formatDelta(Number(roundedCrosshair.dataset.crosshairDelta), 2),
    'Crosshair rounding follows the same display policy as the axis')
  assert.equal(svgApp.container.querySelectorAll('[data-point-id]').length, 4)
  assert.equal(svgApp.container.querySelectorAll('[data-later="true"]').length, 1)
  assert.equal(svgApp.container.querySelector('.scatter-plot-later'), null, 'Later publications are never assigned a dimming style')
  assert.equal(svgApp.container.querySelector('[data-point-id] circle.scatter-plot-dot').getAttribute('r'), '5', 'Dots default to a larger 10px diameter')
  assert.equal(svgApp.container.querySelectorAll('[data-cutoff]').length, 6)
  assert.match(svgApp.container.textContent, /Release date \(UTC\).*A−P \/ Delta/)
  assert.equal(Number(svgApp.container.querySelector('.scatter-plot-selected').dataset.delta), -2)
  await svgApp.render({ model, zoom: true, onInspect: () => {} })
  assert.equal(svgApp.container.querySelectorAll('[data-off-scale="true"]').length, 1, 'Zoom preserves an extreme as a dated edge marker')
  console.log('✓ Scatter coordinates, zero line, signed thresholds, visible later/extreme points and view-only zoom')

  const requests = []
  globalThis.fetch = (url, options = {}) => new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
  const respond = (request, body, ok = true) => React.act(async () => request.resolve({ ok, status: ok ? 200 : 503, json: async () => body }))
  const health = (id = 'Broker-A') => ({ revision: 1, collector_error: null,
    sources: [{ id, publisher_status: 'live', server_now: now / 1000 + 10800, instance_id: 'A' }] })
  const page = (rows, id = 'Broker-A', cursor = null, revision = 1) => ({ source_id: id, revision,
    timestamp_convention: 'trade_server_time', time_basis: 'chart', event_ids: nfpScatterScope.series.map((s) => s.id),
    events: rows, coverage: { USD: { missing: [] } }, next_cursor: cursor })
  const props = { brokerId: 'Broker-A', clockOffsetMs: now - Date.now() }
  saveNfpMagnitudeLimits('840030016', 'p95')
  saveNfpMagnitudeLimits('840030015', 'p95')
  const app = mount(ScatterPlotDock, props)
  await app.render()
  for (const [label, value] of [['Pair', 'EURUSD'], ['Base/Quote', 'USD/QUOTE'], ['Family', 'NFP']]) {
    const select = app.container.querySelector(`[aria-label="Scatter Plot ${label}"]`)
    assert.equal(select.value, value); assert.equal(select.querySelectorAll('option').length, label === 'Family' ? 2 : 1)
  }
  assert.equal(app.container.querySelector('[aria-label="Scatter Plot Series"]').querySelectorAll('option').length, 10)
  await respond(requests[0], health())
  const params = new URL('http://localhost' + requests[1].url).searchParams
  assert.equal(params.get('currency'), 'USD')
  assert.equal(params.get('time_basis'), 'chart')
  assert.equal(Number(params.get('from_server_seconds')), Date.UTC(2015, 0, 1) / 1000)
  assert.deepEqual(params.get('event_ids').split(',').sort(), nfpScatterScope.series.map((s) => s.id).sort())
  await respond(requests[1], page(first, 'Broker-A', { after_time: first[0].chart_time_seconds, after_id: first.at(-1).value_id }))
  assert.equal(app.container.querySelector('svg'), null, 'Incomplete paging does not publish partial thresholds')
  await respond(requests[2], page([...second, ...third, ...partial, ...excluded]))
  assert.equal(app.container.querySelector('[data-sample-count]').textContent, '2')
  assert.equal(app.container.querySelector('.scatter-plot-inspection time').textContent, '2015-03-06')
  assert.match(app.container.querySelector('.scatter-plot-inspection').textContent, /Actual8k.*Previous10k.*A−P-2k/)
  const beforeSelection = requests.length
  await click(app.container.querySelector(`[data-point-id="${first[0].value_id}"]`))
  assert.equal(app.container.querySelector('.scatter-plot-inspection time').textContent, '2015-01-09')
  assert.equal(app.container.querySelector('[data-sample-count]').textContent, '0')
  assert.equal(app.container.querySelectorAll('[data-later="true"]').length, 3)
  const seriesSelect = app.container.querySelector('[aria-label="Scatter Plot Series"]')
  await React.act(async () => { seriesSelect.value = '840030015'; seriesSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.match(app.container.querySelector('.scatter-plot-inspection').textContent, /Unemployment Rate/)
  assert.equal(app.container.querySelector('.scatter-plot-inspection time').textContent, '2015-01-09', 'Changing series preserves the inspected publication')
  assert.equal(requests.length, beforeSelection, 'Selecting points or series does not refetch the inventory')
  await click([...app.container.querySelectorAll('button')].find((b) => b.textContent === 'Latest release'))
  assert.equal(app.container.querySelector('.scatter-plot-inspection time').textContent, '2015-03-06')
  const selectedPoint = app.container.querySelector('.scatter-plot-selected')
  await React.act(async () => selectedPoint.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
  assert.equal(app.container.querySelector('.scatter-plot-inspection time').textContent, '2015-02-06')
  await click([...app.container.querySelectorAll('button')].find((b) => b.textContent === 'P95 zoom'))
  assert.equal(app.container.querySelector('button[aria-pressed="true"]').textContent, 'Full range')

  const appearanceButton = [...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Appearance')
  await click(appearanceButton)
  const setting = (label) => app.container.querySelector(`[aria-label="${label}"]`)
  assert.ok(setting('Scatter Plot appearance'))
  const beforeAppearance = requests.length
  const sampleCount = app.container.querySelector('[data-sample-count]').textContent
  const threshold = app.container.querySelector('[data-threshold]').dataset.threshold
  const plot = app.container.querySelector('svg')
  const wheel = new dom.WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
  Object.assign(wheel, { clientX: 40, clientY: 100, ctrlKey: false, metaKey: false, shiftKey: false })
  await React.act(async () => plot.dispatchEvent(wheel))
  const viewport = { ...plot.dataset }
  await changeInput(setting('Dot diameter (px)'), 18)
  await changeInput(setting('Selected dot diameter (px)'), 24)
  assert.equal(app.container.querySelector('[data-point-id] circle.scatter-plot-dot').getAttribute('r'), '9')
  assert.match(app.container.querySelector('.scatter-plot-selected .scatter-plot-dot').getAttribute('d'), /l -12 24 h 24/, 'Edge triangles also honor the selected diameter')
  await changeInput([...setting('Scatter Plot appearance').querySelectorAll('label')].find((label) => label.textContent === 'Dot color').querySelector('input'), '#123456')
  assert.equal(plot.style.getPropertyValue('--scatter-dot-color'), '#123456')
  await changeInput(setting('Level 1 position (% of P95)'), 25)
  await changeInput(setting('Level 1 color'), '#ff8800')
  await changeInput(setting('Level 1 width (px)'), 3)
  await changeInput(setting('Level 1 shade (%)'), 22)
  let guide = app.container.querySelector('[data-guide-level="1"]')
  assert.equal(Number(guide.querySelector('[data-cutoff]').dataset.cutoff), Number(threshold) * .25)
  assert.equal(guide.querySelector('line').getAttribute('stroke'), '#ff8800')
  assert.equal(guide.querySelector('line').getAttribute('stroke-width'), '3')
  assert.equal(guide.querySelector('rect').getAttribute('fill-opacity'), '0.22')
  await changeInput(setting('Grid color'), '#abcdef')
  await changeInput(setting('Grid width (px)'), 2)
  assert.equal(app.container.querySelector('.scatter-plot-grid').getAttribute('stroke'), '#abcdef')
  assert.equal(app.container.querySelector('.scatter-plot-grid').getAttribute('stroke-width'), '2')
  await changeInput(setting('Zero line color'), '#112233')
  await changeInput(setting('Inspected date width (px)'), 4)
  assert.equal(app.container.querySelector('.scatter-plot-zero').getAttribute('stroke'), '#112233')
  assert.equal(app.container.querySelector('.scatter-plot-inspected-date').getAttribute('stroke-width'), '4')
  await click(setting('Show level 2'))
  assert.equal(app.container.querySelectorAll('[data-cutoff]').length, 4)
  assert.equal(app.container.querySelector('[data-guide-level="2"]'), null)
  await click([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Add level'))
  assert.ok(app.container.querySelector('[data-guide-level="4"]'))
  await click(setting('Remove level 3'))
  assert.equal(app.container.querySelector('[data-guide-level="3"]'), null)
  const checkbox = (name) => [...setting('Scatter Plot appearance').querySelectorAll('label')].find((label) => label.textContent === name).querySelector('input')
  await click(checkbox('Guide lines'))
  assert.equal(app.container.querySelectorAll('[data-cutoff]').length, 0)
  assert.equal(app.container.querySelectorAll('.scatter-plot-band').length, 4, 'Shading is independent of line visibility')
  await click(checkbox('Band shading'))
  assert.equal(app.container.querySelector('.scatter-plot-band'), null)
  await click(checkbox('Grid')); await click(checkbox('Zero line')); await click(checkbox('Inspected date'))
  assert.equal(app.container.querySelector('.scatter-plot-grid'), null)
  assert.equal(app.container.querySelector('.scatter-plot-zero'), null)
  assert.equal(app.container.querySelector('.scatter-plot-inspected-date'), null)
  assert.deepEqual({ ...plot.dataset }, viewport, 'Appearance editing preserves manual axis navigation')
  assert.equal(app.container.querySelector('[data-sample-count]').textContent, sampleCount)
  assert.equal(app.container.querySelector('[data-threshold]').dataset.threshold, threshold, 'Custom guides do not alter magnitude scoring')
  assert.equal(requests.length, beforeAppearance, 'Appearance editing never refetches inventory')
  const savedAppearance = JSON.parse(localStorage.getItem(scatterAppearanceKey))
  assert.equal(savedAppearance.dotSize, 18)
  assert.deepEqual(readScatterAppearance(), savedAppearance)
  await React.act(async () => dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(setting('Scatter Plot appearance'), null)
  assert.equal(document.activeElement, appearanceButton, 'Closing settings restores focus to its trigger')
  const reopened = mount(ScatterPlotDock, { brokerId: null })
  await reopened.render()
  await click([...reopened.container.querySelectorAll('button')].find((button) => button.textContent === 'Appearance'))
  assert.equal(reopened.container.querySelector('[aria-label="Dot diameter (px)"]').value, '18', 'Saved appearance survives closing/reopening the dock')
  await click([...reopened.container.querySelectorAll('button')].find((button) => button.textContent === 'Reset appearance'))
  assert.deepEqual(readScatterAppearance(), defaultScatterAppearance)
  console.log('✓ Larger undimmed dots, saved appearance controls, custom guide levels/styles, line and shading visibility, reset and unchanged scoring/viewport')

  await click(appearanceButton)
  await click([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Reset appearance'))
  await click([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Done'))
  const boundary = (label) => app.container.querySelector(`[aria-label="${label} upper boundary"]`)
  const bandColor = (label) => app.container.querySelector(`[aria-label="${label} band color"]`)
  const settingsBeforeColor = readNfpMagnitudeSettings()
  const p95ViewportBeforeColor = { ...app.container.querySelector('svg').dataset }
  const p95RequestsBeforeColor = requests.length
  assert.equal(boundary('Small').disabled, true)
  assert.equal(bandColor('Small').disabled, false, 'P95 colors remain editable beside read-only boundaries')
  await changeInput(bandColor('Small'), '#0f766e')
  assert.ok([...app.container.querySelectorAll('[data-guide-level="1"] line')].every((line) => line.getAttribute('stroke') === '#0f766e'))
  assert.ok([...app.container.querySelectorAll('[data-guide-level="1"] rect')].every((rect) => rect.getAttribute('fill') === '#0f766e'))
  assert.equal(readScatterAppearance().levels[0].color, '#0f766e')
  assert.equal(readScatterAppearance().customLevels[0].color, defaultScatterAppearance.customLevels[0].color, 'P95 colors leave Custom preferences intact')
  assert.deepEqual(readNfpMagnitudeSettings(), settingsBeforeColor)
  assert.deepEqual({ ...app.container.querySelector('svg').dataset }, p95ViewportBeforeColor)
  assert.equal(requests.length, p95RequestsBeforeColor)
  const applyBoundaries = () => [...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Apply boundaries')
  const priorThreshold = app.container.querySelector('[data-threshold]').dataset.threshold
  const beforeCustom = requests.length
  const selectMode = (value) => React.act(async () => {
    const select = app.container.querySelector('[aria-label="Magnitude mode"]')
    select.value = value; select.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await selectMode('custom')
  await changeInput(boundary('Small'), 5); await changeInput(boundary('Medium'), 2); await changeInput(boundary('Large'), 4)
  assert.ok(applyBoundaries().disabled)
  assert.equal(app.container.querySelector('[data-threshold]').dataset.threshold, priorThreshold, 'Invalid drafts never change live scoring')
  await changeInput(boundary('Small'), 1)
  await click(applyBoundaries())
  assert.deepEqual(readNfpMagnitudeSettings(), { '840030015': [1, 2, 4], [seriesId]: 'p95' })
  assert.equal(app.container.querySelector('[data-threshold]').dataset.threshold, '4')
  assert.match(app.container.querySelector('.scatter-plot-inspection').textContent, /SizeLarge.*Custom outer boundary4 pp/)
  assert.equal(app.container.querySelector('.scatter-plot-inspection details'), null)
  assert.equal(app.container.querySelector('.scatter-plot-quantile'), null)
  assert.deepEqual([...app.container.querySelectorAll('[data-cutoff]')].map((line) => Number(line.dataset.cutoff)), [1, -1, 2, -2, 4, -4])
  assert.equal(requests.length, beforeCustom, 'Applying boundaries updates models without refetching inventory')
  const customSettingsBeforeColor = readNfpMagnitudeSettings()
  const customViewportBeforeColor = { ...app.container.querySelector('svg').dataset }
  const automaticColorsBeforeShortcut = readScatterAppearance().levels
  await changeInput(boundary('Small'), .9)
  for (const [index, color] of ['#112233', '#aabbcc', '#445566'].entries()) {
    await changeInput(bandColor(['Small', 'Medium', 'Large'][index]), color)
    const guide = app.container.querySelector(`[data-guide-level="${index + 1}"]`)
    assert.ok([...guide.querySelectorAll('rect')].every((rect) => rect.getAttribute('fill') === color), 'Both signs share the selected band color')
    assert.ok([...guide.querySelectorAll('line')].every((line) => line.getAttribute('stroke') === color))
  }
  assert.equal(boundary('Small').value, '0.9', 'Color edits preserve unfinished numeric drafts')
  await changeInput(boundary('Small'), 1)
  assert.deepEqual(readNfpMagnitudeSettings(), customSettingsBeforeColor)
  assert.deepEqual(readScatterAppearance().levels, automaticColorsBeforeShortcut)
  assert.deepEqual({ ...app.container.querySelector('svg').dataset }, customViewportBeforeColor)
  assert.deepEqual([...app.container.querySelectorAll('[data-cutoff]')].map((line) => Number(line.dataset.cutoff)), [1, -1, 2, -2, 4, -4])
  assert.equal(requests.length, beforeCustom)
  await click(appearanceButton)
  assert.equal(setting('Level 1 position (% of P95)'), null, 'Custom guide positions come from the scoring boundaries')
  assert.equal([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Add level'), undefined)
  const automaticStylesBeforeCustom = readScatterAppearance().levels
  await changeInput(setting('Level 1 color'), '#123456')
  assert.deepEqual(readScatterAppearance().levels, automaticStylesBeforeCustom, 'Custom styling preserves automatic guide preferences')
  assert.equal(app.container.querySelector('[data-guide-level="1"] line').getAttribute('stroke'), '#123456')
  assert.equal(bandColor('Small').value, '#123456', 'Appearance and inline color boxes edit the same saved styles')
  assert.equal(app.container.querySelector('[data-threshold]').dataset.threshold, '4', 'Styling never changes configured scoring')
  await click([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Done'))
  await click(app.container.querySelector(`[data-point-id="${first[1].value_id}"]`))
  assert.match(app.container.querySelector('.scatter-plot-inspection').textContent, /SizeSmall.*Earlier readings0.*Custom outer boundary4 pp/)
  await click([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Latest release'))
  assert.match(app.container.querySelector('.scatter-plot-inspection').textContent, /SizeMedium.*Custom outer boundary4 pp/)
  await React.act(async () => { seriesSelect.value = seriesId; seriesSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.match(app.container.querySelector('.scatter-magnitude-source').textContent, /P95/)
  await selectMode('custom')
  await changeInput(boundary('Small'), 10); await changeInput(boundary('Medium'), 20); await changeInput(boundary('Large'), 100)
  await click(applyBoundaries())
  assert.deepEqual(readNfpMagnitudeSettings(), { '840030015': [1, 2, 4], [seriesId]: [10, 20, 100] })
  await React.act(async () => { seriesSelect.value = '840030015'; seriesSelect.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.deepEqual(['Small', 'Medium', 'Large'].map((label) => boundary(label).value), ['1', '2', '4'])
  const remounted = mount(ScatterPlotDock, props)
  let remountStart = requests.length
  await remounted.render()
  await respond(requests[remountStart], health())
  await respond(requests[remountStart + 1], page(events))
  assert.match(remounted.container.querySelector('.scatter-plot-inspection').textContent, /Custom outer boundary100k/,
    'Saved settings apply when reopening the dock')
  assert.equal(remounted.container.querySelector('[aria-label="Small band color"]').value, '#123456', 'Band colors persist across series and dock reopen')
  assert.equal(remounted.container.querySelector('[aria-label="Medium band color"]').value, '#aabbcc')
  await React.act(async () => saveNfpMagnitudeLimits(seriesId, [1, 4, 10]))
  assert.equal(app.container.querySelector('[data-threshold]').dataset.threshold, '4', 'Updating one series does not change another')
  assert.equal(remounted.container.querySelector('[data-threshold]').dataset.threshold, '10', 'All mounted consumers receive shared updates')
  await React.act(async () => { saveNfpMagnitudeLimits(seriesId, null); saveNfpMagnitudeLimits('840030015', null) })
  assert.match(app.container.querySelector('.scatter-magnitude-source').textContent, /Undefined/)
  assert.equal(remounted.container.querySelector('[data-threshold]'), null)
  assert.equal(remounted.container.querySelector('[data-cutoff]'), null)
  assert.ok(remounted.container.querySelector('[data-point-id]'), 'Undefined keeps raw points visible')
  console.log('✓ Independent native-unit boundaries, inclusive ties, shared Inspector models/tally, exact blue guides, invalid drafts, persistence and live subscriptions')

  let start = requests.length
  await app.render({ ...props, brokerId: 'Broker-B' })
  assert.equal(app.container.querySelector('svg'), null)
  await respond(requests[start], health('Broker-B'))
  const stale = requests[start + 1]
  await app.render({ ...props, brokerId: 'Broker-C' })
  assert.ok(stale.signal.aborted)
  await respond(requests[start + 2], health('Broker-C'))
  await respond(requests[start + 3], page([...first, ...second, ...third], 'Broker-C'))
  await respond(stale, page(events, 'Broker-B'))
  assert.equal(app.container.querySelector('.scatter-plot-inspection time').textContent, '2015-03-06', 'Old broker responses cannot restore the old selection')
  start = requests.length
  await app.render(props)
  await respond(requests[start], health())
  await respond(requests[start + 1], page([...first, ...second, ...third]))
  assert.equal(app.container.querySelector('.scatter-plot-inspection time').textContent, '2015-03-06', 'Returning to a previous broker still defaults to its latest completed release')
  start = requests.length
  await app.render({ ...props, brokerId: 'Broker-D' })
  await respond(requests[start], health('Broker-D'))
  await respond(requests[start + 1], { ...page([...first, ...second, ...third], 'Broker-D'), coverage: { USD: { missing: [[1, 2]] } } })
  assert.match(app.container.textContent, /Partial history/)
  start = requests.length
  await app.render({ ...props, brokerId: 'Broker-E' })
  await respond(requests[start], health('Broker-E'))
  await respond(requests[start + 1], {}, false)
  assert.match(app.container.textContent, /History unavailable/)
  assert.equal(app.container.querySelector('svg'), null)
  const obsolete = requests[start + 1]
  await app.render({ ...props, brokerId: null })
  assert.ok(obsolete.signal.aborted)
  assert.match(app.container.textContent, /Scatter Plot needs calendar storage/)
  console.log('✓ Mounted controls, paged scoped inventory, point/series selection, keyboard inspection, latest reset, broker cancellation and partial/outage states')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await server.close()
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
}
