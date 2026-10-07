import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
const frames = new Map(); let frameId = 0
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }; dom.cancelAnimationFrame = id => frames.delete(id)
const render = node => React.act(async () => root.render(node))
const flush = () => React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { externalIntervals, visibleExternalIntervals, validExternalEvents, parseClockInput, clockInput } = await load('external-events/core/external-event.ts')
  const store = await load('external-events/storage/external-event-store.ts')
  const { ExternalEventsStrip } = await load('external-events/chart/ExternalEventsStrip.tsx')
  const workspace = await load('workspace-portability/workspace-snapshot.ts')
  const at = Date.UTC(2025, 0, 1, 12), hour = 3600000
  const draft = { brokerId: 'Broker A', symbol: 'EURUSD', title: 'Outside context example', note: 'A manually recorded observation, not a verified cause.', from: at + hour / 2, to: at + 2 * hour }
  assert.equal(parseClockInput('2025-01-01T12:30'), at + hour / 2, 'Broker clock is parsed without machine timezone conversion')
  assert.equal(parseClockInput('2025-02-30T12:30'), null); assert.equal(parseClockInput('2025-01-01T25:00'), null)
  const first = store.saveExternalEvent(draft).event
  const ongoing = store.saveExternalEvent({ ...draft, title: 'Ongoing outside note', from: at + hour, to: null }).event
  store.saveExternalEvent({ ...draft, symbol: 'GBPUSD' }); store.saveExternalEvent({ ...draft, brokerId: 'Broker B' })
  const old = store.readExternalEvents()
  assert.ok(Object.isFrozen(old)); assert.ok(Object.isFrozen(old[0]))
  assert.ok(validExternalEvents([...old]))
  assert.equal(validExternalEvents([first, first]), false)
  assert.equal(validExternalEvents([{ ...first, to: first.from }]), false)
  assert.equal(validExternalEvents([{ ...first, title: ' ' }]), false)
  assert.throws(() => store.saveExternalEvent({ ...draft, to: at }), RangeError)
  assert.throws(() => store.saveExternalEvent({ ...draft, brokerId: 'Broker B' }, first.id), /original broker/)
  const intervals = externalIntervals([first, ongoing])
  assert.deepEqual(intervals.map(i => [i.from, i.to, i.events.length]), [[at + hour / 2, at + hour, 1], [at + hour, at + 2 * hour, 2], [at + 2 * hour, Infinity, 1]])
  assert.equal(visibleExternalIntervals(intervals, at, at + hour / 2).length, 0, 'No highlight appears before the manually specified start')
  assert.equal(visibleExternalIntervals(intervals, at, at + 3 * hour).at(-1).to, at + 3 * hour, 'An ongoing note clips at the requested current-time boundary')
  const gap = externalIntervals([first, { ...ongoing, from: at + 3 * hour, to: at + 4 * hour }])
  assert.equal(visibleExternalIntervals(gap, at + 2 * hour, at + 3 * hour).length, 0, 'Unannotated gaps remain empty, not gray evidence')

  const bars = Array.from({ length: 6 }, (_, n) => ({ time: (at + n * hour) / 1000 }))
  let pan = 0, rangeHandler, sizeHandler, coordinateCalls = 0, subscriptions = 0, unsubscribed = 0
  const scale = { width: () => 500, options: () => ({ barSpacing: 100 }), getVisibleRange: () => ({ from: at / 1000, to: (at + 4 * hour) / 1000 }),
    timeToCoordinate: t => { coordinateCalls++; return (t - at / 1000) / 3600 * 100 + pan },
    subscribeVisibleLogicalRangeChange: fn => { rangeHandler = fn; subscriptions++ }, unsubscribeVisibleLogicalRangeChange: fn => { assert.equal(fn, rangeHandler); unsubscribed++ },
    subscribeSizeChange: fn => { sizeHandler = fn; subscriptions++ }, unsubscribeSizeChange: fn => { assert.equal(fn, sizeHandler); unsubscribed++ } }
  const props = { chartApi: { timeScale: () => scale }, bars, timeframe: 'H1', now: at + 3 * hour, symbol: 'EURUSD', brokerId: 'Broker A' }
  await render(React.createElement(ExternalEventsStrip, props))
  let highlights = [...container.querySelectorAll('.external-event-highlight')]
  assert.equal(highlights.length, 3)
  assert.deepEqual(highlights.map(h => [h.style.left, h.style.width]), [['50px', '50px'], ['100px', '100px'], ['200px', '100px']])
  assert.match(highlights[1].title, /Outside context example.*Ongoing outside note/s)
  assert.match(highlights[1].title, /no directional vote/)
  const calls = coordinateCalls; pan = -25
  await React.act(async () => { for (let i = 0; i < 200; i++) rangeHandler(); sizeHandler() })
  assert.equal(coordinateCalls, calls); assert.equal(frames.size, 1, 'Only one viewport projection per pan burst')
  await flush()
  highlights = [...container.querySelectorAll('.external-event-highlight')]
  assert.equal(highlights[0].style.left, '25px')
  await React.act(async () => highlights[1].click())
  const manager = container.querySelector('[role="dialog"]')
  assert.equal(manager.querySelector('input').value, first.title)
  assert.match(manager.textContent, /Recording time is separate/)
  assert.match(manager.textContent, /Notes may be added retrospectively/)
  const setValue = async (element, value) => React.act(async () => { Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set.call(element, value); element.dispatchEvent(new dom.Event('input', { bubbles: true })) })
  await setValue(manager.querySelector('input'), 'Edited outside note')
  await React.act(async () => manager.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.match(manager.querySelector('[role="status"]').textContent, /Saved locally/)
  assert.equal(store.readExternalEvents().find(e => e.id === first.id).title, 'Edited outside note')
  assert.equal(old.find(e => e.id === first.id).title, first.title, 'Editing leaves previous snapshots intact')
  assert.equal(store.readExternalEvents().find(e => e.id === first.id).createdAt, first.createdAt)
  await setValue(manager.querySelectorAll('input')[2], clockInput(at))
  await React.act(async () => manager.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.match(manager.querySelector('[role="alert"]').textContent, /end after the start/)
  assert.equal(store.readExternalEvents().find(e => e.id === first.id).to, draft.to)
  await React.act(async () => [...manager.querySelectorAll('button')].find(b => b.textContent === 'Delete highlight').click())
  assert.equal(store.readExternalEvents().some(e => e.id === first.id), false)
  await React.act(async () => container.querySelector('[aria-label="Close outside events"]').click())
  assert.equal(container.querySelector('[role="dialog"]'), null)
  assert.equal(document.activeElement, container.querySelector('.external-events-add'))
  await React.act(async () => container.querySelector('.external-events-add').click())
  const form = container.querySelector('[role="dialog"] form')
  await setValue(form.querySelector('input'), 'New manual event')
  await setValue(form.querySelectorAll('input')[2], '')
  await React.act(async () => form.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.ok(store.readExternalEvents().find(e => e.title === 'New manual event' && e.to === null))
  const exported = workspace.exportWorkspace()
  assert.equal(JSON.parse(exported.entries[store.externalEventsKey]).length, store.readExternalEvents().length)
  await React.act(async () => store.deleteExternalEvent(ongoing.id))
  await React.act(async () => workspace.restoreWorkspace(exported))
  assert.ok(store.readExternalEvents().some(e => e.id === ongoing.id))
  assert.throws(() => workspace.parseWorkspaceSnapshot(JSON.stringify({ ...exported, entries: { [store.externalEventsKey]: JSON.stringify([{ ...first, to: first.from }]) } })), /Invalid/)
  await render(React.createElement(ExternalEventsStrip, { ...props, symbol: 'USDJPY' }))
  assert.equal(container.querySelectorAll('.external-event-highlight').length, 0, 'Pair scopes never share these broker-clock notes')
  await render(React.createElement(ExternalEventsStrip, { ...props, brokerId: 'Broker C' }))
  assert.equal(container.querySelectorAll('.external-event-highlight').length, 0)
  await render(React.createElement(ExternalEventsStrip, { ...props, brokerId: null }))
  assert.equal(container.querySelector('.external-events-add').disabled, true)
  await render(null); assert.equal(unsubscribed, subscriptions)
  console.log('✓ Manual outside-event range/overlap/ongoing clocks, exact strip projection, pan batching, create/edit/delete, immutable storage, retrospective disclosure, scoped notes and workspace roundtrip')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
