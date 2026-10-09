import { calculateIsmAnalysis, type IsmAnalysisInput } from './ism-analysis'

self.onmessage = (event: MessageEvent<{ id: number; input: IsmAnalysisInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: calculateIsmAnalysis(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'ISM calculation failed' }) }
}
