import { calculateSignalHistory, type SignalHistoryInput } from './signal-history-calculation'

self.onmessage = (event: MessageEvent<{ id: number; input: SignalHistoryInput }>) => {
  const { id, input } = event.data
  try { self.postMessage({ id, result: calculateSignalHistory(input) }) }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Signal history calculation failed' }) }
}
