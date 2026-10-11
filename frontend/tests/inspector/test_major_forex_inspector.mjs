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
  const { policyEpisodeRules } = await server.ssrLoadModule('./src/inspector/episodes/policy-episodes.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { exportWorkspace, parseWorkspaceSnapshot } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/major-calendar-catalog.json', import.meta.url), 'utf8'))
  for (const source of fixture) {
    const family = eventFamilyOptions.find(f => f.events.includes(source.event_id))
    assert.equal(family.currency, source.country_currency)
    assert.equal(family.country, source.country_code)
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
  assert.equal(data.supportsInspector('BTCUSD'), false)
  assert.equal(data.supportsInspector('EURUSDJPY'), false)
  const rows = majorCurrencies.map(currency => {
    const family = data.inspectorFamilies.find(f => f.currency === currency && f.category === 'inflation')
    return event(family.events[0], currency, family.country)
  })
  let view
  function Harness({ symbol, events = rows }) {
    const next = useInspector({ symbol, events, bars, timeframe: 'H1', timeDisplay: utc, clockOffsetMs })
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
    if (pair !== 'EURUSD') {
      const select = host.querySelector('[aria-label="Inspector view"]')
      assert.deepEqual([...select.options].map(o => o.textContent), ['Table only', 'Scatter Plot (WIP)'], pair)
      assert.equal(select.options[1].disabled, true)
      assert.equal(host.querySelector('.inspector-histogram-btn'), null)
      assert.equal(host.querySelector('th[title*="Magnitude"]'), null)
    }
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
    const family = data.inspectorPairFamilies(pair).find(f => f.currency === baseCurrency && f.category === 'inflation')
    await change(`[aria-label="Symbol for ${family.label}"]`, 'sun')
    await change(`[aria-label="${baseCurrency} Base color"]`, '#123456')
    await React.act(async () => [...document.querySelectorAll('dialog button')].find(n => n.textContent === 'Save').click())
    const saved = JSON.parse(localStorage.getItem(data.inspectorPreferenceKey(pair)))
    assert.equal(saved.symbols[family.id], 'sun'); assert.equal(saved.currencyColors[baseCurrency], '#123456')
    await render({ symbol: `${pair}.pro` })
    assert.equal(view.preferences.symbols[family.id], 'sun', 'Broker suffix reuses canonical settings')
    await click('[data-inspector-filter-trigger]')
    await change(`[aria-label="Symbol for ${family.label}"]`, 'cloud')
    await React.act(async () => [...document.querySelectorAll('dialog button')].find(n => n.textContent === 'Cancel').click())
    assert.equal(view.preferences.symbols[family.id], 'sun')
  }
  const workspace = parseWorkspaceSnapshot(JSON.stringify(exportWorkspace()))
  assert.equal(Object.keys(workspace.entries).filter(k => k.startsWith('fyodor.inspector.')).length, 28)
  const snapshot = { ...workspace, entries: { ...workspace.entries, 'fyodor.inspector.btcuSd.v1': '{}' } }
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify(snapshot)), /Unsupported workspace setting/)
  // All registered families open source tables, including policy and independent speeches.
  for (const family of data.inspectorFamilies.filter(f => !['EUR', 'USD'].includes(f.currency))) {
    const rule = policyEpisodeRules.find(r => r.familyId === family.id)
    const id = rule?.decisionIds[0] ?? family.events[0]
    const pair = majorForexPairs.find(p => forexPairCurrencies(p).includes(family.currency))
    await render({ symbol: pair, events: [event(id, family.currency, family.country)] })
    await React.act(async () => view.selectRelease(view.releases[0].id))
    assert.equal(host.querySelectorAll('[aria-label="Inspector view"] option').length, 2)
    assert.ok(host.querySelector('tbody').textContent.includes(id), family.id)
    if (rule) assert.match(host.querySelector('tbody').textContent, /\+20 bp/)
    await render({ symbol: pair, events: [event(id, family.currency, family.country, { time_mode: 1 })] })
    assert.equal(view.markers.length, 0); assert.equal(view.releases.length, 1)
  }
  console.log('✓ All 28 pairs: source-ID admission, base/quote icons, selection, raw tables, corrections, work counts, separate Save/Cancel and workspace portability')
} finally {
  delete globalThis.__majorGroupingWork
  delete globalThis.__majorAdmissionWork
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
