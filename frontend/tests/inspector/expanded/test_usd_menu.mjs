import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/'+p)
  const { assessGdpScore } = await load('inspector/scoring/PAIR/EURUSD/USD/GDP/assessment/gdp-score.ts')
  const { assessPpiScore } = await load('inspector/scoring/PAIR/EURUSD/USD/PPI/assessment/ppi-score.ts')
  const { assessFedScore } = await load('inspector/scoring/PAIR/EURUSD/USD/FED/assessment/fed-score.ts')
  const { groupInspectorReleases: group } = await load('inspector/inspector-data.ts')
  const { prepareScoringSignalHistory: prepare, scoringSignalBinding: bindingFor, scoringSignalModel: model } = await load('scatter-plot/inspection/scoring-signal-model.ts')
  const { scorePublication } = await load('usd-context/core/score-publication.ts')
  const { contextWeights:w, contextFamilyExpiry:expiry } = await load('usd-context/core/policy.ts')
  const { combineContext } = await load('usd-context/core/combine-context.ts')
  const row = (id,at,period,actual,previous=2) => ({ value_id:`${id}/${at}`,event_id:id,server_time_seconds:at/1000,release_at:at,chart_time_seconds:at/1000,period_seconds:period/1000,revision:0,currency:'USD',country_code:'US',country_name:'United States',name:id,event_code:id,importance:'high',unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',actual,previous,forecast:null,revised_previous:null })
  const gdp = (q,stage=0,values=[2+q%3*.2+stage*.1,2.5+q%3*.3+stage*.1,2+q%3*.2+stage*.1]) => ['840010007','840010016','840010018'].map((id,i)=>row(id,Date.UTC(2015,q*3+3+stage,28,12),Date.UTC(2015,q*3,1),values[i]))
  const gh = Array.from({length:40},(_,q)=>[0,1,2].flatMap(s=>gdp(q,s))).flat()
  const up=group(gdp(40,0,[4,4,4]))[0], down=group(gdp(40,0,[-1,-1,-1]))[0]
  assert.equal(assessGdpScore(up,gh).direction,'short');assert.equal(assessGdpScore(down,gh).direction,'long')
  assert.equal(assessGdpScore(up,gh.filter(e=>e.period_seconds!==Date.UTC(2015,39*3,1)/1000)).direction,'uncomputed')
  const first=gdp(40,0,[4,4,4]), revised=group(gdp(40,1,[3.9,4.1,3.9]))[0]
  const rev=assessGdpScore(revised,[...gh,...first]);assert.equal(rev.stage,'revision');assert.equal(rev.readings[0].value,-.1);assert.equal(rev.readings[0].inputs.baseline,4)
  assert.equal(assessGdpScore(revised,gh).stage,'new-quarter')
  const revisedBenchmark={...up,events:up.events.map(e=>({...e,revised_previous:10}))}
  assert.ok(assessGdpScore(revisedBenchmark,gh).readings[0].value<assessGdpScore(up,gh).readings[0].value)
  assert.equal(assessGdpScore({...up,events:[...up.events,{...up.events[0],value_id:'duplicate'}]},gh).direction,'uncomputed')
  const ppi=(m,values=[.2+m%3*.1,.2+m%3*.1,3+m%3*.1,3+m%3*.1])=>['840030001','840030002','840030003','840030004'].map((id,i)=>row(id,Date.UTC(2015,m+1,14,12),Date.UTC(2015,m,1),values[i],i<2?.2:3))
  const ph=Array.from({length:42},(_,m)=>ppi(m)).flat(), hot=group(ppi(42,[.8,.8,4,4]))[0],cool=group(ppi(42,[0,0,2,2]))[0]
  assert.equal(assessPpiScore(hot,ph).direction,'short');assert.equal(assessPpiScore(cool,ph).direction,'long')
  assert.equal(assessPpiScore({...hot,events:hot.events.filter(e=>!['840030002','840030004'].includes(e.event_id))},ph).direction,'uncomputed')
  for(const [r,h,assess,f] of [[up,gh,assessGdpScore,'gdp'],[revised,[...gh,...first],assessGdpScore,'gdp'],[hot,ph,assessPpiScore,'ppi']]){
    const expected=assess(r,h),future=h.map(e=>({...e,value_id:'future/'+e.value_id,release_at:r.releaseAt+86400000}))
    assert.deepEqual(assess(r,[...h,...r.events,...future]),expected)
    assert.deepEqual(assess({...r,events:r.events.map(e=>({...e,forecast:999,impact:'negative'}))},h.map(e=>({...e,forecast:999}))),expected)
    assert.deepEqual(assess(r,[...h,...h]),expected)
    const b=bindingFor(f),prepared=prepare([...h,...r.events],r.releaseAt,b)
    for(const signal of b.signals){const inspection=model(prepared,b,signal.id,r.id).inspection,plotted=inspection.signal,actual=expected.readings.find(x=>x.id===signal.id)
      assert.equal(inspection.distribution.count,actual.sampleCount,'Distribution must use the selected estimate type, not mixed calibration populations')
      for(const key of ['value','points','limits','sampleCount','inputs','reason'])assert.deepEqual(plotted[key],actual[key],`${f}/${signal.id}/${key}`)
      const settings={[signal.id]:[.001,.002,.003]};assert.equal(model(prepared,b,signal.id,r.id,settings).inspection.signal.points,assess(r,h,settings).readings.find(x=>x.id===signal.id).points)
    }
    assert.equal(scorePublication(r,h,{}).total,expected.total)
    for(const patch of [{unit:0},{multiplier:2},{actual:NaN},{actual_raw_scaled_1e6:'bad'},{country_code:'CA'},{availability:'not-returned-by-latest-query'},{time_mode:1}])assert.equal(assess({...r,events:r.events.map(e=>({...e,...patch}))},h).direction,'uncomputed')
    assert.equal(assess({...r,timingUncertain:true},h).direction,'uncomputed')
  }
  const at=Date.UTC(2025,7,1),rate=d=>group([row('840050014',at,0,4.5+d,4.5)])[0]
  assert.equal(assessFedScore(rate(.25)).direction,'short');assert.equal(assessFedScore(rate(-.25)).direction,'long')
  assert.equal(assessFedScore(rate(0)).direction,'uncomputed');assert.equal(assessFedScore(rate(0)).action,'Rate hold')
  assert.equal(assessFedScore({...rate(.25),timingUncertain:true}).direction,'uncomputed')
  assert.equal(assessFedScore(group([{...row('840050021',at,0,null),previous:null}])[0]).direction,'uncomputed')
  assert.equal(Object.values(w).reduce((a,b)=>a+b,0),100);assert.equal(w.cpi+w.pce+w.ppi,40);assert.equal(w.ism+w.retail+w.gdp,20)
  const source={family:'gdp',sourceId:'a',sourceLabel:'GDP',releaseAt:1,chartAt:1,total:2,usdDirection:'stronger',strength:'strong',reason:'',explanation:'',changeSize:null,reduced:false,tie:false}
  assert.equal(combineContext({gdp:source},['gdp'],1).total,.06);assert.equal(combineContext({gdp:source},['gdp'],1+expiry('gdp')).direction,'uncomputed')
  console.log('✓ GDP stages/continuity, PPI core gates, Fed actions/text coverage, no forecast/future inputs, Scatter parity, budgets and expiry')
}finally{await server.close()}
