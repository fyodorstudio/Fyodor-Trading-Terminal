import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../scoring-contracts'
import { useStoredCalendar } from '../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../scoring-system/shared/core/historical-release-signals'
import { gdpSignalSettings, ppiSignalSettings } from '../../../../scoring-system/shared/core/signal-magnitude-settings'
import { gdpSeriesIds } from '../../../../scoring-system/PAIR/EURUSD/USD/GDP/policy/gdp-policy'
import { ppiSeriesIds } from '../../../../scoring-system/PAIR/EURUSD/USD/PPI/policy/ppi-policy'
import { useBackgroundCalculation } from './useBackgroundCalculation'
import { calculateExpandedRelease } from '../../../../scoring-system/shared/runtime/expanded-release-analysis'
const scopes = { gdp: { currency: 'USD' as const, eventIds: gdpSeriesIds }, ppi: { currency: 'USD' as const, eventIds: ppiSeriesIds } }
const empty: NonNullable<InspectorScoringProps['events']> = []
const createWorker = () => new Worker(new URL('../../../../scoring-system/shared/runtime/expanded-release.worker.ts', import.meta.url), { type: 'module' })
export function useExpandedRelease({ release, brokerId, events = empty }: InspectorScoringProps) {
  const family = release?.familyId === 'gdp' ? 'gdp' : 'ppi'
  const gdp = gdpSignalSettings.useSettings(), ppi = ppiSignalSettings.useSettings()
  const settings = family === 'gdp' ? gdp : ppi
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scopes[family]), inventory = brokerId ? storage.events : events
  const input = useMemo(() => release && !storage.loading ? { release, events: inventory, settings } : null, [release, inventory, settings, storage.loading])
  const calculation = useBackgroundCalculation(input, calculateExpandedRelease, createWorker)
  return { ...calculation, loading: storage.loading || calculation.loading, storage }
}
