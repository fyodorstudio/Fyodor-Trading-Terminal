import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Node: dom.Node,
  getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let sequence = 0
const frames = new Map()
dom.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
dom.cancelAnimationFrame = id => frames.delete(id)
const flush = () => { for (let n = 0; frames.size && n < 8; n++) { const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn()) } }
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
try {
  const p = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  const { macroCatalog } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-catalog.ts')
  const { macroEssentials, applyMacroEssentials, setMacroCategoryColor } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-essentials.ts')
  const { macroEventRowKey } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-event-key.ts')
  const layout = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-layout.ts')
  const presets = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-presets.ts')
  const original = { ...p.defaultMacroPreferences, enabled: false, activeCurrency: 'USD', currencies: ['USD'],
    eventsByCurrency: { USD: ['rate', 'payrolls'] }, layout: { ...layout.macroLayout(p.defaultMacroPreferences), laneMode: true, laneSpacing: 35, rowOffsets: { rate: 10 } } }
  const before = JSON.stringify(original), expanded = applyMacroEssentials(original)
  assert.equal(JSON.stringify(original), before, 'Population never mutates the original setup')
  for (const [currency, groups] of Object.entries(macroEssentials)) {
    const active = p.switchMacroCurrency(expanded, currency)
    const keys = p.selectedMacroMetrics(active)
    assert.equal(keys.length, new Set(Object.values(groups).flat()).size)
    for (const [category, ids] of Object.entries(groups)) for (const id of ids) {
      const key = keys.find(key => macroCatalog[key].eventId === id)
      assert.ok(key, `${currency} ${id} exists in its tab`)
      assert.equal(layout.macroCategory(active, key), category)
      assert.ok(active.series[key].numbersVisible)
    }
    assert.equal(layout.macroCategory(active, macroEventRowKey), 'uncategorized')
  }
  assert.equal(expanded.layout.laneSpacing, 35)
  const oldRate = layout.macroLanes(original).groups.flatMap(group => group.rows).find(row => row.key === 'rate')
  const newRate = layout.macroLanes(expanded).groups.flatMap(group => group.rows).find(row => row.key === 'rate')
  assert.equal(newRate.y, oldRate.y, 'Existing lane anchors survive new selections')
  const recolored = setMacroCategoryColor(expanded, 'inflation', '#aa1122')
  for (const [key, style] of Object.entries(recolored.series)) {
    if (layout.macroCategory(recolored, key) === 'inflation') assert.equal(style.color, '#aa1122')
    else assert.deepEqual(style, expanded.series[key])
  }
  const extra = Object.keys(macroCatalog).find(key => macroCatalog[key].currency === 'USD' && macroCatalog[key].category === 'inflation' && !expanded.series[key])
  assert.ok(extra)
  const added = p.setMacroEvents(recolored, 'USD', [...recolored.eventsByCurrency.USD, extra])
  assert.equal(added.series[extra].color, '#aa1122', 'New events inherit the shared category color')
  const moved = layout.moveMacroRow(expanded, macroEventRowKey, 'growth')
  assert.ok(layout.macroLanes(moved).groups.find(group => group.id === 'growth').keys.includes(macroEventRowKey))
  assert.ok(!p.selectedMacroMetrics(moved).includes(macroEventRowKey), 'The Events row never becomes a numerical series')
  assert.deepEqual(presets.validateMacroSnapshot(moved), moved)
  assert.throws(() => presets.validateMacroSnapshot({ ...moved, numberPlacement: 'capsule' }))
  assert.throws(() => presets.validateMacroSnapshot({ ...moved, categoryColors: { inflation: 'red' } }))
  p.saveMacroPreferences(original)
  const { useMacroIndicator } = await server.ssrLoadModule('./src/market-data/indicators/macro/useMacroIndicator.ts')
  let view
  function Harness() { const next = useMacroIndicator('EURUSD', null); React.useLayoutEffect(() => { view = next }, [next]); return null }
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.equal(view.macroPreferences.essentialsVersion, 1)
  const backup = presets.readMacroPresets().find(item => item.id === 'before-mfdi-essentials-v1')
  assert.deepEqual(backup.preferences.eventsByCurrency, original.eventsByCurrency)
  assert.deepEqual(backup.preferences.series, original.series)
  await React.act(async () => view.changeMacro(p.setMacroEvents(view.macroPreferences, 'USD', ['rate'])))
  await React.act(async () => root.render(null))
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.deepEqual(view.macroPreferences.eventsByCurrency.USD, ['rate'], 'A later deletion survives remount; essentials are applied once')
  assert.equal(presets.readMacroPresets().length, 1, 'The original backup is never overwritten or duplicated')
  await React.act(async () => root.render(null))

  const { createMacroPane } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-pane.ts')
  const shell = document.createElement('div'); host.append(shell)
  shell.style.setProperty('--surface-panel', '#ffffff')
  const start = Date.parse('2026-01-01T00:00:00Z') / 1000, primitives = new Set(), hover = new Set(), clicks = new Set(), listeners = new Set(), scales = new Map(), lines = new Set()
  const scale = { getVisibleRange: () => ({ from: start, to: start + 3600 * 9 }), timeToCoordinate: time => 100 + (time - start) / 3600 * 20,
    timeToIndex: () => 0, logicalToCoordinate: index => 100 + index * 20,
    subscribeVisibleLogicalRangeChange: fn => listeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => listeners.delete(fn),
    subscribeSizeChange: fn => listeners.add(fn), unsubscribeSizeChange: fn => listeners.delete(fn) }
  const pane = { setStretchFactor() {}, getHeight: () => 400, getHTMLElement: () => null, paneIndex: () => 1,
    addSeries(_, initial) { let options = { ...initial }; const line = { applyOptions: next => { options = { ...options, ...next } }, options: () => options, setData() {}, priceToCoordinate: value => 100 - value * 5 }; lines.add(line); return line },
    priceScale(id) { if (!scales.has(id)) { let auto = true; scales.set(id, { options: () => ({ autoScale: auto }), getVisibleRange: () => null, setVisibleRange() {}, setAutoScale: value => { auto = value }, applyOptions() {} }) } return scales.get(id) },
    attachPrimitive: primitive => { primitives.add(primitive); primitive.attached({ requestUpdate() {} }) }, detachPrimitive: primitive => primitives.delete(primitive) }
  const chart = { chartElement: () => shell, addPane: () => pane, panes: () => [{ setStretchFactor() {} }, pane], timeScale: () => scale,
    paneSize: () => ({ width: 800, height: 400 }), removeSeries: line => lines.delete(line), removePane() {},
    subscribeCrosshairMove: fn => hover.add(fn), unsubscribeCrosshairMove: fn => hover.delete(fn), subscribeClick: fn => clicks.add(fn), unsubscribeClick: fn => clicks.delete(fn) }
  const { paintMacroReleaseMarker, createMacroLabelLayout } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-release-markers.ts')
  const operations = [], context = new Proxy({ font: '', measureText: text => ({ width: text.length * 6 }),
    save() {}, restore() {}, rect: (...args) => operations.push(['rect', ...args]), ellipse: () => assert.fail('Markers must be rectangles'),
    fillText: (...args) => operations.push(['text', ...args]) }, { get: (target, key) => key in target ? target[key] : () => {} })
  paintMacroReleaseMarker(context, 100, 50, '4.35%', '#dc2626', true)
  assert.deepEqual(operations.find(item => item[0] === 'text').slice(1, 4), ['4.35%', 100, 50])
  paintMacroReleaseMarker(context, 100, 50, '4.35%', '#16a34a', true)
  assert.equal(context.fillStyle, '#111827', 'Green markers choose readable dark text using relative luminance')
  const labels = createMacroLabelLayout()
  assert.ok(labels.claim({ x: 100, y: 50, rx: 20, ry: 8 }, 800, 400))
  assert.equal(labels.claim({ x: 110, y: 50, rx: 20, ry: 8 }, 800, 400), false)
  assert.equal(labels.claim({ x: 2, y: 50, rx: 20, ry: 8 }, 800, 400), false)
  assert.ok(labels.claim({ x: 100, y: 100, rx: 20, ry: 8 }, 800, 400))
  assert.ok(labels.claim({ x: 100, y: 120, rx: 20, ry: 8 }, 800, 400), 'Compact neighboring lanes do not lose labels merely because they share a grid cell')
  const viewPane = createMacroPane(chart)
  let preferences = { ...original, numberPlacement: 'inside', essentialsVersion: 1, series: { ...original.series, rate: { ...original.series.rate, numbersVisible: true } } }
  const bars = Array.from({ length: 10 }, (_, i) => ({ time: start + i * 3600, open: 1, high: 1, low: 1, close: 1 }))
  const history = { rate: bars.slice(0, 3).map((bar, i) => ({ id: String(i), time: bar.time, releasedAt: bar.time * 1000, value: 4 + i / 10 })) }
  let indicator = { enabled: true, preferences, history, upcoming: [], status: '', events: [{ id: 'note', time: start, at: start * 1000, title: 'Manual note', details: '' }] }
  const sync = () => viewPane.sync(bars, indicator, 3600, String, { toggleMetric() {}, selectMetric() {}, changePreferences(next) { preferences = next; indicator = { ...indicator, preferences } } })
  sync()
  const draw = () => { operations.length = 0; for (const primitive of primitives) primitive.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: fn => fn({ context, mediaSize: { width: 800, height: 400 } }) }); flush() }
  draw()
  const texts = operations.filter(item => item[0] === 'text')
  assert.ok(texts.length > 0 && texts.length < 3, 'Dense rectangles omit overlapping labels while retaining release points')
  const rateY = 12 + layout.macroLanes(preferences).groups.flatMap(group => group.rows).find(row => row.key === 'rate').y + 10
  assert.equal(texts[0][3], rateY, 'Historical value text is centered on its lane')
  const firstTop = parseFloat(shell.querySelector('.macro-events-row').style.top)
  preferences = layout.patchMacroLayout(preferences, { rowOffsets: { ...preferences.layout.rowOffsets, [macroEventRowKey]: 30 } })
  indicator = { ...indicator, preferences }; sync(); draw()
  assert.equal(parseFloat(shell.querySelector('.macro-events-row').style.top), firstTop + 30, 'The text-event row moves with its own saved lane offset')
  shell.querySelector('[data-macro-event-visibility]').click(); sync(); draw()
  assert.equal(shell.querySelector('.macro-events-row').hidden, true)
  viewPane.destroy()
  assert.equal(primitives.size, 0); assert.equal(lines.size, 0); assert.equal(hover.size, 0); assert.equal(clicks.size, 0); assert.equal(listeners.size, 0); assert.equal(frames.size, 0)
  console.log('✓ MFDI essentials: eight exact currency setups, one-time backup/population, shared palette/inheritance, movable Events lane, rectangular centered values and bounded collision handling')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
