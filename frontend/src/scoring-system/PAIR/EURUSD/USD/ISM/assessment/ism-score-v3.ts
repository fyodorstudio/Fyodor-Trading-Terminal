import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import { assessIsmMonthlyContext, type IsmSectorSettings } from './ism-monthly-context'

export const ismScoreV3Version = 'ism-eurusd-monthly-resolution-v3'
type Context = NonNullable<ReturnType<typeof assessIsmMonthlyContext>>
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })

// Resolve the latest context's original component votes once. Combining the two
// publication labels/scores would count Manufacturing twice and discard magnitude.
export function resolveIsmV3(context: Context | null) {
  if (!context) return null
  const contribution = (sector: 'manufacturing' | 'services') => context[sector].readings
    .reduce((sum, row) => sum + (row.points ?? 0) * row.weight, 0) / 10000
  const manufacturingContribution = contribution('manufacturing'), servicesContribution = contribution('services')
  const winner = context.direction === 'uncomputed' ? null : context.tieBreak ? 'priority' :
    manufacturingContribution * servicesContribution < 0 ?
      Math.abs(servicesContribution) > Math.abs(manufacturingContribution) ? 'services' : 'manufacturing' : 'agreement'
  const dominance = context.direction === 'uncomputed' ? 'No usable directional evidence is available.' : context.tieBreak ?
    `Weighted votes cancel. ${context.tieBreak.label} decides ${context.label} by the published priority; evidence is weak.` :
    winner === 'services' || winner === 'manufacturing' ?
      `${winner === 'services' ? 'Services' : 'Manufacturing'} wins the weighted comparison: Services ${number(servicesContribution)}, Manufacturing ${number(manufacturingContribution)}; net USD score ${number(context.total!)} → ${context.label}.` :
      `Available sector votes support ${context.label}: Services ${number(servicesContribution)}, Manufacturing ${number(manufacturingContribution)}; net USD score ${number(context.total!)}.`
  return { ...context, manufacturingContribution, servicesContribution, winner, dominance, version: ismScoreV3Version }
}

export function assessIsmScoreV3(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: IsmSectorSettings = {}, includePrevious = true) {
  return resolveIsmV3(assessIsmMonthlyContext(release, events, settings, includePrevious))
}
