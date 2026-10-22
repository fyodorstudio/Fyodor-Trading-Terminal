import assert from 'node:assert/strict'
import { waitForServices } from '../scripts/wait-for-services.mjs'

let clock = 0, attempts = 0
const requests = [], logs = []
const settings = { now: () => clock, pause: async ms => { clock += ms }, log: line => logs.push(line), retryMs: 10, timeoutMs: 50 }
await waitForServices(['bridge', 'storage'], { ...settings, fetchImpl: async (url, { signal }) => {
  requests.push(url); assert.ok(signal instanceof AbortSignal)
  if (url === 'bridge') return { ok: true } // MT5 may still be disconnected.
  attempts++
  if (attempts === 1) throw new Error('ECONNREFUSED')
  return { ok: attempts >= 3 }
} })
assert.deepEqual(requests, ['bridge', 'storage', 'storage', 'storage'])
assert.equal(logs.at(-1), '[startup] Services ready; starting UI.')
clock = 0; logs.length = 0
await assert.rejects(waitForServices(['storage'], { ...settings, fetchImpl: async () => ({ ok: false }) }), /Startup timed out.*storage/)
assert.equal(clock, 50)
assert.equal(logs.length, 1, 'A timeout never announces UI readiness')
console.log('✓ Startup waits for HTTP readiness, retries refusal/503, and fails with a bounded diagnostic')
