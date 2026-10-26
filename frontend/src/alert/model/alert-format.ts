import { inspectorFamilies } from '../../inspector/catalog/inspector-families'

export function alertSeriesIds(preferences: { families: readonly string[] }) {
  return [...new Set(inspectorFamilies.filter((family) => preferences.families.includes(family.id)).flatMap((family) => family.events))]
}
export function alertComingIn(at: number, now: number) {
  const seconds = Math.max(0, Math.ceil((at - now) / 1000))
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60)
  const duration = days ? `${days}d${hours ? ` ${hours}h` : ''}` : hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`
  return `Coming in ${duration}`
}
