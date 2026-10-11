import {balance,decimal,magnitude,magnitudePoints,multiplyLeaves,precise} from './arithmetic'
import {reference,validR1Reading,type R1History} from './features'
import type {R1Assessment,R1PolicyEvidence,R1Profile,R1Reading,R1Slot} from './contracts'

// Explicit model policies, not estimates of the Fed's unpublished forecasts.
export const policyContextVersion='USD-FED-POLICY-R1.3'
export const policyContextShare=.25
export const policyLevelLimits={inflation:[.5,1,2],payrolls:[100,200,300],gdp:[1,2,4],sales:[.2,.5,1],survey:[2,5,10]} as const

function reading(r:R1Reading,id:string,label:string,weight:number,actual:number|null,previous:number|null,delta:number|null,limits:readonly number[]|null,basis:string,calibration=r.calibration):R1Reading {
  const points=delta===null?null:delta===0?0:limits?r.polarity*Math.sign(delta)*magnitudePoints('claims',delta,limits):null
  return {...r,id,label,weight,actual,previous,delta,limits:limits?[...limits] as [number,number,number]:null,basis,
    points,magnitude:points===null?null:delta===0?0:magnitude(delta!,limits!),contribution:points===null?null:precise(weight*points),
    calibration:delta===0?'unchanged':calibration,samples:calibration==='policy-fixed'?0:r.samples,reason:delta===null?'Comparable policy context is unavailable.':points===null?'Magnitude boundaries are unavailable.':''}
}
export function policyEvidence(readings:R1Reading[],family:R1Assessment['family'],sourceId:string):R1PolicyEvidence {
  return {readings,leaves:readings.map(r=>({id:`${sourceId}/policy/${r.id}`,family,label:r.label,value:r.contribution===null?null:r.contribution/4,budget:r.weight,sourceId,category:r.relationshipCategory}))}
}
export function derivePolicyEvidence(a:R1Assessment,profile:R1Profile,history:R1History,at:number):R1PolicyEvidence|undefined {
  if(profile.currency==='EUR'||a.family==='fomc')return undefined
  const past=(r:R1Reading,offset:number)=>{
    if(r.reference===null)return null
    const expected=r.reference-offset*(r.period==='week'?604800:1),row=history.latest(r.seriesId,expected,r.period,at)
    if(!row||reference(row,r.period)!==expected||!validR1Reading(row,r,at,profile))return null
    const value=decimal(row.actual,row.actual_raw_scaled_1e6)
    return value===null?null:value/1e6*(r.scale??1)
  }
  const average=(r:R1Reading,count:number,offset=0)=>{
    const values=Array.from({length:count},(_,i)=>i+offset===0?r.actual:past(r,i+offset))
    return values.some(v=>v===null)?null:precise(values.reduce<number>((s,v)=>s+v!,0)/count)
  }
  let readings:R1Reading[]
  if(a.family==='us-cpi'||a.family==='pce'){
    readings=a.readings.filter(r=>r.id.endsWith('annual')).flatMap(r=>{
      const weight=r.id==='core-annual'?60:40,previous=past(r,3)
      return [reading(r,`${r.id}/recent`,`${r.label}: latest change`,weight*.7,r.actual,r.previous,r.delta,r.limits,'Latest annual inflation change'),
        reading(r,`${r.id}/trend`,`${r.label}: three-month trend`,weight*.3,r.actual,previous,r.actual===null||previous===null?null:precise((r.actual-previous)/3),r.limits,'Average annual-inflation change per month over three months')]
    })
  }else readings=a.readings.map(r=>{
    if(a.family==='jobs'&&r.id==='payrolls'){
      const actual=average(r,3)
      return reading(r,r.id,'Three-month average payroll growth',r.weight,actual,0,actual,policyLevelLimits.payrolls,'Three distinct reference months; zero means no net job growth','policy-fixed')
    }
    if(a.family==='jobs'&&r.id==='unemployment'){
      const previous=past(r,3)
      return reading(r,r.id,'Unemployment three-month trend',r.weight,r.actual,previous,r.actual===null||previous===null?null:precise((r.actual-previous)/3),r.limits,'Average unemployment change per month over three months')
    }
    if(a.family==='claims'){
      const actual=average(r,4),previous=average(r,4,4)
      return reading(r,r.id,`${r.label}: four-week trend`,r.weight,actual,previous,actual===null||previous===null?null:precise(actual-previous),r.limits,'Latest four-week average versus preceding four-week average')
    }
    if(a.family==='gdp')return reading(r,r.id,'GDP growth level',r.weight,r.actual,0,r.actual,policyLevelLimits.gdp,'Latest quarter growth versus zero; not an output-gap estimate','policy-fixed')
    if(a.family==='retail'){
      const actual=average(r,3)
      return reading(r,r.id,'Three-month average nominal sales growth',r.weight,actual,0,actual,policyLevelLimits.sales,'Three distinct reference months versus zero nominal growth','policy-fixed')
    }
    if(a.family==='ism-services'||a.family==='ism-manufacturing'&&r.id!=='prices')return reading(r,r.id,`${r.label}: survey level`,r.weight,r.actual,50,r.actual===null?null:precise(r.actual-50),policyLevelLimits.survey,'Survey level versus 50','policy-fixed')
    return {...r}
  })
  return policyEvidence(readings,a.family,a.releaseId)
}

