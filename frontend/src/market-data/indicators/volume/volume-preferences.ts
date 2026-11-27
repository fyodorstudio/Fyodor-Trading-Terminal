export type TickDeltaView = 'bars' | 'line'
export type TickDeltaLine = 'up' | 'down' | 'total' | 'delta'
export type TickDeltaLines = Record<TickDeltaLine, boolean>
export type TickDeltaLabels = { position: 'off' | 'above' | 'below'; display: 'always' | 'hover'; positive: string; negative: string }
export type TickDeltaStyle = {
  upColor: string; downColor: string; totalTicksColor: string; tickDeltaColor: string
  redCandleDivergenceColor: string; greenCandleDivergenceColor: string
  tickDeltaDotsVisible: boolean; totalTicksDotsVisible: boolean
}

export type VolumePreferences = TickDeltaStyle & {
  enabled: boolean; mode: 'raw' | 'relative' | 'tick-delta'; axisTarget: 'volume' | 'relative'
  barsVisible: boolean; relativeLineVisible: boolean; relativeLineColor: string
  lookback: number; minimumSamples: number; averageVisible: boolean; averageLength: number
  averageColor: string
  tickDeltaView: TickDeltaView
  tickDeltaLines: TickDeltaLines
  tickDeltaAxis: TickDeltaLine
  tickDeltaLabels: TickDeltaLabels
}
export type VolumeLayer = 'barsVisible' | 'relativeLineVisible' | 'averageVisible'
export const defaultVolumePreferences: VolumePreferences = {
  enabled: false, mode: 'raw', axisTarget: 'volume', lookback: 20, minimumSamples: 5,
  barsVisible: true, relativeLineVisible: true, relativeLineColor: '#2962ff',
  averageVisible: false, averageLength: 20, upColor: '#089981', downColor: '#f23645', averageColor: '#b18a00',
  totalTicksColor: '#38bdf8', tickDeltaColor: '#7e57c2',
  redCandleDivergenceColor: '#ffeb3b', greenCandleDivergenceColor: '#ffeb3b',
  tickDeltaDotsVisible: true, totalTicksDotsVisible: false,
  tickDeltaView: 'bars',
  tickDeltaLines: { up: true, down: true, total: false, delta: true },
  tickDeltaAxis: 'delta',
  tickDeltaLabels: { position: 'off', display: 'always', positive: '#089981', negative: '#f23645' },
}
const storageKey = 'fyodor.indicators.volume.v1'
export function readVolumePreferences(): VolumePreferences {
  const d = defaultVolumePreferences
  try {
    const p = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    if (!p || typeof p !== 'object' || Array.isArray(p)) return d
    const integer = (key: 'lookback' | 'minimumSamples' | 'averageLength', min: number, max: number) =>
      Number.isInteger(p[key]) && p[key] >= min && p[key] <= max ? p[key] as number : d[key]
    const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
    type ColorKey = Exclude<keyof TickDeltaStyle, 'tickDeltaDotsVisible' | 'totalTicksDotsVisible'> | 'averageColor' | 'relativeLineColor'
    const color = (key: ColorKey, fallback = d[key]) => isColor(p[key]) ? p[key] : fallback
    const legacyDivergence = isColor(p.tickDivergenceColor) ? p.tickDivergenceColor : undefined
    const flag = (key: 'relativeLineVisible' | 'barsVisible' | 'tickDeltaDotsVisible' | 'totalTicksDotsVisible') =>
      typeof p[key] === 'boolean' ? p[key] : d[key]
    const lookback = integer('lookback', 5, 60)
    return { enabled: p.enabled === true, mode: p.mode === 'relative' || p.mode === 'tick-delta' ? p.mode : 'raw', axisTarget: p.axisTarget === 'relative' ? 'relative' : 'volume',
      lookback,
      barsVisible: flag('barsVisible'), relativeLineVisible: flag('relativeLineVisible'), relativeLineColor: color('relativeLineColor'),
      minimumSamples: Math.min(integer('minimumSamples', 1, 60), lookback),
      averageVisible: p.averageVisible === true, averageLength: integer('averageLength', 1, 200),
      tickDeltaView: p.tickDeltaView === 'line' ? 'line' : d.tickDeltaView,
      tickDeltaLines: { up: p.tickDeltaLines?.up !== false, down: p.tickDeltaLines?.down !== false, total: p.tickDeltaLines?.total === true, delta: p.tickDeltaLines?.delta !== false },
      tickDeltaAxis: p.tickDeltaAxis === 'up' || p.tickDeltaAxis === 'down' || p.tickDeltaAxis === 'total' ? p.tickDeltaAxis : d.tickDeltaAxis,
      tickDeltaLabels: {
        position: p.tickDeltaLabels?.position === 'above' || p.tickDeltaLabels?.position === 'below' ? p.tickDeltaLabels.position : 'off',
        display: p.tickDeltaLabels?.display === 'hover' ? 'hover' : d.tickDeltaLabels.display,
        positive: isColor(p.tickDeltaLabels?.positive) ? p.tickDeltaLabels.positive : d.tickDeltaLabels.positive,
        negative: isColor(p.tickDeltaLabels?.negative) ? p.tickDeltaLabels.negative : d.tickDeltaLabels.negative,
      },
      upColor: color('upColor'), downColor: color('downColor'), averageColor: color('averageColor'),
      totalTicksColor: color('totalTicksColor'), tickDeltaColor: color('tickDeltaColor'),
      redCandleDivergenceColor: color('redCandleDivergenceColor', legacyDivergence),
      greenCandleDivergenceColor: color('greenCandleDivergenceColor', legacyDivergence),
      tickDeltaDotsVisible: flag('tickDeltaDotsVisible'), totalTicksDotsVisible: flag('totalTicksDotsVisible') }
  } catch { return d }
}
export function saveVolumePreferences(value: VolumePreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Keep controls usable without storage. */ }
}
