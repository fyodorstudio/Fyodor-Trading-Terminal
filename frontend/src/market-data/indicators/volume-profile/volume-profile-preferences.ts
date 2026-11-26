import type { ProfileMode, ProfileSide } from './volume-profile'

export type ProfileMethod = 'ticks' | 'hourly'
export type VolumeProfileStyle = { side: ProfileSide; colors: Record<'bars' | 'POC' | 'HVN' | 'LVN', string> }
export type VolumeProfilePreferences = VolumeProfileStyle & { mode: ProfileMode; method: ProfileMethod }

export const profileModeOptions = [
  ['visible', 'Visible Range'], ['fixed', 'Fixed Range'], ['cutoff', 'Right of Line'],
] as const
export const defaultVolumeProfilePreferences: VolumeProfilePreferences = {
  mode: 'visible', method: 'ticks', side: 'right',
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
      method: saved?.method === 'hourly' ? 'hourly' : defaults.method,
      colors: { bars: color('bars'), POC: color('POC'), HVN: color('HVN'), LVN: color('LVN') },
    }
  } catch { return defaults }
}

export function saveVolumeProfilePreferences(preferences: VolumeProfilePreferences) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Settings work without storage. */ }
}
