import { useMemo } from 'react'
import type { InspectorRelease } from '../inspector-data'
import { matchesReadingFamily } from '../grading/reading-grading'
import { useStoredCalendar } from '../useStoredCalendar'
import { familyMagnitudeHistory } from './family-magnitude-history'
import { magnitudeFamilies, type MagnitudeFamily } from './magnitude-families'
import { magnitudeConfiguration, useMagnitudeSettings } from './settings/magnitude-settings-store'
import { useCalendarNow } from '../useCalendarNow'

export function useFamilyMagnitudeHistory(brokerId: string | null | undefined, selected: InspectorRelease | null,
  requestedFamily?: MagnitudeFamily, clockOffsetMs = 0) {
  const now = useCalendarNow(clockOffsetMs)
  const family = requestedFamily ?? magnitudeFamilies.find((candidate) => matchesReadingFamily(selected, candidate)) ?? null
  const settings = useMagnitudeSettings(family?.settings ?? null)
  const available = !!family && matchesReadingFamily(selected, family) && selected.releaseAt !== null &&
    selected.chartTime !== null && !selected.timingUncertain
  const end = Math.floor(now / 86400000) * 86400000 + 2 * 86400000
  const configured = !!selected && selected.events.some((event) => magnitudeConfiguration(settings, event.event_id).mode !== 'undefined')
  // Stable across release selection: fetch once through today, with the same
  // chart-clock margin as Scatter. The model independently excludes future rows.
  const range = useMemo(() => configured && available && family ?
    { from: family.historyStart, to: end } : null, [configured, available, end, family])
  const storage = useStoredCalendar(brokerId, range, !!range, family?.historyScope)
  const rows = useMemo(() => family ? familyMagnitudeHistory(storage.events, selected, family, settings, now) : {},
    [storage.events, selected, family, settings, now])
  const coverage = family ? storage.coverage[family.currency] : null
  const partial = !!storage.source && (!coverage || coverage.missing.length > 0)
  const message = !brokerId ? 'History needs calendar storage' : !available ? 'History needs a verified release time' :
    storage.loading ? 'Loading history…' : storage.error ? 'History unavailable' : null
  return { rows, partial, message, error: storage.error }
}
export type FamilyMagnitudeHistory = ReturnType<typeof useFamilyMagnitudeHistory>
