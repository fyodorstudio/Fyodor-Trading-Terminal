import { nfpReadingFamily, nfpGradingVersion } from '../grading/nfp-grading'
import { cpiReadingFamily, cpiGradingVersion } from '../grading/cpi-grading'
import { ppiReadingFamily, ppiGradingVersion } from '../grading/ppi-grading'
import type { ReadingFamily } from '../grading/reading-grading'
import { nfpMagnitudeSettingsStore } from './nfp-magnitude-settings'
import { cpiMagnitudeSettingsStore } from './cpi-magnitude-settings'
import { ppiMagnitudeSettingsStore } from './ppi-magnitude-settings'
import { expandedReadingFamilies } from '../grading/catalog/expanded-reading-families'
import { createMagnitudeSettingsStore } from './settings/magnitude-settings-store'
import type { MagnitudeSettingsStore } from './settings/magnitude-settings-store'

export type MagnitudeFamily = ReadingFamily & { label: string; historyStart: number; seriesIds: string[];
  gradingVersion: string; settings: MagnitudeSettingsStore; historyScope: { currency: ReadingFamily['currency']; eventIds: string[] };
  selectionMode?: 'series'; deltaScale?: number }
function family(readings: ReadingFamily, label: string, gradingVersion: string, settings: MagnitudeSettingsStore): MagnitudeFamily {
  const seriesIds = Object.keys(readings.readingRules)
  return { ...readings, label, gradingVersion, settings, seriesIds, historyStart: Date.UTC(2015, 0, 1),
    historyScope: { currency: readings.currency, eventIds: seriesIds } }
}
export const nfpMagnitudeFamily = family(nfpReadingFamily, 'NFP', nfpGradingVersion, nfpMagnitudeSettingsStore)
export const cpiMagnitudeFamily = family(cpiReadingFamily, 'CPI', cpiGradingVersion, cpiMagnitudeSettingsStore)
export const ppiMagnitudeFamily = family(ppiReadingFamily, 'PPI', ppiGradingVersion, ppiMagnitudeSettingsStore)
export const expandedMagnitudeFamilies: MagnitudeFamily[] = expandedReadingFamilies.map((readings) => ({
  ...family(readings, readings.label, 'native-change-vs-previous-v1', createMagnitudeSettingsStore(
    { pair: 'EURUSD', currency: readings.currency, side: readings.currency === 'EUR' ? 'BASE' : 'QUOTE', family: readings.familyId.toUpperCase() },
    Object.keys(readings.readingRules))), selectionMode: 'series', deltaScale: ['fomc', 'ecb'].includes(readings.familyId) ? 100 : 1,
}))
export const magnitudeFamilies = [nfpMagnitudeFamily, cpiMagnitudeFamily, ppiMagnitudeFamily, ...expandedMagnitudeFamilies]
