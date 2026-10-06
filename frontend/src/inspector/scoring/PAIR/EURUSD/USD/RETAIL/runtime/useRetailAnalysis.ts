import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { retailSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'
import { useBackgroundCalculation } from '../../../../../shared/runtime/useBackgroundCalculation'
import { retailSeriesIds } from '../policy/retail-policy'
import { supportsRetailScore } from '../assessment/retail-features'
import { calculateRetailAnalysis } from './retail-analysis'

const scope = { currency: 'USD' as const, eventIds: retailSeriesIds }
const emptyEvents: NonNullable<InspectorScoringProps['events']> = []
const createWorker = () => new Worker(new URL('./retail-analysis.worker.ts', import.meta.url), { type: 'module' })

export function useRetailAnalysis({ release, brokerId, events = emptyEvents }: InspectorScoringProps) {
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range && supportsRetailScore(release), scope)
  const settings = retailSignalSettings.useSettings(), inventory = brokerId ? storage.events : events
  const input = useMemo(() => release && supportsRetailScore(release) && !storage.loading ? ({ release, events: inventory, settings }) : null,
    [release, inventory, settings, storage.loading])
  const calculation = useBackgroundCalculation(input, calculateRetailAnalysis, createWorker)
  return { assessment: calculation.result, loading: storage.loading || calculation.loading, error: calculation.error, storage }
}
