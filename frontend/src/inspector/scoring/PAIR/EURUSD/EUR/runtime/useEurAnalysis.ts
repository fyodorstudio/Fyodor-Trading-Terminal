import type { EconomicCalendarEvent } from '../../../../../calendar-event'
import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../useStoredCalendar'
import { useBackgroundCalculation } from '../../../../shared/runtime/useBackgroundCalculation'
import { eurMagnitudeStores } from '../policy/eur-magnitude-settings'
import { eurPolicy } from '../policy/eur-policies'
import { calculateEurAnalysis } from './eur-analysis'
const worker = () => new Worker(new URL('./eur-analysis.worker.ts', import.meta.url), { type: 'module' })
const empty: EconomicCalendarEvent[] = []
export function useEurAnalysis({ release, brokerId, events = empty, now = Infinity }: InspectorScoringProps) {
  const policy = release && eurPolicy(release.familyId)
  const store = policy ? eurMagnitudeStores[policy.family] : eurMagnitudeStores['euro-inflation']
  const settings = store.useSettings()
  const releaseAt = release?.releaseAt
  const range = useMemo(() => releaseAt == null ? null : ({ from: Date.UTC(2015,0,1) - 2 * 86400000, to: releaseAt + 2 * 86400000 }), [releaseAt])
  const scope = useMemo(() => ({ currency: 'EUR' as const, eventIds: policy?.signals.map(s => s.seriesId) ?? [] }), [policy])
  const storage = useStoredCalendar(brokerId, range, !!policy && !!range, scope)
  const inventory = brokerId ? storage.events : events
  const input = useMemo(() => release && policy && release.releaseAt !== null && release.releaseAt <= now && !storage.loading ? { release, events: inventory, settings } : null, [release, policy, inventory, settings, storage.loading, now])
  const calculation = useBackgroundCalculation(input, calculateEurAnalysis, worker)
  return { ...calculation, loading: storage.loading || calculation.loading, storage }
}
