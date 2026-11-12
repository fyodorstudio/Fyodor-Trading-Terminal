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
  const { readMacroPreferences, saveMacroPreferences } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  const { defaultMacroCategories, macroLanes, macroLayout, macroCategory, macroCategories, patchMacroLayout, moveMacroRow, deleteMacroCategory } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-layout.ts')
  const { createMacroLaneControls } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-lane-controls.ts')
  let preferences = patchMacroLayout(readMacroPreferences('USDX'), { laneMode: true })
  assert.deepEqual(macroLanes(preferences).groups.find(group => group.id === 'labor').keys, ['payrolls', 'unemployment'])
  assert.deepEqual(macroLanes(preferences).groups.find(group => group.id === 'inflation').keys, ['headlineCpi', 'coreCpi'])
  const shell = document.createElement('div'); host.append(shell)
  let draws = 0, commits = 0
  const update = next => { commits++; preferences = next; position() }
  const controls = createMacroLaneControls(shell, () => draws++, update)
  const rows = ['rate', 'payrolls', 'unemployment', 'headlineCpi', 'coreCpi'].map(key => {
    const item = document.createElement('div'), axisButton = document.createElement('button')
    axisButton.dataset.macroAxis = key; item.append(axisButton); return { key, item, axisButton }
  })
  controls.setRows(rows)
  const position = () => controls.position(preferences, new Map(), 900, 400, 30, 0)
  position()
  shell.querySelector('.macro-inline-layer').getBoundingClientRect = () => ({ top: 30, left: 0, width: 900, height: 370 })
  const pointer = (target, type, y) => target.dispatchEvent(new dom.PointerEvent(type, { bubbles: true, button: 0, clientY: y, pointerId: 1 }))
  const startY = controls.y('payrolls'), otherY = controls.y('unemployment')
  const inflation = macroLanes(preferences).groups.find(group => group.id === 'inflation')
  pointer(rows[1].axisButton, 'pointerdown', startY)
  pointer(window, 'pointermove', 30 + inflation.top + 35)
  assert.notEqual(controls.y('payrolls'), startY, 'Dragging a row previews movement before committing')
  assert.equal(controls.y('unemployment'), otherY, 'A row drag leaves its peers in place')
  pointer(window, 'pointerup', 30 + inflation.top + 35)
  assert.equal(macroCategory(preferences, 'payrolls'), 'inflation', 'Dropping snaps the event into its target category')
  let axisClicks = 0
  rows[1].axisButton.onclick = () => { axisClicks++ }
  rows[1].axisButton.click()
  assert.equal(axisClicks, 0, 'The browser click after a drag cannot overwrite the saved drop with stale axis-selection state')
  pointer(rows[1].axisButton, 'pointerdown', controls.y('payrolls'))
  pointer(window, 'pointerup', controls.y('payrolls'))
  rows[1].axisButton.click()
  assert.equal(axisClicks, 1, 'An ordinary click still selects the axis')
  const beforeGroup = controls.y('unemployment'), beforePeer = controls.y('coreCpi')
  const header = shell.querySelector('[aria-label="Drag category Labor"]')
  const labor = macroLanes(preferences).groups.find(group => group.id === 'labor')
  pointer(header, 'pointerdown', 30 + labor.top)
  pointer(window, 'pointermove', 330)
  assert.notEqual(controls.y('unemployment'), beforeGroup, 'Dragging a category moves all of its rows during the preview')
  assert.equal(controls.y('coreCpi'), beforePeer, 'Other categories do not move with the dragged band')
  pointer(window, 'pointerup', 330)
  assert.notEqual(macroCategories(preferences).findIndex(group => group.id === 'labor'), 1, 'Dropping snaps the whole category into its new order')
  shell.querySelector('[aria-label="Collapse Inflation"]').click()
  assert.equal(controls.y('coreCpi'), null)
  assert.equal(rows[4].item.style.display, 'none', 'Collapsing hides inline controls with the category rows')
  shell.querySelector('[aria-label="Expand Inflation"]').click()
  assert.notEqual(controls.y('coreCpi'), null)
  pointer(rows[4].axisButton, 'pointerdown', controls.y('coreCpi'))
  pointer(window, 'pointermove', 160)
  const beforeCancel = commits
  window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' }))
  pointer(window, 'pointerup', 160)
  assert.equal(commits, beforeCancel, 'Escape cancels a drag without saving')
  assert.ok(draws > 0)
  controls.destroy()
  assert.equal(shell.querySelector('.macro-inline-layer'), null)

  preferences = { ...preferences, categories: [...macroCategories(preferences), { id: 'custom', label: 'My releases' }] }
  preferences = moveMacroRow(preferences, 'coreCpi', 'custom')
  preferences = deleteMacroCategory(preferences, 'custom')
  assert.equal(macroCategory(preferences, 'coreCpi'), 'uncategorized', 'Deleting a category retains its event under Uncategorized')
  preferences = patchMacroLayout(preferences, { hideLegend: true, collapsed: ['labor'] })
  saveMacroPreferences(preferences, 'USDX')
  assert.deepEqual(readMacroPreferences('USDX'), preferences, 'Categories, assignments, row order, collapse, lane view and Hide Legend survive refresh')
  assert.equal(macroLayout(readMacroPreferences('EURUSD')).hideLegend, false, 'Legend and category presentation stay symbol-specific')
  assert.equal(readMacroPreferences('EURUSD').categoryByEvent.payrolls, 'inflation', 'Category membership is shared with remembered event selections')

  const { MacroSettingsDialog } = await server.ssrLoadModule('./src/market-data/indicators/macro/MacroSettingsDialog.tsx')
  let saved
  await React.act(async () => root.render(React.createElement(MacroSettingsDialog, { preferences, onSave: next => { saved = next }, onClose() {} })))
  const hide = host.querySelector('[aria-label="Hide MFDI Legend"]')
  assert.equal(hide.checked, true)
  await React.act(async () => hide.click())
  await React.act(async () => host.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved.layout.hideLegend, false)
  assert.equal(preferences.layout.hideLegend, true, 'Hide Legend edits use the existing draft save/cancel boundary')
  await React.act(async () => root.render(null))
  const reordered = { ...patchMacroLayout(preferences, { categoryOrder: ['inflation', 'labor', 'policy'] }), categories: defaultMacroCategories }
  await React.act(async () => root.render(React.createElement(MacroSettingsDialog, { preferences: reordered, onSave: next => { saved = next }, onClose() {} })))
  const rename = host.querySelector('[aria-label="Category name inflation"]')
  const reactProps = rename[Object.getOwnPropertyNames(rename).find(key => key.startsWith('__reactProps$'))]
  await React.act(async () => reactProps.onChange({ target: { value: 'Price releases' } }))
  await React.act(async () => host.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(saved.categories.map(category => category.id), defaultMacroCategories.map(category => category.id), 'Renaming a shared category does not overwrite another symbol\'s presentation order')
  assert.equal(saved.layout.categoryOrder[0], 'inflation')
  console.log('✓ MFDI lanes: default/custom categories, row snap and whole-band drag previews, reorder/collapse, cancellation/cleanup, deletion retention, symbol-specific layout and shared currency membership persistence')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
