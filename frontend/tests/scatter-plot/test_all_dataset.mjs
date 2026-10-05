import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const originalNow = Date.now, now = Date.UTC(2026, 9, 5, 12)
Date.now = () => now
const timers = new Set()
dom.setTimeout = (callback) => { timers.add(callback); return callback }
dom.clearTimeout = (callback) => timers.delete(callback)
const requests = []
globalThis.fetch = (url, options = {}) => new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
const respond = (request, body) => React.act(async () => request.resolve({ ok: true, json: async () => body }))
try {
  const { nfpMagnitudeFamily: family } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { familyMagnitudeHistory, familyHistoryReleases } = await server.ssrLoadModule('./src/inspector/magnitude/family-magnitude-history.ts')
  const { nfpScatterModel } = await server.ssrLoadModule('./src/scatter-plot/PAIR/EURUSD/USD/NFP/nfp-scatter-adapter.ts')
  const { useFamilyMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/useFamilyMagnitudeHistory.ts')
  const release = (at, delta, prefix = String(at)) => family.seriesIds.map((id) => ({
    value_id: `${prefix}-${id}`, event_id: id, name: family.readingRules[id].name, currency: 'USD', country_code: 'US', country_name: 'United States',
    event_code: id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
    period_seconds: at / 1000 - 30 * 86400, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: ['840030016', '840030023', '840030022', '840030032'].includes(id) ? 0 : id === '840030020' ? 3 : 1,
    multiplier: ['840030016', '840030023', '840030022', '840030032'].includes(id) ? 1 : 0, digits: 1,
    actual: delta === null ? null : 10 + delta, previous: 10, forecast: null, revised_previous: null,
  }))
  const archive = Array.from({ length: 140 }, (_, index) => release(Date.UTC(2015, index, 9, 13, 30), index % 9 - 4)).flat()
  const scheduled = release(now + 60_000, null, 'next'), futureWithValues = release(now + 86400000, 999, 'future-values')
  const events = [...archive, ...scheduled, ...futureWithValues]
  const groups = familyHistoryReleases(events, now + 1, family), selected = groups[2], id = family.seriesIds[0]
  const settings = Object.fromEntries(family.seriesIds.map((id) => [id, 'p95']))
  const before = nfpScatterModel(events, now, id, selected.id, settings)
  assert.equal(before.inspection.earlierCount, 2); assert.equal(before.inspection.samples.length, 140)
  assert.equal(before.inspection.distribution.count, 140)
  for (const group of [groups[0], groups[70], groups.at(-1)]) {
    const model = nfpScatterModel(events, now, id, group.id, settings)
    assert.deepEqual(model.inspection.distribution.limits, before.inspection.distribution.limits)
    assert.deepEqual(model.inspection.distribution.bins, before.inspection.distribution.bins)
  }
  const arriving = release(now, 15, 'next')
  const updated = [...archive, ...arriving, ...futureWithValues]
  const after = nfpScatterModel(updated, now, id, selected.id, settings)
  assert.equal(after.inspection.earlierCount, 2); assert.equal(after.inspection.samples.length, 141)
  assert.deepEqual(familyMagnitudeHistory(updated, selected, family, settings, now)[selected.events.find((event) => event.event_id === id).value_id].distribution,
    after.inspection.distribution, 'Inspector and Scatter include the new release even when inspecting 2015')
  const corrected = updated.map((row) => row.value_id === archive[0].value_id ? { ...row, actual: 50, revision: 1 } : row)
  assert.equal(nfpScatterModel(corrected, now, id, selected.id, settings).inspection.samples.length, 141, 'A correction replaces a sample rather than growing N')
  const custom = { [id]: [1, 2, 3] }
  assert.deepEqual(nfpScatterModel(updated, now, id, selected.id, custom).inspection.distribution.limits, [1, 2, 3])
  const missingPrevious = [...archive, ...arriving.map((row) => ({ ...row, previous: null }))]
  assert.equal(nfpScatterModel(missingPrevious, now, id, selected.id, settings).inspection.samples.length, 140)
  const zeroRows = release(now, 0, 'zero')
  assert.equal(nfpScatterModel([...archive, ...zeroRows], now, id, selected.id, settings).inspection.samples.length, 141, 'Zero is a usable sample')

  let view
  function History({ selection = selected }) {
    const history = useFamilyMagnitudeHistory('Broker-A', selection, family)
    React.useEffect(() => { view = history }, [history])
    return null
  }
  family.settings.save(id, 'p95')
  const health = (revision) => ({ revision, collector_error: null, sources: [{ id: 'Broker-A', publisher_status: 'live' }] })
  const page = (rows, revision) => ({ source_id: 'Broker-A', revision, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: family.seriesIds, events: rows, coverage: { USD: { missing: [] } }, next_cursor: null })
  await React.act(async () => root.render(React.createElement(History)))
  await respond(requests[0], health(1)); await respond(requests[1], page(events, 1))
  const key = selected.events.find((event) => event.event_id === id).value_id
  assert.equal(view.rows[key].count, 140); assert.equal(view.rows[key].earlierCount, 2)
  const count = requests.length
  await React.act(async () => root.render(React.createElement(History, { selection: groups[0] })))
  assert.equal(requests.length, count, 'Selecting history never refetches the all-dataset query')
  await React.act(async () => root.render(React.createElement(History)))
  const poll = [...timers].at(-1); timers.delete(poll)
  await React.act(async () => { void poll() })
  await respond(requests[count], health(2)); await respond(requests[count + 1], page(updated, 2))
  assert.equal(view.rows[key].count, 141); assert.equal(view.rows[key].earlierCount, 2)
  const nextPoll = [...timers].at(-1); timers.delete(nextPoll)
  const unchangedStart = requests.length
  await React.act(async () => { void nextPoll() })
  await respond(requests[unchangedStart], health(2))
  assert.equal(requests.length, unchangedStart + 1, 'An unchanged storage revision does not reload inventory')

  // Exercise the production ten-series computation at the current inventory size.
  for (let index = 0; index < 10; index++) familyMagnitudeHistory(updated, selected, family, settings, now)
  const durations = Array.from({ length: 40 }, () => {
    const start = performance.now(); familyMagnitudeHistory(updated, selected, family, settings, now)
    return performance.now() - start
  }).sort((a, b) => a - b)
  console.log(`✓ All-dataset 2 / 140 counts, selection invariance, live 141st sample, revisions, zero/missing/future admission and no redundant inventory reloads; ten-series median ${durations[20].toFixed(2)} ms`)
} finally {
  await React.act(async () => root.unmount())
  Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
