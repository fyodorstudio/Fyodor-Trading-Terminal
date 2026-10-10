import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true,hmr:false}})
try {
  const {r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {assessFeatures,r1Limits}=await server.ssrLoadModule('./src/scoring-system/r1/assessment.ts')
  const {balance,magnitude}=await server.ssrLoadModule('./src/scoring-system/r1/arithmetic.ts')
  const {combineR1,r1Freshness}=await server.ssrLoadModule('./src/scoring-system/r1/relationships.ts')
  const {groupInspectorReleases}=await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const at=Date.UTC(2026,2,11,12,30),month=Date.UTC(2026,1,1)/1000
  const settings={version:1,calibration:{mode:'undefined',limits:{}},selected:['us-cpi']}
  const feature=delta=>({actual:delta,previous:0,delta,reference:24313,previousReference:24312,publishedAt:at,valueId:'test',revision:0,basis:'Supplied Previous',reason:'',stage:'momentum'})
  const release={id:'test',familyId:'us-cpi',currency:'USD',country:'US',releaseAt:at,events:[]}
  const manual=Object.fromEntries(r1Profiles['us-cpi'].components.map(c=>[`us-cpi/${c.id}`,[1,2,3]]))
  for(const [deltas,expected] of [[[-1,0,1,0],[15,-50,-35]],[[-2,1,-1,3],[65,-115,-50]],[[-2,-3,-4,-4],[0,-280,-280]]]){
    const a=assessFeatures(release,r1Profiles['us-cpi'],deltas.map(feature),[],{mode:'undefined',limits:manual},{})
    assert.deepEqual([a.supportive*4,a.negative*4,a.net*4],expected)
    assert.equal(a.direction,'weakening')
  }
  const row=(id,actual,previous,patch={})=>({value_id:`${id}-${at}`,event_id:id,release_at:at,chart_time_seconds:at/1000,server_time_seconds:at/1000,period_seconds:month,revision:0,currency:'USD',country_code:'US',country_name:'US',name:'Test',event_code:'',importance:'high',unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',actual,previous,forecast:999,revised_previous:null,...patch})
  const rows=r1Profiles['us-cpi'].components.map((c,i)=>row(c.seriesId,[.2,2.5,.3,2.4][i],[.3,2.5,.2,2.4][i]))
  const bands={'us-cpi':Object.fromEntries(rows.map(r=>[r.event_id,[.1,.2,.3]]))}
  const run=(events,selected=['us-cpi'],extra={})=>calculateR1({release:groupInspectorReleases(events).find(r=>r.familyId===selected[0]),events,settings:{...settings,selected},savedBands:bands,...extra})
  const a=run(rows).assessment
  assert.deepEqual([a.supportive*4,a.negative*4,a.net*4],[15,-50,-35])
  assert.equal(a.readings[0].magnitude,1,'decimal boundary equality belongs to lower band')
  assert.deepEqual(run(rows.concat(rows)).assessment,a,'duplicate value IDs are not votes')
  assert.deepEqual(run(rows.map(r=>({...r,forecast:-12345}))).assessment,a,'forecasts cannot vote')
  assert.deepEqual(run(rows.concat(row('840030027',999,0))).assessment,a,'index excluded')
  assert.deepEqual(run(rows.concat(rows.map(r=>({...r,value_id:r.value_id+'future',release_at:at+86400000,period_seconds:Date.UTC(2026,2,1)/1000,actual:999})))).assessment,a,'future data cannot alter calibration')
  const revised=run(rows.map((r,i)=>i===0?{...r,revised_previous:.1}:r)).assessment
  assert.equal(revised.readings[0].delta,.1)
  const invalid=run(rows.map((r,i)=>i===0?{...r,actual_raw_scaled_1e6:'bad'}:r)).assessment
  assert.equal(invalid.direction,'insufficient')
  assert.equal(invalid.unavailable,50)
  const notYetKnown=run(rows.map((r,i)=>i===0?{...r,available_at:at+1}:r)).assessment
  assert.equal(notYetKnown.unavailable,50,'a correction known after the selected clock cannot enter the snapshot')
  const correctionAt=at+3600000
  const original=rows[0],corrected={...original,actual:.4,revision:1}
  const versions=JSON.stringify([{knownAt:at+1000,event:original,source:'capture'},{knownAt:correctionAt,event:corrected,source:'capture'}])
  const vintageRows=rows.map((r,i)=>i===0?{...corrected,r1_vintages:versions}:r)
  const originalSnapshot=run(vintageRows).assessment
  assert.equal(originalSnapshot.readings[0].actual,.2,'earliest recoverable snapshot preserves original release interpretation')
  assert.equal(originalSnapshot.readings[0].vintage,'retrospective','late capture does not prove original publication availability')
  const scheduleVersion={family:'us-cpi',dueAt:at+30*86400000,knownAt:at-1,source:'fixture'}
  const beforeCorrection=run(vintageRows,['us-cpi'],{asOf:correctionAt-1,schedules:[scheduleVersion]})
  const afterCorrection=run(vintageRows,['us-cpi'],{asOf:correctionAt,schedules:[scheduleVersion]})
  assert.equal(beforeCorrection.overall.slots[0].assessment.readings[0].actual,.2)
  assert.equal(afterCorrection.overall.slots[0].assessment.readings[0].actual,.4,'correction replaces one current slot at captured timestamp')
  assert.equal(afterCorrection.overall.slots[0].assessment.readings[0].vintage,'corrected')
  assert.deepEqual(afterCorrection.assessment,originalSnapshot,'later aggregate clock never rewrites the original release output')
  assert.equal(run(vintageRows.map((r,i)=>i===0?{...r,r1_vintages:'bad'}:r)).assessment.unavailable,50,'malformed provenance does not silently substitute latest values')
  const later=rows.map(r=>({...r,value_id:r.value_id+'new-month',release_at:at+31*86400000,period_seconds:Date.UTC(2026,2,1)/1000,actual:null}))
  const laterRelease=groupInspectorReleases(later)[0]
  const partialNew=calculateR1({release:laterRelease,events:[...rows,...later],settings,savedBands:bands})
  assert.equal(partialNew.overall.slots[0].assessment.releaseId,laterRelease.id,'a newer incomplete reference month cannot fall back to older evidence')
  const p=assessFeatures(release,r1Profiles['us-cpi'],[-4,-4,null,null].map(x=>x===null?{...feature(null)}:feature(x)),[],{mode:'undefined',limits:manual},{})
  assert.deepEqual(p.interval.map(x=>x*4),[-400,-160]);assert.equal(p.direction,'weakening')
  assert.equal(balance([{value:0,budget:100}]).direction,'balanced')
  assert.equal(balance([{value:-50,budget:50},{value:null,budget:50}]).direction,'insufficient','touching zero is uncertain')
  assert.equal(magnitude(1e6,[1,2,3]),4);assert.equal(magnitude(1e9,[1,2,3]),4)
  assert.equal(magnitude(1e10,[1,2,3]),4,'very large finite changes remain Extreme rather than turning into zero during decimal conversion')
  assert.equal(r1Limits(Array(59).fill(1)),null)
  assert.deepEqual(r1Limits(Array(60).fill(1)),[1,1,1],'automatic ties coalesce')
  const claimRows=[row('840140001',210,200,{unit:0,multiplier:1,period_seconds:at/1000-7*86400}),row('840140002',1.85,1.80,{unit:0,multiplier:2,period_seconds:at/1000-14*86400})]
  const claims=run(claimRows,['claims'],{savedBands:{claims:{'840140001':[10,20,30],'840140002':[.025,.05,.075]}}}).assessment
  assert.equal(claims.readings[1].delta,50);assert.equal(claims.readings[1].magnitude,2)
  assert.equal(claims.net*4,-130,'continuing millions convert to thousands for scoring')
  const slot=(family,value,ref=24313)=>({family,status:'current',nextDue:at+1,assessment:{family,publishedAt:at,reference:ref,leaves:[{id:family,family,label:family,value,budget:100}],...balance([{value,budget:100}])}})
  for(const macro of [-10,0,10])for(const action of [-25,0,25]){
    const overall=combineR1([slot('us-cpi',macro),slot('fomc',action)],['us-cpi','fomc'],at)
    const net=(.35*macro+.2*action)/.55
    assert.ok(Math.abs(overall.net-net)<1e-8)
    assert.equal(overall.direction,net>0?'strengthening':net<0?'weakening':'balanced')
    assert.ok(Math.abs(overall.supportive+overall.negative-overall.net)<1e-8)
  }
  const same=combineR1([slot('us-cpi',100),slot('pce',-100),slot('ppi',100)],['us-cpi','pce','ppi'],at)
  assert.equal(same.categories[0].anchor,'pce');assert.equal(same.net,-80,'same-month PCE replaces CPI, PPI is modifier')
  const newer=combineR1([slot('us-cpi',100,24314),slot('pce',-100),slot('ppi',100)],['us-cpi','pce','ppi'],at)
  assert.equal(newer.categories[0].anchor,'us-cpi');assert.equal(newer.unavailable,10)
  const splitSlot=(family,positive,negative)=>{const s=slot(family,positive+negative);s.assessment.leaves=[{id:`${family}/positive`,family,label:family,value:positive,budget:50},{id:`${family}/negative`,family,label:family,value:negative,budget:50}];return s}
  const assembled=combineR1([splitSlot('us-cpi',16.25,-28.75),splitSlot('ppi',22.5,-20),splitSlot('jobs',2.5,-30),splitSlot('claims',17.5,-7.5),slot('gdp',-25),slot('retail',25),slot('ism-services',25),slot('ism-manufacturing',-25),slot('fomc',25)],['us-cpi','ppi','jobs','claims','gdp','retail','ism-services','ism-manufacturing','fomc'],at)
  assert.deepEqual([assembled.supportive,assembled.negative,assembled.net],[14.05625,-19.65625,-5.6],'full design example preserves signed leaves through all categories')
  for(const h of [-6,-5,-4,0,4,5,6])for(const fed of [-25,0,25]){
    const slots=[slot('us-cpi',h/.8),slot('jobs',h/.8),slot('gdp',h/.8),slot('fomc',fed)]
    const result=combineR1(slots,['us-cpi','jobs','gdp','fomc'],at),net=h+.2*fed
    assert.ok(Math.abs(result.net-net)<1e-8);assert.equal(result.direction,net>0?'strengthening':net<0?'weakening':'balanced')
  }
  const current=slot('us-cpi',10).assessment
  assert.equal(r1Freshness('us-cpi',current,at,[]).status,'unknown-schedule')
  const schedule={family:'us-cpi',dueAt:at+1000,knownAt:at-1000,source:'stored planned observation'}
  assert.equal(r1Freshness('us-cpi',current,at,[schedule]).status,'current')
  assert.equal(r1Freshness('us-cpi',current,at+86401001,[schedule]).status,'stale')
  assert.equal(r1Freshness('us-cpi',current,at,[{...schedule,knownAt:at+1}]).status,'unknown-schedule')
  const amendment={...schedule,dueAt:at+5*86400000,knownAt:at,supersedesDueAt:schedule.dueAt}
  assert.equal(r1Freshness('us-cpi',current,at+86401001,[schedule,amendment]).status,'current','known postponement replaces date')
  for(const [delta,expected]of [[.25,25],[-.25,-25],[0,0],[-.5,-50],[2,100]]){
    const result=run([row('840050014',4+delta,4)],['fomc']).assessment
    assert.equal(result.net,expected)
  }
  const q1=Date.UTC(2025,9,1)/1000,q2=Date.UTC(2026,0,1)/1000,gdpAt=Date.UTC(2026,5,25)
  const gdpRows=[row('840010007',3,2,{value_id:'gdp-prior',release_at:gdpAt-120*86400000,period_seconds:q1}),row('840010007',1.3,3,{value_id:'gdp-first',release_at:gdpAt-30*86400000,period_seconds:q2}),row('840010007',1.6,1.3,{value_id:'gdp-revised',release_at:gdpAt,period_seconds:q2})]
  const gdp=calculateR1({release:groupInspectorReleases(gdpRows).at(-1),events:gdpRows,settings:{...settings,selected:['gdp']},savedBands:{gdp:{'840010007':[.5,1,2]}},schedules:[{...schedule,family:'gdp'}]})
  assert.equal(gdp.assessment.readings[0].delta,.3);assert.equal(gdp.assessment.stage,'revision')
  assert.equal(gdp.overall.slots[0].assessment.readings[0].delta,-1.4,'revision updates quarter momentum without another vote')
  console.log('✓ R1 golden evidence totals, decimal bands, cap, partial inputs, forecast/index/future exclusion, unit conversion, inflation anchor, nine Fed cases, schedules and GDP revisions')
}finally{await server.close()}
