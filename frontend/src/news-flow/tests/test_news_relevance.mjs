import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import { checkBrowserPopups } from './browser-popup-checks.mjs'

const dom = new Window({ url: 'http://localhost:5173' }), requests = [], timers = new Map()
let timerId = 0
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
dom.setTimeout = (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options = {}) => new Promise(resolve => requests.push({ url, ...options, resolve, answered: false }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const control = label => document.querySelector(`[aria-label="${label}"]`)
const pending = part => requests.findLast(request => !request.answered && !request.signal?.aborted && request.url.includes(part))
async function click(label) { await React.act(async () => { assert.ok(control(label), label); control(label).click() }) }

async function reply(request, body, status = 200) {
  assert.ok(request)
  request.answered = true
  await React.act(async () => request.resolve({ ok: status < 400, status, json: async () => body }))
}
try {
  const { readNewsSettings } = await server.ssrLoadModule('./src/news-flow/model.ts')
  const { useNewsSettings } = await server.ssrLoadModule('./src/news-flow/settings.ts')
  const { NewsSoundAlerts } = await server.ssrLoadModule('./src/news-flow/NewsSoundAlerts.tsx')
  const { NewsGlobalSettings } = await server.ssrLoadModule('./src/news-flow/NewsGlobalSettings.tsx')
  const { Headlines } = await server.ssrLoadModule('./src/news-flow/Headlines.tsx')
  const { matchingKeyword } = await server.ssrLoadModule('./src/news-flow/keywords.ts')
  const original = { presetVersion: 1, include: 'Nvidia, MY CUSTOM PHRASE', exclude: 'personal blacklist', soundEnabled: true, soundMode: 'all' }
  dom.localStorage.setItem('fyodor.news-flow.v1', JSON.stringify(original))
  const migrated = readNewsSettings()
  assert.equal(migrated.presetVersion, 3); assert.equal(migrated.marketRelevance, true)
  assert.equal(migrated.soundMode, 'included', 'One-time upgrade scopes existing enabled alerts to relevance')
  assert.ok(migrated.include.includes('Swiss economy')); assert.ok(migrated.include.includes('MY CUSTOM PHRASE'))
  assert.equal(migrated.exclude, original.exclude)
  assert.equal(migrated.include.split(',').length <= 500, true)
  for (const [title, term] of [['Consumer prices rise briskly','CPI'], ['U.S. 10-Year Treasurys rally','Treasury'], ['Switzerland’s economy grows','Swiss economy'], ['Supertanker rates plunge','tanker'], ['Data-centre stocks slide','data centres'], ['New Zealand services PSI rises','PMI'], ['Foreign exchange intervention operations','currency intervention'], ['European gas prices fall','natural gas'], ['European stocks rally', 'stock'], ['JGB yield rises','JGBs'], ['S&P500 drops','S&P 500'], ['Jensen Huang resigns','Nvidia'], ['Nvida earnings fail to impress','Nvidia'], ['Google unveils new AI chip','Alphabet'], ['People\'s Bank of China cuts rates','People’s Bank of China']]) assert.equal(matchingKeyword(title,term),term)
  const now = Date.now(), make = (id,title,relevance) => ({ id, title, source_id:'r', source_name:'Reuters', publisher:'Reuters',
    summary:'', url:`https://example.com/${id}`, published_at:now, first_seen:now, relevance })
  const items = [make('speech','Speech: Edmonton Chamber of Commerce',{included:true,reason:'Official central-bank policy/speech',keyword:''}),
    make('golf','Trump golf course ruling',{included:false,reason:'Excluded · non-market topic',keyword:'Trump'})]
  function Harness() {
    const [settings, changeSettings] = useNewsSettings()
    return React.createElement(React.Fragment,null,React.createElement(NewsSoundAlerts),React.createElement(Headlines,{items}),React.createElement(NewsGlobalSettings,{settings,onChange:changeSettings}))
  }
  await React.act(async () => root.render(React.createElement(Harness)))
  assert.deepEqual([...host.querySelectorAll('article')].map(row=>row.dataset.newsCategory),['included','excluded'],'Server relevance controls colour, including official feeds without literal hits')
  assert.match(host.textContent,/Official central-bank policy\/speech/)
  assert.equal(control('Trading relevance').checked,true)
  await reply(requests.findLast(request => request.url === '/storage-api/news-flow/notifications'), {mode:'off',max_age_seconds:86400,unified_alerts:false,connection:null,error:'',last_sent:null})
  const migration=pending('/notifications/settings')
  assert.deepEqual(JSON.parse(migration.body),{mode:'included',max_age_seconds:86400},'One-time unification preserves an enabled legacy desktop trigger')
  await reply(migration,{mode:'included',max_age_seconds:86400,unified_alerts:true,connection:null,error:'',last_sent:null})
  assert.equal(host.querySelectorAll('[aria-label="News alert trigger"]').length,1)
  assert.equal(control('Phone news trigger'),null)
  const sync = pending('/notifications/rules')
  assert.equal(JSON.parse(sync.body).market_relevance,true); assert.equal(JSON.parse(sync.body).preset_version,3)
  await reply(sync,{mode:'included'})
  let arrival = pending('/arrivals')
  let params = new URL(arrival.url,'http://localhost').searchParams
  assert.equal(params.get('configured'),'true')
  await reply(arrival,{cursor:7,items:[]})
  const timer = [...timers].find(([,timer])=>timer.ms===1000)
  await React.act(async()=>{timers.delete(timer[0]);timer[1].fn()})
  const stale = pending('/arrivals')
  await click('Trading relevance')
  assert.equal(readNewsSettings().marketRelevance,false)
  assert.equal(stale.signal.aborted,true)
  await reply(pending('/notifications/rules'),{mode:'included'})
  arrival = pending('/arrivals'); params = new URL(arrival.url,'http://localhost').searchParams
  assert.equal(params.get('after'),'7','Rule changes keep the cursor')
  assert.equal(params.get('configured'),'true')
  await reply(stale,{cursor:8,items:[items[0]]})
  assert.doesNotMatch(host.textContent,/headline alerts waiting for audio/,'Aborted old rules cannot trigger a sound')
  await reply(arrival,{cursor:8,items:[]})
  const nextTimer = [...timers].find(([,timer])=>timer.ms===1000)
  await React.act(async()=>{timers.delete(nextTimer[0]);nextTimer[1].fn()})
  await reply(pending('/arrivals'),{cursor:9,items:[{...items[0],published_at:Date.now()-6*86400000,sequence:9}]})
  assert.doesNotMatch(host.textContent,/headline alerts waiting for audio/,'Six-day-old publication is silent even if an old response incorrectly includes it')
  const unknownTimer = [...timers].find(([,timer])=>timer.ms===1000)
  await React.act(async()=>{timers.delete(unknownTimer[0]);unknownTimer[1].fn()})
  assert.equal(new URL(pending('/arrivals').url,'http://localhost').searchParams.get('after'),'9','Suppressed arrivals advance the cursor')
  await reply(pending('/arrivals'),{cursor:10,items:[{...items[0],published_at:null,sequence:10}]})
  assert.doesNotMatch(host.textContent,/headline alerts waiting for audio/,'Unknown publication cannot bypass a strict age limit')
  assert.equal(JSON.parse(dom.localStorage.getItem('fyodor.news-flow.v1.before-relevance-v2')).presetVersion,1,'Original browser settings are backed up once')
  await React.act(async()=>root.render(null))
  assert.equal(timers.size,0)
  await checkBrowserPopups({ server, dom, root, React, control, pending, reply, click, timers, requests })
  console.log('✓ Trading relevance UI: migration/custom rules, aliases, authoritative labels, phone sync, scoped alerts, cursor continuity and stale-response rejection')
} finally {
  await React.act(async () => root.unmount())
  await server.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  await dom.happyDOM.abort()
}
