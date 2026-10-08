import { useMemo, useSyncExternalStore } from 'react'
import type { IChartApi } from 'lightweight-charts'

// Transient chart presentation only: shared by Roofs and the release symbols.
// A separate chart never inherits another chart's hovered/selected sources.
const stores = new WeakMap<IChartApi, ReturnType<typeof createStore>>()
function createStore() {
  let ids: ReadonlySet<string> = new Set()
  const listeners = new Set<() => void>()
  return {
    snapshot: () => ids,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    set: (sources: readonly string[]) => {
      const next = new Set(sources)
      if (next.size === ids.size && [...next].every(id => ids.has(id))) return
      ids = next
      for (const listener of listeners) listener()
    },
  }
}
function storeFor(chartApi: IChartApi) {
  let store = stores.get(chartApi)
  if (!store) { store = createStore(); stores.set(chartApi, store) }
  return store
}
export function emphasizeMarkers(chartApi: IChartApi, sourceIds: readonly string[]) {
  storeFor(chartApi).set(sourceIds)
}
export function useMarkerEmphasis(chartApi: IChartApi) {
  const store = useMemo(() => storeFor(chartApi), [chartApi])
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}
