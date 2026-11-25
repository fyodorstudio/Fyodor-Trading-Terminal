export type TickDeltaView = 'bars' | 'line'
export type TickDeltaLine = 'up' | 'down' | 'delta'
export type TickDeltaLines = Record<TickDeltaLine, boolean>

export type VolumePreferences = {
  enabled: boolean; mode: 'raw' | 'relative' | 'tick-delta'; axisTarget: 'volume' | 'relative'
  barsVisible: boolean; relativeLineVisible: boolean; relativeLineColor: string
  lookback: number; minimumSamples: number; averageVisible: boolean; averageLength: number
  upColor: string; downColor: string; averageColor: string
  tickDeltaView: TickDeltaView
  tickDeltaLines: TickDeltaLines
  tickDeltaAxis: TickDeltaLine
}
export type VolumeLayer = 'barsVisible' | 'relativeLineVisible' | 'averageVisible'
export const defaultVolumePreferences: VolumePreferences = {
  enabled: false, mode: 'raw', axisTarget: 'volume', lookback: 20, minimumSamples: 5,
  barsVisible: true, relativeLineVisible: true, relativeLineColor: '#2962ff',
  averageVisible: false, averageLength: 20, upColor: '#089981', downColor: '#f23645', averageColor: '#b18a00',
  tickDeltaView: 'bars',
  tickDeltaLines: { up: true, down: true, delta: true },
  tickDeltaAxis: 'delta',
}
const storageKey = 'fyodor.indicators.volume.v1'
export function readVolumePreferences(): VolumePreferences {
  const d = defaultVolumePreferences
  try {
    const p = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    if (!p || typeof p !== 'object' || Array.isArray(p)) return d
    const integer = (key: 'lookback' | 'minimumSamples' | 'averageLength', min: number, max: number) =>
      Number.isInteger(p[key]) && p[key] >= min && p[key] <= max ? p[key] as number : d[key]
    const color = (key: 'upColor' | 'downColor' | 'averageColor' | 'relativeLineColor') => typeof p[key] === 'string' && /^#[\da-f]{6}$/i.test(p[key]) ? p[key] as string : d[key]
    const flag = (key: 'relativeLineVisible' | 'barsVisible') => typeof p[key] === 'boolean' ? p[key] : d[key]
    const lookback = integer('lookback', 5, 60)
    return { enabled: p.enabled === true, mode: p.mode === 'relative' || p.mode === 'tick-delta' ? p.mode : 'raw', axisTarget: p.axisTarget === 'relative' ? 'relative' : 'volume',
      lookback,
      barsVisible: flag('barsVisible'), relativeLineVisible: flag('relativeLineVisible'), relativeLineColor: color('relativeLineColor'),
      minimumSamples: Math.min(integer('minimumSamples', 1, 60), lookback),
      averageVisible: p.averageVisible === true, averageLength: integer('averageLength', 1, 200),
      tickDeltaView: p.tickDeltaView === 'line' ? 'line' : d.tickDeltaView,
      tickDeltaLines: { up: p.tickDeltaLines?.up !== false, down: p.tickDeltaLines?.down !== false, delta: p.tickDeltaLines?.delta !== false },
      tickDeltaAxis: p.tickDeltaAxis === 'up' || p.tickDeltaAxis === 'down' ? p.tickDeltaAxis : d.tickDeltaAxis,
      upColor: color('upColor'), downColor: color('downColor'), averageColor: color('averageColor') }
  } catch { return d }
}
export function saveVolumePreferences(value: VolumePreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Keep controls usable without storage. */ }
}
