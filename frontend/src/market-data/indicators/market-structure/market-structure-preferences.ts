export type MarketStructurePreferences = {
  enabled: boolean
  swingStrength: number
  breakBy: 'close' | 'wick'
  highColor: string
  lowColor: string
  lineWidth: number
  showUnbroken: boolean
}

export const swingStrengthLimits = { min: 1, max: 50 }
export const lineWidths = [1, 2, 3, 4]

export const defaultMarketStructurePreferences: MarketStructurePreferences = {
  enabled: false,
  swingStrength: 8,
  breakBy: 'close',
  highColor: '#e6bd45',
  lowColor: '#e24848',
  lineWidth: 2,
  showUnbroken: false,
}

const storageKey = 'fyodor.indicators.market-structure.v1'
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)

export function readMarketStructurePreferences(): MarketStructurePreferences {
  const defaults = defaultMarketStructurePreferences
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return defaults

    return {
      enabled: stored.enabled === true,
      swingStrength: Number.isInteger(stored.swingStrength) &&
        stored.swingStrength >= swingStrengthLimits.min && stored.swingStrength <= swingStrengthLimits.max
        ? stored.swingStrength : defaults.swingStrength,
      breakBy: stored.breakBy === 'wick' ? 'wick' : defaults.breakBy,
      highColor: isColor(stored.highColor) ? stored.highColor : defaults.highColor,
      lowColor: isColor(stored.lowColor) ? stored.lowColor : defaults.lowColor,
      lineWidth: lineWidths.includes(stored.lineWidth) ? stored.lineWidth : defaults.lineWidth,
      showUnbroken: stored.showUnbroken === true,
    }
  } catch {
    return defaults
  }
}

export function saveMarketStructurePreferences(preferences: MarketStructurePreferences) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  } catch {
    // Settings remain usable when local storage is unavailable.
  }
}
