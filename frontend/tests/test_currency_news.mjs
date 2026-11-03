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
from storage.currency_news import NewsRefresh, save_refresh, news_snapshot
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
 print(json.dumps(news_snapshot(Path(d))))
`], { cwd: repo, encoding: 'utf8' })
assert.equal(produced.status, 0, produced.stderr)
let fixture = JSON.parse(produced.stdout)
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
  return { ok: !offline, status: offline ? 503 : 200, json: async () => malformed ? {} : new URL(url, 'http://localhost').searchParams.get('after_revision') === fixture.revision
    ? { schema: 1, revision: fixture.revision, unchanged: true } : structuredClone(fixture) }
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
  const { validNewsSnapshot } = await server.ssrLoadModule('./src/currency-news/news-model.ts')
  assert.equal(validNewsSnapshot(fixture), true, 'Actual Python projection matches the frontend contract')
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
