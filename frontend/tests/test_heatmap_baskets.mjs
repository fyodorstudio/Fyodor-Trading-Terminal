import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

const dom = new Window({ url: 'http://localhost:5173' }), pending = [], timers = new Map()
let serial = 0
const globals = { window: dom, document: dom.document, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value: v })
dom.setTimeout = (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options) => new Promise(resolve => pending.push({ url, options, body: JSON.parse(options.body), resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client'), host = document.createElement('div'), root = createRoot(host)
document.body.append(host)
try {
  const m = await server.ssrLoadModule('./src/heatmap/basket-ranges.ts')
  const model = await server.ssrLoadModule('./src/heatmap/heatmap-model.ts')
  const events = await server.ssrLoadModule('./src/heatmap/event-window.ts')
  const { majorForexPairs } = await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  const { useBasketRanges } = await server.ssrLoadModule('./src/heatmap/useBasketRanges.ts')
  const point = (value, from, through) => ({ value, from, through, coverage: 7, relative: null, start: null, open: null, high: null, low: null, close: null, checkedAt: 1, reason: '' })
  const row = points => ({ id: 'basket:USD', label: 'USD basket', group: 'Currencies', checkedAt: 1, points: new Map(points) })
  const daily = row([['2026-11-16', point(10, '2026-11-13', '2026-11-16')], ['2026-11-17', point(-10, '2026-11-16', '2026-11-17')]])
  const range = (open, high, low, previous) => ({ open, high, low, previous, samples: 1440, expected: 1440, reason: 'M1-sampled basket range' })
  const response = { source_id: 'Pepperstone-Demo', generation: 2, sampling: 'M1', pending: 0,
    days: { '2026-11-16': { USD: range(2, 12, -1, '2026-11-13') }, '2026-11-17': { USD: range(-2, 4, -15, '2026-11-16') } } }
  const request = JSON.stringify({ currencies: ['USD'], pairs: { EURUSD: 'EURUSD' }, days: ['2026-11-16', '2026-11-17'] })
  assert.ok(m.validBasketRanges(response, 'Pepperstone-Demo', 2, request))
  assert.equal(m.validBasketRanges({ ...response, generation: 3 }, 'Pepperstone-Demo', 2, request), false)
  const bad = structuredClone(response); bad.days['2026-11-16'].USD.high = NaN
  assert.equal(m.validBasketRanges(bad, 'Pepperstone-Demo', 2, request), false)
  const enriched = m.applyBasketRanges([daily], [daily], response, 'daily')[0]
  assert.equal(model.formatHeatmapOHLC(enriched.points.get('2026-11-16')), 'O +2.00% · H +12.00% · L -1.00% · C +10.00%')
  assert.equal(daily.points.get('2026-11-16').start, null, 'Enrichment never mutates cached endpoint rows')
  const weekly = row([['2026-11-16', point(-1, '2026-11-13', '2026-11-17')]])
  const compounded = m.applyBasketRanges([weekly], [daily], response, 'weekly')[0]
  assert.equal(model.formatHeatmapOHLC(compounded.points.get('2026-11-16')), 'O +2.00% · H +14.40% · L -6.50% · C -1.00%')
  const missing = structuredClone(response); delete missing.days['2026-11-17']
  const incomplete = m.applyBasketRanges([weekly], [daily], missing, 'weekly')[0].points.get('2026-11-16')
  assert.equal(incomplete.high, null, 'A missing daily path cannot claim a complete weekly range')
  assert.equal(incomplete.value, -1, 'Existing C stays usable without minute history')
  const missingDay = row([['2026-11-16', daily.points.get('2026-11-16')], ['2026-11-18', point(-10, '2026-11-16', '2026-11-18')]])
  const missingWeek = row([['2026-11-16', point(-1, '2026-11-13', '2026-11-18')]])
  const missingDayRanges = { ...response, days: { '2026-11-16': response.days['2026-11-16'], '2026-11-18': { USD: range(-2, 4, -15, '2026-11-16') } } }
  assert.equal(m.applyBasketRanges([missingWeek], [missingDay], missingDayRanges, 'weekly')[0].points.get('2026-11-16').high, null,
    'A wholly absent weekday cannot silently disappear from weekly extremes')
  const periods = model.heatmapPeriods(2026, 'weekly', '2026-11-18', 11)
  const scope = JSON.parse(m.basketRequest(['basket:USD'], [{ symbol: 'EURUSD.a', description: '' }], periods, '2026-11-18'))
  assert.ok(scope.days.length <= 42 && scope.days.every(d => d <= '2026-11-18'))
  assert.equal(scope.pairs.EURUSD, 'EURUSD.a')
  const anchor = Date.parse('2026-11-18T07:00:00Z'), latent = [{}, { USD: .02 }, { USD: .01, EUR: .03 }, {}]
  const symbols = Object.fromEntries(majorForexPairs.map(pair => [pair, { availability: 'available', checked_at: anchor / 1000 + 180,
    bars: latent.map((levels, i) => {
      const quote = state => 100 * Math.exp((state[pair.slice(0, 3)] ?? 0) - (state[pair.slice(3)] ?? 0))
      return { time: anchor / 1000 + (i - 1) * 60, open: quote(latent[Math.max(0, i - 1)]), close: quote(levels), high: 500, low: 1 }
    }) }]))
  const eventRows = events.eventRows(['basket:USD', 'basket:EUR'], majorForexPairs.map(symbol => ({ symbol, description: '' })), 'Pepperstone-Demo',
    { observed_at: anchor / 1000 + 180, symbols }, { from: anchor, through: anchor + 180_000, anchor, minutes: 1 })
  assert.ok(Math.abs(eventRows[0].points.get('window').high - 100 * Math.exp(.02)) < 1e-9, 'USD retains its own earlier peak')
  assert.ok(Math.abs(eventRows[1].points.get('window').high - 100 * Math.exp((8 * .03 - .04) / 7)) < 1e-9, 'EUR retains its own later peak')
  let state
  function Probe({ generation = 2, enabled = true, attempt = 0 }) {
    const snapshot = useBasketRanges('Pepperstone-Demo', generation, request, attempt, enabled)
    React.useLayoutEffect(() => { state = snapshot }, [snapshot])
    return React.createElement('span', null, snapshot.data?.sampling ?? snapshot.error ?? 'loading')
  }
  await React.act(async () => root.render(React.createElement(Probe)))
  assert.equal(pending[0].url, '/storage-api/heatmap/baskets')
  const first = pending.shift()
  await React.act(async () => first.resolve({ ok: true, json: async () => response }))
  assert.equal(state.data.sampling, 'M1')
  assert.ok([...timers.values()].some(t => t.ms === 20_000))
  await React.act(async () => root.render(React.createElement(Probe, { attempt: 1 })))
  assert.ok(pending[0].body.retry)
  const stale = pending.shift()
  await React.act(async () => root.render(React.createElement(Probe, { generation: 3, attempt: 1 })))
  assert.ok(stale.options.signal.aborted)
  await React.act(async () => stale.resolve({ ok: true, json: async () => response }))
  assert.equal(state.data, null, 'A late old-account response cannot enter the new scope')
  const current = pending.shift()
  await React.act(async () => current.resolve({ ok: false, status: 503 }))
  assert.match(state.error, /Closing returns remain available/)
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0)
  console.log('✓ Basket ranges: synchronized fields, weekly rebasing, missing history, bounded scopes, retries and stale replies')
} finally {
  await server.close()
  dom.happyDOM.abort()
  for (const [k, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, k, descriptor)
    else delete globalThis[k]
  }
}
