import { createMagnitudeSettingsStore, type MagnitudeSettingsStore } from '../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { eurPolicies, type EurFamily } from './eur-policies'
export const eurMagnitudeStores = Object.fromEntries(eurPolicies.map(policy => [policy.family,
  createMagnitudeSettingsStore({ pair: 'EURUSD', currency: 'EUR', side: 'base', family: policy.family.toUpperCase() + '-V1-SIGNALS' }, policy.signals.map(s => s.id))])) as Record<EurFamily, MagnitudeSettingsStore>
