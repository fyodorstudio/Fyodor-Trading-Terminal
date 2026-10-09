import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
try {
  const load = file => server.ssrLoadModule('./src/' + file)
  const { RoofsDock } = await load('usd-context/sequences/ui/RoofsDock.tsx')
  const { combineContext } = await load('usd-context/core/combine-context.ts')
  const { DisplayClockProvider } = await load('appearance/time-display/DisplayClock.tsx')
  const at = Date.UTC(2026, 9, 8, 15, 30), day = 86400000
  let timeDisplay = { mode: 'fixed-offset', utcOffsetMinutes: 420 }
  const source = (family, total, patch = {}) => ({ family, total, chartAt: at, releaseAt: (patch.chartAt ?? at) - 10800000,
    sourceId: family, sourceLabel: family === 'claims' ? 'Jobless Claims' : family.toUpperCase(),
    usdDirection: total > 0 ? 'stronger' : total < 0 ? 'weaker' : 'uncomputed', strength: 'strong', coverage: 1,
    status: 'active', memory: { retention: 1 }, ...patch })
  const snapshot = (id, sources, patch = {}) => ({ id, title: id, kind: 'release-relationship', chartAt: at, sources,
    after: combineContext(Object.fromEntries(sources.filter(s => s.family !== 'fed').map(s => [s.family, s])), sources.filter(s => s.family !== 'fed').map(s => s.family), at),
    before: null, direction: 'uncomputed', strength: 'strong', explanation: '', checks: [], experimental: false,
    activation: { kind: 'publication', removed: [] }, ...patch })
  const nine = [snapshot('Long pair', [source('claims', -1), source('pce', -1)]),
    snapshot('Narrow Long pair', [source('claims', -1), source('pce', .9)]),
    ...['pce', 'cpi', 'nfp', 'retail', 'gdp'].map(family => snapshot(`Jobless Claims + ${family.toUpperCase()}`, [source('claims', 1), source(family, 1, { chartAt: at - day })])),
    snapshot('Jobless Claims + Fed', [source('claims', 1), source('fed', null, { chartAt: Date.UTC(2026, 8, 16, 21),
      policyAction: { action: 'Rate increase', delta: 25, actual: 5 }, usdDirection: 'stronger', role: 'Numerical rate action, unweighted' })], { kind: 'fed-relationship' }),
    snapshot('Fresh-news sequence', [source('claims', 1, { change: .1, comparable: true }), source('ism', 1, { change: .2, comparable: true, chartAt: at - day })], { kind: 'fresh-news', experimental: true })]
  const captured = JSON.stringify(nine)
  let group = { candleAt: at - 30 * 60000, combos: nine }, page = 'overview', combo = null, scroll = 0
  let openedRelease = null, raycasterOpens = 0
  const restoreOverviewScroll = () => scroll, rememberOverviewScroll = value => { scroll = value }
  function draw() {
    root.render(React.createElement(DisplayClockProvider, { brokerId: 'fixture', brokerOffsetSeconds: 10800, preference: timeDisplay },
      React.createElement(RoofsDock, { group, combo, page, symbol: 'EURUSD', timeDisplay,
        restoreOverviewScroll, rememberOverviewScroll,
        onViewDetails: value => { combo = value; page = 'details'; draw() },
        onBack: () => { page = 'overview'; draw() },
        onOpenRelease: source => { openedRelease = source }, onOpenRaycaster: () => raycasterOpens++ })))
  }
  const render = () => React.act(async () => draw())
  const click = element => React.act(async () => { assert.ok(element); element.click() })
  const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.trim() === text)
  await render()
  assert.equal(container.querySelectorAll('.roof-overview-row').length, 9)
  assert.equal(container.querySelector('.roof-overview-header button'), null, 'Panel navigation uses the bottom dock controls')
  assert.match(container.querySelector('.roof-overview-counts').textContent, /Long leads: 2 · Short leads: 7/)
  assert.match(container.querySelector('.roof-overview-anchor').textContent, /Oct 08, 2026, 19:30/)
  assert.doesNotMatch(container.querySelector('.roof-overview-anchor').textContent, /19:00/, 'The release header uses activation time rather than its containing candle open')
  const narrowRow = container.querySelector('[data-roof-id="Narrow Long pair"]')
  assert.match(narrowRow.textContent, /Conflicted · Long leads.*weak evidence · narrow lead/)
  assert.equal(container.querySelectorAll('.roof-overview-reason').length, 9, 'Every relationship explanation is visible without choosing details')
  assert.match(container.querySelector('[data-roof-id="Fresh-news sequence"]').textContent, /Changes in support/)
  assert.match(container.querySelector('[data-roof-id="Jobless Claims + Fed"]').textContent, /Rate increase/)
  assert.equal(container.querySelectorAll('[aria-label="Participating publications"]').length, 9)
  assert.equal(container.querySelectorAll('.roof-overview-releases tbody tr').length, 18, 'All participating releases are visible without opening details')
  assert.equal(container.querySelector('.roof-overview-releases').closest('details'), null)
  assert.equal(container.querySelectorAll('.roof-overview-row-main > button').length, 9, 'View Details remains available for every combination')
  const fedTable = () => container.querySelector('[data-roof-id="Jobless Claims + Fed"] .combo-release-table')
  assert.deepEqual([...fedTable().querySelectorAll('th')].map(th => th.textContent), ['Release', 'Published', 'Standalone interpretation', 'Role'])
  assert.match(fedTable().rows[1].textContent, /Jobless Claims.*Oct 08, 2026, 19:30.*EURUSD Short.*strong evidence.*Activation update/)
  assert.match(fedTable().rows[2].textContent, /FED.*Sep 17, 2026, 01:00.*EURUSD Short.*Earlier context.*Numerical rate action, unweighted/)
  await click(fedTable().rows[2].querySelector('button'))
  assert.equal(openedRelease, nine[7].sources[1], 'Inline links open the exact release, including earlier context')
  assert.equal(page, 'overview'); assert.equal(combo, null, 'Inspecting a source does not select a relationship')
  timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }; await render()
  assert.match(fedTable().rows[1].textContent, /Oct 08, 2026, 12:30/)
  assert.match(fedTable().rows[2].textContent, /Sep 16, 2026, 18:00/, 'Publication times use source UTC, not the chart clock')
  timeDisplay = { mode: 'fixed-offset', utcOffsetMinutes: 420 }; await render()
  const releasesBeforeDetails = container.querySelector('[data-roof-id="Narrow Long pair"] .combo-release-table').textContent
  const scrollBody = container.querySelector('.roof-overview-scroll'); scrollBody.scrollTop = 190
  await React.act(async () => scrollBody.dispatchEvent(new dom.Event('scroll', { bubbles: true })))
  await click(narrowRow.querySelector('button'))
  assert.equal(container.querySelector('.roof-release-overview'), null, 'Hidden overview mounts no row presentation')
  assert.match(container.querySelector('.combo-title').textContent, /Narrow Long pair/)
  assert.match(container.querySelector('[aria-label="Roof interpretation"]').textContent, /weak evidence · narrow lead/)
  assert.equal(container.querySelector('.combo-release-table').textContent, releasesBeforeDetails, 'The individual page retains the same participant information')
  await click(button('Jobless Claims')); assert.equal(openedRelease.sourceId, 'claims')
  await click(button('Open in Raycaster')); assert.equal(raycasterOpens, 1)
  await click(button('← All 9 combinations'))
  assert.equal(container.querySelector('.roof-overview-scroll').scrollTop, 190)
  assert.equal(container.querySelector('.roof-overview-row.selected').dataset.roofId, 'Narrow Long pair')
  assert.equal(JSON.stringify(nine), captured, 'Group browsing never changes captured interpretation data')

  // New group and corrections are admitted by identity, with their own clocks.
  const later = { ...nine[0], id: 'Later update', title: 'Later update', chartAt: at + 15 * 60000 }
  group = { candleAt: at - 30 * 60000, combos: [nine[0], later] }; scroll = 0; await render()
  assert.equal(container.querySelectorAll('.roof-overview-row').length, 2)
  assert.match(container.querySelector('.roof-overview-anchor').textContent, /19:30.*19:45/)
  assert.equal(container.querySelector('.roof-overview-scroll').scrollTop, 0)
  const corrected = snapshot('Corrected reading', [source('claims', 1), source('pce', 1)])
  group = { ...group, combos: [corrected] }; await render()
  assert.match(container.querySelector('.roof-overview-bias').textContent, /Aligned · Short/)
  assert.match(container.querySelector('.roof-overview-counts').textContent, /Long leads: 0 · Short leads: 1/)
  assert.match(container.querySelector('.combo-release-table tbody').textContent, /Jobless Claims.*EURUSD Short/, 'Corrected inputs also update the inline release table')

  group = { candleAt: at - 30 * 60000, combos: [
    snapshot('Balanced', [source('claims', -1), source('pce', 1)], { strength: null }),
    snapshot('Unchanged', [source('claims', 0), source('pce', 0)], { strength: null }),
    snapshot('Missing', [source('claims', 1), source('pce', null)], { strength: null }),
  ] }; await render()
  assert.match(container.querySelector('.roof-overview-counts').textContent, /Balanced: 1.*Unchanged: 1.*Insufficient: 1/)
  assert.match(container.querySelector('[data-roof-id="Balanced"]').textContent, /Balanced conflict · No lead/)
  assert.match(container.querySelector('[data-roof-id="Unchanged"]').textContent, /Unchanged · No lead.*Long —.*Short —/)
  assert.match(container.querySelector('[data-roof-id="Missing"]').textContent, /Insufficient evidence.*Long —.*Short —/)
  console.log('✓ Release overview: all relationships and source tables, exact source/activation clocks, direct release links, preserved details/actions/scroll, corrections and no-lead states')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
