import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Production storage -> production frontend validator and mounted panel.
// HTTP/clipboard/canvas surfaces are fixtures; no browser automation or visuals.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.dirname(frontend)
const python = path.join(repo, 'bridge/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const produced = spawnSync(python, ['-c', `
from tempfile import TemporaryDirectory
from pathlib import Path
import json
from datetime import datetime, timedelta, timezone
from storage.currency_news import NewsRefresh, save_refresh, news_snapshot, news_history, news_run
now = datetime.now(timezone.utc)-timedelta(minutes=1)
source = dict(label='Original publisher',url='https://example.com/news')
cad = dict(currency='CAD',checked_at=now.isoformat(),coverage='checked',coverage_note='',
 items=[dict(summary='Fresh Canadian export development.',published_at=(now-timedelta(hours=1)).isoformat(),sources=[source])],
 background=[dict(summary='Older policy guidance.',published_at=None,timing_note='November 2, publication hour unknown.',sources=[source])],
 implication='supportive',reason='Export support is partly offset by softer activity.')
quiet = dict(currency='USD',checked_at=now.isoformat(),coverage='partial',coverage_note='One publisher was inaccessible.',items=[],background=[],
 implication='no_clear_signal',reason='No qualifying fresh story verified through the available routes.')
unavailable = dict(quiet,currency='NZD',coverage='unavailable',coverage_note='Relevant routes unavailable.')
with TemporaryDirectory() as d:
 save_refresh(NewsRefresh(window_hours=3,rows=[cad,quiet,unavailable]),Path(d))
 save_refresh(NewsRefresh(window_hours=3,rows=[dict(cad,currency='JPY',reason='Saved yen interpretation.')]),Path(d))
 day=(datetime.now(timezone.utc)+timedelta(hours=7)).date().isoformat()
 history=news_history(Path(d),day)
 print(json.dumps(dict(latest=news_snapshot(Path(d)),history=history,runs={r['run_id']:news_run(Path(d),r['run_id']) for r in history['runs']})))
`], { cwd: repo, encoding: 'utf8' })
assert.equal(produced.status, 0, produced.stderr)
const bundle = JSON.parse(produced.stdout)
let fixture = bundle.latest
const server = await createServer({ root: frontend, server: { middlewareMode: true, hmr: false }, plugins: [{
  name: 'news-row-work-count', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/CurrencyNewsDock.tsx')) return code.replace('  const s = row.snapshot', '  globalThis.__newsRows++; const s = row.snapshot')
  },
}] })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, localStorage: dom.localStorage,
  HTMLElement: dom.HTMLElement, Node: dom.Node, IS_REACT_ACT_ENVIRONMENT: true, __newsRows: 0 }
const previous = new Map([...Object.keys(globals), 'fetch'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value })
let sequence = 0, copied = '', offline = false, malformed = false, hold = false
const timers = new Map(), intervals = new Map(), requests = [], pending = []
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++sequence, { fn, ms }); return sequence }
dom.clearInterval = id => intervals.delete(id)
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text } } })
function response(url) {
  const route = new URL(url, 'http://localhost')
  let value = fixture
  if (route.pathname === '/storage-api/currency-news/history') {
    const date = route.searchParams.get('date'), before = route.searchParams.get('before')
    value = { schema: 1, date, runs: [], next_before: null }
    if (date === bundle.history.date) value = before ? { ...bundle.history, runs: bundle.history.runs.slice(1) }
      : { ...bundle.history, runs: bundle.history.runs.slice(0, 1), next_before: bundle.history.runs[0].run_id }
  } else if (route.pathname.startsWith('/storage-api/currency-news/history/')) value = bundle.runs[route.pathname.split('/').at(-1)]
  else if (route.searchParams.get('after_revision') === fixture.revision) value = { schema: 1, revision: fixture.revision, unchanged: true }
  return { ok: !offline, status: offline ? 503 : 200, json: async () => malformed ? {} : structuredClone(value) }
}
globalThis.fetch = async (url, options) => {
  requests.push({ url, options })
  return hold ? new Promise(resolve => pending.push({ resolve, url, options })) : response(url)
}
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const button = label => [...container.querySelectorAll('button')].find(b => b.textContent === label)
const click = async label => React.act(async () => { assert.ok(button(label), label); button(label).click() })
const poll = async () => {
  const entry = [...timers].find(([, t]) => t.fn.name === 'pollNews')
  assert.ok(entry, 'Saved-news poll is scheduled'); timers.delete(entry[0])
  await React.act(async () => entry[1].fn())
}
try {
  const { CurrencyNewsDock } = await server.ssrLoadModule('./src/currency-news/CurrencyNewsDock.tsx')
  const { validNewsSnapshot, validNewsHistory, validSavedNews } = await server.ssrLoadModule('./src/currency-news/news-model.ts')
  const { newsMarkdown } = await server.ssrLoadModule('./src/currency-news/news-export.ts')
  assert.equal(validNewsSnapshot(fixture), true, 'Actual Python projection matches the frontend contract')
  assert.equal(validNewsHistory(bundle.history, bundle.history.date), true)
  assert.equal(validNewsHistory(bundle.history, '2020-01-01'), false)
  for (const r of bundle.history.runs) assert.equal(validSavedNews(bundle.runs[r.run_id], r.run_id), true)
  for (const mutate of [
    d => d.rows.pop(), d => d.rows[0] = d.rows[1],
    d => d.rows.find(r => r.currency === 'CAD').snapshot.items[0].sources[0].url = 'javascript:alert(1)',
    d => d.rows.find(r => r.currency === 'CAD').snapshot.items[0].published_at = null,
    d => d.rows.find(r => r.currency === 'CAD').snapshot.checked_at = 'not a clock',
    d => d.rows.find(r => r.currency === 'CAD').snapshot.window_hours = 0,
    d => d.rows.find(r => r.currency === 'USD').snapshot.implication = 'supportive',
    d => d.rows.find(r => r.currency === 'NZD').snapshot.coverage_note = '',
  ]) {
    const bad = structuredClone(fixture); mutate(bad); assert.equal(validNewsSnapshot(bad), false)
  }
  await React.act(async () => root.render(React.createElement(CurrencyNewsDock)))
  assert.equal(container.querySelectorAll('[data-news-currency]').length, 8)
  assert.equal(globalThis.__newsRows, 16, 'Eight pending rows then eight loaded rows')
  assert.equal(container.querySelector('[aria-label="News lookback"]').value, '3')
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent, /Fresh Canadian export development.*Supportive/s)
  assert.match(container.querySelector('[data-news-currency="USD"]').textContent, /No qualifying news verified.*Partial coverage.*inaccessible/s)
  assert.match(container.querySelector('[data-news-currency="NZD"]').textContent, /News coverage unavailable/)
  assert.match(container.querySelector('[data-news-currency="EUR"]').textContent, /Not refreshed yet/)
  assert.match(container.querySelector('.news-background').textContent, /Older background.*November 2, publication hour unknown/s)
  const source = container.querySelector('.news-sources a')
  assert.equal(source.href, 'https://example.com/news'); assert.equal(source.target, '_blank')
  await click('Copy refresh prompt')
  assert.match(copied, /all eight currencies.*last 3 hours/s)
  const beforeFilter = requests.length
  await click('CAD')
  assert.equal(container.querySelectorAll('[data-news-currency]').length, 1)
  assert.equal(requests.length, beforeFilter, 'Currency filtering reads the existing snapshot')
  const select = container.querySelector('[aria-label="News lookback"]')
  await React.act(async () => { select.value = '6'; select.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.match(container.querySelector('.news-checked').textContent, /3-hour window/, 'Changing requested lookback never relabels the saved result')
  await click('Copy refresh prompt')
  assert.match(copied, /refresh CAD.*last 6 hours.*--scope CAD/s)
  await click('All')
  globalThis.__newsRows = 0
  const beforePoll = requests.length
  await poll()
  assert.equal(requests.length, beforePoll + 1)
  assert.equal(globalThis.__newsRows, 0, 'Unchanged polling renders no news rows')
  const cad = fixture.rows.find(r => r.currency === 'CAD').snapshot
  cad.reason = 'Updated mechanism, with explicit opposition.'; cad.run_id = 'b'.repeat(64); fixture.revision = 'b'.repeat(64)
  await poll()
  assert.equal(globalThis.__newsRows, 1, 'One changed currency renders exactly one row')
  assert.match(container.textContent, /Updated mechanism/)
  offline = true
  await poll()
  assert.match(container.querySelector('[role="alert"]').textContent, /HTTP 503.*last loaded/s)
  assert.match(container.textContent, /Updated mechanism/)
  offline = false; malformed = true
  await poll()
  assert.match(container.querySelector('[role="alert"]').textContent, /Invalid currency news response/)
  malformed = false
  await poll()
  assert.equal(container.querySelector('[role="alert"]'), null)
  // Age clocks are local: the parent and memoized rows do no work on a tick.
  const originalNow = Date.now
  Date.now = () => Date.parse(cad.checked_at) + 4 * 3600000
  globalThis.__newsRows = 0
  try { await React.act(async () => { for (const timer of intervals.values()) timer.fn() }) }
  finally { Date.now = originalNow }
  assert.equal(globalThis.__newsRows, 0)
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent, /Aging — refresh on demand/)
  await click('History')
  assert.equal([...timers.values()].filter(t => t.fn.name === 'pollNews').length, 0, 'History stops latest polling')
  assert.equal(intervals.size, 0, 'Historical views do not run aging clocks')
  assert.ok(container.querySelector('[aria-label="News history date selector"]'))
  assert.equal(button('Copy refresh prompt'), undefined, 'Historical dates cannot launch a live refresh')
  assert.equal(container.querySelector('[aria-label="News lookback"]'), null)
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent, /Not researched in this refresh/)
  const beforeMore = requests.length
  await click('Load earlier refreshes')
  assert.equal(requests.length, beforeMore + 1, 'Paging history loads metadata, not every stored body')
  const earlier = bundle.history.runs.find(r => r.currencies.includes('CAD'))
  const refresh = container.querySelector('[aria-label="Saved news refresh"]')
  await React.act(async () => { refresh.value = earlier.run_id; refresh.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent, /Export support is partly offset/)
  assert.ok(!container.textContent.includes('Updated mechanism'), 'A later implication never replaces its frozen earlier version')
  assert.ok(!container.textContent.includes('Aging —'))
  const markdown = newsMarkdown(bundle.runs[earlier.run_id], 'CAD', bundle.history.date)
  assert.match(markdown, /saved history.*## CAD.*Publication lookback: 3 hours.*Export support.*https:\/\/example.com\/news/s)
  assert.match(markdown, /Older background.*November 2, publication hour unknown/s)
  assert.ok(!markdown.includes('## JPY'), 'Export follows the selected currency')
  assert.match(markdown, new RegExp(earlier.run_id), 'Export retains the exact refresh identity')
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
  const originalClick = dom.HTMLAnchorElement.prototype.click
  let exported = null, filename = '', revoked = ''
  URL.createObjectURL = blob => { exported = blob; return 'blob:news-export' }
  URL.revokeObjectURL = value => { revoked = value }
  dom.HTMLAnchorElement.prototype.click = function () { filename = this.download }
  try {
    await click('CAD'); await click('Export Markdown')
    assert.match(filename, /currency-news-cad-\d{4}-\d{2}-\d{2}\.md/)
    assert.equal(await exported.text(), markdown)
    const revoke = [...timers].find(([, t]) => t.ms === 1000)
    timers.delete(revoke[0]); revoke[1].fn(); assert.equal(revoked, 'blob:news-export')
  } finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; dom.HTMLAnchorElement.prototype.click = originalClick }
  await React.act(async () => container.querySelector('[aria-label="Previous date"]').click())
  assert.match(container.textContent, /No saved research for/)
  assert.equal(container.querySelector('[data-news-currency]'), null, 'An empty date never borrows another day')
  assert.equal(button('Export Markdown').disabled, true)
  await click('Today')
  offline = true; await click('Reload saved news')
  assert.match(container.querySelector('[role="alert"]').textContent, /unavailable.*last loaded/s)
  offline = false; await click('Reload saved news')
  assert.equal(container.querySelector('[role="alert"]'), null)
  // A date change aborts stale replies; leaving history also aborts its pending read.
  hold = true
  await React.act(async () => container.querySelector('[aria-label="Previous date"]').click())
  assert.equal(pending.length, 1)
  await click('Today')
  assert.equal(pending[0].options.signal.aborted, true)
  await click('Latest')
  assert.ok(pending.some(p => p.url.startsWith('/storage-api/currency-news/history?') && p.options.signal.aborted))
  hold = false
  await React.act(async () => { for (const p of pending.splice(0)) p.resolve(response(p.url)) })
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent, /Updated mechanism/)
  await click('CAD')
  hold = true
  const pollEntry = [...timers].find(([, t]) => t.fn.name === 'pollNews')
  timers.delete(pollEntry[0])
  await React.act(async () => { void pollEntry[1].fn() })
  assert.equal(pending.length, 1)
  await React.act(async () => root.unmount())
  assert.equal(pending[0].options.signal.aborted, true)
  await React.act(async () => pending[0].resolve(response(pending[0].url)))
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  const again = createRoot(container)
  hold = false
  await React.act(async () => again.render(React.createElement(CurrencyNewsDock)))
  assert.equal(container.querySelector('[data-news-currency]').dataset.newsCurrency, 'CAD', 'Selected currency survives reopen')
  await React.act(async () => again.unmount())
  console.log('✓ Currency News: real storage contract, scoped prompts, gaps/background, stable polls, aging, errors and cleanup')
} finally {
  await server.close(); await dom.happyDOM.close()
  for (const [k, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k]
}
