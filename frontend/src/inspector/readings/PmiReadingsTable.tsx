import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { formatInspectorValue, inspectorDelta, hasRevisedPreviousChange } from './reading-values'
import { type InspectorRelease } from '../../economic-calendar/releases/release'
import { InspectorReadingTime } from '../InspectorReadingTime'
import { pmiSectionLabel } from '../episodes/pmi-episodes'
import { magnitudeFamilies } from '../magnitude/magnitude-families'
import { useFamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'
import { FamilyMagnitudeCell } from '../magnitude/FamilyMagnitudeCell'
import { gradeFamilyReading, gradeLabels, matchesReadingFamily, revisedFamilyComparison, suppliedPriorLabels } from '../grading/reading-grading'
import type { InspectorView } from '../useInspector'

function PmiSection({ release, view, timeDisplay, showPeriod, tableOnly }: { release: InspectorRelease; view: InspectorView; timeDisplay: TimeDisplayPreference; showPeriod: boolean; tableOnly: boolean }) {
  const family = magnitudeFamilies.find(item => matchesReadingFamily(release, item))!
  const history = useFamilyMagnitudeHistory(view.brokerId, tableOnly ? null : release)
  const clock = release.releaseAt
  return <tbody>
    <tr className="inspector-ism-section-heading"><th scope="rowgroup" colSpan={tableOnly ? 5 : 6}>
      {pmiSectionLabel(release)} · {clock === null ? 'Time unavailable' : formatAppTimestamp(clock, timeDisplay)}
    </th></tr>
    {release.events.map(event => {
      const grading = gradeFamilyReading(event, release.familyId, family)
      const revised = revisedFamilyComparison(event, release.familyId, family)
      return <tr key={event.value_id}>
        <td><strong>{event.name}</strong>{event.revision > 0 && <span className="inspector-revision"> · Revision {event.revision}</span>}
          {showPeriod && <small>Period: {formatAppTimestamp(event.period_seconds * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}</small>}</td>
        <InspectorReadingTime event={event} brokerTime={view.brokerTime} timeDisplay={timeDisplay} />
        <td>{formatInspectorValue(event.actual, event)}</td>
        <td>{formatInspectorValue(event.previous, event)}{hasRevisedPreviousChange(event) && <small title={suppliedPriorLabels(event).description}>
          {suppliedPriorLabels(event).value}: {formatInspectorValue(event.revised_previous, event)}</small>}</td>
        <td className={grading ? `inspector-graded-delta inspector-grade-${grading.grade}` : undefined} title={grading?.explanation}>
          {formatInspectorValue(inspectorDelta(event), event, true)}{grading && <span className="inspector-row-grade">{gradeLabels[grading.grade]}</span>}
          {revised && <div className={`inspector-secondary-reading inspector-grade-${revised.grade}`} title={revised.explanation}>
            {revised.label}: {formatInspectorValue(revised.delta, event, true)}<span className="inspector-row-grade">{gradeLabels[revised.grade]}</span></div>}</td>
        {!tableOnly && <FamilyMagnitudeCell event={event} history={history} grade={grading?.grade ?? 'unrated'} deltaScale={family.deltaScale}
          showHistogram={view.preferences.showHistograms} secondaryComparison={revised} />}
      </tr>
    })}
  </tbody>
}

export function PmiReadingsTable({ release, view, timeDisplay, tableOnly = false }: { release: InspectorRelease; view: InspectorView; timeDisplay: TimeDisplayPreference; tableOnly?: boolean }) {
  const showPeriod = new Set(release.events.map(event => event.period_seconds)).size > 1
  return <div className="inspector-table-scroll"><table className={!tableOnly && view.preferences.showHistograms ? 'inspector-magnitude-table' : undefined} aria-label={`${release.label} release readings`}>
    <thead><tr><th>Series</th><th>Release time</th><th>Actual</th><th>Previous</th><th>A−P</th>{!tableOnly && <th>{view.preferences.showHistograms ? 'A−P magnitude · History' : 'Magnitude'}</th>}</tr></thead>
    {release.pmiPublications?.map(member => <PmiSection tableOnly={tableOnly} key={member.id} release={member} view={view} timeDisplay={timeDisplay} showPeriod={showPeriod} />)}
  </table></div>
}
