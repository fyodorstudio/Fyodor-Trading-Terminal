import { createContext } from 'react'

export type UtcClockCorrection = {
  read: () => number
  subscribe: (listener: () => void) => () => void
}

// Corrections are sampled by clocks, rather than pushed through chart props.
export const UtcClockCorrectionContext = createContext<UtcClockCorrection | null>(null)
export function createUtcClockCorrection() {
  let offset = 0
  const listeners = new Set<() => void>()
  return {
    read: () => offset,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    update(next: number) {
      if (next === offset) return
      offset = next
      for (const listener of listeners) listener()
    },
  }
}
