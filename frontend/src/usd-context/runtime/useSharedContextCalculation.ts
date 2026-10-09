import { useMemo, useSyncExternalStore } from 'react'
import type { ContextInput, ContextTimeline } from '../../scoring-system/context/usd/contracts'
import { contextVersion } from '../../scoring-system/context/usd/policy'
import { relationshipVersion } from '../../scoring-system/relationships/contracts'
import { buildContextTimeline } from '../../scoring-system/context/usd/build-context-timeline'
import { contextInventoryIdentity } from './context-inventory-identity'
import { sharedContextJobs, type JobState } from './shared-context-jobs'

const jobs = sharedContextJobs(buildContextTimeline, () => typeof Worker === 'undefined' ? null :
  new Worker(new URL('./context-timeline.worker.ts', import.meta.url), { type: 'module' }))
const disabled: JobState<ContextTimeline> = { result: null, error: null, loading: false }
const noSubscribe = () => () => {}
const disabledSnapshot = () => disabled
export function useSharedContextCalculation(input: ContextInput | null, brokerId: string | null) {
  const events = input?.events
  const inventory = useMemo(() => events ? contextInventoryIdentity(events) : null, [events])
  const key = input ? JSON.stringify([contextVersion, relationshipVersion, brokerId, inventory, input.asOf,
    [...input.families].sort(), input.settings]) : null
  const job = useMemo(() => key && input ? jobs.get(key, input) : null, [key, input])
  return useSyncExternalStore(job?.subscribe ?? noSubscribe, job?.snapshot ?? disabledSnapshot, disabledSnapshot)
}
