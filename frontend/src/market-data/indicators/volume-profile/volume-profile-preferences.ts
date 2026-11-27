import type { ProfileMode, ProfileSide } from './volume-profile'

export type VolumeProfileStyle = { side: ProfileSide; colors: Record<'bars' | 'POC' | 'HVN' | 'LVN', string> }
export type VolumeProfilePreferences = VolumeProfileStyle & {
  mode: ProfileMode; cutoffSide: ProfileSide; lookbackMinutes: number; anchorRatio: number
}

export const profileModeOptions = [
  ['visible', 'Follow Mode'], ['fixed', 'Fixed Range'], ['cutoff', 'Vertical Line'],
] as const
export const defaultVolumeProfilePreferences: VolumeProfilePreferences = {
  mode: 'visible', side: 'right', cutoffSide: 'right', lookbackMinutes: 360, anchorRatio: 0.94,
  colors: { bars: '#5c82cc', POC: '#d49b2d', HVN: '#25a596', LVN: '#8897a9' },
}
const storageKey = 'fyodor.indicators.volume-profile.v1'

export function readVolumeProfilePreferences(): VolumeProfilePreferences {
  const defaults = defaultVolumeProfilePreferences
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')
    const color = (key: keyof VolumeProfileStyle['colors']) => {
      const value: unknown = saved?.colors?.[key]
      return typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value) ? value : defaults.colors[key]
    }
    return {
      mode: saved?.mode === 'fixed' || saved?.mode === 'cutoff' ? saved.mode : defaults.mode,
      side: saved?.side === 'left' ? 'left' : defaults.side,
      cutoffSide: saved?.cutoffSide === 'left' ? 'left' : defaults.cutoffSide,
      lookbackMinutes: Number.isSafeInteger(saved?.lookbackMinutes) && saved.lookbackMinutes > 0
        ? saved.lookbackMinutes : defaults.lookbackMinutes,
      anchorRatio: Number.isFinite(saved?.anchorRatio) && saved.anchorRatio >= 0 && saved.anchorRatio <= 1
        ? saved.anchorRatio : defaults.anchorRatio,
      colors: { bars: color('bars'), POC: color('POC'), HVN: color('HVN'), LVN: color('LVN') },
    }
  } catch { return defaults }
}

export function saveVolumeProfilePreferences(preferences: VolumeProfilePreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Settings work without storage. */ }
}
