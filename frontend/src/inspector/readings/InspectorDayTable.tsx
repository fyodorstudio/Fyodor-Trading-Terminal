import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { symbolGlyph } from '../../economic-calendar/presentation/event-symbols'
import { formatInspectorValue, hasRevisedPreviousChange, inspectorDelta } from './reading-values'
import { suppliedPriorLabels } from '../grading/reading-grading'
import type { InspectorPreferences } from '../preferences/inspector-preferences'

export function InspectorDayTable({ release, symbols, timeDisplay }: {
  release: InspectorRelease; symbols: InspectorPreferences['symbols']; timeDisplay: TimeDisplayPreference
}) {
  const showForecast = release.events.some(event => event.forecast !== null), columns = showForecast ? 5 : 4
  const periodLabel = (period: number) => formatAppTimestamp(period * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')
  return <div className="inspector-table-scroll"><table className="inspector-day-table" aria-label={`${release.currency} ${release.daily?.date} series`}>
    <thead><tr><th scope="col">Series</th><th scope="col">Actual</th><th scope="col">Previous</th>
      {showForecast && <th scope="col">Forecast</th>}<th scope="col">A−P</th></tr></thead>
    {release.daily?.publications.map(publication => {
      const sharedPeriod = publication.events[0]?.period_seconds > 0 && publication.events.every(event => event.period_seconds === publication.events[0].period_seconds)
      const time = publication.timingUncertain ? 'Date only' : publication.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(publication.releaseAt, timeDisplay, 'time-short')
      return <tbody key={publication.id}>
        <tr className="inspector-day-section"><th scope="rowgroup" colSpan={columns}>
          <div><time>{time}</time><strong>{symbolGlyph(symbols[publication.familyId] ?? 'star')} {publication.label}</strong>
            <span>{publication.events.length} series</span>{sharedPeriod && <span>Period: {periodLabel(publication.events[0].period_seconds)}</span>}</div>
        </th></tr>
        {publication.events.map(event => {
          const delta = inspectorDelta(event)
          return <tr key={event.value_id} data-series-id={event.event_id}>
            <th scope="row"><strong>{event.name || `MT5 event ${event.event_id}`}</strong>
              {event.revision > 0 && <span className="inspector-revision"> · Revision {event.revision}</span>}
              {!sharedPeriod && event.period_seconds > 0 && <small>Period: {periodLabel(event.period_seconds)}</small>}</th>
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
