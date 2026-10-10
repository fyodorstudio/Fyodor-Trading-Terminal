import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const mount = (Component, props) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, render: (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}
const choose = (element, value) => React.act(async () => {
  assert.ok(element); element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true }))
})
const click = (element) => React.act(async () => { assert.ok(element); element.click() })
const input = (element, value) => React.act(async () => {
  assert.ok(element)
  Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(element, String(value))
  element.dispatchEvent(new dom.Event('input', { bubbles: true })); element.dispatchEvent(new dom.Event('change', { bubbles: true }))
})

try {
  const {assessIsmMonthlyContext, ismSeriesIds, supportsIsmScore} = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/ISM/assessment/ism-monthly-context.ts')
  const {resolveIsmV3, assessIsmScoreV3} = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/ISM/assessment/ism-score-v3.ts')
  const {IsmScoreV3} = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/ui/IsmScoreV3.tsx')
  const {calculateIsmAnalysis} = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/ISM/runtime/ism-analysis.ts')
  const {assessIsmManufacturing, ismManufacturingSeriesIds} = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/ISM/sectors/manufacturing/ism-manufacturing-score.ts')
  const {ismServicesSeriesIds, assessIsmServicesScore} = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/ISM/sectors/services/ism-services-score.ts')
  const {expectedIsmPublication} = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/ISM/assessment/ism-publication-check.ts')
  const {groupInspectorReleases, defaultInspectorPreferences, inspectorStorageKey, readInspectorPreferences} = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const {InspectorPanel} = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const {groupIsmEpisodes, ismSourceRelease} = await server.ssrLoadModule('./src/inspector/episodes/ism-episodes.ts')
  const {useInspector} = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const {buildInspectorMarkers, filterInspectorReleases} = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const {scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel} = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const {ScatterPlotDock} = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const {ismServicesSignalSettings, ismManufacturingSignalSettings} = await server.ssrLoadModule('./src/scoring-system/shared/core/signal-magnitude-settings.ts')
  const {exportWorkspace, restoreWorkspace, parseWorkspaceSnapshot} = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const raw=v=>v===null?null:String(Math.round(v*1e6))
  function rows(sector, year, month, values, day=sector==='services'?5:3) {
    const ids=sector==='services'?ismServicesSeriesIds:ismManufacturingSeriesIds
    const at=Date.UTC(year,month+1,day,14), period=Date.UTC(year,month,1)/1000
    return ids.map((id,i)=>({value_id:period+':'+id,event_id:id,name:id,event_code:id,currency:'USD',country_code:'US',country_name:'United States',
      server_time_seconds:at/1000+10800,chart_time_seconds:at/1000+10800,release_at:at,period_seconds:period,revision:0,time_mode:0,importance:'high',impact:'none',availability:'observed',
      unit:0,multiplier:0,digits:1,actual:values[i],previous:55,forecast:999,revised_previous:null,actual_raw_scaled_1e6:raw(values[i]),previous_raw_scaled_1e6:raw(55)}))
  }
  const historic=Array.from({length:132},(_,i)=>[
    ...rows('services',2015+Math.floor(i/12),i%12,[55,51+i%5,51+(i+1)%5,51+(i+2)%5,51+(i+3)%5]),
    ...rows('manufacturing',2015+Math.floor(i/12),i%12,[55,51+i%5,51+(i+1)%5,51+(i+2)%5])]).flat()
  // Reference Apr/May/Jun 2026, with the official May/June/July dates.
  const dates={services:[5,3,6],manufacturing:[1,1,1]}
  const history=[...historic,...[3,4,5].flatMap((m,i)=>[
    ...rows('services',2026,m,[55,55,55,55,55],dates.services[i]),
    ...rows('manufacturing',2026,m,[55,55,55,55],dates.manufacturing[i])])]
  const serviceRows=rows('services',2026,6,[55,53,53,53,53]), manufacturingRows=rows('manufacturing',2026,6,[55,57,57,57])
  const selected=groupInspectorReleases(serviceRows)[0], manufacturing=groupInspectorReleases(manufacturingRows)[0]
  const events=[...history,...manufacturingRows,...serviceRows]
  const combined=assessIsmMonthlyContext(selected,events)
  assert.equal(combined.contextId,'ISM/2026-07');assert.equal(combined.services.weight,70);assert.equal(combined.manufacturing.weight,30)
  assert.equal(combined.services.release.id,selected.id);assert.equal(combined.manufacturing.release.id,manufacturing.id)
  assert.equal(combined.sectorConflict,true);assert.notEqual(combined.strength,'strong')
  assert.equal(combined.total,combined.readings.reduce((sum,r)=>sum+(r.points??0)*r.weight,0)/10000)
  const resolved=resolveIsmV3(combined)
  assert.equal(resolved.label,combined.label);assert.equal(resolved.winner,'services')
  assert.ok(Math.abs(resolved.servicesContribution)>Math.abs(resolved.manufacturingContribution))
  assert.match(resolved.dominance,/Services wins/)
  assert.ok(Math.abs(resolved.total-resolved.servicesContribution-resolved.manufacturingContribution)<1e-12)
  assert.equal(assessIsmScoreV3(selected,events).label,combined.label)
  assert.ok(combined.explanation.includes('employment'));assert.equal(new Set(combined.readings.map(r=>r.group)).size,3)
  const hotServices=groupInspectorReleases(rows('services',2026,6,[55,57,57,57,57]))[0]
  const agreement=assessIsmMonthlyContext(hotServices,[...history,...manufacturingRows,...hotServices.events])
  assert.equal(agreement.strength,'strong');assert.equal(agreement.label,'EURUSD Short')
  const demandLabor=groupInspectorReleases(rows('services',2026,6,[55,49,59,59,59]))[0]
  const conflicted=assessIsmMonthlyContext(demandLabor,[...history,...manufacturingRows,...demandLabor.events])
  assert.equal(conflicted.laborConflict,true);assert.notEqual(conflicted.strength,'strong')
  assert.match(conflicted.strengthReason,/Demand and employment/)
  const early=assessIsmMonthlyContext(manufacturing,events)
  assert.equal(early.services.release,null);assert.equal(early.services.status,'pending');assert.equal(early.strength,'weak')
  assert.equal(early.label,'EURUSD Short');assert.equal(early.contextId,combined.contextId)
  assert.equal(combined.previous.label,early.label)
  const grouped=groupIsmEpisodes([selected,manufacturing])
  assert.equal(grouped.length,1);assert.equal(grouped[0].id,combined.contextId)
  assert.equal(grouped[0].releaseAt,manufacturing.releaseAt);assert.equal(grouped[0].chartTime,manufacturing.chartTime)
  assert.deepEqual(grouped[0].ismPublications,[manufacturing,selected]);assert.equal(grouped[0].events.length,9)
  assert.equal(groupIsmEpisodes([manufacturing])[0].id,grouped[0].id,'The monthly marker identity survives the Services update')
  assert.equal(ismSourceRelease(grouped[0],null,manufacturing.releaseAt).id,manufacturing.id)
  assert.equal(ismSourceRelease(grouped[0],null,selected.releaseAt).id,selected.id)
  const markerBars=[manufacturing.chartTime,selected.chartTime].map(time=>({time,open:1,high:2,low:0.5,close:1.5}))
  assert.equal(buildInspectorMarkers(grouped,defaultInspectorPreferences(),markerBars,'H1').length,1)
  const serviceRange={from:selected.releaseAt,to:selected.releaseAt+86400000}
  assert.equal(filterInspectorReleases(grouped,{...defaultInspectorPreferences(),families:['ism-services']},serviceRange).length,1,
    'A Services-only filter/range retains the shared monthly entry')
  assert.equal(filterInspectorReleases(grouped,{...defaultInspectorPreferences(),families:['jobs']},serviceRange).length,0)
  for(const patch of [{timingUncertain:true},{chartTime:null},{events:selected.events.map(e=>({...e,period_seconds:0}))},
    {events:selected.events.map((e,i)=>i?e:{...e,period_seconds:Date.UTC(2026,5,1)/1000})}]) {
    assert.equal(groupIsmEpisodes([manufacturing,{...selected,...patch}]).length,2)
  }
  assert.equal(groupIsmEpisodes([manufacturing,selected,{...selected,id:'duplicate'}]).length,3)
  assert.equal(groupIsmEpisodes([manufacturing,{...selected,releaseAt:manufacturing.releaseAt-1000,
    events:selected.events.map(e=>({...e,release_at:manufacturing.releaseAt-1000}))}]).length,2)
  assert.deepEqual(assessIsmMonthlyContext(ismSourceRelease(grouped[0],manufacturing.id),events),early)
  const future=rows('services',2026,7,[99,99,99,99,99],3)
  assert.deepEqual(assessIsmMonthlyContext(selected,[...events,...future]),combined)
  assert.deepEqual(assessIsmMonthlyContext(manufacturing,events.filter(e=>e.release_at<=manufacturing.releaseAt)),early)
  assert.deepEqual(assessIsmMonthlyContext(selected,[...events,...events]),combined)
  const noise=e=>({...e,forecast:-1e9,forecast_raw_scaled_1e6:'bad'})
  const withoutForecastFields=value=>JSON.parse(JSON.stringify(value,(key,item)=>key==='forecast'||key==='forecast_raw_scaled_1e6'?undefined:item))
  assert.deepEqual(withoutForecastFields(assessIsmMonthlyContext({...selected,events:selected.events.map(noise)},events.map(noise))),withoutForecastFields(combined))
  const oldOnly=events.filter(e=>e.period_seconds!==Date.UTC(2026,6,1)/1000||ismServicesSeriesIds.includes(e.event_id))
  assert.equal(assessIsmMonthlyContext(selected,oldOnly).manufacturing.release,null,'Do not carry a different reference month into this group')
  assert.equal(assessIsmMonthlyContext({...selected,timingUncertain:true},events).label,'Uncomputed')
  assert.equal(assessIsmMonthlyContext(null,events),null)
  for(const patch of [{familyId:'gdp'},{currency:'EUR'},{country:'EU'}])assert.equal(supportsIsmScore({...selected,...patch}),false)
  const mismatch={...selected,events:selected.events.map((e,i)=>i?e:{...e,period_seconds:Date.UTC(2026,5,1)/1000})}
  assert.equal(assessIsmMonthlyContext(mismatch,events).label,'Uncomputed')
  const revised=manufacturingRows.map(e=>e.event_id==='840040006'?{...e,revised_previous:58,revised_previous_raw_scaled_1e6:raw(58)}:e)
  assert.equal(assessIsmManufacturing(groupInspectorReleases(revised)[0],history).readings[0].value,1)
  const drop=history.filter(e=>e.event_id!=='840040006'||e.period_seconds!==Date.UTC(2026,4,1)/1000)
  assert.equal(assessIsmManufacturing(manufacturing,drop).total,null)
  for(const patch of [{unit:1},{multiplier:1},{actual:101,actual_raw_scaled_1e6:raw(101)},{actual:null},{actual_raw_scaled_1e6:'bad'},
    {revised_previous:58,revised_previous_raw_scaled_1e6:'bad'},{availability:'not-returned-by-latest-query'}]) {
    const modified={...manufacturing,events:manufacturing.events.map(e=>e.event_id==='840040006'?{...e,...patch}:e)}
    assert.equal(assessIsmManufacturing(modified,history).total,null)
  }
  const lost=groupInspectorReleases(rows('manufacturing',2026,6,[49,49,49,49]))[0]
  const contractionHistory=history.map(e=>({...e,actual:45,actual_raw_scaled_1e6:raw(45)}))
  assert.deepEqual(assessIsmManufacturing(lost,contractionHistory).readings.map(r=>r.value),[-1,-1,-1])
  const manual={services:Object.fromEntries(['orders','activity','employment','prices'].map(id=>[id,[1,2,3]])),manufacturing:Object.fromEntries(['orders','employment','prices'].map(id=>[id,[1,2,3]]))}
  const neutralService=groupInspectorReleases(rows('services',2026,6,[55,55,55,55,55]))[0]
  const cancelMfg=rows('manufacturing',2026,6,[55,54.5,54.5,55.5])
  const canceled=assessIsmMonthlyContext(neutralService,[...history,...cancelMfg,...neutralService.events],manual)
  assert.equal(canceled.total,0);assert.equal(canceled.tieBreak.id,'manufacturing:orders');assert.equal(canceled.label,'EURUSD Short');assert.equal(canceled.strength,'weak')
  assert.equal(resolveIsmV3(canceled).winner,'priority');assert.match(resolveIsmV3(canceled).dominance,/cancel/)
  const allZero=assessIsmMonthlyContext(neutralService,[...history,...rows('manufacturing',2026,6,[55,55,55,55]),...neutralService.events])
  assert.equal(allZero.label,'Uncomputed')
  assert.equal(resolveIsmV3(allZero).winner,null)
  const uncalibrated=groupInspectorReleases(rows('manufacturing',2015,4,[55,57,57,57]))[0]
  assert.equal(assessIsmMonthlyContext(uncalibrated,historic,manual).label,'Uncomputed')
  // Early broker dates cannot leak an officially later publication into context.
  const badDate=groupInspectorReleases(rows('services',2026,2,[55,57,57,57,57],3))[0]
  const flagged=assessIsmMonthlyContext(badDate,[...historic,...rows('manufacturing',2026,0,[55,55,55,55],2),...rows('manufacturing',2026,1,[55,55,55,55],2),...badDate.events,...rows('manufacturing',2026,2,[55,57,57,57],1)])
  assert.equal(flagged.services.status,'excluded');assert.match(flagged.services.issue,/2026-04-06/);assert.equal(flagged.strength,'weak')
  assert.equal(flagged.services.assessment,null)
  assert.equal(expectedIsmPublication(Date.UTC(2026,0,7),'ism-services'),Date.UTC(2026,0,7,15))
  assert.equal(expectedIsmPublication(Date.UTC(2026,7,5),'ism-services'),Date.UTC(2026,7,5,14))
  assert.equal(expectedIsmPublication(Date.UTC(2025,7,5),'ism-services'),null)
  const weekend=groupInspectorReleases(rows('services',2025,8,[55,57,57,57,57],5))[0]
  assert.match(assessIsmMonthlyContext(weekend,historic).services.issue,/weekend/)
  const invalidLatest=manufacturingRows.map(e=>({...e,value_id:e.value_id+':new',release_at:e.release_at+60000,server_time_seconds:e.server_time_seconds+60,chart_time_seconds:e.chart_time_seconds+60,actual:null,actual_raw_scaled_1e6:null}))
  assert.equal(assessIsmMonthlyContext(selected,[...events,...invalidLatest]).manufacturing.status,'unavailable','Invalid latest data must not silently fall back to an older reading')
  console.log('✓ ISM monthly identity, strict as-of updates, same-month selection, earlier history, zero/tie/conflict rules, index/revision gates and timing exclusions')

  const binding=scoringSignalBinding('ism-manufacturing'), signalHistory=prepareScoringSignalHistory(events,Date.UTC(2026,9,6),binding)
  const standalone=assessIsmManufacturing(manufacturing,events)
  for(const score of standalone.readings)for(const key of ['value','points','limits','sampleCount','inputs','reason']) {
    assert.deepEqual(scoringSignalModel(signalHistory,binding,score.id,manufacturing.id).inspection.signal[key],score[key])
    assert.deepEqual(combined.manufacturing.assessment.readings.find(r=>r.id===score.id)[key],score[key])
  }
  assert.deepEqual(combined.services.assessment.readings,assessIsmServicesScore(selected,events).readings)
  const props={release:selected,events,now:selected.releaseAt}
  const app=mount(IsmScoreV3,props);await app.render()
  assert.equal(app.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
  assert.equal(app.container.querySelectorAll('[data-ism-signal]').length,7)
  assert.equal(app.container.querySelector('[aria-label="How this scorer works"]'),null)
  assert.equal(app.container.querySelector('[aria-label="What drove the result"]').closest('details'),null)
  assert.equal(app.container.querySelectorAll('table').length,1)
  await app.render({release:grouped[0],events,now:manufacturing.releaseAt})
  assert.equal(app.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,early.label)
  assert.match(app.container.querySelector('[aria-label="ISM services context"]').textContent,/Pending/)
  assert.equal(app.container.querySelectorAll('[data-ism-signal]').length,3,'Later Services inputs cannot enter the earlier snapshot')
  const manufacturingSnapshot=app.container.querySelector('[aria-label="ISM manufacturing context"]').textContent
  await app.render({release:grouped[0],events,now:selected.releaseAt})
  assert.equal(app.container.querySelector('[aria-label="ISM manufacturing context"]').textContent,manufacturingSnapshot,
    'Publishing Services must preserve every detail of the Manufacturing snapshot')
  assert.equal(app.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
  assert.equal(app.container.querySelectorAll('[data-ism-signal]').length,7)
  await app.render({release:manufacturing,events});assert.match(app.container.querySelector('[aria-label="ISM services context"]').textContent,/Pending/)
  await app.render({release:{...manufacturing,timingUncertain:true},events})
  assert.equal(app.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,'Uncomputed')
  await app.render({release:{...manufacturing,releaseAt:null,timingUncertain:true},events})
  assert.equal(app.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,'Uncomputed')
  await app.render(props)
  const v3=mount(IsmScoreV3,{release:grouped[0],events,now:selected.releaseAt});await v3.render()
  assert.equal(v3.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
  assert.equal(v3.container.querySelectorAll('.inspector-majority').length,1,'V3 has one final bias')
  assert.match(v3.container.textContent,/Services wins/)
  assert.equal(v3.container.querySelectorAll('[data-ism-signal]').length,7)
  const prefs={...defaultInspectorPreferences(),detailView:'scoring-v2'};let saved,opened
  const view={supported:true,selectedRelease:selected,preferences:prefs,brokerId:null,now:selected.releaseAt+1000,brokerTime:false,releases:[manufacturing,selected],allReleases:groupInspectorReleases(events),
    range:{from:manufacturing.releaseAt,to:selected.releaseAt+86400000},storage:{coverage:{},loading:false,error:null,source:null},magnitudeHistory:{rows:{},loading:false,error:null,coverageMissing:false},selectRelease(){},
    rangeDates:{from:'2026-08-01',to:'2026-08-31'},rangePreset:'custom',setRangePreset(){},customFrom:'2026-08-01',customTo:'2026-08-31',setCustomFrom(){},setCustomTo(){},selectCustomRange(){},applyPreferences(next){saved=next},brokerOffsetSeconds:0}
  const panelProps={view,symbol:'EURUSD.a',source:null,error:null,timeDisplay:{mode:'utc',utcOffsetMinutes:0},onOpenScatter(r){opened=r}}
  const panel=mount(InspectorPanel,panelProps);await panel.render()
  const select=panel.container.querySelector('[aria-label="Inspector view"]');assert.equal(select.value,'scoring')
  assert.equal(panel.container.querySelectorAll('[aria-label="Standalone Scoring"] .inspector-scoring-view').length,1)
  assert.equal(panel.container.querySelectorAll('[aria-label="Context-Aware at Publication Scoring"] .inspector-scoring-view').length,0)
  await click([...panel.container.querySelectorAll('button')].find(b=>b.textContent==='Inspect Manufacturing signals'));assert.equal(opened.id,manufacturing.id)
  await choose(select,'table');assert.equal(saved.detailView,'table')
  await panel.render({...panelProps,view:{...view,selectedRelease:manufacturing}});assert.equal(panel.container.querySelector('[aria-label="Inspector view"]').value,'scoring')
  await panel.render({...panelProps,view:{...view,preferences:{...prefs,detailView:'scoring'}}});assert.ok(panel.container.querySelector('[aria-label="ISM v3 final pair direction"]'))
  localStorage.setItem(inspectorStorageKey,JSON.stringify(prefs));assert.equal(readInspectorPreferences().detailView,'scoring')
  let groupedView
  const groupedClockOffset=selected.releaseAt+1000-Date.now()
  function GroupedInspector({input}) {
    const state=useInspector({events:input,symbol:'EURUSD',bars:markerBars,timeframe:'H1',timeDisplay:{mode:'utc',utcOffsetMinutes:0},clockOffsetMs:groupedClockOffset})
    React.useEffect(()=>{groupedView=state},[state])
    return React.createElement(InspectorPanel,{view:state,symbol:'EURUSD',source:null,error:null,timeDisplay:{mode:'utc',utcOffsetMinutes:0},onOpenScatter(r){opened=r}})
  }
  const groupedApp=mount(GroupedInspector,{input:events});await groupedApp.render()
  await React.act(async()=>groupedView.selectCustomRange('2026-08-01','2026-08-31'))
  assert.equal(groupedView.releases.length,2);assert.equal(groupedView.markers.length,2,'ISM source publications display separately')
  assert.equal(groupedView.allReleases.filter(r=>['ism-manufacturing','ism-services'].includes(r.familyId)&&r.releaseAt>=manufacturing.releaseAt).length,2,
    'Source publication inventory remains separate for scoring and Scatter')
  await React.act(async()=>groupedView.selectRelease(selected.id))
  assert.equal(groupedApp.container.querySelector('[aria-label="ISM scoring publication"]'),null)
  assert.equal(groupedApp.container.querySelectorAll('[aria-label="ISM v3 final pair direction"]').length,1)
  assert.equal(groupedApp.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
  assert.equal(groupedApp.container.querySelectorAll('table[aria-label="ISM v3 components"]').length,1)
  assert.equal(groupedApp.container.querySelectorAll('[data-score-signal]').length,7)
  const contributions=[...groupedApp.container.querySelectorAll('[data-score-signal]')].map(row=>Number(row.cells[5].textContent.replace(/,/g,'')))
  assert.ok(Math.abs(contributions.reduce((sum,n)=>sum+n,0)-combined.total)<1e-9,'Plain table retains the effective sector contributions')
  await groupedApp.render({input:events})
  await choose(groupedApp.container.querySelector('[aria-label="Inspector view"]'),'table')
  assert.equal(groupedApp.container.querySelectorAll('tbody tr:not(.inspector-ism-section-heading)').length,5)
  assert.equal(groupedApp.container.querySelectorAll('.inspector-ism-section-heading').length,0)
  assert.equal(groupedApp.container.querySelectorAll('[data-reading-clock="display"]').length,0,'One sector uses the shared publication heading')
  assert.equal(groupedApp.container.querySelectorAll('.inspector-row-grade').length,5,'The selected sector retains its own row grading')
  assert.ok(![...groupedApp.container.querySelectorAll('th')].some(th=>th.textContent==='Forecast'))
  await choose(groupedApp.container.querySelector('[aria-label="Inspector view"]'),'scatter');assert.equal(opened.id,selected.id)
  await React.act(async()=>groupedView.selectRelease(manufacturing.id))
  await groupedApp.render({input:events.filter(e=>e.release_at<=manufacturing.releaseAt)})
  assert.equal(groupedView.releases.length,1);assert.equal(groupedView.selectedRelease.id,manufacturing.id)
  await groupedApp.render({input:events});assert.equal(groupedView.selectedRelease.id,manufacturing.id)
  console.log('✓ Separate monthly ISM markers/list entries, stable publication selection, sector tables/navigation and preserved legacy as-of scoring')
  let requests=0
  globalThis.fetch=async(url)=>{
    if(url==='/storage-api/health')return{ok:true,json:async()=>({revision:1,collector_error:null,sources:[{id:'test-broker',publisher_status:'live',server_now:Date.UTC(2026,9,6)/1000}]})}
    requests++;const params=new URL(url,'http://localhost').searchParams
    assert.equal(params.get('currency'),'USD')
    const ids=params.get('event_ids').split(',')
    assert.deepEqual(ids.sort(),[...(ids.length===9?ismSeriesIds:ismManufacturingSeriesIds)].sort())
    return{ok:true,json:async()=>({source_id:'test-broker',revision:1,timestamp_convention:'trade_server_time',time_basis:'chart',event_ids:ids,events:events.filter(e=>ids.includes(e.event_id)),coverage:{USD:{missing:[]}},next_cursor:null})}
  }
  const stored=mount(IsmScoreV3,{...props,brokerId:'test-broker'});await stored.render()
  assert.equal(stored.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
  const dock=mount(ScatterPlotDock,{brokerId:'test-broker',clockOffsetMs:Date.UTC(2026,9,6)-Date.now(),target:{brokerId:'test-broker',familyId:'ism-manufacturing',releaseId:manufacturing.id,at:manufacturing.releaseAt}});await dock.render()
  const beforePreview=app.container.textContent,count=requests
  await choose(dock.container.querySelector('[aria-label="Scatter Plot Calculation"]'),'signal')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Signal"]').options.length,3)
  await choose(dock.container.querySelector('[aria-label="Signal magnitude mode"]'),'custom')
  for(const [i,name]of ['Small','Medium','Large'].entries())await input(dock.container.querySelector('[aria-label="'+name+' signal upper boundary"]'),(i+1)*.001)
  assert.equal(app.container.textContent,beforePreview)
  await React.act(async()=>dock.container.querySelector('[aria-label="Scoring signal boundaries"]').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})))
  assert.deepEqual(ismManufacturingSignalSettings.read(),{orders:[.001,.002,.003]});assert.deepEqual(ismServicesSignalSettings.read(),{})
  assert.notEqual(app.container.textContent,beforePreview);assert.equal(requests,count)
  const workspace=exportWorkspace();assert.ok(workspace.entries[ismManufacturingSignalSettings.key])
  assert.throws(()=>parseWorkspaceSnapshot(JSON.stringify({...workspace,entries:{[ismManufacturingSignalSettings.key]:JSON.stringify({wrong:[1,2,3]})}})))
  await React.act(async()=>ismManufacturingSignalSettings.save('orders',null));assert.equal(app.container.textContent,beforePreview)
  await React.act(async()=>restoreWorkspace(workspace));assert.notEqual(app.container.textContent,beforePreview)
  await click([...dock.container.querySelectorAll('button')].find(b=>b.textContent==='Use automatic'));assert.equal(app.container.textContent,beforePreview)
  await React.act(async()=>ismServicesSignalSettings.save('orders',[.001,.002,.003]))
  assert.deepEqual(ismServicesSignalSettings.read().orders,[.001,.002,.003])
  assert.deepEqual(ismManufacturingSignalSettings.read(),{})
  await React.act(async()=>ismServicesSignalSettings.save('orders',null))
  // Production worker path: unchanged parent/clock ticks do not submit new jobs.
  const originalWorker=Object.getOwnPropertyDescriptor(globalThis,'Worker'), workers=[]
  class FakeWorker {
    constructor(){this.jobs=[];this.closed=false;workers.push(this)}
    postMessage(job){this.jobs.push(job)}
    terminate(){this.closed=true}
    complete(){const job=this.jobs.at(-1);this.onmessage({data:{id:job.id,result:calculateIsmAnalysis(job.input)}})}
  }
  Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:FakeWorker})
  try {
    const workerProps={release:grouped[0],events,now:selected.releaseAt}
    const background=mount(IsmScoreV3,workerProps);await background.render()
    assert.equal(workers.length,1);assert.equal(workers[0].jobs.length,1)
    await React.act(async()=>workers[0].complete())
    assert.equal(background.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
    for(let i=1;i<=5;i++)await background.render({...workerProps,now:selected.releaseAt+i*3000})
    assert.equal(workers.length,1);assert.equal(workers[0].jobs.length,1,'Heartbeat ticks reuse the same calculation')
    const changed={...workerProps,events:[...events]};await background.render(changed)
    assert.equal(workers[0].jobs.length,2);assert.match(background.container.textContent,/Calculating ISM context/)
    await React.act(async()=>workers[0].complete())
    assert.equal(background.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
    await background.render({...workerProps,release:grouped[0],now:manufacturing.releaseAt})
    await background.render(workerProps)
    assert.equal(workers[0].jobs.length,3,'A rapid later request queues until the active job finishes')
    await React.act(async()=>workers[0].complete())
    assert.equal(workers[0].jobs.length,4,'Only the latest queued request runs next')
    assert.match(background.container.textContent,/Calculating ISM context/,'The superseded earlier result is not exposed')
    await React.act(async()=>workers[0].complete())
    assert.equal(background.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,combined.label)
    await background.render({...workerProps,events:[...events]})
    await React.act(async()=>workers[0].onerror())
    assert.match(background.container.querySelector('[role="alert"]').textContent,/Background calculation failed/)
    assert.equal(background.container.querySelector('[aria-label="ISM v3 final pair direction"]').textContent,'Uncomputed')
    await background.render({...workerProps,release:null})
    assert.equal(workers[0].closed,true,'Closing the release stops its worker')
  } finally {
    if(originalWorker)Object.defineProperty(globalThis,'Worker',originalWorker);else delete globalThis.Worker
  }
  console.log('✓ ISM v3 single weighted resolution, tie priority, pending data, worker dispatch and no recalculation on heartbeat updates')
  console.log('✓ ISM v3 result-first Inspector, both-family menu/persistence, scoped storage, source navigation, chart parity, independent overrides and portable live settings')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
  await server.close()
}
