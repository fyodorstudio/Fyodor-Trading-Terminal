import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
let nextFrame = 0
const frames = new Map()
dom.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame }
dom.cancelAnimationFrame = id => frames.delete(id)
const flushFrame = () => {
  const callbacks = [...frames.values()]; frames.clear()
  for (const callback of callbacks) callback(0)
}
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
let mounted = true
try {
  const { MagnitudeScatterPlot } = await server.ssrLoadModule('./src/scatter-plot/plot/MagnitudeScatterPlot.tsx')
  const { scatterReading } = await server.ssrLoadModule('./src/scatter-plot/inspection/scatter-number-format.ts')
  const { formatInspectorValue } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { scatterRecentWindow } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-recent-window.ts')
  const event = { event_id: 'claims', unit: 0, multiplier: 1, currency: 'USD', country_code: 'US' }
  for (const reference of [event, { ...event, unit: 1, multiplier: 0 }, { ...event, unit: 3, multiplier: 0 },
    { ...event, unit: 1, event_id: '840050014' }, { ...event, multiplier: 2 }]) {
    for (const value of [null, NaN, Infinity, -0, 0, .123456789, -632.875789, 304.830745]) {
      for (const delta of [false, true]) for (const digits of [2, 6]) {
        assert.equal(scatterReading(value, reference, delta, digits), formatInspectorValue(value, reference, delta, digits),
          'Reused formatters preserve units, basis-point conversion, signs, precision and missing values')
      }
    }
  }
  const points = Array.from({ length: 606 }, (_, i) => ({ id: `point${i}`, releaseId: `release${i}`,
    at: Date.UTC(2015, 0, 1) + i * 7 * 86400000, delta: (i % 7 - 3) * 1.25,
    actual: 200 + (i % 7 - 3) * 1.25, previous: 200, tone: i % 7 >= 3 ? 'higher' : 'lower' }))
  const point = points.at(-1)
  let readingCalls = 0, deltaCalls = 0, rectReads = 0
  const model = { points, deltaUnit: 'k',
    formatReading: value => { readingCalls++; return scatterReading(value, event) },
    formatDelta: (value, digits) => { deltaCalls++; return scatterReading(value, event, true, digits) },
    inspection: { releaseId: point.releaseId, at: point.at, point, actual: point.actual, previous: point.previous,
      delta: point.delta, distribution: null, magnitudeMode: 'undefined', samples: points, excluded: 0, earlierCount: 605 } }
  const original = JSON.stringify(model)
  const selected = []
  const props = { model, zoom: false, dateWindow: scatterRecentWindow(points, point.at), viewKey: 'claims', onInspect: id => selected.push(id) }
  const render = next => React.act(async () => root.render(React.createElement(MagnitudeScatterPlot, next ?? props)))
  await render()
  const svg = container.querySelector('svg')
  svg.getBoundingClientRect = () => { rectReads++; return { left: 0, top: 0, width: 900, height: 280 } }
  const send = (type, x = 300, y = 120) => svg.dispatchEvent(new dom.PointerEvent(type,
    { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, bubbles: true }))
  const range = () => ({ from: Number(svg.dataset.dateFrom), to: Number(svg.dataset.dateTo) })
  readingCalls = 0; deltaCalls = 0; rectReads = 0
  await React.act(async () => { for (let i = 0; i < 100; i++) send('pointermove', 300 + i) })
  assert.equal(frames.size, 1, 'A burst of mouse events schedules one frame')
  assert.equal(rectReads, 0, 'Coordinate conversion is deferred until the frame')
  await React.act(async () => flushFrame())
  assert.equal(rectReads, 1)
  assert.equal(readingCalls, 0, 'Hover never rebuilds historical reading labels')
  assert.equal(deltaCalls, 1, 'Hover formats only the crosshair, independent of history size')
  assert.equal(container.querySelector('.scatter-plot-crosshair line').getAttribute('x1'), '399', 'The newest cursor position wins')
  assert.equal(container.querySelectorAll('[data-point-id]').length, 606, 'Full historical source observations remain available')
  const hoverTimes = [], panTimes = []
  for (let i = 0; i < 18; i++) {
    const start = performance.now()
    await React.act(async () => { send('pointermove', 300 + i); flushFrame() })
    if (i >= 3) hoverTimes.push(performance.now() - start)
  }
  await React.act(async () => send('pointerdown'))
  readingCalls = 0; deltaCalls = 0
  for (let i = 0; i < 12; i++) {
    const start = performance.now()
    await React.act(async () => { send('pointermove', 310 + i * 3); flushFrame() })
    if (i >= 2) panTimes.push(performance.now() - start)
  }
  assert.equal(readingCalls, 0, 'Panning reuses all historical reading labels')
  assert.equal(deltaCalls, 12 * 6, 'Panning formats only five axis ticks and the crosshair per frame')
  await React.act(async () => send('pointerup', 343))
  await React.act(async () => svg.dispatchEvent(new dom.MouseEvent('dblclick', { clientX: 300, clientY: 120, bubbles: true })))
  const beforeFastDrag = range()
  await React.act(async () => { send('pointerdown'); send('pointermove', 360); send('pointerup', 360) })
  assert.ok(range().from < beforeFastDrag.from, 'Pointer-up flushes a drag that completes before its frame')
  assert.equal(frames.size, 0)
  await React.act(async () => container.querySelector('[data-point-id="point605"]').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })))
  assert.deepEqual(selected, [], 'Even a sub-frame drag suppresses point selection')
  await React.act(async () => { send('pointerdown'); send('pointermove', 420); send('pointermove', 300); send('pointerup') })
  await React.act(async () => container.querySelector('[data-point-id="point605"]').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })))
  assert.deepEqual(selected, [], 'Returning to the starting point within one frame is still a drag')
  const beforeCancel = range()
  await React.act(async () => { send('pointerdown'); send('pointermove', 450); send('pointercancel', 450); flushFrame() })
  assert.deepEqual(range(), beforeCancel, 'Cancellation discards a pending movement')
  assert.ok(!container.querySelector('.scatter-plot-crosshair'))
  // React synthesizes onPointerLeave from the bubbling pointerout event.
  await React.act(async () => { send('pointermove'); send('pointerout'); flushFrame() })
  assert.ok(!container.querySelector('.scatter-plot-crosshair'), 'Leaving does not resurrect a pending crosshair')
  await React.act(async () => send('pointermove'))
  await render({ ...props, viewKey: 'different-series' })
  assert.equal(frames.size, 0, 'Changing series cancels pending coordinates from the previous view')
  const inspected = points[600]
  await render({ ...props, model: { ...model, inspection: { ...model.inspection, releaseId: inspected.releaseId, at: inspected.at, point: inspected } } })
  assert.equal(container.querySelector('[data-point-id="point600"]').getAttribute('aria-pressed'), 'true')
  assert.match(container.querySelector('[data-point-id="point605"]').getAttribute('aria-label'), /Later release/, 'Selection invalidates cached labels')
  assert.equal(JSON.stringify(model), original, 'Navigation does not alter scoring samples or calculations')
  await React.act(async () => send('pointermove'))
  await React.act(async () => root.unmount()); mounted = false
  assert.equal(frames.size, 0, 'Unmount cancels pending animation callbacks')
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  console.log(`✓ 606-point regression: cached labels, one frame per pointer burst, final drag position, cancellation, series reset and formatter parity`)
  console.log(`  Headless medians (informational): hover ${median(hoverTimes).toFixed(2)} ms; pan ${median(panTimes).toFixed(2)} ms`)
} finally {
  if (mounted) await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
}
