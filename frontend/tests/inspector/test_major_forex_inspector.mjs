import fs from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

globalThis.__majorGroupingWork = 0
globalThis.__majorAdmissionWork = 0
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'major-grouping-work', enforce: 'pre', transform(code) {
    const admission = 'export function inspectorFamilyForEvent(event: { country_code: string; currency: string; event_id: string }) {'
    if (code.includes(admission)) return code.replace(admission, `${admission}globalThis.__majorAdmissionWork += 1;`)
    const signature = 'const allReleases = useMemo(() => groupInspectorReleases(pairReadings), [pairReadings])'
    if (code.includes(signature)) return code.replace(signature, 'const allReleases = useMemo(() => { globalThis.__majorGroupingWork += 1; return groupInspectorReleases(pairReadings) }, [pairReadings])')
  } }] })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const utc = { mode: 'utc', utcOffsetMinutes: 0 }, at = Date.UTC(2026, 9, 1, 12)
const event = (event_id, currency = 'GBP', country_code = 'GB', extra = {}) => ({ value_id: event_id, event_id,
  server_time_seconds: at / 1000, release_at: at, period_seconds: Date.UTC(2026, 8, 1) / 1000,
  revision: 0, currency, country_code, country_name: country_code, name: event_id, event_code: event_id,
  importance: 'high', unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none',
  actual: 0.3, previous: 0.1, revised_previous: 0.2, forecast: 0.4, ...extra })
const bars = [at / 1000 - 3600, at / 1000, at / 1000 + 3600].map(time => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))
const clockOffsetMs = at - Date.now()
const scale = { getVisibleLogicalRange: () => ({ from: 0, to: 2 }), timeToCoordinate: () => 100,
  logicalToCoordinate: i => i * 100, timeToIndex: () => 1, width: () => 800,
  getVisibleRange: () => ({ from: bars[0].time, to: bars[2].time }),
  subscribeVisibleLogicalRangeChange() {}, unsubscribeVisibleLogicalRangeChange() {}, subscribeSizeChange() {}, unsubscribeSizeChange() {} }