export function consumerPolicyEvidence(anchor:R1Slot|undefined,pce:R1Slot|undefined):R1PolicyEvidence|undefined {
  if(!anchor?.assessment?.policy)return undefined
  const a=anchor.assessment,policy=anchor.assessment.policy,r=pce?.assessment?.readings.find(r=>r.id==='headline-annual'),template=r??a.readings.find(r=>r.id==='headline-annual')!
  const actual=pce?.status==='current'?r?.actual??null:null
  const gap=reading({...template,polarity:1},'pce-target','Headline PCE versus 2% target',25,actual,2,actual===null?null:precise(actual-2),policyLevelLimits.inflation,'Latest published headline PCE versus 2%; model policy-pressure input','policy-fixed')
  const readings=[gap,...policy.readings.map(r=>({...r,weight:r.weight*.75,contribution:r.contribution===null?null:r.contribution*.75}))]
  const gapLeaves=policyEvidence([gap],'pce',pce?.assessment?.releaseId??'missing/pce-target').leaves
  return {readings,leaves:[...gapLeaves,...multiplyLeaves(policy.leaves,.75)]}
}

export function interpretFedPolicy(action:R1Assessment,context:R1PolicyEvidence):R1Assessment {
  const total=context.leaves.reduce((s,l)=>s+l.budget,0)
  const leaves=total?multiplyLeaves(context.leaves,100/total):[{id:'missing/fed-context',family:'fomc' as const,label:'Policy context unavailable',value:null,budget:100}]
  const result=balance(leaves),direction=result.direction
  const explanation=direction==='insufficient'?'Policy context is incomplete.':direction==='balanced'?'Opposing policy pressures balance.':`Economic conditions imply ${direction==='strengthening'?'upward':'reduced'} rate pressure; model inference.`
  const readings=context.readings.map(r=>({...r,weight:total?r.weight*100/total:r.weight,contribution:total&&r.contribution!==null?r.contribution*100/total:r.contribution}))
  const missing=100-readings.reduce((s,r)=>s+r.weight,0)
  if(missing>1e-7)readings.push({...action.readings[0],id:'missing-context',label:'Unavailable policy context',weight:missing,period:'month',unit:'pts',actual:null,previous:null,delta:null,points:null,magnitude:null,contribution:null,limits:null,basis:'Missing or expired economic inputs',reason:'Policy context is incomplete.'})
  return {...action,...result,label:'Fed policy interpretation',version:policyContextVersion,contextual:true,leaves,
    readings:[...action.readings.map(r=>({...r,weight:0,contribution:r.contribution===null?null:0})),...readings],explanation}
}

export function policyEvidenceVariants(evidence:R1PolicyEvidence,family:R1Assessment['family'],sourceId:string):R1PolicyEvidence[] {
  return [.9,1.1].map(factor=>policyEvidence(evidence.readings.map(r=>{
    const points=r.delta===null?null:r.delta===0?0:r.limits?r.polarity*Math.sign(r.delta)*magnitudePoints('claims',r.delta,r.limits,factor):null
    return {...r,points,contribution:points===null?null:precise(r.weight*points)}
  }),family,sourceId))
}

