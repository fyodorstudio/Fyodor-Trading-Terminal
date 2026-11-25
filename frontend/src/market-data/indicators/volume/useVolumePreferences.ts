import { useCallback, useState } from 'react'
import { readVolumePreferences, saveVolumePreferences, type TickDeltaLine, type TickDeltaView, type VolumePreferences } from './volume-preferences'

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
  const toggleTickDeltaLine = useCallback((line: TickDeltaLine) => setVolume(current => {
    const next = { ...current, tickDeltaLines: { ...current.tickDeltaLines, [line]: !current.tickDeltaLines[line] } }
    saveVolumePreferences(next)
    return next
  }), [])
  const changeTickDeltaAxis = useCallback((tickDeltaAxis: TickDeltaLine) => setVolume(current => {
    if (current.tickDeltaAxis === tickDeltaAxis) return current
    const next = { ...current, tickDeltaAxis }
    saveVolumePreferences(next)
    return next
  }), [])
  return { volume, changeVolume, changeTickDeltaView, toggleTickDeltaLine, changeTickDeltaAxis, toggleVolume, volumeSettingsOpen, setVolumeSettingsOpen }
}
