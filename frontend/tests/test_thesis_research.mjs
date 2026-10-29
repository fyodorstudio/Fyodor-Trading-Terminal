import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Production component/hook tests; no browser or visual audit.
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const server=await createServer({root:frontend,server:{middlewareMode:true,hmr:false},plugins:[{name:'thesis-work-counts',enforce:'pre',
  transform(code,id) {if(id.endsWith('/ThesisCurrencyTable.tsx'))return code.replace('  const impact = item.impacts.find', '  globalThis.__thesisWork.rows++; const impact = item.impacts.find')}
}]})
const dom=new Window({url:'http://localhost:5173'})
const globals={window:dom,document:dom.document,navigator:dom.navigator,localStorage:dom.localStorage,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true,__thesisWork:{rows:0}}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for (const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
let sequence=0,offline=false,hold=false,malformed=false,copied=''
const timers=new Map(),requests=[],held=[]
dom.setTimeout=(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence};dom.clearTimeout=id=>timers.delete(id)
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copied=value}}})
const source={kind:'web',label:'Official source',locator:'https://example.com/release',note:'Original evidence'}
const development=(id,date,at=null)=>({id,key:id,title:'Policy '+id,facts:'Verified facts '+id,published_on:date,published_at:at,event_at:null,
  timing_note:at ? '' : 'Publication hour unknown.',verified_utc:'2026-07-22T10:00:00Z',saved_utc:'2026-07-22T10:00:00Z',sources:[source],
  impacts:[{currency:'CHF',implication:'Supports haven demand.',thesis_effect:'Partly offsets earlier weakening pressure.'}],references:[],revision_note:'',expected_version:null,versions:[]})
const direction={basis:'standalone',verdict:'POTENTIAL WEAKENING',intensity:'slight',reason:'Funding pressure remains dominant, partly offset by haven demand.',
  verified_utc:'2026-07-22T10:00:00Z',sources:[source],horizon:'Current session through policy guidance.',reassessment_gap:'',
  reassessment:{title:'Policy guidance',event_at:'2026-07-23T10:00:00Z',event_date:null,verified_utc:'2026-07-22T10:00:00Z',sources:[source],note:'Reassess whether guidance changes the funding mechanism.'}}
let fixture={schema:1,revision:'one',from:'2026-07-22',to:'2026-07-22',developments:[development('new','2026-07-22','2026-07-22T08:35:00Z'),development('unknown','2026-07-22'),development('old','2026-07-20')],
  assessments:[{id:'assessment',currency:'CHF',as_of_utc:'2026-07-22T10:00:00Z',saved_utc:'2026-07-22T10:01:00Z',provenance:'assessment',direction,gap:'',evidence_ids:['new','unknown'],background_ids:['old'],period_start:'2026-07-22',period_end:'2026-07-22',legacy:false}]}