// The release interpretation compares inferred pressure at consecutive decisions.
// Retained overall evidence uses current pressure, so a hold does not invent news.
export function compareFedPolicy(current:R1Assessment,previous:R1Assessment|undefined):R1Assessment {
  const old=previous?.leaves??[{id:'missing/previous-fed-context',family:'fomc' as const,label:'Previous decision context unavailable',value:null,budget:100}]
  const leaves=[...multiplyLeaves(current.leaves,.5),...multiplyLeaves(old,.5).map(l=>({...l,id:`previous/${l.id}`,value:l.value===null?null:-l.value}))]
  const result=balance(leaves),template=current.readings[0]
  const readings=current.readings.filter(r=>r.period==='action')
  for(const group of ['inflation','labor','activity']){
    const role=`Inferred policy context: ${group}`,now=current.leaves.filter(l=>l.role===role),before=old.filter(l=>l.role===role)
    const budget=now.reduce((s,l)=>s+l.budget,0),oldBudget=before.reduce((s,l)=>s+l.budget,0)
    if(!budget)continue
    const actual=now.every(l=>l.value===null)?null:balance(now).net*100/budget
    const baseline=!oldBudget||before.every(l=>l.value===null)?null:balance(before).net*100/oldBudget
    const delta=actual===null||baseline===null?null:precise(actual-baseline)
    const known=precise((balance(now).net-balance(before).net)/2)
    readings.push({...template,id:`policy-change/${group}`,seriesId:`policy/${group}`,label:`${group[0].toUpperCase()+group.slice(1)} policy pressure`,period:'month',unit:'pts',weight:budget,
      actual,previous:baseline,delta,points:delta===null?null:delta/50,magnitude:delta===null?null:magnitude(delta,[50,100,150]),contribution:known*4,limits:[50,100,150],
      basis:'Inferred pressure versus previous Fed decision',reason:now.some(l=>l.value===null)||before.some(l=>l.value===null)||!oldBudget?'Policy comparison is incomplete.':'',calibration:'policy-comparison',vintage:undefined,knownAt:null,valueId:null,revision:null,reference:null,previousReference:null})
  }
  if(!previous)readings.push({...template,id:'missing-previous-policy',label:'Previous decision context unavailable',period:'month',unit:'pts',weight:0,actual:null,previous:null,delta:null,points:null,magnitude:null,contribution:null,limits:null,reason:'Previous decision context is unavailable.'})
  const explanation=result.direction==='insufficient'?'Policy comparison is incomplete.':result.direction==='balanced'?'Inferred rate pressure is unchanged.':`Inferred rate pressure ${result.direction==='strengthening'?'increased':'decreased'} since the previous Fed decision.`
  if(!readings.some(r=>r.id.startsWith('policy-change/')))readings.push({...template,id:'missing-current-policy',label:'Current decision context unavailable',period:'month',unit:'pts',weight:100,actual:null,previous:null,delta:null,points:null,magnitude:null,contribution:null,limits:null,reason:'Current decision context is unavailable.'})
  return {...current,...result,leaves,readings,explanation,policyComparison:{previousAt:previous?.publishedAt??null,current:current.readings.filter(r=>r.period!=='action'),previous:previous?.readings.filter(r=>r.period!=='action')??[]}}
}

export function policySummaryReading(a:R1Assessment):R1Reading {
  if(!a.contextual)return {...a.readings[0],id:'policy-total',label:'Fed hold policy interpretation',period:'month',unit:'pts',weight:100,actual:null,previous:null,delta:null,points:null,magnitude:null,contribution:null,limits:null,basis:'Hold comparison',reason:'This decision changed the rate; use Fed target rate.',calibration:'policy-comparison'}
  const groups=a.readings.filter(r=>r.id.startsWith('policy-change/'))
  const actual=groups.length&&groups.every(r=>r.actual!==null)?groups.reduce((s,r)=>s+r.actual!*r.weight/100,0):null
  const previous=groups.length&&groups.every(r=>r.previous!==null)?groups.reduce((s,r)=>s+r.previous!*r.weight/100,0):null
  return {...a.readings[0],id:'policy-total',label:'Fed hold policy interpretation',period:'month',unit:'pts',weight:100,actual,previous,
    delta:actual===null||previous===null?null:precise(actual-previous),points:a.unavailable?null:a.net/25,magnitude:a.unavailable?null:magnitude(a.net*2,[50,100,150]),contribution:a.unavailable?null:a.net*4,
    limits:[50,100,150],basis:'Inferred policy pressure at the previous Fed decision',reason:a.contextual?a.unavailable?'Policy comparison is incomplete.':'':'This decision changed the rate; use Fed target rate.',calibration:'policy-comparison'}
}
