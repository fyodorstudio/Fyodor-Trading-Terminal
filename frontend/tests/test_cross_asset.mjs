import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), timers = new Map(), frames = new Map(), observers = new Set(), pending = []
let sequence = 0
class ResizeObserver { constructor(fn) { this.fn = fn; observers.add(this) } observe() {} disconnect() { observers.delete(this) } }
const globals = { window: dom, document: dom.document, localStorage: dom.localStorage, navigator: dom.navigator,
  HTMLElement: dom.HTMLElement, Node: dom.Node, ResizeObserver, IS_REACT_ACT_ENVIRONMENT: true, __heatmapCounts: { builds: 0, tapes: 0 } }
const previous = new Map([...Object.keys(globals), 'fetch'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v })
const originalNow = Date.now
Date.now = () => Date.parse('2026-11-12T12:00:00Z')
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
dom.cancelAnimationFrame = id => frames.delete(id)
const captures = new Set()
dom.HTMLElement.prototype.setPointerCapture = id => captures.add(id)
dom.HTMLElement.prototype.hasPointerCapture = id => captures.has(id)
dom.HTMLElement.prototype.releasePointerCapture = id => captures.delete(id)
globalThis.fetch = (url, options) => new Promise(resolve => pending.push({ url, options, body: JSON.parse(options.body), resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'heatmap-counts', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/heatmap-model.ts')) return code.replace('  const pairs = heatmapPairs(catalog), points =', '  globalThis.__heatmapCounts.builds++; const pairs = heatmapPairs(catalog), points =')
    if (id.endsWith('/HeatmapTimeline.tsx')) return code.replace('  const viewport =', '  globalThis.__heatmapCounts.tapes++; const viewport =')
  } }] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const props = node => node[Object.getOwnPropertyNames(node).find(k => k.startsWith('__reactProps$'))]
const click = node => React.act(async () => { assert.ok(node); node.click() })
const change = (node, value) => React.act(async () => props(node).onChange({ target: { value } }))
const button = label => [...host.querySelectorAll('button')].find(n => n.textContent === label)
const flush = () => React.act(async () => { for (const [id, fn] of [...frames]) { frames.delete(id); fn() } })
const stamp = day => Date.parse(`${day}T00:00:00Z`) / 1000
const bar = (day, close) => ({ time: stamp(day), open: close, close, high: close * 1.01, low: close * .99 })
const record = bars => ({ bars, availability: 'available', checked_at: Date.now() / 1000 })
const snapshot = (symbols, year = 2026) => ({ schema: 1, source_id: 'Pepperstone-Demo', generation: 2, year, today: '2026-11-12',
  observed_at: Date.now() / 1000, revision: 'a'.repeat(64), pending: 0, symbols })
