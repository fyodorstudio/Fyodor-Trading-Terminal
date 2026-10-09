import { calculateClaimsStandalone, type ClaimsStandaloneInput } from './claims-standalone-analysis'

self.onmessage = (event: MessageEvent<{ id: number; input: ClaimsStandaloneInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: calculateClaimsStandalone(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Claims calculation failed' }) }
}
