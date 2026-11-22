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
  const original = { ...p.defaultMacroPreferences, enabled: false, activeCurrency: 'USD', currencies: ['USD'],
    eventsByCurrency: { USD: ['rate', 'payrolls'] }, layout: { ...layout.macroLayout(p.defaultMacroPreferences), laneMode: true, laneSpacing: 35 } }
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
  for (const id of ['840030015', '999030020', '826010003', '392030007', '756040003', '124010014', '36010006', '554010014']) {
    assert.equal(Object.values(macroCatalog).find(definition => definition.eventId === id).lowerIsStronger, true)
  }
  const alreadySelected = 'NZD:NZ:554040002'
  const upgradeBase = p.setMacroEvents({ ...expanded, essentialsVersion: 1 }, 'NZD', [alreadySelected])
  upgradeBase.series[alreadySelected] = { ...upgradeBase.series[alreadySelected], visible: false, color: '#123456', numbersVisible: false }
  const upgraded = applyMacroEssentials(upgradeBase)
  assert.deepEqual(upgraded.eventsByCurrency.NZD, [alreadySelected, 'NZD:NZ:554010001'], 'Add default releases without restoring deleted original rows')
  assert.deepEqual(upgraded.series[alreadySelected], upgradeBase.series[alreadySelected])
  assert.deepEqual(upgraded.currencyViews, upgradeBase.currencyViews)
  assert.equal(applyMacroEssentials(upgraded), upgraded, 'The migration is one-time')
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
  p.saveMacroPreferences(original)
  const { useMacroIndicator } = await server.ssrLoadModule('./src/market-data/indicators/macro/useMacroIndicator.ts')
  let view
  function Harness() { const next = useMacroIndicator('EURUSD', null); React.useLayoutEffect(() => { view = next }, [next]); return null }
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.equal(view.macroPreferences.essentialsVersion, 2)
  await React.act(async () => view.changeMacro(p.setMacroEvents(view.macroPreferences, 'USD', ['rate'])))
  await React.act(async () => root.render(null))
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.deepEqual(view.macroPreferences.eventsByCurrency.USD, ['rate'], 'A later deletion survives remount; essentials are applied once')
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
  let pathPoints = []
  const operations = [], context = new Proxy({ font: '', measureText: text => ({ width: text.length * 6 }),
    beginPath() { pathPoints = [] }, moveTo: (...args) => pathPoints.push(['move', ...args]), lineTo: (...args) => pathPoints.push(['line', ...args]),
    stroke() { operations.push(['stroke', context.strokeStyle, context.globalAlpha, [...pathPoints]]) },
    fill() { operations.push(['fill', context.fillStyle, [...pathPoints]]) },
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
  const rateY = 12 + layout.macroLanes(preferences).groups.flatMap(group => group.rows).find(row => row.key === 'rate').y
  assert.equal(texts[0][3], rateY, 'Historical value text is centered on its lane')
  const firstTop = parseFloat(shell.querySelector('.macro-events-row').style.top)
  preferences = layout.patchMacroLayout(preferences, { laneOffset: -10000 })
  indicator = { ...indicator, preferences }; sync(); draw()
  assert.equal(parseFloat(shell.querySelector('.macro-events-row').style.top), firstTop, 'A stale free offset cannot push a fitting Events row out of reach')
  shell.querySelector('[data-macro-event-visibility]').click(); sync(); draw()
  assert.equal(shell.querySelector('.macro-events-row').hidden, true)
  shell.querySelector('[data-macro-axis="payrolls"]').click()
  assert.equal(preferences.axisTarget, 'payrolls', 'Series selection updates the working state before a later chart frame can save older axes')
  shell.querySelector('[data-macro-visibility="rate"]').click()
  shell.querySelector('[data-macro-visibility="payrolls"]').click()
  assert.equal(preferences.series.rate.visible, false); assert.equal(preferences.series.payrolls.visible, false, 'Consecutive eye changes share the latest working state')
  const header = shell.querySelector('.macro-currency-header')
  assert.ok(header.contains(shell.querySelector('.macro-controls')), 'Currency tabs and chart actions share one toolbar row')
  const deltaButton = shell.querySelector('[data-macro-color-mode="ap-delta"]'), customButton = shell.querySelector('[data-macro-color-mode="custom"]')
  assert.equal(deltaButton.nextElementSibling, shell.querySelector('[aria-label="MFDI series drawer"]'))
  const savedColor = preferences.series.rate.color
  preferences = { ...preferences, series: { ...preferences.series, rate: { ...preferences.series.rate, visible: true, forecastVisible: true } } }
  indicator = { ...indicator, preferences, history: { rate: [
    { id: 'up', time: bars[0].time, releasedAt: bars[0].time * 1000, value: 5, previous: 4 },
    { id: 'down', time: bars[3].time, releasedAt: bars[3].time * 1000, value: 4, previous: 5 },
    { id: 'equal', time: bars[6].time, releasedAt: bars[6].time * 1000, value: 4, previous: 4 },
    { id: 'last', time: bars[8].time, releasedAt: bars[8].time * 1000, value: 3, previous: 4 },
  ] }, upcoming: [{ time: bars[9].time, releasedAt: Date.now() + 60000, metrics: ['rate'], forecasts: { rate: 3.5 } }] }; sync()
  deltaButton.click(); sync(); draw()
  assert.equal(deltaButton.getAttribute('aria-pressed'), 'true')
  assert.equal(customButton.getAttribute('aria-pressed'), 'false')
  assert.equal(preferences.series.rate.color, savedColor)
  for (const color of ['#16a34a', '#dc2626', '#6b7280']) assert.ok(operations.some(op => op[0] === 'fill' && op[1] === color), `${color}: actual box is filled`)
  const strokes = operations.filter(op => op[0] === 'stroke' && op[2] === 1)
  assert.ok(strokes.some(op => op[1] === '#16a34a' && op[3][0]?.[1] === 100 && op[3][1]?.[1] === 160), 'Green carries forward until the red release')
  assert.ok(strokes.some(op => op[1] === '#dc2626' && op[3][0]?.[1] === 260 && op[3][1]?.[1] === 280), 'The latest actual color continues up to the forecast box')
  assert.ok(strokes.some(op => op[1] === '#6b7280' && op[3][0]?.[1] === 280 && op[3][1]?.[1] === 800), 'The line after the forecast box is gray')
  assert.ok(!operations.some(op => op[0] === 'stroke' && op[1] === savedColor && op[2] === .25), 'Forecast connectors do not paint over the latest result in delta lanes')
  assert.ok(strokes.some(op => op[1] === savedColor && op[3].length === 0), 'Pending forecast markers retain their custom outline')
  preferences = { ...preferences, series: { ...preferences.series, rate: { ...preferences.series.rate, forecastVisible: false } } }
  indicator = { ...indicator, preferences }; sync(); draw()
  assert.ok(operations.some(op => op[0] === 'stroke' && op[1] === '#dc2626' && op[3][0]?.[1] === 260 && op[3][1]?.[1] === 800), 'Hiding forecasts restores the latest actual color to the right edge')
  customButton.click(); sync(); draw()
  assert.equal(customButton.getAttribute('aria-pressed'), 'true')
  assert.ok(!operations.some(op => op[0] === 'stroke' && ['#16a34a', '#dc2626', '#6b7280'].includes(op[1])))
  const uk = 'GBP:GB:826010003'
  preferences = { ...p.switchMacroCurrency(expanded, 'GBP'), colorMode: 'ap-delta',
    eventsByCurrency: { GBP: [uk] } }
  indicator = { ...indicator, preferences, upcoming: [], history: { [uk]: [
    { id: 'uk-up', time: bars[0].time, releasedAt: bars[0].time * 1000, value: 5, previous: 4, unit: 1 },
  ] } }
  sync(); draw()
  assert.ok(operations.some(op => op[0] === 'fill' && op[1] === '#dc2626'), 'Higher unemployment paints red')
  assert.ok(operations.some(op => op[0] === 'text' && op[1] === '↑5.00%'), 'The arrow still shows the actual increase')
  preferences = { ...preferences, invertUnemployment: false }
  indicator = { ...indicator, preferences }
  sync(); draw()
  assert.ok(operations.some(op => op[0] === 'fill' && op[1] === '#16a34a'), 'Toggling the setting repaints the same release green')

  const { createMacroTooltip } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-tooltip.ts')
  const tooltip = createMacroTooltip(shell)
  tooltip.show(uk, indicator.history[uk][0], undefined, String, true)
  assert.equal(tooltip.element.querySelector('[data-macro-tooltip-field="delta"]').textContent, '+1.00 pp')
  const euReading = { ...indicator.history[uk][0], revision: 1 }
  tooltip.show('EUR:EU:999030013', euReading, undefined, String)
  assert.match(tooltip.element.querySelector('strong').textContent, /Flash$/)
  tooltip.show('EUR:EU:999030013', { ...euReading, revision: 3 }, undefined, String)
  assert.match(tooltip.element.querySelector('strong').textContent, /Final$/)
  tooltip.destroy()
  viewPane.destroy()
  assert.equal(primitives.size, 0); assert.equal(lines.size, 0); assert.equal(hover.size, 0); assert.equal(clicks.size, 0); assert.equal(listeners.size, 0); assert.equal(frames.size, 0)
  console.log('✓ MFDI essentials: eight exact currency setups, one-time population, shared palette/inheritance, movable Events lane, rectangular centered values and bounded collision handling')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
