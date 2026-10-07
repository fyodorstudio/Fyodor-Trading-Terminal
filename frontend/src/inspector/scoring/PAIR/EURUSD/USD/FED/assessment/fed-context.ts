import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector-data'
import { observedReading } from '../../../../../shared/core/historical-release-signals'
import type { ContextResult } from '../../../../../../../usd-context/core/contracts'
import { assessFedScore } from './fed-score'

export function previousFedMeeting(release: InspectorRelease, events: readonly EconomicCalendarEvent[]) {
  if (release.releaseAt === null) return null
  const earlier = groupInspectorReleases(events.filter(e => e.event_id === '840050014' &&
    observedReading(e) && e.release_at < release.releaseAt!))
    .filter(r => r.familyId === 'fomc').sort((a, b) => b.releaseAt! - a.releaseAt!)
  const previous = earlier[0]
  // An ambiguous latest meeting cannot be replaced silently with an older one.
  return previous && !previous.timingUncertain && previous.chartTime !== null &&
    release.chartTime !== null && previous.chartTime < release.chartTime && assessFedScore(previous)?.actual != null ? previous : null
}

export function fedContextPressure(result: ContextResult | null) {
  if (result?.decision && result.decision.state !== 'directional') return result.decision.reason
  if (!result || result.direction === 'uncomputed') return 'No usable economic-context direction is available from the enabled families.'
  const active = result.members.filter(m => m.status === 'active')
  const domain = (families: string[]) => active.filter(m => families.includes(m.family)).reduce((sum, m) => sum + m.contribution, 0)
  const inflation = domain(['cpi', 'pce', 'ppi']), labor = domain(['nfp', 'claims'])
  if (result.policy?.mode === 'labor-priority') return 'Confirmed labor deterioration receives priority under the shared inflation safeguards. This suggests easing pressure under our interpretation rules.'
  if (inflation < 0 && labor < 0) return 'Inflation and labor evidence both favor USD weakness. Under our interpretation rules, this increases pressure toward easier policy.'
  if (inflation > 0 && labor > 0) return 'Inflation and labor evidence both favor USD strength. Under our interpretation rules, this supports keeping policy tighter.'
  if (inflation * labor < 0) return 'Inflation and labor point toward different policy pressures; their current weights, coverage and age determine the combined bias.'
  return 'The enabled economic evidence supplies this USD bias; it does not establish the Fed’s policy intention.'
}
