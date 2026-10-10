import { useSyncExternalStore } from 'react'
import { validMagnitudeLimits, type MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import { magnitudeFamilies } from '../../inspector/magnitude/magnitude-families'
import { allR1Families, r1Families, eurR1Families, r1Family, r1Currency, r1Profiles } from './profiles'
import type { R1Currency, R1MagnitudeSnapshot, R1Settings } from './contracts'
import {r1DefaultFreshness,eurR1DefaultFreshness,validR1Freshness} from './freshness'

export const r1SettingsKey='fyodor.scoring.usd-r1.v1'
export const r1DefaultSettings:R1Settings={version:1,calibration:{mode:'automatic',limits:{}},selected:r1Families,freshness:r1DefaultFreshness}
// Preserve dormant Production overrides so the new profile does not discard
// unrelated saved settings or break older workspace exports. They never score.
export const eurR1SettingsKey='fyodor.scoring.eur-r1.v1'
export const eurR1DefaultSettings:R1Settings={version:1,calibration:{mode:'automatic',limits:{}},selected:eurR1Families,freshness:eurR1DefaultFreshness}
export const r1CalibrationKeys=[...allR1Families.flatMap(f=>r1Profiles[f].components.flatMap(c=>[`${f}/${c.id}`,...(r1Profiles[f].components.some(c=>c.period==='quarter')?[`${f}/${c.id}/revision`]:[])])),'ism-manufacturing/production']
export function validR1Settings(value:unknown,currency:R1Currency='USD'):value is R1Settings {
  const families=currency==='USD'?r1Families:eurR1Families
  if(!value||typeof value!=='object')return false
  const v=value as R1Settings
  return v.version===1&&Array.isArray(v.selected)&&v.selected.every(f=>families.includes(f))&&new Set(v.selected).size===v.selected.length&&!!v.calibration&&['automatic','undefined'].includes(v.calibration.mode)&&!!v.calibration.limits&&typeof v.calibration.limits==='object'&&!Array.isArray(v.calibration.limits)&&Object.entries(v.calibration.limits).every(([key,limits])=>r1CalibrationKeys.includes(key)&&validMagnitudeLimits(limits))&&(v.freshness===undefined||validR1Freshness(v.freshness,families))
}
export const validEurR1Settings=(value:unknown):value is R1Settings=>validR1Settings(value,'EUR')
const caches={USD:{raw:undefined as string|null|undefined,value:r1DefaultSettings},EUR:{raw:undefined as string|null|undefined,value:eurR1DefaultSettings}}
const keyFor=(currency:R1Currency)=>currency==='USD'?r1SettingsKey:eurR1SettingsKey
export function readR1Settings(currency:R1Currency='USD'):R1Settings {
  const cache=caches[currency]
  if(typeof window==='undefined')return cache.value
  try{const raw=window.localStorage.getItem(keyFor(currency));if(raw!==cache.raw){cache.raw=raw;const value=JSON.parse(raw??'null');cache.value=validR1Settings(value,currency)?value:currency==='USD'?r1DefaultSettings:eurR1DefaultSettings}}catch{/* Keep session settings if storage is unavailable. */}
  return cache.value
}
export function saveR1Settings(settings:R1Settings,currency:R1Currency='USD') {
  if(!validR1Settings(settings,currency))throw new RangeError('Invalid R1 settings')
  const raw=JSON.stringify(settings);if(raw===JSON.stringify(readR1Settings(currency)))return
  const key=keyFor(currency),cache=caches[currency]
  try{window.localStorage.setItem(key,raw);cache.raw=raw}catch{/* Session settings still update. */}
  cache.value=settings;window.dispatchEvent(new window.Event(`${key}:changed`))
}
export function saveR1Limits(key:string,limits:MagnitudeLimits|null) {
  const family=r1Family(key.split('/')[0]),currency=family?r1Currency(family):'USD'
  const settings=readR1Settings(currency),next={...settings.calibration.limits}
  if(limits)next[key]=limits;else delete next[key]
  saveR1Settings({...settings,calibration:{...settings.calibration,limits:next}},currency)
}
const subscribers=Object.fromEntries((['USD','EUR'] as const).map(currency=>[currency,(listener:()=>void)=>{
  const key=keyFor(currency),storage=(e:StorageEvent)=>{if(e.key===null||e.key===key)listener()}
  window.addEventListener(`${key}:changed`,listener);window.addEventListener('storage',storage)
  return()=>{window.removeEventListener(`${key}:changed`,listener);window.removeEventListener('storage',storage)}
}]))
const readers={USD:()=>readR1Settings('USD'),EUR:()=>readR1Settings('EUR')}
const defaults={USD:()=>r1DefaultSettings,EUR:()=>eurR1DefaultSettings}
export function useR1Settings(currency:R1Currency='USD'){return useSyncExternalStore(subscribers[currency],readers[currency],defaults[currency])}
const stores=magnitudeFamilies.filter(f=>r1Family(f.familyId))
let snapshots:unknown[]=[],saved:R1MagnitudeSnapshot={}
export function readR1Bands():R1MagnitudeSnapshot {
  const next=stores.map(f=>f.settings.read())
  if(next.some((v,i)=>v!==snapshots[i])){snapshots=next;saved=Object.fromEntries(stores.map((f,i)=>[f.familyId,next[i]]))}
  return saved
}
const subscribeBands=(listener:()=>void)=>{const unsub=stores.map(f=>f.settings.subscribe(listener));return()=>unsub.forEach(fn=>fn())}
const noBands:R1MagnitudeSnapshot={}
export function useR1Bands(){return useSyncExternalStore(subscribeBands,readR1Bands,()=>noBands)}