const reply = (request, data) => React.act(async () => request.resolve({ ok: true, json: async () => structuredClone(data) }))
try {
  const m = await server.ssrLoadModule('./src/cross-asset/heatmap-model.ts')
  const { majorForexPairs } = await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  const catalog = [...majorForexPairs, 'US500', 'GER40', 'XAUUSD', 'SpotBrent'].map(symbol => ({ symbol, description: symbol }))
  const ids = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'].map(c => `basket:${c}`)
  const latent = c => c === 'USD' ? .07 : 0
  const symbols = Object.fromEntries(majorForexPairs.map(pair => [pair, record([bar('2026-11-05', 1), bar('2026-11-06', Math.exp(latent(pair.slice(0, 3)) - latent(pair.slice(3))))])]))
  symbols.US500 = record([bar('2026-10-30', 100), bar('2026-11-02', 110), bar('2026-11-06', 99)])
  const data = snapshot(symbols)
  assert.equal(m.validHeatmapHistory(data, 'Pepperstone-Demo', 2, 2026), true)
  for (const mutate of [v => v.generation++, v => v.symbols.EURUSD.bars[0].close = NaN, v => v.symbols.EURUSD.bars.reverse(), v => v.today = '2026-02-30']) {
    const bad = structuredClone(data); mutate(bad); assert.equal(m.validHeatmapHistory(bad, 'Pepperstone-Demo', 2, 2026), false)
  }
  const baskets = m.buildHeatmapRows(ids, catalog, 'Pepperstone-Demo', data, 'daily')
  assert.equal(baskets.length, 8)
  for (const row of baskets) {
    const expected = Math.expm1(row.id === 'basket:USD' ? .07 : -.01) * 100
    assert.ok(Math.abs(row.points.get('2026-11-06').value - expected) < 1e-10, `${row.label} geometric quote inversion`)
    assert.equal(row.points.get('2026-11-06').coverage, 7)
    assert.equal(row.points.has('2026-11-07'), false, 'Weekend never borrows Friday')
  }
  const missing = structuredClone(data); delete missing.symbols.AUDJPY
  const partial = m.buildHeatmapRows(ids, catalog, 'Pepperstone-Demo', missing, 'daily')
  assert.equal(partial.find(r => r.id === 'basket:JPY').points.get('2026-11-06').value, null)
  assert.equal(partial.find(r => r.id === 'basket:JPY').points.get('2026-11-06').coverage, 6)
  assert.notEqual(partial.find(r => r.id === 'basket:USD').points.get('2026-11-06').value, null)
  const mismatched = structuredClone(data); mismatched.symbols.USDJPY.bars[0].time -= 86400
  assert.equal(m.buildHeatmapRows(ids, catalog, 'Pepperstone-Demo', mismatched, 'daily').find(r => r.id === 'basket:USD').points.get('2026-11-06').value, null)
  const weekly = m.buildHeatmapRows(['symbol:US500'], catalog, 'Pepperstone-Demo', data, 'weekly')[0]
  assert.ok(Math.abs(weekly.points.get('2026-11-02').value + 1) < 1e-10, 'Weekly endpoints compound +10% and -10% to -1%')
  assert.equal(weekly.points.get('2026-11-02').from, '2026-10-30')
  assert.equal(m.heatmapPeriods(2026, 'weekly', '2026-11-12').find(p => p.day === '2026-11-09').partial, true)
  assert.equal(m.heatmapPeriods(2026, 'weekly', '2026-11-12')[0].day, '2025-12-29')
  assert.equal(m.heatmapPairs([{ symbol: 'EURUSD.a' }, { symbol: 'EURUSD' }]).get('EURUSD'), 'EURUSD')
  assert.deepEqual(m.heatmapRequests(['basket:USD'], catalog), majorForexPairs.filter(p => p.includes('USD')).sort())
  const long = snapshot({ US500: record(Array.from({ length: 70 }, (_, i) => bar(m.heatmapDate(Date.UTC(2026, 6, i + 1)), 100 + i + Math.sin(i)))) })
  const before = m.buildHeatmapRows(['symbol:US500'], catalog, 'Pepperstone-Demo', long, 'daily')[0]
  const day = [...before.points.keys()][40], relative = before.points.get(day).relative
  assert.ok(relative !== null)
  long.symbols.US500.bars[60].close = 10000
  assert.equal(m.buildHeatmapRows(['symbol:US500'], catalog, 'Pepperstone-Demo', long, 'daily')[0].points.get(day).relative, relative, 'Later prices never affect earlier volatility baselines')

  const { CrossAssetDock } = await server.ssrLoadModule('./src/cross-asset/CrossAssetDock.tsx')
  const quotes = catalog.map(s => ({ ...s, bid: 1, ask: 1.01, dailyChange: 99, precision: 2 }))
  const render = overrides => React.act(async () => root.render(React.createElement(CrossAssetDock, { broker: 'Pepperstone-Demo', generation: 2, symbols: quotes, ...overrides })))
  await render()
  assert.equal(pending.length, 1)
  assert.equal(pending[0].url, '/storage-api/cross-asset/history')
  assert.equal(pending[0].body.symbols.length, catalog.length)
  await reply(pending.shift(), data)
  await change(host.querySelector('[aria-label="Heatmap date"]'), '2026-11-06')
  assert.ok(host.querySelector('[data-heatmap-cell="basket:USD:2026-11-06"]').textContent.includes('+7.25%'))
  assert.ok(host.querySelector('[aria-label="Selected period ranking"]').textContent.includes('Pinned'))
  const beforeTicks = { ...globalThis.__heatmapCounts }
  await render({ symbols: quotes.map(s => ({ ...s, bid: 900, dailyChange: -80 })) })
  assert.deepEqual(globalThis.__heatmapCounts, beforeTicks, 'Live quote ticks do no heatmap calculation or tape rendering')
  assert.ok(host.querySelectorAll('[data-heatmap-cell]').length < 500, 'Both row and date windows bound mounted cells')
  const viewport = host.querySelector('.heatmap-viewport'), left = viewport.scrollLeft
  await React.act(async () => props(viewport).onPointerDown({ button: 0, isPrimary: true, pointerId: 1, clientX: 500, clientY: 0, target: viewport, currentTarget: viewport }))
  const buildCount = globalThis.__heatmapCounts.builds
  await React.act(async () => { for (let i = 0; i < 100; i++) props(viewport).onPointerMove({ pointerId: 1, clientX: 500 - i, clientY: 0, currentTarget: viewport, preventDefault() {} }) })
  assert.equal(frames.size, 1, 'Pointer bursts batch to one frame')
  await flush()
  assert.equal(viewport.scrollLeft, left + 99)
  assert.equal(globalThis.__heatmapCounts.builds, buildCount, 'Dragging never recomputes returns')
  assert.equal(pending.length, 0, 'Dragging never fetches')
  await React.act(async () => props(viewport).onPointerUp({ pointerId: 1, currentTarget: viewport }))
  const dragPointer = (type, x, y) => React.act(async () => props(viewport)[type]({
    button: 0, isPrimary: true, pointerId: 2, clientX: x, clientY: y, target: viewport, currentTarget: viewport, preventDefault() {} }))
  await dragPointer('onPointerDown', 500, 100)
  await dragPointer('onPointerMove', 500, 97)
  assert.equal(frames.size, 0, 'Small vertical pointer jitter does not start dragging')
  assert.equal(captures.size, 0)
  await dragPointer('onPointerUp', 500, 97)
  const verticalLeft = viewport.scrollLeft
  await dragPointer('onPointerDown', 500, 100)
  const tapeCount = globalThis.__heatmapCounts.tapes
  await React.act(async () => { for (let i = 0; i < 100; i++) props(viewport).onPointerMove({ pointerId: 2, clientX: 500, clientY: 100 - i * 2, currentTarget: viewport, preventDefault() {} }) })
  assert.equal(frames.size, 1, 'Vertical pointer bursts share one frame')
  assert.equal(globalThis.__heatmapCounts.tapes, tapeCount, 'Vertical pointer bursts do not render before the frame')
  await flush()
  assert.equal(viewport.scrollTop, 198, 'Vertical-only dragging scrolls instrument rows')
  assert.equal(viewport.scrollLeft, verticalLeft, 'Vertical dragging preserves the horizontal date position')
  assert.equal(globalThis.__heatmapCounts.builds, buildCount)
  assert.equal(host.querySelector('[aria-label="Heatmap date"]').value, '2026-11-06')
  await dragPointer('onPointerUp', 500, -98)
  let suppressed = 0
  await React.act(async () => props(viewport).onClickCapture({ preventDefault() { suppressed++ }, stopPropagation() { suppressed++ } }))
  assert.equal(suppressed, 2, 'A vertical drag suppresses its trailing date click')
  await dragPointer('onPointerDown', 500, 100)
  await dragPointer('onPointerMove', 450, 50)
  await flush()
  assert.equal(viewport.scrollLeft, verticalLeft + 50)
  assert.equal(viewport.scrollTop, 248, 'Diagonal dragging updates both axes together')
  await dragPointer('onPointerCancel', 450, 50)
  assert.equal(captures.size, 0, 'Pointer cancellation releases capture on either axis')
  await dragPointer('onPointerDown', 500, 100)
  await dragPointer('onPointerMove', -100000, -100000)
  await flush()
  const tapeStyle = host.querySelector('.heatmap-tape').style
  const rowCount = Number(/repeat\((\d+),/.exec(tapeStyle.gridTemplateRows)[1])
  assert.equal(viewport.scrollTop, 42 + rowCount * 30 - 250, 'Dragging clamps at the final row')
  assert.equal(viewport.scrollLeft, 184 + 365 * 92 - 900, 'Dragging clamps at the final date')
  assert.ok(host.querySelectorAll('[data-heatmap-cell]').length < 500, 'Vertical browsing retains bounded row and column windows')
  await dragPointer('onPointerUp', -100000, -100000)
  await dragPointer('onPointerDown', 500, 100)
  await dragPointer('onPointerMove', 100000, 100000)
  await flush()
  assert.equal(viewport.scrollTop, 0); assert.equal(viewport.scrollLeft, 0)
  await dragPointer('onPointerUp', 100000, 100000)
  assert.equal(pending.length, 0, 'Two-axis browsing never fetches history')
  await click(button('Weekly'))
  assert.equal(pending.length, 0, 'Weekly view reuses daily history')
  assert.equal(host.querySelector('[aria-label="Heatmap date"]').value, '2026-11-06')
  await click(button('Daily'))
  await click([...host.querySelectorAll('button')].find(n => n.textContent.startsWith('Instruments ·')))
  const modal = () => host.querySelector('[role="dialog"]')
  await click(modal().querySelector('[aria-label="Remove EUR basket"]'))
  await click([...modal().querySelectorAll('button')].find(n => n.textContent === 'Cancel'))
  assert.ok(host.querySelector('.heatmap-label').textContent.includes('Currencies'))
  assert.equal(JSON.parse(localStorage.getItem('fyodor.cross-asset.v1:Pepperstone-Demo')).rows, null, 'Cancel preserves default selection')
  await click([...host.querySelectorAll('button')].find(n => n.textContent.startsWith('Instruments ·')))
  await click(modal().querySelector('[aria-label="Remove EUR basket"]'))
  await change(modal().querySelector('[aria-label="Heatmap watchlist name"]'), 'Cross-asset study')
  await click([...modal().querySelectorAll('button')].find(n => n.textContent === 'Save / update watchlist'))
  await click([...modal().querySelectorAll('button')].find(n => n.textContent === 'Save'))
  const saved = JSON.parse(localStorage.getItem('fyodor.cross-asset.v1:Pepperstone-Demo'))
  assert.ok(!saved.rows.includes('basket:EUR'))
  assert.equal(saved.presets[0].name, 'Cross-asset study')
  await change(host.querySelector('[aria-label="Heatmap date"]'), '2025-11-06')
  const obsolete = pending.shift()
  await change(host.querySelector('[aria-label="Heatmap date"]'), '2024-11-06')
  assert.equal(obsolete.options.signal.aborted, true)
  await reply(obsolete, snapshot(symbols, 2025))
  assert.ok(!host.querySelector('[data-heatmap-cell="basket:USD:2024-11-06"]').textContent.includes('+7.25'), 'Late replies never enter another year')
  const current = pending.shift()
  await dragPointer('onPointerDown', 500, 100)
  await dragPointer('onPointerMove', 500, 50)
  assert.equal(frames.size, 1)
  await React.act(async () => root.render(null))
  assert.equal(current.options.signal.aborted, true)
  assert.equal(timers.size, 0); assert.equal(frames.size, 0); assert.equal(observers.size, 0); assert.equal(captures.size, 0)
  console.log('✓ Cross-asset: all-eight geometric baskets, quote inversion, coverage, weekly compounding, historical volatility, bounded tape work, watchlists, cancellation and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close(); Date.now = originalNow
  for (const [k, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k] }
}
