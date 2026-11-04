import type { AlarmEvent } from './useAlarms'
import type { AlertDayGroup } from '../alert/model/alert-day-model'

export function indexAlarmEvents(events: readonly AlarmEvent[]) {
  const calendar = new Map<string, AlarmEvent[]>(), external = new Map<string, AlarmEvent[]>()
  for (const event of events) {
    if (!event.eligible) continue
    const entries = event.source === 'calendar' ? (event.value_ids ?? []).map(id => `${event.broker}:${id}`)
      : event.source === 'external' ? [event.reference] : []
    const index = event.source === 'calendar' ? calendar : external
    for (const key of entries) {
      const matches = index.get(key)
      if (matches) matches.push(event)
      else index.set(key, [event])
    }
  }
  return { calendar, external }
}
export function groupAlarmEvents(index: ReturnType<typeof indexAlarmEvents>, group: AlertDayGroup, sourceId: string) {
  const calendar = [...new Set(group.valueIds.flatMap(id => index.calendar.get(`${sourceId}:${id}`) ?? []))].filter(event => event.at === group.at)
  return calendar.length ? calendar : [...new Set(group.external.flatMap(item => index.external.get(item.key) ?? []))].filter(event => event.at === group.at)
}
