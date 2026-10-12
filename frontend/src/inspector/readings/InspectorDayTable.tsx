import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorDaySection, InspectorRelease } from '../../economic-calendar/releases/release'
import { formatInspectorValue, hasRevisedPreviousChange, inspectorDelta } from './reading-values'
import { suppliedPriorLabels } from './reading-values'

function sectionRows(section: InspectorDaySection, display: TimeDisplayPreference) {
  const rows = section.publications.flatMap(publication => publication.events.map(event => ({ event, publication })))
  const timeLabel = (publication: InspectorRelease) => publication.timingUncertain ? 'Date only' : publication.releaseAt === null ?
    'Time unavailable' : formatAppTimestamp(publication.releaseAt, display, publication.releaseAt % 60000 === 0 ? 'time-short' : 'time')
  return { rows, timeLabel }
}

export function InspectorDayTable({ release, timeDisplay }: {
  release: InspectorRelease; timeDisplay: TimeDisplayPreference
}) {
  const sections = release.daily?.sections ?? []
  const prepared = sections.map(section => ({ section, ...sectionRows(section, timeDisplay) }))
  const showCountry = release.currency === 'EUR'
  const showForecast = release.events.some(event => event.forecast !== null), columns = 5 + Number(showForecast) + Number(showCountry)
  const periodLabel = (period: number) => formatAppTimestamp(period * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')
  return <div className="inspector-table-scroll"><table className="inspector-day-table" aria-label={`${release.currency} ${release.daily?.date} series`}>
    <thead><tr><th scope="col">Series</th>{showCountry && <th scope="col">Country</th>}<th scope="col">Time</th><th scope="col">Actual</th><th scope="col">Previous</th>
      {showForecast && <th scope="col">Forecast</th>}<th scope="col">A−P</th></tr></thead>
    {prepared.map(({ section, rows, timeLabel }) => {
      const first = rows[0], period = first.event.period_seconds
      const sharedPeriod = period > 0 && rows.every(row => row.event.period_seconds === period)
      return <tbody key={section.id} data-category-section={section.id}>
        <tr className="inspector-day-section"><th scope="rowgroup" colSpan={columns}>
          <div><strong>{section.label}</strong>
            <span>{rows.length} series{section.releaseCount > 1 && ` · ${section.releaseCount} releases`}</span>
            {sharedPeriod && <span>Period: {periodLabel(period)}</span>}</div>
        </th></tr>
        {rows.map(({ event, publication }) => {
          const delta = inspectorDelta(event)
          return <tr key={event.value_id} data-series-id={event.event_id}>
            <th scope="row"><strong>{event.name || `MT5 event ${event.event_id}`}</strong>
              {event.revision > 0 && <span className="inspector-revision"> · Revision {event.revision}</span>}
              {!sharedPeriod && event.period_seconds > 0 && <small>Period: {periodLabel(event.period_seconds)}</small>}</th>
            {showCountry && <td title={event.country_name}>{event.country_code}</td>}
            <td className="inspector-day-time">{timeLabel(publication)}</td>
            <td>{formatInspectorValue(event.actual, event)}</td>
            <td>{formatInspectorValue(event.previous, event)}{hasRevisedPreviousChange(event) &&
              <small title={suppliedPriorLabels(event).description}>{suppliedPriorLabels(event).value}: {formatInspectorValue(event.revised_previous, event)}</small>}</td>
            {showForecast && <td>{formatInspectorValue(event.forecast, event)}</td>}
            <td className={delta === null ? undefined : `inspector-grade-${delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'unchanged'}`}>
              {formatInspectorValue(delta, event, true)}</td>
          </tr>
        })}
      </tbody>
    })}
  </table></div>
}
