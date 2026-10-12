import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { formatInspectorValue, hasRevisedPreviousChange, inspectorDelta, inspectorRevisedDelta, inspectorSurprise, suppliedPriorLabels } from './reading-values'
import { isInspectorCommentary } from '../releases/group-releases'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { InspectorReadingTime } from '../InspectorReadingTime'
import { policyEpisodeRule } from '../episodes/policy-episodes'
import { episodePublications } from '../episodes/display-episodes'
import { pmiSectionLabel } from '../episodes/pmi-episodes'
import type { InspectorView } from '../useInspector'

const direction = (delta: number) => delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'unchanged'
const directionLabel = (delta: number) => delta > 0 ? 'Higher' : delta < 0 ? 'Lower' : 'Unchanged'
export function InspectorReadingsTable({ release, view, timeDisplay, sharedPeriod }: {
  release: InspectorRelease; view: InspectorView; timeDisplay: TimeDisplayPreference; sharedPeriod: number | null
}) {
  const publications = episodePublications(release)
  const policyTimes = !!policyEpisodeRule(release.familyId), showTimes = policyTimes || !!publications
  const showCountry = release.currency === 'EUR', showForecast = policyTimes || release.events.some(event => event.forecast !== null)
  const columns = 4 + Number(showTimes) + Number(showCountry) + Number(showForecast) + Number(policyTimes)
  return <div className="inspector-table-scroll"><table aria-label={`${release.label} release readings`}>
    <thead><tr><th scope="col">Series</th>{showCountry && <th scope="col">Country</th>}{showTimes && <th scope="col">Release time</th>}
      <th scope="col">Actual</th><th scope="col">Previous</th>{showForecast && <th scope="col">Forecast</th>}<th scope="col">A−P</th>
      {policyTimes && <th scope="col" title="Actual minus the supplied Forecast, in basis points.">A−F (Surprise)</th>}</tr></thead>
    {(publications ?? [release]).map(publication => <tbody key={publication.id}>
      {publications && <tr className="inspector-ism-section-heading"><th scope="rowgroup" colSpan={columns}>
        {release.pmiPublications ? pmiSectionLabel(publication) : publication.familyId === 'ism-manufacturing' ? 'Manufacturing' : 'Services'} · {
          publication.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(publication.releaseAt, timeDisplay)}
      </th></tr>}
      {publication.events.map(event => {
        const delta = inspectorDelta(event), revised = hasRevisedPreviousChange(event), revisedDelta = inspectorRevisedDelta(event)
        const commentary = isInspectorCommentary(event), prior = suppliedPriorLabels(event)
        return <tr key={event.value_id} data-series-id={event.event_id}>
          <th scope="row"><strong>{event.name || `MT5 event ${event.event_id}`}</strong>
            {event.revision > 0 && <span className="inspector-revision"> · Revision {event.revision}</span>}
            {sharedPeriod === null && event.period_seconds > 0 && <small>Period: {
              formatAppTimestamp(event.period_seconds * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}</small>}</th>
          {showCountry && <td title={event.country_name}>{event.country_code}</td>}
          {showTimes && <InspectorReadingTime event={event} brokerTime={view.brokerTime} timeDisplay={timeDisplay} />}
          <td>{formatInspectorValue(event.actual, event)}</td>
          <td>{formatInspectorValue(event.previous, event)}{revised && <small title={prior.description}>
            {prior.value}: {formatInspectorValue(event.revised_previous, event)}</small>}</td>
          {showForecast && <td>{formatInspectorValue(event.forecast, event)}</td>}
          <td className={delta === null ? undefined : `inspector-graded-delta inspector-grade-${direction(delta)}`}>
            {commentary ? 'Not applicable' : formatInspectorValue(delta, event, true)}
            {delta !== null && <span className="inspector-row-grade">{directionLabel(delta)}</span>}
            {revised && revisedDelta !== null && <div className={`inspector-secondary-reading inspector-grade-${direction(revisedDelta)}`} title={prior.description}>
              {prior.delta}: {formatInspectorValue(revisedDelta, event, true)}<span className="inspector-row-grade">{directionLabel(revisedDelta)}</span>
            </div>}</td>
          {policyTimes && <td>{commentary ? 'Not applicable' : formatInspectorValue(inspectorSurprise(event), event, true)}</td>}
        </tr>
      })}
    </tbody>)}
  </table></div>
}
