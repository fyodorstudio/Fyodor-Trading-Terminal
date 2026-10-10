import {balance,multiplyLeaves,precise} from './arithmetic'
import {calculateR1} from './analysis'
import {createR1History} from './features'
import {r1ReleaseFamily} from './profiles'
import {r1DefaultSettings,eurR1DefaultSettings} from './settings'
import type {R1Aggregate,R1PairInput,R1PairAnalysis} from './contracts'

export function pairBalance(eur:R1Aggregate,usd:R1Aggregate) {
  const positive=eur.leaves.length?multiplyLeaves(eur.leaves,.5,'EUR'):[{id:'missing/EUR',family:'euro-inflation' as const,label:'Select EUR evidence',value:null,budget:50}]
  const negative=usd.leaves.length?multiplyLeaves(usd.leaves,.5,'USD').map(l=>({...l,value:l.value===null?null:-l.value})):[{id:'missing/USD',family:'us-cpi' as const,label:'Select USD evidence',value:null,budget:50}]
  return balance([...positive,...negative])
}
export function calculateR1Pair(input:R1PairInput):R1PairAnalysis {
  const currency=input.release.currency==='EUR'?'EUR':'USD'
  const primary=calculateR1({...input,settings:currency==='EUR'?input.eurSettings??eurR1DefaultSettings:input.settings})
  if(input.pair===false)return {...primary,currency}
  const at=input.asOf??input.release.releaseAt??0,other=currency==='USD'?'EUR':'USD'
  const history=createR1History(input.events)
  const release=history.releases.filter(r=>r.releaseAt!==null&&r.releaseAt<=at&&r.currency===other&&r1ReleaseFamily(r)).at(-1)??{
    ...input.release,id:`unavailable/${other}`,currency:other,country:other==='EUR'?'EU':'US',familyId:other==='EUR'?'euro-inflation':'us-cpi',events:[],releaseAt:null,timingUncertain:true,
  }
  const settings=other==='EUR'?input.eurSettings??eurR1DefaultSettings:input.settings??r1DefaultSettings
  const secondary=calculateR1({...input,release,settings,asOf:at})
  const eur=currency==='EUR'?primary:secondary,usd=currency==='USD'?primary:secondary
  const result=pairBalance(eur.overall,usd.overall),before=pairBalance(eur.transition.before,usd.transition.before)
  const er=eur.overall.leaves.length?eur.overall.sensitivityRange??eur.overall.interval:[-100,100],ur=usd.overall.leaves.length?usd.overall.sensitivityRange??usd.overall.interval:[-100,100]
  const range:[number,number]=[precise((er[0]-ur[1])/2),precise((er[1]-ur[0])/2)]
  result.sensitive=result.direction==='strengthening'?range[0]<=0:result.direction==='weakening'?range[1]>=0:range[0]>0||range[1]<0
  result.sensitivityRange=range
  return {...primary,currency,otherCurrency:secondary,pair:{...result,at,eur:eur.overall,usd:usd.overall,before,change:precise(result.net-before.net)}}
}
