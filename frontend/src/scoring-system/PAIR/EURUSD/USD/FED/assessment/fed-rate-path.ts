import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector/inspector-data'
import { observedReading } from '../../../../../shared/core/historical-release-signals'
import { assessFedScore } from './fed-score'

// Rate-history facts do not become a second economic-context vote.
export function fedRatePath(release: InspectorRelease, events: readonly EconomicCalendarEvent[]) {
  const current = assessFedScore(release)
  if (release.releaseAt === null || release.chartTime === null || current?.actual == null) return null
  const earlier = groupInspectorReleases(events.filter(e => e.event_id === '840050014' && observedReading(e) && e.release_at < release.releaseAt!))
    .filter(r => r.familyId === 'fomc').sort((a,b) => b.releaseAt! - a.releaseAt!)
  const prior = earlier[0]
  if (!prior || prior.timingUncertain || prior.chartTime === null || prior.chartTime >= release.chartTime) return null
  const previous = assessFedScore(prior)
  if (previous?.actual == null) return null
  const delta = Math.round((current.actual - previous.actual) * 1e9) / 1e9
  const priorChange = earlier.slice(0, 8).map((r, i) => {
    const next = earlier[i + 1], a = assessFedScore(r), b = next && assessFedScore(next)
    return !next || r.timingUncertain || next.timingUncertain || r.chartTime === null || next.chartTime === null || r.chartTime <= next.chartTime || a?.actual == null || b?.actual == null ? null : a.actual - b.actual
  })
  const firstNonzero = priorChange.find(n => n === null || n !== 0)
  const path = delta > 0 ? 'Increase from the stored preceding meeting' : delta < 0 ? 'Reduction from the stored preceding meeting' :
    firstNonzero == null ? 'Hold; prior rate-cycle direction cannot be established' : firstNonzero < 0 ? 'Hold following the most recent stored rate reduction' : 'Hold following the most recent stored rate increase'
  return { previousAt: prior.releaseAt!, previousRate: previous.actual, meetingChangeBps: delta * 100, path,
    priorConsistent: current.previous === null ? null : current.previous === previous.actual }
}
