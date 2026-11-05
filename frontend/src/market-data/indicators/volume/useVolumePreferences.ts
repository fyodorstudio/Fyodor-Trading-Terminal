import { useCallback, useState } from 'react'
import { readVolumePreferences, saveVolumePreferences, type VolumePreferences } from './volume-preferences'

export function useVolumePreferences() {
  const [volume, setVolume] = useState(readVolumePreferences)
  const [volumeSettingsOpen, setVolumeSettingsOpen] = useState(false)
  const changeVolume = useCallback((next: VolumePreferences) => { saveVolumePreferences(next); setVolume(next) }, [])
  const toggleVolume = useCallback(() => setVolume(current => {
    const next = { ...current, enabled: !current.enabled }; saveVolumePreferences(next); return next
  }), [])
  return { volume, changeVolume, toggleVolume, volumeSettingsOpen, setVolumeSettingsOpen }
}