const chartApi = { timeScale: () => scale, subscribeClick() {}, unsubscribeClick() {} }
const click = async selector => { const node = document.querySelector(selector); assert.ok(node, selector); await React.act(async () => node.click()) }
const change = async (selector, value) => {
  const node = document.querySelector(selector); assert.ok(node, selector)
  await React.act(async () => {
    const props = node[Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactProps$'))]
    if (props) props.onChange({ target: { value } })
    else { node.value = value; node.dispatchEvent(new dom.Event('change', { bubbles: true })) }
  })
}
try {
  const domainRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/economic-calendar')
  for (const filename of fs.readdirSync(domainRoot, { recursive: true }).filter(name => /\.tsx?$/.test(name))) {
    const absolute = path.join(domainRoot, filename)
    const source = fs.readFileSync(absolute, 'utf8')
    for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue
      const target = path.resolve(path.dirname(absolute), match[1])
      assert.ok(!/[/\\](inspector|scoring-system|usd-context|pair-context|raycaster)[/\\]/.test(target),
        `Shared calendar must not depend on UI or scorer modules: ${filename} -> ${match[1]}`)
    }
  }
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { majorForexPairs, forexPairCurrencies } = await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  const { majorCurrencies } = await server.ssrLoadModule('./src/economic-calendar/forex/currencies.ts')
  const { eventFamilyOptions } = await server.ssrLoadModule('./src/economic-calendar/catalog/index.ts')
  const { inspectorFilterRows } = await server.ssrLoadModule('./src/inspector/filters/inspector-filter-rows.ts')
  const { AlertFiltersModal } = await server.ssrLoadModule('./src/alert/dock/AlertFiltersModal.tsx')
  const { defaultAlertPreferences } = await server.ssrLoadModule('./src/alert/model/alert-preferences.ts')
  const { policyEpisodeRules } = await server.ssrLoadModule('./src/inspector/episodes/policy-episodes.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { markerLabel } = await server.ssrLoadModule('./src/inspector/chart/marker-label.ts')
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/major-calendar-catalog.json', import.meta.url), 'utf8'))
  assert.equal(fixture.length, 1051, 'Complete exported MT5 catalog, including low importance and holidays')
  for (const source of fixture) {
    const family = eventFamilyOptions.find(f => f.events.includes(source.event_id))
    assert.equal(family.currency, source.country_currency)
    assert.equal(family.country, source.country_code)
    const controls = inspectorFilterRows.filter(control => control.ids.includes(family.id))
    assert.equal(controls.length, 1, `${source.event_id}: exactly one visible filter control`)
    assert.ok(controls[0].search.includes(source.event_id), `${source.event_id}: searchable by source ID`)
    for (const term of source.event_name.toLowerCase().split(/\s+/).filter(Boolean)) {
      assert.ok(controls[0].search.toLowerCase().includes(term), `${source.event_id}: searchable by source name ${source.event_name}`)
    }
    const row = event(source.event_id, source.country_currency, source.country_code, {
      name: source.event_name, unit: +source.unit_code, multiplier: +source.multiplier_code, digits: +source.digits,
    })
    assert.equal(data.groupInspectorReleases([row])[0].events[0].name, source.event_name)
    assert.equal(data.groupInspectorReleases([{ ...row, country_code: 'WRONG' }]).length, 0)
  }
  // A large calendar with unrelated IDs performs one admission lookup per row,
  // rather than scanning the growing family catalog for each observation.
  const unrelated = Array.from({ length: 10000 }, (_, i) => event(`unknown-${i}`, 'JPY', 'JP'))
  const admissionBefore = globalThis.__majorAdmissionWork
  assert.equal(data.groupInspectorReleases(unrelated).length, 0)
  assert.equal(globalThis.__majorAdmissionWork - admissionBefore, unrelated.length)
  assert.equal(majorForexPairs.length, 28)
  assert.equal(majorForexPairs.filter(p => p.includes('USD')).length, 7)
  assert.equal(majorForexPairs.filter(p => !p.includes('USD')).length, 21)
  const completeRows = fixture.map(source => event(source.event_id, source.country_currency, source.country_code, { name: source.event_name }))
  const completeReleases = data.groupInspectorReleases(completeRows)
  const completeRange = { from: at - 86400000, to: at + 86400000 }
  for (const pair of majorForexPairs) {
    const preferences = data.defaultInspectorPreferences(pair)
    const filtered = data.filterInspectorReleases(completeReleases, preferences, completeRange)
    const expected = fixture.filter(source => forexPairCurrencies(pair).includes(source.country_currency)).map(source => source.event_id)
    assert.deepEqual(new Set(filtered.flatMap(release => release.events.map(row => row.event_id))), new Set(expected), `${pair}: every source ID survives the filters`)
    const markers = data.buildInspectorMarkers(filtered, preferences, bars, 'H1')
    assert.deepEqual(new Set(markers.flatMap(marker => marker.release.events.map(row => row.event_id))), new Set(expected), `${pair}: every timed source ID has a marker`)
    for (const currency of forexPairCurrencies(pair)) {
      const country = data.inspectorFamilies.find(f => f.currency === currency).country
      const fresh = event('9876543210123456789', currency, country, { name: 'A newly added MT5 release' })
      const releases = data.filterInspectorReleases(data.groupInspectorReleases([fresh]), preferences, completeRange)
      assert.equal(releases[0].familyId, `${currency.toLowerCase()}-other`)
      assert.equal(data.buildInspectorMarkers(releases, preferences, bars, 'H1').length, 1)
    }
  }
  assert.equal(data.supportsInspector('BTCUSD'), false)
  assert.equal(data.supportsInspector('EURUSDJPY'), false)
  const rows = majorCurrencies.map(currency => {
    const family = data.inspectorFamilies.find(f => f.currency === currency && f.category === 'inflation')
    return event(family.events[0], currency, family.country)
  })
  let view
  function Harness({ symbol, events = rows, chartBars = bars }) {
    const next = useInspector({ symbol, events, bars: chartBars, timeframe: 'H1', timeDisplay: utc, clockOffsetMs })
    const { setRangePreset } = next
    React.useEffect(() => { setRangePreset('year-to-date') }, [setRangePreset])
    React.useLayoutEffect(() => { view = next }, [next])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorChartMarkers, { chartApi, markers: next.markers, timeDisplay: utc, onSelectRelease: next.selectRelease }),
      React.createElement(InspectorPanel, { view: next, symbol, source: null, error: null, timeDisplay: utc }))
  }
  const render = async props => React.act(async () => root.render(React.createElement(Harness, props)))
  for (const pair of majorForexPairs) {
    const [baseCurrency, quoteCurrency] = forexPairCurrencies(pair)
    await render({ symbol: pair })
    assert.deepEqual(new Set(view.allReleases.map(r => r.currency)), new Set([baseCurrency, quoteCurrency]), pair)
    assert.ok(view.preferences.families.every(id => data.inspectorPairFamilies(pair).some(f => f.id === id)))
    for (const currency of [baseCurrency, quoteCurrency]) assert.ok(host.querySelector(`.inspector-chart-symbol .inspector-currency-${currency}`), pair)
    await click('[aria-label="2 nearby Inspector releases"]')
    await React.act(async () => host.querySelector(`.inspector-marker-popup .inspector-currency-${baseCurrency}`).parentElement.click())
    assert.equal(view.selectedRelease.currency, baseCurrency)
    assert.ok(host.querySelector('table'))
    assert.equal(host.querySelector('[aria-label="Inspector view"]'), null, 'Raw tables have no retired view selector')
    assert.equal(host.querySelector('.inspector-histogram-btn'), null)
    assert.equal(host.querySelector('th[title*="Magnitude"]'), null)
    const prepared = view.allReleases, markers = view.markers, work = globalThis.__majorGroupingWork
    await render({ symbol: pair, events: rows.map(r => [baseCurrency, quoteCurrency].includes(r.currency) ? r : { ...r, actual: .9 }) })
    assert.equal(globalThis.__majorGroupingWork, work, `${pair}: unrelated corrections perform zero regrouping work`)
    assert.equal(view.allReleases, prepared); assert.equal(view.markers, markers)
    await render({ symbol: pair, events: rows.map(r => r.currency === baseCurrency ? { ...r, actual: .5, revision: 1 } : r) })
    assert.equal(globalThis.__majorGroupingWork, work + 1, `${pair}: genuine correction propagates once`)
    assert.match(host.querySelector('tbody').textContent, /0.5%/)
    assert.match(host.querySelector('tbody').textContent, /Revision 1/)
    await click('[data-inspector-filter-trigger]')
    assert.match(document.querySelector('dialog h2').textContent, new RegExp(pair))
    assert.ok(document.querySelector(`[aria-label="${baseCurrency} Base color"]`))
    assert.ok(document.querySelector(`[aria-label="${quoteCurrency} Quote color"]`))
    const expectedControls = inspectorFilterRows.filter(f => [baseCurrency, quoteCurrency].includes(f.currency))
    const renderedControls = [...document.querySelectorAll('dialog .inspector-family input[type="checkbox"]')]
    assert.equal(renderedControls.length, expectedControls.length, `${pair}: every filter control is rendered`)
    for (const control of expectedControls) assert.ok(renderedControls.some(input => input.getAttribute('aria-label') === control.label && input.checked),
      `${pair}: ${control.label} is visible and selected by default`)
    if (pair === 'EURUSD') {
      for (const [query, label] of [['ISM Non-Manufacturing PMI', 'US ISM Manufacturing / Services'], ['840040003', 'US ISM Manufacturing / Services'],
        ['276500003', 'Euro-area PMI · France / Germany / Euro area'], ['250500002', 'Euro-area PMI · France / Germany / Euro area']]) {
        await change('[aria-label="Search Inspector families"]', query)
        assert.equal(document.querySelector('dialog .inspector-family input')?.getAttribute('aria-label'), label, `Combined control search: ${query}`)
      }
      await change('[aria-label="Search Inspector families"]', '')
    }
    const family = data.inspectorPairFamilies(pair).find(f => f.currency === baseCurrency && f.category === 'inflation')
    await change(`[aria-label="Symbol for ${family.label}"]`, 'sun')
    await change(`[aria-label="${baseCurrency} Base color"]`, '#123456')
    await React.act(async () => [...document.querySelectorAll('dialog button')].find(n => n.textContent === 'Save').click())
    const saved = JSON.parse(localStorage.getItem(data.inspectorSharedStorageKey)).pairs[pair]
    assert.equal(saved.symbols[family.id], 'sun'); assert.equal(saved.currencyColors[baseCurrency], '#123456')
    await render({ symbol: `${pair}.pro` })
    assert.equal(view.preferences.symbols[family.id], 'sun', 'Broker suffix reuses canonical settings')
    await click('[data-inspector-filter-trigger]')
    await change(`[aria-label="Symbol for ${family.label}"]`, 'cloud')
    await React.act(async () => [...document.querySelectorAll('dialog button')].find(n => n.textContent === 'Cancel').click())
    assert.equal(view.preferences.symbols[family.id], 'sun')
  }
  // All registered families open source tables, including policy and independent speeches.
  for (const family of data.inspectorFamilies.filter(f => f.events.length && !['EUR', 'USD'].includes(f.currency))) {
    const rule = policyEpisodeRules.find(r => r.familyId === family.id)
    const id = rule?.decisionIds[0] ?? family.events[0]
    const pair = majorForexPairs.find(p => forexPairCurrencies(p).includes(family.currency))
    await render({ symbol: pair, events: [event(id, family.currency, family.country)] })
    await React.act(async () => view.selectRelease(view.releases[0].id))
    assert.equal(host.querySelectorAll('[aria-label="Inspector view"]').length, 0)
    assert.ok(host.querySelector('tbody').textContent.includes(id), family.id)
    if (rule) assert.match(host.querySelector('tbody').textContent, /\+20 bp/)
    await render({ symbol: pair, events: [event(id, family.currency, family.country, { time_mode: 1 })] })
    assert.equal(view.markers.length, 1); assert.equal(view.releases.length, 1)
  }
  const bojTime = 1789710840 // Supplied publication clock for stored MT5 value 264440, 18 September 2026.
  const boj = event('392060022', 'JPY', 'JP', { value_id: '264440', name: 'BoJ Interest Rate Decision',
    actual: 1.3, previous: 1.0, time_mode: 3, server_time_seconds: bojTime,
    chart_time_seconds: bojTime, release_at: (bojTime - 10800) * 1000 })
  const bojBars = [bojTime - 3600, bojTime, bojTime + 3600].map(time => ({ ...bars[0], time }))
  await render({ symbol: 'USDJPY', events: [boj], chartBars: bojBars })
  assert.equal(view.markers.length, 1, 'Published BoJ rates with persistent tentative series metadata appear on the chart')
  assert.equal(view.markers[0].release.timingUncertain, false)
  await click('[data-inspector-filter-trigger]')
  await change('[aria-label="Search Inspector families"]', 'BoJ Interest Rate Decision')
  assert.ok(document.querySelector('[aria-label="BoJ policy"]'), 'Searching the source release name finds its family')
  await React.act(async () => [...document.querySelectorAll('dialog button')].find(n => n.textContent === 'Cancel').click())
  await React.act(async () => view.selectRelease(view.releases[0].id))
  assert.match(host.querySelector('tbody').textContent, /BoJ Interest Rate Decision.*1.3%/)
  assert.doesNotMatch(host.querySelector('tbody').textContent, /Time uncertain/)
  const dayTime = Math.floor(bojTime / 86400) * 86400
  await render({ symbol: 'USDJPY', events: [{ ...boj, actual: null, release_at: null, chart_time_seconds: null }],
    chartBars: [{ ...bars[0], time: dayTime }] })
  assert.equal(view.markers.length, 1, 'BoJ schedules remain selectable as explicitly date-only markers')
  assert.equal(view.markers[0].time, dayTime)
  assert.match(markerLabel(view.markers[0], utc).description, /2026-09-18 · Date only/)
  assert.equal(data.buildInspectorMarkers(view.releases, view.preferences, [{ time: dayTime + 3600 }], 'H1')[0].time, dayTime + 3600,
    'Date-only symbols use the first candle on the release day when midnight has no candle')
  // A saved currency shortlist follows it through every pair, including suffixes.
  localStorage.removeItem(data.inspectorSharedStorageKey)
  const currencySelections = (preferences, currency) => preferences.families.filter(id =>
    data.inspectorFamilies.some(family => family.id === id && family.currency === currency))
  const audDefaults = data.defaultInspectorPreferences('AUDJPY')
  const inherited = { ...audDefaults, families: [...currencySelections(audDefaults, 'AUD'), 'boj'] }
  const legacyJson = JSON.stringify(inherited)
  localStorage.setItem(data.inspectorPreferenceKey('AUDJPY'), legacyJson)
  await render({ symbol: 'AUDJPY' })
  assert.deepEqual(currencySelections(view.preferences, 'JPY'), ['boj'], 'Existing pair choices remain available for migration')
  await React.act(async () => view.applyPreferences(view.preferences))
  assert.equal(localStorage.getItem(data.inspectorPreferenceKey('AUDJPY')), legacyJson, 'Legacy settings remain intact')
  const audSelection = currencySelections(view.preferences, 'AUD')
  for (const pair of majorForexPairs.filter(pair => pair.includes('JPY'))) {
    await render({ symbol: pair })
    assert.deepEqual(currencySelections(view.preferences, 'JPY'), ['boj'], `${pair}: inherits the saved JPY shortlist`)
  }
  await render({ symbol: 'USDJPY.pro' })
  assert.deepEqual(currencySelections(view.preferences, 'JPY'), ['boj'], 'Broker suffixes share the same currency selection')
  const jpyJson = localStorage.getItem(data.inspectorSharedStorageKey)
  await click('[data-inspector-filter-trigger]')
  await click('[aria-label="BoJ policy"]')
  assert.deepEqual(currencySelections(view.preferences, 'JPY'), [], 'Unchecked family previews locally')
  assert.equal(localStorage.getItem(data.inspectorSharedStorageKey), jpyJson, 'Preview never changes another pair')
  assert.deepEqual(currencySelections(data.readInspectorPreferences('AUDJPY'), 'JPY'), ['boj'])
  await React.act(async () => [...document.querySelectorAll('dialog button')].find(n => n.textContent === 'Cancel').click())
  assert.deepEqual(currencySelections(view.preferences, 'JPY'), ['boj'], 'Cancel restores the shared shortlist')
  await React.act(async () => view.applyPreferences({ ...view.preferences, families: ['fomc', 'boj'] }))
  await render({ symbol: 'EURUSD' })
  assert.deepEqual(currencySelections(view.preferences, 'USD'), ['fomc'], 'USD selection also follows the currency')
  await render({ symbol: 'AUDJPY' })
  assert.deepEqual(currencySelections(view.preferences, 'AUD'), audSelection, 'Saving USD/JPY preserves AUD choices')
  await React.act(async () => view.applyPreferences({ ...view.preferences, families: audSelection }))
  await render({ symbol: 'GBPJPY' })
  assert.deepEqual(currencySelections(view.preferences, 'JPY'), [], 'An intentionally empty selection stays empty across pairs')
  await React.act(async () => root.render(null))
  await render({ symbol: 'AUDJPY' })
  assert.deepEqual(currencySelections(view.preferences, 'JPY'), [], 'Shared empty selections survive remount/refresh')
  const storageBeforeFailure = localStorage.getItem(data.inspectorSharedStorageKey), browserStorage = localStorage
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: key => browserStorage.getItem(key), setItem() { throw new Error('Storage full') },
    } })
    await React.act(async () => view.applyPreferences({ ...view.preferences, families: ['boj'] }))
    assert.equal(view.storageFailed, true)
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: browserStorage }) }
  assert.equal(localStorage.getItem(data.inspectorSharedStorageKey), storageBeforeFailure, 'A failed save cannot partially change either currency')
  assert.deepEqual(currencySelections(data.readInspectorPreferences('USDJPY'), 'USD'), ['fomc'])
  assert.deepEqual(currencySelections(data.readInspectorPreferences('USDJPY'), 'JPY'), [])
  const shortlisted = new Map()
  for (const currency of majorCurrencies) {
    const pair = majorForexPairs.find(pair => forexPairCurrencies(pair).includes(currency))
    await render({ symbol: pair })
    const family = data.inspectorFamilies.find(family => family.currency === currency && family.category === 'policy')
    const next = { ...view.preferences, families: [...view.preferences.families.filter(id => !currencySelections(view.preferences, currency).includes(id)), family.id] }
    await React.act(async () => view.applyPreferences(next))
    shortlisted.set(currency, family.id)
  }
  for (const pair of majorForexPairs) {
    await render({ symbol: pair })
    for (const currency of forexPairCurrencies(pair)) assert.deepEqual(currencySelections(view.preferences, currency), [shortlisted.get(currency)],
      `${pair}: both saved currency shortlists combine correctly`)
  }
  await React.act(async () => root.render(React.createElement(AlertFiltersModal, { preferences: defaultAlertPreferences(), onSave() {}, onClose() {} })))
  for (const currency of majorCurrencies) {
    await React.act(async () => [...document.querySelectorAll('dialog nav button')].find(button => button.textContent === currency).click())
    const expected = inspectorFilterRows.filter(f => f.currency === currency)
    const inputs = [...document.querySelectorAll('dialog .inspector-family input[type="checkbox"]')]
    assert.equal(inputs.length, expected.length, `${currency}: Alert renders every filter control`)
    for (const control of expected) assert.ok(inputs.some(input => input.getAttribute('aria-label') === control.label && input.checked), control.label)
  }
  console.log('✓ All 28 pairs: source-ID admission, raw tables, corrections, work counts, shared eight-currency selections, legacy migration, Save/Cancel, empty selections and atomic save failures')
} finally {
  delete globalThis.__majorGroupingWork
  delete globalThis.__majorAdmissionWork
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
