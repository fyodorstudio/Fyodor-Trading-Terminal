import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT']
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
  let range = { from: at / 1000, to: (at + hour) / 1000 }, rangeHandler, sizeHandler, unsubscribed = 0, coordinateCalls = 0, pan = 0, spacing = 200, paneHeight = 576, chartWidth = 800
  const scale = { getVisibleRange: () => range, width: () => chartWidth, options: () => ({ barSpacing: spacing }),
    timeToCoordinate: time => { coordinateCalls++; const index = bars.findIndex(b => b.time === time); return index < 0 ? null : index * spacing + 100 + pan },
    subscribeVisibleLogicalRangeChange: fn => { rangeHandler = fn }, unsubscribeVisibleLogicalRangeChange: fn => { assert.equal(fn, rangeHandler); unsubscribed++ },
    subscribeSizeChange: fn => { sizeHandler = fn }, unsubscribeSizeChange: fn => { assert.equal(fn, sizeHandler); unsubscribed++ } }
  const chartClicks = new Set()
  const chartApi = { timeScale: () => scale, paneSize: () => ({ height: paneHeight }), subscribeClick: fn => chartClicks.add(fn), unsubscribeClick: fn => chartClicks.delete(fn) }
  assert.equal(roofBarIndex(bars, at + hour / 2, 'H1'), 0)
  assert.equal(roofBarIndex(bars, at - 1, 'H1'), null)
  assert.equal(roofBarIndex(bars, at + 2 * hour, 'H1'), null, 'Do not project onto a gap or future bar')
  let selected = null, opened = null, returned = false
  const roofProps = { chartApi, episodes: [episode], bars, timeframe: 'H1', markers: [{ time: at / 1000, release: { id: 'claims' }, symbol: 'cloud' }],
    currencyColors: { USD: '#123456' }, now: episode.chartAt, experimental: true, onSelect: value => { selected = value } }
  const render = value => React.act(async () => root.render(value))
  const flush = () => React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  await render(React.createElement(ComboRoofs, roofProps))
  const button = container.querySelector('[aria-label="Inspect combo Fresh-news sequence"]')
  assert.ok(button, 'A mid-candle publication is included on the final visible H1 bar')
  assert.match(button.textContent, /Claims \+ PCE.*Changes in support.*Long 100.0%Short 0.0%/)
  assert.equal(button.style.width, '220px'); assert.equal(button.style.height, '60px')
  assert.ok(button.classList.contains('long'), 'The background follows weighted support rather than a label abbreviation')
  assert.doesNotMatch(button.textContent, /Aligned|Conflicted|Long leads|Short leads/)
  assert.equal(button.style.left, '300px', 'The combo label sits on its available-from candle, rather than the bracket midpoint')
  assert.equal(container.querySelector('.combo-roof-endpoint'), null, 'Redundant source and activation dot buttons are removed')
  assert.equal(container.querySelector('circle'), null)
  assert.equal(container.querySelector('.combo-roof-connection'), null, 'Idle labels do not draw lines across the candles')
  assert.equal(container.querySelector('.combo-roof-anchor').getAttribute('d'), 'M 300 72 v 8', 'Idle stems stay short and on the activation column')
  const hoverCalls = coordinateCalls
  await React.act(async () => button.dispatchEvent(new dom.PointerEvent('pointerover', { bubbles: true })))
  assert.equal(container.querySelectorAll('.combo-roof-connection').length, 1, 'Hover reveals only the inspected connection')
  assert.equal(container.querySelector('.combo-roof-anchor'), null)
  await React.act(async () => button.dispatchEvent(new dom.PointerEvent('pointerout', { bubbles: true })))
  assert.equal(container.querySelector('.combo-roof-connection'), null, 'Leaving an unselected label restores its short stem')
  await React.act(async () => button.focus())
  assert.ok(container.querySelector('.combo-roof-connection'), 'Keyboard focus also reveals the connection')
  await React.act(async () => button.blur())
  assert.equal(container.querySelector('.combo-roof-connection'), null)
  assert.equal(coordinateCalls, hoverCalls, 'Pointer and focus interactions never reproject or repack chart history')
  assert.equal(button.querySelector('.combo-roof-scope').textContent, 'Changes in support')
  assert.match(button.title, /claims.*interpreted support decreased/)
  assert.match(button.title, /1 inputs have no drawable symbol/)
  assert.match(button.title, /Available from/)
  assert.equal(container.querySelector('.combo-roof-update-badge').textContent, '(Aging update)')
  assert.equal(container.querySelector('.combo-roofs').style.getPropertyValue('--inspector-usd-color'), '#123456')
  await React.act(async () => button.click()); assert.equal(selected, episode)
  await render(React.createElement(ComboRoofs, { ...roofProps, selectedId: episode.id }))
  assert.ok(container.querySelector('.combo-roof-connection.selected'), 'A selected connection stays visible without hover or focus')
  const previousCalls = coordinateCalls
  await React.act(async () => { for (let i = 0; i < 200; i++) rangeHandler(); sizeHandler() })
  assert.equal(frames.size, 1, 'Panning and resizing coalesce')
  await flush(); assert.ok(coordinateCalls - previousCalls < 10)
  const originalTop = button.style.top
  pan = -160; range = { from: (at + hour) / 1000, to: (at + 3 * hour) / 1000 }
  await React.act(async () => rangeHandler()); await flush()
  assert.equal(container.querySelector('.combo-roof-label').style.left, '140px')
  assert.equal(container.querySelector('.combo-roof-label').style.top, originalTop)
  assert.match(container.querySelector('.combo-roof-stem').getAttribute('d'), /^M -60 /, 'Offscreen input remains the source of the crossing connector')
  pan = 0; range = { from: at / 1000, to: (at + 3 * hour) / 1000 }
  await React.act(async () => button.focus())
  await render(React.createElement(ComboRoofs, { ...roofProps, markers: [] }))
  const withoutSymbols = container.querySelector('.combo-roof-label')
  assert.ok(withoutSymbols, 'Label admission depends on its own candle, even with no source symbols')
  await React.act(async () => withoutSymbols.dispatchEvent(new dom.PointerEvent('pointerover', { bubbles: true })))
  assert.equal(container.querySelector('.combo-roof-stem'), null, 'Unavailable source symbols do not create guessed blue connections')
  assert.ok(container.querySelector('.combo-roof-connection .combo-roof-anchor'), 'A source-free label retains its short anchor on hover')
  assert.match(withoutSymbols.title, /outside loaded chart history/)
  for (const patch of [{ now: episode.chartAt - 1 }, { experimental: false },
    { episodes: [{ ...episode, sources: [{ ...episode.sources[0], chartAt: episode.chartAt + 1 }] }] }]) {
    await render(React.createElement(ComboRoofs, { ...roofProps, ...patch }))
    assert.equal(container.querySelector('[aria-label="Clickable combo roofs"]'), null)
  }
  const current = { ...episode, sources: [episode.sources[0], { ...episode.sources[1], chartAt: episode.chartAt }] }
  const sectorCombo = { ...current, kind: 'ism-sectors', experimental: false, sources: current.sources.map((s, i) => ({ ...s,
    family: 'ism', sourceId: i ? 'ism-services' : 'ism-manufacturing', sourceLabel: i ? 'ISM Services' : 'ISM Manufacturing' })) }
  const sectorMarker = { time: at / 1000, release: { id: 'ISM/month', ismPublications: [{ id: 'ism-manufacturing' }, { id: 'ism-services' }] }, symbol: 'umbrella' }
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [sectorCombo], markers: [sectorMarker] }))
  assert.equal(container.querySelector('.combo-roof-connection'), null, 'A removed focused label does not revive its keyboard preview when it reappears')
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [sectorCombo], markers: [sectorMarker], selectedId: sectorCombo.id }))
  assert.equal(container.querySelector('.combo-roof-label').style.left, '300px', 'Later Services still determines the label clock')
  assert.equal(container.querySelectorAll('.combo-roof-stem').length, 1, 'Grouped monthly symbol receives one connector; no false stem at Services')
  assert.match(container.querySelector('.combo-roof-stem').getAttribute('d'), /^M 100 /)
  for (const zoom of [180, 220, 200]) {
    spacing = zoom; await React.act(async () => rangeHandler()); await flush()
    assert.equal(container.querySelector('.combo-roof-label').style.left, (zoom + 100) + 'px')
    assert.match(container.querySelector('.combo-roof-stem').getAttribute('d'), /^M 100 /, 'The same grouped-symbol connector survives every zoom')
  }
  const crowded = Array.from({ length: 9 }, (_, i) => ({ ...episode, id: 'roof/' + i }))
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: crowded }))
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 1, 'Focused mode suppresses repeated overlapping combos')
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), density: 'all' }))
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 6, 'Rows grow beyond three when the chart has room')
  assert.equal(container.querySelector('.combo-roofs').style.height, '422px')
  assert.equal(container.querySelector('.combo-roof-overflow').style.left, '300px', 'More stays on the same candle column as its crowded labels')
  const more = container.querySelector('.combo-roof-overflow button'); assert.match(more.textContent, /\+3/)
  const frozenEpisodes = JSON.stringify(crowded)
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), hiddenRoofs: ['fresh-news'] }))
  assert.equal(container.querySelector('.combo-roof-label'), null, 'Hidden combinations consume no label rows')
  assert.equal(container.querySelector('.combo-roof-overflow'), null, 'Hidden combinations contribute no More entries')
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), hiddenRoofs: [] }))
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 6)
  assert.match(container.querySelector('.combo-roof-overflow button').textContent, /\+3/)
  assert.equal(JSON.stringify(crowded), frozenEpisodes, 'Display filters leave canonical snapshots untouched')
  const pairEpisodes = crowded.map(c => ({ ...c, kind: 'release-relationship', experimental: false }))
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: pairEpisodes }))
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), hiddenRoofs: ['claims+pce'] }))
  assert.equal(container.querySelector('.combo-roof-label'), null)
  assert.equal(container.querySelector('.combo-roof-overflow'), null, 'Pair-specific filters remove labels and overflow together')
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), hiddenRoofs: ['claims+fed'] }))
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 6, 'Hiding another pair does not suppress visible relationships')
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), hiddenRoofs: [] }))
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: crowded }))
  await React.act(async () => container.querySelector('.combo-roof-overflow button').click())
  assert.ok(container.querySelector('.combo-roofs').classList.contains('combo-roof-choosing'), 'Opening More raises the owning layer above Candy')
  await React.act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })))
  assert.equal(container.querySelector('[aria-label="More combo roofs"]'), null)
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: crowded, selectedId: crowded[8].id }))
  assert.equal(container.querySelector('.combo-roof-label[aria-pressed="true"]').dataset.roofId, crowded[8].id, 'The selected combo cannot be replaced by another candidate after zoom')
  const other = container.querySelector('.combo-roof-label[aria-pressed="false"]')
  await React.act(async () => other.dispatchEvent(new dom.PointerEvent('pointerover', { bubbles: true })))
  assert.equal(container.querySelectorAll('.combo-roof-connection').length, 2, 'Previewing another label keeps the selected connection visible')
  await React.act(async () => other.dispatchEvent(new dom.PointerEvent('pointerout', { bubbles: true })))
  assert.equal(container.querySelectorAll('.combo-roof-connection').length, 1)
  await React.act(async () => other.dispatchEvent(new dom.PointerEvent('pointerover', { bubbles: true })))
  paneHeight = 304; await React.act(async () => sizeHandler()); await flush()
  assert.equal(container.querySelectorAll('.combo-roof-label').length, 2, 'Short charts keep the remaining combos in More')
  assert.equal(container.querySelector('.combo-roof-label[aria-pressed="true"]').dataset.roofId, crowded[8].id)
  assert.equal(container.querySelectorAll('.combo-roof-connection').length, 1, 'Chart navigation clears a transient hover preview while retaining selection')

  const laterColumn = crowded.map((c, i) => ({ ...c, id: 'later/' + i, chartAt: at + 3 * hour + i * 60000 }))
  const localProps = { ...roofProps, episodes: [...crowded, ...laterColumn], now: at + 4 * hour }
  await render(React.createElement(ComboRoofs, localProps))
  const localButtons = container.querySelectorAll('.combo-roof-overflow')
  assert.equal(localButtons.length, 2, 'Each competing candle gets its own More control')
  assert.deepEqual([...localButtons].map(b => b.style.left), ['300px', '500px'])
  await React.act(async () => localButtons[1].querySelector('button').click())
  const localMenu = container.querySelector('[aria-label="More combo roofs"]')
  assert.ok([...localMenu.querySelectorAll('button')].every(b => b.dataset.roofId.startsWith('later/')), 'A local menu contains only combos from that candle')
  const hiddenChoice = localMenu.querySelector('button').dataset.roofId
  await React.act(async () => localMenu.querySelector('button').click())
  assert.equal(selected.id, hiddenChoice)
  assert.equal(container.querySelector('[aria-label="More combo roofs"]'), null)
  await render(React.createElement(ComboRoofs, { ...localProps, selectedId: hiddenChoice }))
  assert.equal(container.querySelector('.combo-roof-label[aria-pressed="true"]').style.left, '500px', 'Choosing local overflow promotes the combo at its original time column')
  const hiddenCount = [...container.querySelectorAll('.combo-roof-overflow > button')].reduce((sum, b) => sum + Number(b.textContent.match(/\d+/)[0]), 0)
  assert.equal(hiddenCount + container.querySelectorAll('.combo-roof-label').length, localProps.episodes.length, 'Every visible combo is either shown or in exactly one local menu')
  const snapshotBeforeConcise = JSON.stringify(localProps.episodes)
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), density: 'concise' }))
  assert.equal(container.querySelector('.combo-roof-label'), null, 'Concise leaves all stacked labels out of the chart')
  assert.equal(container.querySelector('.combo-roof-connection'), null, 'A selected combo cannot revive long cables in Concise')
  assert.equal(container.querySelectorAll('.combo-column-stem').length, 2)
  assert.deepEqual([...container.querySelectorAll('.combo-roof-overflow > button')].map(b => b.textContent), ['+9 Combo', '+9 Combo'], 'Counts include the whole column rather than only hidden entries')
  assert.equal(container.querySelector('.combo-roofs').style.bottom, '34px', 'The stem layer ends at the time-axis boundary')
  const conciseButtons = container.querySelectorAll('.combo-roof-overflow > button')
  assert.equal(conciseButtons[1].getAttribute('aria-pressed'), 'true', 'The selected relationship column remains identifiable')
  await React.act(async () => conciseButtons[1].click())
  const conciseMenu = container.querySelector('[aria-label="More combo roofs"]')
  assert.equal(conciseMenu.querySelectorAll('button').length, 9)
  assert.match(conciseMenu.querySelector('header').textContent, /9 combinations.*Long leads: 9.*Short leads: 0.*Aging update.*No new release/)
  assert.ok([...conciseMenu.querySelectorAll('button')].every(b => b.dataset.roofId.startsWith('later/')))
  assert.match(conciseMenu.querySelector('button small').textContent, /2020/, 'Existing per-entry exact clock remains intact')
  const conciseChoice = conciseMenu.querySelector('button').dataset.roofId
  await React.act(async () => conciseMenu.querySelector('button').click())
  assert.equal(selected.id, conciseChoice)
  await render(React.createElement(ComboRoofs, { ...localProps, selectedId: conciseChoice }))
  assert.equal(container.querySelector('.combo-roof-label'), null, 'Selecting an entry keeps the chart compact')
  assert.equal(container.querySelectorAll('.combo-roof-overflow').length, 2)
  assert.equal(JSON.stringify(localProps.episodes), snapshotBeforeConcise)
  const chartElement = document.createElement('div')
  let axisHeight = 27
  Object.defineProperty(chartElement, 'clientHeight', { get: () => paneHeight + axisHeight })
  await render(React.createElement(ComboRoofs, { ...localProps, chartApi: { ...chartApi, chartElement: () => chartElement }, selectedId: conciseChoice }))
  assert.equal(container.querySelector('.combo-roofs').style.bottom, '27px', 'Concise stems end above the measured time axis')
  axisHeight = 39
  await React.act(async () => sizeHandler()); await flush()
  assert.equal(container.querySelector('.combo-roofs').style.bottom, '39px', 'Resizing the axis preserves the attachment boundary')
  assert.deepEqual([...container.querySelectorAll('.combo-roof-overflow')].map(b => b.style.left), ['300px', '500px'], 'Axis resizing does not shift the owning candle columns')
  await render(React.createElement(ComboRoofs, { ...localProps, selectedId: conciseChoice }))
  const coordinatesBeforeMenu = coordinateCalls
  await React.act(async () => container.querySelector('.combo-roof-overflow > button').click())
  await React.act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })))
  assert.equal(coordinateCalls, coordinatesBeforeMenu, 'Opening and closing the popover does not reproject history')
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), hiddenRoofs: ['fresh-news'] }))
  assert.equal(container.querySelector('.combo-roof-overflow'), null, 'Roof filters also remove Concise buttons and counts')
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), hiddenRoofs: [], density: 'all' }))
  await React.act(async () => container.querySelector('.combo-roof-overflow > button').click())
  pan = -80; await React.act(async () => rangeHandler()); await flush()
  assert.equal(container.querySelector('[aria-label="More combo roofs"]'), null, 'Chart navigation closes local overflow')
  assert.deepEqual([...container.querySelectorAll('.combo-roof-overflow')].map(b => b.style.left), ['220px', '420px'], 'Panning carries each More control with its candle')

  const offscreen = { ...episode, id: 'offscreen', chartAt: at, sources: [episode.sources[0]] }
  const isolated = { ...episode, id: 'isolated', chartAt: at + 3 * hour }
  chartWidth = 150
  for (const zoom of [70, 60]) {
    spacing = zoom; pan = 75 - 2 * spacing - 100
    await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [offscreen, isolated], now: at + 4 * hour }))
    await React.act(async () => rangeHandler()); await flush()
    assert.equal(container.querySelectorAll('.combo-roof-label').length, 1)
    assert.equal(container.querySelector('.combo-roof-label').dataset.roofId, isolated.id, 'The visible label survives one zoom-out step with only offscreen competitors')
    assert.equal(container.querySelector('.combo-roof-label').style.left, '75px')
    assert.equal(container.querySelector('.combo-roof-overflow'), null, 'Offscreen competition cannot create a stray More button')
  }
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), density: 'concise' }))
  assert.equal(container.querySelectorAll('.combo-roof-overflow').length, 1, 'Concise admits only visible activation columns')
  assert.equal(container.querySelector('.combo-roof-overflow > button').textContent, '+1 Combo')
  assert.equal(container.querySelector('.combo-roof-overflow').style.left, '75px')
  await React.act(async () => prefs.saveSequencePreferences({ ...prefs.readSequencePreferences(), density: 'all' }))
  chartWidth = 800; spacing = 200; pan = 0

  const { InspectorChartMarkers } = await load('inspector/InspectorChartMarkers.tsx')
  const emphasisScale = { ...scale, subscribeVisibleLogicalRangeChange() {}, unsubscribeVisibleLogicalRangeChange() {},
    subscribeSizeChange() {}, unsubscribeSizeChange() {} }
  const emphasisChart = { ...chartApi, timeScale: () => emphasisScale }
  const symbolMarkers = [sectorMarker, { time: bars[2].time, release: { id: 'unrelated', currency: 'USD', label: 'Other', releaseAt: at }, symbol: 'cloud' }]
    .map(m => ({ ...m, release: { currency: 'USD', label: 'ISM', releaseAt: at, ...m.release } }))
  const markerLayer = chart => React.createElement(InspectorChartMarkers, { chartApi: chart, markers: symbolMarkers,
    timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onSelectRelease() {} })
  const emphasisView = selectedId => React.createElement(React.Fragment, null, markerLayer(emphasisChart),
    React.createElement(ComboRoofs, { ...roofProps, chartApi: emphasisChart, episodes: [sectorCombo], markers: symbolMarkers, selectedId }))
  const snapshot = JSON.stringify(sectorCombo), savedPreferences = localStorage.getItem(prefs.sequencePreferencesKey)
  await render(emphasisView(undefined))
  assert.equal(container.querySelector('.inspector-chart-symbol.roof-source'), null)
  await React.act(async () => container.querySelector('.combo-roof-label').dispatchEvent(new dom.PointerEvent('pointerover', { bubbles: true })))
  assert.equal(container.querySelectorAll('.inspector-chart-symbol.roof-source').length, 1, 'Grouped ISM members highlight their actual shared symbol, leaving unrelated symbols alone')
  await React.act(async () => container.querySelector('.combo-roof-label').dispatchEvent(new dom.PointerEvent('pointerout', { bubbles: true })))
  assert.equal(container.querySelector('.inspector-chart-symbol.roof-source'), null)
  await render(emphasisView(sectorCombo.id))
  assert.equal(container.querySelectorAll('.inspector-chart-symbol.roof-source').length, 1, 'Selection pins contributing symbol emphasis')
  await render(React.createElement(React.Fragment, null, emphasisView(sectorCombo.id), markerLayer({ ...emphasisChart })))
  const layers = container.querySelectorAll('.inspector-chart-markers')
  assert.equal(layers[0].querySelectorAll('.roof-source').length, 1)
  assert.equal(layers[1].querySelector('.roof-source'), null, 'A separate chart inherits no source emphasis from an active selection')
  await render(markerLayer(emphasisChart))
  assert.equal(container.querySelector('.inspector-chart-symbol.roof-source'), null, 'Removing Roofs clears symbol emphasis')
  await render(markerLayer({ ...emphasisChart }))
  assert.equal(container.querySelector('.inspector-chart-symbol.roof-source'), null, 'A separate chart inherits no source emphasis')
  assert.equal(JSON.stringify(sectorCombo), snapshot, 'Connection inspection does not mutate interpretation snapshots')
  assert.equal(localStorage.getItem(prefs.sequencePreferencesKey), savedPreferences, 'Connection inspection writes no display preferences')

  const timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }
  await render(React.createElement(ComboInspector, { combo: episode, symbol: 'EURUSD', timeDisplay,
    onClose: () => { returned = true }, onOpenRelease: s => { opened = s } }))
  assert.ok(unsubscribed >= 2, 'Chart handlers detach when opening Inspector')
  assert.equal(container.querySelector('details'), null, 'Combo details remain flat')
  assert.ok(container.querySelector('.combo-inspector > header [aria-label="Roof interpretation"]'), 'Result and evidence share the header')
  assert.match(container.querySelector('.combo-result').textContent, /weak evidence/)
  assert.equal(container.querySelector('.combo-inspector > header').nextElementSibling.getAttribute('aria-label'), 'Weighted directional support', 'Support stays above the scrolling body')
  assert.match(container.querySelector('.combo-support-values').textContent, /Long 100.0%Short 0.0%/)
  assert.equal(container.querySelector('.combo-support-fill > span').style.width, '100%')
  assert.match(container.querySelector('.combo-support-caption').textContent, /Main contributors: claims, pce/)
  assert.doesNotMatch(container.textContent, /Experimental|What did price do\?|Net .*separation/)
  assert.match(container.textContent, /Available from/)
  assert.match(container.textContent, /Memory update; no new publication/)
  assert.equal(container.querySelector('[aria-label="Combo context contributions"]'), null, 'Calculations are optional and not mounted by default')
  assert.match(container.querySelector('[aria-label="Why this direction"]').textContent, /claims gives most Long support/)
  await React.act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Advanced calculations').click())
  assert.match(container.querySelector('.combo-calculations').textContent, /Net -0.200 · Separation 100.0%/)
  assert.match(container.textContent, /Accumulated context before → after/)
  assert.match(container.textContent, /No later publications or prices/)
  const cpiRow = [...container.querySelectorAll('[aria-label="Combo context contributions"] tbody tr')].find(r => r.textContent.includes('CPI'))
  assert.match(cpiRow.textContent, /Enabled/); assert.match(cpiRow.textContent, /No history/)
  const participant = [...container.querySelectorAll('button')].find(b => b.textContent === 'pce')
  await React.act(async () => participant.click()); assert.equal(opened.sourceId, 'pce')
  await React.act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Return to releases').click())
  assert.equal(returned, true)

  let dockCombo = episode
  let raycasterOpens = 0
  const capturedCombo = JSON.stringify(episode)
  function CollapsibleCombo() {
    const [collapsed, setCollapsed] = React.useState(false)
    return React.createElement(ComboInspector, { combo: dockCombo, symbol: 'EURUSD', timeDisplay, collapsed,
      onToggleCollapsed: () => setCollapsed(value => !value), onClose() {}, onOpenRelease() {},
      onOpenRaycaster: () => raycasterOpens++ })
  }
  await render(React.createElement(CollapsibleCombo))
  const action = label => [...container.querySelectorAll('button')].find(b => b.textContent === label)
  await React.act(async () => action('Advanced calculations').click())
  const detailsNode = container.querySelector('[aria-label="Advanced calculation details"]')
  await React.act(async () => action('Collapse').click())
  assert.equal(container.querySelector('.combo-inspector-scroll').hidden, true)
  assert.equal(action('Expand').getAttribute('aria-expanded'), 'false')
  assert.equal(action('Expand').getAttribute('aria-controls'), container.querySelector('.combo-inspector-scroll').id)
  assert.ok(container.querySelector('.combo-support-values'))
  assert.equal(container.querySelector('.combo-support-caption'), null, 'Collapsed summary contains only the percentage bar')
  assert.equal(action('Hide Roof Candy'), undefined, 'Candy visibility uses the shared toolbar switch')
  await React.act(async () => action('Open in Raycaster').click())
  assert.equal(raycasterOpens, 1, 'The combo opens Raycaster only through an explicit action')
  assert.ok(container.querySelector('.combo-inspector.collapsed'), 'Opening Raycaster preserves the collapsed dock')
  dockCombo = { ...episode, sources: episode.sources.map(s => ({ ...s, change: .1 })) }
  await render(React.createElement(CollapsibleCombo))
  assert.ok(container.querySelector('.combo-inspector.collapsed'), 'Choosing another combo does not force expansion')
  assert.match(container.querySelector('.combo-support-values').textContent, /Long 0.0%Short 100.0%/)
  await React.act(async () => action('Expand').click())
  assert.equal(container.querySelector('.combo-inspector-scroll').hidden, false)
  assert.equal(container.querySelector('[aria-label="Advanced calculation details"]'), detailsNode, 'Collapse preserves the mounted details and advanced state')
  assert.equal(JSON.stringify(episode), capturedCombo, 'Presentation never edits the captured snapshot')

  const { ComboSupportSummary } = await load('usd-context/sequences/ui/ComboSupportSummary.tsx')
  const { roofSupport } = await load('usd-context/sequences/core/relationship-support.ts')
  const summarySupport = roofSupport(episode)
  // All chart label kinds share dimensions and plain shares, with no A/C text.
  const rateSource = { ...source('fed', null, episode.chartAt, 'rate'), usdDirection: 'stronger', policyAction: { action: 'Rate increase', delta: 25, actual: 4.5 } }
  const labelCases = [
    { combo: episode, tone: 'long', scope: 'Changes in support', shares: 'Long 100.0%Short 0.0%' },
    { combo: { ...episode, sources: episode.sources.map(s => ({ ...s, change: .1 })) }, tone: 'short', scope: 'Changes in support', shares: 'Long 0.0%Short 100.0%' },
    { combo: { ...episode, sources: episode.sources.map((s, i) => ({ ...s, change: i ? .1 : -.1 })) }, tone: 'balanced', scope: 'Changes in support', shares: 'Long 50.0%Short 50.0%' },
    { combo: { ...episode, sources: episode.sources.map(s => ({ ...s, change: 0 })) }, tone: 'insufficient', scope: 'Changes in support', shares: 'Long —Short —' },
    { combo: { ...episode, kind: 'release-relationship', experimental: false, sources: episode.sources.map(s => ({ ...s, total: 0 })) }, tone: 'unchanged', scope: 'Release support', shares: 'Long —Short —' },
    { combo: { ...episode, kind: 'release-relationship', experimental: false, sources: episode.sources.map((s, i) => ({ ...s, total: i ? null : -1 })) }, tone: 'insufficient', scope: 'Release support', shares: 'Long —Short —' },
    { combo: { ...episode, kind: 'fed-relationship', experimental: false, title: 'Claims + Fed', sources: [episode.sources[0], rateSource] }, tone: 'long', scope: 'Release support', shares: 'Long 100.0%Short 0.0%' },
  ]
  const untouchedLabels = JSON.stringify(labelCases)
  for (const { combo, tone, scope, shares } of labelCases) {
    await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [combo] }))
    const label = container.querySelector('.combo-roof-label')
    assert.equal(label.style.width, '220px'); assert.equal(label.style.height, '60px')
    assert.ok(label.classList.contains(tone))
    assert.equal(label.querySelector('.combo-roof-scope').textContent, scope)
    assert.equal(label.querySelector('.support-split').textContent, shares)
    assert.doesNotMatch(label.textContent, /Aligned|Conflicted|Long leads|Short leads/)
    if (combo.kind === 'fed-relationship') {
      assert.equal(label.querySelector('.combo-roof-rate').textContent, '(Rate +25 bp)', 'Rate action is inside the fixed label')
      assert.match(label.title, /Conflicted.*macro evidence/, 'Full Fed opposition semantics remain in the tooltip')
    }
  }
  assert.equal(JSON.stringify(labelCases), untouchedLabels)
  for (const state of ['insufficient', 'unchanged']) {
    await render(React.createElement(ComboSupportSummary, { support: { ...summarySupport, state, long: 0, short: 0 }, compact: false }))
    assert.match(container.textContent, /Long —Short —/)
    assert.doesNotMatch(container.textContent, /NaN|100\.0%/)
    assert.equal(container.querySelector('.combo-support-fill > span').style.width, '0%')
  }
  await render(React.createElement(ComboSupportSummary, { support: { ...summarySupport, state: 'balanced', long: 1, short: 1 }, compact: false }))
  assert.match(container.textContent, /Long 50.0%Short 50.0%/)
  assert.equal(container.querySelector('.combo-support-fill > span').style.width, '50%')

  const expired = { ...episode, activation: { kind: 'expiry', removed: [{ sourceId: 'ppi-old', sourceLabel: 'PPI removed publication',
    chartAt: at - 7 * 24 * hour, releaseAt: at - 7 * 24 * hour - 3 * hour, reason: 'fresh-window' }] } }
  await render(React.createElement(ComboRoofs, { ...roofProps, episodes: [expired] }))
  assert.equal(container.querySelector('.combo-roof-update-badge').textContent, '(Expiry update)')
  assert.match(container.querySelector('.combo-roof-label').title, /seven-day fresh-news window: PPI removed publication/)
  await React.act(async () => container.querySelector('.combo-roof-label').click())
  assert.equal(selected, expired, 'An expiry combo label opens its combined reading')
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
  console.log('✓ Roof geometry, transient/pinned connections, grouped symbol emphasis and cleanup, publication cutoff, focused/all overflow, coalesced pan, result-first optional calculations, Inspector links and portable display settings')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
