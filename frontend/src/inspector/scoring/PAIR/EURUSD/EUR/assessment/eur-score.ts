import type { EconomicCalendarEvent } from '../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../magnitude/settings/magnitude-settings-store'
import { calibrateHistoricalSignal } from '../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../shared/core/magnitude-evidence'
import { eurPolicy, eurScoreVersion } from '../policy/eur-policies'
import { earlierEurSignalReleases, observedEur, eurReleaseMonth } from './eur-history'
import { eurFeatures } from './eur-features'

const cache = new WeakMap<readonly EconomicCalendarEvent[], { history: ReturnType<typeof prepare>['history']; releases: InspectorRelease[]; features: Map<string, ReturnType<typeof eurFeatures>> }>()
function prepare(events: readonly EconomicCalendarEvent[]) {
  const seen = new Set<string>()
  const history = events.filter(e => { if (!observedEur(e) || seen.has(e.value_id)) return false; seen.add(e.value_id); return true }) as (EconomicCalendarEvent & { release_at: number })[]
  const releases = groupInspectorReleases(history)
  return { history, releases, features: new Map(releases.map(r => [r.id, eurFeatures(r, history)])) }
}
export function assessEurScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  const policy = release && eurPolicy(release.familyId)
  if (!release || !policy || release.currency !== 'EUR' || release.country !== policy.country) return null
  let prepared = cache.get(events)
  if (!prepared) { prepared = prepare(events); cache.set(events, prepared) }
  const { history, releases, features: past } = prepared
  const current = eurFeatures(release, history)
  const isPmi = policy.family.endsWith('pmi')
  // A composite covers both sectors. Where absent in this publication, its
  // available sector reading is the one vote, not an extra composite vote.
  const hasUnemployment = release.events.some(e => e.event_id === '999030020')
  const hasEmployment = release.events.some(e => ['999030001','999030002'].includes(e.event_id))
  const laborPublication = policy.family === 'euro-labor' ? hasUnemployment && hasEmployment ? 'combined' : hasUnemployment ? 'monthly' : 'quarterly' : null
  const activePmi = isPmi ? ['composite', 'services', 'manufacturing'].find(id => current[id].value !== null) : null
  const readings = policy.signals.map(signal => {
    const earlier = earlierEurSignalReleases(releases, policy, signal, release)
    const samples = earlier.map(r => past.get(r.id)?.[signal.id]?.value).filter((v): v is number => v != null)
    const calibrated = calibrateHistoricalSignal(current[signal.id], samples, settings[signal.id])
    const weight = isPmi ? signal.id === activePmi ? 100 : 0 : laborPublication === 'monthly' ? signal.id === 'unemployment' ? 100 : 0 : laborPublication === 'quarterly' ? signal.id === 'employment' ? 75 : signal.id === 'employment-annual' ? 25 : 0 : signal.weight
    return { ...signal, ...calibrated, weight, contribution: calibrated.points === null ? null : calibrated.points * weight / 100 }
  })
  const voting = readings.filter(r => r.weight > 0), usable = voting.filter(r => r.points !== null)
  const total = usable.length ? Math.round(usable.reduce((sum, r) => sum + r.contribution!, 0) * 1e12) / 1e12 : null
  const tieBreak = total === 0 ? usable.find(r => r.points !== 0) ?? null : null
  const deciding = total === 0 ? tieBreak?.points ?? 0 : total
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'long' : 'short'
  const label = direction === 'long' ? 'EURUSD Long' : direction === 'short' ? 'EURUSD Short' : 'Uncomputed'
  const evidence = magnitudeEvidence(voting, direction === 'long' ? 'short' : direction === 'short' ? 'long' : 'uncomputed', !!tieBreak)
  const driver = usable.filter(r => Math.sign(r.contribution!) === Math.sign(deciding ?? 0)).sort((a,b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const explanation = direction === 'uncomputed' ? 'No calibrated directional change is available at this publication.' : tieBreak ?
    `Votes cancel; ${tieBreak.label.toLowerCase()} decides the bias with weak evidence.` :
    `${driver!.label} ${driver!.value! > 0 ? 'supports' : 'weighs on'} EUR under the declared numerical rule.${isPmi ? ' Composite and sector readings are not added together.' : ''}`
  const coverage = voting.length ? usable.reduce((sum,r) => sum + r.weight, 0) / 100 : 0
  return { policy, readings, total, tieBreak, direction, label, explanation, coverage, referenceMonth: eurReleaseMonth(release, policy),
    ...evidence, version: eurScoreVersion }
}
export type EurAssessment = NonNullable<ReturnType<typeof assessEurScore>>
