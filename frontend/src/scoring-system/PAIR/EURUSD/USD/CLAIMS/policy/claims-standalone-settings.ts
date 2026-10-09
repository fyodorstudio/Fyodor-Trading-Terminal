import { useSyncExternalStore } from 'react'
import { createMagnitudeSettingsStore } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { claimsDefaultInitialWeight, claimsStandaloneSignals, type ClaimsHorizon } from './claims-standalone-policy'

export const claimsStandaloneMagnitude = Object.fromEntries((['release', 'trend'] as const).map(horizon => [horizon,
  createMagnitudeSettingsStore({ pair: 'EURUSD', currency: 'USD', side: 'quote', family: `CLAIMS-V3-${horizon.toUpperCase()}-SIGNALS` }, claimsStandaloneSignals[horizon].map(s => s.id)),
])) as Record<ClaimsHorizon, ReturnType<typeof createMagnitudeSettingsStore>>
export const claimsStandalonePreferenceKey = 'fyodor.scoring.claims-standalone.v3'
export type ClaimsStandalonePreferences = Readonly<{ horizon: ClaimsHorizon; releaseWeight: number; trendWeight: number }>
const defaults: ClaimsStandalonePreferences = Object.freeze({ horizon: 'release', releaseWeight: claimsDefaultInitialWeight, trendWeight: claimsDefaultInitialWeight })
const changed = `${claimsStandalonePreferenceKey}:changed`
let cachedRaw: string | null | undefined, cached = defaults
export const validClaimsPreferences = (value: unknown): value is ClaimsStandalonePreferences => {
  if (!value || typeof value !== 'object') return false
  const config = value as ClaimsStandalonePreferences
  return ['release', 'trend'].includes(config.horizon) && [config.releaseWeight, config.trendWeight].every(n => Number.isInteger(n) && n >= 1 && n <= 99)
}
export function readClaimsPreferences() {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(claimsStandalonePreferenceKey)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      const parsed = JSON.parse(raw ?? 'null')
      cached = validClaimsPreferences(parsed) ? Object.freeze({ horizon: parsed.horizon, releaseWeight: parsed.releaseWeight, trendWeight: parsed.trendWeight }) : defaults
    }
  } catch { /* Keep the last usable preference snapshot. */ }
  return cached
}
export function saveClaimsPreferences(next: ClaimsStandalonePreferences) {
  if (!validClaimsPreferences(next)) throw new RangeError('Use a Claims horizon and integer weights from 1 to 99.')
  const previous = readClaimsPreferences()
  if (previous.horizon === next.horizon && previous.releaseWeight === next.releaseWeight && previous.trendWeight === next.trendWeight) return
  const raw = JSON.stringify(next)
  try { window.localStorage.setItem(claimsStandalonePreferenceKey, raw); cachedRaw = raw } catch { /* Retain changes in memory. */ }
  cached = Object.freeze({ ...next }); window.dispatchEvent(new window.Event(changed))
}
function subscribe(listener: () => void) {
  const storage = (e: StorageEvent) => { if (e.key === claimsStandalonePreferenceKey || e.key === null) listener() }
  window.addEventListener(changed, listener); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage) }
}
export const useClaimsPreferences = () => useSyncExternalStore(subscribe, readClaimsPreferences, () => defaults)
