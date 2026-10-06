import { useMemo } from 'react'
import { useStoredCalendar } from '../../inspector/useStoredCalendar'
import { calendarAdmissionTime } from '../../inspector/storage/calendar-admission-time'
import { cpiSignalSettings, nfpSignalSettings, ismServicesSignalSettings, ismManufacturingSignalSettings, retailSignalSettings, claimsSignalSettings, pceSignalSettings, ppiSignalSettings, gdpSignalSettings } from '../../inspector/scoring/shared/core/signal-magnitude-settings'
import { useSharedContextCalculation } from './useSharedContextCalculation'
import { contextSeriesIds } from '../core/score-publication'
import { enabledContextFamilies } from '../core/policy'
import type { InspectorEvent } from '../../inspector/inspector-data'

const scope = { currency: 'USD' as const, eventIds: contextSeriesIds }
const emptyEvents: readonly InspectorEvent[] = []
export function useUsdContextTimeline(brokerId: string | null, families: readonly string[], now: number, events: readonly InspectorEvent[] = emptyEvents, loadHistory = false) {
  // Whole historical inventory, independent of Inspector's visible date range.
  // Day-level end bounds avoid refetching on each clock tick.
  const end = Math.floor(now / 86400000) * 86400000 + 2 * 86400000
  const range = useMemo(() => ({ from: Date.UTC(2015, 0, 1) - 2 * 86400000, to: end }), [end])
  const familyKey = families.filter(f => ['jobs', 'us-cpi', 'ism-services', 'ism-manufacturing', 'retail', 'claims', 'pce', 'ppi', 'gdp'].includes(f)).sort().join(',')
  const selected = useMemo(() => familyKey ? familyKey.split(',') : [], [familyKey])
  const storage = useStoredCalendar(brokerId, range, loadHistory || enabledContextFamilies(selected).length > 0, scope)
  const cpi = cpiSignalSettings.useSettings(), nfp = nfpSignalSettings.useSettings()
  const services = ismServicesSignalSettings.useSettings(), manufacturing = ismManufacturingSignalSettings.useSettings()
  const retail = retailSignalSettings.useSettings()
  const claims = claimsSignalSettings.useSettings()
  const pce = pceSignalSettings.useSettings(), ppi = ppiSignalSettings.useSettings(), gdp = gdpSignalSettings.useSettings()
  const inventory = brokerId ? storage.events : events
  const asOf = calendarAdmissionTime(inventory, now)
  const input = useMemo(() => !storage.loading && selected.length && (brokerId || inventory.length) ?
    { events: inventory, families: selected, settings: { cpi, nfp, services, manufacturing, retail, claims, pce, ppi, gdp }, asOf } : null,
    [brokerId, inventory, storage.loading, selected, cpi, nfp, services, manufacturing, retail, claims, pce, ppi, gdp, asOf])
  const calculation = useSharedContextCalculation(input, brokerId)
  return { ...calculation, loading: storage.loading || calculation.loading, storage, selected, inventory }
}
