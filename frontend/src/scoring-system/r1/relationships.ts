import { balance, multiplyLeaves, precise } from './arithmetic'
import type { R1Aggregate, R1Assessment, R1Category, R1CategoryResult, R1Family, R1Leaf, R1Settings, R1Slot } from './contracts'
export {r1Freshness} from './freshness'

export const r1CategoryWeights:Record<R1Category,number>={inflation:.35,labor:.30,activity:.15,policy:.20}
const labels:Record<R1Category,string>={inflation:'Inflation',labor:'Labor',activity:'Activity',policy:'Fed action'}
type Shares={ppi:number;jobs:number;gdp:number;overall:Record<R1Category,number>}
export const preferredShares:Shares={ppi:.1,jobs:.8,gdp:.5,overall:r1CategoryWeights}
const absent=(family:R1Family,reason:string):R1Leaf[]=>[{id:`unavailable/${family}`,family,label:reason,value:null,budget:100,role:reason}]
const usable=(slot:R1Slot|undefined,family:R1Family)=>slot?.status==='current'&&slot.assessment?slot.assessment.leaves:absent(family,slot?.status==='stale'?'Update overdue':'Evidence unavailable')
function category(category:R1Category,leaves:R1Leaf[],anchor?:R1Family,reference?:number|null):R1CategoryResult {
  return {...balance(leaves),category,label:labels[category],leaves,...(anchor?{anchor,reference}:{} )}
}
export function combineR1(slots:readonly R1Slot[],selected:readonly R1Family[],at:number,shares:Shares=preferredShares):R1Aggregate {
  const chosen=[...new Set(selected)],map=new Map(slots.map(s=>[s.family,s])),categories:R1CategoryResult[]=[]
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
    }
  }
  const weighted=(cat:R1Category,weights:Partial<Record<R1Family,number>>)=>{
    const families=chosen.filter(f=>Object.hasOwn(weights,f)),denominator=families.reduce((s,f)=>s+weights[f]!,0)
    if(denominator)categories.push(category(cat,families.flatMap(f=>multiplyLeaves(usable(map.get(f),f),weights[f]!/denominator))))
  }
  weighted('labor',{jobs:shares.jobs,claims:1-shares.jobs})
  weighted('activity',{gdp:shares.gdp,retail:(1-shares.gdp)*.4,'ism-services':(1-shares.gdp)*.4,'ism-manufacturing':(1-shares.gdp)*.2})
  weighted('policy',{fomc:1})
  const denominator=categories.reduce((s,c)=>s+shares.overall[c.category],0)
  const leaves=denominator?categories.flatMap(c=>multiplyLeaves(c.leaves,shares.overall[c.category]/denominator,c.label)):[]
  const result=balance(leaves)
  const winner=categories.filter(c=>Math.sign(c.net)===(result.direction==='strengthening'?1:-1)).sort((a,b)=>Math.abs(b.net*shares.overall[b.category])-Math.abs(a.net*shares.overall[a.category]))[0]
  const opponent=categories.filter(c=>Math.sign(c.net)===(result.direction==='strengthening'?-1:1)).sort((a,b)=>Math.abs(b.net*shares.overall[b.category])-Math.abs(a.net*shares.overall[a.category]))[0]
  const explanation=result.direction==='empty'?'Select USD evidence.':result.direction==='insufficient'?'Unavailable evidence could change the direction.':result.direction==='balanced'?'The weighted evidence balances.':opponent?`${winner?.label??'Leading'} evidence outweighs opposing ${opponent.label.toLowerCase()} evidence.`:`${winner?.label??'Selected'} evidence supports USD ${result.direction==='strengthening'?'strength':'weakness'}.`
  return{...result,at,categories,leaves,slots:[...slots],selected:chosen,explanation,timingSensitive:false}
}
export function aggregateSensitivity(preferred:R1Aggregate,settings:R1Settings,familyAlternatives:Partial<Record<R1Family,R1Assessment[]>>) {
  const variants:R1Aggregate[]=[]
  for(const [family,assessments]of Object.entries(familyAlternatives))for(const assessment of assessments!)variants.push(combineR1(preferred.slots.map(s=>s.family===family?{...s,assessment}:s),settings.selected,preferred.at))
  for(const ppi of [0,.1,.2])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,ppi}))
  for(const jobs of [.6,.8,.9])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,jobs}))
  for(const gdp of [.3,.5,.7])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,gdp}))
  for(const overall of [{inflation:.3,labor:.3,activity:.15,policy:.25},{inflation:.4,labor:.3,activity:.2,policy:.1}])variants.push(combineR1(preferred.slots,settings.selected,preferred.at,{...preferredShares,overall}))
  preferred.sensitive=variants.some(v=>v.direction!==preferred.direction)
  preferred.sensitivityRange=[precise(Math.min(preferred.interval[0],...variants.map(v=>v.interval[0]))),precise(Math.max(preferred.interval[1],...variants.map(v=>v.interval[1])))]
  for(const cat of preferred.categories){cat.sensitive=variants.some(v=>v.categories.find(c=>c.category===cat.category)?.direction!==cat.direction)}
  return preferred
}
