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
  const { nfpScatterModel } = await server.ssrLoadModule(domain + 'nfp-scatter-adapter.ts')
  const { nfpMagnitudeHistory, nfpHistoryReleases } = await server.ssrLoadModule('./src/inspector/magnitude/nfp-magnitude-history.ts')
  const { scatterPlotGeometry } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-plot-geometry.ts')
  const { MagnitudeScatterPlot } = await server.ssrLoadModule('./src/scatter-plot/plot/MagnitudeScatterPlot.tsx')
  const { MagnitudeCalculationDetails } = await server.ssrLoadModule('./src/scatter-plot/inspection/MagnitudeCalculationDetails.tsx')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { defaultScatterAppearance, readScatterAppearance, normalizeScatterAppearance, scatterAppearanceKey } = await server.ssrLoadModule('./src/scatter-plot/settings/scatter-plot-appearance.ts')
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
  const app = mount(ScatterPlotDock, props)
  await app.render()
  for (const [label, value] of [['Pair', 'EURUSD'], ['Base/Quote', 'USD/QUOTE'], ['Family', 'NFP']]) {
    const select = app.container.querySelector(`[aria-label="Scatter Plot ${label}"]`)
    assert.equal(select.value, value); assert.equal(select.querySelectorAll('option').length, 1)
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
