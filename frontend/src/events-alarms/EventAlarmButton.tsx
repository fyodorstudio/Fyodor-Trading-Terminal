import { memo, useMemo } from 'react'
import type { AlertDayGroup } from '../alert/model/alert-day-model'
import type { useAlarms } from './useAlarms'
import { alarmTime } from './alarm-time'

export const EventAlarmButton = memo(function EventAlarmButton({ alarms, group, sourceId, now }: {
  alarms: ReturnType<typeof useAlarms>; group: AlertDayGroup; sourceId: string; now: number
}) {
  const events = useMemo(() => alarms.data?.events.filter(event => event.eligible && event.at === group.at && (
    event.source === 'calendar' && event.broker === sourceId && event.value_ids?.some(id => group.valueIds.includes(id))
    || event.source === 'external' && group.external.some(item => item.key === event.reference))) ?? [], [alarms.data, group, sourceId])
  const on = events.length > 0 && events.every(event => event.selected ?? event.armed)
  const unavailable = !alarms.data || !!alarms.error || !!alarms.data.schedule_error || alarms.data.schedule_schema !== 2
  const future = group.at !== null && group.at > now
  const disabled = unavailable || alarms.busy || !future || !group.valueIds.length && !events.some(event => event.eligible)
  async function toggle() {
    if (events.length) await alarms.mutate({ action: 'toggle-many', keys: events.filter(event => event.eligible).map(event => event.key), enabled: !on })
    else if (group.valueIds.length) await alarms.mutate({ action: 'subscribe', broker: sourceId, value_ids: group.valueIds, title: group.title, enabled: true })
  }
  const title = unavailable ? 'Alarm worker needs the updated date-calendar schedule' : !future ? 'No confirmed future alarm time' :
    `${on ? 'Alarm selected' : 'No alarm selected'} · ${alarmTime(group.at! - (alarms.data?.settings.release_minutes ?? 2) * 60000)} Jakarta${alarms.data?.settings.enabled ? '' : ' · Global alarms paused; your selection is saved'}`
  return <button type="button" className="event-alarm-toggle" aria-label={`Alarm for ${group.title}`} aria-pressed={on} disabled={disabled} title={title} onClick={() => void toggle()}>
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path fill={on ? 'currentColor' : 'none'} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path fill="none" d="M10 21h4M12 2V1" />
    </svg>
  </button>
})
