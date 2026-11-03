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
from storage.currency_news import NewsRefresh, save_refresh, news_snapshot, news_day, news_history, news_run
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
 save_refresh(NewsRefresh(window_hours=3,rows=[dict(cad,checked_at=(now+timedelta(seconds=1)).isoformat(),reason='Latest CAD interpretation.')]),Path(d))
 day=(datetime.now(timezone.utc)+timedelta(hours=7)).date().isoformat()
 history=news_history(Path(d),day)
 print(json.dumps(dict(day=news_day(Path(d),day),history=history,runs={r['run_id']:news_run(Path(d),r['run_id']) for r in history['runs']})))
`], { cwd: repo, encoding: 'utf8' })
assert.equal(produced.status, 0, produced.stderr)
const bundle = JSON.parse(produced.stdout)
let fixture = bundle.day
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
  let value
  if (route.pathname === '/storage-api/currency-news/day') {
    const date = route.searchParams.get('date')
    value = date === fixture.date ? fixture : {schema:1,date,revision:'d'.repeat(64),rows:fixture.rows.map(r=>({currency:r.currency,snapshot:null,refreshes:[]}))}
    if (route.searchParams.get('after_revision') === value.revision) value = {schema:1,date,revision:value.revision,unchanged:true}
  } else value = bundle.runs[route.pathname.split('/').at(-1)]
  return {ok:!offline,status:offline ? 503 : 200,json:async()=>malformed ? {} : structuredClone(value)}
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
  const { validNewsDay, validSavedNews } = await server.ssrLoadModule('./src/currency-news/news-model.ts')
  const { newsMarkdown } = await server.ssrLoadModule('./src/currency-news/news-export.ts')
  assert.equal(validNewsDay(fixture, fixture.date), true, 'Production daily projection matches frontend')
  assert.equal(validNewsDay(fixture, '2020-01-01'), false)
  for (const r of bundle.history.runs) assert.equal(validSavedNews(bundle.runs[r.run_id], r.run_id), true)
  for (const mutate of [d=>d.rows.pop(),d=>d.rows[0]=d.rows[1],
    d=>d.rows.find(r=>r.currency==='CAD').snapshot.items[0].sources[0].url='javascript:alert(1)',
    d=>d.rows.find(r=>r.currency==='CAD').refreshes=[],
    d=>d.rows.find(r=>r.currency==='CAD').refreshes[0].saved_at='2000-01-01T00:00:00Z',
    d=>d.rows.find(r=>r.currency==='USD').snapshot.implication='supportive']) {
    const bad=structuredClone(fixture);mutate(bad);assert.equal(validNewsDay(bad,fixture.date),false)
  }
  // A remembered old history date no longer changes the default: always open Today.
  localStorage.setItem('fyodor.currency-news.date.v1','2020-01-01')
  await React.act(async()=>root.render(React.createElement(CurrencyNewsDock)))
  assert.equal(container.querySelector('[aria-label="News view"]'),null)
  assert.ok(container.querySelector('[aria-label="Currency News date selector"]'))
  assert.equal(container.querySelectorAll('[data-news-currency]').length,8)
  assert.equal(globalThis.__newsRows,16)
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent,/Latest CAD interpretation/)
  assert.match(container.querySelector('[data-news-currency="JPY"]').textContent,/Saved yen interpretation/)
  assert.match(container.querySelector('[data-news-currency="USD"]').textContent,/No qualifying news verified.*Partial coverage/s)
  assert.match(container.querySelector('[data-news-currency="NZD"]').textContent,/coverage unavailable/i)
  assert.match(container.querySelector('[data-news-currency="EUR"]').textContent,/No research saved for this date/)
  await click('Copy refresh prompt');assert.match(copied,/all eight currencies.*last 3 hours/s)
  const beforeFilter=requests.length
  await click('CAD');assert.equal(container.querySelectorAll('[data-news-currency]').length,1)
  await click('All');assert.equal(requests.length,beforeFilter,'Scope filters do no network/research work')
  const lookback=container.querySelector('[aria-label="News lookback"]')
  await React.act(async()=>{lookback.value='6';lookback.dispatchEvent(new dom.Event('change',{bubbles:true}))})
  assert.match(container.querySelector('[data-news-currency="CAD"] .news-checked').parentElement.textContent,/3-hour window/)
  globalThis.__newsRows=0
  await poll();assert.equal(globalThis.__newsRows,0,'Unchanged day poll renders no rows')
  const cad=fixture.rows.find(r=>r.currency==='CAD')
  cad.snapshot.reason='Updated mechanism, with explicit opposition.';cad.snapshot.run_id='b'.repeat(64)
  cad.refreshes.unshift({run_id:cad.snapshot.run_id,saved_at:cad.snapshot.saved_at});fixture.revision='b'.repeat(64)
  await poll();assert.equal(globalThis.__newsRows,1,'A focused update only renders its currency row')
  const earlier=cad.refreshes.at(-1)
  const choose=async id=>React.act(async()=>{const select=container.querySelector('[aria-label="CAD saved refresh"]');select.value=id;select.dispatchEvent(new dom.Event('change',{bubbles:true}))})
  await choose(earlier.run_id)
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent,/Export support is partly offset/)
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent,/Earlier refresh selected/)
  assert.match(container.querySelector('[data-news-currency="JPY"]').textContent,/Saved yen interpretation/)
  const afterEarlier=requests.length
  await click('CAD');await click('All');await choose(cad.refreshes[0].run_id);await choose(earlier.run_id)
  assert.equal(requests.length,afterEarlier,'A cached version and scope changes do not duplicate reads')
  const exportRows=fixture.rows.map(r=>r.currency==='CAD'?{...r,snapshot:bundle.runs[earlier.run_id].rows.find(x=>x.currency==='CAD').snapshot}:r)
  const markdown=newsMarkdown({...fixture,rows:exportRows},'CAD',fixture.date)
  assert.match(markdown,/saved research.*## CAD.*Export support.*https:\/\/example.com\/news/s)
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalClick=dom.HTMLAnchorElement.prototype.click
  let exported,filename='',revoked=''
  URL.createObjectURL=blob=>{exported=blob;return 'blob:news-export'};URL.revokeObjectURL=url=>{revoked=url}
  dom.HTMLAnchorElement.prototype.click=function(){filename=this.download}
  try {
    await click('CAD');await click('Export Markdown')
    assert.equal(await exported.text(),markdown);assert.match(filename,/currency-news-cad-.*\.md/)
    const revoke=[...timers].find(([,t])=>t.ms===1000);timers.delete(revoke[0]);revoke[1].fn();assert.equal(revoked,'blob:news-export')
  } finally {URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;dom.HTMLAnchorElement.prototype.click=originalClick}
  await click('All');await choose(cad.refreshes[0].run_id)
  cad.snapshot.run_id='f'.repeat(64);cad.refreshes.unshift({run_id:cad.snapshot.run_id,saved_at:cad.snapshot.saved_at});fixture.revision='f'.repeat(64)
  await poll()
  assert.equal(container.querySelector('[aria-label="CAD saved refresh"]').value,cad.snapshot.run_id,'Returning a row to Latest follows later saved updates')
  offline=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/HTTP 503.*last loaded/s)
  offline=false;malformed=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/Invalid daily news/)
  malformed=false;await poll();assert.equal(container.querySelector('[role="alert"]'),null)
  const originalNow=Date.now
  Date.now=()=>Date.parse(cad.snapshot.checked_at)+4*3600000
  globalThis.__newsRows=0
  try {await React.act(async()=>{for(const timer of intervals.values())if(timer.fn.name!=='updateCalendar')timer.fn()})}
  finally {Date.now=originalNow}
  assert.equal(globalThis.__newsRows,0,'Aging stays inside the local clock components')
  assert.match(container.querySelector('[data-news-currency="CAD"]').textContent,/Aging/)
  const previousDate=()=>container.querySelector('[aria-label="Previous date"]')
  await React.act(async()=>previousDate().click())
  assert.equal(container.querySelectorAll('[data-news-currency]').length,8,'Empty dates retain the prescribed table')
  assert.equal(container.querySelectorAll('tbody td').length,24)
  assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('No research saved for this date.')))
  assert.equal(button('Copy refresh prompt'),undefined);assert.equal(container.querySelector('[aria-label="News lookback"]'),null)
  assert.equal([...timers.values()].filter(t=>t.fn.name==='pollNews').length,0,'Past dates never poll')
  await React.act(async()=>container.querySelector('[aria-label="Next date"]').click())
  await React.act(async()=>container.querySelector('[aria-label="Next date"]').click())
  assert.equal(button('Copy refresh prompt'),undefined,'Future dates are browsing only')
  assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('No research saved for this date.')))
  // Stale date replies cannot populate the selected day.
  hold=true;await React.act(async()=>previousDate().click());assert.equal(pending.length,1)
  await React.act(async()=>previousDate().click());assert.equal(pending[0].options.signal.aborted,true)
  hold=false
  await React.act(async()=>{for(const p of pending.splice(0))p.resolve(response(p.url))})
  assert.ok(!container.textContent.includes('Updated mechanism'))
  await click('Today');assert.match(container.textContent,/Updated mechanism/)
  const calendarTick=()=>[...intervals.values()].find(t=>t.fn.name==='updateCalendar').fn()
  Date.now=()=>Date.parse(fixture.date+'T17:01:00Z')
  try {
    await React.act(async()=>calendarTick())
    assert.ok(button('Copy refresh prompt'),'Today follows Jakarta midnight')
    assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('No research saved for this date.')))
    await React.act(async()=>previousDate().click())
    assert.equal(button('Copy refresh prompt'),undefined)
    const count=requests.length
    Date.now=()=>Date.parse(fixture.date+'T17:01:00Z')+86400000
    await React.act(async()=>calendarTick())
    assert.equal(requests.length,count,'An explicitly selected past date stays selected across midnight')
  } finally {Date.now=originalNow;await React.act(async()=>calendarTick())}
  assert.ok(requests.every(r=>r.url.startsWith('/storage-api/currency-news/')&&!r.options.body),'Browsing performs only local GETs')
  hold=true
  const entry=[...timers].find(([,t])=>t.fn.name==='pollNews');timers.delete(entry[0])
  await React.act(async()=>{void entry[1].fn()});assert.equal(pending.length,1)
  await React.act(async()=>root.unmount());assert.equal(pending[0].options.signal.aborted,true)
  await React.act(async()=>pending[0].resolve(response(pending[0].url)))
  assert.equal(timers.size,0);assert.equal(intervals.size,0)
  hold=false;offline=true
  const again=createRoot(container)
  await React.act(async()=>again.render(React.createElement(CurrencyNewsDock)))
  assert.equal(container.querySelectorAll('[data-news-currency]').length,8)
  assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('Saved research unavailable.')),'An initial read failure never claims an empty journal')
  await React.act(async()=>again.unmount())
  assert.equal(timers.size,0);assert.equal(intervals.size,0)
  console.log('Currency News: daily aggregation, independent versions, blank dates, scoped prompts/export, stable polls and cleanup')
} finally {
  await server.close();await dom.happyDOM.close()
  for(const [k,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k]
}
