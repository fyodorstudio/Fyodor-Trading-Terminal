import {balance,precise,usesFractionalMagnitude} from './arithmetic'
import type {R1Assessment,R1Category,R1Family,R1Reading,R1Slot} from './contracts'
import {createR1History} from './features'
import {derivePolicyEvidence} from './policy-context'
import {r1Families,r1Profiles} from './profiles'
import {combineR1,preferredShares} from './relationships'

// Project allocation metadata through the actual routing engine. These fixtures
// supply budgets only; their values are never presented as economic evidence.
const history=createR1History([])
const slots:R1Slot[]=r1Families.map(family=>{
  const profile=r1Profiles[family]
  const readings:R1Reading[]=profile.components.map(c=>({...c,actual:0,previous:0,delta:0,reference:0,previousReference:-1,publishedAt:0,valueId:null,revision:null,basis:'Actual − Previous',reason:'',points:0,magnitude:0,contribution:0,limits:null,calibration:'undefined',samples:0}))
  const leaves=readings.map(r=>({id:r.id,family,label:r.label,value:0,budget:r.weight,category:r.relationshipCategory}))
  const assessment:R1Assessment={...balance(leaves),family,label:profile.label,version:profile.version,releaseId:family,publishedAt:0,reference:0,stage:'momentum',readings,leaves,explanation:''}
  assessment.policy=derivePolicyEvidence(assessment,profile,history,0)
  return {family,assessment,status:'current',nextDue:null,expiresAt:null,method:null,graceHours:0,fallbackDays:0}
})

export function r1AllocationAudit(selected:readonly R1Family[]) {
  const result=combineR1(slots,selected,0)
  const origins=[...new Set(selected.filter(f=>r1Families.includes(f)).map(f=>r1Profiles[f].category))]
  const denominator=origins.reduce((sum,c)=>sum+preferredShares.overall[c],0)
  const context=selected.includes('fomc')&&origins.some(c=>c!=='policy')?preferredShares.context:0
  return (['inflation','labor','activity','policy'] as R1Category[]).map(category=>{
    const base=denominator&&origins.includes(category)?preferredShares.overall[category]/denominator*100:0
    const routed=category==='policy'?0:base*context
    return {category,base:precise(base),retained:precise(base-routed),routed:precise(routed),effective:precise((result.categories.find(c=>c.category===category)?.share??0)*100)}
  })
}

const full=combineR1(slots,r1Families,0).policyInterpretation!
export const fedPolicyInputAudit=full.readings.filter(r=>r.period!=='action').map(r=>{
  const family=r1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===r.seriesId))!
  const component=r1Profiles[family].components.find(c=>c.seriesId===r.seriesId)!
  return {id:r.id,family,component:component.id,label:r.label,weight:precise(r.weight),basis:r.basis,limits:r.limits,unit:r.unit,
    consumer:(family==='us-cpi'||family==='pce')&&!r.id.endsWith('/pce-target'),
    fractional:r.limits!==null||family==='us-cpi'||family==='pce'||usesFractionalMagnitude(family)}
})
export const fedPolicyGroupAudit=(['inflation','labor','activity'] as const).map(category=>({category,weight:precise(full.leaves.filter(l=>l.role===`Inferred policy context: ${category}`).reduce((sum,l)=>sum+l.budget,0))}))
