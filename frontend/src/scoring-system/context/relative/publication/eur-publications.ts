import { groupInspectorReleases, inspectorEventChartTime } from '../../../../inspector/inspector-data'
import { assessEurScore } from '../../../PAIR/EURUSD/EUR/assessment/eur-score'
import { observedEur } from '../../../PAIR/EURUSD/EUR/assessment/eur-history'
import { eurNumericSeriesIds, eurPolicy } from '../../../PAIR/EURUSD/EUR/policy/eur-policies'
import type { EurContextInput, EurSource } from '../contracts'
import { eurSources } from './eur-sources'

export function eurPublications(input: EurContextInput) {
  const inventory = input.events.filter(e => observedEur(e) && e.release_at <= input.asOf && eurNumericSeriesIds.includes(e.event_id))
  const releases = groupInspectorReleases(inventory).filter(r => {
    const policy = eurPolicy(r.familyId)
    return policy !== null && input.families.includes(policy.family)
  })
  const valid = releases.filter(r => !r.timingUncertain && r.chartTime !== null && Number.isFinite(r.chartTime) &&
    r.events.every(e => inspectorEventChartTime(e) === r.chartTime))
    .sort((a, b) => a.releaseAt! - b.releaseAt! || a.id.localeCompare(b.id))
  for (let i = 1; i < valid.length; i++) {
    const previous = valid[i - 1], current = valid[i]
    if (current.chartTime! < previous.chartTime! || current.releaseAt === previous.releaseAt && current.chartTime !== previous.chartTime) {
      throw new Error('EUR history has inconsistent chart clocks; verify stored timing.')
    }
  }
  const updates = new Map<number, EurSource[]>()
  for (const release of valid) {
    const policy = eurPolicy(release.familyId)!
    const assessment = assessEurScore(release, inventory, input.settings[policy.family])
    if (!assessment) continue
    const chartAt = release.chartTime! * 1000
    const rows = eurSources(assessment, chartAt, release.releaseAt!, release.events.map(e => e.event_id))
    updates.set(chartAt, [...(updates.get(chartAt) ?? []), ...rows])
  }
  return { updates, excludedTiming: releases.length - valid.length }
}
