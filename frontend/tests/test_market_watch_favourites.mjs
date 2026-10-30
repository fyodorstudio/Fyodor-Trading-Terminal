import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true, __marketWatchProbe: { rows: 0 } }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'market-watch-probe', enforce: 'pre',
    transform(code, id) { if (id.endsWith('/MarketWatchPanel.tsx')) return code.replace('const positive = quote.dailyChange != null',
      'globalThis.__marketWatchProbe.rows++; const positive = quote.dailyChange != null') } }] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.appendChild(host)
const root = createRoot(host), selections = []
const onSelect = symbol => selections.push(symbol)
const names = ['NZDCHF', 'EURUSD', 'EURAUD', 'GBPUSD', 'EURUSD.a', 'XAUUSD', 'ETHUSD']
const quotes = names.map(symbol => ({ symbol, description: symbol === 'NZDCHF' ? 'New Zealand Swiss franc' : symbol,
  bid: 1.1, ask: 1.2, dailyChange: 0.1, precision: 5 }))
const storageKey = 'fyodor.market-watch.v1'
const saved = () => JSON.parse(dom.localStorage.getItem(storageKey))
const row = symbol => [...host.querySelectorAll('.market-watch-row')].find(node => node.querySelector('strong').textContent === symbol)
const star = symbol => row(symbol)?.parentElement.querySelector('.market-watch-favourite')
const symbols = () => [...host.querySelectorAll('.market-watch-row strong')].map(node => node.textContent)
const categorySelect = () => host.querySelector('select[aria-label="Symbol category filter"]')
const option = value => [...categorySelect().options].find(node => node.value === value)
const props = node => node[Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactProps$'))]
const click = async node => { assert.ok(node); await React.act(async () => node.click()) }
const category = async value => React.act(async () => {
  categorySelect().value = value
  categorySelect().dispatchEvent(new dom.Event('change', { bubbles: true }))
})
const search = async value => React.act(async () => props(host.querySelector('input')).onChange({ target: { value } }))

try {
  const { MarketWatchPanel } = await server.ssrLoadModule('./src/market-data/market-watch/MarketWatchPanel.tsx')
  const { readMarketWatchPreferences } = await server.ssrLoadModule('./src/market-data/market-watch/market-watch-preferences.ts')
  const render = (overrides = {}, key = 'initial') => React.act(async () => root.render(React.createElement(MarketWatchPanel, {
    symbols: quotes, selectedSymbol: 'EURUSD', status: 'live', error: null, onSelect, ...overrides, key,
  })))
  await render()
  assert.deepEqual(saved(), { favourites: ['NZDCHF', 'EURUSD', 'EURAUD'], category: 'all', sort: 'saved',
    sections: [{ id: 'default', name: 'Favourites', symbols: ['NZDCHF', 'EURUSD', 'EURAUD'] }] }, 'The requested shortlist is saved on first mount')
  assert.equal(option('favourites').textContent, '★ Favourites (3)')
  assert.equal(star('EURUSD').getAttribute('aria-pressed'), 'true')
  assert.equal(star('EURUSD.a').getAttribute('aria-pressed'), 'false', 'Broker suffixes retain separate symbol identities')
  assert.equal(star('GBPUSD').parentElement, row('GBPUSD').parentElement, 'Star and chart buttons are siblings, never nested')
  assert.equal(star('GBPUSD').querySelector('button'), null)
  const firstRow = row('NZDCHF'), before = globals.__marketWatchProbe.rows
  await click(star('GBPUSD'))
  assert.equal(globals.__marketWatchProbe.rows - before, 1, 'Starring rerenders only the affected row')
  assert.deepEqual(symbols(), names, 'Starring keeps the existing feed order')
  assert.equal(row('NZDCHF'), firstRow, 'Unchanged rows retain their DOM identity')
  assert.deepEqual(selections, [], 'Starring does not select a chart')
  assert.equal(star('GBPUSD').getAttribute('aria-label'), 'Remove GBPUSD from favourites')
  await click(row('GBPUSD'))
  assert.deepEqual(selections, ['GBPUSD'], 'The separate chart button still selects its symbol')
  await category('favourites')
  assert.deepEqual(symbols(), ['NZDCHF', 'EURUSD', 'EURAUD', 'GBPUSD'])
  await search('swiss')
  assert.deepEqual(symbols(), ['NZDCHF'], 'Search matches descriptions within favourites')
  assert.equal(option('favourites').textContent, '★ Favourites (4)', 'Search does not change the shortlist count')
  await search('XAU')
  assert.equal(symbols().length, 0, 'Search does not admit unstarred instruments')
  await search('')
  await render({ visible: false })
  assert.equal(host.childElementCount, 0)
  const hiddenRows = globals.__marketWatchProbe.rows
  await render({ visible: false, symbols: [...quotes] })
  assert.equal(globals.__marketWatchProbe.rows, hiddenRows, 'Collapsed Market Watch performs no row rendering')
  await render()
  assert.equal(categorySelect().value, 'favourites')
  await render({}, 'reload')
  assert.equal(categorySelect().value, 'favourites', 'The selected view survives remount')
  for (const symbol of [...symbols()]) await click(star(symbol))
  assert.deepEqual(saved().favourites, [])
  assert.equal(option('favourites').textContent, '★ Favourites (0)')
  assert.equal(host.querySelector('.market-watch-empty').textContent.trim(), 'Star an instrument to add it here.')
  await render({}, 'empty-reload')
  assert.deepEqual(saved().favourites, [], 'An intentionally empty shortlist never restores the initial favourites')
  await category('all')
  await category('metals')
  assert.deepEqual(symbols(), ['XAUUSD'], 'Existing category filtering remains available')
  await category('all')
  await click(star('EURUSD.a'))
  await category('favourites')
  assert.deepEqual(symbols(), ['EURUSD.a'])
  const updated = quotes.map(quote => quote.symbol === 'EURUSD.a' ? { ...quote, bid: 1.23456, dailyChange: 1.23 } : quote)
  await render({ symbols: updated })
  assert.ok(row('EURUSD.a').textContent.includes('+1.23%'), 'Favourite rows receive live daily-change corrections')
  assert.ok(!row('EURUSD.a').textContent.includes('1.23456'), 'Raw Bid/Ask are omitted')
  const storedBeforeOutage = dom.localStorage.getItem(storageKey)
  await render({ symbols: [], status: 'waiting', error: 'Disconnected' })
  assert.equal(option('favourites').textContent, '★ Favourites (0)')
  assert.ok(host.textContent.includes('unavailable from the current feed'))
  assert.equal(dom.localStorage.getItem(storageKey), storedBeforeOutage, 'An unavailable instrument is never removed from saved favourites')
  await render({ symbols: updated })
  assert.deepEqual(symbols(), ['EURUSD.a'], 'A returning instrument regains its favourite status')
  const unchangedRows = globals.__marketWatchProbe.rows
  await render({ symbols: [...updated] })
  assert.equal(globals.__marketWatchProbe.rows, unchangedRows, 'Unchanged quote identities do not rerender rows')

  // Migrate an existing flat shortlist, then organize it through the mounted UI.
  dom.localStorage.setItem(storageKey, JSON.stringify({ favourites: ['NZDCHF', 'EURUSD', 'EURAUD'], category: 'favourites' }))
  await render({}, 'legacy-sections')
  assert.deepEqual(symbols(), ['NZDCHF', 'EURUSD', 'EURAUD'])
  assert.equal(saved().sections[0].name, 'Favourites')
  const button = label => [...host.querySelectorAll('button')].find(node => node.textContent === label)
  await click(button('Edit sections'))
  await React.act(async () => props(host.querySelector('[aria-label="New favourite section name"]')).onChange({ target: { value: 'FX crosses' } }))
  await React.act(async () => host.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  const sectionId = saved().sections[1].id
  const move = async (symbol, section) => React.act(async () => {
    const select = host.querySelector(`[aria-label="Move ${symbol} to section"]`)
    select.value = section; select.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await move('EURAUD', sectionId)
  await move('NZDCHF', sectionId)
  assert.deepEqual(saved().sections[1].symbols, ['EURAUD', 'NZDCHF'])
  const selectionCount = selections.length
  const drag = new dom.DataTransfer()
  const dragEvent = type => {
    const event = new dom.DragEvent(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: drag })
    return event
  }
  await React.act(async () => {
    host.querySelector('[aria-label="Reorder NZDCHF"]').dispatchEvent(dragEvent('dragstart'))
    host.querySelector('[aria-label="Reorder EURAUD"]').parentElement.dispatchEvent(dragEvent('drop'))
  })
  assert.deepEqual(saved().sections[1].symbols, ['NZDCHF', 'EURAUD'], 'Dragging reorders symbols within a section')
  await React.act(async () => host.querySelector('[aria-label="Reorder NZDCHF"]').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
  assert.deepEqual(saved().sections[1].symbols, ['EURAUD', 'NZDCHF'], 'Drag handles also support keyboard reordering')
  await React.act(async () => {
    host.querySelector('[aria-label="Reorder EURUSD"]').dispatchEvent(dragEvent('dragstart'))
    host.querySelector('[role="group"][aria-label="FX crosses"]').dispatchEvent(dragEvent('drop'))
  })
  assert.deepEqual(saved().sections[1].symbols, ['EURAUD', 'NZDCHF', 'EURUSD'], 'Dropping on a section appends the symbol')
  assert.equal(selections.length, selectionCount, 'Organizing never selects a chart')
  const rename = host.querySelector('[aria-label="Rename FX crosses section"]')
  await React.act(async () => props(rename).onBlur({ target: { value: 'My FX' } }))
  assert.equal(saved().sections[1].name, 'My FX')
  const organization = saved().sections
  await search('EUR')
  assert.deepEqual(symbols(), ['EURAUD', 'EURUSD'], 'Search preserves the saved section ordering')
  assert.deepEqual(saved().sections, organization, 'Searching does not discard hidden favourites')
  await search('')
  await render({ symbols: quotes.filter(quote => quote.symbol !== 'NZDCHF') })
  assert.deepEqual(saved().sections, organization, 'A missing broker symbol retains its section and position')
  await render({}, 'section-reload')
  assert.deepEqual(saved().sections, organization)
  assert.deepEqual(symbols(), ['EURAUD', 'NZDCHF', 'EURUSD'], 'Section order survives remount and feed recovery')
  await click(button('Edit sections'))
  await click(host.querySelector('[aria-label="Delete My FX section"]'))
  assert.deepEqual(saved().sections, [{ id: 'default', name: 'Favourites', symbols: ['EURAUD', 'NZDCHF', 'EURUSD'] }], 'Deleting a section keeps its favourites')

  dom.localStorage.setItem(storageKey, '{broken')
  assert.deepEqual(readMarketWatchPreferences().favourites, ['NZDCHF', 'EURUSD', 'EURAUD'])
  dom.localStorage.setItem(storageKey, JSON.stringify({ favourites: ['EURUSD.a', 'EURUSD.a', null, 42, ''], category: 'invalid' }))
  assert.deepEqual(readMarketWatchPreferences(), { favourites: ['EURUSD.a'], category: 'all', sort: 'saved',
    sections: [{ id: 'default', name: 'Favourites', symbols: ['EURUSD.a'] }] }, 'Malformed preferences are validated without merging exact symbols')
  const storageDescriptor = Object.getOwnPropertyDescriptor(dom, 'localStorage')
  try {
    Object.defineProperty(dom, 'localStorage', { configurable: true, value: { getItem() { throw new Error('Unavailable') }, setItem() { throw new Error('Unavailable') } } })
    await render({}, 'unavailable-storage')
    await click(star('GBPUSD'))
    assert.equal(star('GBPUSD').getAttribute('aria-pressed'), 'true', 'Favourites remain usable when storage fails')
  } finally {
    if (storageDescriptor) Object.defineProperty(dom, 'localStorage', storageDescriptor)
    else delete dom.localStorage
  }
  const { getSymbolCategory } = await server.ssrLoadModule('./src/market-data/market-watch/symbol-classification.ts')
  const { default: catalog } = await server.ssrLoadModule('../config/broker-symbol-groups.json')
  for (const symbol of Object.values(catalog.groups).flat()) assert.notEqual(getSymbolCategory(symbol, catalog.server), 'all', symbol)
  const samples = { JPYX: 'currency-indices', EURX: 'currency-indices', USDX: 'currency-indices', JPN225: 'indices', AUS200: 'indices',
    XAUUSD: 'metals', SpotCrude: 'commodities', Coffee: 'softs', 'USDX-F': 'forwards', 'GOLD-PERP': 'perps',
    NZDUSD: 'majors', USDIDR: 'exotics', EURSGD: 'exotics', 'SPY.US': 'etfs', 'GAS.US': 'stocks', XAUTUSD: 'crypto' }
  for (const [symbol, expected] of Object.entries(samples)) assert.equal(getSymbolCategory(symbol, catalog.server), expected, symbol)
  assert.equal(getSymbolCategory('NZDUSD', 'OtherBroker'), 'majors', 'Broker folder overrides cannot leak across connections')
  assert.equal(getSymbolCategory('JPN225.pro'), 'indices', 'New suffixed symbols retain conservative fallback recognition')
  assert.equal(getSymbolCategory('GAS.US'), 'stocks', 'An equity ticker must not be mistaken for natural gas')
  assert.equal(getSymbolCategory('SOL.US'), 'stocks', 'An equity ticker must not be mistaken for crypto')
  await render({ symbols: Object.keys(samples).map(symbol => ({ ...quotes[0], symbol, description: symbol })), brokerId: catalog.server }, 'broker-folders')
  await category('currency-indices')
  assert.deepEqual(symbols(), ['JPYX', 'EURX', 'USDX'])
  assert.equal(option('currency-indices').textContent, 'Currency indices (3)')
  await category('etfs'); assert.deepEqual(symbols(), ['SPY.US'])
  assert.equal(option('ndfs'), undefined)
  assert.equal(option('minors'), undefined)
  await category('exotics'); assert.deepEqual(symbols(), ['USDIDR', 'EURSGD'])
  await category('majors'); assert.deepEqual(symbols(), ['NZDUSD'])
  await render({ symbols: [{ ...quotes[0], symbol: 'NZDUSD' }], brokerId: 'OtherBroker' }, 'broker-folders')
  assert.deepEqual(symbols(), ['NZDUSD'], 'NZDUSD stays in the requested majors navigation')
  await category('majors'); assert.deepEqual(symbols(), ['NZDUSD'])

  // All former Minors except NZDUSD now navigate as crosses; old choices migrate.
  for (const name of ['AUDNZD', 'EURNZD', 'GBPNZD', 'NZDCAD', 'NZDCHF', 'NZDJPY'])
    assert.equal(getSymbolCategory(name, catalog.server), 'crosses')
  for (const [oldCategory, expected] of [['minors', 'crosses'], ['ndfs', 'exotics']]) {
    dom.localStorage.setItem(storageKey, JSON.stringify({ favourites: [], category: oldCategory }))
    assert.equal(readMarketWatchPreferences().category, expected)
  }
  dom.localStorage.setItem(storageKey, JSON.stringify({ favourites: ['NZDCHF', 'EURUSD', 'EURAUD'], category: 'all' }))
  const ranked = quotes.map((quote, i) => ({ ...quote, dailyChange: [0.2, -1.5, 1.1, 0.9, null, 0, 0.9][i] }))
  await render({ symbols: ranked }, 'sort-menu')
  const chooseSort = async label => {
    await click(host.querySelector('[aria-label="Sort symbols"]'))
    assert.ok(!host.querySelector('[aria-label="Symbol sorting"]').textContent.includes('Alphabetical'))
    await click([...host.querySelectorAll('[aria-label="Symbol sorting"] button')].find(button => button.textContent === label))
  }
  await chooseSort('Daily change: highest first')
  assert.deepEqual(symbols(), ['EURAUD', 'GBPUSD', 'ETHUSD', 'NZDCHF', 'XAUUSD', 'EURUSD', 'EURUSD.a'])
  assert.ok(host.querySelector('.market-watch-columns').textContent.includes('↓'))
  await chooseSort('Daily change: lowest first')
  assert.deepEqual(symbols(), ['EURUSD', 'XAUUSD', 'NZDCHF', 'GBPUSD', 'ETHUSD', 'EURAUD', 'EURUSD.a'])
  await chooseSort('Biggest move: either direction')
  assert.equal(symbols()[0], 'EURUSD')
  await category('favourites')
  const savedSections = saved().sections
  assert.deepEqual(symbols(), ['EURUSD', 'EURAUD', 'NZDCHF'])
  assert.ok(host.querySelector('[aria-label="Reorder EURUSD"]').disabled)
  await chooseSort('Saved order')
  assert.deepEqual(symbols(), ['NZDCHF', 'EURUSD', 'EURAUD'])
  assert.deepEqual(saved().sections, savedSections, 'Sorting never overwrites manual section ordering')
  await chooseSort('Daily change: highest first')
  await render({ symbols: ranked }, 'sort-reload')
  assert.equal(saved().sort, 'highest')
  assert.deepEqual(symbols(), ['EURAUD', 'NZDCHF', 'EURUSD'])
  const changedRank = ranked.map(quote => quote.symbol === 'EURUSD' ? { ...quote, dailyChange: 5 } : quote)
  await render({ symbols: changedRank }, 'sort-reload')
  assert.deepEqual(symbols(), ['EURAUD', 'NZDCHF', 'EURUSD'], 'Live changes update values without moving rows under a click')
  assert.ok(row('EURUSD').textContent.includes('+5.00%'))
  await chooseSort('Daily change: highest first')
  assert.deepEqual(symbols(), ['EURUSD', 'EURAUD', 'NZDCHF'], 'Choosing the same sort again refreshes the ranking')
  dom.localStorage.setItem(storageKey, JSON.stringify({ favourites: ['EURUSD', 'NZDCHF', 'EURAUD'], category: 'favourites', sort: 'highest',
    sections: [{ id: 'default', name: 'First section', symbols: ['EURUSD'] }, { id: 'second', name: 'Second section', symbols: ['NZDCHF', 'EURAUD'] }] }))
  await render({ symbols: ranked }, 'sorted-sections')
  assert.deepEqual(symbols(), ['EURUSD', 'EURAUD', 'NZDCHF'], 'Sorting stays within custom sections, preserving section order')
  assert.deepEqual([...host.querySelectorAll('.market-watch-section-heading strong')].map(node => node.textContent), ['First section', 'Second section'])
  console.log('✓ Market Watch favourites: requested initial stars, independent buttons, search/categories, persistence/empty lists, broker symbols, outage/quotes and bounded row work')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
