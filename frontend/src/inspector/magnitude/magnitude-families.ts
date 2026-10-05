import { nfpReadingFamily, nfpGradingVersion } from '../grading/nfp-grading'
import { cpiReadingFamily, cpiGradingVersion } from '../grading/cpi-grading'
import type { ReadingFamily } from '../grading/reading-grading'
import { nfpMagnitudeSettingsStore } from './nfp-magnitude-settings'
import { cpiMagnitudeSettingsStore } from './cpi-magnitude-settings'
import type { MagnitudeSettingsStore } from './settings/magnitude-settings-store'

export type MagnitudeFamily = ReadingFamily & { label: string; historyStart: number; seriesIds: string[];
  gradingVersion: string; settings: MagnitudeSettingsStore; historyScope: { currency: ReadingFamily['currency']; eventIds: string[] } }
function family(readings: ReadingFamily, label: string, gradingVersion: string, settings: MagnitudeSettingsStore): MagnitudeFamily {
  const seriesIds = Object.keys(readings.readingRules)
  return { ...readings, label, gradingVersion, settings, seriesIds, historyStart: Date.UTC(2015, 0, 1),
    historyScope: { currency: readings.currency, eventIds: seriesIds } }
}
export const nfpMagnitudeFamily = family(nfpReadingFamily, 'NFP', nfpGradingVersion, nfpMagnitudeSettingsStore)
export const cpiMagnitudeFamily = family(cpiReadingFamily, 'CPI', cpiGradingVersion, cpiMagnitudeSettingsStore)
export const magnitudeFamilies = [nfpMagnitudeFamily, cpiMagnitudeFamily]
