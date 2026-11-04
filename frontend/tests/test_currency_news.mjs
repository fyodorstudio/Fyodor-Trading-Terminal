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
from storage.currency_news import NewsRefresh, save_refresh, news_history, news_run
from storage.currency_news_feed import news_feed
now = datetime.now(timezone.utc)-timedelta(minutes=1)
day=(now+timedelta(hours=7)).date().isoformat()
old=(now-timedelta(days=2)+timedelta(hours=7)).date().isoformat()
source = dict(label='Original publisher',url='https://example.com/news')
def story(key, **values):
 item=dict(story_id=key,summary='Source facts for '+key,published_at=(now-timedelta(minutes=10)).isoformat(),sources=[source],bias='bullish',reason='Export support outweighs the demand opposition.')
 item.update(values)
 return item
def row(currency, items, seconds=0, **values):
 result=dict(currency=currency,checked_at=(now+timedelta(seconds=seconds)).isoformat(),coverage='checked',items=items)
 result.update(values)
 return result
with TemporaryDirectory() as d:
 save_refresh(NewsRefresh(rows=[row('CAD',[story('shared'),story('unknown',published_at=None,published_date=day),story('dated',published_at=None,published_date=old)])]),Path(d))
 save_refresh(NewsRefresh(rows=[row('JPY',[story('shared',bias='conditional',reason='Both channels matter.',bullish_if='energy costs fall',bearish_if='haven demand recedes'),story('follow-up')],1)]),Path(d))
 save_refresh(NewsRefresh(rows=[row('CAD',[story('shared',reason='Latest CAD interpretation.'),story('unknown',published_at=None,published_date=day)],2),row('USD',[],coverage='partial',coverage_note='One publisher was inaccessible.'),row('NZD',[],coverage='unavailable',coverage_note='Relevant routes unavailable.')]),Path(d))
 history=news_history(Path(d),day)
 print(json.dumps(dict(day=news_feed(Path(d),day),old=news_feed(Path(d),old),history=history,runs={r['run_id']:news_run(Path(d),r['run_id']) for r in history['runs']})))
