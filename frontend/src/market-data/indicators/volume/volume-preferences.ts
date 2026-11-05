export type VolumePreferences = {
  enabled: boolean; mode: 'raw' | 'relative'
  lookback: number; minimumSamples: number; averageVisible: boolean; averageLength: number
  upColor: string; downColor: string; averageColor: string
}
export const defaultVolumePreferences: VolumePreferences = {
  enabled: false, mode: 'raw', lookback: 20, minimumSamples: 5,
  averageVisible: false, averageLength: 20, upColor: '#089981', downColor: '#f23645', averageColor: '#b18a00',
}
const storageKey = 'fyodor.indicators.volume.v1'
export function readVolumePreferences(): VolumePreferences {
  const d = defaultVolumePreferences
  try {
    const p = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    if (!p || typeof p !== 'object' || Array.isArray(p)) return d
    const integer = (key: 'lookback' | 'minimumSamples' | 'averageLength', min: number, max: number) =>
      Number.isInteger(p[key]) && p[key] >= min && p[key] <= max ? p[key] as number : d[key]
    const color = (key: 'upColor' | 'downColor' | 'averageColor') => typeof p[key] === 'string' && /^#[\da-f]{6}$/i.test(p[key]) ? p[key] as string : d[key]
    const lookback = integer('lookback', 5, 60)
    return { enabled: p.enabled === true, mode: p.mode === 'relative' ? 'relative' : 'raw',
      lookback,
      minimumSamples: Math.min(integer('minimumSamples', 1, 60), lookback),
      averageVisible: p.averageVisible === true, averageLength: integer('averageLength', 1, 200),
      upColor: color('upColor'), downColor: color('downColor'), averageColor: color('averageColor') }
  } catch { return d }
}
export function saveVolumePreferences(value: VolumePreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Keep controls usable without storage. */ }
}
