import { useEffect, useRef, useState } from 'react'
import { latestCalculationClient } from './latest-calculation-client'

type Client<Input> = { submit(input: Input): number; close(): void }
export function useBackgroundCalculation<Input, Output>(input: Input | null, calculate: (input: Input) => Output, createWorker: () => Worker) {
  const [completed, setCompleted] = useState<{ input: Input; result?: Output; error?: string } | null>(null)
  const client = useRef<Client<Input> | null>(null)
  const requested = useRef<Input | null>(null)
  const startupError = useRef<string | null>(null)
  const enabled = input !== null
  useEffect(() => {
    if (!enabled || typeof Worker === 'undefined') return
    startupError.current = null
    try {
      client.current = latestCalculationClient<Input, Output>(createWorker(), (reply) => {
        if (requested.current) setCompleted({ input: requested.current, result: reply.result, error: reply.error })
      })
    } catch { startupError.current = 'Background calculation could not start.' }
    return () => { client.current?.close(); client.current = null }
  }, [enabled, createWorker])
  useEffect(() => {
    if (!input) return
    requested.current = input
    let cancelled = false
    // Headless/non-worker environments use the same pure implementation.
    if (typeof Worker === 'undefined' || startupError.current) {
      void Promise.resolve().then(() => {
        if (cancelled) return
        if (startupError.current) { setCompleted({ input, error: startupError.current }); return }
        try { setCompleted({ input, result: calculate(input) }) }
        catch (error) { setCompleted({ input, error: error instanceof Error ? error.message : 'Calculation failed' }) }
      })
    } else client.current?.submit(input)
    return () => { cancelled = true }
  }, [input, calculate])
  const current = completed?.input === input ? completed : null
  return { result: current?.result ?? null, error: current?.error ?? null, loading: enabled && !current }
}
