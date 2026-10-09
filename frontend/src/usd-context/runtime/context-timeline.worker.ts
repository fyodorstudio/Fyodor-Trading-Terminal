import { buildContextTimeline } from '../../scoring-system/context/usd/build-context-timeline'
import type { ContextInput } from '../../scoring-system/context/usd/contracts'

self.onmessage = (event: MessageEvent<{ id: number; input: ContextInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: buildContextTimeline(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'USD context calculation failed.' }) }
}
