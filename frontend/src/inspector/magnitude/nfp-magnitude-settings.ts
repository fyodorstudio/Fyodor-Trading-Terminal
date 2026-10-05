import { nfpReadingRules } from '../grading/nfp-grading'
import { createMagnitudeSettingsStore, type MagnitudeSettings, type MagnitudeScope } from './settings/magnitude-settings-store'

export const nfpMagnitudeScope: MagnitudeScope = { pair: 'EURUSD', currency: 'USD', side: 'QUOTE', family: 'NFP' }
export const nfpMagnitudeSettingsStore = createMagnitudeSettingsStore(nfpMagnitudeScope, Object.keys(nfpReadingRules))
const settings = nfpMagnitudeSettingsStore

export type NfpMagnitudeSettings = MagnitudeSettings
export const nfpMagnitudeSettingsKey = settings.key
export const normalizeNfpMagnitudeSettings = settings.normalize
export const readNfpMagnitudeSettings = settings.read
export const saveNfpMagnitudeLimits = settings.save
export const useNfpMagnitudeSettings = settings.useSettings
