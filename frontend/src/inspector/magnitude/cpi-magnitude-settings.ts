import { cpiReadingRules } from '../grading/cpi-grading'
import { createMagnitudeSettingsStore, type MagnitudeScope } from './settings/magnitude-settings-store'

export const cpiMagnitudeScope: MagnitudeScope = { pair: 'EURUSD', currency: 'USD', side: 'QUOTE', family: 'CPI' }
export const cpiMagnitudeSettingsStore = createMagnitudeSettingsStore(cpiMagnitudeScope, Object.keys(cpiReadingRules))
