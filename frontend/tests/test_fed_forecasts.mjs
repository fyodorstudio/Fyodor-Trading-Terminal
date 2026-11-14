import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const timers = new Map(), requests = []; let timerId = 0
dom.setTimeout = fn => { timers.set(++timerId, fn); return timerId }; dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url: String(url), signal: options.signal, resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const release = '2026-10-28T18:00:00Z'
const evidence = { url: 'https://www.investing.com/economic-calendar/interest-rate-decision-168',
  captured_at: '2026-10-29T00:00:00Z', as_of: null, timing: 'historical_backfill', note: 'Synthetic test fixture' }
const payload = () => ({ schema: 1, meetings: [{ released_at: release, actual: { ...evidence,
  url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm', lower: 3.75, upper: 4 },
  consensus: [{ ...evidence, provider: 'investing', value: 4 }, { ...evidence, url: 'https://tradingeconomics.com/united-states/interest-rate', provider: 'trading_economics', value: 3.75 }],
  fedwatch: { ...evidence, url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html', as_of: '2026-10-28T17:00:00Z',
    outcomes: [{ lower: 3.75, upper: 4, probability: 80 }, { lower: 4, upper: 4.25, probability: 20 }] } }] })
const reply = (request, body, ok = true) => React.act(async () => request.resolve({ ok, status: ok ? 200 : 503, json: async () => body }))
try {
  const { parseFedForecasts, fedSurprise } = await server.ssrLoadModule('./src/market-data/indicators/macro/fed-forecast.ts')
  const parsed = parseFedForecasts(payload())
  assert.equal(parsed.get(Date.parse(release)).actual.upper, 4)
  assert.equal(fedSurprise(4, 3.75).text, 'Beat · hawkish surprise · +25 bp')
  assert.equal(fedSurprise(3.75, 4).text, 'Miss · dovish surprise · -25 bp')
  assert.equal(fedSurprise(4, 4).text, 'In line · 0 bp')
  assert.equal(fedSurprise(0.3, 0.1 + 0.2).label, 'In line', 'Float noise is not a surprise')
  for (const mutate of [
    body => { body.meetings[0].consensus[0].provider = 'TEForecast' },
    body => { body.meetings[0].consensus[0].value = NaN },
    body => { body.meetings[0].consensus[0].url = 'https://investing.com.evil.example/x' },
    body => { body.meetings[0].consensus[0].captured_at = '2026-10-29T00:00:00' },
    body => { body.meetings[0].consensus[0].captured_at = '2099-01-01T00:00:00Z' },
    body => { body.meetings[0].consensus[0].timing = 'pre_release' },
    body => { body.meetings[0].consensus[0].as_of = release },
    body => { body.meetings[0].fedwatch.as_of = null },
    body => { body.meetings[0].fedwatch.outcomes.pop() },
    body => { body.meetings.push(body.meetings[0]) },
  ]) { const body = payload(); mutate(body); assert.throws(() => parseFedForecasts(body)) }
  const { useFedForecasts } = await server.ssrLoadModule('./src/market-data/indicators/macro/useFedForecasts.ts')
  let view
  function Harness({ active }) { const next = useFedForecasts(active); React.useLayoutEffect(() => { view = next }, [next]); return null }
  const render = active => React.act(async () => root.render(React.createElement(Harness, { active })))
  await render(false); assert.equal(requests.length, 0)
  await render(true); assert.equal(requests.length, 1); assert.equal(requests[0].url, '/storage-api/fed-forecasts')
  await reply(requests[0], payload()); const stable = view.meetings
  assert.equal(stable.size, 1); assert.equal(timers.size, 1)
  const poll = async () => React.act(async () => { const [key, fn] = [...timers][0]; timers.delete(key); fn() })
  await poll(); await reply(requests.at(-1), payload())
  assert.equal(view.meetings, stable, 'Unchanged snapshots retain data/callback identities')
  await poll(); await reply(requests.at(-1), {}, false)
  assert.equal(view.meetings, stable, 'Temporary failure retains last verified values')
  assert.match(view.status, /unavailable/)
  await poll(); await reply(requests.at(-1), payload())
  assert.equal(view.status, 'Saved external Fed evidence', 'Recovery clears stale/error label')
  await poll(); const obsolete = requests.at(-1)
  await render(false); assert.equal(obsolete.signal.aborted, true); assert.equal(timers.size, 0)
  await reply(obsolete, payload()); assert.equal(view.meetings.size, 0, 'Late replies never reactivate a disabled indicator')
  await React.act(async () => root.render(null))
  // The production MFDI hook adopts official upper bounds by exact publication
  // UTC while retaining the raw MT5 reading and identity for Inspector.
  const { useMacroIndicator } = await server.ssrLoadModule('./src/market-data/indicators/macro/useMacroIndicator.ts')
  const { defaultMacroPreferences, saveMacroPreferences } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  saveMacroPreferences({ ...defaultMacroPreferences, enabled: true, showEventRow: false })
  function MacroHarness({ symbol = 'USDX' }) { const next = useMacroIndicator(symbol, 'A'); React.useLayoutEffect(() => { view = next }, [next]); return null }
  await React.act(async () => root.render(React.createElement(MacroHarness)))
  const forecastRequest = requests.findLast(row => row.url === '/storage-api/fed-forecasts')
  const health = requests.findLast(row => row.url.includes('/health'))
  await reply(forecastRequest, payload())
  await reply(health, { revision: 1, sources: [{ id: 'A', coverage: {} }], collector_error: null })
  const calendar = requests.findLast(row => row.url.includes('/calendar?'))
  const raw = { value_id: 'fed-exact', event_id: '840050014', currency: 'USD', country_code: 'US', unit: 1, multiplier: 0, time_mode: 0,
    actual: 3.75, forecast: 999, release_at: Date.parse(release), chart_time_seconds: Date.parse(release) / 1000 + 7200, availability: 'observed', revision: 0 }
  await reply(calendar, { source_id: 'A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: ['840030005', '840030006', '840030015', '840030016', '840050014'], events: [raw, { ...raw, value_id: 'different-release', release_at: Date.parse(release) - 86400000, chart_time_seconds: raw.chart_time_seconds - 86400 }], coverage: {}, next_cursor: null })
  assert.equal(view.macro.history.rate[1].value, 4); assert.equal(view.macro.history.rate[1].brokerValue, 3.75)
  assert.equal(view.macro.history.rate[1].id, 'fed-exact'); assert.equal(view.macro.history.rate[1].time, raw.chart_time_seconds)
  assert.equal(view.macro.history.rate[0].value, 3.75, 'Another release never borrows this meeting’s external evidence')
  assert.equal(view.macro.forecastHistory.rate[1].value, 4, 'The F curve uses saved primary Fed consensus at the exact release')
  assert.equal(view.macro.forecastHistory.rate[0].value, 999, 'A different release retains its own captured calendar forecast')
  assert.equal(raw.actual, 3.75, 'Raw calendar records are not overwritten')
  const sharedFedHistory = view.macro.history.rate, pairRequestCount = requests.length
  await React.act(async () => root.render(React.createElement(MacroHarness, { symbol: 'EURUSD' })))
  assert.equal(view.macro.enabled, true, 'The universal MFDI stays enabled when changing pairs')
  assert.equal(view.macro.history.rate, sharedFedHistory)
  assert.equal(requests.length, pairRequestCount, 'Changing pairs reuses the same saved Fed evidence and calendar snapshot')
  console.log('✓ Fed forecasts: separate survey/market evidence, Beat/Miss/In line, provenance/clock validation, stable local polling, recovery/cancellation, official upper bounds and raw MT5 conflicts')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  assert.equal(timers.size, 0)
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
