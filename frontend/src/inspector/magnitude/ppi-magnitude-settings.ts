import { ppiReadingRules } from '../grading/ppi-grading'
import { createMagnitudeSettingsStore, type MagnitudeScope } from './settings/magnitude-settings-store'

export const ppiMagnitudeScope: MagnitudeScope = { pair: 'EURUSD', currency: 'USD', side: 'QUOTE', family: 'PPI' }
export const ppiMagnitudeSettingsStore = createMagnitudeSettingsStore(ppiMagnitudeScope, Object.keys(ppiReadingRules))
