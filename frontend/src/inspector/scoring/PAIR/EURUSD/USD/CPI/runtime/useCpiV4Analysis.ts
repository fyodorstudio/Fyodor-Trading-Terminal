import { useMemo } from 'react'
import type { InspectorEvent, InspectorRelease } from '../../../../../../inspector-data'
import { cpiSignalSettings } from '../../../../../../../scoring-system/shared/core/signal-magnitude-settings'
import { useBackgroundCalculation } from '../../../../../shared/runtime/useBackgroundCalculation'
import { useUsdContextTimeline } from '../../../../../../../usd-context/runtime/useUsdContextTimeline'
import { useContextFamilies } from '../../../../../../../usd-context/storage/context-family-settings'
import { contextSourceFamilies } from '../../../../../../../scoring-system/context/usd/policy'
import { compareCpiPublication } from '../../../../../../../scoring-system/context/usd/publication-comparison'
import { calculateCpiRelease } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CPI/runtime/cpi-release-analysis'

const createWorker = () => new Worker(new URL('../../../../../../../scoring-system/PAIR/EURUSD/USD/CPI/runtime/cpi-release.worker.ts', import.meta.url), { type: 'module' })
export function useCpiV4Analysis(release: InspectorRelease, brokerId: string | null, events: readonly InspectorEvent[], now: number) {
  const families = useContextFamilies()
  const sourceFamilies = useMemo(() => contextSourceFamilies(families), [families])
  const context = useUsdContextTimeline(brokerId, sourceFamilies, now, events, true)
  const settings = cpiSignalSettings.useSettings()
  const published = release.releaseAt !== null && release.releaseAt <= now
  const input = useMemo(() => !context.storage.loading && published ?
    { release, events: context.inventory, settings } : null,
    [release, context.inventory, settings, context.storage.loading, published])
  const standalone = useBackgroundCalculation(input, calculateCpiRelease, createWorker)
  const comparison = useMemo(() => compareCpiPublication(context.result, release, now), [context.result, release, now])
  return { standalone, context, families, comparison }
}
