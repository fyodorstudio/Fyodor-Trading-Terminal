import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Installed chart coordinates + production alert hooks. Canvas painting is a no-op.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, location: dom.location, ResizeObserver: dom.ResizeObserver,
  getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const old = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const frames = new Map(), captures = new Set(); let sequence = 0, writes = 0, lineUpdates = 0
window.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
window.cancelAnimationFrame = id => frames.delete(id)
dom.SVGElement.prototype.setPointerCapture = id => captures.add(id)
dom.SVGElement.prototype.hasPointerCapture = id => captures.has(id)
dom.SVGElement.prototype.releasePointerCapture = id => captures.delete(id)
const contexts = new WeakMap()
dom.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this)) contexts.set(this, new Proxy({ canvas: this, measureText: text => ({ width: String(text).length * 7, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }) },
    { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true } }))
  return contexts.get(this)
}
const storage = dom.localStorage
Object.defineProperty(dom, 'localStorage', { configurable: true, value: {
  getItem: storage.getItem.bind(storage), setItem(key, value) { if (key === 'fyodor.price-alerts.v1') writes++; storage.setItem(key, value) },
} })
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const { createChart, CandlestickSeries } = await import('../node_modules/lightweight-charts/dist/lightweight-charts.development.mjs')
const host = document.createElement('div'); document.body.append(host)
const chartHost = document.createElement('div'), overlayHost = document.createElement('div'); host.append(chartHost, overlayHost)
const root = createRoot(overlayHost)
let chart, api, first, paused
const nativeLines = new Set()
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, `${message}: ${a} vs ${b}`)
async function paint() {
  await React.act(async () => { for (let pass = 0; frames.size && pass < 15; pass++) { const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(performance.now()) } })
  assert.equal(frames.size, 0, 'Chart and overlay settle without redraw loops')
}
const pointer = (element, type, y, pointerId = 1) => React.act(async () => element.dispatchEvent(new dom.PointerEvent(type, {
  bubbles: true, pointerId, pointerType: 'mouse', button: 0, clientX: 237, clientY: y + 81,
})))
const key = name => React.act(async () => window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: name })))
const command = fn => React.act(async () => fn())
try {
  const { PriceAlertLines } = await server.ssrLoadModule('./src/price-alerts/PriceAlertLines.tsx')
  const { usePriceAlerts } = await server.ssrLoadModule('./src/price-alerts/usePriceAlerts.ts')
  chart = createChart(chartHost, { width: 800, height: 400, autoSize: false, layout: { colorParsers: [color => /^#[\da-f]{6}$/i.test(color) ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)).concat(1) : null] }, crosshair: { mode: 0 }, localization: { locale: 'en-US' } })
  const series = chart.addSeries(CandlestickSeries)
  const create = series.createPriceLine.bind(series), remove = series.removePriceLine.bind(series)
  series.createPriceLine = options => {
    const line = create(options), apply = line.applyOptions.bind(line)
    line.applyOptions = next => { lineUpdates++; apply(next) }
    nativeLines.add(line); return line
  }
  series.removePriceLine = line => { nativeLines.delete(line); remove(line) }
  series.setData(Array.from({ length: 10 }, (_, index) => ({ time: 1791950400 + index * 60, open: 10, high: 14, low: 8, close: 11 })))
  chart.timeScale().setVisibleLogicalRange({ from: -1, to: 18 }); await paint()
  const originalCandles = JSON.stringify(series.data())
  chart.panes()[0].getHTMLElement().querySelector('canvas:last-of-type').getBoundingClientRect = () => ({ left: 37, top: 81 })
  const moves = []; chart.subscribeCrosshairMove(event => moves.push(event))
  let quotes = [{ symbol: 'EURUSD', bid: 10, ask: 10.01, precision: 2, dailyChange: 0, description: 'Euro' }]
  function Harness({ symbol = 'EURUSD', broker = 'Broker', enabled = true, scope = 'H1' }) {
    const controller = usePriceAlerts(broker, quotes, true)
    React.useEffect(() => { api = controller })
    return React.createElement(PriceAlertLines, { key: `${broker}:${symbol}:${scope}`, chartApi: chart, seriesApi: series,
      alerts: controller.brokerAlerts, symbol, dragEnabled: enabled, onPriceChange: controller.moveAlert, onDragChange: controller.setDraggingAlertId, onDeleteAlert: controller.deleteAlert })
  }
  const render = async (props = {}) => { await React.act(async () => root.render(React.createElement(Harness, props))); await paint() }
  const saved = () => JSON.parse(storage.getItem('fyodor.price-alerts.v1')).alerts
  const record = id => saved().find(alert => alert.id === id)
  const handle = (id = first) => overlayHost.querySelector(`[data-price-alert-id="${id}"]`)
  const svg = () => overlayHost.querySelector('svg')
  const native = name => [...nativeLines].find(line => line.options().title.includes(name))
  await render()
  await command(() => {
    api.setSound(false, 3)
    first = api.addAlert('EURUSD', 11, 2); paused = api.addAlert('EURUSD', 12, 2)
    api.renameAlert(first, 'Breakout'); api.renameAlert(paused, 'Paused level'); api.updateAlert(paused, 'pause')
  }); await paint()
  assert.equal(nativeLines.size, 2)
  assert.equal(handle().getAttribute('aria-label'), 'Drag Breakout alert price')
  await pointer(handle(), 'pointerdown', series.priceToCoordinate(11))
  const before = writes
  lineUpdates = 0; moves.length = 0
  await React.act(async () => {
    for (let i = 0; i < 100; i++) svg().dispatchEvent(new dom.PointerEvent('pointermove', {
      bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: 237, clientY: series.priceToCoordinate(11.8) + 81,
    }))
  })
  assert.equal(lineUpdates, 0, 'Pointer bursts defer native line work to an animation frame')
  assert.equal(writes, before, 'Preview never writes storage')
  await paint()
  assert.equal(lineUpdates, 1, 'A hundred moves paint the line once')
  assert.equal(native('Breakout').options().price, 11.8)
  assert.equal(Number(handle().getAttribute('aria-valuenow')), 11.8)
  close(moves.at(-1).point.y, series.priceToCoordinate(11.8), 'Native crosshair follows drag price')
  quotes = [{ ...quotes[0], bid: 11.2 }]; await render()
  assert.equal(record(first).status, 'armed', 'Crossing the old level while dragging does not trigger')
  await pointer(svg(), 'pointerup', series.priceToCoordinate(11.8)); await paint()
  assert.equal(writes, before + 1, 'Drop persists exactly once')
  assert.equal(record(first).price, 11.8)
  assert.equal(record(first).direction, 'above')
  assert.equal(record(first).name, 'Breakout')
  assert.equal(captures.size, 0)
  await command(() => handle().dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))); await paint()
  assert.equal(record(first).price, 11.81, 'Keyboard fine-tuning uses broker precision')
  for (const cancellation of ['Escape', 'pointercancel', 'lostpointercapture', 'blur']) {
    await pointer(handle(), 'pointerdown', series.priceToCoordinate(11.81))
    await pointer(svg(), 'pointermove', series.priceToCoordinate(12.4)); await paint()
    const count = writes
    if (cancellation === 'Escape') await key('Escape')
    else if (cancellation === 'blur') await command(() => window.dispatchEvent(new dom.Event('blur')))
    else await pointer(svg(), cancellation, series.priceToCoordinate(12.4))
    await paint()
    assert.equal(writes, count, `${cancellation}: cancellation never saves`)
    assert.equal(native('Breakout').options().price, 11.81)
    assert.equal(captures.size, 0)
  }
  await pointer(handle(paused), 'pointerdown', series.priceToCoordinate(12))
  await pointer(svg(), 'pointerup', series.priceToCoordinate(12.5)); await paint()
  assert.equal(record(paused).price, 12.5)
  assert.equal(record(paused).status, 'paused', 'Dragging a paused line preserves its status')
  chart.priceScale('right').applyOptions({ autoScale: false }); chart.priceScale('right').setVisibleRange({ from: 9, to: 15 }); await paint()
  close(Number(handle().getAttribute('y1')), series.priceToCoordinate(11.81), 'Handles follow the actual price scale')
  for (const change of [{ enabled: false }, { scope: 'D1' }, { symbol: 'GBPUSD' }, { broker: 'Other Broker' }]) {
    await render()
    await pointer(handle(), 'pointerdown', series.priceToCoordinate(11.81))
    const stale = svg(), snapshot = storage.getItem('fyodor.price-alerts.v1')
    await pointer(stale, 'pointermove', series.priceToCoordinate(13)); await paint()
    await render(change)
    assert.equal(captures.size, 0, 'Changing tools, timeframe, symbol or broker cancels capture')
    await pointer(stale, 'pointerup', series.priceToCoordinate(13)); await paint()
    assert.equal(storage.getItem('fyodor.price-alerts.v1'), snapshot, 'An obsolete drag cannot save into another scope')
  }
  await render()
  await pointer(handle(), 'pointerdown', series.priceToCoordinate(11.81))
  await pointer(svg(), 'pointermove', series.priceToCoordinate(13)); await paint()
  await command(() => api.updateAlert(first, 'price', 12.8)); await paint()
  assert.equal(captures.size, 0)
  assert.equal(native('Breakout').options().price, 12.8, 'A concurrent edit cancels preview without restoring stale prices')
  const beforeDelete = writes
  let bubbled = 0
  const onContextMenu = () => bubbled++
  host.addEventListener('contextmenu', onContextMenu)
  const pausedMenu = new dom.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
  await command(() => handle(paused).dispatchEvent(pausedMenu)); await paint()
  assert.equal(pausedMenu.defaultPrevented, true, 'Right-click suppresses the browser menu')
  assert.equal(bubbled, 0, 'Alert deletion does not reach chart or drawing context handlers')
  assert.equal(record(paused), undefined, 'Right-click deletes a paused alert from storage')
  assert.equal(record(first).price, 12.8, 'Deleting a paused alert preserves the other alert')
  assert.equal(nativeLines.size, 1)
  assert.equal(writes, beforeDelete + 1, 'Right-click persists deletion once')
  await pointer(handle(), 'pointerdown', series.priceToCoordinate(12.8))
  const stale = svg()
  await pointer(stale, 'pointermove', series.priceToCoordinate(13)); await paint()
  await command(() => handle().dispatchEvent(new dom.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))); await paint()
  assert.equal(captures.size, 0)
  assert.equal(handle(), null)
  assert.equal(nativeLines.size, 0)
  assert.deepEqual(saved(), [], 'Right-click also deletes an armed alert during a drag')
  const afterDelete = writes
  await pointer(stale, 'pointerup', series.priceToCoordinate(13)); await paint()
  assert.equal(writes, afterDelete, 'A pending drop cannot restore the deleted alert')
  host.removeEventListener('contextmenu', onContextMenu)
  assert.equal(JSON.stringify(series.data()), originalCandles, 'Alert dragging never changes candles')
  await React.act(async () => root.unmount()); await paint()
  assert.equal(nativeLines.size, 0); assert.equal(captures.size, 0)
  console.log('✓ Price alert chart: native drag/crosshair/zoom, one write on drop, bounded preview work, keyboard precision, paused state, quote suppression, cancellation, stale scopes and cleanup')
} finally {
  await React.act(async () => root.unmount()); chart?.remove(); await server.close(); await dom.happyDOM.close()
  assert.equal(frames.size, 0)
  for (const [key, value] of old) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key] }
}
