import { useMemo } from 'react'
import type { InspectorRelease } from '../inspector-data'
import { useStoredCalendar } from '../useStoredCalendar'
import { isNfpRelease, nfpHistoryScope, nfpHistoryStart, nfpMagnitudeHistory } from './nfp-magnitude-history'

export function useNfpMagnitudeHistory(brokerId: string | null | undefined, selected: InspectorRelease | null) {
  const available = isNfpRelease(selected) && selected.releaseAt !== null && selected.chartTime !== null && !selected.timingUncertain
  const cutoff = available ? selected.chartTime! * 1000 : null
  // This range is deliberately independent of the visible chart/filter range.
  const range = useMemo(() => cutoff !== null && cutoff > nfpHistoryStart ? { from: nfpHistoryStart, to: cutoff } : null, [cutoff])
  const storage = useStoredCalendar(brokerId, range, !!range, nfpHistoryScope)
  const rows = useMemo(() => nfpMagnitudeHistory(storage.events, selected), [storage.events, selected])
  const partial = !!storage.source && (!storage.coverage.USD || storage.coverage.USD.missing.length > 0)
  const message = !brokerId ? 'History needs calendar storage' : !available ? 'History needs a verified release time' :
    storage.loading ? 'Loading history…' : storage.error ? 'History unavailable' : !range ? 'No earlier history' : null
  return { rows, partial, message, error: storage.error }
}
export type NfpMagnitudeHistory = ReturnType<typeof useNfpMagnitudeHistory>
