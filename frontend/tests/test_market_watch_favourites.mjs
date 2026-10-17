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
    transform(code, id) { if (id.endsWith('/MarketWatchPanel.tsx')) return code.replace('const positive = quote.dailyChange >= 0',
      'globalThis.__marketWatchProbe.rows++; const positive = quote.dailyChange >= 0') } }] })
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
const tab = label => [...host.querySelectorAll('[role="tab"]')].find(node => node.querySelector('span').textContent === label)
const props = node => node[Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactProps$'))]
const click = async node => { assert.ok(node); await React.act(async () => node.click()) }
const search = async value => React.act(async () => props(host.querySelector('input')).onChange({ target: { value } }))

try {
  const { MarketWatchPanel } = await server.ssrLoadModule('./src/market-data/market-watch/MarketWatchPanel.tsx')
  const { readMarketWatchPreferences } = await server.ssrLoadModule('./src/market-data/market-watch/market-watch-preferences.ts')
  const render = (overrides = {}, key = 'initial') => React.act(async () => root.render(React.createElement(MarketWatchPanel, {
    symbols: quotes, selectedSymbol: 'EURUSD', status: 'live', error: null, onSelect, ...overrides, key,
  })))
  await render()
  assert.deepEqual(saved(), { favourites: ['NZDCHF', 'EURUSD', 'EURAUD'], category: 'all' }, 'The requested shortlist is saved on first mount')
  assert.equal(tab('★ Favourites').querySelector('small').textContent, '3')
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
  await click(tab('★ Favourites'))
  assert.deepEqual(symbols(), ['NZDCHF', 'EURUSD', 'EURAUD', 'GBPUSD'])
  await search('swiss')
  assert.deepEqual(symbols(), ['NZDCHF'], 'Search matches descriptions within favourites')
  assert.equal(tab('★ Favourites').querySelector('small').textContent, '4', 'Search does not change the shortlist count')
  await search('XAU')
  assert.equal(symbols().length, 0, 'Search does not admit unstarred instruments')
  await search('')
  await render({ visible: false })
  assert.equal(host.childElementCount, 0)
  const hiddenRows = globals.__marketWatchProbe.rows
  await render({ visible: false, symbols: [...quotes] })
  assert.equal(globals.__marketWatchProbe.rows, hiddenRows, 'Collapsed Market Watch performs no row rendering')
  await render()
  assert.equal(tab('★ Favourites').getAttribute('aria-selected'), 'true')
  await render({}, 'reload')
  assert.equal(tab('★ Favourites').getAttribute('aria-selected'), 'true', 'The selected view survives remount')
  for (const symbol of [...symbols()]) await click(star(symbol))
  assert.deepEqual(saved().favourites, [])
  assert.equal(tab('★ Favourites').querySelector('small').textContent, '0')
  assert.equal(host.querySelector('.market-watch-empty').textContent.trim(), 'Star an instrument to add it here.')
  await render({}, 'empty-reload')
  assert.deepEqual(saved().favourites, [], 'An intentionally empty shortlist never restores the initial favourites')
  await click(tab('All'))
  await click(tab('Metals'))
  assert.deepEqual(symbols(), ['XAUUSD'], 'Existing category filtering remains available')
  await click(tab('All'))
  await click(star('EURUSD.a'))
  await click(tab('★ Favourites'))
  assert.deepEqual(symbols(), ['EURUSD.a'])
  const updated = quotes.map(quote => quote.symbol === 'EURUSD.a' ? { ...quote, bid: 1.23456 } : quote)
  await render({ symbols: updated })
  assert.ok(row('EURUSD.a').textContent.includes('1.23456'), 'Favourite rows receive live quote corrections')
  const storedBeforeOutage = dom.localStorage.getItem(storageKey)
  await render({ symbols: [], status: 'waiting', error: 'Disconnected' })
  assert.equal(tab('★ Favourites').querySelector('small').textContent, '0')
  assert.ok(host.textContent.includes('unavailable from the current feed'))
  assert.equal(dom.localStorage.getItem(storageKey), storedBeforeOutage, 'An unavailable instrument is never removed from saved favourites')
  await render({ symbols: updated })
  assert.deepEqual(symbols(), ['EURUSD.a'], 'A returning instrument regains its favourite status')
  const unchangedRows = globals.__marketWatchProbe.rows
  await render({ symbols: [...updated] })
  assert.equal(globals.__marketWatchProbe.rows, unchangedRows, 'Unchanged quote identities do not rerender rows')

  dom.localStorage.setItem(storageKey, '{broken')
  assert.deepEqual(readMarketWatchPreferences().favourites, ['NZDCHF', 'EURUSD', 'EURAUD'])
  dom.localStorage.setItem(storageKey, JSON.stringify({ favourites: ['EURUSD.a', 'EURUSD.a', null, 42, ''], category: 'invalid' }))
  assert.deepEqual(readMarketWatchPreferences(), { favourites: ['EURUSD.a'], category: 'all' }, 'Malformed preferences are validated without merging exact symbols')
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
  console.log('✓ Market Watch favourites: requested initial stars, independent buttons, search/categories, persistence/empty lists, broker symbols, outage/quotes and bounded row work')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
