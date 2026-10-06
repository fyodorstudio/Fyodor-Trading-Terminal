import { useMemo } from 'react'
import type { InspectorRelease } from '../../../../../../inspector-data'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { useCalendarNow } from '../../../../../../useCalendarNow'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { ismServicesSignalSettings, ismManufacturingSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'
import { useBackgroundCalculation } from '../../../../../shared/runtime/useBackgroundCalculation'
import { ismV2SeriesIds } from '../assessment/ism-score-v2'
import { calculateIsmAnalysis } from './ism-analysis'

const scope = { currency: 'USD' as const, eventIds: ismV2SeriesIds }
const emptyEvents: EconomicCalendarEvent[] = []
const createWorker = () => new Worker(new URL('./ism-analysis.worker.ts', import.meta.url), { type: 'module' })
export type IsmAnalysisProps = { release: InspectorRelease | null; brokerId?: string | null; events?: EconomicCalendarEvent[]; now?: number }

export function useIsmAnalysis({ release, brokerId, events = emptyEvents, now: suppliedNow }: IsmAnalysisProps) {
  const clock = useCalendarNow(), now = suppliedNow ?? clock
  const publications = release?.ismPublications
  const last = publications?.[publications.length - 1]?.releaseAt ?? release?.releaseAt ?? null
  // Clock/quote changes invalidate analysis only when a publication becomes available.
  const asOf = (publications ?? (release ? [release] : [])).reduce((at, source) =>
    source.releaseAt !== null && source.releaseAt <= now ? Math.max(at, source.releaseAt) : at, 0)
  const range = useMemo(() => last === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: last + 2 * 86400000 }), [last])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const services = ismServicesSignalSettings.useSettings(), manufacturing = ismManufacturingSignalSettings.useSettings()
  const inventory = brokerId ? storage.events : events
  const input = useMemo(() => release ? ({ release, events: inventory, settings: { services, manufacturing }, asOf }) : null,
    [release, inventory, services, manufacturing, asOf])
  const calculation = useBackgroundCalculation(input, calculateIsmAnalysis, createWorker)
  return { analysis: calculation.result, storage, loading: storage.loading || calculation.loading, error: calculation.error }
}
