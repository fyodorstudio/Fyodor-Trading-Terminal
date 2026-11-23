import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { waitForServices } from '../scripts/wait-for-services.mjs'
import { parseDesktopListeners } from '../scripts/clean-ports.mjs'

assert.deepEqual(parseDesktopListeners([
  'TCP    [::1]:5173             [::]:0          LISTENING       111',
  'TCP    127.0.0.1:8001         0.0.0.0:0        LISTENING       222',
  'TCP    127.0.0.1:8002         127.0.0.1:1010   ESTABLISHED     333',
  'TCP    127.0.0.1:8003         0.0.0.0:0        LISTENING       444',
].join('\r\n')), [{ port: 5173, pid: 111 }, { port: 8001, pid: 222 }],
'Desktop port cleanup includes Vite on IPv6 and leaves the alarm worker to its own restart script')

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

if (process.platform === 'win32') {
  const script = fileURLToPath(new URL('../../scripts/tests/test-start-alarms.ps1', import.meta.url))
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { encoding: 'utf8' })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  console.log(result.stdout.trim())
  const phoneScript = fileURLToPath(new URL('../../scripts/tests/test-start-news-phone.ps1', import.meta.url))
  const phone = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', phoneScript], { encoding: 'utf8' })
  assert.equal(phone.status, 0, `${phone.stdout}\n${phone.stderr}`)
  console.log(phone.stdout.trim())
}
