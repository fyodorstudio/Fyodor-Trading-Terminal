import type { InspectorRelease } from '../../inspector/inspector-data'
import type { MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import type { R1Assessment, R1Calibration, R1Feature, R1Leaf, R1MagnitudeSnapshot, R1Profile, R1Reading } from './contracts'
import { balance, magnitude, magnitudePoints, precise, usesFractionalMagnitude } from './arithmetic'
import { r1CalibrationPolicy } from './profiles'
import { reference, r1Features, type R1History } from './features'

export function r1Limits(samples:readonly number[]):MagnitudeLimits|null {
  if(samples.length<r1CalibrationPolicy.minimum)return null
  const nonzero=samples.map(Math.abs).filter(x=>x>0).sort((a,b)=>a-b)
  if(!nonzero.length)return null
  return r1CalibrationPolicy.quantiles.map(q=>nonzero[Math.ceil(q*nonzero.length)-1]) as unknown as MagnitudeLimits
}
export function assessFeatures(release:InspectorRelease,profile:R1Profile,features:readonly R1Feature[],sampleValues:readonly (readonly number[])[],calibration:R1Calibration,saved:R1MagnitudeSnapshot):R1Assessment {
  const readings:R1Reading[]=profile.components.map((c,i)=>{
    const f=features[i],key=`${profile.family}/${c.id}${f.stage==='revision'?'/revision':''}`
    const manual=calibration.limits[key],raw=saved[profile.family]?.[c.seriesId]
    const samples=sampleValues[i]??[],automatic=calibration.mode==='automatic'?r1Limits(samples):null
    // Quarter-momentum bands must not calibrate same-quarter revisions.
    const compatibleRaw=f.stage==='revision'||!raw?undefined:raw.map(x=>precise(x*(c.scale??1))) as unknown as MagnitudeLimits
    const limits=manual??compatibleRaw??automatic
    const source=manual?'r1-manual':compatibleRaw?'saved-ap':automatic?'r1-automatic':'undefined'
    const points=f.delta===null?null:c.period==='action'?Math.sign(f.delta)*Math.min(Math.abs(f.delta)/25,4):f.delta===0?0:limits?c.polarity*Math.sign(f.delta)*magnitudePoints(profile.family,f.delta,limits):null
    return {...c,...f,points,magnitude:points===null?null:usesFractionalMagnitude(profile.family)&&f.delta!==0?magnitude(f.delta!,limits!):Math.abs(points),contribution:points===null?null:precise(c.weight*points),limits:limits??null,calibration:c.period==='action'?'action':f.delta===0?'unchanged':source,samples:samples.length,reason:f.reason||(points===null?'Magnitude boundaries are unavailable.':'')}
  })
  const leaves:R1Leaf[]=readings.map(r=>({id:`${release.id}/${r.id}`,family:profile.family,label:r.label,value:r.contribution===null?null:r.contribution/4,budget:r.weight,sourceId:release.id}))
  const result=balance(leaves)
  const refs=new Set(profile.components.flatMap((c,i)=>features[i].reference!==null?[features[i].reference]:release.events.filter(e=>e.event_id===c.seriesId).flatMap(e=>{const ref=reference(e,c.period);return ref===null?[]:[ref]})))
  const declaredReference=refs.size===1?[...refs][0]:null
  const assessment:R1Assessment={...result,family:profile.family,label:profile.label,version:profile.version,releaseId:release.id,publishedAt:release.releaseAt,reference:profile.family==='claims'?readings[0].reference:declaredReference,stage:features.some(f=>f.stage==='revision')?'revision':'momentum',readings,leaves,explanation:''}
  const variants=readingVariants(assessment,profile)
  assessment.sensitive=variants.some(v=>v.direction!==result.direction)
  assessment.sensitivityRange=[Math.min(result.interval[0],...variants.map(v=>v.interval[0])),Math.max(result.interval[1],...variants.map(v=>v.interval[1]))]
  assessment.explanation=explainR1(assessment)
  return assessment
}
export function readingVariants(a:R1Assessment,profile:R1Profile):R1Assessment[] {
  const variants:R1Assessment[]=[]
  const count=a.readings.length,combinations=3**count
  for(const weights of profile.alternatives)for(let k=0;k<combinations;k++){
    let choices=k
    const leaves=a.readings.map((r,i):R1Leaf=>{
      const factor=[.9,1,1.1][choices%3];choices=Math.floor(choices/3)
      const points=r.points===null?null:r.period==='action'?r.points:r.delta===0?0:r.limits?Math.sign(r.delta!)*r.polarity*magnitudePoints(a.family,r.delta!,r.limits,factor):r.points
      return {id:r.id,family:a.family,label:r.label,value:points===null?null:points*weights[i]/4,budget:weights[i]}
    })
    variants.push({...a,...balance(leaves),leaves})
  }
  return variants
}
export function prepareR1Features(history:R1History,profile:R1Profile,gdpMomentum=false) {
  return history.releases.filter(r=>r.familyId===profile.family).map(release=>({release,features:r1Features(release,profile,history,gdpMomentum)}))
}
export function assessR1(release:InspectorRelease,profile:R1Profile,history:R1History,calibration:R1Calibration,saved:R1MagnitudeSnapshot,gdpMomentum=false,prepared=prepareR1Features(history,profile,gdpMomentum),availabilityAt=release.releaseAt??0) {
  const current=r1Features(release,profile,history,gdpMomentum,availabilityAt),samples=profile.components.map((_,i)=>prepared.flatMap(entry=>{
    const feature=entry.features[i]
    return entry.release.releaseAt!<release.releaseAt!&&feature.stage===current[i].stage&&feature.delta!==null?[feature.delta]:[]
  }))
  return assessFeatures(release,profile,current,samples,calibration,saved)
}
function reason(r:R1Reading) {
  const up=r.delta!>0
  if(r.period==='action')return up?'the rate hike':'the rate cut'
  if(r.period==='quarter')return r.stage==='revision'?up?'the higher growth estimate':'the lower growth estimate':r.actual!<0?up?'a smaller GDP contraction':'a deeper GDP contraction':up?'faster GDP growth':'slower GDP growth'
  if(r.id==='payrolls')return r.actual!<0?up?'fewer payroll losses':'more payroll losses':up?'faster payroll growth':'slower payroll growth'
  if(r.id==='unemployment')return up?'higher unemployment':'lower unemployment'
  if(r.id==='wages')return up?'faster average earnings growth':'slower average earnings growth'
  if(r.period==='week')return `${up?'more':'fewer'} ${r.id==='initial'?'initial':'continuing'} claims`
  if(r.id==='sales')return r.actual!<0?up?'a smaller nominal sales decline':'a larger nominal sales decline':up?'faster nominal sales growth':'slower nominal sales growth'
  if(r.unit==='pts')return `${up?'improving':'softer'} ${r.id==='orders'?'orders':r.id==='production'?'production':'business activity'}`
  return `${up?'faster':'slower'} ${r.id.startsWith('core')?'core':'headline'} ${r.id.endsWith('annual')?'annual':'monthly'} inflation`
}
export function explainR1(a:R1Assessment) {
  if(a.direction==='insufficient')return 'Missing evidence could change the direction.'
  if(a.family==='ism-manufacturing'){
    const r=a.readings[0],state=r.actual!>50?'expanding':r.actual!<50?'contracting':null
    if(a.direction==='balanced')return `Manufacturing new orders are unchanged${state?` and remain ${state}`:' at 50'}.`
    const improving=r.delta!>0,crossed=state&&(r.actual!-50)*(r.previous!-50)<=0
    const context=state?crossed?` into ${state==='expanding'?'expansion':'contraction'}`:` ${improving===(state==='expanding')?'and':'but'} remain ${state}`:' to 50'
    return `Manufacturing new orders ${improving?'improved':'softened'}${context}, supporting USD ${improving?'strength':'weakness'}.`
  }
  if(a.direction==='balanced')return a.readings.some(r=>r.points)?'The weighted contributions cancel.':a.family==='fomc'?`Rate held at ${a.readings[0].actual}%. A hold alone does not establish currency strength or weakness.`:'The usable comparisons are unchanged.'
  const sign=a.direction==='strengthening'?1:-1
  const winner=a.readings.filter(r=>r.contribution!==null&&Math.sign(r.contribution)===sign).sort((a,b)=>Math.abs(b.contribution!)-Math.abs(a.contribution!))[0]
  const opponent=a.readings.filter(r=>r.contribution!==null&&Math.sign(r.contribution)===-sign).sort((a,b)=>Math.abs(b.contribution!)-Math.abs(a.contribution!))[0]
  if(!winner)return 'No usable directional evidence.'
  const text=opponent?`${reason(winner)} outweighs ${reason(opponent)}.`:`${reason(winner)} supports USD ${sign>0?'strength':'weakness'}.`
  return text[0].toUpperCase()+text.slice(1)
}
