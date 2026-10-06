import { calculateClaimsAnalysis, type ClaimsAnalysisInput } from './claims-analysis'

self.onmessage = (event: MessageEvent<{ id: number; input: ClaimsAnalysisInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: calculateClaimsAnalysis(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Jobless Claims calculation failed' }) }
}
