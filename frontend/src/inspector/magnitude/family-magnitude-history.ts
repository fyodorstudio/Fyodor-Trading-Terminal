import type { EconomicCalendarEvent } from '../calendar-event'
import { groupInspectorReleases, inspectorDelta, type InspectorRelease } from '../inspector-data'
import { matchesReadingFamily } from '../grading/reading-grading'
import type { StoredCalendarEvent } from '../useStoredCalendar'
import type { MagnitudeFamily } from './magnitude-families'
import { magnitudeDistribution } from './magnitude-distribution'
import { magnitudeConfiguration, type MagnitudeSettings } from './settings/magnitude-settings-store'

export function familyHistoryReleases(events: StoredCalendarEvent[], before: number, family: MagnitudeFamily) {
  return groupInspectorReleases(events.filter((event) => event.availability === 'observed' &&
    event.time_mode === 0 && event.release_at !== null && event.release_at >= family.historyStart && event.release_at < before))
    .filter((release) => matchesReadingFamily(release, family))
}
export function scaledMagnitudeDelta(event: EconomicCalendarEvent, scale = 1) {
  const delta = inspectorDelta(event)
  return delta === null ? null : delta * scale
}
export function familyMagnitudeSamples(releases: readonly InspectorRelease[], current: EconomicCalendarEvent, scale = 1) {
  const samples: { delta: number; at: number; releaseId: string; event: EconomicCalendarEvent }[] = []
  let excluded = 0
  for (const release of releases) {
    const rows = release.events.filter((event) => event.event_id === current.event_id)
    if (rows.length !== 1) { if (rows.length) excluded++; continue }
    const row = rows[0], delta = scaledMagnitudeDelta(row, scale)
    if (delta === null || row.unit !== current.unit || row.multiplier !== current.multiplier) { excluded++; continue }
    samples.push({ delta, at: release.releaseAt!, releaseId: release.id, event: row })
  }
  return { samples, excluded }
}
export function familyMagnitudeHistory(events: StoredCalendarEvent[], selected: InspectorRelease | null,
  family: MagnitudeFamily, settings: MagnitudeSettings = {}, now = Date.now()) {
  if (!matchesReadingFamily(selected, family) || selected.releaseAt === null) return {}
  const releases = familyHistoryReleases(events, now + 1, family)
  return Object.fromEntries(selected.events.map((current) => {
    const { samples, excluded } = familyMagnitudeSamples(releases, current, family.deltaScale)
    const config = magnitudeConfiguration(settings, current.event_id)
    return [current.value_id, { mode: config.mode, count: samples.length,
      earlierCount: samples.filter((sample) => sample.at < selected.releaseAt!).length,
      distribution: config.mode === 'undefined' ? null : magnitudeDistribution(samples.map((sample) => sample.delta), scaledMagnitudeDelta(current, family.deltaScale), config.limits),
      excluded, first: samples.length ? Math.min(...samples.map((sample) => sample.at)) : null,
      last: samples.length ? Math.max(...samples.map((sample) => sample.at)) : null }]
  }))
}
