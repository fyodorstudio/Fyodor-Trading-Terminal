import { useMemo } from 'react'
import { useStoredCalendar } from '../../../../../inspector/useStoredCalendar'
import { nfpHistoryScope, nfpHistoryStart } from '../../../../../inspector/magnitude/nfp-magnitude-history'

export function useNfpScatterData(brokerId: string | null | undefined, now: number) {
  // Fetch a stable native chart-clock window; the adapter independently applies
  // the exact UTC publication cutoff. Two days cover broker date offsets.
  const end = Math.floor(now / 86400000) * 86400000 + 2 * 86400000
  const range = useMemo(() => ({ from: nfpHistoryStart, to: end }), [end])
  const storage = useStoredCalendar(brokerId, range, true, nfpHistoryScope)
  const partial = !!storage.source && (!storage.coverage.USD || storage.coverage.USD.missing.length > 0)
  const message = !brokerId ? 'Scatter Plot needs calendar storage' : storage.loading ? 'Loading history…' :
    storage.error ? 'History unavailable' : null
  return { ...storage, partial, message }
}
