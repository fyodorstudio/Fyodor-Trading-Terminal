import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), timers = new Map(), requests = []
let sequence = 0, closes = 0
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options = {}) => new Promise(resolve => requests.push({ url, ...options, resolve, answered: false }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const source = { id: 'reuters', name: 'Reuters', url: 'https://example.com/rss', last_success: 1794711600000, error: '' }
const item = (id, title = `Headline ${id}`) => ({ id, source_id: 'reuters', source_name: 'Reuters', publisher: 'Reuters', title,
  summary: 'Available feed summary', url: `https://news.google.com/rss/articles/${id}`, published_at: 1794711480000, first_seen: 1794711600000 })
const pendingRequest = part => requests.findLast(request => !request.answered && !request.signal?.aborted && request.url.includes(part))
const query = request => new URL(request.url, 'http://localhost').searchParams
async function reply(request, body, status = 200) {
  assert.ok(request, 'Expected request')
  request.answered = true
  await React.act(async () => request.resolve({ ok: status < 400, status, json: async () => body }))
}
async function tick() {
  await React.act(async () => { for (const [id, timer] of [...timers]) { assert.equal(timer.ms, 1000); timers.delete(id); timer.fn() } })
}
const control = label => host.querySelector(`[aria-label="${label}"]`)
async function click(label) { await React.act(async () => { const button = control(label); assert.ok(button, label); button.click() }) }
async function change(label, value) {
  await React.act(async () => {
    const input = control(label), proto = input.tagName === 'SELECT' ? dom.HTMLSelectElement.prototype : dom.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
    input.dispatchEvent(new dom.Event('input', { bubbles: true })); input.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
}
try {
  const { NewsFlowPanel } = await server.ssrLoadModule('./src/news-flow/NewsFlowPanel.tsx')
  const { DisplayClockProvider } = await server.ssrLoadModule('./src/appearance/time-display/DisplayClock.tsx')
  const { readNewsSettings } = await server.ssrLoadModule('./src/news-flow/model.ts')
  const onClose = () => closes++
  const render = () => React.act(async () => root.render(React.createElement(DisplayClockProvider, {
    brokerId: null, preference: { mode: 'fixed-offset', utcOffsetMinutes: 420, hour12: true },
  }, React.createElement(NewsFlowPanel, { onClose }))))
  await render()
  assert.equal(requests.length, 2)
  assert.equal(query(pendingRequest('/items')).get('order'), 'newest')
  await reply(pendingRequest('/sources'), { sources: [source] })
  await reply(pendingRequest('/items'), { items: [item('a', '<script>literal headline</script>')], total: 150 })
  assert.equal(host.querySelector('script'), null)
  assert.match(host.textContent, /literal headline/)
  assert.equal(host.querySelector('article a').getAttribute('target'), '_blank')
  assert.match(host.querySelector('time').title, /09:58 AM/)
  const firstRow = host.querySelector('article')
  await tick()
  assert.equal(timers.size, 0, 'No new poll is scheduled until each request finishes')
  const count = requests.length; await tick(); assert.equal(requests.length, count)
  await reply(pendingRequest('/sources'), { sources: [source] })
  await reply(pendingRequest('/items'), { items: [item('a', '<script>literal headline</script>')], total: 150 })
  assert.equal(host.querySelector('article'), firstRow, 'Identical polling reuses rows')
  await tick()
  await reply(pendingRequest('/sources'), { sources: [source] })
  await reply(pendingRequest('/items'), { detail: 'Offline' }, 503)
  assert.equal(host.querySelector('article'), firstRow, 'Failed requests keep the last headlines')
  assert.match(host.querySelector('[role="alert"]').textContent, /Offline/)

  await click('Configure News Flow')
  assert.ok(host.querySelector('[role="dialog"]'))
  await tick()
  const stale = pendingRequest('/items')
  await change('Include keywords', 'Iran, interest rates')
  assert.equal(stale.signal.aborted, true)
  assert.equal(query(pendingRequest('/items')).get('include'), 'Iran, interest rates')
  await change('Keyword matching', 'all')
  await change('Exclude keywords', 'hockey')
  assert.equal(query(pendingRequest('/items')).get('match'), 'all')
  assert.equal(query(pendingRequest('/items')).get('exclude'), 'hockey')
  await reply(stale, { items: [item('stale')], total: 1 })
  assert.doesNotMatch(host.textContent, /Headline stale/)
  await reply(pendingRequest('/items'), { items: [item('filtered')], total: 1 })
  assert.match(host.textContent, /Headline filtered/)
  await React.act(async () => host.querySelector('.news-checkbox input').click())
  assert.equal(query(pendingRequest('/items')).get('source'), '__none__')
  await React.act(async () => host.querySelector('.news-checkbox input').click())
  await click('Add provider')
  await change('Provider name', 'Central bank')
  await change('Provider feed URL', 'https://example.com/bank.xml')
  await React.act(async () => host.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  const add = pendingRequest('/sources')
  assert.equal(add.method, 'POST')
  assert.deepEqual(JSON.parse(add.body), { name: 'Central bank', url: 'https://example.com/bank.xml' })
  await reply(add, { id: 'bank' })
  await reply(pendingRequest('/sources'), { sources: [source, { ...source, id: 'bank', name: 'Central bank', url: 'https://example.com/bank.xml' }] })
  assert.equal(control('Provider name').value, 'Central bank')
  assert.equal(control('Previous provider').disabled, false)
  await click('Previous provider')
  assert.equal(control('Provider name').value, 'Reuters')
  await click('Next provider')
  assert.equal(control('Provider name').value, 'Central bank')
  await React.act(async () => control('Provider name').dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
  assert.equal(host.querySelector('[role="dialog"]'), null)
  assert.equal(closes, 0, 'Escape closes configuration before the panel')

  await click('Filter news by date')
  await change('News publication date', '2026-11-15')
  assert.equal(Number(query(pendingRequest('/items')).get('start')), Date.parse('2026-11-14T17:00:00Z'))
  assert.equal(Number(query(pendingRequest('/items')).get('end')), Date.parse('2026-11-15T17:00:00Z'))
  await change('News sort order', 'oldest')
  assert.equal(query(pendingRequest('/items')).get('order'), 'oldest')
  await reply(pendingRequest('/items'), { items: [item('older')], total: 150 })
  await React.act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Next').click())
  assert.equal(query(pendingRequest('/items')).get('offset'), '100')
  await reply(pendingRequest('/items'), { items: [item('page2')], total: 150 })
  await React.act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Previous').click())
  await reply(pendingRequest('/items'), { items: [item('page1')], total: 150 })
  await React.act(async () => { const viewport = host.querySelector('.news-items'); viewport.scrollTop = 100; viewport.dispatchEvent(new dom.Event('scroll')) })
  await tick()
  await reply(pendingRequest('/items'), { items: [item('new')], total: 151 })
  assert.match(host.textContent, /Headline page1/)
  assert.doesNotMatch(host.textContent, /Headline new/)
  await React.act(async () => host.querySelector('.news-new-items').click())
  assert.match(host.textContent, /Headline new/)
  assert.equal(host.querySelector('.news-items').scrollTop, 0)
  const resize = control('Resize News Flow')
  await React.act(async () => resize.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' })))
  assert.equal(readNewsSettings().width, 390)
  assert.equal(readNewsSettings().include, 'Iran, interest rates')
  let captured = false
  resize.parentElement.getBoundingClientRect = () => ({ width: 320 })
  resize.setPointerCapture = () => { captured = true }
  resize.hasPointerCapture = () => captured
  resize.releasePointerCapture = () => { captured = false }
  await React.act(async () => resize.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 500 })))
  await React.act(async () => resize.dispatchEvent(new dom.PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 470 })))
  assert.equal(readNewsSettings().width, 350, 'Dragging starts from actual width when the viewport clamps the preferred width')
  await React.act(async () => resize.dispatchEvent(new dom.PointerEvent('pointerup', { bubbles: true, pointerId: 1 })))
  assert.equal(captured, false)
  await click('Refresh news')
  assert.equal(pendingRequest('/refresh').method, 'POST')
  await reply(pendingRequest('/refresh'), { scheduled: true }, 202)
  await click('Close News Flow'); assert.equal(closes, 1)
  await tick()
  const outstanding = pendingRequest('/items')
  await React.act(async () => root.render(null))
  assert.equal(outstanding.signal.aborted, true)
  assert.equal(timers.size, 0)
  console.log('✓ News Flow: one-second sequential polling, stale cancellation, persistence, provider navigation/setup, keyword/date/sort queries, history pagination, scroll preservation and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
