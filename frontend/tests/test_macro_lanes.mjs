import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Node: dom.Node }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const shell = document.createElement('div'); document.body.append(shell)
try {
  const p = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  const m = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-layout.ts')
  const { macroCatalog } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-catalog.ts')
  const { macroEventRowKey } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-event-key.ts')
  const { createMacroLaneControls } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-lane-controls.ts')
  const layout = { ...m.macroLayout(p.defaultMacroPreferences), laneMode: true }
  const duplicate = m.normalizeMacroCategories({ ...p.defaultMacroPreferences, categories: [
    { id: 'old-inflation', label: 'Inflation' }, ...m.defaultMacroCategories, { id: 'cftc', label: 'CFTC' }
  ], categoryByEvent: { coreCpi: 'old-inflation' }, categoryColors: { 'old-inflation': '#123456', inflation: '#abcdef' },
  layout: { ...layout, categoryOrder: ['old-inflation', 'inflation'], hiddenCategories: ['old-inflation'], collapsed: ['old-inflation'] },
  currencyViews: { CHF: { axisTarget: 'rate', layout: { ...layout, categoryOrder: ['old-inflation'] } } } })
  assert.equal(duplicate.categories.filter(category => category.label === 'Inflation').length, 1)
  assert.equal(duplicate.categoryByEvent.coreCpi, 'inflation'); assert.equal(duplicate.categoryColors.inflation, '#123456')
  assert.deepEqual(duplicate.layout.hiddenCategories, ['inflation']); assert.deepEqual(duplicate.currencyViews.CHF.layout.categoryOrder, ['inflation'])
  assert.ok(duplicate.categories.some(category => category.id === 'cftc'))
  let preferences = { ...p.defaultMacroPreferences, activeCurrency: 'USD', currencies: ['USD'], eventsByCurrency: { USD: ['rate', 'coreCpi', 'headlineCpi'] }, layout }
  const chartRows = () => m.macroLanes(preferences).groups.flatMap(group => group.rows).map(row => row.key)
  assert.equal(m.macroLanes(preferences).height, 4 * 24, 'Empty categories add no chart padding')
  let writes = 0, draws = 0, controls
  const rectangle = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top })
  const position = () => {
    controls.position(preferences, 900, 300, 30, 0)
    shell.querySelector('.macro-series-drawer').getBoundingClientRect = () => rectangle(0, 0, 900, 800)
    shell.querySelector('.macro-drawer-body').getBoundingClientRect = () => rectangle(0, 0, 900, 800)
    for (const [index, section] of [...shell.querySelectorAll('[data-macro-drawer-category]')].entries()) {
      section.getBoundingClientRect = () => rectangle(100, index * 100, 800, index * 100 + 100)
      for (const [n, row] of [...section.querySelectorAll('[data-macro-row]')].entries()) row.getBoundingClientRect = () => rectangle(100, index * 100 + 30 + n * 20, 800, index * 100 + 50 + n * 20)
    }
  }
  controls = createMacroLaneControls(shell, () => draws++, next => { writes++; preferences = next; position() })
  const rows = ['rate', 'headlineCpi', 'coreCpi', macroEventRowKey].map(key => {
    const item = document.createElement('div'), dragButton = document.createElement('button'), name = document.createElement('button'); name.textContent = key
    item.append(name, dragButton); return { key, item, dragButton }
  })
  controls.setRows(rows); position(); controls.toggleDrawer(true)
  const get = label => shell.querySelector(`[aria-label="${label}"]`)
  assert.equal(shell.querySelector('.macro-drawer-title').textContent, 'USD · Series')
  assert.equal(shell.querySelector('[data-macro-drawer-category="labor"]'), null)
  const pointer = (target, type, x, y) => target.dispatchEvent(new dom.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, pointerId: 1 }))
  const beforeFold = chartRows(), originalAxis = preferences.axisTarget
  get('Collapse Inflation').click()
  assert.deepEqual(chartRows(), beforeFold); assert.equal(preferences.axisTarget, originalAxis); assert.equal(preferences.layout.categoryTarget, undefined)
  assert.equal(rows.find(row => row.key === 'coreCpi').item.style.display, 'none')
  get('Select category Inflation').click(); assert.equal(preferences.layout.categoryTarget, 'inflation')
  get('Expand Inflation').click()
  const core = rows.find(row => row.key === 'coreCpi')
  pointer(core.dragButton, 'pointerdown', 500, 175); pointer(window, 'pointermove', 500, 125); pointer(window, 'pointerup', 500, 125)
  assert.deepEqual(chartRows().filter(key => key !== macroEventRowKey), ['rate', 'coreCpi', 'headlineCpi'], 'Row drag changes actual lane order')
  const groupHandle = get('Move category Inflation')
  pointer(groupHandle, 'pointerdown', 500, 110); pointer(window, 'pointermove', 500, 10); pointer(window, 'pointerup', 500, 10)
  assert.equal(m.macroCategories(preferences)[0].id, 'inflation')
  assert.deepEqual(chartRows().slice(0, 2), ['coreCpi', 'headlineCpi'])
  const canceled = writes
  pointer(core.dragButton, 'pointerdown', 500, 50); pointer(window, 'pointermove', 500, 150)
  window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })); pointer(window, 'pointerup', 500, 150)
  assert.equal(writes, canceled)
  get('Hide category Inflation').click()
  assert.equal(controls.y('coreCpi'), null); assert.equal(p.macroMetricVisible(preferences, 'coreCpi'), false)
  assert.equal(preferences.series.coreCpi.visible, true, 'Category hiding retains individual eye choices')
  get('Show category Inflation').click(); assert.notEqual(controls.y('coreCpi'), null)
  get('Add MFDI category').click()
  const categoryName = get('New MFDI category'); categoryName.value = 'CFTC'
  categoryName.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  const cftc = preferences.categories.find(category => category.label === 'CFTC'); assert.ok(cftc)
  assert.ok(shell.querySelector(`[data-macro-drawer-category="${cftc.id}"]`), 'A new empty custom category is a usable drop target')
  get('Add MFDI events').click()
  const search = get('Search MFDI events'); search.value = 'CFTC'; search.dispatchEvent(new dom.Event('input', { bubbles: true }))
  const destination = get('Category for new events'); destination.value = cftc.id
  const pick = shell.querySelector('.macro-picker-results input'); assert.ok(pick)
  const label = pick.getAttribute('aria-label').slice('Select '.length)
  const eventKey = Object.keys(macroCatalog).find(key => macroCatalog[key].controlLabel === label)
  pick.checked = true; pick.dispatchEvent(new dom.Event('change', { bubbles: true }))
  assert.ok(preferences.eventsByCurrency.USD.includes(eventKey)); assert.equal(m.macroCategory(preferences, eventKey), cftc.id)
  get('Hide category CFTC').click(); assert.equal(p.macroMetricVisible(preferences, eventKey), false)
  get('Show category CFTC').click()
  get('Edit category CFTC').click(); const rename = get('Rename MFDI category'); rename.value = 'Positions'
  rename.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  assert.ok(preferences.categories.some(category => category.label === 'Positions'))
  get('Edit category Positions').click(); get('Delete category Positions').click()
  assert.ok(preferences.eventsByCurrency.USD.includes(eventKey)); assert.equal(m.macroCategory(preferences, eventKey), 'uncategorized')
  shell.querySelector('[data-macro-all="visibility"]').click()
  assert.equal(preferences.showEventRow, false); assert.ok(p.selectedMacroMetrics(preferences).every(key => !preferences.series[key].visible))
  shell.querySelector('[data-macro-all="visibility"]').click(); assert.equal(preferences.showEventRow, true)
  position(); const beforePan = controls.y('rate')
  controls.startPlotDrag(new dom.PointerEvent('pointerdown', { button: 0, clientY: 100 }), false)
  pointer(window, 'pointermove', 500, 125); pointer(window, 'pointerup', 500, 125)
  assert.equal(controls.y('rate'), beforePan + 25); assert.equal(preferences.layout.laneOffset, 25)
  let selectedAfterPan = 0; const nameAfterPan = rows[0].item.querySelector('button'); nameAfterPan.onclick = () => selectedAfterPan++
  nameAfterPan.click(); assert.equal(selectedAfterPan, 1, 'Panning the chart cannot swallow the next keyboard activation in Series')
  const chf = Object.keys(macroCatalog).find(key => macroCatalog[key].eventId === '756010001')
  preferences = p.switchMacroCurrency(p.setMacroEvents(preferences, 'CHF', [chf]), 'CHF'); position()
  assert.equal(shell.querySelector('.macro-drawer-title').textContent, 'CHF · Series')
  assert.equal(shell.querySelector('.macro-drawer-picker').hidden, true)
  p.saveMacroPreferences(preferences); assert.deepEqual(p.readMacroPreferences().currencyViews, preferences.currencyViews)
  controls.destroy(); assert.equal(shell.children.length, 0); assert.ok(draws > 0)
  console.log('✓ MFDI Series: category merge, compact ordered lanes, independent folding/eyes, drag/drop/cancel, custom categories, active-currency event picker, global visibility and persistence')
} finally {
  await server.close(); await dom.happyDOM.close()
  for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key] }
}
