import { useSyncExternalStore } from 'react'
import { validMagnitudeLimits, type MagnitudeLimits } from '../magnitude-distribution'

export type MagnitudeScope = Readonly<{ pair: string; currency: string; side: string; family: string }>
export type MagnitudeSettings = Readonly<Record<string, MagnitudeLimits>>

export function magnitudeSettingsKey(scope: MagnitudeScope) {
  // Encode separators as well, so future scope names cannot collide.
  const part = (value: string) => encodeURIComponent(value).replaceAll('.', '%2E')
  return `fyodor.scatter-plot.${[scope.pair, scope.currency, scope.side, scope.family].map(part).join('.')}.magnitude.v1`
}

// Family bindings supply scope and admitted series. Inspector never needs to
// mount the corresponding scatter dock to consume its saved settings.
export function createMagnitudeSettingsStore(scope: MagnitudeScope, seriesIds: readonly string[]) {
  const key = magnitudeSettingsKey(scope), changed = `${key}:changed`
  const known = new Set(seriesIds)
  const empty: MagnitudeSettings = Object.freeze({})
  let cachedRaw: string | null | undefined
  let cached: MagnitudeSettings = empty

  function normalize(value: unknown): MagnitudeSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return empty
    return Object.freeze(Object.fromEntries(Object.entries(value).flatMap(([series, limits]) =>
      known.has(series) && validMagnitudeLimits(limits) ? [[series, Object.freeze([limits[0], limits[1], limits[2]] as const)]] : [])))
  }
  function read(): MagnitudeSettings {
    if (typeof window === 'undefined') return empty
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== cachedRaw) {
        cachedRaw = raw
        try { cached = normalize(JSON.parse(raw ?? '{}')) }
        catch { cached = empty }
      }
    } catch { /* Retain this session's snapshot if device storage is unavailable. */ }
    return cached
  }
  function save(series: string, limits: MagnitudeLimits | null) {
    if (!known.has(series) || (limits !== null && !validMagnitudeLimits(limits))) {
      throw new RangeError('Use a supported series and 0 < Small < Medium < Large')
    }
    const previous = read()
    if (limits === null ? !Object.hasOwn(previous, series) : previous[series]?.every((limit, index) => limit === limits[index])) return
    const next = { ...previous }
    if (limits) next[series] = limits
    else delete next[series]
    const snapshot = normalize(next), raw = JSON.stringify(snapshot)
    try { window.localStorage.setItem(key, raw); cachedRaw = raw }
    catch { /* The shared in-memory snapshot still updates immediately. */ }
    cached = snapshot
    window.dispatchEvent(new window.Event(changed))
  }
  function subscribe(listener: () => void) {
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener() }
    window.addEventListener(changed, listener)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage) }
  }
  function useSettings() { return useSyncExternalStore(subscribe, read, () => empty) }
  return { key, normalize, read, save, subscribe, useSettings }
}
