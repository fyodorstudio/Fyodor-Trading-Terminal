import { useMemo } from 'react'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { allR1Families, allR1SeriesIds, r1Profiles } from './profiles'
import { useR1Bands, useR1Settings } from './settings'
import { calculateR1Timeline } from './timeline'
import type { R1Schedule } from './contracts'
const createWorker=()=>new Worker(new URL('./timeline.worker.ts',import.meta.url),{type:'module'})
export function useR1Timeline(brokerId:string|null,now:number) {
  const usdSettings=useR1Settings(),eurSettings=useR1Settings('EUR'),savedBands=useR1Bands()
  const date=new Date(now),end=Date.UTC(date.getUTCFullYear(),(Math.floor(date.getUTCMonth()/3)+1)*3,1)
  const range=useMemo(()=>({from:Date.UTC(2015,0,1),to:end}),[end])
  const scope=useMemo(()=>({eventIds:allR1SeriesIds,r1AsOf:end}),[end])
  const storage=useStoredCalendar(brokerId,range,true,scope)
  const schedules=useMemo(()=>storage.schedules.flatMap((s):R1Schedule[]=>{
    const family=allR1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId))
    return family?[{...s,family}]:[]
  }),[storage.schedules])
  const input=useMemo(()=>brokerId&&!storage.loading&&!storage.error?{events:storage.events,usdSettings,eurSettings,savedBands,schedules,end}:null,[brokerId,storage.loading,storage.error,storage.events,usdSettings,eurSettings,savedBands,schedules,end])
  const calculation=useBackgroundCalculation(input,calculateR1Timeline,createWorker)
  return {...calculation,loading:storage.loading||calculation.loading,error:storage.error??calculation.error,partial:Object.values(storage.coverage).some(c=>c.missing.length>0)}
}
