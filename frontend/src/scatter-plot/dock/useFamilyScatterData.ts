import { useMemo } from 'react'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import type { MagnitudeFamily } from '../../inspector/magnitude/magnitude-families'

export function useFamilyScatterData(brokerId: string | null | undefined, now: number, family: MagnitudeFamily, r1History=false) {
  const end = Math.floor(now / 86400000) * 86400000 + 2 * 86400000
  const range = useMemo(() => ({ from: family.historyStart, to: end }), [end, family])
  const scope=useMemo(()=>r1History?{...family.historyScope,r1History:true}:family.historyScope,[family,r1History])
  const storage = useStoredCalendar(brokerId, range, true, scope)
  const partial = !!storage.source && (!storage.coverage[family.currency] || storage.coverage[family.currency].missing.length > 0)
  const message = !brokerId ? 'Scatter Plot needs calendar storage' : storage.loading ? 'Loading history…' :
    storage.error ? 'History unavailable' : null
  return { ...storage, partial, message }
}
