import { calculateExpandedRelease, type ExpandedReleaseInput } from './expanded-release-analysis'
self.onmessage = (event: MessageEvent<{ id: number; input: ExpandedReleaseInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: calculateExpandedRelease(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Release calculation failed' }) }
}
