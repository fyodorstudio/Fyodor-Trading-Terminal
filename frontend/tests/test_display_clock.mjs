import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'ResizeObserver' ? class { observe() {} disconnect() {} } : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { chartClockToUtc, utcToChartClock } = await load('appearance/time-display/chart-clock.ts')
  const { DisplayClockProvider } = await load('appearance/time-display/DisplayClock.tsx')
  const { parseDisplayClockInput, displayClockInput } = await load('appearance/time-display/display-clock-input.ts')
  const { formatChartCrosshairTime, formatChartTick } = await load('appearance/time-display/time-display-preference.ts')
  const { candleContextCutoff } = await load('raycaster/chart/candle-cutoff.ts')
  const { RaycasterBox } = await load('raycaster/ui/RaycasterBox.tsx')
  const { RibbonExplanation } = await load('raycaster/ribbon/RibbonExplanation.tsx')
  const { ComboInspector } = await load('usd-context/sequences/ui/ComboInspector.tsx')
  const { ExternalEventManager } = await load('external-events/ui/ExternalEventManager.tsx')
  const { combineContext } = await load('scoring-system/context/usd/combine-context.ts')
  const { buildRibbonTimeline } = await load('raycaster/ribbon/ribbon-timeline.ts')
  const scope = { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 10800 }, jakarta = { mode: 'fixed-offset', utcOffsetMinutes: 420 }
  const utc = Date.UTC(2026, 6, 2, 12, 30), chart = Date.UTC(2026, 6, 2, 15, 30), hour = 3600000
  assert.equal(chartClockToUtc(chart, scope), utc)
  assert.match(formatChartCrosshairTime(chart / 1000, jakarta, scope), /19:30/)
  assert.equal(chartClockToUtc(Date.UTC(2026, 0, 9, 15, 30), scope), Date.UTC(2026, 0, 9, 13, 30), 'Winter uses historical +2, despite a current +3 offset')
  for (const at of [Date.UTC(2025, 2, 30, 0, 59), Date.UTC(2025, 2, 30, 1), Date.UTC(2025, 9, 26, 0, 59), Date.UTC(2025, 9, 26, 1)]) {
    const wall = utcToChartClock(at, scope), back = chartClockToUtc(wall, scope)
    if (back !== null) assert.equal(back, at, 'A unique historical coordinate round-trips')
  }
  assert.equal(chartClockToUtc(Date.UTC(2025, 2, 30, 3, 30), scope), null, 'Skipped DST clock is not invented')
  assert.equal(chartClockToUtc(Date.UTC(2025, 9, 26, 3, 30), scope), null, 'Duplicated DST clock is not guessed')
  assert.equal(chartClockToUtc(NaN, scope), null)
  assert.equal(chartClockToUtc(Date.UTC(2032, 5, 1), scope), null, 'No historical profile is invented beyond its range')
  assert.equal(chartClockToUtc(chart, { brokerId: 'Other source', brokerOffsetSeconds: 10800 }), utc, 'Unknown sources use the disclosed supplied offset')
  assert.equal(formatChartTick(chart / 1000, 3, jakarta, scope), '19:30')
  const evening = Date.UTC(2026, 6, 2, 18, 30)
  assert.equal(displayClockInput(evening, jakarta), '2026-07-03T01:30', 'Display dates cross UTC midnight')
  assert.equal(parseDisplayClockInput('2026-07-02T19:30', jakarta), utc)
  assert.equal(displayClockInput(utc, jakarta), '2026-07-02T19:30')
  assert.equal(parseDisplayClockInput('2026-02-30T19:30', jakarta), null)
  const minus = { mode: 'fixed-offset', utcOffsetMinutes: -300 }
  assert.equal(parseDisplayClockInput(displayClockInput(utc, minus), minus), utc)
  assert.equal(candleContextCutoff(chart / 1000 - 1800, 'H1', utc - 1, 10800), chart - 1, 'Live H1 does not admit future mid-candle news')
  assert.equal(candleContextCutoff(chart / 1000 - 900, 'M15', utc + hour, 10800), chart - 1)
  assert.equal(candleContextCutoff(chart / 1000, 'M30', utc + hour, 10800), chart + 1800000 - 1)

  const source = { family: 'claims', total: -1, chartAt: chart, releaseAt: utc, sourceId: 'claims', sourceLabel: 'Claims',
    usdDirection: 'weaker', strength: 'moderate', reduced: false, coverage: 1, reason: '', explanation: '' }
  const result = combineContext({ claims: source }, ['claims'], chart)
  const point = { chartAt: chart, latest: source, result, update: 'Claims publication' }
  const ribbon = buildRibbonTimeline({ points: [point] }, null, false, 'EURUSD')[0]
  const combo = { id: 'clock-audit', title: 'Fresh-news sequence', kind: 'fresh-news', chartAt: chart,
    sources: [{ ...result.members[0], change: -.1, comparable: true }], before: result, after: result, strength: 'weak', experimental: true, checks: [], explanation: '' }
  const render = (node, preference = jakarta) => React.act(async () => root.render(React.createElement(DisplayClockProvider, { ...scope, preference }, node)))
  await render(React.createElement(React.Fragment, null,
    React.createElement(RaycasterBox, { symbol: 'EURUSD', point, cutoff: chart + 1800000 - 1, loading: false, message: null, timeDisplay: jakarta, onClose() {} }),
    React.createElement(RibbonExplanation, { point: ribbon, mode: 'USD side', version: 'test', partial: false, onClose() {} }),
    React.createElement(ComboInspector, { combo, timeDisplay: jakarta, symbol: 'EURUSD', onClose() {}, onOpenRelease() {} })))
  assert.match(container.querySelector('.raycaster-box').textContent, /Through.*19:59.*Context update.*19:30/s)
  assert.match(container.querySelector('.ribbon-explanation').textContent, /State available from.*19:30/)
  assert.match(container.querySelector('[aria-label="Activation and changes"]').textContent, /Available from.*19:30/)
  assert.doesNotMatch(container.textContent, /broker time/i)
  const canonical = JSON.stringify([point, combo])
  await render(React.createElement(RibbonExplanation, { point: ribbon, mode: 'USD side', version: 'test', partial: false, onClose() {} }), { mode: 'utc', utcOffsetMinutes: 0 })
  assert.match(container.textContent, /State available from.*12:30/)
  assert.equal(JSON.stringify([point, combo]), canonical, 'Changing display clock never mutates scores or chart coordinates')

  const props = { events: [], initialId: null, defaults: { from: chart, to: chart + hour }, symbol: 'EURUSD', brokerId: scope.brokerId, onClose() {} }
  await render(React.createElement(ExternalEventManager, props))
  assert.equal(container.querySelector('input[type="datetime-local"]').value, '2026-07-02T19:30')
  await render(React.createElement(ExternalEventManager, props), { mode: 'utc', utcOffsetMinutes: 0 })
  assert.equal(container.querySelector('input[type="datetime-local"]').value, '2026-07-02T12:30', 'Clock changes preserve the in-progress annotation instant')
  assert.doesNotMatch(container.textContent, /broker time/i)
  const title = container.querySelector('input')
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(title.constructor.prototype, 'value').set.call(title, 'Selected-clock note')
    title.dispatchEvent(new dom.Event('input', { bubbles: true }))
  })
  await React.act(async () => container.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  const { readExternalEvents } = await load('external-events/storage/external-event-store.ts')
  const saved = readExternalEvents().find(e => e.title === 'Selected-clock note')
  assert.equal(saved.from, chart, 'A selected-clock save retains canonical chart coordinates')
  assert.equal(saved.to, chart + hour)
  const storedNotes = localStorage.getItem('fyodor.external-events.v1')
  await render(React.createElement(ExternalEventManager, { ...props, events: [saved], initialId: saved.id, key: saved.id }))
  assert.equal(container.querySelector('input[type="datetime-local"]').value, '2026-07-02T19:30', 'An existing saved note displays in the selected clock')
  assert.equal(localStorage.getItem('fyodor.external-events.v1'), storedNotes, 'Display-only changes never rewrite saved notes')
  console.log('✓ Unified selected clock, summer/winter and ambiguous DST, release/cutoff distinctions, M15/M30 live caps, immutable outputs and annotation input round-trip')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
