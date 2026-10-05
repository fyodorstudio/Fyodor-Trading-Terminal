import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const originalNow = Date.now
let now = originalNow()
Date.now = () => now
const timers = new Map(); let sequence = 0
dom.setTimeout = (callback, ms) => { const id = ++sequence; timers.set(id, { callback, ms }); return id }
dom.clearTimeout = (id) => timers.delete(id)
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
let calendar = { status: 'live', instance_id: 'A' }, startedAt = 100, unreachable = false, entries
globalThis.fetch = async (url) => {
  if (url.includes('/health') && unreachable) throw new Error('Bridge offline')
  return { ok: true, json: async () => url.includes('/health') ? {
    api_version: '1', bridge: { started_at: startedAt, now: Date.now() }, calendar,
  } : { events: [], latest_sequence: 0 } }
}
try {
  const { ActivityLogProvider } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-store.tsx')
  const { useActivityLog } = await server.ssrLoadModule('./src/system-observability/activity-log/use-activity-log.ts')
  const { useBridgeStatus } = await server.ssrLoadModule('./src/system-connectivity/bridge-status/use-bridge-status.ts')
  function Probe() {
    useBridgeStatus()
    const log = useActivityLog()
    React.useEffect(() => { entries = log.entries }, [log.entries])
    return null
  }
  const poll = async () => {
    const next = [...timers].find(([, timer]) => timer.ms === 2000)
    assert.ok(next, 'The health poll remains scheduled')
    now += 2000
    timers.delete(next[0]); await React.act(async () => next[1].callback())
  }
  const publisherEntries = () => entries.filter((entry) => entry.source === 'Calendar')
  await React.act(async () => root.render(React.createElement(ActivityLogProvider, null, React.createElement(Probe))))
  assert.equal(publisherEntries()[0].action, 'Publisher live')
  assert.equal(publisherEntries()[0].severity, 'success')
  await poll(); assert.equal(publisherEntries().length, 1, 'Unchanged polls never fill Activity')
  calendar = { ...calendar, status: 'stale' }
  await poll(); assert.equal(publisherEntries().at(-1).action, 'Publisher stale')
  assert.equal(publisherEntries().at(-1).severity, 'warning')
  await poll(); assert.equal(publisherEntries().length, 2)
  calendar = { ...calendar, status: 'live' }
  await poll(); assert.equal(publisherEntries().length, 3, 'Recovery is recorded')
  calendar = { ...calendar, instance_id: 'B' }
  await poll(); assert.equal(publisherEntries().at(-1).detail, 'B', 'New publisher generations are recorded')
  startedAt = 200
  await poll(); assert.equal(publisherEntries().length, 5, 'Bridge restart refreshes publisher activity')
  unreachable = true
  await poll(); assert.equal(publisherEntries().length, 5, 'Bridge failures do not invent publisher state')
  assert.equal(entries.at(-1).action, 'Bridge unreachable')
  console.log('✓ Publisher Activity transitions, unchanged polling, stale/recovery, generation/restart and bridge outage handling')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0, 'Unmount cancels every outstanding poll and timeout')
  Date.now = originalNow
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
