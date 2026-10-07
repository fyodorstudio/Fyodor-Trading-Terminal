import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
const frames = new Map(); let frameId = 0
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }; dom.cancelAnimationFrame = id => frames.delete(id)
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { roofCoordinate, visibleRoofCandidates } = await load('usd-context/sequences/chart/roof-geometry.ts')
  const { ComboRoofs } = await load('usd-context/sequences/chart/ComboRoofs.tsx')
  const { roofLabel, roofTooltip } = await load('usd-context/sequences/chart/roof-label.ts')
  const { ComboInspector } = await load('usd-context/sequences/ui/ComboInspector.tsx')
  const { RaycasterDetails } = await load('raycaster/ui/RaycasterDetails.tsx')
  const prefs = await load('usd-context/sequences/storage/sequence-preferences.ts')
  const { combineContext } = await load('usd-context/core/combine-context.ts')
  const { exportWorkspace, restoreWorkspace, parseWorkspaceSnapshot } = await load('workspace-portability/workspace-snapshot.ts')
  const at = Date.UTC(2020, 0, 1, 12), hour = 3600000
  const source = (family, total, time, id) => ({ family, total, chartAt: time, releaseAt: time - 3 * hour, sourceId: id, sourceLabel: id,
    usdDirection: total < 0 ? 'weaker' : 'stronger', strength: 'moderate', reduced: false, tie: false, coverage: 1, reason: '', explanation: '', changeSize: null })
  const inputs = [source('claims', -1, at, 'claims'), source('pce', -1, at + hour, 'pce')]
  const after = combineContext(Object.fromEntries(inputs.map(s => [s.family, s])), ['claims', 'pce', 'cpi'], at + hour)
  const before = combineContext({ claims: inputs[0] }, ['claims', 'pce', 'cpi'], at + hour - 1)
  const episode = { id: 'roof', kind: 'fresh-news', title: 'Fresh-news sequence', chartAt: at + hour + hour / 2,
    sources: inputs.map(s => ({ ...s, role: 'Latest replacement effect', change: -.1 })), before, after,
    direction: 'weaker', strength: 'weak', explanation: 'Labor and inflation replacement effects reduce USD support.', checks: [], experimental: true }
  assert.equal(roofLabel(episode), 'Claims + PCE')
  const companions = { ...episode, sources: [...episode.sources, { ...episode.sources[0], sourceId: 'claims-2' },
    { ...episode.sources[0], family: 'gdp', sourceLabel: 'GDP companion', change: 0 },
    { ...episode.sources[1], family: 'ism', sourceLabel: 'ISM opposing release', change: .2 },
    { ...episode.sources[1], family: 'retail', sourceLabel: 'Retail Sales', change: -.2 }] }
  assert.equal(roofLabel(companions), 'Claims + PCE + ISM +1', 'Deduplicate families, exclude zero companions, name opposing drivers too')
  assert.match(roofTooltip(companions), /GDP companion.*no replacement effect/)
  assert.match(roofTooltip(companions), /ISM opposing release.*adds USD support/)
  assert.match(roofTooltip(companions), /Retail Sales.*reduces USD support/)
  assert.equal(roofLabel({ ...episode, kind: 'ism-sectors', experimental: false }), 'ISM sectors')
  const bars = [0, 1, 3].map(n => ({ time: (at + n * hour) / 1000, open: 1, close: 1, high: 1, low: 1 }))
  let range = { from: at / 1000, to: (at + hour) / 1000 }, rangeHandler, sizeHandler, unsubscribed = 0, coordinateCalls = 0
  const scale = { getVisibleRange: () => range, width: () => 800,
    timeToCoordinate: time => { coordinateCalls++; return (time - at / 1000) / 3600 * 200 + 100 },
    subscribeVisibleLogicalRangeChange: fn => { rangeHandler = fn }, unsubscribeVisibleLogicalRangeChange: fn => { assert.equal(fn, rangeHandler); unsubscribed++ },
    subscribeSizeChange: fn => { sizeHandler = fn }, unsubscribeSizeChange: fn => { assert.equal(fn, sizeHandler); unsubscribed++ } }
  const chartApi = { timeScale: () => scale }
  assert.equal(roofCoordinate(scale, bars, at + hour / 2, 'H1'), 100)
  assert.equal(roofCoordinate(scale, bars, at - 1, 'H1'), null)
  assert.equal(roofCoordinate(scale, bars, at + 2 * hour, 'H1'), null, 'Do not project onto a gap or future bar')
  assert.deepEqual(visibleRoofCandidates([episode], at, episode.chartAt), [episode])
  assert.deepEqual(visibleRoofCandidates([episode], at, episode.chartAt - 1), [])
  let selected = null, opened = null, returned = false
  const roofProps = { chartApi, episodes: [episode], bars, timeframe: 'H1', markers: [{ release: { id: 'claims' } }],
    now: episode.chartAt, experimental: true, onSelect: value => { selected = value } }
  const render = value => React.act(async () => root.render(value))
  await render(React.createElement(ComboRoofs, roofProps))
  const button = container.querySelector('[aria-label="Inspect combo Fresh-news sequence"]')
  assert.ok(button, 'A mid-candle publication is included on the final visible H1 bar')
  assert.match(button.textContent, /Claims \+ PCE.*Long/)
  assert.doesNotMatch(button.textContent, /Fresh news/)
  assert.equal(button.querySelector('.combo-roof-direction').textContent.trim(), '· Long', 'Direction stays outside the truncating name span')
  assert.match(button.title, /claims.*reduces USD support/)
  assert.match(button.title, /1 inputs hidden/)
  await React.act(async () => button.click()); assert.equal(selected, episode)
  const previousCalls = coordinateCalls
  await React.act(async () => { for (let i = 0; i < 200; i++) rangeHandler(); sizeHandler() })
  assert.equal(frames.size, 1, 'Panning and resizing coalesce; no mouse-move rescoring')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.ok(coordinateCalls - previousCalls < 10)
  await render(React.createElement(ComboRoofs, { ...roofProps, now: episode.chartAt - 1 }))
  assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null, 'Future activation is hidden')
  await render(React.createElement(ComboRoofs, { ...roofProps, experimental: false }))
  assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null)
  await render(React.createElement(ComboRoofs, { ...roofProps, markers: [] }))
  assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null)
  range = { from: at / 1000, to: (at + 4 * hour) / 1000 }
  const crowded = Array.from({ length: 4 }, (_, i) => ({ ...episode, id: 'roof/' + i }))
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: crowded }))
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 3)
  const more = container.querySelector('.combo-roof-overflow button'); assert.match(more.textContent, /\+1/)
  await React.act(async () => more.click()); assert.equal(more.getAttribute('aria-expanded'), 'true')
  assert.match(container.querySelector('.combo-roof-overflow > div button').textContent, /Claims \+ PCE/)

  const timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }
  await render(React.createElement(ComboInspector, { combo: episode, symbol: 'EURUSD', timeDisplay,
    onClose: () => { returned = true }, onOpenRelease: s => { opened = s } }))
  assert.ok(unsubscribed >= 2, 'Chart handlers detach when opening Inspector')
  assert.equal(container.querySelector('details'), null, 'Combo details remain flat')
  assert.match(container.textContent, /Accumulated context before → after/)
  assert.match(container.textContent, /No later publications or prices/)
  const cpiRow = [...container.querySelectorAll('[aria-label="Combo context contributions"] tbody tr')].find(r => r.textContent.includes('CPI'))
  assert.match(cpiRow.textContent, /Enabled/); assert.match(cpiRow.textContent, /No history/)
  const participant = [...container.querySelectorAll('button')].find(b => b.textContent === 'pce')
  await React.act(async () => participant.click()); assert.equal(opened.sourceId, 'pce')
  await React.act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Return to releases').click())
  assert.equal(returned, true)

  const trigger = { current: document.createElement('button') }; document.body.append(trigger.current)
  await render(React.createElement(RaycasterDetails, { id: 'gear', families: ['claims', 'pce', 'cpi'], trigger,
    onClose: () => {}, onToggleFamily: () => {}, result: after, symbol: 'EURUSD', loading: false, unavailable: false,
    cutoff: episode.chartAt, held: true, timeDisplay, summaryLabel: 'EURUSD Long' }))
  const headings = [...container.querySelectorAll('h3')].map(h => h.textContent)
  assert.deepEqual(headings, ['Accumulated context', 'Inputs and contributions', 'Active relationships', 'Fresh-news change · Experimental', 'Chart relationships', 'Calculation and evidence'])
  assert.equal(container.querySelector('details'), null)
  assert.match(container.textContent, /last inspected candle/)
  const freshToggle = [...container.querySelectorAll('label')].find(l => l.textContent.includes('experimental')).querySelector('input')
  await React.act(async () => freshToggle.click())
  assert.equal(prefs.readSequencePreferences().fresh, false)
  assert.equal(container.querySelector('[aria-label="Experimental fresh news"]'), null)
  const exported = exportWorkspace(); assert.equal(JSON.parse(exported.entries[prefs.sequencePreferencesKey]).fresh, false)
  await React.act(async () => { prefs.saveSequencePreferences({ roofs: false, fresh: true }); restoreWorkspace(exported) })
  assert.deepEqual(prefs.readSequencePreferences(), { roofs: true, fresh: false })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...exported, entries: { [prefs.sequencePreferencesKey]: '{"roofs":true,"fresh":"yes"}' } })))
  let changes = 0; const listener = () => { changes++ }
  dom.addEventListener(prefs.sequencePreferencesKey + ':changed', listener)
  await React.act(async () => prefs.saveSequencePreferences(prefs.readSequencePreferences()))
  assert.equal(changes, 0, 'No-op preference writes do not invalidate UI')
  dom.removeEventListener(prefs.sequencePreferencesKey + ':changed', listener)
  console.log('✓ Roof geometry, publication cutoff, overflow, coalesced pan, Inspector links, organized gear and portable display settings')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
