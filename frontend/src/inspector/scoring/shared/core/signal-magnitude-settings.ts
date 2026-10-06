import { createMagnitudeSettingsStore } from '../../../magnitude/settings/magnitude-settings-store'

// These cutoffs grade derived scorer inputs, separately from the original A−P series.
export const cpiSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'CPI-V3-SIGNALS' },
  ['fresh', 'trend', 'annual', 'headline'])
export const nfpSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'NFP-V2-SIGNALS' },
  ['hiring', 'unemployment', 'wages', 'revision', 'hours'])
export const pceSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'PCE-V1-SIGNALS' },
  ['core-pace', 'core-annual', 'headline-pace', 'headline-annual'])
export const ismServicesSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'ISM-SERVICES-V1-SIGNALS' },
  ['orders', 'activity', 'employment', 'prices'])
export const signalMagnitudeStores = [cpiSignalSettings, nfpSignalSettings, pceSignalSettings, ismServicesSignalSettings] as const
