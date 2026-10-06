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
  const {assessIsmScoreV2, ismV2SeriesIds, supportsIsmV2} = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v2.ts')
  const {assessIsmManufacturing, ismManufacturingSeriesIds} = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-manufacturing-score.ts')
  const {ismServicesSeriesIds, assessIsmServicesScore} = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM-SERVICES/assessment/ism-services-score.ts')
  const {expectedIsmPublication} = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-publication-check.ts')
  const {groupInspectorReleases, defaultInspectorPreferences, inspectorStorageKey, readInspectorPreferences} = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const {IsmScoreV2} = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/ui/IsmScoreV2.tsx')
  const {InspectorPanel} = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const {scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel} = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const {ScatterPlotDock} = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const {ismServicesSignalSettings, ismManufacturingSignalSettings} = await server.ssrLoadModule('./src/inspector/scoring/shared/core/signal-magnitude-settings.ts')
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
  const combined=assessIsmScoreV2(selected,events)
  assert.equal(combined.contextId,'ISM/2026-07');assert.equal(combined.services.weight,70);assert.equal(combined.manufacturing.weight,30)
  assert.equal(combined.services.release.id,selected.id);assert.equal(combined.manufacturing.release.id,manufacturing.id)
  assert.equal(combined.sectorConflict,true);assert.notEqual(combined.strength,'strong')
  assert.equal(combined.total,combined.readings.reduce((sum,r)=>sum+(r.points??0)*r.weight,0)/10000)
  assert.ok(combined.explanation.includes('employment'));assert.equal(new Set(combined.readings.map(r=>r.group)).size,3)
  const hotServices=groupInspectorReleases(rows('services',2026,6,[55,57,57,57,57]))[0]
  const agreement=assessIsmScoreV2(hotServices,[...history,...manufacturingRows,...hotServices.events])
  assert.equal(agreement.strength,'strong');assert.equal(agreement.label,'EURUSD Short')
  const demandLabor=groupInspectorReleases(rows('services',2026,6,[55,49,59,59,59]))[0]
  const conflicted=assessIsmScoreV2(demandLabor,[...history,...manufacturingRows,...demandLabor.events])
  assert.equal(conflicted.laborConflict,true);assert.notEqual(conflicted.strength,'strong')
  assert.match(conflicted.strengthReason,/Demand and employment/)
  const early=assessIsmScoreV2(manufacturing,events)
  assert.equal(early.services.release,null);assert.equal(early.services.status,'pending');assert.equal(early.strength,'weak')
  assert.equal(early.label,'EURUSD Short');assert.equal(early.contextId,combined.contextId)
  assert.equal(combined.previous.label,early.label)
  const future=rows('services',2026,7,[99,99,99,99,99],3)
  assert.deepEqual(assessIsmScoreV2(selected,[...events,...future]),combined)
  assert.deepEqual(assessIsmScoreV2(manufacturing,events.filter(e=>e.release_at<=manufacturing.releaseAt)),early)
  assert.deepEqual(assessIsmScoreV2(selected,[...events,...events]),combined)
  const noise=e=>({...e,forecast:-1e9,forecast_raw_scaled_1e6:'bad'})
  const withoutForecastFields=value=>JSON.parse(JSON.stringify(value,(key,item)=>key==='forecast'||key==='forecast_raw_scaled_1e6'?undefined:item))
  assert.deepEqual(withoutForecastFields(assessIsmScoreV2({...selected,events:selected.events.map(noise)},events.map(noise))),withoutForecastFields(combined))
  const oldOnly=events.filter(e=>e.period_seconds!==Date.UTC(2026,6,1)/1000||ismServicesSeriesIds.includes(e.event_id))
  assert.equal(assessIsmScoreV2(selected,oldOnly).manufacturing.release,null,'Do not carry a different reference month into this group')
  assert.equal(assessIsmScoreV2({...selected,timingUncertain:true},events).label,'Uncomputed')
  assert.equal(assessIsmScoreV2(null,events),null)
  for(const patch of [{familyId:'gdp'},{currency:'EUR'},{country:'EU'}])assert.equal(supportsIsmV2({...selected,...patch}),false)
  const mismatch={...selected,events:selected.events.map((e,i)=>i?e:{...e,period_seconds:Date.UTC(2026,5,1)/1000})}
  assert.equal(assessIsmScoreV2(mismatch,events).label,'Uncomputed')
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
  const canceled=assessIsmScoreV2(neutralService,[...history,...cancelMfg,...neutralService.events],manual)
  assert.equal(canceled.total,0);assert.equal(canceled.tieBreak.id,'manufacturing:orders');assert.equal(canceled.label,'EURUSD Short');assert.equal(canceled.strength,'weak')
  const allZero=assessIsmScoreV2(neutralService,[...history,...rows('manufacturing',2026,6,[55,55,55,55]),...neutralService.events])
  assert.equal(allZero.label,'Uncomputed')
  const uncalibrated=groupInspectorReleases(rows('manufacturing',2015,4,[55,57,57,57]))[0]
  assert.equal(assessIsmScoreV2(uncalibrated,historic,manual).label,'Uncomputed')
  // Early broker dates cannot leak an officially later publication into context.
  const badDate=groupInspectorReleases(rows('services',2026,2,[55,57,57,57,57],3))[0]
  const flagged=assessIsmScoreV2(badDate,[...historic,...rows('manufacturing',2026,0,[55,55,55,55],2),...rows('manufacturing',2026,1,[55,55,55,55],2),...badDate.events,...rows('manufacturing',2026,2,[55,57,57,57],1)])
  assert.equal(flagged.services.status,'excluded');assert.match(flagged.services.issue,/2026-04-06/);assert.equal(flagged.strength,'weak')
  assert.equal(flagged.services.assessment,null)
  assert.equal(expectedIsmPublication(Date.UTC(2026,0,7),'ism-services'),Date.UTC(2026,0,7,15))
  assert.equal(expectedIsmPublication(Date.UTC(2026,7,5),'ism-services'),Date.UTC(2026,7,5,14))
  assert.equal(expectedIsmPublication(Date.UTC(2025,7,5),'ism-services'),null)
  const weekend=groupInspectorReleases(rows('services',2025,8,[55,57,57,57,57],5))[0]
  assert.match(assessIsmScoreV2(weekend,historic).services.issue,/weekend/)
  const invalidLatest=manufacturingRows.map(e=>({...e,value_id:e.value_id+':new',release_at:e.release_at+60000,server_time_seconds:e.server_time_seconds+60,chart_time_seconds:e.chart_time_seconds+60,actual:null,actual_raw_scaled_1e6:null}))
  assert.equal(assessIsmScoreV2(selected,[...events,...invalidLatest]).manufacturing.status,'unavailable','Invalid latest data must not silently fall back to an older reading')
  console.log('✓ ISM monthly identity, strict as-of updates, same-month selection, earlier history, zero/tie/conflict rules, index/revision gates and timing exclusions')

  const binding=scoringSignalBinding('ism-manufacturing'), signalHistory=prepareScoringSignalHistory(events,Date.UTC(2026,9,6),binding)
  const standalone=assessIsmManufacturing(manufacturing,events)
  for(const score of standalone.readings)for(const key of ['value','points','limits','sampleCount','inputs','reason']) {
    assert.deepEqual(scoringSignalModel(signalHistory,binding,score.id,manufacturing.id).inspection.signal[key],score[key])
    assert.deepEqual(combined.manufacturing.assessment.readings.find(r=>r.id===score.id)[key],score[key])
  }
  assert.deepEqual(combined.services.assessment.readings,assessIsmServicesScore(selected,events).readings)
  const props={release:selected,events}
  const app=mount(IsmScoreV2,props);await app.render()
  assert.equal(app.container.querySelector('[aria-label="ISM v2 pair direction"]').textContent,combined.label)
  assert.equal(app.container.querySelectorAll('tbody tr').length,7);assert.equal(app.container.querySelectorAll('details').length,0)
  await app.render({release:manufacturing,events});assert.match(app.container.querySelector('[aria-label="ISM services context"]').textContent,/Pending/)
  await app.render(props)
  const prefs={...defaultInspectorPreferences(),detailView:'scoring-v2'};let saved,opened
  const view={supported:true,selectedRelease:selected,preferences:prefs,brokerId:null,now:selected.releaseAt+1000,brokerTime:false,releases:[manufacturing,selected],allReleases:groupInspectorReleases(events),
    range:{from:manufacturing.releaseAt,to:selected.releaseAt+86400000},storage:{coverage:{},loading:false,error:null,source:null},magnitudeHistory:{rows:{},loading:false,error:null,coverageMissing:false},selectRelease(){},
    rangeDates:{from:'2026-08-01',to:'2026-08-31'},rangePreset:'custom',setRangePreset(){},customFrom:'2026-08-01',customTo:'2026-08-31',setCustomFrom(){},setCustomTo(){},selectCustomRange(){},applyPreferences(next){saved=next},brokerOffsetSeconds:0}
  const panelProps={view,symbol:'EURUSD.a',source:null,error:null,timeDisplay:{mode:'utc',utcOffsetMinutes:0},onOpenScatter(r){opened=r}}
  const panel=mount(InspectorPanel,panelProps);await panel.render()
  const select=panel.container.querySelector('[aria-label="Inspector view"]');assert.equal(select.value,'scoring-v2')
  assert.equal(panel.container.querySelectorAll('.inspector-scoring-view').length,1)
  await click([...panel.container.querySelectorAll('button')].find(b=>b.textContent==='Inspect Manufacturing signals'));assert.equal(opened.id,manufacturing.id)
  await choose(select,'table');assert.equal(saved.detailView,'table')
  await panel.render({...panelProps,view:{...view,selectedRelease:manufacturing}});assert.equal(panel.container.querySelector('[aria-label="Inspector view"]').value,'scoring-v2')
  await panel.render({...panelProps,view:{...view,preferences:{...prefs,detailView:'scoring'}}});assert.ok(panel.container.querySelector('[aria-label="ISM Services pair direction"]'))
  localStorage.setItem(inspectorStorageKey,JSON.stringify(prefs));assert.equal(readInspectorPreferences().detailView,'scoring-v2')
  let requests=0
  globalThis.fetch=async(url)=>{
    if(url==='/storage-api/health')return{ok:true,json:async()=>({revision:1,collector_error:null,sources:[{id:'test-broker',publisher_status:'live',server_now:Date.UTC(2026,9,6)/1000}]})}
    requests++;const params=new URL(url,'http://localhost').searchParams
    assert.equal(params.get('currency'),'USD')
    const ids=params.get('event_ids').split(',')
    assert.deepEqual(ids.sort(),[...(ids.length===9?ismV2SeriesIds:ismManufacturingSeriesIds)].sort())
    return{ok:true,json:async()=>({source_id:'test-broker',revision:1,timestamp_convention:'trade_server_time',time_basis:'chart',event_ids:ids,events:events.filter(e=>ids.includes(e.event_id)),coverage:{USD:{missing:[]}},next_cursor:null})}
  }
  const stored=mount(IsmScoreV2,{...props,brokerId:'test-broker'});await stored.render()
  assert.equal(stored.container.querySelector('[aria-label="ISM v2 pair direction"]').textContent,combined.label)
  const dock=mount(ScatterPlotDock,{brokerId:'test-broker',clockOffsetMs:Date.UTC(2026,9,6)-Date.now(),target:{brokerId:'test-broker',familyId:'ism-manufacturing',releaseId:manufacturing.id,at:manufacturing.releaseAt}});await dock.render()
  const beforePreview=app.container.textContent,count=requests
  await choose(dock.container.querySelector('[aria-label="Scatter Plot Measure"]'),'signal')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Signal"]').options.length,3)
  await choose(dock.container.querySelector('[aria-label="Signal magnitude mode"]'),'custom')
  for(const [i,name]of ['Small','Medium','Large'].entries())await input(dock.container.querySelector('[aria-label="'+name+' signal upper boundary"]'),(i+1)*.001)
  assert.equal(app.container.textContent,beforePreview)
  await React.act(async()=>dock.container.querySelector('[aria-label="Scoring signal boundaries"]').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})))
  assert.deepEqual(ismManufacturingSignalSettings.read(),{orders:[.001,.002,.003]});assert.deepEqual(ismServicesSignalSettings.read(),{})
  assert.match(app.container.textContent,/manual override boundaries/);assert.equal(requests,count)
  const workspace=exportWorkspace();assert.ok(workspace.entries[ismManufacturingSignalSettings.key])
  assert.throws(()=>parseWorkspaceSnapshot(JSON.stringify({...workspace,entries:{[ismManufacturingSignalSettings.key]:JSON.stringify({wrong:[1,2,3]})}})))
  await React.act(async()=>ismManufacturingSignalSettings.save('orders',null));assert.equal(app.container.textContent,beforePreview)
  await React.act(async()=>restoreWorkspace(workspace));assert.match(app.container.textContent,/manual override boundaries/)
  await click([...dock.container.querySelectorAll('button')].find(b=>b.textContent==='Use automatic'));assert.equal(app.container.textContent,beforePreview)
  await React.act(async()=>ismServicesSignalSettings.save('orders',[.001,.002,.003]))
  assert.match(app.container.querySelector('[aria-label="ISM services context"]').textContent,/manual override boundaries/)
  assert.deepEqual(ismManufacturingSignalSettings.read(),{})
  await React.act(async()=>ismServicesSignalSettings.save('orders',null))
  console.log('✓ ISM v2 flat two-section Inspector, both-family menu/persistence, scoped storage, source navigation, chart parity, independent overrides and portable live settings')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
  await server.close()
}
