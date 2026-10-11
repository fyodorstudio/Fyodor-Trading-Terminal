import { balance, multiplyLeaves, precise } from './arithmetic'
import type { R1Aggregate, R1Assessment, R1Category, R1CategoryResult, R1Family, R1Leaf, R1Settings, R1Slot } from './contracts'
import {r1Profiles} from './profiles'
import {consumerPolicyEvidence,interpretFedPolicy,policyContextShare,policyEvidenceVariants} from './policy-context'
import type {R1PolicyEvidence,R1Reading} from './contracts'
export {r1Freshness} from './freshness'

export const r1CategoryWeights:Record<R1Category,number>={inflation:.30,labor:.30,activity:.20,policy:.20}
const labels:Record<R1Category,string>={inflation:'Inflation',labor:'Labor',activity:'Activity',policy:'Fed policy interpretation'}
type Shares={ppi:number;jobs:number;gdp:number;context:number;overall:Record<R1Category,number>}
export const preferredShares:Shares={ppi:.1,jobs:.8,gdp:.5,context:policyContextShare,overall:r1CategoryWeights}
const absent=(family:R1Family,reason:string):R1Leaf[]=>[{id:`unavailable/${family}`,family,label:reason,value:null,budget:100,role:reason}]
const usable=(slot:R1Slot|undefined,family:R1Family):R1Leaf[]=>{
  if(slot?.status==='current'&&slot.assessment)return slot.assessment.leaves
  const reason=slot?.status==='stale'?'Update overdue':'Evidence unavailable'
  return family==='ism-manufacturing'?r1Profiles[family].components.map(c=>({id:`unavailable/${family}/${c.id}`,family,label:c.label,value:null,budget:c.weight,category:c.relationshipCategory,role:reason})):absent(family,reason)
}
function category(category:R1Category,leaves:R1Leaf[],anchor?:R1Family,reference?:number|null):R1CategoryResult {
  return {...balance(leaves),category,label:labels[category],leaves,...(anchor?{anchor,reference}:{} )}
}
export function combineR1(slots:readonly R1Slot[],selected:readonly R1Family[],at:number,shares:Shares=preferredShares):R1Aggregate {
  const chosen=[...new Set(selected)],map=new Map(slots.map(s=>[s.family,s])),categories:R1CategoryResult[]=[],contexts=new Map<R1Category,R1PolicyEvidence>()
  const contextEnabled=chosen.includes('fomc')&&slots.some(s=>s.assessment?.policy)
  const context=(family:R1Family):R1PolicyEvidence=>{
    const slot=map.get(family),a=slot?.assessment
    return {leaves:slot?.status==='current'?a?.policy?.leaves??absent(family,'Policy context unavailable'):absent(family,'Policy context expired or unavailable'),readings:a?.policy?.readings??[]}
  }
  const consumers=chosen.filter(f=>f==='us-cpi'||f==='pce')
  if(consumers.length||chosen.includes('ppi')){
    if(!consumers.length)categories.push(category('inflation',usable(map.get('ppi'),'ppi')))
    else {
      const available=consumers.map(f=>({family:f,assessment:map.get(f)?.assessment??null}))
      const ambiguous=available.some(s=>s.assessment===null||s.assessment.reference===null)
      const consumer=available.sort((a,b)=>(b.assessment?.reference??-Infinity)-(a.assessment?.reference??-Infinity)||(a.family==='pce'?-1:1))[0]
      const anchor=consumer.family,ref=consumer.assessment?.reference??null,hasPpi=chosen.includes('ppi')
      const consumerLeaves=ambiguous?absent(anchor,'Consumer reference period unavailable'):usable(map.get(anchor),anchor)
      const producer=map.get('ppi'),matched=!ambiguous&&ref!==null&&producer?.assessment?.reference===ref
      const leaves=hasPpi?[...multiplyLeaves(consumerLeaves,1-shares.ppi,'Consumer anchor'),...multiplyLeaves(matched?usable(producer,'ppi'):absent('ppi','PPI reference month differs or is unavailable'),shares.ppi,'Producer modifier')]:consumerLeaves
      categories.push(category('inflation',leaves,anchor,ref))
      const consumerContext=consumerPolicyEvidence(map.get(anchor),chosen.includes('pce')?map.get('pce'):undefined)
      const state=ambiguous||map.get(anchor)?.status!=='current'?{leaves:absent(anchor,'Consumer context unavailable'),readings:[]}:consumerContext??context(anchor)
      const ppi=matched?context('ppi'):{leaves:absent('ppi','PPI reference month differs or is unavailable'),readings:[]}
      contexts.set('inflation',hasPpi?{leaves:[...multiplyLeaves(state.leaves,1-shares.ppi),...multiplyLeaves(ppi.leaves,shares.ppi)],readings:[...state.readings.map(r=>({...r,weight:r.weight*(1-shares.ppi),contribution:r.contribution===null?null:r.contribution*(1-shares.ppi)})),...ppi.readings.map(r=>({...r,weight:r.weight*shares.ppi,contribution:r.contribution===null?null:r.contribution*shares.ppi}))]}:state)
    }
  }
  const weighted=(cat:R1Category,weights:Partial<Record<R1Family,number>>)=>{
    const families=chosen.filter(f=>Object.hasOwn(weights,f)),denominator=families.reduce((s,f)=>s+weights[f]!,0)
    if(denominator){
      categories.push(category(cat,families.flatMap(f=>multiplyLeaves(usable(map.get(f),f),weights[f]!/denominator))))
      contexts.set(cat,{leaves:families.flatMap(f=>multiplyLeaves(context(f).leaves,weights[f]!/denominator)),readings:families.flatMap(f=>context(f).readings.map(r=>({...r,weight:r.weight*weights[f]!/denominator,contribution:r.contribution===null?null:r.contribution*weights[f]!/denominator})))})
    }
  }
  weighted('labor',{jobs:shares.jobs,claims:1-shares.jobs})
  weighted('activity',{gdp:shares.gdp,retail:(1-shares.gdp)*.4,'ism-services':(1-shares.gdp)*.4,'ism-manufacturing':(1-shares.gdp)*.2})
  weighted('policy',{fomc:1})
  const denominator=categories.reduce((s,c)=>s+shares.overall[c.category],0)
  // Allocate the existing family/category budgets first, then route manufacturing
  // components once. Routing must not create new budgets or normalize each role
  // into a second full-family vote.
  const policyReadings:R1Reading[]=[],policyLeaves:R1Leaf[]=[]
  const leaves=denominator?categories.flatMap(c=>{
    const share=shares.overall[c.category]/denominator,split=contextEnabled&&c.category!=='policy'?shares.context:0
    const original=multiplyLeaves(c.leaves,share*(1-split)).map(l=>({...l,category:l.category??c.category,role:labels[l.category??c.category]}))
    if(!split)return original
    const evidence=contexts.get(c.category)??{leaves:absent(c.anchor??'ppi','Policy context unavailable'),readings:[]}
    const fedCurrent=map.get('fomc')?.status==='current'
    const contextual=multiplyLeaves(evidence.leaves,share*split).map(l=>({...l,value:fedCurrent?l.value:null,category:'policy' as const,role:`Inferred policy context: ${l.category??c.category}`}))
    policyLeaves.push(...contextual)
    policyReadings.push(...evidence.readings.map(r=>({...r,id:`${c.category}/${r.seriesId}/${r.id}`,weight:r.weight*share*split,contribution:fedCurrent&&r.contribution!==null?r.contribution*share*split:null})))
    return [...original,...contextual]
  }):[]
  const routed=contextEnabled||categories.some(c=>c.leaves.some(l=>l.category&&l.category!==c.category))
  const results=routed?(Object.keys(labels) as R1Category[]).flatMap(cat=>{
    const group=leaves.filter(l=>l.category===cat),budget=group.reduce((s,l)=>s+l.budget,0)
    if(!budget)return []
    const original=categories.find(c=>c.category===cat)
    return [{...category(cat,multiplyLeaves(group,100/budget),original?.anchor,original?.reference),share:budget/100}]
  }):categories.map(c=>({...c,share:shares.overall[c.category]/denominator}))
  const result=balance(leaves)
  const winner=results.filter(c=>Math.sign(c.net)===(result.direction==='strengthening'?1:-1)).sort((a,b)=>Math.abs(b.net*b.share!)-Math.abs(a.net*a.share!))[0]
  const opponent=results.filter(c=>Math.sign(c.net)===(result.direction==='strengthening'?-1:1)).sort((a,b)=>Math.abs(b.net*b.share!)-Math.abs(a.net*a.share!))[0]
  const explanation=result.direction==='empty'?'Select USD evidence.':result.direction==='insufficient'?'Unavailable evidence could change the direction.':result.direction==='balanced'?'The weighted evidence balances.':opponent?`${winner?.label??'Leading'} evidence outweighs opposing ${opponent.label.toLowerCase()} evidence.`:`${winner?.label??'Selected'} evidence supports USD ${result.direction==='strengthening'?'strength':'weakness'}.`
  const action=map.get('fomc')?.assessment
  const policyInterpretation=action?.readings?.length?interpretFedPolicy(action,{leaves:policyLeaves,readings:policyReadings}):undefined
  return{...result,at,categories:results,leaves,slots:[...slots],selected:chosen,explanation,timingSensitive:false,...(policyInterpretation?{policyInterpretation}:{})}
}
export function aggregateSensitivity(preferred:R1Aggregate,settings:R1Settings,familyAlternatives:Partial<Record<R1Family,R1Assessment[]>>) {
  const variants:R1Aggregate[]=[]
  for(const [family,assessments]of Object.entries(familyAlternatives))for(const assessment of assessments!)variants.push(combineR1(preferred.slots.map(s=>s.family===family?{...s,assessment}:s),settings.selected,preferred.at))
  for(const slot of preferred.slots)if(slot.assessment?.policy)for(const policy of policyEvidenceVariants(slot.assessment.policy,slot.family,slot.assessment.releaseId))variants.push(combineR1(preferred.slots.map(s=>s===slot?{...s,assessment:{...slot.assessment!,policy}}:s),settings.selected,preferred.at))
  for(const ppi of [0,.1,.2])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,ppi}))
  for(const jobs of [.6,.8,.9])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,jobs}))
  for(const gdp of [.3,.5,.7])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,gdp}))
  for(const context of [.2,.3])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,context}))
  for(const overall of [{inflation:.3,labor:.3,activity:.15,policy:.25},{inflation:.4,labor:.3,activity:.2,policy:.1}])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,overall}))
  preferred.sensitive=variants.some(v=>v.direction!==preferred.direction)
  preferred.sensitivityRange=[precise(Math.min(preferred.interval[0],...variants.map(v=>v.interval[0]))),precise(Math.max(preferred.interval[1],...variants.map(v=>v.interval[1])))]
  for(const cat of preferred.categories){cat.sensitive=variants.some(v=>v.categories.find(c=>c.category===cat.category)?.direction!==cat.direction)}
  return preferred
}
