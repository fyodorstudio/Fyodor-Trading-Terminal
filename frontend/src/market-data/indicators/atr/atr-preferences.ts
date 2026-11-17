export type AtrPreferences = {
  enabled: boolean
  length: number
  lineColor: string
  lineWidth: 1 | 2 | 3 | 4
}

export const defaultAtrPreferences: AtrPreferences = {
  enabled: false, length: 14, lineColor: '#ef5350', lineWidth: 1,
}

const storageKey = 'fyodor.indicators.atr.v1'

export function readAtrPreferences(): AtrPreferences {
  const defaults = defaultAtrPreferences
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
      length: Number.isInteger(parsed.length) && parsed.length >= 1 && parsed.length <= 1000 ? parsed.length : defaults.length,
      lineColor: typeof parsed.lineColor === 'string' && /^#[\da-f]{6}$/i.test(parsed.lineColor) ? parsed.lineColor : defaults.lineColor,
      lineWidth: [1, 2, 3, 4].includes(parsed.lineWidth) ? parsed.lineWidth : defaults.lineWidth,
    }
  } catch { return defaults }
}

export function saveAtrPreferences(preferences: AtrPreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)) }
  catch { /* Settings remain usable when local storage is unavailable. */ }
}
