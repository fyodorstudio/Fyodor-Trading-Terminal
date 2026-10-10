import type { R1Assessment } from '../../scoring-system/r1/contracts'
import { magnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'
import type { ScatterModel,ScatterPoint,ScatterSignal } from '../contracts/scatter-plot-types'
import {scatterNumber} from './scatter-number-format'
import {magnitude} from '../../scoring-system/r1/arithmetic'
import type {MagnitudeLimits} from '../../inspector/magnitude/magnitude-distribution'
export function r1ScatterModel(history:readonly R1Assessment[],componentId:string,releaseId:string|null,preview?:MagnitudeLimits|null):ScatterModel {
  const selected=releaseId?history.find(a=>a.releaseId===releaseId):history.at(-1),reading=selected?.readings.find(r=>r.id===componentId)
  let previous=-1
  const points=history.flatMap((a,i):ScatterPoint[]=>{
    const r=a.readings.find(r=>r.id===componentId)
    if(!r||r.delta===null)return []
    const limits=preview&&a.stage===selected?.stage&&r.period!=='action'?preview:r.limits
    const points=limits!==r.limits?(r.delta===0?0:r.polarity*Math.sign(r.delta)*magnitude(r.delta,limits!)):r.points
    const sizes=['Unchanged','Small','Medium','Large','Extreme'] as const
    const signal:ScatterSignal={value:r.delta*r.polarity,reason:r.reason,points,limits,automaticLimits:r.calibration==='r1-automatic'?r.limits:null,magnitudeMode:limits!==r.limits?'custom':r.calibration==='r1-automatic'?'automatic':'custom',sampleCount:r.samples,size:points===null?null:sizes[Math.abs(points)]??null,description:r.label,inputs:{actual:r.actual!,baseline:r.previous!,actualLabel:'Actual',baselineLabel:r.basis,unit:r.period==='action'?'%':r.unit}}
    const point:ScatterPoint={id:`${a.releaseId}/${r.id}`,releaseId:a.releaseId,at:a.publishedAt!,delta:signal.value!,actual:r.actual!,previous:r.previous!,tone:signal.value!>0?'higher':signal.value!<0?'lower':'unchanged',signal,breakBefore:previous>=0&&i!==previous+1}
    previous=i;return [point]
  })
  const unit=reading?.unit??history[0]?.readings.find(r=>r.id===componentId)?.unit??''
  const formatDelta=(n:number|null,d=6)=>n===null?'—':`${scatterNumber(n,d,true)} ${unit}`
  const formatReading=(n:number|null)=>n===null?'—':`${scatterNumber(n)} ${reading?.period==='action'?'%':unit}`
  const point=points.find(p=>p.releaseId===selected?.releaseId)??null
  const sameStage=history.filter(a=>a.stage===selected?.stage),ids=new Set(sameStage.map(a=>a.releaseId))
  const earlier=selected?points.filter(p=>p.at<selected.publishedAt!&&ids.has(p.releaseId)):[]
  const signal=point?.signal
  const limits=signal?.limits??(preview&&reading?.period!=='action'?preview:reading?.limits)
  return {points,measure:'signal',axisLabel:'R1 signed comparison',description:`${selected?.version??'USD R1'} · ${reading?.label??componentId}`,deltaUnit:unit,formatDelta,formatReading,inspection:selected&&reading?{releaseId:selected.releaseId,at:selected.publishedAt!,point,actual:reading.actual,previous:reading.previous,delta:reading.delta===null?null:reading.delta*reading.polarity,distribution:limits?magnitudeDistribution(earlier.map(p=>p.delta),reading.delta===null?null:reading.delta*reading.polarity,limits,!preview):null,samples:points,excluded:history.length-points.length,earlierCount:reading.samples,magnitudeMode:preview?'custom':reading.calibration==='r1-automatic'?'automatic':reading.limits?'custom':'undefined',signal}:null}
}
