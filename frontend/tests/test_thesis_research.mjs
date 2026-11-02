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
  const {validCurrencyResearch,researchFacts,researchTimeline}=await server.ssrLoadModule('./src/thesis/research-model.ts')
  const {researchMarkdown}=await server.ssrLoadModule('./src/thesis/research-export.ts')
  assert.equal(validCurrencyResearch(fixture,fixture.from,fixture.to),true)
  const frozen={...development('spacing','2026-07-20'),facts:'Officialreleasecontainsjoinedwords.'}
  const spaced={...frozen,id:'spacing-v2',facts:'Official release contains joined words.',saved_utc:'2026-07-22T11:00:00Z',revision_note:'Formatting only: restore word spacing.'}
  assert.equal(researchFacts({...frozen,versions:[frozen,spaced]}),spaced.facts,'Recorded spacing repairs improve frozen display without replacing the evidence vintage')
  assert.equal(researchFacts({...frozen,versions:[{...spaced,facts:'Official release contains different facts.'}]}),frozen.facts,'Semantic changes never replace frozen evidence')
  assert.equal(researchFacts({...frozen,versions:[{...spaced,revision_note:'Changed interpretation'}]}),frozen.facts)
  for (const mutate of [x=>x.developments[0].sources[0].locator='javascript:alert(1)',x=>x.developments.push(x.developments[0]),
    x=>x.assessments[0].direction.intensity='extreme',x=>x.developments[0].published_on='2026-02-30',
    x=>x.assessments[0].direction.reassessment.sources[0].locator='javascript:bad',
    x=>x.assessments[0].direction.review_status='provisional',
    x=>Object.assign(x.assessments[0].direction,{review_status:'complete',stage_note:' '})]) {
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
  const provisional={...direction,review_status:'provisional',stage_note:'Statement only; conference Q&A pending.'}
  fixture={...fixture,revision:'provisional',assessments:fixture.assessments.map(a=>a.direction ? {...a,direction:provisional} : a)}
  await poll()
  const currentAssessment=()=>chf().querySelector('[aria-label="CHF current assessment"]')
  assert.equal(chf().querySelector('[aria-label="CHF assessment details"]'),null)
  assert.match(currentAssessment().textContent,/Provisional: Statement only; conference Q&A pending/)
  assert.match(currentAssessment().textContent,/Funding pressure remains dominant/)
  assert.match(currentAssessment().textContent,/Current session through policy guidance/)
  assert.ok(currentAssessment().querySelector('a[aria-label="Official source"]'),'Sources retain full accessible labels')
  assert.match(researchMarkdown(fixture,null,'CHF'),/Provisional: Statement only; conference Q&amp;A pending/)
  const ledger=()=>chf().querySelector('table[aria-label="CHF evidence timeline"]')
  assert.equal(ledger().querySelectorAll('[data-thesis-development]').length,3,'Recent developments and active background share one timeline')
  assert.deepEqual([...ledger().querySelectorAll('thead th')].map(t=>t.textContent),['Time · Jakarta','Evidence and interpretation'])
  assert.deepEqual([...ledger().querySelectorAll('[data-thesis-development]')].map(r=>r.dataset.thesisDevelopment),['new','unknown','old'])
  assert.match(ledger().querySelector('[data-thesis-development="old"]').textContent,/Jul 20, 2026.*Active background/s)
  assert.match(chf().querySelector('[data-thesis-development="new"]').textContent,/3:35 PM/)
  assert.match(chf().querySelector('[data-thesis-development="unknown"]').textContent,/Hour unknown/)
  assert.match(ledger().textContent,/Supports haven demand.*Partly offsets earlier weakening pressure/s)
  assert.equal(chf().querySelectorAll('.thesis-next-anchor').length,1)
  assert.match(chf().querySelector('[aria-label="CHF next anchor"]').textContent,/Policy guidance.*Reassess whether guidance changes/s)
  assert.ok(!chf().textContent.includes('Verified Jul'))
  assert.ok(!chf().textContent.includes('Recorded Jul'))
  assert.ok(!chf().textContent.includes('Details & history'))
  const projected=researchTimeline({...fixture,developments:[...fixture.developments,{...fixture.developments[0],id:'duplicate'}]},'CHF')
  assert.equal(projected.filter(r=>r.kind==='development' && r.item.key==='new').length,1,'Stable development keys appear once')
  assert.equal(JSON.stringify(fixture.developments).includes('duplicate'),false,'Projection does not mutate evidence')
  const clocks={...fixture,developments:[development('utc','2026-07-22','2026-07-22T08:35:00Z'),development('offset','2026-07-22','2026-07-22T15:34:00+07:00')]}
  assert.deepEqual(researchTimeline(clocks,'CHF').map(r=>r.item.id),['utc','offset'],'Intraday sorting compares instants across source offsets')
  const longFacts='Verified facts new. '+('Additional sourced context with original qualifications. '.repeat(12))+'Final qualification remains available.'
  fixture={...fixture,revision:'long-description',developments:fixture.developments.map(d=>d.id==='new' ? {...d,facts:longFacts} : d)}
  await poll()
  const longRow=ledger().querySelector('[data-thesis-development="new"]')
  assert.equal(longRow.querySelector('.research-description').textContent,longFacts,'Full descriptions and original qualifications are visible directly in the table')
  assert.ok(![...chf().querySelectorAll('summary')].some(s=>['Full description','Effect on thesis'].includes(s.textContent)),'Reading research needs no text expansion')
  const savedFixture=fixture
  const additional={...direction.reassessment,title:'Later scheduled event',event_at:'2026-07-24T10:00:00Z'}
  fixture={...fixture,revision:'gap',assessments:fixture.assessments.map(a=>({...a,gap:'Decisive conference remarks could not be retrieved.',checkpoints:[additional],
    direction:{...direction,review_status:'complete',stage_note:'Completed source review.',reassessment:null,reassessment_gap:'The pending guidance stage is unresolved.'}}))}
  await poll()
  assert.match(currentAssessment().textContent,/Decisive conference remarks could not be retrieved/,'Actual source gaps remain visible')
  assert.ok(!currentAssessment().textContent.includes('Completed source review.'),'Complete-stage administrative prose is absent')
  assert.match(chf().querySelector('[aria-label="CHF next anchor"]').textContent,/pending guidance stage is unresolved/)
  assert.ok(!chf().textContent.includes('Later scheduled event'),'An unresolved primary anchor is never replaced by a later saved checkpoint')
  assert.match(researchMarkdown(fixture,null,'CHF'),/Later scheduled event/,'Other saved checkpoints remain in the export')
  fixture={...fixture,revision:'date-only',assessments:fixture.assessments.map(a=>({...a,direction:{...direction,reassessment:{...direction.reassessment,event_at:null,event_date:'2026-07-23'}}}))}
  await poll()
  assert.match(chf().querySelector('[aria-label="CHF next anchor"]').textContent,/Jul 23, 2026 · Hour unknown/,'Date-only anchors do not acquire an invented hour')
  const evidenceAnchor={title:'Earlier policy decision',event_at:null,event_date:'2026-07-20',note:'The original dated foundation remains active.',sources:[source]}
  fixture={...savedFixture,revision:'anchor-only',developments:[],assessments:[
    {...savedFixture.assessments[0],direction:{...direction,evidence_anchor:evidenceAnchor}},
    {...savedFixture.assessments[0],id:'earlier-view',as_of_utc:'2026-07-22T09:00:00Z',direction:{...direction,intensity:'moderate',verified_utc:'2026-07-22T09:00:00Z'}}]}
  await poll()
  assert.equal(chf().querySelectorAll('table').length,1,'Fallback evidence and prior assessments still use one table')
  assert.match(ledger().textContent,/Jul 20, 2026.*Hour unknown.*Evidence event · Earlier policy decision/s)
  assert.equal(ledger().querySelectorAll('tbody > tr').length,2)
  assert.match(researchMarkdown(fixture,null,'CHF'),/Evidence event · Earlier policy decision/)
  fixture={...savedFixture,revision:'restored'};await poll()
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
  const before=JSON.stringify(fixture),markdown=researchMarkdown(fixture,'Offline')
  assert.match(markdown,/Load error: Offline/);assert.match(markdown,/Active background/);assert.match(markdown,/Hour unknown/)
  assert.match(markdown,/Evidence and interpretation/);assert.match(markdown,/Verified facts old/)
  assert.equal(JSON.stringify(fixture),before,'Export does not mutate the ledger or source order')
  const untrusted=structuredClone(fixture);untrusted.developments[0].facts='<script>bad</script> | [unsafe](javascript:bad)'
  const escaped=researchMarkdown(untrusted);assert.ok(!escaped.includes('<script>'));assert.ok(escaped.includes('\\|'));assert.ok(escaped.includes('\\[unsafe'))
  const priorRowWork=globalThis.__thesisWork.rows
  fixture={...fixture,revision:'two',assessments:[{...fixture.assessments[0],id:'reassessed',as_of_utc:'2026-07-22T11:00:00Z',direction:{...direction,intensity:'moderate',verified_utc:'2026-07-22T11:00:00Z'}},...fixture.assessments]}
  await poll();assert.match(chf().textContent,/Moderate weakening/)
  assert.equal(globalThis.__thesisWork.rows,priorRowWork,'Assessment-only changes render zero unchanged development rows')
  assert.equal(chf().querySelectorAll('[data-thesis-assessment]').length,1,'Earlier changed views are visible inline without a history disclosure')
  const previousView=chf().querySelector('[data-thesis-assessment="assessment"]')
  assert.match(previousView.textContent,/5:00 PM.*Assessment · Slight weakening/s,'The prior view uses its assessment clock')
  assert.equal(chf().querySelectorAll('details').length,0,'Routine audit/version disclosures are absent')
  offline=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/last loaded/);assert.match(chf().textContent,/Moderate weakening/)
  offline=false;malformed=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/Invalid Thesis research/)
  malformed=false;await poll()
  hold=true;const [id,timer]=[...timers][0];timers.delete(id);await React.act(async()=>{void timer.fn()})
  await React.act(async()=>container.querySelector('[aria-label="Next date"]').click())
  assert.equal(held[0].options.signal.aborted,true);assert.equal(container.querySelector('[data-thesis-currency="CHF"]'),null,'Date changes clear the old response')
  hold=false;await React.act(async()=>{for (const h of held.splice(0).reverse())h.resolve(reply(h.url))})
  assert.match(chf().textContent,/Moderate weakening/)
  // A large all-currency payload still mounts only the selected currency's rows.
  const currencies=['EUR','GBP','AUD','NZD','USD','CAD','CHF','JPY']
  fixture={...fixture,revision:'large',developments:currencies.flatMap(currency=>Array.from({length:40},(_,i)=>({...development(currency+i,'2026-07-23'),impacts:[{currency,implication:currency+' only',thesis_effect:'Updated evidence.'}]})))}
  await poll()
  assert.equal(container.querySelectorAll('[data-thesis-development]').length,20,'A large date mounts at most one 20-row page')
  assert.match(container.querySelector('.thesis-pagination').textContent,/1–20 of 40/)
  await click('Next evidence');assert.match(container.querySelector('.thesis-pagination').textContent,/21–40 of 40/)
  assert.equal(container.querySelectorAll('[data-thesis-development]').length,20)
  const fullExport=researchMarkdown({...fixture,from:'2026-07-23',to:'2026-07-23'},null,'CHF');assert.match(fullExport,/Verified facts CHF0/);assert.match(fullExport,/Verified facts CHF39/)
  const stableRow=container.querySelector('[data-thesis-development]');await poll();assert.equal(container.querySelector('[data-thesis-development]'),stableRow)
  const requestCount=requests.length
  await click('EUR');assert.equal(container.querySelectorAll('[data-thesis-development]').length,20)
  assert.equal(container.querySelectorAll('[data-thesis-currency]').length,1)
  assert.equal(requests.length,requestCount+1)
  // Hundreds of immutable versions remain exportable without mounting audit bodies.
  const versions=Array.from({length:100},(_,i)=>({...development('v'+i,'2026-07-23'),facts:'Hidden version evidence '+i}))
  fixture={...fixture,revision:'histories',developments:fixture.developments.map((d,i)=>i===0 ? {...d,versions} : d)}
  await poll();assert.ok(!container.textContent.includes('Hidden version evidence'))
  assert.equal(container.querySelector('.research-detail-toggle'),null)
  const historyExport=researchMarkdown(fixture,null,'EUR')
  assert.match(historyExport,/Hidden version evidence 99/)
  assert.match(historyExport,/verified .*recorded /)
  const scrollWork=globalThis.__thesisWork.rows,scrollRequests=requests.length
  await React.act(async()=>container.querySelector('.thesis-scroll').dispatchEvent(new dom.Event('scroll')))
  assert.equal(globalThis.__thesisWork.rows,scrollWork);assert.equal(requests.length,scrollRequests,'Scrolling causes no fetch/render work')
  const scoped=researchMarkdown(fixture,null,'EUR')
  assert.match(scoped,/## EUR/);assert.ok(!scoped.includes('## CHF'));assert.ok(!scoped.includes('Verified facts CHF'))
  const priorBackground=Array.from({length:45},(_,i)=>({...development('background'+i,'2026-07-20'),impacts:[{currency:'EUR',implication:'Earlier active evidence.',thesis_effect:'Retained foundation.'}]}))
  fixture={...fixture,revision:'large-background',developments:[...fixture.developments,...priorBackground],assessments:[{...fixture.assessments[0],currency:'EUR',background_ids:priorBackground.map(d=>d.id)}]}
  await poll()
  const eur=container.querySelector('[data-thesis-currency="EUR"]')
  const eurTimeline=eur.querySelector('[aria-label="EUR evidence timeline"]')
  assert.equal(eurTimeline.querySelectorAll('tbody > tr').length,20,'One shared page bounds recent evidence, background and prior views')
  assert.equal(eur.querySelectorAll('table').length,1,'Background does not create a second table')
  assert.match(eur.querySelector('.thesis-pagination').textContent,/1–20 of 85/)
  await click('Next evidence');await click('Next evidence')
  assert.match(eur.querySelector('.thesis-pagination').textContent,/41–60 of 85/)
  assert.match(eurTimeline.textContent,/Active background/,'Older active evidence is reached in the same timeline')
  const backgroundExport=researchMarkdown(fixture,null,'EUR')
  assert.match(backgroundExport,/Verified facts background44/,'Export retains off-page background entries')
  const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10)
  assert.equal(container.querySelector('[aria-label="Thesis day"]'),null,'The old separate day dropdown is replaced by the shared wheel')
  assert.equal(container.querySelectorAll('[aria-label="Thesis date selector"] [aria-pressed]').length,5)
  const changeControl=async(label,value)=>React.act(async()=>{
    const element=container.querySelector(`[aria-label="${label}"]`)
    if(element.tagName==='INPUT') element[Object.keys(element).find(key=>key.startsWith('__reactProps$'))].onChange({target:{value}})
    else { element.value=value;element.dispatchEvent(new dom.Event('change',{bubbles:true})) }
  })
  const selectedDate=()=>container.querySelector('[aria-label="Thesis date selector"] [aria-current="date"]').getAttribute('aria-label')
  await changeControl('Thesis year','2028')
  await changeControl('Thesis month','1')
  for(let i=0;i<8;i++) await React.act(async()=>container.querySelector('[aria-label="Next date"]').click())
  assert.equal(selectedDate(),'2028-01-31')
  await changeControl('Thesis month','2')
  assert.equal(selectedDate(),'2028-02-29','Month changes clamp to the leap-year month end')
  await React.act(async()=>container.querySelector('[aria-label="Next date"]').click())
  assert.equal(selectedDate(),'2028-03-01','Wheel crosses month boundaries')
  assert.match(container.textContent,/Future dates stay unassessed/,'Future navigation never carries a saved verdict forward')
  const futureExport=researchMarkdown({...fixture,from:'2028-03-01',to:'2028-03-01'},null,'EUR')
  assert.match(futureExport,/Future dates stay unassessed/)
  assert.ok(!futureExport.split('### Assessment history')[0].includes('Last Assessed:'),'Future export does not promote an older assessment to that day')
  await React.act(async()=>container.querySelector('[aria-label="2028-02-28"]').click())
  assert.equal(selectedDate(),'2028-02-28','Visible wheel dates can be selected directly')
  await React.act(async()=>root.render(null))
  await React.act(async()=>root.render(React.createElement(ThesisDock)))
  assert.equal(selectedDate(),'2028-02-28','Year, month and day selections survive remount, including future dates')
  await click('Today')
  assert.equal(new URL(requests.at(-1).url,'http://localhost').searchParams.get('from'),today,'Today fetches the current Jakarta date')
  await click('Copy research prompt');assert.ok(copied.includes(`Research EUR from ${today} through ${today}`))
  await React.act(async()=>root.render(null))
  await React.act(async()=>root.render(React.createElement(ThesisDock)))
  assert.equal(selectedDate(),today,'Today selection survives remount')
  assert.equal(container.querySelector('[data-thesis-currency]').getAttribute('data-thesis-currency'),'EUR','Selected currency survives remount')
  console.log('✓ Thesis research: single currency, bounded rendered row counts, intraday rows, offsets, combined background, clocks, immutable export, source safety, inline prior views, polling and stale-reply cleanup')
} finally {
  await React.act(async()=>root.unmount());assert.equal(timers.size,0)
  await server.close();await dom.happyDOM.close()
  for (const [k,d] of previous) {if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}
}
