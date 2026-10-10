import type { R1Assessment } from '../../scoring-system/r1/contracts'
import { magnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'
import type { ScatterModel,ScatterPoint,ScatterSignal } from '../contracts/scatter-plot-types'
import {scatterNumber} from './scatter-number-format'
export function r1ScatterModel(history:readonly R1Assessment[],componentId:string,releaseId:string|null):ScatterModel {
  const selected=releaseId?history.find(a=>a.releaseId===releaseId):history.at(-1),reading=selected?.readings.find(r=>r.id===componentId)
  let previous=-1
  const points=history.flatMap((a,i):ScatterPoint[]=>{
    const r=a.readings.find(r=>r.id===componentId)
    if(!r||r.delta===null)return []
    const sizes=['Unchanged','Small','Medium','Large','Extreme'] as const
    const signal:ScatterSignal={value:r.delta*r.polarity,reason:r.reason,points:r.points,limits:r.limits,automaticLimits:r.calibration==='r1-automatic'?r.limits:null,magnitudeMode:r.calibration==='r1-automatic'?'automatic':'custom',sampleCount:r.samples,size:r.magnitude===null?null:sizes[r.magnitude]??null,description:r.label,inputs:{actual:r.actual!,baseline:r.previous!,actualLabel:'Actual',baselineLabel:r.basis,unit:r.period==='action'?'%':r.unit}}
    const point:ScatterPoint={id:`${a.releaseId}/${r.id}`,releaseId:a.releaseId,at:a.publishedAt!,delta:signal.value!,actual:r.actual!,previous:r.previous!,tone:signal.value!>0?'higher':signal.value!<0?'lower':'unchanged',signal,breakBefore:previous>=0&&i!==previous+1}
    previous=i;return [point]
  })
  const unit=reading?.unit??history[0]?.readings.find(r=>r.id===componentId)?.unit??''
  const formatDelta=(n:number|null,d=6)=>n===null?'—':`${scatterNumber(n,d,true)} ${unit}`
  const formatReading=(n:number|null)=>n===null?'—':`${scatterNumber(n)} ${reading?.period==='action'?'%':unit}`
  const point=points.find(p=>p.releaseId===selected?.releaseId)??null
  const sameStage=history.filter(a=>a.stage===selected?.stage),ids=new Set(sameStage.map(a=>a.releaseId))
  const earlier=points.filter(p=>p.at<selected!.publishedAt!&&ids.has(p.releaseId))
  const signal=point?.signal
  return {points,measure:'signal',axisLabel:'R1 signed comparison',description:`${selected?.version??'USD R1'} · ${reading?.label??componentId}`,deltaUnit:unit,formatDelta,formatReading,inspection:selected&&reading?{releaseId:selected.releaseId,at:selected.publishedAt!,point,actual:reading.actual,previous:reading.previous,delta:reading.delta===null?null:reading.delta*reading.polarity,distribution:reading.limits?magnitudeDistribution(earlier.map(p=>p.delta),reading.delta,reading.limits):null,samples:points,excluded:history.length-points.length,earlierCount:reading.samples,magnitudeMode:reading.calibration==='r1-automatic'?'automatic':reading.limits?'custom':'undefined',signal}:null}
}
