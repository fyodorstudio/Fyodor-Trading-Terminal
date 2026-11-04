import { memo, useMemo } from 'react'
import type { AlertDayGroup } from '../alert/model/alert-day-model'
import type { useAlarms } from './useAlarms'
import { alarmTime } from './alarm-time'
import { groupAlarmEvents, type indexAlarmEvents } from './alarm-event-index'

export const EventAlarmButton = memo(function EventAlarmButton({ alarms, group, sourceId, now, alarmIndex }: {
  alarms: ReturnType<typeof useAlarms>; group: AlertDayGroup; sourceId: string; now: number; alarmIndex: ReturnType<typeof indexAlarmEvents>
}) {
  const events = useMemo(() => {
    return groupAlarmEvents(alarmIndex, group, sourceId)
  }, [alarmIndex, group, sourceId])
  const covered = new Set(events.flatMap(event => event.value_ids ?? []))
  const missing = group.valueIds.filter(id => !covered.has(id))
  const selected = events.filter(event => event.selected ?? event.armed)
  const on = events.length > 0 && selected.length === events.length && missing.length === 0
  const partial = selected.length > 0 && !on
  const unavailable = !alarms.data || !!alarms.error || !!alarms.data.schedule_error || alarms.data.schedule_schema !== 2
  const future = group.at !== null && group.at > now
  const disabled = unavailable || alarms.busy || !future || !group.valueIds.length && !events.some(event => event.eligible)
  async function toggle() {
    if (events.length && !await alarms.mutate({ action: 'toggle-many', keys: events.map(event => event.key), enabled: !on })) return
    if (!on && missing.length) await alarms.mutate({ action: 'subscribe', broker: sourceId, value_ids: missing, title: group.title, enabled: true })
  }
  const title = unavailable ? 'Alarm worker needs the updated date-calendar schedule' : !future ? 'No confirmed future alarm time' :
    `${partial ? 'Some package alarms selected' : on ? 'Alarm selected' : 'No alarm selected'} · ${alarmTime(group.at! - (alarms.data?.settings.release_minutes ?? 2) * 60000)} Jakarta${alarms.data?.settings.enabled ? '' : ' · Global alarms paused; your selection is saved'}`
  return <button type="button" className="event-alarm-toggle" aria-label={`Alarm for ${group.title}`} aria-pressed={partial ? 'mixed' : on} disabled={disabled} title={title} onClick={() => void toggle()}>
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path fill={on ? 'currentColor' : 'none'} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path fill="none" d="M10 21h4M12 2V1" />
    </svg>
  </button>
})
