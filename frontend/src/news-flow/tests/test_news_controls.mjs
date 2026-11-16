import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), requests = [], copied = []
let denyClipboard = false, hidden = []
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
Object.defineProperty(dom.navigator, 'clipboard', { configurable: true, value: { async writeText(text) {
  if (denyClipboard) throw new Error('Permission denied')
  copied.push(text)
} } })
globalThis.fetch = (url, options = {}) => new Promise(resolve => requests.push({ url, ...options, resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const control = label => document.querySelector(`[aria-label="${label}"]`)
async function click(label) { await React.act(async () => { assert.ok(control(label), label); control(label).click() }) }
async function change(label, value) {
  await React.act(async () => {
    const input = control(label), proto = input.tagName === 'SELECT' ? dom.HTMLSelectElement.prototype : dom.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
    input.dispatchEvent(new dom.Event('input', { bubbles: true })); input.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
}
async function reply(request, body, status = 200) { await React.act(async () => request.resolve({ ok: status < 400, status, json: async () => body })) }
const query = request => new URL(request.url, 'http://localhost').searchParams
const source = (id, name, url) => ({ id, name, url, last_success: null, error: '' })
const sources = [
  source('reuters', 'Reuters', 'https://news.google.com/rss/search?q=when:24h+site:reuters.com'),
  source('reuters-oil', 'Oil desk', 'https://news.google.com/rss/search?q=site:reuters.com+oil'),
  source('reuters-fx', 'FX desk', 'https://news.google.com/rss/search?q=site:www.reuters.com+forex'),
  source('fed-policy', 'Fed policy', 'https://www.federalreserve.gov/feeds/press_monetary.xml'),
  source('fed-speeches', 'Fed speeches', 'https://www.federalreserve.gov/feeds/speeches.xml'),
  source('eia', 'EIA press', 'https://www.eia.gov/rss/press_rss.xml'),
  source('eia-reports', 'Oil reports', 'https://news.google.com/rss/search?q=site:eia.gov+petroleum'),
  source('fxstreet', 'FXStreet', 'https://www.fxstreet.com/rss'),
]
try {
  const { NewsProviderSelector } = await server.ssrLoadModule('./src/news-flow/NewsProviderSelector.tsx')
  const { providerGroups } = await server.ssrLoadModule('./src/news-flow/provider-groups.ts')
  assert.deepEqual(providerGroups(sources).map(group => [group.name, group.sources.length]), [['Reuters', 3], ['Federal Reserve', 2], ['EIA', 2], ['FXStreet', 1]])
  const custom = [source('custom', 'Reuters?', 'https://example.com/rss'),
    source('mixed', 'Mixed search', 'https://news.google.com/rss/search?q=(site:reuters.com+OR+site:eia.gov)'),
    source('unknown', 'Another search', 'https://news.google.com/rss/search?q=oil')]
  assert.equal(providerGroups([...sources, ...custom]).length, 7, 'Unknown/mixed Google feeds and edited URLs do not inherit a false publisher')
  function Providers() {
    const [value, setValue] = React.useState(['orphan', 'reuters-oil'])
    React.useEffect(() => { hidden = value }, [value])
    return React.createElement(NewsProviderSelector, { sources, hidden: value, onChange: setValue })
  }
  await React.act(async () => root.render(React.createElement(Providers)))
  await click('Select news providers')
  assert.equal(control('Show Reuters group').indeterminate, true)
  assert.equal(control('Show Reuters group').getAttribute('aria-checked'), 'mixed')
  assert.equal(control('Show provider Reuters'), null, 'Publisher families start collapsed')
  await React.act(async () => control('Show Reuters group').parentElement.click())
  assert.deepEqual(hidden, ['orphan'], 'A mixed group turns all members on in one operation')
  await click('Show Reuters group')
  assert.deepEqual(hidden, ['orphan', 'reuters', 'reuters-oil', 'reuters-fx'])
  assert.equal(control('Show Federal Reserve group').checked, true, 'Other publishers remain selected')
  await click('Expand Reuters feeds')
  await click('Show provider Oil desk')
  assert.equal(control('Show Reuters group').indeterminate, true)
  assert.equal(control('Show provider Reuters').checked, false)
  assert.equal(control('Show provider Oil desk').checked, true)
  await click('Show Reuters group')
  assert.equal(control('Show provider Reuters').checked, true)
  await React.act(async () => control('Visible news providers').dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
  assert.equal(control('Visible news providers'), null)
  assert.equal(document.activeElement, control('Select news providers'))
  await React.act(async () => root.render(null))

  const { NewsCopy } = await server.ssrLoadModule('./src/news-flow/NewsCopy.tsx')
  const scope = 'source=reuters&source=fed-policy&mode=included&include=oil&exclude=India&search=OPEC&priority=true&organizer=expectations&currency=USD&start=1&end=2&offset=100&limit=100&order=oldest'
  const render = query => React.act(async () => root.render(React.createElement(NewsCopy, { query })))
  await render(scope)
  await click('Copy news headlines')
  assert.equal(control('Copy range amount').value, '1')
  assert.equal(control('Copy range unit').value, 'hours')
  await click('Copy selected news range')
  const first = requests.at(-1), params = query(first)
  assert.equal(params.get('amount'), '1'); assert.equal(params.get('unit'), 'hours')
  assert.deepEqual(params.getAll('source'), ['reuters', 'fed-policy'])
  for (const name of ['start', 'end', 'offset', 'limit', 'order']) assert.equal(params.has(name), false, name)
  for (const [name, value] of [['mode', 'included'], ['include', 'oil'], ['exclude', 'India'], ['search', 'OPEC'], ['priority', 'true'], ['currency', 'USD'], ['organizer', 'expectations']]) assert.equal(params.get(name), value)
  const text = 'Oil & OPEC update\nhttps://example.com/oil\n\nFed remarks\nhttps://example.com/fed'
  await reply(first, { text, count: 2 })
  assert.deepEqual(copied, [text], 'Clipboard contains only headline/link blocks, no labels or metadata')
  assert.match(host.textContent, /Copied 2 headlines and links/)
  await change('Copy range amount', '6')
  await click('Copy selected news range')
  assert.equal(query(requests.at(-1)).get('amount'), '6')
  await reply(requests.at(-1), { text: '', count: 0 })
  assert.equal(copied.length, 1, 'An empty range leaves the clipboard untouched')
  await change('Copy range unit', 'days')
  await change('Copy range amount', '3')
  await click('Copy selected news range')
  assert.equal(query(requests.at(-1)).get('unit'), 'days')
  assert.equal(query(requests.at(-1)).get('amount'), '3')
  denyClipboard = true
  await reply(requests.at(-1), { text, count: 2 })
  assert.match(host.textContent, /Clipboard unavailable/)
  assert.equal(control('Headlines to copy manually').value, text)
  denyClipboard = false
  await change('Copy range amount', '0')
  assert.equal(control('Copy selected news range').disabled, true)
  await change('Copy range amount', '1.5')
  assert.equal(control('Copy selected news range').disabled, true)
  await change('Copy range amount', '1')
  await click('Copy selected news range')
  await reply(requests.at(-1), { detail: 'More than 10,000 headlines match. Choose a shorter range.' }, 413)
  assert.match(host.textContent, /Choose a shorter range/)
  assert.equal(copied.length, 1, 'Failed exports never overwrite the clipboard with partial data')
  await click('Copy selected news range')
  const cancelled = requests.at(-1)
  await React.act(async () => control('Copy headline range').dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
  assert.equal(cancelled.signal.aborted, true)
  assert.equal(document.activeElement, control('Copy news headlines'))
  await reply(cancelled, { text, count: 2 })
  assert.equal(copied.length, 1)
  await click('Copy news headlines')
  await click('Copy selected news range')
  const changed = requests.at(-1)
  await render('source=fxstreet&mode=all')
  assert.equal(changed.signal.aborted, true, 'Changing the copy scope cancels the old result')
  await reply(changed, { text, count: 2 })
  assert.equal(copied.length, 1)
  await click('Copy news headlines')
  await click('Copy selected news range')
  const unmounted = requests.at(-1)
  await React.act(async () => root.render(null))
  assert.equal(unmounted.signal.aborted, true)
  console.log('✓ News controls: publisher groups, mixed/individual toggles, scoped rolling copy, plain text, clipboard denial and request cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
