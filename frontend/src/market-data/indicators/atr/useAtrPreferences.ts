import { useCallback, useState } from 'react'
import { readAtrPreferences, saveAtrPreferences, type AtrPreferences } from './atr-preferences'

export function useAtrPreferences() {
  const [atr, setAtr] = useState(readAtrPreferences)
  const [atrSettingsOpen, setAtrSettingsOpen] = useState(false)
  const changeAtr = useCallback((next: AtrPreferences) => { saveAtrPreferences(next); setAtr(next) }, [])
  const toggleAtr = useCallback(() => setAtr(current => {
    const next = { ...current, enabled: !current.enabled }
    saveAtrPreferences(next)
    return next
  }), [])
  return { atr, changeAtr, toggleAtr, atrSettingsOpen, setAtrSettingsOpen }
}
