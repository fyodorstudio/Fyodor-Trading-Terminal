import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
const previousFetch = globalThis.fetch
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
try {
  const { macroCatalog } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-catalog.ts')
  const { readMacroPreferences, saveMacroPreferences, selectedMacroMetrics, setMacroCurrency, setMacroEvents, defaultMacroPreferences, toggleMacroAll } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  const { macroHistory, macroUpcoming, macroValue, supportsMacro } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-data.ts')
  const { majorForexPairs } = await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  assert.deepEqual(selectedMacroMetrics(readMacroPreferences('USDX')), [], 'A new shared setup starts with no currencies selected')
  const legacy = { ...defaultMacroPreferences, enabled: true, series: { ...defaultMacroPreferences.series,
    payrolls: { ...defaultMacroPreferences.series.payrolls, color: '#123456', lineWidth: 4, visible: false, numbersVisible: true } } }
  dom.localStorage.setItem('fyodor.indicators.macro.v1', JSON.stringify(legacy))
  let usd = readMacroPreferences('USDX.a')
  assert.equal(usd.enabled, true)
  assert.deepEqual(usd.series.payrolls, legacy.series.payrolls, 'USDX retains existing styles, eyes, forecasts and N choices')
  assert.equal(selectedMacroMetrics(usd).length, 5)
  for (const symbol of [...majorForexPairs, 'EURX', 'JPYX', 'XAUUSD', 'BTCUSD', 'CUSTOM-SYMBOL']) {
    assert.ok(supportsMacro(symbol))
    const p = readMacroPreferences(symbol)
    assert.deepEqual(p, usd, `${symbol}: inherits the same legacy configuration before the universal profile is saved`)
  }
  const find = (currency, name) => Object.entries(macroCatalog).find(([, event]) => event.currency === currency && event.label.toLowerCase().includes(name.toLowerCase()))?.[0]
  const pce = find('USD', 'Core PCE Price Index m/m'), eur = find('EUR', 'm/m'), jpy = find('JPY', 'y/y')
  assert.ok(pce && eur && jpy)
  for (const name of ['Average Hourly Earnings m/m', 'ISM Manufacturing', 'ISM Non-Manufacturing', 'Retail Sales m/m', 'GDP'])
    assert.ok(find('USD', name), `${name} is selectable without a code change`)
  const archivedProfiles = { USDX: { enabled: true, currencies: ['USD'], axisTarget: 'rate' }, EURUSD: {
    enabled: false, currencies: ['EUR'], axisTarget: eur, layout: { hideLegend: false, laneMode: true, categoryOrder: [], rowOrder: [eur], collapsed: [], laneOffset: 35, laneSpacing: 40 } } }
  dom.localStorage.setItem('fyodor.indicators.macro.v2', JSON.stringify({ eventsByCurrency: { USD: Object.keys(defaultMacroPreferences.series), EUR: [eur] }, styles: { ...legacy.series, [eur]: { ...legacy.series.rate, color: '#654321' } }, symbols: archivedProfiles }))
  const { useMacroIndicator: useMigrationIndicator } = await server.ssrLoadModule('./src/market-data/indicators/macro/useMacroIndicator.ts')
  let migratedView
  function MigrationHarness() { const next = useMigrationIndicator('EURUSD', null); React.useLayoutEffect(() => { migratedView = next }, [next]); return null }
  await React.act(async () => root.render(React.createElement(MigrationHarness)))
  assert.deepEqual(migratedView.macroPreferences.currencies, ['EUR'], 'Migration adopts the current symbol rather than overwriting it with another profile')
  assert.equal(migratedView.macroPreferences.layout.laneOffset, 35)
  assert.equal(migratedView.macroPreferences.series[eur].color, '#654321')
  const migratedStorage = JSON.parse(dom.localStorage.getItem('fyodor.indicators.macro.v2'))
  assert.deepEqual(migratedStorage.symbols, archivedProfiles, 'Migration retains the original symbol profiles')
  assert.deepEqual(migratedStorage.global.currencies, ['EUR'], 'Mounting seeds the shared profile before any pair change or manual save')
  assert.deepEqual(readMacroPreferences('USDX'), migratedView.macroPreferences)
  await React.act(async () => root.render(null))
  dom.localStorage.removeItem('fyodor.indicators.macro.v2')
  usd = setMacroEvents(usd, 'USD', ['rate', pce])
  saveMacroPreferences(usd, 'USDX')
  let metal = setMacroCurrency(readMacroPreferences('XAUUSD'), 'USD', true)
  assert.deepEqual(selectedMacroMetrics(metal), ['rate', pce], 'Ticking USD on another symbol restores the saved USD list')
  metal = setMacroEvents(setMacroCurrency(metal, 'EUR', true), 'EUR', [eur])
  metal = setMacroEvents(setMacroCurrency(metal, 'JPY', true), 'JPY', [jpy])
  metal = { ...metal, enabled: true, axisTarget: eur }
  metal.series[eur] = { ...metal.series[eur], color: '#654321', numbersVisible: true, forecastVisible: true }
  saveMacroPreferences(metal, 'XAUUSD')
  assert.deepEqual(readMacroPreferences('XAUUSD'), metal, 'Refresh preserves currency ticks, lists, selected axis and styles')
  const unticked = setMacroCurrency(readMacroPreferences('XAUUSD'), 'EUR', false)
  for (const field of ['visible', 'forecastVisible', 'numbersVisible']) {
    const off = toggleMacroAll({ ...unticked, series: { ...unticked.series, rate: { ...unticked.series.rate, [field]: true } } }, field)
    assert.ok(selectedMacroMetrics(off).every(key => !off.series[key][field]))
    assert.deepEqual(off.series[eur], unticked.series[eur], 'Universal controls preserve styles of unticked currencies')
    const on = toggleMacroAll(off, field)
    assert.ok(selectedMacroMetrics(on).every(key => on.series[key][field]))
    for (const key of selectedMacroMetrics(on)) {
      const { [field]: _ignoredOn, ...restOn } = on.series[key]
      const { [field]: _ignoredBefore, ...restBefore } = unticked.series[key]
      assert.deepEqual(restOn, restBefore, 'Universal toggles preserve other style fields')
    }
  }
  saveMacroPreferences(unticked, 'XAUUSD')
  assert.ok(!selectedMacroMetrics(readMacroPreferences('XAUUSD')).includes(eur))
  metal = setMacroCurrency(readMacroPreferences('XAUUSD'), 'EUR', true)
  assert.ok(selectedMacroMetrics(metal).includes(eur), 'Unticking a currency never deletes its saved events')
  assert.equal(metal.series[eur].color, '#654321')
  assert.deepEqual(readMacroPreferences('EURUSD'), unticked, 'All symbols now share enabled currencies, layout and styles')
  assert.ok(selectedMacroMetrics(setMacroCurrency(readMacroPreferences('EURUSD'), 'JPY', true)).includes(jpy), 'Currency presets are reusable independently of symbol currencies')
  const at = Date.UTC(2026, 0, 1), definition = macroCatalog[pce]
  const sample = { value_id: 'pce', event_id: definition.eventId, currency: 'USD', country_code: 'US',
    actual: -0.2, forecast: 0, previous: 0.1, impact: 'negative', release_at: at, chart_time_seconds: at / 1000, revision: 0, availability: 'observed', time_mode: 0, unit: 1, multiplier: 0, digits: 2 }
  const history = macroHistory([sample, { ...sample, value_id: 'wrong-country', country_code: 'CA', actual: 99 }], at, 'actual', [pce])
  assert.equal(history[pce].length, 1)
  assert.equal(history[pce][0].currency, 'USD')
  assert.equal(history[pce][0].forecast, 0)
  assert.equal(history[pce][0].previous, 0.1)
  assert.equal(history[pce][0].impact, 'negative')
  assert.equal(macroValue(pce, history[pce][0].value, history[pce][0]), '-0.20%')
  assert.equal(macroHistory([sample], at, 'forecast', [pce])[pce][0].value, 0)
  assert.deepEqual(macroUpcoming([{ ...sample, release_at: at + 86400000 }], at, [pce])[0].forecasts, { [pce]: 0 })
  assert.equal(macroHistory([{ ...sample, chart_time_seconds: null }], at, 'actual', [pce])[pce].length, 0)
  let idReads = 0
  const workKeys = Object.keys(macroCatalog).slice(0, 30)
  const workRows = workKeys.flatMap(key => Array.from({ length: 20 }, (_, index) => {
    const definition = macroCatalog[key]
    return { ...sample, currency: definition.currency, country_code: definition.country,
      value_id: `${key}-${index}`, unit: definition.unit ?? 1, multiplier: definition.multiplier ?? 0,
      get event_id() { idReads++; return definition.eventId } }
  }))
  macroHistory(workRows, at, 'actual', workKeys)
  assert.ok(idReads <= workRows.length * 4, 'History admission indexes events once instead of rescanning every row for every selected series')

  const { MacroSettingsDialog } = await server.ssrLoadModule('./src/market-data/indicators/macro/MacroSettingsDialog.tsx')
  let saved = null, closed = 0
  const render = () => React.act(async () => root.render(React.createElement(MacroSettingsDialog, { symbol: 'EURUSD', preferences: readMacroPreferences('EURUSD'), onSave: next => { saved = next }, onClose: () => { closed++ } })))
  const button = text => [...host.querySelectorAll('button')].find(node => node.textContent === text)
  const input = label => host.querySelector(`[aria-label="${label}"]`)
  const beforeDraft = readMacroPreferences('EURUSD')
  await render()
  assert.match(host.querySelector('header').textContent, /All symbols/)
  await React.act(async () => input('Show USD events').click())
  await React.act(async () => input('Show USD events').click())
  assert.ok(input(`Remove ${macroCatalog[pce].controlLabel}`), 'Currency tick restores its selected event rows')
  await React.act(async () => button('+ Add events').click())
  const search = input('Search MFDI events')
  const reactProps = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
  await React.act(async () => reactProps(search).onChange({ target: { value: 'Hourly Earnings m/m' } }))
  const earnings = find('USD', 'Average Hourly Earnings m/m')
  await React.act(async () => input(`Select ${macroCatalog[earnings].controlLabel}`).click())
  assert.ok(input(`Remove ${macroCatalog[earnings].controlLabel}`))
  await React.act(async () => input(`Remove ${macroCatalog[pce].controlLabel}`).click())
  assert.equal(input(`Remove ${macroCatalog[pce].controlLabel}`), null)
  assert.equal(saved, null, 'Selector edits remain drafts before OK')
  assert.deepEqual(readMacroPreferences('EURUSD'), beforeDraft, 'Drafts do not leak into the shared configuration')
  await React.act(async () => host.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.ok(selectedMacroMetrics(saved).includes(earnings))
  assert.ok(!selectedMacroMetrics(saved).includes(pce))
  assert.equal(closed, 1)
  saveMacroPreferences(saved, 'EURUSD')
  assert.deepEqual(selectedMacroMetrics(readMacroPreferences('EURUSD')), selectedMacroMetrics(saved))
  await React.act(async () => root.render(null))

  // Run the production hook with two event currencies on an unrelated symbol.
  const { useMacroIndicator } = await server.ssrLoadModule('./src/market-data/indicators/macro/useMacroIndicator.ts')
  let profile = setMacroEvents(setMacroCurrency({ ...readMacroPreferences('BTCUSD'), currencies: [] }, 'EUR', true), 'EUR', [eur])
  profile = setMacroEvents(setMacroCurrency(profile, 'JPY', true), 'JPY', [jpy])
  saveMacroPreferences({ ...profile, enabled: true }, 'BTCUSD')
  const requests = []
  globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url: String(url), signal: options.signal, resolve }))
  let view
  function Harness({ symbol = 'BTCUSD' }) {
    const next = useMacroIndicator(symbol, 'A')
    React.useLayoutEffect(() => { view = next }, [next])
    return null
  }
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.equal(requests.length, 1, 'Only the selected calendar is requested; unrelated Fed evidence is not fetched')
  await React.act(async () => requests[0].resolve({ ok: true, json: async () => ({ revision: 1, sources: [{ id: 'A', coverage: {} }], collector_error: null }) }))
  const calendar = requests.at(-1), params = new URL(calendar.url, 'http://localhost').searchParams
  assert.equal(params.get('event_ids'), [macroCatalog[eur].eventId, macroCatalog[jpy].eventId].sort().join(','))
  assert.equal(params.get('currencies'), 'EUR,JPY')
  const rows = [eur, jpy].map(key => ({ ...sample, value_id: key, event_id: macroCatalog[key].eventId, currency: macroCatalog[key].currency, country_code: macroCatalog[key].country }))
  await React.act(async () => calendar.resolve({ ok: true, json: async () => ({ source_id: 'A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart', event_ids: params.get('event_ids').split(','), events: rows, next_cursor: null }) }))
  assert.equal(view.macro.history[eur][0].currency, 'EUR')
  assert.equal(view.macro.history[jpy][0].currency, 'JPY')
  assert.equal(view.macro.status, '', 'Successful data has no static source caption')
  const count = requests.length, snapshot = view.macro.history, sharedPreferences = view.macroPreferences, sharedChange = view.changeMacro
  for (const symbol of [...majorForexPairs, 'EURX', 'JPYX', 'XAUUSD', 'CUSTOM-SYMBOL']) {
    await React.act(async () => root.render(React.createElement(Harness, { symbol })))
    assert.equal(view.macro.enabled, true)
    assert.equal(view.macroPreferences, sharedPreferences, 'Changing pairs keeps the exact preferences object intact')
    assert.equal(view.changeMacro, sharedChange, 'Changing pairs does not replace callbacks')
    assert.equal(view.macro.history, snapshot, 'Pair changes reuse the captured macro histories')
    assert.equal(requests.length, count, 'Pair changes do not refetch the same selected calendar')
    assert.deepEqual(readMacroPreferences(symbol), sharedPreferences)
  }
  await React.act(async () => view.changeMacro({ ...view.macroPreferences, currencies: [] }))
  assert.deepEqual(selectedMacroMetrics(view.macroPreferences), [])
  assert.equal(view.macro.enabled, true)
  assert.equal(requests.length, count, 'An enabled shared configuration without currencies performs no calendar requests')
  await React.act(async () => view.toggleMacro())
  await React.act(async () => root.render(React.createElement(Harness, { symbol: 'EURUSD' })))
  assert.equal(view.macro.enabled, false, 'Indicator visibility is universal too')
  console.log('✓ MFDI configuration: legacy USDX preservation, universal configuration across all symbols, reusable currency presets and styles, exact multi-currency numeric history, selector add/remove/search/draft/save')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  globalThis.fetch = previousFetch
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
