import { useCallback, useState } from 'react'
import {
  readMarketStructurePreferences, saveMarketStructurePreferences, type MarketStructurePreferences,
} from './market-structure-preferences'

export function useMarketStructurePreferences() {
  const [marketStructure, setMarketStructure] = useState(readMarketStructurePreferences)
  const [marketStructureSettingsOpen, setMarketStructureSettingsOpen] = useState(false)
  const changeMarketStructure = useCallback((next: MarketStructurePreferences) => {
    saveMarketStructurePreferences(next)
    setMarketStructure(next)
  }, [])
  const toggleMarketStructure = () => changeMarketStructure({ ...marketStructure, enabled: !marketStructure.enabled })

  return { marketStructure, changeMarketStructure, toggleMarketStructure, marketStructureSettingsOpen, setMarketStructureSettingsOpen }
}
