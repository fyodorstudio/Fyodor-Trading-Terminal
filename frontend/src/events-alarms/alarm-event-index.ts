import type { AlarmEvent } from './useAlarms'
import type { AlertDayGroup } from '../alert/model/alert-day-model'

export function indexAlarmEvents(events: readonly AlarmEvent[]) {
  const calendar = new Map<string, AlarmEvent[]>()
  for (const event of events) {
    if (!event.eligible) continue
    const entries = event.source === 'calendar' ? (event.value_ids ?? []).map(id => `${event.broker}:${id}`) : []
    const index = calendar
    for (const key of entries) {
      const matches = index.get(key)
      if (matches) matches.push(event)
      else index.set(key, [event])
    }
  }
  return { calendar }
}
export function groupAlarmEvents(index: ReturnType<typeof indexAlarmEvents>, group: AlertDayGroup, sourceId: string) {
  const calendar = [...new Set(group.valueIds.flatMap(id => index.calendar.get(`${sourceId}:${id}`) ?? []))].filter(event => event.at === group.at)
  return calendar
}
