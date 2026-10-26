import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'

export type AlertDaySnapshot = { source_id: string; date: string; revision: string; events: StoredCalendarEvent[];
  source: { publisher_status: string } | null; coverage: Record<string, { missing: number[][] }> }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const nullableNumber = (value: unknown) => value === null || typeof value === 'number' && Number.isFinite(value)
function validEvent(value: unknown): value is StoredCalendarEvent {
  if (!record(value)) return false
  return ['value_id', 'event_id', 'name', 'currency', 'country_code', 'country_name', 'event_code'].every(key => typeof value[key] === 'string')
    && ['server_time_seconds', 'period_seconds', 'revision', 'unit', 'multiplier', 'digits', 'time_mode'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
    && ['actual', 'forecast', 'previous', 'revised_previous', 'release_at', 'chart_time_seconds'].every(key => nullableNumber(value[key]))
    && ['observed', 'not-returned-by-latest-query'].includes(value.availability as string)
}

export function validAlertDayResponse(value: unknown, sourceId: string, date: string, revision: string): value is
  AlertDaySnapshot | { source_id: string; date: string; revision: string; unchanged: true } {
  if (!record(value) || value.source_id !== sourceId || value.date !== date || typeof value.revision !== 'string' || !value.revision
    || value.unchanged !== undefined && typeof value.unchanged !== 'boolean') return false
  // An unchanged reply is meaningful only after this request scope loaded a snapshot.
  if (value.unchanged === true) return !!revision && value.revision === revision
  return (value.source === null || record(value.source) && typeof value.source.publisher_status === 'string')
    && Array.isArray(value.events) && value.events.every(validEvent)
    && record(value.coverage) && Object.values(value.coverage).every(entry => record(entry) && Array.isArray(entry.missing)
      && entry.missing.every(range => Array.isArray(range) && range.length === 2
        && range.every(at => typeof at === 'number' && Number.isFinite(at)) && range[0] <= range[1]))
}
