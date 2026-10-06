import { calculateEurAnalysis, type EurAnalysisInput } from './eur-analysis'
self.onmessage = (event: MessageEvent<{ id: number; input: EurAnalysisInput }>) => {
  try { self.postMessage({ id: event.data.id, result: calculateEurAnalysis(event.data.input) }) }
  catch (error) { self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'EUR calculation failed.' }) }
}
