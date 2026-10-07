import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const timers = new Map(), intervals = new Map(); let timerId = 0
dom.setTimeout = (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (callback, ms) => { intervals.set(++timerId, { callback, ms }); return timerId }
dom.clearInterval = id => intervals.delete(id)
const healthRequests = []
globalThis.fetch = url => String(url).includes('/health') ? new Promise(resolve => healthRequests.push(resolve)) :
  Promise.resolve({ ok: true, json: async () => ({ events: [], latest_sequence: 0 }) })
const originalFormatter = Intl.DateTimeFormat; let formatterCount = 0
Intl.DateTimeFormat = new Proxy(originalFormatter, {
  construct(target, args) { formatterCount++; return Reflect.construct(target, args) },
  apply(target, thisArg, args) { formatterCount++; return Reflect.apply(target, thisArg, args) },
})
const utc = { mode: 'utc', utcOffsetMinutes: 0 }
const at = Date.UTC(2026, 9, 7, 12)
const entries = Array.from({ length: 200 }, (_, i) => ({ id: String(i), occurredAt: at + i * 1000,
  source: 'Application', action: `Entry ${i}`, severity: 'info' }))
const nativeProps = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
const commits = []

try {
  const { ActivityLogProvider } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-store.tsx')
  const { useBridgeStatus } = await server.ssrLoadModule('./src/system-connectivity/bridge-status/use-bridge-status.ts')
  const { ActivityLogPanel } = await server.ssrLoadModule('./src/system-observability/activity-log/ActivityLogPanel.tsx')
  const { DataHeartbeatPanel } = await server.ssrLoadModule('./src/system-connectivity/bridge-status/DataHeartbeatPanel.tsx')
  let clears = 0
  function Harness({ rows, timeDisplay }) {
    const bridge = useBridgeStatus()
    return React.createElement(React.Profiler, { id: 'activity', onRender: (_id, _phase, duration) => commits.push(duration) },
      React.createElement(ActivityLogPanel, { entries: rows, timeDisplay, onClear: () => clears++,
        renderHeartbeat: actions => React.createElement(DataHeartbeatPanel, { ...bridge, clockExtra: actions }) }))
  }
  const render = (rows = entries, timeDisplay = utc) => React.act(async () => root.render(
    React.createElement(ActivityLogProvider, null, React.createElement(Harness, { rows, timeDisplay }))))
  const reply = () => React.act(async () => healthRequests.shift()({ ok: true, json: async () => ({
    api_version: '1', bridge: { started_at: 1, now: Date.now() },
    mt5: { connected: true, process_running: true, generation: 1 },
    calendar: { status: 'live', instance_id: 'A' }, operations: {},
  }) }))
  const bridgeCard = () => [...container.querySelectorAll('.heartbeat-card')].find(card => card.textContent.startsWith('Bridge'))

  await render(); await reply()
  assert.equal(formatterCount, 200)
  assert.equal(container.querySelectorAll('.activity-row').length, 200)
  assert.match(container.querySelector('.activity-row').textContent, /Entry 199/)
  const firstRow = container.querySelector('.activity-row')
  const log = container.querySelector('[role="log"]')
  const before = formatterCount
  const timings = []
  for (let i = 0; i < 3; i++) {
    const timer = [...timers].find(([, value]) => value.ms === 2000)
    assert.ok(timer, 'Health polling must retain its existing interval')
    timers.delete(timer[0]); commits.length = 0
    await React.act(async () => { void timer[1].callback() })
    assert.match(bridgeCard().textContent, /Checking/)
    assert.equal(formatterCount, before, 'Checking must not recreate any existing log timestamp formatter')
    assert.equal(container.querySelector('[role="log"]'), log)
    assert.equal(container.querySelector('.activity-row'), firstRow)
    timings.push(...commits)
    await reply()
    assert.match(bridgeCard().textContent, /Running/)
    assert.equal(formatterCount, before, 'The health reply must also retain unchanged rows')
  }
  await React.act(async () => { for (const timer of intervals.values()) timer.callback() })
  assert.equal(formatterCount, before, 'Heartbeat age updates must not rebuild the log')
  await render(entries, { ...utc })
  assert.equal(formatterCount, before, 'An equivalent display preference must retain row formatting')

  const next = [...entries.slice(1), { id: 'new', occurredAt: at + 200_000, source: 'Application', action: 'Newest', severity: 'success' }]
  await render(next)
  assert.equal(formatterCount, before + 1, 'Appending one entry should format just one new timestamp')
  assert.equal(container.querySelectorAll('.activity-row').length, 200)
  assert.match(container.querySelector('.activity-row').textContent, /Newest/)
  assert.ok(container.querySelector('.activity-row').classList.contains('success'))
  const updated = next.map(entry => entry.id === 'new' ? { ...entry, detail: 'Updated detail' } : entry)
  await render(updated)
  assert.equal(formatterCount, before + 1, 'A detail-only edit should preserve its timestamp')
  assert.match(container.querySelector('.activity-row').textContent, /Updated detail/)

  await render(updated, { mode: 'fixed-offset', utcOffsetMinutes: 420 })
  assert.equal(formatterCount, before + 201, 'A real timezone change must update all visible timestamps')
  assert.match(container.querySelector('time').textContent, /19:03:20/)
  assert.equal(container.querySelector('time').dateTime, new Date(at + 200_000).toISOString())
  const applicationToggle = [...container.querySelectorAll('.activity-source-filter label')].find(label => label.textContent === 'Application').querySelector('input')
  await React.act(async () => nativeProps(applicationToggle).onChange())
  assert.equal(container.querySelectorAll('.activity-row').length, 0)
  assert.match(container.querySelector('[role="log"]').textContent, /No activity matches/)
  assert.ok(JSON.parse(localStorage.getItem('fyodor.activity-visible-sources.v2')).every(source => source !== 'Application'))
  await React.act(async () => nativeProps(applicationToggle).onChange())
  assert.equal(container.querySelectorAll('.activity-row').length, 200)
  await React.act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Clear').click())
  assert.equal(clears, 1)
  await render([])
  assert.equal(container.querySelectorAll('.activity-row').length, 0)
  assert.ok([...container.querySelectorAll('button')].find(button => button.textContent === 'Clear').disabled)
  console.log(`Activity: 200 existing rows create zero formatters across Checking/Running; one appended row creates one. Checking render samples: ${timings.map(value => value.toFixed(2)).join(', ')} ms (headless, no timing assertion).`)
  console.log('✓ Real health transitions, timer cleanup, heartbeat ages, append/detail updates, timezone changes, source filters, persistence and Clear')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  Intl.DateTimeFormat = originalFormatter
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
