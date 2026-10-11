import type {R1ChangePart,R1Family,R1Leaf} from './contracts'
import {precise} from './arithmetic'
import {r1Profiles} from './profiles'

export function r1FamilyTotals(leaves:readonly R1Leaf[]) {
  const totals=new Map<R1Family,number>()
  for(const leaf of leaves)totals.set(leaf.family,(totals.get(leaf.family)??0)+(leaf.value??0))
  return totals
}

export function r1ChangeParts(before:ReadonlyMap<R1Family,number>,after:ReadonlyMap<R1Family,number>,published:readonly R1Family[]) {
  const parts:R1ChangePart[]=[],families=new Set([...before.keys(),...after.keys(),...published])
  let adjustment=0
  for(const family of families){
    const change=precise((after.get(family)??0)-(before.get(family)??0))
    if(published.length&&!published.includes(family))adjustment+=change
    else if(change||published.includes(family))parts.push({family,label:r1Profiles[family].label,change})
  }
  // Replacing an anchor can change retained families without publishing them.
  if(precise(adjustment))parts.push({label:'Relationship adjustment',change:precise(adjustment)})
  return parts
}

// Reconcile display cents only; raw evidence and contributions stay unchanged.
export function r1DisplayChangeParts(update:{parts:readonly R1ChangePart[];change:number}) {
  const cents=update.parts.map(p=>Math.round(p.change*100))
  const remainder=Math.round(update.change*100)-cents.reduce((a,b)=>a+b,0)
  if(remainder&&cents.length){
    const largest=update.parts.reduce((best,p,i)=>Math.abs(p.change)>Math.abs(update.parts[best].change)?i:best,0)
    cents[largest]+=remainder
  }
  return update.parts.map((p,i)=>({...p,change:cents[i]/100}))
}
