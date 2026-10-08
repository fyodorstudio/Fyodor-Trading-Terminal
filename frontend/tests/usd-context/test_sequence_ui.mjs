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
  const { roofBarIndex } = await load('usd-context/sequences/chart/roof-geometry.ts')
  const { ComboRoofs } = await load('usd-context/sequences/chart/ComboRoofs.tsx')
  const { roofLabel, roofTooltip } = await load('usd-context/sequences/chart/roof-label.ts')
  const { ComboInspector } = await load('usd-context/sequences/ui/ComboInspector.tsx')
  const { RaycasterSettings } = await load('fundamental-tools/settings/RaycasterSettings.tsx')
  const { inspectionSignature } = await load('fundamental-tools/runtime/inspection-session.ts')
  const familySettings = await load('raycaster/storage/raycaster-family-settings.ts')
  const { readRelativePreferences } = await load('pair-context/storage/relative-preferences.ts')
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
    sources: inputs.map(s => ({ ...s, role: 'Latest replacement effect', change: -.1, comparable: true })), before, after,
    direction: 'weaker', strength: 'weak', explanation: 'Labor and inflation replacement effects reduce USD support.', checks: [], experimental: true }
  assert.equal(roofLabel(episode), 'Claims + PCE')
  const companions = { ...episode, sources: [...episode.sources, { ...episode.sources[0], sourceId: 'claims-2' },
    { ...episode.sources[0], family: 'gdp', sourceLabel: 'GDP companion', change: 0 },
    { ...episode.sources[1], family: 'ism', sourceLabel: 'ISM opposing release', change: .2 },
    { ...episode.sources[1], family: 'retail', sourceLabel: 'Retail Sales', change: -.2 }] }
  assert.equal(roofLabel(companions), 'Claims + PCE + ISM +1', 'Deduplicate families, exclude zero companions, name opposing drivers too')
  assert.match(roofTooltip(companions), /GDP companion.*no comparable support change/)
  assert.match(roofTooltip(companions), /ISM opposing release.*interpreted support increased/)
  assert.match(roofTooltip(companions), /Retail Sales.*interpreted support decreased/)
  assert.equal(roofLabel({ ...episode, kind: 'ism-sectors', experimental: false }), 'ISM sectors')
  const bars = [0, 1, 3].map(n => ({ time: (at + n * hour) / 1000, open: 1, close: 1, high: 1, low: 1 }))
  let range = { from: at / 1000, to: (at + hour) / 1000 }, rangeHandler, sizeHandler, unsubscribed = 0, coordinateCalls = 0, pan = 0
  const scale = { getVisibleRange: () => range, width: () => 800,
    timeToCoordinate: time => { coordinateCalls++; return (time - at / 1000) / 3600 * 200 + 100 + pan },
    subscribeVisibleLogicalRangeChange: fn => { rangeHandler = fn }, unsubscribeVisibleLogicalRangeChange: fn => { assert.equal(fn, rangeHandler); unsubscribed++ },
    subscribeSizeChange: fn => { sizeHandler = fn }, unsubscribeSizeChange: fn => { assert.equal(fn, sizeHandler); unsubscribed++ } }
  const chartClicks = new Set()
  const chartApi = { timeScale: () => scale, subscribeClick: fn => chartClicks.add(fn), unsubscribeClick: fn => chartClicks.delete(fn) }
  assert.equal(roofBarIndex(bars, at + hour / 2, 'H1'), 0)
  assert.equal(roofBarIndex(bars, at - 1, 'H1'), null)
  assert.equal(roofBarIndex(bars, at + 2 * hour, 'H1'), null, 'Do not project onto a gap or future bar')
  let selected = null, opened = null, returned = false
  const roofProps = { chartApi, episodes: [episode], bars, timeframe: 'H1', markers: [{ release: { id: 'claims' }, symbol: 'cloud' }],
    currencyColors: { USD: '#123456' }, onOpenSource: source => { opened = source },
    now: episode.chartAt, experimental: true, onSelect: value => { selected = value } }
  const render = value => React.act(async () => root.render(value))
  await render(React.createElement(ComboRoofs, roofProps))
  const button = container.querySelector('[aria-label="Inspect combo Fresh-news sequence"]')
  assert.ok(button, 'A mid-candle publication is included on the final visible H1 bar')
  assert.match(button.textContent, /Claims \+ PCE.*Long/)
  assert.doesNotMatch(button.textContent, /Fresh news/)
  assert.equal(button.querySelector('.combo-roof-direction').textContent.trim(), '· Change: Aligned · Long', 'Direction stays outside the truncating name span')
  assert.match(button.title, /claims.*interpreted support decreased/)
  assert.match(button.title, /1 inputs hidden/)
  assert.match(button.title, /Available from/)
  assert.equal(container.querySelector('.combo-roof-start').style.left, '300px', 'Activation endpoint stays on the containing candle')
  assert.equal(container.querySelectorAll('circle').length, 1, 'Earlier contributors keep a hollow circle')
  assert.ok(container.querySelector('.combo-roof-start .combo-roof-diamond'), 'Memory activation uses an outlined diamond')
  assert.equal(container.querySelector('.combo-roof-update-badge').textContent, 'Aging update')
  assert.equal(container.querySelector('.combo-roof-start').textContent, '', 'The endpoint remains a compact geometric marker')
  assert.match(container.querySelector('.combo-roof-start').title, /Memory update; no new participating publication/)
  assert.equal(container.querySelector('.combo-roof-start').disabled, false, 'Memory activation opens its explanation')
  await React.act(async () => container.querySelector('.combo-roof-start').click()); assert.equal(selected, episode)
  assert.equal(button.querySelector('small'), null, 'Hidden input counts stay in explanations rather than crowding labels')
  assert.equal(container.querySelector('.combo-roof-symbol'), null, 'The ordinary marker row owns release symbols')
  assert.match(container.querySelector('.combo-roof-stem').getAttribute('d'), /160$/, 'Source connectors reach the existing bottom symbol row')
  assert.equal(container.querySelector('.combo-roofs').style.getPropertyValue('--inspector-usd-color'), '#123456')
  await React.act(async () => button.click()); assert.equal(selected, episode)
  const previousCalls = coordinateCalls
  await React.act(async () => { for (let i = 0; i < 200; i++) rangeHandler(); sizeHandler() })
  assert.equal(frames.size, 1, 'Panning and resizing coalesce; no mouse-move rescoring')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.ok(coordinateCalls - previousCalls < 10)
  const sourceSymbol = container.querySelector('.combo-roof-endpoint:not(.combo-roof-start)')
  assert.equal(sourceSymbol.textContent, '', 'Hollow dots leave roof rows uncluttered')
  await React.act(async () => sourceSymbol.click())
  assert.equal(opened.sourceId, 'claims', 'A release symbol opens its original publication')
  assert.equal(selected, episode, 'Release routing leaves the direction-box Combo callback untouched')
  const originalLeft = Number.parseFloat(button.style.left), originalTop = button.style.top
  pan = -160; range = { from: (at + hour) / 1000, to: (at + 3 * hour) / 1000 }
  await React.act(async () => rangeHandler())
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  const shifted = container.querySelector('.combo-roof-label')
  assert.equal(Number.parseFloat(shifted.style.left), originalLeft - 160, 'Label moves with the candles even after the source leaves the screen')
  assert.equal(shifted.style.top, originalTop)
  assert.equal(container.querySelector('.combo-roof-endpoint:not(.combo-roof-start)').style.left, '-60px', 'Offscreen sources remain the anchor and are clipped, not replaced')
  assert.equal(container.querySelector('.combo-roof-start').style.left, '140px')
  pan = 0; range = { from: at / 1000, to: (at + hour) / 1000 }
  await render(React.createElement(ComboRoofs, { ...roofProps, now: episode.chartAt - 1 }))
  assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null, 'Future activation is hidden')
  await render(React.createElement(ComboRoofs, { ...roofProps, experimental: false }))
  assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null)
  await render(React.createElement(ComboRoofs, { ...roofProps, markers: [] }))
  assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null)
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [{ ...episode, sources: [{ ...episode.sources[0], chartAt: episode.chartAt + 1 }] }] }))
  assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null, 'Defensively reject a snapshot containing future publications')
  const current = { ...episode, sources: [episode.sources[0], { ...episode.sources[1], chartAt: episode.chartAt }] }
  const visibleMarkers = [{ release: { id: 'claims' }, symbol: 'cloud' }, { release: { id: 'pce' }, symbol: 'star' }]
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [current], markers: visibleMarkers }))
  const start = container.querySelector('.combo-roof-start')
  assert.equal(start.textContent, '')
  assert.ok(start.querySelector('circle'), 'Publication activation keeps the filled circle')
  assert.equal(container.querySelector('.combo-roof-update-badge'), null, 'Publication Roof labels retain their compact layout')
  await React.act(async () => start.click()); assert.equal(opened.sourceId, 'pce', 'The final release symbol opens the actual activation publication')
  const nearby = { ...current, sources: [...current.sources, { ...current.sources[1], sourceId: 'gdp', sourceLabel: 'GDP', family: 'gdp' }] }
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [nearby], markers: [...visibleMarkers, { release: { id: 'gdp' }, symbol: 'umbrella' }] }))
  await React.act(async () => container.querySelector('.combo-roof-start').click())
  assert.match(container.querySelector('[role="dialog"]').textContent, /pce.*GDP|GDP.*pce/)
  await React.act(async () => [...container.querySelectorAll('.combo-roof-release-chooser > button')].find(b => b.textContent.includes('GDP')).click())
  assert.equal(opened.sourceId, 'gdp')
  assert.equal(container.querySelector('[role="dialog"]'), null)
  await React.act(async () => container.querySelector('.combo-roof-start').click())
  await React.act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(container.querySelector('[role="dialog"]'), null)
  assert.equal(document.activeElement, container.querySelector('.combo-roof-start'))
  await React.act(async () => container.querySelector('.combo-roof-start').click())
  assert.ok(container.querySelector('[role="dialog"]'))
  await React.act(async () => { for (const click of chartClicks) click({ point: { x: 500, y: 50 } }) })
  assert.equal(container.querySelector('[role="dialog"]'), null, 'Blank chart click dismisses the release chooser')
  assert.equal(chartClicks.size, 0, 'Transient chooser subscriptions detach after dismissal')
  const zoomed = await load('usd-context/sequences/chart/roof-plan.ts')
  const compact = zoomed.createRoofPlan(zoomed.prepareRoofAnchors([current], bars, 'H1', visibleMarkers, true, 1), 12, false)
  assert.equal(compact.entries[0].positioned.endpoints.length, 2, 'Zooming out never moves an earlier candle onto the activation dot')
  assert.equal(compact.entries[0].positioned.endpoints[0].activation, false)
  assert.equal(compact.entries[0].positioned.endpoints[1].activation, true)
  const sameCandle = { ...current, sources: [{ ...current.sources[0], chartAt: current.chartAt - 1 }, current.sources[1]] }
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [sameCandle], markers: visibleMarkers }))
  assert.equal(container.querySelectorAll('.combo-roof-endpoint').length, 1, 'Publications sharing a candle anchor have one dot')
  await React.act(async () => container.querySelector('.combo-roof-start').click())
  assert.equal(opened.sourceId, 'pce', 'The filled dot routes only the exact activating publication, not earlier data in its candle')
  assert.equal(container.querySelector('[role="dialog"]'), null)
  selected = null
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [current], markers: visibleMarkers.slice(0, 1) }))
  await React.act(async () => container.querySelector('.combo-roof-start').click())
  assert.equal(selected, current, 'A hidden activation publication opens Combo details instead of an earlier source')
  // Monthly ISM grouping anchors the symbol to Manufacturing even though the
  // Services publication activates the relationship later. Do not draw a
  // nearly horizontal stem returning from Services to that earlier symbol.
  const sectorCombo = { ...current, kind: 'ism-sectors', experimental: false, sources: current.sources.map((s, i) => ({ ...s,
    family: 'ism', sourceId: i ? 'ism-services' : 'ism-manufacturing', sourceLabel: i ? 'ISM Services' : 'ISM Manufacturing' })) }
  const sectorMarker = { time: at / 1000, release: { id: 'ISM/month', ismPublications: [{ id: 'ism-manufacturing' }, { id: 'ism-services' }] }, symbol: 'umbrella' }
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [sectorCombo], markers: [sectorMarker] }))
  assert.equal(container.querySelector('.combo-roof-start').style.left, '300px', 'Grouped sector activation keeps the later candle')
  const sectorStems = [...container.querySelectorAll('.combo-roof-stem')].map(path => path.getAttribute('d'))
  assert.ok(sectorStems.length)
  assert.ok(sectorStems.every(d => /^M [-\d.]+ [-\d.]+ V [-\d.]+$/.test(d)), 'Only vertical stems; no extra diagonal or horizontal return line')
  await React.act(async () => container.querySelector('.combo-roof-start').click())
  assert.equal(opened.sourceId, 'ism-services', 'The later sector publication remains inspectable despite its earlier grouped symbol')
  range = { from: at / 1000, to: (at + 4 * hour) / 1000 }
  const crowded = Array.from({ length: 4 }, (_, i) => ({ ...episode, id: 'roof/' + i }))
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: crowded }))
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 1, 'Focused mode suppresses repeated overlapping family combinations')
  assert.match(container.querySelector('.combo-roof-overflow button').textContent, /\+3/)
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), density: 'all' }))
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 3)
  const more = container.querySelector('.combo-roof-overflow button'); assert.match(more.textContent, /\+1/)
  await React.act(async () => more.click()); assert.equal(more.getAttribute('aria-expanded'), 'true')
  assert.match(container.querySelector('.combo-roof-overflow > div button').textContent, /Claims \+ PCE/)

  const timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }
  await render(React.createElement(ComboInspector, { combo: episode, symbol: 'EURUSD', timeDisplay,
    onClose: () => { returned = true }, onOpenRelease: s => { opened = s } }))
  assert.ok(unsubscribed >= 2, 'Chart handlers detach when opening Inspector')
  assert.equal(container.querySelector('details'), null, 'Combo details remain flat')
  assert.equal(container.querySelector('.combo-inspector-scroll').firstElementChild.getAttribute('aria-label'), 'Roof interpretation', 'Direction is the first content')
  assert.match(container.textContent, /Available from/)
  assert.match(container.textContent, /Memory update; no new publication/)
  assert.equal(container.querySelector('[aria-label="Combo context contributions"]'), null, 'Calculations are optional and not mounted by default')
  assert.match(container.querySelector('[aria-label="Why this direction"]').textContent, /claims gives most Long support/)
  await React.act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Advanced calculations').click())
  assert.match(container.textContent, /Accumulated context before → after/)
  assert.match(container.textContent, /No later publications or prices/)
  const cpiRow = [...container.querySelectorAll('[aria-label="Combo context contributions"] tbody tr')].find(r => r.textContent.includes('CPI'))
  assert.match(cpiRow.textContent, /Enabled/); assert.match(cpiRow.textContent, /No history/)
  const participant = [...container.querySelectorAll('button')].find(b => b.textContent === 'pce')
  await React.act(async () => participant.click()); assert.equal(opened.sourceId, 'pce')
  await React.act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Return to releases').click())
  assert.equal(returned, true)

  const expired = { ...episode, activation: { kind: 'expiry', removed: [{ sourceId: 'ppi-old', sourceLabel: 'PPI removed publication',
    chartAt: at - 7 * 24 * hour, releaseAt: at - 7 * 24 * hour - 3 * hour, reason: 'fresh-window' }] } }
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [expired] }))
  assert.equal(container.querySelector('.combo-roof-update-badge').textContent, 'Expiry update')
  assert.match(container.querySelector('.combo-roof-start').title, /seven-day fresh-news window: PPI removed publication/)
  const previousOpened = opened
  await React.act(async () => container.querySelector('.combo-roof-start').click())
  assert.equal(selected, expired, 'Expiry diamonds open the snapshot explanation')
  assert.equal(opened, previousOpened, 'Memory endpoints do not pretend to open a new release')
  await render(React.createElement(ComboInspector, { combo: expired, symbol: 'EURUSD', timeDisplay, onClose() {}, onOpenRelease() {} }))
  assert.match(container.textContent, /Expiry update.*Memory update; no new publication/)
  assert.match(container.textContent, /Removed from the seven-day fresh-news window: PPI removed publication/)

  const mixedEpisode = { ...episode, sources: episode.sources.map((s, i) => ({ ...s, change: i ? .105 : -.1, comparable: true })),
    catalogue: { enabled: ['claims', 'pce', 'cpi'], fresh: episode.sources.map((s, i) => ({ ...s, change: i ? .105 : -.1, comparable: true })), fed: null },
    decision: { state: 'mixed', coverage: 1, agreement: .01, reason: 'Economic changes nearly cancel.' }, strength: null }
  await render(React.createElement(ComboInspector, { combo: mixedEpisode, symbol: 'EURUSD', timeDisplay, onClose() {}, onOpenRelease() {} }))
  assert.equal(container.querySelector('.combo-bias').textContent, 'Conflicted · Short leads')
  assert.ok(container.querySelector('.combo-bias.short'))
  assert.match(container.querySelector('[aria-label="Why this direction"]').textContent, /lead is narrow/)
  assert.match(container.querySelector('[aria-label="Accumulated context comparison"]').textContent, /Insufficient context → Insufficient context/)
  assert.match(container.querySelector('[aria-label="Participating publications"]').textContent, /EURUSD Long/, 'Standalone directions remain separate from withheld combined output')
  const catalogue = container.querySelector('[aria-label="USD relationship catalogue"]')
  await React.act(async () => catalogue.querySelector('button').click())
  assert.equal(catalogue.querySelectorAll('details tbody tr').length, 36, 'Every USD pair is inspectable')
  assert.equal(catalogue.querySelectorAll('fieldset input').length, 9, 'Any larger group can be selected')
  const mode = catalogue.querySelector('select')
  await React.act(async () => { mode.value = 'fresh'; mode.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.match(catalogue.querySelector('.combo-bias').textContent, /Conflicted.*Short leads/)
  const cpiPair = [...catalogue.querySelectorAll('details button')].find(b => b.textContent.includes('CPI') && b.textContent.includes('PCE'))
  await React.act(async () => cpiPair.click())
  assert.equal(catalogue.querySelector('.combo-bias').textContent, 'Insufficient evidence')
  assert.match(catalogue.textContent, /No preceding publication available/)

  familySettings.saveRaycasterFamilies(['claims', 'pce', 'cpi'])
  const relative = readRelativePreferences()
  await render(React.createElement(RaycasterSettings, { symbol: 'EURUSD', supported: true, relativeSupported: true, timeDisplay,
    inspection: { usd: { chartAt: episode.chartAt, result: after }, eur: null, fresh: null, cutoff: episode.chartAt, held: true,
      loading: false, message: null, signature: inspectionSignature(familySettings.readRaycasterFamilies(), relative.mode, relative.families), window: null } }))
  const headings = [...container.querySelectorAll('h3')].map(h => h.textContent)
  assert.deepEqual(headings, ['Accumulated context', 'Inputs and contributions', 'Active relationships', 'Fresh-news change · Experimental', 'Calculation and evidence'])
  assert.equal(container.querySelector('details'), null)
  assert.match(container.textContent, /last inspected candle/)
  await React.act(async () => prefs.saveSequencePreferences({ roofs: true, fresh: false, ribbon: false }))
  assert.equal(prefs.readSequencePreferences().fresh, false)
  assert.equal(container.querySelector('[aria-label="Experimental fresh news"]'), null)
  const exported = exportWorkspace(); assert.equal(JSON.parse(exported.entries[prefs.sequencePreferencesKey]).fresh, false)
  await React.act(async () => { prefs.saveSequencePreferences({ roofs: false, fresh: true }); restoreWorkspace(exported) })
  assert.deepEqual(prefs.readSequencePreferences(), { roofs: true, fresh: false, ribbon: false })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...exported, entries: { [prefs.sequencePreferencesKey]: '{"roofs":true,"fresh":"yes"}' } })))
  let changes = 0; const listener = () => { changes++ }
  dom.addEventListener(prefs.sequencePreferencesKey + ':changed', listener)
  await React.act(async () => prefs.saveSequencePreferences(prefs.readSequencePreferences()))
  assert.equal(changes, 0, 'No-op preference writes do not invalidate UI')
  dom.removeEventListener(prefs.sequencePreferencesKey + ':changed', listener)
  console.log('✓ Roof geometry, publication cutoff, focused/all overflow, coalesced pan, result-first optional calculations, Inspector links and portable display settings')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
