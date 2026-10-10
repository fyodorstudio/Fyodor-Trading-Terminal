import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../inspector/scoring/scoring-contracts'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { groupInspectorReleases } from '../../inspector/inspector-data'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { calculateR1 } from './analysis'
import { r1Families,r1Profiles,r1SeriesIds } from './profiles'
import { useR1Bands,useR1Settings } from './settings'
import type { R1Family,R1Schedule } from './contracts'
const createWorker=()=>new Worker(new URL('./r1.worker.ts',import.meta.url),{type:'module'})
const noEvents:NonNullable<InspectorScoringProps['events']>=[]
export function useR1Analysis({release,brokerId,events=noEvents,selectedFamilies}:InspectorScoringProps&{selectedFamilies?:readonly string[]}) {
  const settings=useR1Settings(),savedBands=useR1Bands(),at=release?.releaseAt??0
  const range=useMemo(()=>({from:Date.UTC(2015,0,1),to:at+2*86400000}),[at])
  const scope=useMemo(()=>({currency:'USD' as const,eventIds:r1SeriesIds,r1AsOf:at}),[at])
  const storage=useStoredCalendar(brokerId,range,!!release,scope)
  const sourceEvents=brokerId?storage.events:events
  const combined=useMemo(()=>{
    const rows=new Map(sourceEvents.map(e=>[e.value_id,e]))
    // The selected publication is authoritative even while full history loads.
    for(const row of release?.events??[])if(!rows.has(row.value_id))rows.set(row.value_id,row)
    return [...rows.values()]
  },[sourceEvents,release])
  const canonicalRelease=useMemo(()=>release?groupInspectorReleases(combined).find(r=>r.id===release.id)??release:null,[combined,release])
  const selected=useMemo(()=>settings.selected.filter(f=>!selectedFamilies||selectedFamilies.includes(f)),[settings.selected,selectedFamilies])
  const schedules=useMemo(()=>storage.schedules.flatMap((s):R1Schedule[]=>{
    const family=s.seriesId==='840040001'?'ism-manufacturing':r1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId))
    return family?[{...s,family}]:[]
  }),[storage.schedules])
  const input=useMemo(()=>canonicalRelease&&!storage.loading?{release:canonicalRelease,events:combined,settings:{...settings,selected:selected as R1Family[]},savedBands,schedules}:null,[canonicalRelease,storage.loading,combined,settings,selected,savedBands,schedules])
  return {...useBackgroundCalculation(input,calculateR1,createWorker),storage}
}
