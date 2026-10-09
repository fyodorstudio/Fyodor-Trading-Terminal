import { useSyncExternalStore } from 'react'
import { eurPolicies, type EurFamily } from '../../scoring-system/PAIR/EURUSD/EUR/policy/eur-policies'
export const relativePreferencesKey = 'fyodor.raycaster.relative.v1'
const changed = relativePreferencesKey + ':changed'
const defaults = Object.freeze({ mode: 'usd' as 'usd' | 'relative', families: eurPolicies.map(p=>p.family) as readonly EurFamily[] })
let cached = defaults, raw: string | null | undefined
export function validRelativePreferences(v: unknown): boolean {
  if (!v || typeof v !== 'object' || !('mode' in v) || !('families' in v)) return false
  return ['usd','relative'].includes(v.mode as string) && Array.isArray(v.families) && new Set(v.families).size===v.families.length && v.families.every(id=>eurPolicies.some(p=>p.family===id))
}
export function readRelativePreferences() {
  if(typeof window==='undefined') return defaults
  try { const next=window.localStorage.getItem(relativePreferencesKey)
    if(next!==raw){raw=next;let value: unknown;try{value=JSON.parse(next??'null')}catch{value=null}
      cached=validRelativePreferences(value) ? Object.freeze(value as typeof defaults) : defaults}
  }catch{ /* Keep session settings. */ }
  return cached
}
export function saveRelativePreferences(value: typeof defaults) {
  if(!validRelativePreferences(value)) throw new RangeError('Select supported relative-context inputs without duplicates.')
  cached=Object.freeze({mode:value.mode, families:Object.freeze([...value.families])});raw=JSON.stringify(cached)
  try{window.localStorage.setItem(relativePreferencesKey,raw)}catch{ /* Session setting remains usable. */ }
  window.dispatchEvent(new window.Event(changed))
}
function subscribe(listener:()=>void) {
  const storage=(e:StorageEvent)=>{if(e.key===null || e.key===relativePreferencesKey)listener()}
  window.addEventListener(changed,listener);window.addEventListener('storage',storage)
  return()=>{window.removeEventListener(changed,listener);window.removeEventListener('storage',storage)}
}
export const useRelativePreferences=()=>useSyncExternalStore(subscribe,readRelativePreferences,()=>defaults)
export function toggleEurFamily(id:EurFamily){const value=readRelativePreferences();saveRelativePreferences({...value,families:value.families.includes(id)?value.families.filter(f=>f!==id):[...value.families,id]})}
