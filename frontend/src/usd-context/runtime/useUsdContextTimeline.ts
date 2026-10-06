import { useMemo } from 'react'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { calendarAdmissionTime } from '../../inspector/storage/calendar-admission-time'
import { cpiSignalSettings, nfpSignalSettings, ismServicesSignalSettings, ismManufacturingSignalSettings, retailSignalSettings, claimsSignalSettings } from '../../inspector/scoring/shared/core/signal-magnitude-settings'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { contextSeriesIds } from '../core/score-publication'
import { enabledContextFamilies } from '../core/policy'
import { buildContextTimeline } from '../core/build-context-timeline'
import type { InspectorEvent } from '../../inspector/inspector-data'

const scope = { currency: 'USD' as const, eventIds: contextSeriesIds }
const createWorker = () => new Worker(new URL('./context-timeline.worker.ts', import.meta.url), { type: 'module' })
const emptyEvents: readonly InspectorEvent[] = []
export function useUsdContextTimeline(brokerId: string | null, families: readonly string[], now: number, events: readonly InspectorEvent[] = emptyEvents, loadHistory = false) {
  // Whole historical inventory, independent of Inspector's visible date range.
  // Day-level end bounds avoid refetching on each clock tick.
  const end = Math.floor(now / 86400000) * 86400000 + 2 * 86400000
  const range = useMemo(() => ({ from: Date.UTC(2015, 0, 1) - 2 * 86400000, to: end }), [end])
  const familyKey = families.filter(f => ['jobs', 'us-cpi', 'ism-services', 'ism-manufacturing', 'retail', 'claims'].includes(f)).sort().join(',')
  const selected = useMemo(() => familyKey ? familyKey.split(',') : [], [familyKey])
  const storage = useStoredCalendar(brokerId, range, loadHistory || enabledContextFamilies(selected).length > 0, scope)
  const cpi = cpiSignalSettings.useSettings(), nfp = nfpSignalSettings.useSettings()
  const services = ismServicesSignalSettings.useSettings(), manufacturing = ismManufacturingSignalSettings.useSettings()
  const retail = retailSignalSettings.useSettings()
  const claims = claimsSignalSettings.useSettings()
  const inventory = brokerId ? storage.events : events
  const asOf = calendarAdmissionTime(inventory, now)
  const input = useMemo(() => !storage.loading && selected.length && (brokerId || inventory.length) ?
    { events: inventory, families: selected, settings: { cpi, nfp, services, manufacturing, retail, claims }, asOf } : null,
    [brokerId, inventory, storage.loading, selected, cpi, nfp, services, manufacturing, retail, claims, asOf])
  const calculation = useBackgroundCalculation(input, buildContextTimeline, createWorker)
  return { ...calculation, loading: storage.loading || calculation.loading, storage, selected, inventory }
}
