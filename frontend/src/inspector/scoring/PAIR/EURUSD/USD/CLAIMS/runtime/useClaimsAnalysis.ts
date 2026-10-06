import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { claimsSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'
import { useBackgroundCalculation } from '../../../../../shared/runtime/useBackgroundCalculation'
import { claimsSeriesIds } from '../policy/claims-policy'
import { supportsClaimsScore } from '../assessment/claims-features'
import { calculateClaimsAnalysis } from './claims-analysis'

const scope = { currency: 'USD' as const, eventIds: claimsSeriesIds }
const emptyEvents: NonNullable<InspectorScoringProps['events']> = []
const createWorker = () => new Worker(new URL('./claims-analysis.worker.ts', import.meta.url), { type: 'module' })

export function useClaimsAnalysis({ release, brokerId, events = emptyEvents }: InspectorScoringProps) {
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range && supportsClaimsScore(release), scope)
  const settings = claimsSignalSettings.useSettings(), inventory = brokerId ? storage.events : events
  const input = useMemo(() => release && supportsClaimsScore(release) && !storage.loading ? ({ release, events: inventory, settings }) : null,
    [release, inventory, settings, storage.loading])
  const calculation = useBackgroundCalculation(input, calculateClaimsAnalysis, createWorker)
  return { assessment: calculation.result, loading: storage.loading || calculation.loading, error: calculation.error, storage }
}
