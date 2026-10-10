import { useMemo,useState } from 'react'
import type { InspectorScoringProps } from '../../inspector/scoring/scoring-contracts'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { groupInspectorReleases } from '../../inspector/inspector-data'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { calculateR1Pair } from './pair'
import { allR1Families,r1Profiles,allR1SeriesIds } from './profiles'
import { useR1Bands,useR1Settings } from './settings'
import type { R1Schedule } from './contracts'
const createWorker=()=>new Worker(new URL('./pair.worker.ts',import.meta.url),{type:'module'})
const noEvents:NonNullable<InspectorScoringProps['events']>=[]
export function useR1Analysis({release,brokerId,events=noEvents}:InspectorScoringProps) {
  const settings=useR1Settings(),eurSettings=useR1Settings('EUR'),savedBands=useR1Bands(),at=release?.releaseAt??0
  const [openedAt]=useState(()=>Date.now())
  // Fetch versioned history once per horizon, not once per selected publication.
  // Features, vintages and schedules still admit evidence at the selected clock.
  const latest=new Date(Math.max(at,openedAt))
  const horizon=Date.UTC(latest.getUTCFullYear(),(Math.floor(latest.getUTCMonth()/3)+1)*3,1)
  const range=useMemo(()=>({from:Date.UTC(2015,0,1),to:horizon}),[horizon])
  const scope=useMemo(()=>({eventIds:allR1SeriesIds,r1AsOf:horizon}),[horizon])
  const storage=useStoredCalendar(brokerId,range,!!release,scope)
  const sourceEvents=brokerId?storage.events:events
  const sourceRows=useMemo(()=>new Map(sourceEvents.map(e=>[e.value_id,e])),[sourceEvents])
  const combined=useMemo(()=>{
    const missing=(release?.events??[]).filter(row=>!sourceRows.has(row.value_id))
    // The selected publication is authoritative even while full history loads.
    return missing.length?[...sourceEvents,...missing]:sourceEvents
  },[sourceEvents,sourceRows,release])
  const releases=useMemo(()=>new Map(groupInspectorReleases(combined).map(r=>[r.id,r])),[combined])
  const canonicalRelease=release?releases.get(release.id)??release:null
  const schedules=useMemo(()=>storage.schedules.flatMap((s):R1Schedule[]=>{
    const family=s.seriesId==='840040001'?'ism-manufacturing':allR1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId))
    return family?[{...s,family}]:[]
  }),[storage.schedules])
  const input=useMemo(()=>canonicalRelease&&!storage.loading?{release:canonicalRelease,events:combined,settings,eurSettings,savedBands,schedules}:null,[canonicalRelease,storage.loading,combined,settings,eurSettings,savedBands,schedules])
  return {...useBackgroundCalculation(input,calculateR1Pair,createWorker),storage}
}
