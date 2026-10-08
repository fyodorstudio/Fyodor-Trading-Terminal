import { Fragment } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { formatInspectorValue, hasRevisedPreviousChange, inspectorDelta, inspectorSurprise, isInspectorCommentary, type InspectorRelease } from '../inspector-data'
import { InspectorReadingTime } from '../InspectorReadingTime'
import { policyEpisodeRule } from '../episodes/policy-episodes'
import { gradePolicyRateDecision } from '../grading/policy-rate-grading'
import { gradeLabels, gradeFamilyReading, matchesReadingFamily, revisedFamilyComparison, suppliedPriorLabels } from '../grading/reading-grading'
import { magnitudeFamilies } from '../magnitude/magnitude-families'
import { FamilyMagnitudeCell } from '../magnitude/FamilyMagnitudeCell'
import { useFamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'
import type { InspectorView } from '../useInspector'

export function InspectorReadingsTable({ release, view, timeDisplay, sharedPeriod }: {
  release: InspectorRelease; view: InspectorView; timeDisplay: TimeDisplayPreference; sharedPeriod: number | null
}) {
  const policyTimes = !!policyEpisodeRule(release.familyId), showReadingTimes = policyTimes || !!release.ismPublications
  const magnitudeFamily = magnitudeFamilies.find((family) => matchesReadingFamily(release, family)) ?? null
  const hasMagnitude = !!magnitudeFamily && release.events.some((event) => Object.hasOwn(magnitudeFamily.readingRules, event.event_id))
  const showHistograms = hasMagnitude && view.preferences.showHistograms
  const extraIsmSource = release.ismPublications?.[1] ?? null
  const extraIsmHistory = useFamilyMagnitudeHistory(view.brokerId, extraIsmSource)
  const releaseTime = (item: InspectorRelease) => item.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(item.releaseAt, timeDisplay)
  return (
            <div className="inspector-table-scroll"><table className={showHistograms ? 'inspector-magnitude-table' : undefined} aria-label={`${release.label} release readings`}>
              <thead><tr><th>Series</th>{showReadingTimes && <th>Release time</th>}<th>Actual</th><th>Previous</th>
                {policyTimes && <th>Forecast</th>}<th>A−P</th>{policyTimes && <th
                  title="Actual minus this broker's supplied Forecast, in basis points. Informational only; does not affect A−P, magnitude or scoring.">A−F (Surprise)</th>}{hasMagnitude && <th
                title={showHistograms ? "Seven A−P bands: three negative, exact zero, three positive. Boundaries follow the selected series' Scatter Plot configuration. Undefined magnitude leaves this cell empty. Height counts all usable released readings since January 2015 through now; Extreme values sit beyond the configured range." :
                  "Magnitude follows this series' frozen manual boundaries in Scatter Plot. Undefined magnitude leaves this cell empty."}>
                {showHistograms ? 'A−P magnitude · History' : 'Magnitude'}</th>}</tr></thead>
              <tbody>{release.events.map((event) => {
                const delta = inspectorDelta(event)
                const commentary = isInspectorCommentary(event)
                const sourceRelease = release.ismPublications?.find((member) => member.events.some((row) => row.value_id === event.value_id)) ?? release
                const rowFamily = release.ismPublications ? magnitudeFamilies.find((family) => matchesReadingFamily(sourceRelease, family)) ?? null : magnitudeFamily
                const numericReading = !!rowFamily && Object.hasOwn(rowFamily.readingRules, event.event_id)
                const grading = numericReading ? gradeFamilyReading(event, sourceRelease.familyId, rowFamily!) : gradePolicyRateDecision(event, sourceRelease.familyId)
                const surpriseGrading = policyTimes ? gradePolicyRateDecision(event, release.familyId, 'forecast') : null
                const revisedComparison = revisedFamilyComparison(event, sourceRelease.familyId, rowFamily)
                return <Fragment key={event.value_id}>
                  {release.ismPublications && sourceRelease.events[0].value_id === event.value_id && <tr className="inspector-ism-section-heading">
                    <th scope="rowgroup" colSpan={4 + (showReadingTimes ? 1 : 0) + (policyTimes ? 2 : 0) + (hasMagnitude ? 1 : 0)}>
                      {sourceRelease.familyId === 'ism-manufacturing' ? 'Manufacturing' : 'Services'} · {releaseTime(sourceRelease)}
                    </th>
                  </tr>}
                  <tr>
                  <td><strong>{event.name}</strong>{release.ismPublications && <small>{sourceRelease.familyId === 'ism-manufacturing' ? 'Manufacturing' : 'Services'}</small>}{event.revision > 0 && <span className="inspector-revision"> · Revision {event.revision}</span>}
                    {sharedPeriod === null && release.events.some((reading) => reading.period_seconds > 0) &&
                      <small>Period: {event.period_seconds > 0 ? formatAppTimestamp(event.period_seconds * 1000,
                        { mode: 'utc', utcOffsetMinutes: 0 }, 'date') : '—'}</small>}</td>
                  {showReadingTimes && <InspectorReadingTime event={event} brokerTime={view.brokerTime} timeDisplay={timeDisplay} />}
                  <td>{formatInspectorValue(event.actual, event)}</td>
                  <td>{formatInspectorValue(event.previous, event)}{hasRevisedPreviousChange(event) &&
                    <small title={suppliedPriorLabels(event).description}>{suppliedPriorLabels(event).value}: {formatInspectorValue(event.revised_previous, event)}</small>}</td>
                  {policyTimes && <td>{formatInspectorValue(event.forecast, event)}</td>}
                  <td className={grading ? `inspector-graded-delta inspector-grade-${grading.grade}` : undefined} title={grading?.explanation}>
                    {commentary ? 'Not applicable' : formatInspectorValue(delta, event, true)}
                    {grading && numericReading && <span className="inspector-row-grade">{gradeLabels[grading.grade]}</span>}
                    {revisedComparison && <div className={`inspector-secondary-reading inspector-grade-${revisedComparison.grade}`}
                      title={revisedComparison.explanation}>{revisedComparison.label}: {formatInspectorValue(revisedComparison.delta, event, true)}
                      <span className="inspector-row-grade">{gradeLabels[revisedComparison.grade]}</span></div>}</td>
                  {policyTimes && <td className={surpriseGrading ? `inspector-graded-delta inspector-grade-${surpriseGrading.grade}` : undefined}
                    title={surpriseGrading?.explanation}>{commentary ? 'Not applicable' : formatInspectorValue(inspectorSurprise(event), event, true)}</td>}
                  {hasMagnitude && (numericReading ? <FamilyMagnitudeCell event={event} history={sourceRelease.id === extraIsmSource?.id ? extraIsmHistory : view.magnitudeHistory} grade={grading?.grade ?? 'unrated'}
                    deltaScale={rowFamily?.deltaScale} showHistogram={showHistograms} secondaryComparison={revisedComparison} /> : <td>Not applicable</td>)}
                </tr></Fragment>
              })}</tbody>
            </table></div>
  )
}
