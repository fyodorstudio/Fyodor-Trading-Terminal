import { createMagnitudeSettingsStore } from '../../../inspector/magnitude/settings/magnitude-settings-store'
import { eurMagnitudeStores } from '../../PAIR/EURUSD/EUR/policy/eur-magnitude-settings'
import { claimsStandaloneMagnitude } from '../../PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-settings'

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
export const ismManufacturingSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'ISM-MANUFACTURING-V2-SIGNALS' },
  ['orders', 'employment', 'prices'])
export const retailSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'RETAIL-V1-SIGNALS' },
  ['control-pace', 'ex-autos-gas-pace', 'headline-pace'])
export const legacyClaimsSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'CLAIMS-V1-SIGNALS' },
  ['initial-trend', 'continuing-pressure', 'initial-week'])
export const claimsSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'CLAIMS-V2-SIGNALS' },
  ['initial-trend', 'continuing-pressure', 'initial-week'])
export const ppiSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'PPI-V1-SIGNALS' },
  ['core-pace', 'core-annual', 'headline-pace', 'headline-annual'])
export const gdpSignalSettings = createMagnitudeSettingsStore(
  { pair: 'EURUSD', currency: 'USD', side: 'quote', family: 'GDP-V1-SIGNALS' },
  ['growth', 'consumption', 'sales'])
export const signalMagnitudeStores = [cpiSignalSettings, nfpSignalSettings, pceSignalSettings, ismServicesSignalSettings, ismManufacturingSignalSettings, retailSignalSettings, claimsSignalSettings, legacyClaimsSignalSettings, ...Object.values(claimsStandaloneMagnitude), ppiSignalSettings, gdpSignalSettings, ...Object.values(eurMagnitudeStores)] as const
