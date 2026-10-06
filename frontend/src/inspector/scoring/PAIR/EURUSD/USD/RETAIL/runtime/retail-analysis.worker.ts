import { calculateRetailAnalysis, type RetailAnalysisInput } from './retail-analysis'

self.onmessage = (event: MessageEvent<{ id: number; input: RetailAnalysisInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: calculateRetailAnalysis(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Retail Sales calculation failed' }) }
}
