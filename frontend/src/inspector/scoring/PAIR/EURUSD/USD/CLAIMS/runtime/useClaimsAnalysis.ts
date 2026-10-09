import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../../../scoring-system/shared/core/historical-release-signals'
import { useMagnitudeSettings, type MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { claimsStandaloneMagnitude, useClaimsPreferences } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-settings'
import type { ClaimsHorizon } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'
import { useBackgroundCalculation } from '../../../../../shared/runtime/useBackgroundCalculation'
import { claimsSeriesIds } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-policy'
import { supportsClaimsScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-features'
import { calculateClaimsStandalone } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/runtime/claims-standalone-analysis'

const scope = { currency: 'USD' as const, eventIds: claimsSeriesIds }
const emptyEvents: NonNullable<InspectorScoringProps['events']> = []
const createWorker = () => new Worker(new URL('../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/runtime/claims-standalone.worker.ts', import.meta.url), { type: 'module' })

export function useClaimsAnalysis({ release, brokerId, events = emptyEvents }: InspectorScoringProps,
  preview?: { horizon: ClaimsHorizon; settings: MagnitudeSettings; initialWeight: number }) {
  const preferences = useClaimsPreferences(), horizon = preview?.horizon ?? preferences.horizon
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range && supportsClaimsScore(release), scope)
  const saved = useMagnitudeSettings(claimsStandaloneMagnitude[horizon]), settings = preview?.settings ?? saved
  const initialWeight = preview?.initialWeight ?? preferences[horizon === 'release' ? 'releaseWeight' : 'trendWeight']
  const inventory = brokerId ? storage.events : events
  const input = useMemo(() => release && supportsClaimsScore(release) && !storage.loading ? ({ release, events: inventory, settings, horizon, initialWeight }) : null,
    [release, inventory, settings, horizon, initialWeight, storage.loading])
  const calculation = useBackgroundCalculation(input, calculateClaimsStandalone, createWorker)
  return { assessment: calculation.result, loading: storage.loading || calculation.loading, error: calculation.error, storage }
}
