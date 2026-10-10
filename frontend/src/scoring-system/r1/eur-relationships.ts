import {balance,multiplyLeaves} from './arithmetic'
import type {R1Aggregate,R1Category,R1CategoryResult,R1Family,R1Leaf,R1Slot} from './contracts'

export const eurCategoryWeights:Record<R1Category,number>={inflation:.4,labor:.2,activity:.2,policy:.2}
const labels:Record<R1Category,string>={inflation:'Inflation',labor:'Labor',activity:'Activity',policy:'ECB action'}
const unknown=(family:R1Family):R1Leaf[]=>[{id:`unavailable/${family}`,family,label:'Evidence unavailable',value:null,budget:100}]
export function combineEurR1(slots:readonly R1Slot[],selected:readonly R1Family[],at:number,weights=eurCategoryWeights):R1Aggregate {
  const map=new Map(slots.map(s=>[s.family,s])),categories:R1CategoryResult[]=[]
  const usable=(family:R1Family)=>map.get(family)?.status==='current'?map.get(family)!.assessment?.leaves??unknown(family):unknown(family)
  const weighted=(category:R1Category,shares:Partial<Record<R1Family,number>>)=>{
    const families=selected.filter(f=>Object.hasOwn(shares,f)),total=families.reduce((s,f)=>s+shares[f]!,0)
    if(total){const leaves=families.flatMap(f=>multiplyLeaves(usable(f),shares[f]!/total));categories.push({...balance(leaves),category,label:labels[category],leaves})}
  }
  // National HICP/PMI remain standalone early context, never a second area vote.
  weighted('inflation',{'euro-inflation':.85,'euro-wages':.15})
  weighted('labor',{'euro-labor':.6,'euro-employment':.4})
  const pmiFamilies: R1Family[]=['euro-pmi','euro-services-pmi','euro-manufacturing-pmi']
  const chosen=pmiFamilies.filter(f=>selected.includes(f))
  const ref=Math.max(-Infinity,...chosen.map(f=>map.get(f)?.assessment?.reference??-Infinity))
  const composite=map.get('euro-pmi'),useComposite=chosen.includes('euro-pmi')&&composite?.assessment?.reference===ref
  let pmiLeaves:R1Leaf[]=unknown('euro-pmi')
  if(useComposite)pmiLeaves=usable('euro-pmi')
  else {
    const sectors=chosen.filter(f=>f!=='euro-pmi'),total=sectors.reduce((s,f)=>s+(f==='euro-services-pmi'?.7:.3),0)
    if(total)pmiLeaves=sectors.flatMap(f=>multiplyLeaves(map.get(f)?.assessment?.reference===ref?usable(f):unknown(f),(f==='euro-services-pmi'?.7:.3)/total))
  }
  const hasGdp=selected.includes('euro-gdp'),hasPmi=chosen.length>0
  if(hasGdp||hasPmi){const leaves=hasGdp&&hasPmi?[...multiplyLeaves(usable('euro-gdp'),.4),...multiplyLeaves(pmiLeaves,.6)]:hasGdp?usable('euro-gdp'):pmiLeaves;categories.push({...balance(leaves),category:'activity',label:labels.activity,leaves})}
  weighted('policy',{ecb:1})
  const total=categories.reduce((s,c)=>s+weights[c.category],0)
  const leaves=total?categories.flatMap(c=>multiplyLeaves(c.leaves,weights[c.category]/total,labels[c.category])):[]
  const result=balance(leaves)
  return {...result,at,categories:categories.map(c=>({...c,share:weights[c.category]/total})),leaves,slots:[...slots],selected:[...selected],timingSensitive:false,
    explanation:result.direction==='empty'?'Select euro-area evidence.':result.direction==='insufficient'?'Unavailable evidence could change the direction.':result.direction==='balanced'?'The weighted evidence balances.':`The weighted euro-area evidence supports EUR ${result.direction==='strengthening'?'strength':'weakness'}.`}
}
