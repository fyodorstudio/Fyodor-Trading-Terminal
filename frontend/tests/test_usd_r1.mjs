import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true,hmr:false}})
try {
  const {r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {assessFeatures,r1Limits}=await server.ssrLoadModule('./src/scoring-system/r1/assessment.ts')
  const {balance,magnitude,magnitudePoints}=await server.ssrLoadModule('./src/scoring-system/r1/arithmetic.ts')
  const {combineR1,r1Freshness}=await server.ssrLoadModule('./src/scoring-system/r1/relationships.ts')
  const {r1DefaultFreshness,validR1Freshness}=await server.ssrLoadModule('./src/scoring-system/r1/freshness.ts')
  const {validR1Settings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
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
  assert.equal(afterCorrection.overall.slots[0].expiresAt,beforeCorrection.overall.slots[0].expiresAt,'storage corrections never renew publication age')
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
  for(const [change,expected]of [[0,0],[2,.2],[10,1],[15,1.5],[20,2],[25,3],[30,4],[31,4],[1e10,4]]){
    assert.equal(magnitudePoints('claims',change,[10,20,30]),expected)
    assert.equal(magnitudePoints('claims',-change,[10,20,30]),expected,'magnitude size is symmetric')
  }
  for(const edge of [10,20,30])assert.ok(Math.abs(magnitudePoints('claims',edge-1e-6,[10,20,30])-magnitudePoints('claims',edge+1e-6,[10,20,30]))<1e-6,'strict boundary crossings are continuous')
  for(const limits of [[10,20,30],[10,10,30],[10,30,30],[10,10,10]]){
    let prior=0
    for(let change=0;change<=100;change+=.5){const points=magnitudePoints('claims',change,limits);assert.ok(points>=prior&&points<=4);prior=points}
    assert.equal(magnitudePoints('claims',10,limits),1,'tied equality retains the lower band endpoint')
  }
  for(const family of Object.keys(r1Profiles).filter(f=>!['claims','ism-manufacturing'].includes(f)))for(const change of [0,2,10,11,20,21,30,31,1e10])assert.equal(magnitudePoints(family,change,[10,20,30]),magnitude(change,[10,20,30]),'other families keep integer magnitude')
  for(const [change,expected]of [[0,0],[.1,.05],[1.6,.8],[2,1],[3,1.5],[4,2],[5,3],[6,4],[7,4],[1e10,4]]){
    assert.equal(magnitudePoints('ism-manufacturing',change,[2,4,6]),expected)
    assert.equal(magnitudePoints('ism-manufacturing',-change,[2,4,6]),expected)
  }
  const manufacturingBands={'ism-manufacturing':{'840040006':[2.6,4.7,7.8],'840040001':[1.3,2.1,3.9],'840040004':[2.1,3.6,5.2],'840040002':[3.9,6.4,11]}}
  const manufacturingRows=[['840040006',55.3,53.7],['840040001',54.5,54.6],['840040004',52.7,51.2],['840040002',77.9,71.1]].map(([id,actual,previous])=>row(id,actual,previous,{unit:0}))
  const mrun=(events=manufacturingRows,extra={})=>run(events,['ism-manufacturing'],{savedBands:manufacturingBands,...extra})
  const manufacturing=mrun().assessment,manufacturingRow=manufacturingRows[0]
  assert.equal(manufacturing.version,'USD-ISM-MANUFACTURING-R1.2');assert.equal(manufacturing.label,'ISM manufacturing')
  assert.equal(manufacturing.coverage,1);assert.deepEqual(manufacturing.readings.map(r=>r.weight),[45,30,15,10])
  assert.deepEqual(manufacturing.leaves.map(l=>l.category),['activity','activity','labor','inflation'])
  assert.equal(manufacturing.direction,'strengthening');assert.equal(manufacturing.strength,'moderate')
  assert.ok(Math.abs(manufacturing.supportive*4-60.14572384)<1e-8)
  assert.ok(Math.abs(manufacturing.negative*4+2.307692308)<1e-8)
  assert.ok(Math.abs(manufacturing.net*4-57.838031532)<1e-8)
  assert.match(manufacturing.explanation,/orders.*outweighs.*manufacturing conditions/)
  assert.deepEqual(mrun(manufacturingRows.concat(row('840050024',0,100,{unit:0}))).assessment,manufacturing,'Fed Production cannot substitute or supply an extra vote')
  assert.deepEqual(mrun(manufacturingRows.map(r=>({...r,forecast:-999}))).assessment,manufacturing)
  const neutralOthers=manufacturingRows.slice(1).map(r=>({...r,actual:r.previous}))
  for(const [previous,actual,text,direction]of [[52,55,'improved and remain expanding','strengthening'],[55,52,'softened but remain expanding','weakening'],[47,49,'improved but remain contracting','strengthening'],[49,47,'softened and remain contracting','weakening'],[49,51,'improved into expansion','strengthening'],[51,49,'softened into contraction','weakening'],[49,50,'improved to 50','strengthening'],[51,50,'softened to 50','weakening'],[51,51,'unchanged and remain expanding','balanced'],[49,49,'unchanged and remain contracting','balanced'],[50,50,'unchanged at 50','balanced']]){
    const scored=mrun([{...manufacturingRow,actual,previous},...neutralOthers]).assessment
    assert.equal(scored.direction,direction);assert.ok(scored.explanation.includes(text),scored.explanation)
  }
  assert.equal(mrun([{...manufacturingRow,revised_previous:55.4},...neutralOthers]).assessment.direction,'weakening','revised prior takes precedence')
  assert.equal(mrun(manufacturingRows.map((r,i)=>i===0?{...r,actual:null}:r)).assessment.unavailable,45,'missing orders retain 45%')
  for(let i=0;i<4;i++)assert.equal(mrun(manufacturingRows.filter((_,j)=>i!==j)).assessment.unavailable,[45,30,15,10][i],'each missing input retains its own budget')
  assert.equal(mrun([manufacturingRow]).assessment.unavailable,55,'an orders-only release never silently becomes a full four-input score')
  assert.equal(mrun(manufacturingRows,{savedBands:{}}).assessment.unavailable,100,'no nonzero magnitude is guessed without configured or earlier-history bands')
  const noChange=mrun(manufacturingRows.map(r=>({...r,actual:r.previous})),{savedBands:{}}).assessment
  assert.equal(noChange.direction,'balanced');assert.equal(noChange.readings[0].points,0)
  const pricesOnly=mrun([{...manufacturingRow,actual:manufacturingRow.previous},...neutralOthers.map((r,i)=>i===2?{...r,actual:r.previous+1}:r)]).assessment
  assert.match(pricesOnly.explanation,/input-price pressure supports USD strength/,'rising prices are not described as improving activity')
  const reversed=mrun(manufacturingRows.map(r=>({...r,actual:r.previous,previous:r.actual}))).assessment
  assert.equal(reversed.net,-manufacturing.net);assert.equal(reversed.direction,'weakening')
  const mismatched=mrun(manufacturingRows.map((r,i)=>i===1?{...r,period_seconds:month-31*86400}:r)).assessment
  assert.equal(mismatched.unavailable,100,'different survey months are never combined')
  assert.equal(mrun([...manufacturingRows,{...manufacturingRow,value_id:'duplicate-orders'}]).assessment.unavailable,45,'duplicate component is unavailable, not another vote')
  const newerPmi=row('840040001',54.5,54.6,{unit:0,value_id:'new-pmi-without-orders',release_at:at+31*86400000,period_seconds:Date.UTC(2026,2,1)/1000})
  const noNewOrders=calculateR1({release:groupInspectorReleases([newerPmi])[0],events:[manufacturingRow,newerPmi],settings:{...settings,selected:['ism-manufacturing']},savedBands:manufacturingBands})
  assert.equal(noNewOrders.overall.slots[0].assessment.releaseId,noNewOrders.assessment.releaseId,'new PMI publication replaces the old Orders slot even when its Orders input is missing')
  assert.equal(noNewOrders.overall.unavailable,70);assert.equal(noNewOrders.overall.direction,'insufficient')
  assert.equal(noNewOrders.overall.slots[0].assessment.publishedAt,newerPmi.release_at)
  assert.ok(validR1Settings({...settings,calibration:{...settings.calibration,limits:{'ism-manufacturing/production':[1,2,3],'us-cpi/core-monthly':[.1,.2,.3]}}}),'retired Production limits do not invalidate other workspace settings')
  const exampleRows=claimRows.map((r,i)=>({...r,actual:i?1.716:197,previous:i?1.699:199}))
  const example=run(exampleRows,['claims'],{savedBands:{claims:{'840140001':[10,20,67],'840140002':[.026,.058,.366]}}}).assessment
  assert.equal(example.version,'USD-CLAIMS-R1.1')
  assert.deepEqual(example.readings.map(r=>r.magnitude),[1,1],'band labels stay Small while point sizes differ')
  assert.equal(example.readings[0].points,.2);assert.equal(example.readings[1].points,-17/26)
  assert.ok(Math.abs(example.net*4-(-5.61538462))<1e-8)
  assert.equal(example.direction,'weakening');assert.equal(example.strength,'slight')
  const cancellingRows=exampleRows.map((r,i)=>({...r,actual:i?1.725:196}))
  const cancelling=run(cancellingRows,['claims'],{savedBands:{claims:{'840140001':[7,14,67],'840140002':[.026,.058,.366]}}}).assessment
  assert.equal(cancelling.net,0,'3/7 ×70 cancels 26/26 ×30 without a rounded-point false lead')
  assert.equal(cancelling.direction,'balanced')
  const signReverse=run(exampleRows.map(r=>({...r,actual:r.previous,previous:r.actual})),['claims'],{savedBands:{claims:{'840140001':[10,20,67],'840140002':[.026,.058,.366]}}}).assessment
  assert.equal(signReverse.net,-example.net,'reversing claims changes reverses the fractional evidence')
  const missingClaims=run(exampleRows.slice(0,1),['claims'],{savedBands:{claims:{'840140001':[10,20,67]}}}).assessment
  assert.equal(missingClaims.unavailable,30);assert.equal(missingClaims.direction,'insufficient','fractional known evidence never fills missing continuing claims')
  assert.equal(run(exampleRows.map(r=>({...r,actual:r.previous})),['claims']).assessment.net,0,'unchanged claims need no boundaries and give zero')
  const slot=(family,value,ref=24313)=>({family,status:'current',nextDue:at+1,assessment:{family,publishedAt:at,reference:ref,leaves:[{id:family,family,label:family,value,budget:100}],...balance([{value,budget:100}])}})
  const fractionalLabor=combineR1([slot('jobs',20),{family:'claims',status:'current',nextDue:at+1,assessment:example}],['jobs','claims'],at)
  assert.ok(Math.abs(fractionalLabor.net-(.8*20+.2*example.net))<1e-8,'labor combines fractional Claims once at the existing 20% share')
  const manufacturingSlot={family:'ism-manufacturing',status:'current',assessment:manufacturing}
  const manufacturingActivity=combineR1([slot('gdp',0),slot('retail',0),slot('ism-services',0),manufacturingSlot],['gdp','retail','ism-services','ism-manufacturing'],at)
  assert.ok(Math.abs(manufacturingActivity.net-manufacturing.net*.1)<1e-8,'routing preserves the original manufacturing allowance')
  assert.equal(manufacturingActivity.leaves.filter(l=>l.family==='ism-manufacturing').length,4)
  assert.deepEqual(manufacturingActivity.categories.map(c=>c.category),['inflation','labor','activity'])
  const manufacturingOnly=combineR1([manufacturingSlot],['ism-manufacturing'],at)
  assert.equal(manufacturingOnly.net,manufacturing.net)
  assert.deepEqual(manufacturingOnly.categories.map(c=>c.share),[.1,.15,.75],'routing cannot normalize each role to a second full vote')
  const allFamilies=['us-cpi','ppi','jobs','claims','gdp','retail','ism-services','ism-manufacturing','fomc']
  const allZero=allFamilies.filter(f=>f!=='ism-manufacturing').map(f=>slot(f,0))
  const full=combineR1([...allZero,manufacturingSlot],allFamilies,at)
  assert.ok(Math.abs(full.net-manufacturing.net*.015)<1e-8,'full-scope manufacturing remains 1.5% overall')
  assert.ok(Math.abs(full.leaves.reduce((s,l)=>s+l.budget,0)-100)<1e-8)
  assert.deepEqual(full.categories.map(c=>Math.round(c.share*1e5)/1e5),[.3515,.30225,.14625,.2])
  const cancellingManufacturing=assessFeatures({...release,familyId:'ism-manufacturing'},r1Profiles['ism-manufacturing'],[.1,-.1,-.4,0].map(feature),[],{mode:'undefined',limits:{'ism-manufacturing/orders':[1.3,3,6],'ism-manufacturing/headline':[2.6,3,6],'ism-manufacturing/employment':[2.6,3,6]}},{})
  assert.equal(cancellingManufacturing.direction,'balanced')
  for(const selected of [['ism-manufacturing'],allFamilies]){
    const aggregate=combineR1([...allZero,{...manufacturingSlot,assessment:cancellingManufacturing}],selected,at)
    assert.equal(aggregate.net,0,'routing and category weighting cannot turn exact three-input cancellation into a false lead')
    assert.equal(aggregate.direction,'balanced')
  }
  for(const status of ['stale','unavailable']){
    const unknown=combineR1([...allZero,{...manufacturingSlot,status}],allFamilies,at)
    assert.equal(unknown.unavailable,1.5)
    assert.deepEqual(unknown.categories.map(c=>Math.round(c.share*1e5)/1e5),[.3515,.30225,.14625,.2],'expiry does not move the routed nominal budgets')
  }
  for(let i=0;i<4;i++){
    const partial=mrun(manufacturingRows.filter((_,j)=>i!==j)).assessment
    const aggregate=combineR1([...allZero,{...manufacturingSlot,assessment:partial}],allFamilies,at)
    assert.ok(Math.abs(aggregate.unavailable-[45,30,15,10][i]*.015)<1e-8)
  }
  const {readingVariants}=await server.ssrLoadModule('./src/scoring-system/r1/assessment.ts')
  assert.equal(manufacturing.sensitive,false)
  for(const variant of readingVariants(manufacturing,r1Profiles['ism-manufacturing'])){
    assert.deepEqual(variant.leaves.map(l=>l.category),manufacturing.leaves.map(l=>l.category),'sensitivity retains economic routing')
    const aggregate=combineR1([...allZero,{...manufacturingSlot,assessment:variant}],allFamilies,at)
    assert.ok(Math.abs(aggregate.net-variant.net*.015)<1e-8)
  }
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
  const fallback=r1Freshness('us-cpi',current,at,[])
  assert.equal(fallback.status,'current');assert.equal(fallback.method,'age-based')
  assert.equal(fallback.nextDue,null,'an age limit is not a fabricated scheduled date')
  assert.equal(fallback.expiresAt,at+45*86400000)
  assert.equal(r1Freshness('us-cpi',current,fallback.expiresAt,[]).status,'current')
  assert.equal(r1Freshness('us-cpi',current,fallback.expiresAt+1,[]).status,'stale')
  assert.equal(r1Freshness('claims',current,at,[]).expiresAt,at+10*86400000)
  assert.equal(r1Freshness('fomc',current,at,[]).expiresAt,at+70*86400000)
  assert.equal(r1Freshness('gdp',current,at,[]).expiresAt,at+45*86400000,'GDP estimate updates use their monthly publication cadence')
  assert.equal(r1Freshness('us-cpi',null,at,[]).method,null)
  assert.equal(r1Freshness('us-cpi',{...current,publishedAt:at+1},at,[]).status,'unavailable','future reports cannot become age-based evidence')
  assert.ok(validR1Settings(settings),'existing version-1 settings inherit the new freshness defaults')
  assert.ok(validR1Freshness(r1DefaultFreshness))
  for(const invalid of [{...r1DefaultFreshness,graceHours:-1},{...r1DefaultFreshness,graceHours:Infinity},{...r1DefaultFreshness,fallbackDays:{}},{...r1DefaultFreshness,fallbackDays:{...r1DefaultFreshness.fallbackDays,claims:0}},{...r1DefaultFreshness,fallbackDays:{...r1DefaultFreshness.fallbackDays,claims:1.5}}])assert.equal(validR1Settings({...settings,freshness:invalid}),false)
  const schedule={family:'us-cpi',dueAt:at+1000,knownAt:at-1000,source:'stored planned observation'}
  assert.equal(r1Freshness('us-cpi',current,at,[schedule]).status,'current')
  assert.equal(r1Freshness('us-cpi',current,at,[schedule]).method,'scheduled')
  assert.equal(r1Freshness('us-cpi',current,at,[schedule]).expiresAt,schedule.dueAt+24*3600000)
  assert.equal(r1Freshness('us-cpi',current,at+86401001,[schedule]).status,'stale')
  assert.deepEqual(r1Freshness('us-cpi',current,at,[{...schedule,knownAt:at+1}]),fallback,'future schedule announcements cannot change historical expiry')
  const amendment={...schedule,dueAt:at+5*86400000,knownAt:at,supersedesDueAt:schedule.dueAt}
  assert.equal(r1Freshness('us-cpi',current,at+86401001,[schedule,amendment]).status,'current','known postponement replaces date')
  const custom={...r1DefaultFreshness,graceHours:0,fallbackDays:{...r1DefaultFreshness.fallbackDays,'us-cpi':2}}
  assert.equal(r1Freshness('us-cpi',current,at,[schedule],custom).expiresAt,schedule.dueAt)
  assert.equal(r1Freshness('us-cpi',current,at,[],custom).expiresAt,at+2*86400000)
  const aged=run(rows,['us-cpi'],{asOf:at+3*86400000,settings:{...settings,selected:['us-cpi'],freshness:custom}})
  assert.equal(aged.overall.slots[0].status,'stale');assert.equal(aged.overall.coverage,0)
  assert.deepEqual(aged.assessment,a,'expiry only affects combined evidence, not the original standalone release')
  const renewedRows=rows.map(r=>({...r,value_id:r.value_id+'next',release_at:at+31*86400000,period_seconds:Date.UTC(2026,2,1)/1000}))
  const renewed=run([...rows,...renewedRows],['us-cpi'],{asOf:at+32*86400000})
  assert.equal(renewed.overall.slots.length,1)
  assert.equal(renewed.overall.slots[0].assessment.publishedAt,at+31*86400000,'the next report replaces the old slot')
  assert.equal(renewed.overall.slots[0].expiresAt,at+76*86400000)
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
