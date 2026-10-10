import { useSyncExternalStore } from 'react'
import { validMagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import { magnitudeFamilies } from '../../inspector/magnitude/magnitude-families'
import { r1Families, r1Family, r1Profiles } from './profiles'
import type { R1MagnitudeSnapshot, R1Settings } from './contracts'

export const r1SettingsKey='fyodor.scoring.usd-r1.v1'
export const r1DefaultSettings:R1Settings={version:1,calibration:{mode:'automatic',limits:{}},selected:r1Families}
export const r1CalibrationKeys=r1Families.flatMap(f=>r1Profiles[f].components.flatMap(c=>[`${f}/${c.id}`,...(f==='gdp'?[`${f}/${c.id}/revision`]:[])]))
export function validR1Settings(value:unknown):value is R1Settings {
  if(!value||typeof value!=='object')return false
  const v=value as R1Settings
  return v.version===1&&Array.isArray(v.selected)&&v.selected.every(f=>r1Family(f))&&new Set(v.selected).size===v.selected.length&&!!v.calibration&&['automatic','undefined'].includes(v.calibration.mode)&&!!v.calibration.limits&&typeof v.calibration.limits==='object'&&!Array.isArray(v.calibration.limits)&&Object.entries(v.calibration.limits).every(([key,limits])=>r1CalibrationKeys.includes(key)&&validMagnitudeLimits(limits))
}
let cachedRaw:string|null|undefined,cached=r1DefaultSettings
export function readR1Settings():R1Settings {
  if(typeof window==='undefined')return cached
  try{const raw=window.localStorage.getItem(r1SettingsKey);if(raw!==cachedRaw){cachedRaw=raw;const value=JSON.parse(raw??'null');cached=validR1Settings(value)?value:r1DefaultSettings}}catch{/* Keep session settings if storage is unavailable. */}
  return cached
}
export function saveR1Settings(settings:R1Settings) {
  if(!validR1Settings(settings))throw new RangeError('Invalid R1 settings')
  const raw=JSON.stringify(settings);if(raw===JSON.stringify(readR1Settings()))return
  try{window.localStorage.setItem(r1SettingsKey,raw);cachedRaw=raw}catch{/* Session settings still update. */}
  cached=settings;window.dispatchEvent(new window.Event(`${r1SettingsKey}:changed`))
}
function subscribe(listener:()=>void){
  const storage=(e:StorageEvent)=>{if(e.key===null||e.key===r1SettingsKey)listener()}
  window.addEventListener(`${r1SettingsKey}:changed`,listener);window.addEventListener('storage',storage)
  return()=>{window.removeEventListener(`${r1SettingsKey}:changed`,listener);window.removeEventListener('storage',storage)}
}
export function useR1Settings(){return useSyncExternalStore(subscribe,readR1Settings,()=>r1DefaultSettings)}
const stores=magnitudeFamilies.filter(f=>f.currency==='USD'&&r1Family(f.familyId))
let snapshots:unknown[]=[],saved:R1MagnitudeSnapshot={}
export function readR1Bands():R1MagnitudeSnapshot {
  const next=stores.map(f=>f.settings.read())
  if(next.some((v,i)=>v!==snapshots[i])){snapshots=next;saved=Object.fromEntries(stores.map((f,i)=>[f.familyId,next[i]]))}
  return saved
}
const subscribeBands=(listener:()=>void)=>{const unsub=stores.map(f=>f.settings.subscribe(listener));return()=>unsub.forEach(fn=>fn())}
const noBands:R1MagnitudeSnapshot={}
export function useR1Bands(){return useSyncExternalStore(subscribeBands,readR1Bands,()=>noBands)}
