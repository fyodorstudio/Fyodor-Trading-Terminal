import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { createR1History } from './features'
import { assessFeatures,assessR1,prepareR1Features } from './assessment'
import { r1Profiles } from './profiles'
import type { R1Calibration,R1Family,R1MagnitudeSnapshot } from './contracts'
export type R1HistoryInput={family:R1Family;events:readonly EconomicCalendarEvent[];at:number;calibration:R1Calibration;savedBands:R1MagnitudeSnapshot}
export function calculateR1History(input:R1HistoryInput) {
  const history=createR1History(input.events.filter(e=>e.release_at!==null&&e.release_at<=input.at)),profile=r1Profiles[input.family]
  const prepared=prepareR1Features(history,profile),samples=new Map<string,number[]>()
  if(profile.currency==='EUR')return prepared.map(entry=>assessR1(entry.release,profile,history,input.calibration,input.savedBands,false,prepared))
  return prepared.map(entry=>{
    const earlier=entry.features.map((f,i)=>samples.get(`${i}/${f.stage}`)??[])
    const result=assessFeatures(entry.release,profile,entry.features,earlier,input.calibration,input.savedBands)
    entry.features.forEach((f,i)=>{if(f.delta!==null){const key=`${i}/${f.stage}`,values=samples.get(key)??[];values.push(f.delta);samples.set(key,values)}})
    return result
  })
}
