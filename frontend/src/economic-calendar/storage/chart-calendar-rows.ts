import type { StoredCalendarEvent } from './useStoredCalendar'

const compareValueId = new Intl.Collator('en', { numeric: true }).compare

export function hasChartActual(event: StoredCalendarEvent) {
  return event.actual !== null && Number.isFinite(event.actual)
    && (event.availability === 'observed' || !!event.actual_override_source)
}

/** Display stored schedules separately from the broker's actual history. */
export function chartCalendarRows(events: StoredCalendarEvent[], now: number) {
  const series = (event: StoredCalendarEvent) => JSON.stringify([event.event_id, event.country_code, event.currency, event.unit, event.multiplier])
  const occurrence = (event: StoredCalendarEvent) => JSON.stringify([series(event), event.period_seconds,
    event.release_at ?? (event.chart_time_seconds ?? event.server_time_seconds) * 1000, event.time_mode])
  const numericSeries = new Set(events.filter(event => event.actual != null || event.forecast != null || event.previous != null).map(series))
  const actuals = new Set(events.filter(hasChartActual).map(occurrence))
  const brokerActuals = new Set(events.filter(event => event.availability === 'observed' && hasChartActual(event)).map(occurrence))
  const schedules = new Map<string, StoredCalendarEvent>(), result: StoredCalendarEvent[] = []
  for (const event of events) {
    if (hasChartActual(event)) {
      if (event.availability === 'observed' || !brokerActuals.has(occurrence(event))) result.push(event)
      continue
    }
    const observed = event.availability === 'observed'
    if (event.period_seconds <= 0 && !numericSeries.has(series(event))) {
      if (observed) result.push(event)
      continue
    }
    if (!observed && (event.actual !== null || event.server_time_seconds <= 0
      || (event.release_at ?? event.server_time_seconds * 1000) >= now)) continue
    const key = occurrence(event)
    if (actuals.has(key)) continue
    const previous = schedules.get(key)
    if (!previous || (observed && previous.availability !== 'observed')
      || (event.availability === previous.availability && (event.revision > previous.revision
        || (event.revision === previous.revision && compareValueId(event.value_id, previous.value_id) > 0)))) {
      schedules.set(key, event)
    }
  }
  return [...result, ...schedules.values()]
}
