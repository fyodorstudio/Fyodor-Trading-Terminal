import { useMemo } from 'react'
import type { InspectorEvent, InspectorRelease } from '../../inspector/inspector-data'
import { useContextFamilies } from '../storage/context-family-settings'
import { useUsdContextTimeline } from './useUsdContextTimeline'
import { contextSourceFamilies } from '../../scoring-system/context/usd/policy'
import { contextAt } from '../../scoring-system/context/usd/context-lookup'

const empty: readonly InspectorEvent[] = []
export function usePublicationContext(release: InspectorRelease, brokerId: string | null = null,
  events: readonly InspectorEvent[] = empty, now = 0) {
  const families = useContextFamilies(), sources = useMemo(() => contextSourceFamilies(families), [families])
  const context = useUsdContextTimeline(brokerId, sources, now, events, true)
  const eligible = !release.timingUncertain && release.releaseAt !== null && Number.isFinite(release.releaseAt) &&
    release.releaseAt <= now && release.chartTime !== null && Number.isFinite(release.chartTime)
  const at = eligible ? release.chartTime! * 1000 : null
  const before = at === null || !context.result ? null : contextAt(context.result, at - 1)
  const after = at === null || !context.result ? null : contextAt(context.result, at)
  return { families, context, eligible, at, before, after, result: after?.result ?? null,
    ready: !context.loading && !context.error && eligible }
}
