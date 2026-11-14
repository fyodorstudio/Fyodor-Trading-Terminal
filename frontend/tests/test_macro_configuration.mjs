import assert from 'node:assert/strict'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
try {
  const p = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  const { macroCatalog, isMacroTextEvent } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-catalog.ts')
  const { initializeMacroWorkspace } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-workspace.ts')
  const { macroHistory, macroValue } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-data.ts')
  const key = (currency, id) => Object.keys(macroCatalog).find(key => macroCatalog[key].currency === currency && (!id || macroCatalog[key].eventId === id))
  const eur = key('EUR', '999010006'), chf = key('CHF', '756010001')
  let preferences = initializeMacroWorkspace({ ...p.defaultMacroPreferences, enabled: true, activeCurrency: 'USD', currencies: ['USD'], eventsByCurrency: { USD: ['rate'] }, essentialsVersion: 1, workspaceVersion: 2, showEventRow: false })
  preferences = p.setMacroEvents(preferences, 'EUR', [eur]); preferences = p.setMacroEvents(preferences, 'CHF', [chf])
  preferences = { ...preferences, series: { ...preferences.series, [eur]: { ...preferences.series[eur], color: '#123456' } } }
  preferences = p.switchMacroCurrency(preferences, 'EUR')
  assert.deepEqual(p.selectedMacroMetrics(preferences), [eur])
  preferences = { ...preferences, showEventRow: false, layout: { ...preferences.layout, rowOrder: [eur], laneSpacing: 39, hiddenCategories: ['inflation'] } }
  preferences = p.switchMacroCurrency(preferences, 'CHF')
  assert.equal(preferences.showEventRow, true)
  preferences = { ...preferences, showEventRow: true, layout: { ...preferences.layout, laneSpacing: 55 } }
  preferences = p.switchMacroCurrency(preferences, 'EUR')
  assert.equal(preferences.showEventRow, false); assert.equal(preferences.layout.laneSpacing, 39)
  assert.deepEqual(preferences.layout.hiddenCategories, ['inflation'])
  assert.equal(preferences.series[eur].color, '#123456')
  p.saveMacroPreferences(preferences)
  assert.deepEqual(p.readMacroPreferences('BTCUSD'), preferences, 'All instruments share one working configuration')
  const calendarAt = Date.UTC(2026, 0, 1), definition = macroCatalog[eur]
  const event = { value_id: 'eur', event_id: definition.eventId, currency: 'EUR', country_code: definition.country, actual: 2, forecast: 0,
    previous: 1.75, release_at: calendarAt, chart_time_seconds: calendarAt / 1000, availability: 'observed', time_mode: 0, revision: 0, unit: 1, multiplier: 0, digits: 2 }
  assert.equal(macroHistory([event, { ...event, currency: 'USD', actual: 99 }], calendarAt, 'actual', [eur])[eur].length, 1)
  assert.equal(macroValue(eur, 2, event), '2.00%')
  const speech = Object.keys(macroCatalog).find(key => macroCatalog[key].currency === 'EUR' && isMacroTextEvent(key))
  assert.ok(speech)
  const requests = []
  globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url: String(url), signal: options?.signal, resolve }))
  const { useMacroIndicator } = await server.ssrLoadModule('./src/market-data/indicators/macro/useMacroIndicator.ts')
  let view
  function Harness({ symbol = 'EURUSD' }) { const next = useMacroIndicator(symbol, 'A'); React.useLayoutEffect(() => { view = next }, [next]); return null }
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.equal(requests.length, 1)
  await React.act(async () => requests[0].resolve({ ok: true, json: async () => ({ revision: 1, sources: [{ id: 'A' }], collector_error: null }) }))
  const query = requests.at(-1), params = new URL(query.url, 'http://localhost').searchParams
  assert.equal(params.get('event_ids'), definition.eventId)
  await React.act(async () => query.resolve({ ok: true, json: async () => ({ source_id: 'A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart', event_ids: [definition.eventId], events: [event], next_cursor: null }) }))
  assert.equal(view.macro.history[eur][0].value, 2)
  const count = requests.length, data = view.macro.history
  await React.act(async () => root.render(React.createElement(Harness, { symbol: 'XAUUSD' })))
  assert.equal(view.macro.history, data); assert.equal(requests.length, count, 'Symbol changes reuse the active currency snapshot')
  await React.act(async () => view.changeMacro({ ...view.macroPreferences, showEventRow: true }))
  assert.equal(requests.length, count, 'No announcements are queried when none are selected')
  await React.act(async () => view.changeMacro(p.setMacroEvents(view.macroPreferences, 'EUR', [eur, speech])))
  assert.equal(requests.length, count + 1)
  await React.act(async () => requests.at(-1).resolve({ ok: true, json: async () => ({ revision: 1, sources: [{ id: 'A' }], collector_error: null }) }))
  assert.equal(new URL(requests.at(-1).url, 'http://localhost').searchParams.get('event_ids'), macroCatalog[speech].eventId)
  const pending = requests.at(-1)
  await React.act(async () => view.changeMacro(p.setMacroEvents(view.macroPreferences, 'EUR', [eur])))
  assert.equal(pending.signal.aborted, true, 'Unselecting an announcement cancels its request')
  await React.act(async () => view.changeMacro(p.setMacroEvents(view.macroPreferences, 'EUR', [])))
  assert.deepEqual(p.selectedMacroMetrics(view.macroPreferences), [])
  console.log('✓ MFDI configuration: active currency, independent row/announcement visibility, ordered layouts, persistence, exact series and selected-only speech polling/cancellation')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key] }
}
