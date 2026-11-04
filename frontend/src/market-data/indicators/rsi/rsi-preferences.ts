export const rsiSources = ['Close', 'Open', 'High', 'Low', 'HL2', 'HLC3', 'OHLC4'] as const
export const rsiSmoothingTypes = ['None', 'SMA', 'EMA', 'SMMA (RMA)', 'WMA'] as const
export type RsiSource = typeof rsiSources[number]
export type RsiSmoothing = typeof rsiSmoothingTypes[number]
export type RsiBand = { value: number; visible: boolean; color: string }
export type RsiPreferences = {
  enabled: boolean; length: number; source: RsiSource; smoothing: RsiSmoothing; smoothingLength: number
  lineVisible: boolean; lineColor: string; lineWidth: 1 | 2 | 3 | 4
  averageVisible: boolean; averageColor: string; averageWidth: 1 | 2 | 3 | 4
  upper: RsiBand; middle: RsiBand; lower: RsiBand
  fillVisible: boolean; fillColor: string; fillOpacity: number
}

export const defaultRsiPreferences: RsiPreferences = {
  enabled: false, length: 14, source: 'Close', smoothing: 'SMA', smoothingLength: 14,
  lineVisible: true, lineColor: '#7e57c2', lineWidth: 1,
  averageVisible: true, averageColor: '#e4b600', averageWidth: 1,
  upper: { value: 70, visible: true, color: '#787b86' },
  middle: { value: 50, visible: true, color: '#9699a3' },
  lower: { value: 30, visible: true, color: '#787b86' },
  fillVisible: true, fillColor: '#7e57c2', fillOpacity: 10,
}

const storageKey = 'fyodor.indicators.rsi.v1'
const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback
const integer = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback
const flag = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback

export function readRsiPreferences(): RsiPreferences {
  const defaults = defaultRsiPreferences
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults
    const band = (key: 'upper' | 'middle' | 'lower'): RsiBand => ({
      value: integer(parsed[key]?.value, 0, 100, defaults[key].value),
      visible: flag(parsed[key]?.visible, defaults[key].visible),
      color: color(parsed[key]?.color, defaults[key].color),
    })
    const upper = band('upper'), middle = band('middle'), lower = band('lower')
    const ordered = lower.value < middle.value && middle.value < upper.value
    return {
      enabled: flag(parsed.enabled, defaults.enabled),
      length: integer(parsed.length, 1, 1000, defaults.length),
      source: rsiSources.includes(parsed.source) ? parsed.source : defaults.source,
      smoothing: rsiSmoothingTypes.includes(parsed.smoothing) ? parsed.smoothing : defaults.smoothing,
      smoothingLength: integer(parsed.smoothingLength, 1, 1000, defaults.smoothingLength),
      lineVisible: flag(parsed.lineVisible, defaults.lineVisible), lineColor: color(parsed.lineColor, defaults.lineColor),
      lineWidth: integer(parsed.lineWidth, 1, 4, defaults.lineWidth) as RsiPreferences['lineWidth'],
      averageVisible: flag(parsed.averageVisible, defaults.averageVisible), averageColor: color(parsed.averageColor, defaults.averageColor),
      averageWidth: integer(parsed.averageWidth, 1, 4, defaults.averageWidth) as RsiPreferences['averageWidth'],
      upper: ordered ? upper : defaults.upper, middle: ordered ? middle : defaults.middle, lower: ordered ? lower : defaults.lower,
      fillVisible: flag(parsed.fillVisible, defaults.fillVisible), fillColor: color(parsed.fillColor, defaults.fillColor),
      fillOpacity: integer(parsed.fillOpacity, 0, 100, defaults.fillOpacity),
    }
  } catch { return defaults }
}

export function saveRsiPreferences(preferences: RsiPreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)) }
  catch { /* Settings remain usable when local storage is unavailable. */ }
}
