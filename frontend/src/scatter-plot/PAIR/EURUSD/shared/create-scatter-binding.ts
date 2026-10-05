import type { MagnitudeFamily } from '../../../../inspector/magnitude/magnitude-families'
import type { ScatterFamilyBinding } from '../../../dock/FamilyScatterPanel'
import { familyScatterModel } from '../../../inspection/family-scatter-model'

export function createScatterBinding(family: MagnitudeFamily): ScatterFamilyBinding {
  return { family, scope: {
    pair: { id: 'EURUSD', label: 'EURUSD' },
    side: { id: `${family.currency}/${family.currency === 'EUR' ? 'BASE' : 'QUOTE'}`, label: `${family.currency} / ${family.currency === 'EUR' ? 'Base' : 'Quote'}` },
    family: { id: family.familyId.toUpperCase(), label: family.label },
    series: Object.entries(family.readingRules).map(([id, rule]) => ({ id, label: rule.name })),
  }, model: (events, now, series, release, settings) => familyScatterModel(events, now, series, release, family, settings) }
}
