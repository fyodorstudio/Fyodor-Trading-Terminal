import { useCallback, useState } from 'react'
import { readVolumePreferences, saveVolumePreferences, type TickDeltaView, type VolumePreferences } from './volume-preferences'

export function useVolumePreferences() {
  const [volume, setVolume] = useState(readVolumePreferences)
  const [volumeSettingsOpen, setVolumeSettingsOpen] = useState(false)
  const changeVolume = useCallback((next: VolumePreferences) => { saveVolumePreferences(next); setVolume(next) }, [])
  const toggleVolume = useCallback(() => setVolume(current => {
    const next = { ...current, enabled: !current.enabled }; saveVolumePreferences(next); return next
  }), [])
  const changeTickDeltaView = useCallback((tickDeltaView: TickDeltaView) => setVolume(current => {
    if (current.tickDeltaView === tickDeltaView) return current
    const next = { ...current, tickDeltaView }; saveVolumePreferences(next); return next
  }), [])
  return { volume, changeVolume, changeTickDeltaView, toggleVolume, volumeSettingsOpen, setVolumeSettingsOpen }
}
