import { useCallback, useState } from 'react'
import { readRsiPreferences, saveRsiPreferences, type RsiPreferences } from './rsi-preferences'

export function useRsiPreferences() {
  const [rsi, setRsi] = useState(readRsiPreferences)
  const [rsiSettingsOpen, setRsiSettingsOpen] = useState(false)
  const changeRsi = useCallback((next: RsiPreferences) => { saveRsiPreferences(next); setRsi(next) }, [])
  const toggleRsi = useCallback(() => setRsi(current => {
    const next = { ...current, enabled: !current.enabled }
    saveRsiPreferences(next)
    return next
  }), [])
  return { rsi, changeRsi, toggleRsi, rsiSettingsOpen, setRsiSettingsOpen }
}
