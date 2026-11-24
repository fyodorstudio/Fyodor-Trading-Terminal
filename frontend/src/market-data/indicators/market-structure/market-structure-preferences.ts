export const marketStructureMarkerLabels = {
  sweep: 'Sweep',
  confirmed: 'Breakout confirmed',
  pending: 'Pending',
  failed: 'Failed breakout',
  reclaim: 'Reclaim',
} as const

type MarkerKind = keyof typeof marketStructureMarkerLabels
export const marketStructureMarkerKinds = Object.keys(marketStructureMarkerLabels) as MarkerKind[]

export type MarketStructurePreferences = {
  enabled: boolean
  swingStrength: number
  confirmationCloses: number
  failureWindow: number
  atrBufferPercent: number
  highColor: string
  lowColor: string
  lineWidth: number
  showDashedLines: boolean
  showSolidLines: boolean
  showUnbroken: boolean
  extendLines: boolean
  showAutoTrendlines: boolean
  showMajorTrendlines: boolean
  showMinorTrendlines: boolean
  showHistoricalTrendlines: boolean
  showMarkers: boolean
  markerColors: Record<MarkerKind, string>
}

export const swingStrengthLimits = { min: 1, max: 50 }
export const maxAtrBufferPercent = 100
export const confirmationCloseOptions = [2, 3, 4, 5]
export const failureWindowOptions = [0, 1, 2, 3, 4, 5]
export const lineWidths = [1, 2, 3, 4]

export const defaultMarketStructurePreferences: MarketStructurePreferences = {
  enabled: false,
  swingStrength: 8,
  confirmationCloses: 2,
  failureWindow: 3,
  atrBufferPercent: 10,
  highColor: '#e6bd45',
  lowColor: '#e24848',
  lineWidth: 2,
  showDashedLines: true,
  showSolidLines: true,
  showUnbroken: true,
  extendLines: false,
  showAutoTrendlines: false,
  showMajorTrendlines: true,
  showMinorTrendlines: true,
  showHistoricalTrendlines: false,
  showMarkers: true,
  markerColors: {
    sweep: '#8b5cf6',
    confirmed: '#059669',
    pending: '#3b82f6',
    failed: '#dc2626',
    reclaim: '#c27803',
  },
}

const storageKey = 'fyodor.indicators.market-structure.v2'
const legacyStorageKey = 'fyodor.indicators.market-structure.v1'
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)

export function readMarketStructurePreferences(): MarketStructurePreferences {
  const defaults = defaultMarketStructurePreferences
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey) ?? '{}')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return defaults
    const markerColors = { ...defaults.markerColors }
    for (const kind of marketStructureMarkerKinds) {
      const color = stored.markerColors?.[kind]
      if (isColor(color)) markerColors[kind] = color
    }

    return {
      enabled: stored.enabled === true,
      swingStrength: Number.isInteger(stored.swingStrength) &&
        stored.swingStrength >= swingStrengthLimits.min && stored.swingStrength <= swingStrengthLimits.max
        ? stored.swingStrength : defaults.swingStrength,
      confirmationCloses: confirmationCloseOptions.includes(stored.confirmationCloses) ? stored.confirmationCloses : defaults.confirmationCloses,
      failureWindow: failureWindowOptions.includes(stored.failureWindow) ? stored.failureWindow : defaults.failureWindow,
      atrBufferPercent: Number.isInteger(stored.atrBufferPercent) && stored.atrBufferPercent >= 0 && stored.atrBufferPercent <= maxAtrBufferPercent
        ? stored.atrBufferPercent : defaults.atrBufferPercent,
      highColor: isColor(stored.highColor) ? stored.highColor : defaults.highColor,
      lowColor: isColor(stored.lowColor) ? stored.lowColor : defaults.lowColor,
      lineWidth: lineWidths.includes(stored.lineWidth) ? stored.lineWidth : defaults.lineWidth,
      showDashedLines: stored.showDashedLines !== false,
      showSolidLines: stored.showSolidLines !== false,
      showUnbroken: stored.showUnbroken !== false,
      extendLines: stored.extendLines === true,
      showAutoTrendlines: stored.showAutoTrendlines === true,
      showMajorTrendlines: stored.showMajorTrendlines !== false,
      showMinorTrendlines: stored.showMinorTrendlines !== false,
      showHistoricalTrendlines: stored.showHistoricalTrendlines === true,
      showMarkers: typeof stored.showMarkers === 'boolean' ? stored.showMarkers : stored.showLabels !== false,
      markerColors,
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
