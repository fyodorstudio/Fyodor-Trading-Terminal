import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Node: dom.Node, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
try {
  const { defaultMacroPreferences, setMacroCurrency, setMacroEvents, saveMacroPreferences, readMacroPreferences } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  const { macroCatalog } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-catalog.ts')
  const { macroLanes, patchMacroLayout } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-layout.ts')
  const { saveMacroPreset, loadMacroPreset, readMacroPresets, writeMacroPresets, exportMacroPresets, importMacroPresets, parseMacroPresets } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-presets.ts')
  const { createMacroLaneControls } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-lane-controls.ts')
  const eur = Object.keys(macroCatalog).find(key => macroCatalog[key].currency === 'EUR')
  let p = { ...defaultMacroPreferences, enabled: true, currencies: ['USD'], eventsByCurrency: { USD: Object.keys(defaultMacroPreferences.series) } }
  p = patchMacroLayout(p, { laneMode: true, laneSpacing: 80, rowOffsets: { rate: -13.25, coreCpi: 21 }, laneOffset: 45, laneScroll: 60, linked: true,
    axisPlacements: { rate: { from: 0, to: 10, height: 200, unitsPerPixel: 0.08, topValue: 13 } } })
  p = { ...p, series: { ...p.series, rate: { ...p.series.rate, color: '#aabbcc', numbersVisible: true } } }
  const anchors = profile => Object.fromEntries(macroLanes(profile).groups.flatMap(group => group.rows.map(row => [row.key, row.y + (profile.layout?.rowOffsets?.[row.key] ?? 0)])))
  const usdPositions = anchors(p)
  p = setMacroEvents(setMacroCurrency(p, 'EUR', true), 'EUR', [eur])
  for (const [key, y] of Object.entries(usdPositions)) assert.equal(anchors(p)[key], y, 'Adding another currency retains existing row anchors')
  const beforeOff = anchors(p), off = setMacroCurrency(p, 'USD', false)
  assert.equal(anchors(off)[eur], beforeOff[eur], 'Hiding USD never packs EUR upwards')
  saveMacroPreferences(off)
  p = setMacroCurrency(readMacroPreferences(), 'USD', true)
  assert.deepEqual(anchors(p), beforeOff, 'Off → save → refresh → on restores every line anchor')
  assert.equal(p.series.rate.color, '#aabbcc'); assert.equal(p.layout.laneScroll, 60)
  for (const code of ['EUR', 'USD']) p = setMacroCurrency(p, code, false)
  saveMacroPreferences(p)
  p = setMacroCurrency(setMacroCurrency(readMacroPreferences(), 'USD', true), 'EUR', true)
  assert.deepEqual(anchors(p), beforeOff, 'Turning every currency off keeps all saved slots')
  let presets = saveMacroPreset([], 'USD + EUR', p), id = presets[0].id
  writeMacroPresets(presets)
  p = { ...p, series: { ...p.series, rate: { ...p.series.rate, color: '#112233' } } }
  assert.equal(readMacroPresets()[0].preferences.series.rate.color, '#aabbcc', 'Working edits cannot mutate a named snapshot')
  const restored = loadMacroPreset(readMacroPresets()[0], true)
  assert.deepEqual(anchors(restored), beforeOff); assert.equal(restored.layout.laneScroll, 60)
  assert.deepEqual(restored.layout.axisPlacements.rate, p.layout.axisPlacements.rate)
  presets = saveMacroPreset(presets, 'USD + EUR', p, id)
  writeMacroPresets(presets)
  assert.equal(readMacroPresets()[0].preferences.series.rate.color, '#112233', 'Explicit Update replaces the snapshot')
  const exported = exportMacroPresets(presets)
  assert.deepEqual(parseMacroPresets(exported), presets)
  const imported = importMacroPresets(presets, exported)
  assert.equal(imported.length, 2); assert.notEqual(imported[0].id, imported[1].id)
  assert.deepEqual(imported[0].preferences, imported[1].preferences)
  assert.throws(() => importMacroPresets(presets, '{bad'))
  const malformed = JSON.parse(exported); malformed.presets[0].preferences.layout.axisPlacements.rate.unitsPerPixel = -1
  assert.throws(() => importMacroPresets(presets, JSON.stringify(malformed)))
  assert.deepEqual(readMacroPresets(), presets, 'Rejected imports leave existing presets intact')

  const { createMacroPresetControls } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preset-controls.ts')
  let quickPreferences = restored, quick
  quick = createMacroPresetControls(next => { quickPreferences = next; quick.sync(next) })
  quick.sync(quickPreferences); host.append(quick.element)
  quick.element.querySelector('input').value = 'Quick saved'
  ;[...quick.element.querySelectorAll('button')].find(button => button.textContent === 'Save as…').click()
  const quickId = quickPreferences.presetId
  assert.equal(readMacroPresets().find(item => item.id === quickId).name, 'Quick saved')
  quickPreferences = { ...quickPreferences, series: { ...quickPreferences.series, rate: { ...quickPreferences.series.rate, color: '#abcdef' } } }; quick.sync(quickPreferences)
  assert.equal(readMacroPresets().find(item => item.id === quickId).preferences.series.rate.color, '#aabbcc')
  ;[...quick.element.querySelectorAll('button')].find(button => button.textContent === 'Update preset').click()
  assert.equal(readMacroPresets().find(item => item.id === quickId).preferences.series.rate.color, '#abcdef')
  const quickSelect = quick.element.querySelector('select'); quickSelect.value = id; quickSelect.dispatchEvent(new dom.Event('change'))
  assert.equal(quickPreferences.series.rate.color, '#112233', 'Popover selection loads the chosen saved snapshot')
  quick.element.remove(); writeMacroPresets(presets)

  // Cold lane-controller mount restores saved viewport rather than a process-local variable.
  const shell = document.createElement('div'); host.append(shell)
  let current = restored, controls
  const position = () => controls.position(current, 900, 200, 30, 0)
  controls = createMacroLaneControls(shell, () => {}, next => { current = next; saveMacroPreferences(next); position() })
  controls.setRows([]); position()
  const rateY = controls.y('rate')
  assert.equal(shell.querySelector('.macro-lane-scroll').scrollTop, 60)
  controls.scrollLanes(new dom.WheelEvent('wheel', { deltaY: 40, cancelable: true }))
  dom.dispatchEvent(new dom.Event('pagehide'))
  assert.equal(readMacroPreferences().layout.laneScroll, 100, 'Page exit flushes a pending debounced scroll save')
  const scrolledY = controls.y('rate'); assert.equal(scrolledY, rateY - 40)
  controls.destroy(); shell.remove()
  const freshShell = document.createElement('div'); host.append(freshShell)
  const fresh = createMacroLaneControls(freshShell, () => {}, () => {})
  fresh.setRows([]); fresh.position(readMacroPreferences(), 900, 200, 30, 0)
  assert.equal(fresh.y('rate'), scrolledY, 'Fresh mount restores exact scrolled line placement')
  fresh.destroy(); freshShell.remove()

  const { MacroSettingsDialog } = await server.ssrLoadModule('./src/market-data/indicators/macro/MacroSettingsDialog.tsx')
  let applied, closed = 0
  const render = () => React.act(async () => root.render(React.createElement(MacroSettingsDialog, { preferences: restored, onSave: next => { applied = next }, onClose: () => closed++ })))
  const button = text => [...host.querySelectorAll('button')].find(item => item.textContent === text)
  const props = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
  await render()
  await React.act(async () => button('Presets').click())
  await React.act(async () => props(host.querySelector('[aria-label="MFDI preset name"]')).onChange({ target: { value: 'Another layout' } }))
  await React.act(async () => button('Save as…').click())
  assert.equal(readMacroPresets().length, 1, 'Settings library edits remain drafts before OK')
  await React.act(async () => button('Cancel').click())
  assert.equal(applied, undefined); assert.equal(closed, 1); assert.equal(readMacroPresets().length, 1)
  await React.act(async () => root.render(null)); await render()
  await React.act(async () => button('Presets').click())
  await React.act(async () => props(host.querySelector('[aria-label="MFDI preset name"]')).onChange({ target: { value: 'Saved draft' } }))
  await React.act(async () => button('Save as…').click())
  await React.act(async () => host.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(readMacroPresets().length, 2); assert.ok(applied)
  const realStorage = Object.getOwnPropertyDescriptor(dom, 'localStorage'), storage = dom.localStorage
  Object.defineProperty(dom, 'localStorage', { configurable: true, value: { getItem: storage.getItem.bind(storage), setItem: () => { throw new Error('quota exceeded') } } })
  try {
    assert.equal(saveMacroPreferences(restored), false, 'A failed working-layout save is reported rather than marked saved')
    assert.throws(() => writeMacroPresets(presets), /quota exceeded/, 'Preset storage failures remain visible to their UI caller')
  } finally { if (realStorage) Object.defineProperty(dom, 'localStorage', realStorage); else delete dom.localStorage }
  console.log('✓ MFDI presets: stable currency anchors, refresh/exit scroll restoration, immutable snapshots, explicit updates, portable validated backups and settings Save/Cancel')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
