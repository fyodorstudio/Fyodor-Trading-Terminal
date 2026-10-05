import { useMemo } from 'react'
import type { InspectorRelease } from '../inspector-data'
import { matchesReadingFamily } from '../grading/reading-grading'
import { useStoredCalendar } from '../useStoredCalendar'
import { familyMagnitudeHistory } from './family-magnitude-history'
import { magnitudeFamilies, type MagnitudeFamily } from './magnitude-families'
import { magnitudeConfiguration, useMagnitudeSettings } from './settings/magnitude-settings-store'

export function useFamilyMagnitudeHistory(brokerId: string | null | undefined, selected: InspectorRelease | null,
  requestedFamily?: MagnitudeFamily) {
  const family = requestedFamily ?? magnitudeFamilies.find((candidate) => matchesReadingFamily(selected, candidate)) ?? null
  const settings = useMagnitudeSettings(family?.settings ?? null)
  const available = !!family && matchesReadingFamily(selected, family) && selected.releaseAt !== null &&
    selected.chartTime !== null && !selected.timingUncertain
  const cutoff = available ? selected!.chartTime! * 1000 : null
  const configured = !!selected && selected.events.some((event) => magnitudeConfiguration(settings, event.event_id).mode !== 'undefined')
  const range = useMemo(() => configured && cutoff !== null && family && cutoff > family.historyStart ?
    { from: family.historyStart, to: cutoff } : null, [configured, cutoff, family])
  const storage = useStoredCalendar(brokerId, range, !!range, family?.historyScope)
  const rows = useMemo(() => family ? familyMagnitudeHistory(storage.events, selected, family, settings) : {},
    [storage.events, selected, family, settings])
  const coverage = family ? storage.coverage[family.currency] : null
  const partial = !!storage.source && (!coverage || coverage.missing.length > 0)
  const message = !brokerId ? 'History needs calendar storage' : !available ? 'History needs a verified release time' :
    storage.loading ? 'Loading history…' : storage.error ? 'History unavailable' : null
  return { rows, partial, message, error: storage.error }
}
export type FamilyMagnitudeHistory = ReturnType<typeof useFamilyMagnitudeHistory>
