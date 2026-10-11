import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

globalThis.__gbpGroupingWork = 0
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'gbp-grouping-work', enforce: 'pre', transform(code) {
    const signature = 'export function groupInspectorReleases(events: InspectorEvent[]): InspectorRelease[] {'
    if (code.includes(signature)) return code.replace(signature, `${signature}globalThis.__gbpGroupingWork += 1;`)
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
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { exportWorkspace, parseWorkspaceSnapshot } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const families = data.inspectorFamilies.filter(family => family.currency === 'GBP')
  assert.equal(families.length, 8)
  assert.equal(data.inspectorPairFamilies('EURUSD').length, 22)
  assert.equal(data.inspectorPairFamilies('GBPUSD.a').length, 20)
  assert.equal(data.supportsInspector('GBPUSDmicro'), true)
  assert.equal(data.supportsInspector('EURGBP'), true)
  const gbpRows = families.flatMap(family => family.events.map(id => event(id)))
  assert.equal(data.groupInspectorReleases(gbpRows).flatMap(release => release.events).length, gbpRows.length)
  assert.equal(data.groupInspectorReleases([event('826010011', 'GBP', 'US')]).length, 0)
  assert.equal(data.groupInspectorReleases([event('826500003'), event('826500004')]).length, 0, 'Construction/all-sector PMI are outside this pass')
  assert.equal(data.formatInspectorValue(data.inspectorDelta(event('826020009')), event('826020009'), true), '+20 bp')
  const decision = event('826020009'), minutes = event('826020008', 'GBP', 'GB', {
    release_at: at + 600000, server_time_seconds: at / 1000 + 600, actual: null, previous: null, forecast: null })
  const meeting = data.groupInspectorReleases([decision, minutes])
  assert.equal(meeting.length, 1); assert.equal(meeting[0].events.length, 2)
  assert.equal(data.isInspectorCommentary(minutes), true)
  assert.equal(data.isInspectorCommentary(event('826020010')), false, 'Numerical votes are raw readings')
  const future = event('826010012', 'GBP', 'GB', { release_at: at + 86400000, server_time_seconds: at / 1000 + 86400 })
  const rows = [event('826010011'), event('840030005', 'USD', 'US'), event('999030011', 'EUR', 'EU'), future]
  let view
  function Harness({ symbol = 'GBPUSD', events = rows }) {
    const next = useInspector({ symbol, events, bars, timeframe: 'H1', timeDisplay: utc, clockOffsetMs })
    const { setRangePreset } = next
    React.useEffect(() => { setRangePreset('year-to-date') }, [setRangePreset])
    React.useLayoutEffect(() => { view = next }, [next])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorChartMarkers, { chartApi, markers: next.markers, timeDisplay: utc, onSelectRelease: next.selectRelease }),
      React.createElement(InspectorPanel, { view: next, symbol, source: null, error: null, timeDisplay: utc }))
  }
  const render = async props => React.act(async () => root.render(React.createElement(Harness, props)))
  localStorage.setItem(data.inspectorStorageKey, JSON.stringify({ ...data.defaultInspectorPreferences(), families: ['us-cpi'], symbols: { 'us-cpi': 'moon' } }))
  await render()
  assert.deepEqual(new Set(view.releases.map(release => release.currency)), new Set(['GBP', 'USD']))
  assert.ok(host.querySelector('.inspector-chart-symbol .inspector-currency-GBP'), 'GBP icons are rendered on the chart')
  await click('[aria-label="2 nearby Inspector releases"]')
  await React.act(async () => host.querySelector('.inspector-marker-popup .inspector-currency-GBP').parentElement.click())
  assert.equal(view.selectedRelease.familyId, 'uk-cpi')
  const selector = host.querySelector('[aria-label="Inspector view"]')
  assert.deepEqual([...selector.options].map(option => option.textContent), ['Table only', 'Scatter Plot (WIP)'])
  assert.equal(selector.options[1].disabled, true)
  assert.match(host.querySelector('tbody').textContent, /0.3%/)
  assert.match(host.querySelector('tbody').textContent, /Rev: 0.2%/)
  assert.match(host.querySelector('tbody').textContent, /\+0.2 pp/)
  const corrected = rows.map(row => row.event_id === '826010011' ? { ...row, actual: .5 } : row)
  await render({ events: corrected })
  assert.match(host.querySelector('tbody').textContent, /\+0.4 pp/)
  await click('[data-inspector-filter-trigger]')
  assert.match(document.querySelector('dialog h2').textContent, /GBPUSD/)
  assert.ok(document.querySelector('[aria-label="GBP Base color"]'))
  assert.equal(document.querySelector('[aria-label="Euro-area inflation"]'), null)
  await change('[aria-label="Symbol for UK CPI / core CPI"]', 'sun')
  assert.equal(view.markers.find(marker => marker.release.familyId === 'uk-cpi').symbol, 'sun')
  await change('[aria-label="GBP Base color"]', '#123456')
  await React.act(async () => [...document.querySelectorAll('dialog button')].find(node => node.textContent === 'Save').click())
  const saved = localStorage.getItem(data.gbpInspectorStorageKey)
  assert.equal(JSON.parse(saved).currencyColors.GBP, '#123456')
  assert.equal(JSON.parse(localStorage.getItem(data.inspectorStorageKey)).symbols['us-cpi'], 'moon')
  assert.ok(parseWorkspaceSnapshot(JSON.stringify(exportWorkspace())).entries[data.gbpInspectorStorageKey])
  await click('[data-inspector-filter-trigger]')
  await change('[aria-label="Symbol for UK CPI / core CPI"]', 'cloud')
  await React.act(async () => [...document.querySelectorAll('dialog button')].find(node => node.textContent === 'Cancel').click())
  assert.equal(view.preferences.symbols['uk-cpi'], 'sun')
  assert.equal(localStorage.getItem(data.gbpInspectorStorageKey), saved)
  await render({ symbol: 'EURUSD' })
  assert.equal(view.selectedRelease, null)
  assert.deepEqual(view.preferences.families, ['us-cpi'])
  assert.ok(view.allReleases.every(release => release.currency !== 'GBP'))
  const eurReleases = view.allReleases, eurMarkers = view.markers
  const groupingWork = globalThis.__gbpGroupingWork
  await render({ symbol: 'EURUSD', events: rows.map(row => row.currency === 'GBP' ? { ...row, actual: .9 } : row) })
  assert.equal(globalThis.__gbpGroupingWork, groupingWork, 'GBP-only corrections perform zero EURUSD regrouping work')
  assert.equal(view.allReleases, eurReleases, 'GBP-only corrections do not rebuild EURUSD release models')
  assert.equal(view.markers, eurMarkers, 'GBP-only corrections do not rebuild EURUSD markers')
  await render({ symbol: 'EURUSD', events: rows.map(row => row.currency === 'USD' ? { ...row, actual: .7 } : row) })
  assert.equal(globalThis.__gbpGroupingWork, groupingWork + 1, 'A relevant correction regroups exactly once')
  assert.notEqual(view.allReleases, eurReleases, 'Relevant corrections still reach the assembled Inspector')
  await render()
  assert.equal(view.preferences.symbols['uk-cpi'], 'sun')
  await React.act(async () => view.selectRelease(view.releases.find(release => release.currency === 'USD').id))
  assert.deepEqual([...host.querySelector('[aria-label="Inspector view"]').options].map(option => option.textContent),
    ['Table only', 'Scatter Plot (WIP)'], 'GBPUSD keeps the same view choices when selecting the USD side')
  for (const family of families) {
    await render({ events: family.events.map(id => event(id)) })
    await React.act(async () => view.selectRelease(view.releases[0].id))
    assert.equal(host.querySelectorAll('[aria-label="Inspector view"] option').length, 2)
    assert.ok(host.querySelector('table'))
    assert.equal(host.querySelector('.inspector-r1'), null)
  }
  await render({ events: [event('826010011', 'GBP', 'GB', { time_mode: 1 })] })
  assert.equal(view.markers.length, 0); assert.equal(view.releases.length, 1)
  console.log('✓ GBP families, meeting companions, chart selection, tables, corrections, WIP selector, pair isolation, icon preview/save/cancel and workspace export')
} finally {
  delete globalThis.__gbpGroupingWork
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
