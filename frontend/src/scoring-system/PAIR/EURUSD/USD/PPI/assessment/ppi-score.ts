import type { EconomicCalendarEvent } from '../../../../../../economic-calendar/contracts/calendar-event'
import { groupInspectorReleases } from '../../../../../../inspector/releases/group-releases'
import { type InspectorRelease } from '../../../../../../economic-calendar/releases/release'
import type { MagnitudeSettings } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { earlierSignalReadings } from '../../../../../shared/core/historical-release-signals'
import { weightedReleaseAssessment } from '../../../../../shared/core/weighted-release-assessment'
import { ppiScoreVersion, ppiSeriesIds, ppiSignals } from '../policy/ppi-policy'
import { ppiFeatures, supportsPpiScore } from './ppi-features'
export function assessPpiScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsPpiScore(release)) return null
  const history = earlierSignalReadings(release, events, ppiSeriesIds)
  const past = groupInspectorReleases(history).filter(supportsPpiScore).map(r => ppiFeatures(r, history))
  return weightedReleaseAssessment(ppiSignals, ppiFeatures(release, history), past, settings, ['core-pace', 'core-annual'], ppiScoreVersion)
}
