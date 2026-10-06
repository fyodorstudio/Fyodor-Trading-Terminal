import { useMemo } from 'react'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { calendarAdmissionTime } from '../../inspector/storage/calendar-admission-time'
import { cpiSignalSettings, nfpSignalSettings, ismServicesSignalSettings, ismManufacturingSignalSettings } from '../../inspector/scoring/shared/core/signal-magnitude-settings'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { contextSeriesIds } from '../core/score-publication'
import { enabledContextFamilies } from '../core/policy'
import { buildContextTimeline } from '../core/build-context-timeline'

const scope = { currency: 'USD' as const, eventIds: contextSeriesIds }
const createWorker = () => new Worker(new URL('./context-timeline.worker.ts', import.meta.url), { type: 'module' })
export function useUsdContextTimeline(brokerId: string | null, families: readonly string[], now: number) {
  // Whole historical inventory, independent of Inspector's visible date range.
  // Day-level end bounds avoid refetching on each clock tick.
  const end = Math.floor(now / 86400000) * 86400000 + 2 * 86400000
  const range = useMemo(() => ({ from: Date.UTC(2015, 0, 1) - 2 * 86400000, to: end }), [end])
  const familyKey = families.filter(f => ['jobs', 'us-cpi', 'ism-services', 'ism-manufacturing'].includes(f)).sort().join(',')
  const selected = useMemo(() => familyKey ? familyKey.split(',') : [], [familyKey])
  const storage = useStoredCalendar(brokerId, range, enabledContextFamilies(selected).length > 0, scope)
  const cpi = cpiSignalSettings.useSettings(), nfp = nfpSignalSettings.useSettings()
  const services = ismServicesSignalSettings.useSettings(), manufacturing = ismManufacturingSignalSettings.useSettings()
  const asOf = calendarAdmissionTime(storage.events, now)
  const input = useMemo(() => brokerId && !storage.loading && selected.length ?
    { events: storage.events, families: selected, settings: { cpi, nfp, services, manufacturing }, asOf } : null,
    [brokerId, storage.events, storage.loading, selected, cpi, nfp, services, manufacturing, asOf])
  const calculation = useBackgroundCalculation(input, buildContextTimeline, createWorker)
  return { ...calculation, loading: storage.loading || calculation.loading, storage, selected }
}
