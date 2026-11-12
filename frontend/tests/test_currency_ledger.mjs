import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), repo = path.dirname(frontend)
const produced = spawnSync(path.join(repo, 'bridge/.venv/Scripts/python.exe'), ['-c', `
import json
from storage.tests.test_currency_ledger import LedgerTests, NOW
from storage.currency_ledger import ledger_snapshot
from storage.currencies import CURRENCIES
t=LedgerTests();t.setUp()
try: print(json.dumps({'years':{str(y):ledger_snapshot(t.store,'Pepperstone-Demo',now_ms=NOW,year=y) for y in [2025,2026]},'all':ledger_snapshot(t.store,'Pepperstone-Demo',now_ms=NOW,currencies=CURRENCIES),'raw':t.store.values('Pepperstone-Demo',['us-jobs','us-nfp'])}))
finally:t.doCleanups()
`], { cwd: repo, encoding: 'utf8' })
assert.equal(produced.status, 0, produced.stderr)
const output = JSON.parse(produced.stdout), fixtures = output.years, fixture = fixtures[2026]
const dom = new Window({ url: 'http://localhost:5173' })
const observers = new Set(), captures = new Map(), counts = { tape: 0, dock: 0 }
class ResizeObserver { constructor(callback) { this.callback = callback; observers.add(this) } observe() {} disconnect() { observers.delete(this) } }
const globals = { window: dom, document: dom.document, localStorage: dom.localStorage, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Node: dom.Node, ResizeObserver, IS_REACT_ACT_ENVIRONMENT: true, __ledgerProbe: counts }
const previous = new Map([...Object.keys(globals), 'fetch'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v })
const originalNow = Date.now
Date.now = () => Date.parse('2026-11-06T10:00:00Z')
const timers = new Map(), requests = [], frames = new Map()
let serial = 0, opened = 0, viewed = null, inspected = null
dom.setTimeout = (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }
dom.clearTimeout = id => timers.delete(id)
dom.requestAnimationFrame = fn => { frames.set(++serial, fn); return serial }
dom.cancelAnimationFrame = id => frames.delete(id)
dom.HTMLElement.prototype.setPointerCapture = function(id) { captures.set(this,id) }
dom.HTMLElement.prototype.hasPointerCapture = function(id) { return captures.get(this)===id }
dom.HTMLElement.prototype.releasePointerCapture = function(id) { if (captures.get(this)===id) captures.delete(this) }
globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url, signal: options.signal, resolve }))
const server = await createServer({ root: frontend, server: { middlewareMode: true, hmr: false }, plugins: [{name:'ledger-work-counts',enforce:'pre',transform(code,id) {
  if(id.endsWith('/LedgerTimeline.tsx')) return code.replace('  const viewport =', '  globalThis.__ledgerProbe.tape++; const viewport =')
  if(id.endsWith('/LedgerDock.tsx')) return code.replace('  const { data,', '  globalThis.__ledgerProbe.dock++; const { data,')
}}] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const click = async node => { assert.ok(node); await React.act(async () => node.click()) }
const reply = async (request, data) => React.act(async () => request.resolve({ ok: true, json: async () => structuredClone(data) }))
const flush = async () => React.act(async () => { for (const [id, fn] of [...frames]) { frames.delete(id); fn() } })
try {
  const model = await server.ssrLoadModule('./src/currency-ledger/ledger-model.ts')
  const { ledgerCards, ledgerReading, ledgerPublications, ledgerDayEnd, validLedger } = model
  assert.equal(validLedger(fixture, 'Pepperstone-Demo'), true)
  for (const mutate of [v => v.metrics.find(m=>m.entries.length).entries[0].value = 'bad', v => v.metrics[0].source_url = 'javascript:bad', v => v.metrics.push(v.metrics[0]), v => v.currencies = ['EUR','CAD']]) {
    const bad = structuredClone(fixture); mutate(bad); assert.equal(validLedger(bad, 'Pepperstone-Demo'), false)
  }
  const cpi = fixture.metrics.find(m => m.id === 'usd.cpi-yoy')
  const at = day => ledgerDayEnd(day)
  assert.equal(ledgerReading(cpi, at('2026-09-09')).entry.value, 3, 'August CPI carries forward regardless of viewport')
  assert.equal(ledgerReading(cpi, at('2026-09-11')).entry.value, 2.8, 'New release replaces old reading')
  assert.equal(ledgerReading(cpi, at('2026-09-14')).entry.value, 2.8, 'Later revision never leaks backward')
  assert.equal(ledgerReading(cpi, at('2026-09-15')).entry.value, 2.9)
  assert.deepEqual(ledgerPublications(cpi,at('2026-09-09')).slice(-3).map(r=>r.entry.value_id),['prior-year','seed','aug'])
  assert.equal(ledgerPublications(cpi,at('2026-09-11')).at(-1).entry.value,2.8,'Historical publications exclude later revisions')
  assert.equal(ledgerReading(cpi, at('2026-08-12')).backfilled, true)
  assert.equal(ledgerReading(cpi, Date.parse('2026-08-12T12:29:59Z')).entry.value, 3.1, 'No same-day actual before publication')
  const dateOnly = fixture.metrics.find(m => m.id === 'cad.cpi-yoy')
  assert.equal(ledgerReading(dateOnly, at('2026-08-20')-1), null, 'Unknown hours enter only at day end')
  assert.equal(ledgerReading(dateOnly, at('2026-08-20')).entry.value, 2.5)
  const cards = ledgerCards(fixture, at('2026-09-09'))
  assert.equal(cards[0].categories.find(c => c.id === 'policy').score, 50)
  assert.equal(cards[1].categories.find(c => c.id === 'policy').score, 100)
  assert.equal(cards[0].categories.find(c => c.id === 'labour').score, 0)
  assert.equal(cards[1].categories.find(c => c.id === 'labour').score, 100)
  assert.equal(cards[0].categories.find(c => c.id === 'inflation').score, null)
  assert.equal(cards[1].categories.find(c => c.id === 'consumer').score, 0, 'Zero actual is a valid reading')
  assert.equal(cards[0].assessed, 2, 'Missing categories excluded, not assumed neutral')
  const doubled = structuredClone(fixture)
  doubled.metrics.find(m => m.id === 'usd.rate').entries.push(...fixture.metrics.find(m => m.id === 'usd.rate').entries)
  assert.equal(ledgerCards(doubled, at('2026-09-09'))[0].score, cards[0].score, 'Repeated evidence never adds points')

  const filtering=await server.ssrLoadModule('./src/currency-ledger/ledger-filters.ts')
  const {defaultLedgerFilters,readLedgerFilters,saveLedgerFilters,createLedgerFilter,ledgerFilterStorageKey}=filtering
  const tiers=JSON.parse((await import('node:fs')).readFileSync(path.join(repo,'config/event-tiers.json'),'utf8')).series
  const defaults=defaultLedgerFilters(),admit=createLedgerFilter(defaults)
  for(const currency of output.all.currencies) for(const tier of ['S','A','B','C']){
    const [event_id,rule]=Object.entries(tiers).find(([,r])=>r.currency===currency&&r.tier===tier)
    const metric={...cpi,currency,country:rule.country,event_id,entries:[]}
    assert.equal(admit(metric),tier!=='C',currency+tier)
    assert.equal(createLedgerFilter({...defaults,tiers:['S','A','B','C']})(metric),true,currency+tier+' All events')
    assert.equal(admit({...metric,country:'ZZ'}),false,'Metadata mismatches never inherit a known ID tier')
    assert.equal(admit({...metric,event_id:'9988776611'}),false,'Unknown IDs default to C')
  }
  const {inspectorFamilies}=await server.ssrLoadModule('./src/inspector/catalog/inspector-families.ts')
  const withoutUsd={...defaults,tiers:[],families:inspectorFamilies.filter(f=>f.currency!=='USD').map(f=>f.id)}
  saveLedgerFilters(withoutUsd,['USD'])
  assert.deepEqual(readLedgerFilters().tiers,[],'Explicit empty tier selections survive reload')
  const preserved=readLedgerFilters().families.filter(id=>inspectorFamilies.find(f=>f.id===id).currency!=='CAD')
  saveLedgerFilters(defaults,['CAD'])
  assert.deepEqual(readLedgerFilters().families.filter(id=>inspectorFamilies.find(f=>f.id===id).currency!=='CAD'),preserved,'Saving CAD preserves other currencies')
  localStorage.setItem(ledgerFilterStorageKey,'broken JSON')
  assert.deepEqual(readLedgerFilters(),defaults)
  localStorage.removeItem(ledgerFilterStorageKey)
  fixture.metrics.push({...cpi,id:'usd.calendar.US.9988776611.1.0',canonical:false,event_id:'9988776611',label:'Minor survey',entries:[{...cpi.entries.at(-1),value_id:'minor',event_id:'9988776611'}]})
  const { LedgerProvider } = await server.ssrLoadModule('./src/currency-ledger/LedgerProvider.tsx')
  const { LedgerDock } = await server.ssrLoadModule('./src/currency-ledger/LedgerDock.tsx')
  const { LedgerDetail } = await server.ssrLoadModule('./src/currency-ledger/LedgerDetail.tsx')
  const { LedgerRateHistory } = await server.ssrLoadModule('./src/currency-ledger/LedgerRateHistory.tsx')
  const {actualImpact}=await server.ssrLoadModule('./src/economic-calendar/presentation/actual-impact.ts')
  assert.equal(actualImpact(null,'positive'),undefined)
  assert.equal(actualImpact(1,'none'),undefined)
  assert.equal(actualImpact(1,'unknown'),undefined)
  const { DisplayClockProvider } = await server.ssrLoadModule('./src/appearance/time-display/DisplayClock.tsx')
  const preference = { mode: 'fixed-offset', utcOffsetMinutes: 420, hour12: true }, onOpenDetail = () => opened++, onViewEvent = r => viewed = r.value_id, onInspect = r => inspected=r.value_id
  const render = async (broker = 'Pepperstone-Demo', enabled = true) => React.act(async () => root.render(
    React.createElement(DisplayClockProvider, { brokerId: broker, brokerOffsetSeconds: 7200, preference },
      React.createElement(LedgerProvider, { broker, enabled }, React.createElement(React.Fragment, null,
        React.createElement(LedgerDock, { supported: enabled, broker, onOpenDetail, onViewEvent:onInspect }),
        enabled && React.createElement(LedgerDetail, { onViewEvent }))))))
  await render(); await reply(requests.at(-1), fixture)
  assert.ok([...container.querySelectorAll('.ledger-toolbar button')].some(n=>n.textContent==='Today'))
  assert.equal([...container.querySelectorAll('.ledger-toolbar button')].some(n=>n.textContent==='Live'),false)
  assert.equal(container.querySelector('[aria-label="Ledger history basis"]'),null)
  assert.equal(container.querySelector('.ledger-caption'),null)
  assert.ok(container.querySelectorAll('[data-ledger-date]').length < 20,'Only viewport dates and overscan are mounted, never the whole year')
  assert.equal(requests.at(-1).url.includes('year=2026'),true)
  const filterButton=()=>container.querySelector('[aria-label="Ledger filters"]'),popover=()=>document.querySelector('.ledger-filters-popover')
  assert.equal(filterButton().textContent,'Filters · S/A/B')
  const choose=async label=>click([...popover().querySelectorAll('button')].find(n=>n.textContent===label))
  const requestsBeforeFilter=requests.length,summaryBeforeFilter=container.querySelector('.ledger-summary').textContent
  await click(filterButton());assert.equal(filterButton().getAttribute('aria-expanded'),'true')
  await choose('All events')
  assert.equal(filterButton().textContent,'Filters · S/A/B/C')
  await choose('Cancel');assert.equal(popover(),null);assert.equal(filterButton().textContent,'Filters · S/A/B')
  assert.equal(localStorage.getItem(ledgerFilterStorageKey),null,'Cancel does not save preview choices')
  await click(filterButton());await choose('S/A only');await choose('Save')
  assert.deepEqual(readLedgerFilters().tiers,['S','A'])
  await click(filterButton());await choose('All events')
  await React.act(async()=>window.dispatchEvent(new dom.KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
  assert.equal(popover(),null);assert.equal(filterButton().textContent,'Filters · S/A')
  await click(filterButton());await choose('S/A/B · recommended');await choose('Save')
  await click(filterButton());await choose('All events')
  const savedBeforeFailure=localStorage.getItem(ledgerFilterStorageKey),browserStorage=localStorage
  try{
    Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:{getItem:key=>browserStorage.getItem(key),setItem(){throw new Error('Full')}}})
    await choose('Save')
    assert.ok(popover());assert.match(popover().querySelector('[role="alert"]').textContent,/Could not save/)
    assert.equal(browserStorage.getItem(ledgerFilterStorageKey),savedBeforeFailure)
  }finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:browserStorage})}
  await React.act(async()=>document.body.dispatchEvent(new dom.PointerEvent('pointerdown',{bubbles:true})))
  assert.equal(popover(),null);assert.equal(filterButton().textContent,'Filters · S/A/B')
  assert.equal(requests.length,requestsBeforeFilter)
  assert.equal(container.querySelector('.ledger-summary').textContent,summaryBeforeFilter,'Visibility filtering leaves scoring evidence intact')
  const beforeGeometry = {...counts}
  for(let i=0;i<20;i++) await render()
  for(const observer of observers) observer.callback([])
  assert.deepEqual(counts,beforeGeometry,'Parent height renders and height-only observations do not repaint Ledger')
  const input = container.querySelector('[aria-label="Ledger as-of date"]')
  const selectDate = async day => React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(input, day)
    input.dispatchEvent(new dom.Event('input', { bubbles: true }))
    input.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await selectDate('2026-09-09')
  const tapeBeforeFilter=container.querySelector('.ledger-viewport').scrollLeft
  assert.equal(container.querySelector('[data-ledger-event="minor"]'),null,'Secondary unknown survey is hidden by default')
  await click(filterButton());await choose('All events')
  assert.ok(container.querySelector('[data-ledger-event="minor"]'),'All events restores retained secondary series')
  await choose('S/A/B · recommended')
  const cpiRow=[...popover().querySelectorAll('.inspector-family')].find(n=>n.querySelector('input').getAttribute('aria-label')==='US CPI / core CPI')
  assert.ok(cpiRow)
  const search=popover().querySelector('[aria-label="Search Ledger families"]')
  await React.act(async()=>{
    Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype,'value').set.call(search,'CPI')
    search.dispatchEvent(new dom.Event('input',{bubbles:true}));search.dispatchEvent(new dom.Event('change',{bubbles:true}))
  })
  assert.ok(popover().querySelectorAll('.inspector-family').length<10,'Search narrows shared family controls')
  await click([...popover().querySelectorAll('.inspector-family input')].find(n=>n.getAttribute('aria-label')==='US CPI / core CPI'))
  assert.equal(container.querySelector('[data-ledger-event="sep"]'),null,'Family exclusions apply in addition to tiers')
  assert.ok(container.querySelector('[data-ledger-metric="usd.cpi-yoy"]'),'Detail evidence remains available independently of tape filters')
  await choose('Cancel');assert.ok(container.querySelector('[data-ledger-event="sep"]'))
  assert.equal(container.querySelector('.ledger-viewport').scrollLeft,tapeBeforeFilter)
  assert.equal(input.value,'2026-09-09')
  assert.equal(container.querySelector('.ledger-release-header'),null,'The fixed release summary has been removed')
  assert.equal(container.querySelector('.ledger-score-buttons'),null,'Numeric score boxes have been removed')
  const evidence = () => container.querySelector('[data-ledger-metric="usd.cpi-yoy"]')
  assert.match(evidence().textContent, /3.1% → 3%/)
  const viewport = container.querySelector('.ledger-viewport'), selected = input.value
  const requestsBefore = requests.length
  viewport.scrollLeft = 0
  await React.act(async () => viewport.dispatchEvent(new dom.Event('scroll', { bubbles: true })))
  await flush()
  assert.equal(input.value, selected); assert.match(evidence().textContent, /3.1% → 3%/)
  assert.equal(requests.length, requestsBefore, 'Tape scrolling is local and read-only')
  assert.ok(container.querySelector('[data-ledger-date="2026-01-01"]'))
  assert.equal([...container.querySelectorAll('button')].some(n=>n.textContent==='Go to 2025'),true)
  const beforeYearScore=container.querySelector('.ledger-summary').textContent
  await click([...container.querySelectorAll('button')].find(n=>n.textContent==='Go to 2025'))
  const yearRequests=requests.slice(requestsBefore)
  assert.equal(yearRequests.length,2,'Load the viewed year and retain the independently evaluated year')
  for(const request of yearRequests) {
    const year=Number(new URL(request.url,'http://localhost').searchParams.get('year'))
    await reply(request,fixtures[year])
  }
  assert.equal(input.value,selected,'Browsing another year never changes the score date')
  assert.equal(container.querySelector('.ledger-summary').textContent,beforeYearScore)
  assert.ok(container.querySelector('[data-ledger-date="2025-12-31"]'),'Previous year lands at its December end')
  await click([...container.querySelectorAll('button')].find(n=>n.textContent==='Go to 2026'))
  await reply(requests.at(-1),fixture)
  assert.ok(container.querySelector('[data-ledger-date="2026-01-01"]'),'Next year lands at January')
  await selectDate('2026-09-11'); assert.match(evidence().textContent, /3% → 2.8%/)
  await selectDate('2026-09-15'); assert.match(evidence().textContent, /3.05% → 2.9%/)
  await selectDate('2026-09-09'); assert.match(evidence().textContent, /3.1% → 3%/)
  const dragViewport=container.querySelector('.ledger-viewport'), cutoffBeforeDrag=input.value, leftBeforeDrag=dragViewport.scrollLeft
  const dateBeforeDrag=container.querySelector('[data-ledger-date="2026-09-09"]')
  await React.act(async()=>dateBeforeDrag.dispatchEvent(new dom.PointerEvent('pointerdown',{bubbles:true,button:0,isPrimary:true,pointerId:10,clientX:500,clientY:0})))
  const tapeBeforeDrag=counts.tape
  await React.act(async()=>{for(let i=0;i<100;i++) dragViewport.dispatchEvent(new dom.PointerEvent('pointermove',{bubbles:true,pointerId:10,clientX:500-i*2,clientY:0}))})
  assert.equal(frames.size,1,'Pointer bursts queue one animation frame')
  assert.equal(counts.tape,tapeBeforeDrag,'Pointer bursts do not rerender React')
  await flush()
  assert.equal(dragViewport.scrollLeft,leftBeforeDrag+198)
  await React.act(async()=>dragViewport.dispatchEvent(new dom.PointerEvent('pointerup',{bubbles:true,pointerId:10,clientX:302})))
  await click(dateBeforeDrag)
  assert.equal(input.value,cutoffBeforeDrag,'Dragging a date card suppresses its click')
  assert.equal(captures.size,0)
  assert.equal(container.textContent.includes('After cutoff · values hidden'),false)
  assert.equal(container.querySelector('[data-ledger-event="sep"] .ledger-header-values strong').textContent,'2.9%','Tape keeps latest retained released values visible after the selected cutoff')
  await click(container.querySelector('[aria-label="Open CAD Ledger scorecard"]')); assert.equal(opened, 1)
  await click([...container.querySelectorAll('.ledger-scorecard th button')].find(n => n.textContent === 'Labor & wages'))
  assert.ok(container.querySelector('[data-ledger-metric="cad.unemployment"]'))
  await click(container.querySelector('[data-ledger-metric="cad.unemployment"] button')); assert.equal(viewed, 'ca-jobs')
  const [id, timer] = [...timers].find(([,t]) => t.ms === 30000); timers.delete(id)
  await React.act(async () => { void timer.fn() })
  await reply(requests.at(-1), { schema: 1, broker: 'Pepperstone-Demo', year:2026, currencies:['USD','CAD'], revision: fixture.revision, unchanged: true })
  assert.equal(input.value, '2026-09-09', 'Polling does not reset historical selection')
  await render('Other'); const stale = requests.at(-1)
  await render('Pepperstone-Demo'); assert.equal(stale.signal.aborted, true)
  await reply(stale, { ...fixture, broker: 'Other' }); await reply(requests.at(-1), fixture)
  await render('Pepperstone-Demo', false)
  assert.match(container.textContent, /28 major FX pairs/)
  assert.equal(timers.size, 0, 'Closed/unsupported Ledger cancels polling')
  assert.equal(frames.size,0);assert.equal(observers.size,0)
  // All 28 production pair identities accept the full eight-currency contract.
  const {majorForexPairs,forexPairCurrencies}=await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  let precedingPair=null
  for(const pair of majorForexPairs){
    const currencies=forexPairCurrencies(pair)
    const snapshot={...output.all,currencies:[...currencies],coverage:Object.fromEntries(currencies.map(c=>[c,output.all.coverage[c]])),metrics:output.all.metrics.filter(m=>currencies.includes(m.currency))}
    assert.ok(validLedger(snapshot,'Pepperstone-Demo',2026,currencies),pair)
    assert.deepEqual(ledgerCards(snapshot,at('2026-09-09')).map(c=>c.currency),[...currencies])
    await React.act(async()=>root.render(React.createElement(DisplayClockProvider,{brokerId:'Pepperstone-Demo',brokerOffsetSeconds:7200,preference},
      React.createElement(LedgerProvider,{broker:'Pepperstone-Demo',enabled:true,currencies},React.createElement(React.Fragment,null,
        React.createElement(LedgerDock,{supported:true,broker:'Pepperstone-Demo',onOpenDetail,onViewEvent:onInspect}),React.createElement(LedgerDetail,{onViewEvent}),React.createElement(LedgerRateHistory,{onViewEvent}))))))
    await reply(requests.at(-1),snapshot)
    assert.equal(new URL(requests.at(-1).url,'http://localhost').searchParams.get('scope'),pair)
    assert.equal(popover(),null,'Changing pair cancels an open filter preview')
    assert.deepEqual(readLedgerFilters().tiers,['S','A','B'])
    assert.deepEqual([...container.querySelectorAll('.ledger-currency')].map(n=>n.textContent),[...currencies])
    assert.deepEqual([...container.querySelectorAll('.ledger-scorecard thead th')].slice(1).map(n=>n.textContent),[...currencies])
    assert.deepEqual([...container.querySelectorAll('.ledger-rate-columns h3')].map(n=>n.textContent),[...currencies])
    await click(filterButton())
    assert.deepEqual([...popover().querySelectorAll('.inspector-filter-columns h3')].map(n=>n.textContent.replace('Select all','')),[...currencies])
    await choose('All events')
    precedingPair=pair
  }
  assert.ok(precedingPair)
  // Vertically dense days mount a bounded window; the last release stays reachable.
  const {LedgerDayCell}=await server.ssrLoadModule('./src/currency-ledger/LedgerDayCell.tsx')
  const metric={...cpi,canonical:false},items=Array.from({length:1000},(_,i)=>({metric,entry:{...cpi.entries[0],value_id:'dense-'+i,value:i,impact:i%2?'negative':'positive'},revision:false,eventAt:at('2026-09-09')}))
  const memory={current:{cells:new Map(),tape:new Map(),headerLeft:0}}
  await React.act(async()=>root.render(React.createElement(DisplayClockProvider,{brokerId:'Pepperstone-Demo',brokerOffsetSeconds:7200,preference},
    React.createElement(LedgerDayCell,{items,cellKey:'USD-2026-09-09',broker:'Pepperstone-Demo',selected:false,position:{},memory,onInspect,now:Date.now()}))))
  const dense=container.querySelector('.ledger-day-cell')
  assert.ok(container.querySelectorAll('.ledger-event').length<=6)
  assert.equal(container.querySelector('[data-mt5-impact="positive"]').textContent,'0%','Zero actual retains its MT5 impact')
  assert.ok(container.querySelector('[data-mt5-impact="negative"]'))
  assert.equal(container.querySelectorAll('[data-mt5-impact]').length,container.querySelectorAll('.ledger-event').length,'Only actuals carry impact color')
  dense.scrollTop=999*104
  await React.act(async()=>dense.dispatchEvent(new dom.Event('scroll',{bubbles:true})));await flush()
  assert.ok(container.querySelectorAll('.ledger-event').length<=6)
  await click(container.querySelector('[data-ledger-event="dense-999"]'));assert.equal(inspected,'dense-999')
  assert.equal(memory.current.cells.get('Pepperstone-Demo:USD-2026-09-09'),999*104)
  // A Ledger focus does not rewrite normal Inspector admission or dates.
  await React.act(async()=>root.render(null))
  globalThis.fetch=async url=>{
    const route=new URL(url,'http://localhost')
    if(route.pathname==='/storage-api/health') return {ok:true,json:async()=>({revision:1,sources:[{id:'Pepperstone-Demo',publisher_status:'live',server_now:Date.now()/1000,instance_id:'fixture'}],collector_error:null})}
    const from=Number(route.searchParams.get('from_server_seconds')),to=Number(route.searchParams.get('to_server_seconds'))
    return {ok:true,json:async()=>({source_id:'Pepperstone-Demo',revision:1,timestamp_convention:'trade_server_time',time_basis:'chart',coverage:{},next_cursor:null,
      events:output.raw.filter(e=>e.chart_time_seconds>=from&&e.chart_time_seconds<to)})}
  }
  const {useInspector}=await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const {InspectorPanel}=await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  let inspectorView
  const emptyBars=[]
  function InspectorHarness(){
    const view=useInspector({symbol:'USDCAD',bars:emptyBars,timeframe:'D1',timeDisplay:preference,clockOffsetMs:0,brokerId:'Pepperstone-Demo',brokerOffsetSeconds:7200})
    React.useLayoutEffect(()=>{inspectorView=view},[view])
    return React.createElement(InspectorPanel,{view,symbol:'USDCAD',source:null,error:null,timeDisplay:preference})
  }
  await React.act(async()=>root.render(React.createElement(InspectorHarness)))
  await React.act(async()=>{
    inspectorView.selectCustomRange('2026-11-06','2026-11-06')
    inspectorView.applyPreferences({...inspectorView.preferences,families:[],symbolGrouping:'day'})
  })
  const preferencesBefore=localStorage.getItem('fyodor.inspector.shared.v1')
  assert.equal(inspectorView.releases.length,0)
  await React.act(async()=>inspectorView.focusEvent(fixture.metrics.find(m=>m.id==='usd.unemployment').entries[0],'USD'))
  assert.ok(container.querySelector('[data-value-id="us-jobs"][data-ledger-focused="true"]'))
  assert.ok(container.querySelector('[data-value-id="us-nfp"]'),'Other series from the jobs package remain inspectable')
  assert.equal(inspectorView.preferences.symbolGrouping,'day')
  assert.equal(inspectorView.rangeDates.from,'2026-11-06')
  assert.equal(inspectorView.rangeDates.to,'2026-11-06')
  assert.equal(localStorage.getItem('fyodor.inspector.shared.v1'),preferencesBefore)
  await React.act(async()=>inspectorView.selectRelease(null))
  assert.equal(inspectorView.focusedValueId,null)
  console.log('✓ Ledger: production storage projection, carry-forward, cutoff isolation, captured revisions, category math, no duplicate votes, local scrolling, shared scorecard, scope and cancellation')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close(); Date.now = originalNow
  for (const [k, d] of previous) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k] }
}
