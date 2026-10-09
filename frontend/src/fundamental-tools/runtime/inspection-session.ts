import { useSyncExternalStore } from 'react'
import type { ContextPoint } from '../../scoring-system/context/usd/contracts'
import type { EurContextPoint } from '../../scoring-system/context/relative/contracts'
import type { FreshPoint } from '../../scoring-system/relationships/contracts'

export type ToolInspection = {
  usd: ContextPoint | null; eur: EurContextPoint | null; fresh: FreshPoint | null;
  cutoff: number | null; loading: boolean; message: string | null; held: boolean;
  signature: string; window: { from: number; to: number } | null
}
export const toolScope = (broker: string | null, symbol: string, timeframe: string) => JSON.stringify([broker, symbol, timeframe])
export const inspectionSignature = (families: readonly string[], mode: string, eurFamilies: readonly string[]) => JSON.stringify([families, mode, eurFamilies])
const listeners = new Set<() => void>(), readings = new Set<() => void>()
let openScope: string | null = null, inspection: ToolInspection | null = null
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
const subscribeReading = (fn: () => void) => { readings.add(fn); return () => { readings.delete(fn) } }
export function setToolsOpen(scope: string, open: boolean) {
  if ((!open && openScope !== scope) || (open && openScope === scope)) return
  openScope = open ? scope : null; inspection = null
  for (const notify of listeners) notify()
  for (const notify of readings) notify()
}
export function publishInspection(scope: string, next: ToolInspection | null) {
  if (openScope !== scope || inspection === next) return
  inspection = next
  for (const notify of readings) notify()
}
export const useToolsOpen = (scope: string) => useSyncExternalStore(subscribe, () => openScope === scope, () => false)
export const useToolInspection = (scope: string) => useSyncExternalStore(subscribeReading, () => openScope === scope ? inspection : null, () => null)
