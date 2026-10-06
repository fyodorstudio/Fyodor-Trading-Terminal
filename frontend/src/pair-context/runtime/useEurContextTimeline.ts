import { useMemo, useSyncExternalStore } from 'react'
import type { InspectorEvent } from '../../inspector/inspector-data'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { calendarAdmissionTime } from '../../inspector/storage/calendar-admission-time'
import { eurMagnitudeStores } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-magnitude-settings'
import { eurNumericSeriesIds, type EurFamily } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-policies'
import { sharedContextJobs, type JobState } from '../../usd-context/runtime/shared-context-jobs'
import { contextInventoryIdentity } from '../../usd-context/runtime/context-inventory-identity'
import { buildEurContextTimeline } from '../core/eur-context-timeline'
import type { EurContextTimeline } from '../core/contracts'
import { relativeContextVersion } from '../core/eur-policy'
const scope={currency:'EUR' as const,eventIds:eurNumericSeriesIds}
const empty: readonly InspectorEvent[]=[]
const disabled:JobState<EurContextTimeline>={result:null,error:null,loading:false}
const noSubscribe=()=>()=>{}, noSnapshot=()=>disabled
const jobs=sharedContextJobs(buildEurContextTimeline,()=>typeof Worker==='undefined'?null:new Worker(new URL('./eur-context.worker.ts',import.meta.url),{type:'module'}))
export function useEurContextTimeline(brokerId:string|null,families:readonly EurFamily[],now:number,enabled:boolean,events:readonly InspectorEvent[]=empty){
  // Explicit hooks keep call order stable as the selected menu changes.
  const inflation=eurMagnitudeStores['euro-inflation'].useSettings(), german=eurMagnitudeStores['german-inflation'].useSettings()
  const pmi=eurMagnitudeStores['euro-pmi'].useSettings(), dePmi=eurMagnitudeStores['german-pmi'].useSettings(), frPmi=eurMagnitudeStores['french-pmi'].useSettings()
  const labor=eurMagnitudeStores['euro-labor'].useSettings(), wages=eurMagnitudeStores['euro-wages'].useSettings(), gdp=eurMagnitudeStores['euro-gdp'].useSettings()
  const settings=useMemo(()=>({'euro-inflation':inflation,'german-inflation':german,'euro-pmi':pmi,'german-pmi':dePmi,'french-pmi':frPmi,'euro-labor':labor,'euro-wages':wages,'euro-gdp':gdp}),[inflation,german,pmi,dePmi,frPmi,labor,wages,gdp])
  const end=Math.floor(now/86400000)*86400000+2*86400000
  const range=useMemo(()=>({from:Date.UTC(2015,0,1)-2*86400000,to:end}),[end])
  const storage=useStoredCalendar(brokerId,range,enabled && families.length>0,scope)
  const inventory=brokerId?storage.events:events, asOf=calendarAdmissionTime(inventory,now)
  const identity=useMemo(()=>contextInventoryIdentity(inventory),[inventory])
  const key=enabled && !storage.loading && families.length && (brokerId || inventory.length)?JSON.stringify([relativeContextVersion,brokerId,identity,asOf,[...families].sort(),settings]):null
  const job=useMemo(()=>key?jobs.get(key,{events:inventory,families,settings,asOf}):null,[key, inventory, families, settings, asOf])
  const calculation=useSyncExternalStore(job?.subscribe??noSubscribe,job?.snapshot??noSnapshot,noSnapshot)
  return {...calculation,loading:enabled && (storage.loading || calculation.loading),storage}
}
