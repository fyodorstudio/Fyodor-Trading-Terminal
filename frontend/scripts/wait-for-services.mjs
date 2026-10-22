import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

// Gate Vite on HTTP readiness, not MT5 connectivity. A disconnected terminal
// must still be able to open the UI and inspect saved data.
export async function waitForServices(urls, { timeoutMs = 120000, retryMs = 250, requestMs = 1500,
  fetchImpl = fetch, now = Date.now, pause = delay, log = console.log } = {}) {
  const deadline = now() + timeoutMs
  let pending = [...urls]
  log('[startup] Waiting for bridge and calendar storage…')
  while (pending.length && now() < deadline) {
    const ready = await Promise.all(pending.map(async url => {
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(Math.max(1, Math.min(requestMs, deadline - now()))) })
        await response.body?.cancel()
        return response.ok
      } catch { return false }
    }))
    pending = pending.filter((_, index) => !ready[index])
    if (pending.length) await pause(Math.min(retryMs, Math.max(0, deadline - now())))
  }
  if (pending.length) throw new Error(`Startup timed out waiting for ${pending.join(', ')}. Check the BRIDGE/STORAGE logs.`)
  log('[startup] Services ready; starting UI.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await waitForServices([
      `${(process.env.FYODOR_BRIDGE_API_URL ?? 'http://127.0.0.1:8001').replace(/\/$/, '')}/api/v1/health`,
      `${(process.env.FYODOR_STORAGE_API_URL ?? 'http://127.0.0.1:8002').replace(/\/$/, '')}/api/v1/health`,
    ])
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
