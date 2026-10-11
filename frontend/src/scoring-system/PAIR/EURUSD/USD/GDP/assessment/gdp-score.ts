import type { EconomicCalendarEvent } from '../../../../../../economic-calendar/contracts/calendar-event'
import { groupInspectorReleases } from '../../../../../../inspector/releases/group-releases'
import { type InspectorRelease } from '../../../../../../economic-calendar/releases/release'
import type { MagnitudeSettings } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { earlierSignalReadings } from '../../../../../shared/core/historical-release-signals'
import { weightedReleaseAssessment } from '../../../../../shared/core/weighted-release-assessment'
import { gdpScoreVersion, gdpSeriesIds, gdpSignals } from '../policy/gdp-policy'
import { gdpFeatures, gdpStage, referenceQuarter, supportsGdpScore } from './gdp-features'
export function assessGdpScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsGdpScore(release)) return null
  const history = earlierSignalReadings(release, events, gdpSeriesIds), stage = gdpStage(release, history)
  const publications = groupInspectorReleases(history).filter(supportsGdpScore).filter(r => gdpStage(r, history) === stage)
  // One most recent new-quarter signal per quarter; revisions have their own calibration population.
  const unique = stage === 'revision' ? publications : publications.filter((r, i) => !publications.slice(i+1).some(later =>
    referenceQuarter(later.events.find(e => e.event_id === '840010007')!) === referenceQuarter(r.events.find(e => e.event_id === '840010007')!)))
  const past = unique.map(r => gdpFeatures(r, history))
  return { ...weightedReleaseAssessment(gdpSignals, gdpFeatures(release, history), past, settings, ['growth'], gdpScoreVersion), stage }
}