function reply(url) {
  const route=new URL(url,'http://localhost');const from=route.searchParams.get('from'),to=route.searchParams.get('to'),currency=route.searchParams.get('currency')
  const selected=structuredClone(fixture)
  selected.developments=selected.developments.filter(d=>d.impacts.some(i=>i.currency===currency));selected.assessments=selected.assessments.filter(a=>a.currency===currency)
  return offline ? {ok:false,status:503} : {ok:true,json:async()=>malformed ? {} : route.searchParams.get('after_revision')===fixture.revision ? {schema:1,from,to,currency,revision:fixture.revision,unchanged:true} : {...selected,from,to,currency}}
}
globalThis.fetch=async(url,options={})=>{requests.push({url,options});return hold ? new Promise(resolve=>held.push({resolve,url,options})) : reply(url)}
const {createRoot}=await import('react-dom/client');const container=document.createElement('div');document.body.append(container);const root=createRoot(container)
const poll=async()=>{const [id,timer]=[...timers][0];timers.delete(id);await React.act(async()=>timer.fn())}
const click=async label=>React.act(async()=>{const button=[...container.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,label);button.click()})
try {
  const {ThesisDock}=await server.ssrLoadModule('./src/thesis/ThesisDock.tsx')
  const {validCurrencyResearch}=await server.ssrLoadModule('./src/thesis/research-model.ts')
  const {researchMarkdown}=await server.ssrLoadModule('./src/thesis/research-export.ts')
  assert.equal(validCurrencyResearch(fixture,fixture.from,fixture.to),true)
  for (const mutate of [x=>x.developments[0].sources[0].locator='javascript:alert(1)',x=>x.developments.push(x.developments[0]),
    x=>x.assessments[0].direction.intensity='extreme',x=>x.developments[0].published_on='2026-02-30',
    x=>x.assessments[0].direction.reassessment.sources[0].locator='javascript:bad']) {
    const bad=structuredClone(fixture);mutate(bad);assert.equal(validCurrencyResearch(bad,fixture.from,fixture.to),false)
  }
  localStorage.setItem('fyodor.thesis.across.v1','false');localStorage.setItem('fyodor.thesis.currency.v1','CHF');localStorage.setItem('fyodor.thesis.month.v1','2026-07');localStorage.setItem('fyodor.thesis.day.v1','22')
  await React.act(async()=>root.render(React.createElement(ThesisDock)))
  assert.equal(container.querySelectorAll('[data-thesis-currency]').length,1)
  assert.deepEqual([...container.querySelector('[aria-label="Thesis currency"]').querySelectorAll('button')].map(b=>b.textContent),['EUR','GBP','AUD','NZD','USD','CAD','CHF','JPY'])
  for (const label of ['Thesis pair','Thesis date range','Thesis from','Thesis to']) assert.equal(container.querySelector(`[aria-label="${label}"]`),null)
  assert.ok(!container.textContent.includes('Across All Currency'))
  const chf=()=>container.querySelector('[data-thesis-currency="CHF"]')
  assert.match(chf().textContent,/Slight weakening.*Last Assessed/s)
  assert.match(chf().textContent,/Active background.*Jul 20, 2026/s)
  assert.equal(chf().querySelectorAll('[data-thesis-development]').length,2,'Multiple same-day events have separate rows; background stays separate')
  assert.deepEqual([...chf().querySelectorAll('thead th')].map(t=>t.textContent),['Date','Time · Jakarta','Development','Fundamental implication','Effect on existing thesis','Source'])
  assert.match(chf().querySelector('[data-thesis-development="new"]').textContent,/3:35 PM/)
  assert.match(chf().querySelector('[data-thesis-development="unknown"]').textContent,/Hour unknown/)
  assert.match(chf().textContent,/Partly offsets earlier weakening pressure/)
  const beforeSwitch=requests.length
  await click('USD')
  assert.equal(chf(),null,'Other currencies are unmounted, not hidden')
  assert.equal(container.querySelector('[data-thesis-currency="USD"]').querySelector('table'),null,'Missing evidence stays visible without a forced verdict')
  assert.equal(requests.length,beforeSwitch+1,'Only the selected currency is requested')
  assert.equal(new URL(requests.at(-1).url,'http://localhost').searchParams.get('currency'),'USD')
  await click('CHF')
  assert.equal(localStorage.getItem('fyodor.thesis.currency.v1'),'CHF')
  const row=chf().querySelector('[data-thesis-development="new"]');await poll();assert.equal(chf().querySelector('[data-thesis-development="new"]'),row)
  assert.ok(requests.every(r=>r.url.startsWith('/storage-api/theses/research?')),'New research does not load legacy monthly blobs on normal polls')
  await click('Copy research prompt');assert.match(copied,/2026-07-22/);assert.match(copied,/no news-item quota/)
  assert.match(copied,/Research CHF from 2026-07-22/);assert.match(copied,/--scope CHF/);assert.ok(!copied.includes('Research USD, EUR'))
  const before=JSON.stringify(fixture),markdown=researchMarkdown({...fixture,from:'2026-07-20'},'Offline')
  assert.match(markdown,/Load error: Offline/);assert.match(markdown,/Active background/);assert.match(markdown,/Hour unknown/)
  assert.match(markdown,/Effect on existing thesis/);assert.match(markdown,/Verified facts old/)
  assert.equal(JSON.stringify(fixture),before,'Export does not mutate the ledger or source order')
  const untrusted=structuredClone(fixture);untrusted.developments[0].facts='<script>bad</script> | [unsafe](javascript:bad)'
  const escaped=researchMarkdown(untrusted);assert.ok(!escaped.includes('<script>'));assert.ok(escaped.includes('\\|'));assert.ok(escaped.includes('\\[unsafe'))
  const priorRowWork=globalThis.__thesisWork.rows
  fixture={...fixture,revision:'two',assessments:[{...fixture.assessments[0],id:'reassessed',as_of_utc:'2026-07-22T11:00:00Z',direction:{...direction,intensity:'moderate',verified_utc:'2026-07-22T11:00:00Z'}},...fixture.assessments]}
  await poll();assert.match(chf().textContent,/Moderate weakening/);assert.match(chf().textContent,/Assessment history · 2 recorded views/)
  assert.equal(globalThis.__thesisWork.rows,priorRowWork,'Assessment-only changes render zero unchanged development rows')
  assert.equal(chf().textContent.split(direction.reason).length-1,1,'Closed assessment history does not mount its bodies')
  const disclosure=[...chf().querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.startsWith('Assessment history'))
  await React.act(async()=>{disclosure.open=true;disclosure.dispatchEvent(new dom.Event('toggle'))})
  assert.ok(chf().textContent.split(direction.reason).length-1>1)
  await React.act(async()=>{disclosure.open=false;disclosure.dispatchEvent(new dom.Event('toggle'))})
  assert.equal(chf().textContent.split(direction.reason).length-1,1)
  offline=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/last loaded/);assert.match(chf().textContent,/Moderate weakening/)
  offline=false;malformed=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/Invalid Thesis research/)
  malformed=false;await poll()
  hold=true;const [id,timer]=[...timers][0];timers.delete(id);await React.act(async()=>{void timer.fn()})
  const end=container.querySelector('[aria-label="Thesis day"]')
  await React.act(async()=>{end.value='23';end.dispatchEvent(new dom.Event('change',{bubbles:true}))})
  assert.equal(held[0].options.signal.aborted,true);assert.equal(container.querySelector('[data-thesis-currency="CHF"]'),null,'Date changes clear the old response')
  hold=false;await React.act(async()=>{for (const h of held.splice(0).reverse())h.resolve(reply(h.url))})
  assert.match(chf().textContent,/Moderate weakening/)
  // A large all-currency payload still mounts only the selected currency's rows.
  const currencies=['EUR','GBP','AUD','NZD','USD','CAD','CHF','JPY']
  fixture={...fixture,revision:'large',developments:currencies.flatMap(currency=>Array.from({length:40},(_,i)=>({...development(currency+i,'2026-07-23'),impacts:[{currency,implication:currency+' only',thesis_effect:'Updated evidence.'}]})))}
  await poll()
  assert.equal(container.querySelectorAll('[data-thesis-development]').length,20,'A large date mounts at most one 20-row page')
  assert.match(container.querySelector('.thesis-pagination').textContent,/1–20 of 40/)
  await click('Next developments');assert.match(container.querySelector('.thesis-pagination').textContent,/21–40 of 40/)
  assert.equal(container.querySelectorAll('[data-thesis-development]').length,20)
  const fullExport=researchMarkdown({...fixture,from:'2026-07-23',to:'2026-07-23'},null,'CHF');assert.match(fullExport,/Verified facts CHF0/);assert.match(fullExport,/Verified facts CHF39/)
  const stableRow=container.querySelector('[data-thesis-development]');await poll();assert.equal(container.querySelector('[data-thesis-development]'),stableRow)
  const requestCount=requests.length
  await click('EUR');assert.equal(container.querySelectorAll('[data-thesis-development]').length,20)
  assert.equal(container.querySelectorAll('[data-thesis-currency]').length,1)
  assert.equal(requests.length,requestCount+1)
  // Closed row histories can contain hundreds of versions without mounting any.
  const versions=Array.from({length:100},(_,i)=>({...development('v'+i,'2026-07-23'),facts:'Hidden version evidence '+i}))
  fixture={...fixture,revision:'histories',developments:fixture.developments.map((d,i)=>i===0 ? {...d,versions} : d)}
  await poll();assert.ok(!container.textContent.includes('Hidden version evidence'))
  const history=[...container.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.startsWith('Development history'))
  await React.act(async()=>{history.open=true;history.dispatchEvent(new dom.Event('toggle'))})
  assert.match(container.textContent,/Hidden version evidence 99/)
  await React.act(async()=>{history.open=false;history.dispatchEvent(new dom.Event('toggle'))})
  assert.ok(!container.textContent.includes('Hidden version evidence'))
  const scrollWork=globalThis.__thesisWork.rows,scrollRequests=requests.length
  await React.act(async()=>container.querySelector('.thesis-scroll').dispatchEvent(new dom.Event('scroll')))
  assert.equal(globalThis.__thesisWork.rows,scrollWork);assert.equal(requests.length,scrollRequests,'Scrolling causes no fetch/render work')
  const scoped=researchMarkdown(fixture,null,'EUR')
  assert.match(scoped,/## EUR/);assert.ok(!scoped.includes('## CHF'));assert.ok(!scoped.includes('Verified facts CHF'))
  await React.act(async()=>root.render(null))
  await React.act(async()=>root.render(React.createElement(ThesisDock)))
  assert.equal(container.querySelector('[data-thesis-currency]').getAttribute('data-thesis-currency'),'EUR','Selected currency survives remount')
  console.log('✓ Thesis research: single currency, bounded rendered row counts, intraday rows, offsets, active background, clocks, immutable export, source safety, history, polling and stale-reply cleanup')
} finally {
  await React.act(async()=>root.unmount());assert.equal(timers.size,0)
  await server.close();await dom.happyDOM.close()
  for (const [k,d] of previous) {if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}
}
