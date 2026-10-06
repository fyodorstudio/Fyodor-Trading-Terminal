import { buildContextTimeline } from '../core/build-context-timeline'
import type { ContextInput } from '../core/contracts'

self.onmessage = (event: MessageEvent<{ id: number; input: ContextInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: buildContextTimeline(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'USD context calculation failed.' }) }
}