`], { cwd: repo, encoding: 'utf8' })
assert.equal(produced.status, 0, produced.stderr)
const bundle = JSON.parse(produced.stdout)
let fixture = bundle.day
const server = await createServer({ root: frontend, server: { middlewareMode: true, hmr: false }, plugins: [{
  name: 'news-row-work-count', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/CurrencyNewsDock.tsx')) return code.replace('  return <tr data-news-story=', '  globalThis.__newsRows++; return <tr data-news-story=')
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
  if (route.pathname === '/storage-api/currency-news/feed') {
    const date = route.searchParams.get('date')
    value = date === fixture.date ? fixture : date === bundle.old.date ? bundle.old : {schema:2,date,revision:'d'.repeat(64),updated_at:null,stories:[],coverage:[]}
    if (route.searchParams.get('after_revision') === value.revision) value = {schema:2,date,revision:value.revision,unchanged:true}
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
  const { validNewsFeed, validSavedNews, newsAge } = await server.ssrLoadModule('./src/currency-news/news-model.ts')
  const { newsMarkdown } = await server.ssrLoadModule('./src/currency-news/news-export.ts')
  assert.equal(validNewsFeed(fixture, fixture.date), true, 'Production story projection matches frontend')
  assert.equal(validNewsFeed(fixture, '2020-01-01'), false)
  assert.equal(newsAge('2026-01-01T00:00:00Z',Date.parse('2026-01-01T01:02:00Z')),'1 hour 2 minutes ago')
  for (const r of bundle.history.runs) assert.equal(validSavedNews(bundle.runs[r.run_id], r.run_id), true)
  for (const mutate of [d=>d.stories.push(d.stories[0]),d=>d.stories[0].sources[0].url='javascript:alert(1)',
    d=>d.stories[0].published_date='2020-01-01',d=>d.stories[0].order_at='2000-01-01T00:00:00Z',
    d=>d.stories[0].implications[0].versions=[],d=>d.coverage[0].currency='XYZ',
    d=>d.stories.find(s=>s.id==='shared').implications.find(i=>i.currency==='JPY').bullish_if='']) {
    const bad=structuredClone(fixture);mutate(bad);assert.equal(validNewsFeed(bad,fixture.date),false)
  }
  localStorage.setItem('fyodor.currency-news.date.v1','2020-01-01')
  await React.act(async()=>root.render(React.createElement(CurrencyNewsDock)))
  const storyNode=id=>container.querySelector(`[data-news-story="${id}"]`)
  assert.ok(container.querySelector('[aria-label="Currency News date selector"]'))
  assert.equal(container.querySelectorAll('[data-news-story]').length,3)
  assert.equal(globalThis.__newsRows,3)
  assert.equal(container.querySelector('tbody tr').dataset.newsStory,'unknown','Unknown publication time sorts by last assessment')
  assert.match(storyNode('unknown').querySelector('.news-age').textContent,/Assessed/)
  assert.match(storyNode('shared').textContent,/Latest CAD interpretation/)
  assert.match(storyNode('shared').textContent,/Bullish if.*energy costs fall.*Bearish if.*haven demand recedes/s)
  assert.equal(storyNode('dated'),null,'Date-only old story does not leak into Today')
  for(const label of ['Older background','Publication time unknown','3-hour window','Mixed','Saved Nov','Checked Nov']) assert.ok(!container.textContent.includes(label),label)
  assert.equal(container.querySelector('details'),null)
  assert.equal(container.querySelector('[aria-label="News lookback"]'),null)
  assert.deepEqual([...container.querySelectorAll('thead th')].map(n=>n.textContent),['Currencies / Sources','News Fundamentals','Implication'])
  await click('Copy refresh prompt');assert.match(copied,/all eight currencies.*without a fixed lookback cutoff/s)
  assert.match(copied,/bullish_if.*bearish_if/s)
  const beforeFilter=requests.length
  await click('CAD');assert.equal(container.querySelectorAll('[data-news-story]').length,2)
  assert.equal(storyNode('shared').querySelector('[data-news-implication="JPY"]'),null)
  await click('All');assert.equal(requests.length,beforeFilter,'Scope filters do no network/research work')
  globalThis.__newsRows=0
  await poll();assert.equal(globalThis.__newsRows,0,'Unchanged feed poll renders no stories')
  const shared=fixture.stories.find(s=>s.id==='shared'),cad=shared.implications.find(i=>i.currency==='CAD')
  cad.reason='Updated mechanism, with explicit opposition.';fixture.revision='b'.repeat(64)
  await poll();assert.equal(globalThis.__newsRows,1,'A focused update only renders its shared story')
  const earlier=cad.versions.at(-1)
  const choose=async id=>React.act(async()=>{const select=container.querySelector('[aria-label="shared CAD assessment"]');select.value=id;select.dispatchEvent(new dom.Event('change',{bubbles:true}))})
  await choose(earlier.run_id)
  assert.match(storyNode('shared').textContent,/Export support outweighs/)
  assert.match(storyNode('shared').textContent,/energy costs fall/,'Other currency assessment is preserved')
  const afterEarlier=requests.length
  await click('CAD');await click('All');await choose(cad.versions[0].run_id);await choose(earlier.run_id)
  assert.equal(requests.length,afterEarlier,'Cached assessments and scope changes do not duplicate reads')
  const saved=bundle.runs[earlier.run_id].rows.find(r=>r.currency==='CAD').snapshot.items[0]
  const exportStories=fixture.stories.map(s=>s.id==='shared'?{...s,implications:s.implications.map(i=>i.currency==='CAD'?{...i,reason:saved.reason,selected_run:earlier.run_id}:i)}:s)
  const markdown=newsMarkdown({...fixture,stories:exportStories},'CAD',fixture.date)
  assert.match(markdown,/Export support.*https:\/\/example.com\/news|https:\/\/example.com\/news.*Export support/s)
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalClick=dom.HTMLAnchorElement.prototype.click
  let exported,filename='',revoked=''
  URL.createObjectURL=blob=>{exported=blob;return 'blob:news-export'};URL.revokeObjectURL=url=>{revoked=url}
  dom.HTMLAnchorElement.prototype.click=function(){filename=this.download}
  try {
    await click('CAD');await click('Export Markdown')
    assert.equal(await exported.text(),markdown);assert.match(filename,/currency-news-cad-.*\.md/)
    const revoke=[...timers].find(([,t])=>t.ms===1000);timers.delete(revoke[0]);revoke[1].fn();assert.equal(revoked,'blob:news-export')
  } finally {URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;dom.HTMLAnchorElement.prototype.click=originalClick}
  await click('All');await choose(cad.versions[0].run_id)
  const originalNow=Date.now
  globalThis.__newsRows=0
  const later=originalNow()+4*3600000
  Date.now=()=>later
  try {await React.act(async()=>{for(const timer of intervals.values())if(timer.fn.name!=='updateCalendar')timer.fn()})}
  finally {Date.now=originalNow}
  assert.equal(globalThis.__newsRows,0,'Age updates stay inside local clock components')
  offline=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/HTTP 503.*last loaded/s)
  offline=false;malformed=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/Invalid news feed/)
  malformed=false;await poll();assert.equal(container.querySelector('[role="alert"]'),null)
  const previousDate=()=>container.querySelector('[aria-label="Previous date"]')
  await React.act(async()=>previousDate().click())
  await React.act(async()=>previousDate().click())
  assert.ok(storyNode('dated'),'Date-only story is filed two days earlier')
  assert.ok(!storyNode('dated').querySelector('.news-publication').textContent.includes('AM'),'Date-only publication does not invent an hour')
  await click('Today')
  await React.act(async()=>previousDate().click())
  assert.equal(container.querySelectorAll('[data-news-story]').length,0,'Empty dates do not borrow another day')
  assert.equal(container.querySelectorAll('tbody td').length,1)
  assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('No news fundamentals saved for this date.')))
  assert.equal(button('Copy refresh prompt'),undefined);assert.equal(container.querySelector('[aria-label="News lookback"]'),null)
  assert.equal([...timers.values()].filter(t=>t.fn.name==='pollNews').length,0,'Past dates never poll')
  await React.act(async()=>container.querySelector('[aria-label="Next date"]').click())
  await React.act(async()=>container.querySelector('[aria-label="Next date"]').click())
  assert.equal(button('Copy refresh prompt'),undefined,'Future dates are browsing only')
  assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('No news fundamentals saved for this date.')))
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
    assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('No news fundamentals saved for this date.')))
    await React.act(async()=>previousDate().click())
    assert.equal(button('Copy refresh prompt'),undefined)
    const count=requests.length
    Date.now=()=>Date.parse(fixture.date+'T17:01:00Z')+86400000
    await React.act(async()=>calendarTick())
    assert.equal(requests.length,count,'An explicitly selected past date stays selected across midnight')
  } finally {Date.now=originalNow;await React.act(async()=>calendarTick())}
  assert.ok(requests.every(r=>r.url.startsWith('/storage-api/currency-news/')&&!r.options.body),'Browsing performs only local GETs')
  fixture.stories.push(...Array.from({length:60},(_,index)=>({...structuredClone(fixture.stories[0]),id:`additional-${index}`,summary:`Additional source facts ${index}`})))
  fixture.revision='c'.repeat(64)
  globalThis.__newsRows=0
  await poll()
  assert.equal(container.querySelectorAll('[data-news-story]').length,50,'Initial rendering is bounded to 50 story rows')
  assert.equal(globalThis.__newsRows,47,'Existing three story rows retain their identities')
  assert.match(newsMarkdown(fixture,'ALL',fixture.date),/Additional source facts 59/,'Export includes stories beyond the rendered batch')
  const beforeScroll=requests.length
  globalThis.__newsRows=0
  await React.act(async()=>container.querySelector('.news-scroll').dispatchEvent(new dom.Event('scroll')))
  assert.equal(container.querySelectorAll('[data-news-story]').length,63)
  assert.equal(globalThis.__newsRows,13,'Scrolling mounts only the next batch without rerendering existing stories')
  assert.equal(requests.length,beforeScroll,'Scroll expansion performs no research or network work')
  hold=true
  const entry=[...timers].find(([,t])=>t.fn.name==='pollNews');timers.delete(entry[0])
  await React.act(async()=>{void entry[1].fn()});assert.equal(pending.length,1)
  await React.act(async()=>root.unmount());assert.equal(pending[0].options.signal.aborted,true)
  await React.act(async()=>pending[0].resolve(response(pending[0].url)))
  assert.equal(timers.size,0);assert.equal(intervals.size,0)
  hold=false;offline=true
  const again=createRoot(container)
  await React.act(async()=>again.render(React.createElement(CurrencyNewsDock)))
  assert.equal(container.querySelectorAll('[data-news-story]').length,0)
  assert.ok([...container.querySelectorAll('tbody tr')].every(r=>r.textContent.includes('Saved research unavailable.')),'An initial read failure never claims an empty journal')
  await React.act(async()=>again.unmount())
  assert.equal(timers.size,0);assert.equal(intervals.size,0)
  console.log('Currency News: publication-dated story flow, shared currency scenarios, assessment ages/history, scoped exports, stable polls and cleanup')
} finally {
  await server.close();await dom.happyDOM.close()
  for(const [k,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k]
}
