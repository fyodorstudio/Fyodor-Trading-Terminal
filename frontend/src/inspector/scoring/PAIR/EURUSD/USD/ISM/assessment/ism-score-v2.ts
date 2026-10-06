import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { contextReference, publicationsAsOf, contextPublications, latestContextPublication } from '../../../../../shared/core/publication-context'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'
import { assessIsmServicesScore, ismServicesSeriesIds, ismServicesSignals } from '../sectors/services/ism-services-score'
import { assessIsmManufacturing, ismManufacturingSeriesIds, ismManufacturingSignals } from '../sectors/manufacturing/ism-manufacturing-score'
import { ismPublicationIssue, ismEarliestKnownTime } from './ism-publication-check'

export const ismScoreV2Version = 'ism-eurusd-monthly-context-v2'
export const ismV2SeriesIds = [...ismServicesSeriesIds, ...ismManufacturingSeriesIds] as const
export const ismSectorWeights = { services: 70, manufacturing: 30 } as const
export type IsmV2Settings = { services?: MagnitudeSettings; manufacturing?: MagnitudeSettings }
export const supportsIsmV2 = (release: InspectorRelease | null) => !!release && release.currency === 'USD' &&
  release.country === 'US' && ['ism-services', 'ism-manufacturing'].includes(release.familyId)

function buildContext(month: number | null, at: number | null, events: readonly EconomicCalendarEvent[], settings: IsmV2Settings) {
  const validTime = at !== null && Number.isFinite(at)
  const sourceEvents = validTime ? publicationsAsOf(events.filter((e) => ismV2SeriesIds.includes(e.event_id as typeof ismV2SeriesIds[number])), at) : []
  const publications = contextPublications(sourceEvents)
  // Broker and official availability bounds both apply. A flagged publication
  // may enter later comparison history only once both bounds have passed.
  const availableEvents = validTime ? publicationsAsOf(sourceEvents, at, ismEarliestKnownTime) : []
  function member(sector: 'services' | 'manufacturing') {
    const selected = month === null ? { release: null, ambiguous: false } : latestContextPublication(publications, `ism-${sector}`, month)
    const release = selected.release
    const issue = !validTime ? 'A verified publication time is required.' : month === null ? 'A single valid reference month is required.' :
      selected.ambiguous ? 'Multiple publications share the latest sector timestamp.' : release ? ismPublicationIssue(release) ||
        (release.events.some((event) => (ismEarliestKnownTime(event) ?? -Infinity) > at!) ? 'Official publication time has not been reached; this sector is excluded.' : '') : ''
    const assessment = !release || issue ? null : sector === 'services' ? assessIsmServicesScore(release, availableEvents, settings.services) :
      assessIsmManufacturing(release, availableEvents, settings.manufacturing)
    const definitions = sector === 'services' ? ismServicesSignals : ismManufacturingSignals
    const included = assessment?.total !== null && assessment?.total !== undefined
    const readings = definitions.map((definition) => {
      const reading = assessment?.readings.find((row) => row.id === definition.id)
      // Integer weight units (10000 = 100%) make exact cancellation deterministic.
      const weight = definition.weight * ismSectorWeights[sector]
      const points = included && reading ? reading.points : null
      return { id: `${sector}:${definition.id}`, label: `${sector === 'services' ? 'Services' : 'Manufacturing'} ${definition.label}`,
        group: definition.group, weight, points, contribution: points === null ? null : points * weight / 10000 }
    })
    return { sector, weight: ismSectorWeights[sector], release, assessment, included, readings, issue,
      status: issue ? 'excluded' : !release ? 'pending' : included ? 'included' : 'unavailable' }
  }
  const services = member('services'), manufacturing = member('manufacturing')
  // This is also the documented tie priority: Services rows, then Manufacturing.
  const readings = [...services.readings, ...manufacturing.readings]
  const usable = readings.filter((row) => row.points !== null)
  const units = usable.length ? usable.reduce((sum, row) => sum + row.points! * row.weight, 0) : null
  const total = units === null ? null : units / 10000
  const tieBreak = units === 0 ? usable.find((row) => row.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const cautions: string[] = []
  const sectorConflict = services.included && manufacturing.included && services.assessment!.total! * manufacturing.assessment!.total! < 0
  if (sectorConflict) cautions.push('Manufacturing and Services point in opposing directions; evidence is capped at moderate.')
  const groupNet = (group: string) => usable.filter((row) => row.group === group).reduce((sum, row) => sum + row.points! * row.weight, 0)
  const demand = groupNet('demand'), labor = groupNet('labor'), prices = groupNet('prices')
  const laborConflict = demand * labor < 0
  if (laborConflict) cautions.push('Demand and employment comparisons disagree; evidence is capped at moderate.')
  const evidence = magnitudeEvidence(readings, direction, !!tieBreak, cautions)
  const describe = (value: number, positive: string, negative: string, zero: string) => value > 0 ? positive : value < 0 ? negative : zero
  const explanation = direction === 'uncomputed' ? usable.length ? 'Usable components show no directional change.' : 'No usable sector assessment is available at this publication.' :
    `${describe(demand, 'Demand supports USD', 'Demand weighs on USD', 'Demand provides no net directional vote')}; ${describe(labor, 'employment supports USD', 'employment weighs on USD', 'employment provides no net directional vote')}. ${describe(prices, 'Input-price pressure adds a smaller USD-supportive vote.', 'Easing input-price pressure adds a smaller USD-adverse vote.', 'Input prices add no net directional vote.')}`
  const contextId = month === null ? null : `ISM/${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`
  return { contextId, referenceMonth: month, asOf: at, services, manufacturing, readings, total, tieBreak, direction, label,
    explanation, sectorConflict, laborConflict, ...evidence, version: ismScoreV2Version }
}

export function assessIsmScoreV2(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: IsmV2Settings = {}) {
  if (!release || !supportsIsmV2(release)) return null
  const month = contextReference(release), at = release.timingUncertain ? null : release.releaseAt
  // Include selected source rows even when the caller's inventory range omits
  // that publication. Different value IDs still preserve duplicate ambiguity.
  const inventory = [...release.events, ...events]
  const assessment = buildContext(month, at, inventory, settings)
  const before = buildContext(month, at === null ? null : at - 1, inventory, settings)
  const update = assessment.direction === 'uncomputed' ? 'This update does not establish a usable direction.' : before.direction === 'uncomputed' ?
    `This publication establishes ${assessment.label} for the monthly context.` : assessment.direction !== before.direction ?
      `This publication changes the monthly context from ${before.label} to ${assessment.label}.` :
      `The monthly bias remains ${assessment.label}; weighted support ${Math.abs(assessment.total!) > Math.abs(before.total!) ? 'increases' : Math.abs(assessment.total!) < Math.abs(before.total!) ? 'decreases' : 'is unchanged'}.`
  return { ...assessment, previous: { label: before.label, total: before.total, direction: before.direction }, update }
}
