import { calculateCpiRelease, type CpiReleaseInput } from './cpi-release-analysis'

self.onmessage = (event: MessageEvent<{ id: number; input: CpiReleaseInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: calculateCpiRelease(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'CPI release calculation failed' }) }
}
