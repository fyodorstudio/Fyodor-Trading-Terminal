import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), timers = new Map(), requests = []
let sequence = 0, closes = 0, audioStarts = 0, now = Date.parse('2026-11-15T03:00:00Z')
const originalNow = Date.now
Date.now = () => now
class AudioContext {
  state = 'running'; currentTime = 0; destination = {}
  async resume() { this.state = 'running' }
  createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() { audioStarts++ }, stop() {} } }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
}
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, AudioContext, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options = {}) => new Promise(resolve => requests.push({ url, ...options, resolve, answered: false }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const source = { id: 'reuters', name: 'Reuters', url: 'https://news.google.com/rss/search?q=when:24h+site:reuters.com', last_success: 1794711600000, error: '' }
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
const control = label => document.querySelector(`[aria-label="${label}"]`)
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
  dom.localStorage.setItem('fyodor.news-flow.v1', JSON.stringify({ include: 'Iran', exclude: 'India', match: 'all' }))
  assert.equal(readNewsSettings().mode, 'filtered', 'Existing keyword settings stay active after migration')
  dom.localStorage.removeItem('fyodor.news-flow.v1')
  const onClose = () => closes++
  const render = () => React.act(async () => root.render(React.createElement(DisplayClockProvider, {
    brokerId: null, preference: { mode: 'fixed-offset', utcOffsetMinutes: 420, hour12: true },
  }, React.createElement(NewsFlowPanel, { onClose }))))
  await render()
  assert.equal(requests.length, 2)
  assert.equal(query(pendingRequest('/items')).get('order'), 'newest')
  assert.equal(control('Filter news by keywords').textContent, 'All')
  assert.equal(control('Filter news by keywords').nextElementSibling, control('Filter news by date'))
  await reply(pendingRequest('/sources'), { sources: [source] })
  await reply(pendingRequest('/items'), { items: [item('a', '<script>literal headline</script>')], total: 150 })
  assert.equal(host.querySelector('script'), null)
  assert.match(host.textContent, /literal headline/)
  assert.equal(host.querySelector('article a').getAttribute('target'), '_blank')
  assert.match(host.querySelector('time').title, /09:58 AM/)
  assert.doesNotMatch(host.textContent, /Available feed summary/, 'Rows remain simple headline links')
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

  control('Configure News Flow').focus()
  await click('Configure News Flow')
  const modal = document.querySelector('[role="dialog"]')
  assert.equal(modal.getAttribute('aria-modal'), 'true')
  assert.equal(host.hasAttribute('inert'), true, 'Background is inert while the modal is open')
  assert.equal(host.contains(modal), false, 'Modal is portaled outside the narrow panel')
  assert.equal(document.getElementById('news-browse-tab').getAttribute('aria-selected'), 'true')
  assert.equal(query(pendingRequest('/items')).get('source'), 'reuters')
  await reply(pendingRequest('/items'), { items: [item('provider-only')], total: 1 })
  await change('Provider publication date', '2026-08-19')
  assert.equal(readNewsSettings().date, '', 'Provider date browsing does not change the combined panel date')
  assert.deepEqual(JSON.parse(pendingRequest('/history').body).source, ['reuters'])
  await reply(pendingRequest('/history'), { searched: 1, cached: 0, found: 0, unsupported: [], errors: [] })
  await reply(pendingRequest('/items'), { items: [], total: 0 })
  assert.match(modal.textContent, /No headlines found for this date/)
  await React.act(async () => document.getElementById('news-settings-tab').click())
  assert.equal(control('Keyword matching'), null, 'There is no any/all matching control')
  const modalClose = control('Close news configuration')
  modalClose.focus()
  assert.equal(document.activeElement === modalClose, true)
  let backgroundKeys = 0
  const backgroundShortcut = () => backgroundKeys++
  dom.addEventListener('keydown', backgroundShortcut)
  await React.act(async () => modalClose.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Delete' })))
  dom.removeEventListener('keydown', backgroundShortcut)
  assert.equal(backgroundKeys, 0, 'Modal keystrokes do not reach global chart shortcuts')
  await React.act(async () => modalClose.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true })))
  assert.equal(document.activeElement === control('Preview news sound'), true, 'Shift+Tab wraps inside the modal')
  await React.act(async () => control('Preview news sound').dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Tab' })))
  assert.equal(document.activeElement === modalClose, true)
  control('Filter news by date').focus()
  assert.equal(document.activeElement, modalClose, 'Focus cannot escape to the underlying panel')
  await tick()
  const unfiltered = pendingRequest('/items'), beforeRules = requests.length
  await change('Include keywords', 'Iran, interest rates')
  await change('Exclude keywords', 'India')
  assert.equal(requests.length, beforeRules, 'All mode lets users configure keywords without applying them')
  assert.equal(unfiltered.signal.aborted, false)
  assert.equal(control('Enable news sound').checked, false)
  await click('Enable news sound')
  await change('News alert sound', 'bell')
  await click('Preview news sound')
  assert.equal(audioStarts, 1)
  assert.equal(readNewsSettings().soundEnabled, true)
  assert.equal(readNewsSettings().sound, 'bell')
  await React.act(async () => document.querySelector('.news-checkbox input').click())
  assert.equal(query(pendingRequest('/items')).get('source'), '__none__')
  await React.act(async () => document.querySelector('.news-checkbox input').click())
  await click('Add provider')
  await change('Provider name', 'Central bank')
  await change('Provider feed URL', 'https://example.com/bank.xml')
  await React.act(async () => modal.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
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
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.equal(host.hasAttribute('inert'), false)
  assert.equal(document.activeElement, control('Configure News Flow'))
  assert.equal(closes, 0, 'Escape closes configuration before the panel')

  const stale = pendingRequest('/items')
  await click('Filter news by keywords')
  assert.equal(control('Filter news by keywords').textContent, 'Filtered')
  assert.equal(stale.signal.aborted, true)
  assert.equal(query(pendingRequest('/items')).get('include'), 'Iran, interest rates')
  assert.equal(query(pendingRequest('/items')).get('exclude'), 'India')
  assert.equal(query(pendingRequest('/items')).has('match'), false)
  await reply(stale, { items: [item('stale')], total: 1 })
  assert.doesNotMatch(host.textContent, /Headline stale/)
  await reply(pendingRequest('/items'), { items: [item('filtered')], total: 1 })
  assert.match(host.textContent, /Headline filtered/)
  await click('Filter news by keywords')
  assert.equal(query(pendingRequest('/items')).get('include'), '')
  assert.equal(query(pendingRequest('/items')).get('exclude'), '')
  assert.equal(readNewsSettings().exclude, 'India', 'All mode preserves the configured exclusions')
  await click('Filter news by keywords')
  await click('Configure News Flow')
  await React.act(async () => document.getElementById('news-settings-tab').click())
  await change('Include keywords', '')
  assert.equal(query(pendingRequest('/items')).get('include'), '')
  assert.equal(query(pendingRequest('/items')).get('exclude'), 'India', 'Exclusion-only filtering is supported')
  await change('Include keywords', 'Iran, interest rates')
  await click('Close news configuration')

  await click('Filter news by date')
  await change('News publication date', '2026-08-19')
  assert.equal(Number(query(pendingRequest('/items')).get('start')), Date.parse('2026-08-18T17:00:00Z'))
  assert.equal(Number(query(pendingRequest('/items')).get('end')), Date.parse('2026-08-19T17:00:00Z'))
  const firstHistory = pendingRequest('/history')
  assert.deepEqual(JSON.parse(firstHistory.body).source, ['reuters', 'bank'])
  assert.match(host.textContent, /Searching historical headlines/)
  await change('News publication date', '2026-08-18')
  assert.equal(firstHistory.signal.aborted, true, 'Date changes cancel obsolete search responses')
  const otherHistory = pendingRequest('/history')
  await change('News publication date', '2026-08-19')
  assert.equal(otherHistory.signal.aborted, true)
  await reply(firstHistory, { detail: 'Stale historical error' }, 503)
  assert.doesNotMatch(host.textContent, /Stale historical error/)
  const currentHistory = pendingRequest('/history'), historyRequests = requests.filter(request => request.url.endsWith('/history')).length
  await change('News sort order', 'oldest')
  assert.equal(pendingRequest('/history'), currentHistory, 'Sorting does not repeat the historical search')
  await tick()
  await reply(pendingRequest('/sources'), { sources: [{ ...source, last_success: source.last_success + 1000 }, { ...source, id: 'bank', name: 'Central bank', url: 'https://example.com/bank.xml' }] })
  assert.equal(requests.filter(request => request.url.endsWith('/history')).length, historyRequests, 'Live source timestamps do not trigger historical requests')
  await reply(currentHistory, { searched: 1, cached: 0, found: 1, unsupported: ['Central bank'], errors: [] })
  assert.match(host.textContent, /Historical results may be incomplete/)
  assert.match(host.textContent, /Historical lookup unavailable; cached headlines only: Central bank/)
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
  const historicalRefresh = pendingRequest('/history')
  assert.equal(JSON.parse(historicalRefresh.body).force, true, 'Manual refresh can retry a historical search')
  await click('Close News Flow'); assert.equal(closes, 1)
  await tick()
  const outstanding = pendingRequest('/items')
  await React.act(async () => root.render(null))
  assert.equal(outstanding.signal.aborted, true)
  assert.equal(historicalRefresh.signal.aborted, true)
  assert.equal(timers.size, 0)

  const { heatmapNewsSelection } = await server.ssrLoadModule('./src/news-flow/date-range.ts')
  const { selectNewsDate, useNewsSettings } = await server.ssrLoadModule('./src/news-flow/settings.ts')
  const brokerDate = heatmapNewsSelection('2026-11-09', { brokerId: 'Pepperstone-Demo', brokerOffsetSeconds: 0 })
  assert.equal(brokerDate.start, Date.parse('2026-11-08T22:00:00Z'))
  assert.equal(brokerDate.end, Date.parse('2026-11-09T22:00:00Z'))
  const dstDate = heatmapNewsSelection('2026-03-29', { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 0 })
  assert.equal(dstDate.end - dstDate.start, 23 * 3600_000, 'Broker session bounds handle DST transitions')
  assert.equal(heatmapNewsSelection('2026-11-09', { brokerId: 'unknown', brokerOffsetSeconds: 0 }), null)
  selectNewsDate(brokerDate)
  await render()
  assert.equal(control('News publication date').value, '2026-11-09')
  assert.equal(Number(query(pendingRequest('/items')).get('start')), brokerDate.start)
  assert.equal(Number(query(pendingRequest('/items')).get('end')), brokerDate.end)
  assert.match(host.textContent, /Heatmap broker session/)
  await click('Filter news by date')
  await change('News publication date', '2026-11-10')
  assert.equal(readNewsSettings().session, null, 'A manual date selection returns to the display timezone')
  await React.act(async () => root.render(null))

  const { NewsSoundAlerts } = await server.ssrLoadModule('./src/news-flow/NewsSoundAlerts.tsx')
  function SoundHarness() {
    const [settings, changeSettings] = useNewsSettings()
    return React.createElement(React.Fragment, null, React.createElement(NewsSoundAlerts), React.createElement('button', {
      'aria-label': 'Toggle test sound', onClick: () => changeSettings({ ...settings, soundEnabled: !settings.soundEnabled }),
    }))
  }
  const soundBaseline = audioStarts
  await React.act(async () => root.render(React.createElement(SoundHarness)))
  const arrival = () => pendingRequest('/arrivals')
  assert.equal(query(arrival()).has('after'), false)
  assert.equal(query(arrival()).get('include'), 'Iran, interest rates')
  await reply(arrival(), { cursor: 10, items: [item('seed')] })
  assert.equal(audioStarts, soundBaseline, 'Initial snapshot is silent')
  await tick()
  assert.equal(query(arrival()).get('after'), '10')
  now += 1000
  await reply(arrival(), { cursor: 12, items: [{ ...item('fresh-1'), published_at: now }, { ...item('fresh-2'), published_at: now }] })
  assert.equal(audioStarts, soundBaseline + 1, 'One bell for a matching batch, with News Flow closed')
  await tick()
  await reply(arrival(), { cursor: 12, items: [] })
  assert.equal(audioStarts, soundBaseline + 1, 'No repeated sound for an unchanged cursor')
  await tick()
  await reply(arrival(), { cursor: 13, items: [{ ...item('before-open'), published_at: now - 10000 }] })
  assert.equal(audioStarts, soundBaseline + 1, 'Headlines published before enabling alerts remain silent')
  await tick()
  const disabledRequest = arrival()
  await click('Toggle test sound')
  assert.equal(disabledRequest.signal.aborted, true)
  assert.equal(timers.size, 0)
  await reply(disabledRequest, { cursor: 14, items: [{ ...item('stale-alert'), published_at: now }] })
  assert.equal(audioStarts, soundBaseline + 1, 'Disabling sound prevents late responses from ringing')
  await React.act(async () => root.render(null))
  console.log('✓ News Flow: provider/date browsing, independent filters, modal focus, keyword sounds and silent baselines, broker/DST date jumps, history cancellation, paging, resize and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
  Date.now = originalNow
}
