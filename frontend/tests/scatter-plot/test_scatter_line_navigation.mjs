import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const mount = (Component, props = {}) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, render: (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}
const click = (element) => { assert.ok(element); return React.act(async () => element.click()) }
const nativeProps = (element) => element[Object.getOwnPropertyNames(element).find((key) => key.startsWith('__reactProps$'))]
const change = (element, target) => React.act(async () => nativeProps(element).onChange({ target }))

try {
  const { scatterRecentWindow } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-recent-window.ts')
  const { scatterLinePath } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-line-path.ts')
  const { cpiScatterModel } = await server.ssrLoadModule('./src/scatter-plot/PAIR/EURUSD/USD/CPI/cpi-scatter-adapter.ts')
  const { cpiMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { ScatterPlotDock, scatterReleaseTarget } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { defaultScatterAppearance, normalizeScatterAppearance, readScatterAppearance, saveScatterAppearance } =
    await server.ssrLoadModule('./src/scatter-plot/settings/scatter-plot-appearance.ts')
  const { scatterPlotGeometry } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-plot-geometry.ts')
  const { InspectorPanel, useInspector } = await server.ssrLoadModule('./src/inspector/index.ts')
  const rateIds = ['840030005', '840030006', '840030007', '840030008', '840030033', '840030034']
  const dates = Array.from({ length: 15 }, (_, index) => Date.UTC(2015, index, 12, 13, 30))
  const now = dates.at(-1) + 3600000, clockOffsetMs = now - Date.now()
  const events = dates.flatMap((at, index) => cpiMagnitudeFamily.seriesIds.map((id) => ({
    value_id: `${index}-${id}`, event_id: id, name: cpiMagnitudeFamily.readingRules[id].name, currency: 'USD', country_code: 'US', country_name: 'United States',
    event_code: id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
    period_seconds: Date.UTC(2015, index - 1, 1) / 1000, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: rateIds.includes(id) ? 1 : 0, multiplier: 0, digits: rateIds.includes(id) ? 1 : 3,
    actual: 10 + (index % 3 + 1) / 10, previous: 10, forecast: 999, revised_previous: -999,
    actual_raw_scaled_1e6: String(10000000 + (index % 3 + 1) * 100000), previous_raw_scaled_1e6: '10000000',
  })))
  const releases = groupInspectorReleases(events), selected = releases[13]
  const settings = Object.fromEntries(cpiMagnitudeFamily.seriesIds.map((id) => [id, [.1, .2, .25]]))
  const model = cpiScatterModel(events, now, rateIds[0], selected.id, settings)
  const year = scatterRecentWindow(model.points, selected.releaseAt)
  assert.deepEqual(model.points.filter((point) => point.at >= year.from && point.at <= year.to).map((point) => point.at), dates.slice(1, 14),
    'Default includes selected release plus twelve predecessors, including the same release month a year earlier')
  assert.equal(model.inspection.samples.length, 15, 'Recent date window does not narrow calculation N')
  const singleton = scatterRecentWindow([], selected.releaseAt)
  assert.ok(singleton.from < selected.releaseAt && singleton.to > selected.releaseAt)
  const missingEvents = events.map((row) => row.value_id === '7-840030005' ? { ...row, actual: null } : row)
  const gap = cpiScatterModel(missingEvents, now, rateIds[0], selected.id, settings)
  assert.equal(gap.points.find((point) => point.at === dates[8]).breakBefore, true)
  assert.equal(gap.points.find((point) => point.at === dates[9]).breakBefore, false)
  const path = scatterLinePath(gap.points, (at) => dates.indexOf(at), (delta) => delta)
  assert.equal(path.match(/M /g).length, 2, 'Missing release breaks the connecting line')
  assert.ok(path.includes('0.3'), 'Line retains exact source deltas')
  assert.deepEqual(normalizeScatterAppearance({ dotSize: 18 }).connection, defaultScatterAppearance.connection, 'Old preferences gain the connecting line without changing existing sizes')
  assert.deepEqual(normalizeScatterAppearance({ connection: { color: 'invalid', width: Infinity, visible: 'yes' } }).connection, defaultScatterAppearance.connection)
  const target = scatterReleaseTarget(selected, 'Broker-A', now)
  assert.deepEqual(target, { brokerId: 'Broker-A', familyId: 'us-cpi', releaseId: selected.id, at: selected.releaseAt })
  for (const overrides of [{ releaseAt: now + 1 }, { releaseAt: null }, { chartTime: null }, { timingUncertain: true },
    { familyId: 'fomc' }, { country: 'EU' }, { currency: 'EUR' }, { releaseAt: Date.UTC(2014, 11, 31) }]) {
    assert.equal(scatterReleaseTarget({ ...selected, ...overrides }, 'Broker-A', now), null)
  }
  assert.equal(scatterReleaseTarget(selected, null, now), null)
  const nfpRelease = groupInspectorReleases([{ ...selected.events[0], event_id: '840030016', unit: 0, multiplier: 1 }])[0]
  assert.equal(scatterReleaseTarget(nfpRelease, 'Broker-A', now).familyId, 'jobs', 'The same registry admits NFP navigation')
  assert.equal(cpiScatterModel(events, now, rateIds[0], 'absent-release', settings).inspection, null, 'Explicit unavailable target never silently falls back to Latest')
  console.log('✓ Twelve predecessors plus selected date, all-N invariance, missing-reading line breaks, legacy appearance defaults and exact broker/family navigation contracts')

  for (const [id, limits] of Object.entries(settings)) cpiMagnitudeFamily.settings.save(id, limits)
  const requests = []
  globalThis.fetch = (url, options = {}) => new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
  const respond = (request, body) => { assert.ok(request); return React.act(async () => request.resolve({ ok: true, status: 200, json: async () => body })) }
  let inspector
  function LinkedDock() {
    const [dock, setDock] = React.useState('inspector')
    const [request, setRequest] = React.useState(null)
    const view = useInspector({ events, symbol: 'EURUSD', bars: [], timeframe: 'H4', timeDisplay: { mode: 'utc' }, clockOffsetMs })
    React.useEffect(() => { inspector = view }, [view])
    return dock === 'inspector' ? React.createElement(InspectorPanel, { view, symbol: 'EURUSD', source: null, error: null,
      timeDisplay: { mode: 'utc' }, scatterAvailable: !!scatterReleaseTarget(view.selectedRelease, 'Broker-A', view.now),
      onOpenScatter: (release) => { setRequest(scatterReleaseTarget(release, 'Broker-A', view.now)); setDock('scatter-plot') } }) :
      React.createElement(ScatterPlotDock, { brokerId: 'Broker-A', clockOffsetMs, target: request })
  }
  const linked = mount(LinkedDock)
  await linked.render()
  await React.act(async () => { inspector.selectCustomRange('2015-01-01', '2016-03-15'); inspector.selectRelease(selected.id) })
  const shortcut = linked.container.querySelector('[aria-label="Inspector view"]')
  assert.ok(shortcut); assert.equal(shortcut.disabled, false)
  await React.act(async () => { shortcut.value = 'scatter'; shortcut.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(linked.container.querySelector('[aria-label="Scatter Plot Family"]').value, 'CPI')
  const health = { revision: 1, collector_error: null,
    sources: [{ id: 'Broker-A', publisher_status: 'live', server_now: now / 1000 + 10800, instance_id: 'A' }] }
  const page = { source_id: 'Broker-A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: cpiMagnitudeFamily.seriesIds, events, coverage: { USD: { missing: [] } }, next_cursor: null }
  await respond(requests[0], health)
  assert.equal(new URL('http://localhost' + requests[1].url).searchParams.get('source_id'), 'Broker-A')
  await respond(requests[1], page)
  const plot = linked.container.querySelector('svg')
  const button = (label) => [...linked.container.querySelectorAll('button')].find((item) => item.textContent === label)
  const range = () => ({ from: Number(plot.dataset.dateFrom), to: Number(plot.dataset.dateTo) })
  assert.equal(linked.container.querySelector('.scatter-plot-selected').dataset.releaseId, selected.id)
  assert.equal(linked.container.querySelector('[aria-label="Scatter Plot Series"]').value, '840030005')
  assert.deepEqual(range(), year)
  assert.equal(linked.container.querySelector('[data-sample-count]').textContent, '13 / 15')
  assert.equal(linked.container.querySelectorAll('[data-point-id]').length, 15, 'Older/later observations stay available for pan and all-history view')
  const g = scatterPlotGeometry(model.points, model.inspection.distribution, true, 900, 280, model.inspection.at, {}, year)
  assert.equal(plot.querySelector('.scatter-plot-connection').getAttribute('d'), scatterLinePath(model.points, g.x, g.y),
    'Off-scale lines use actual delta coordinates and clipping, not clamped edge markers')
  assert.equal(plot.querySelector('.scatter-plot-connection').getAttribute('pointer-events'), 'none', 'Line cannot intercept point selection or gestures')
  const beforeRequests = requests.length
  const originalLimits = linked.container.querySelector('[data-threshold]').dataset.threshold
  await click(button('Appearance'))
  await change(linked.container.querySelector('[aria-label="Connect dots color"]'), { value: '#123456' })
  await change(linked.container.querySelector('[aria-label="Connect dots width (px)"]'), { valueAsNumber: 3 })
  assert.equal(plot.querySelector('.scatter-plot-connection').getAttribute('stroke'), '#123456')
  assert.equal(plot.querySelector('.scatter-plot-connection').getAttribute('stroke-width'), '3')
  assert.deepEqual(range(), year)
  assert.equal(readScatterAppearance().connection.color, '#123456')
  assert.ok(Object.isFrozen(readScatterAppearance().connection))
  const checkbox = [...linked.container.querySelectorAll('.scatter-appearance-line label')].find((label) => label.textContent === 'Connect dots').querySelector('input')
  await click(checkbox)
  assert.equal(plot.querySelector('.scatter-plot-connection'), null)
  await click(checkbox)
  await click(button('Done'))
  await click(button('All history'))
  assert.ok(range().from < year.from)
  assert.equal(linked.container.querySelector('.scatter-plot-selected').dataset.releaseId, selected.id)
  assert.equal(linked.container.querySelector('[data-threshold]').dataset.threshold, originalLimits)
  await click(button('Recent releases'))
  assert.deepEqual(range(), year)
  const wheel = async (x, y) => {
    const event = new dom.WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true })
    Object.assign(event, { clientX: x, clientY: y, ctrlKey: false, metaKey: false, shiftKey: false })
    await React.act(async () => plot.dispatchEvent(event))
  }
  await wheel(40, 100)
  const y = [plot.dataset.deltaFrom, plot.dataset.deltaTo]
  await wheel(500, 260)
  assert.notDeepEqual(range(), year)
  await click(button('Latest release'))
  const latestModel = cpiScatterModel(events, now, rateIds[0], null, settings)
  const latestWindow = scatterRecentWindow(latestModel.points, latestModel.inspection.at)
  assert.deepEqual(range(), latestWindow, 'Existing Latest release resets the recent X viewport after manual navigation')
  assert.deepEqual([plot.dataset.deltaFrom, plot.dataset.deltaTo], y, 'Latest preserves manual Y-axis adjustment')
  assert.equal(linked.container.querySelector('.scatter-plot-selected').dataset.releaseId, releases.at(-1).id)
  assert.equal(requests.length, beforeRequests, 'Date window, appearance and Latest reuse loaded all-history data')
  const frozen = readScatterAppearance()
  await React.act(async () => { saveScatterAppearance(defaultScatterAppearance); saveScatterAppearance(frozen) })
  assert.equal(readScatterAppearance().connection.width, 3)

  const beforeMissing = requests.length
  const missing = mount(ScatterPlotDock, { brokerId: 'Broker-A', clockOffsetMs, target: { ...target, releaseId: 'absent-release' } })
  await missing.render()
  await respond(requests[beforeMissing], health)
  await respond(requests[beforeMissing + 1], page)
  assert.match(missing.container.textContent, /Requested release is unavailable/)
  assert.equal(missing.container.querySelector('svg'), null)
  await click([...missing.container.querySelectorAll('button')].find((item) => item.textContent === 'Latest release'))
  assert.equal(missing.container.querySelector('.scatter-plot-selected').dataset.releaseId, releases.at(-1).id)
  console.log('✓ Inspector shortcut opens exact CPI release/series; connecting-line controls, recent/all date windows, Latest X reset, preserved Y and unavailable-target recovery')
} finally {
  for (const root of roots) await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
