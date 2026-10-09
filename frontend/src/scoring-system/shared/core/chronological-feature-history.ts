import type { EconomicCalendarEvent } from '../../../inspector/calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../inspector/inspector-data'
import { earlierSignalReadings, observedReading, type TimedReading } from './historical-release-signals'

// Feature extractors must bound every reference lookup by the feature's own
// publication time. This lets one immutable inventory share its reference index
// and extracted past features, without admitting a later release to calibration.
export function chronologicalFeatureHistory<Features>(ids: readonly string[], supports: (r: InspectorRelease) => boolean,
  extract: (r: InspectorRelease, history: readonly TimedReading[]) => Features) {
  const cache = new WeakMap<readonly EconomicCalendarEvent[], { history: TimedReading[]; past: { at: number; features: Features }[] } | null>()
  return (release: InspectorRelease, events: readonly EconomicCalendarEvent[]) => {
    let prepared = cache.get(events)
    if (prepared === undefined) {
      const history = events.filter(e => observedReading(e) && ids.includes(e.event_id)) as TimedReading[]
      // A repeated value identity with different publication metadata can make
      // first-occurrence deduplication cutoff-dependent. Preserve the old path.
      const unique = new Set(history.map(e => e.value_id))
      prepared = unique.size !== history.length ? null : { history,
        past: groupInspectorReleases(history).filter(supports).map(r => ({ at: r.releaseAt!, features: extract(r, history) })) }
      cache.set(events, prepared)
    }
    if (!prepared) {
      const history = earlierSignalReadings(release, events, ids)
      return { history, past: groupInspectorReleases(history).filter(supports).map(r => extract(r, history)) }
    }
    return { history: prepared.history, past: prepared.past.filter(p => p.at < release.releaseAt!).map(p => p.features) }
  }
}
