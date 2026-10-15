import type { useAlarms } from './useAlarms'
import { alarmTime } from './alarm-time'

export function EventAlarmButton({ alarms, source, reference, broker, title, now, archived = false }: {
  alarms: ReturnType<typeof useAlarms>; source: 'highlight' | 'external'; reference: string; broker?: string; title: string; now: number; archived?: boolean
}) {
  const events = alarms.data?.events.filter(event => event.source === source && event.reference === reference &&
    (!broker || event.broker === broker) && event.eligible && event.at !== null && event.at > now) ?? []
  const on = !archived && events.length > 0 && events.every(event => event.armed)
  const unavailable = !alarms.data || !!alarms.error || !!alarms.data.schedule_error
  const disabled = archived || unavailable || alarms.busy || !events.length || !alarms.data?.settings.enabled
  async function toggle() {
    // A pin may contain multiple policy stages; one button applies to all its future stages.
    for (const event of events) {
      if (event.armed === !on) continue
      if (!await alarms.mutate({ action: 'toggle', key: event.key, enabled: !on })) break
    }
  }
  const reminders = events.map(event => `Preparation: ${alarmTime(event.at! - alarms.data!.settings.prepare_minutes * 60000)}\nInvoke agent: ${alarmTime(event.at! - alarms.data!.settings.release_minutes * 60000)}`).join('\n')
  return <button type="button" className="event-alarm-toggle" aria-label={`Alarm for ${title}`} aria-pressed={on} disabled={disabled}
    title={unavailable ? 'Alarm worker unavailable' : archived ? 'Archived event' : !events.length ? 'No confirmed future alarm time' :
      !alarms.data?.settings.enabled ? 'Alarms are paused' : `Alarm ${on ? 'on' : 'off'} · Jakarta\n${reminders}`} onClick={() => void toggle()}>
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path fill={on ? 'currentColor' : 'none'} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path fill="none" d="M10 21h4M12 2V1" />
    </svg>
  </button>
}
