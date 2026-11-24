import { useCallback, useEffect, useRef, useState } from 'react'
import { bridgeRequest } from '../../../system-connectivity/bridge-status/bridge-client'

export type TickCounts = { up: number; down: number; flat: number; unknown: number }
export type TickHistory = ReadonlyMap<number, TickCounts | null>

const maxCandles = 32
const maxWindowSeconds = 4 * 3600

export function useTickDeltaHistory(path: string | null, candles: readonly number[], hover: number | null, step: number) {
  const [history, setHistory] = useState<TickHistory>(() => new Map())
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort(); request.current = null }, [path])

  useEffect(() => {
    if (!path || request.current) return
    const missing = candles.filter(time => !history.has(time))
    if (!missing.length) return
    const first = hover !== null && !history.has(hover) && missing.includes(hover) ? hover : missing.at(-1)!
    const window = Math.max(step, maxWindowSeconds)
    // Work back from the newest visible candles, or start with the candle under the crosshair.
    // A batch spans at most one bounded native tick read per instrument.
    const batch = missing.filter(time => time <= first && first - time + step <= window).slice(-maxCandles)
    const query = new URLSearchParams(batch.map(time => ['start', String(time)]))
    const controller = new AbortController()
    request.current = controller
    const remember = (rows: (TickCounts & { time: number })[]) => {
      if (controller.signal.aborted) return
      request.current = null
      const found = new Map(rows.map(({ time, ...counts }) => [time, counts]))
      setHistory(previous => {
        const next = new Map(previous)
        for (const time of batch) next.set(time, found.get(time) ?? null)
        return next
      })
    }
    void bridgeRequest<{ rows: (TickCounts & { time: number })[] }>(`/candle-tick-history?${path}&${query}`, controller.signal)
      .then(({ rows }) => remember(rows), () => remember([]))
  }, [path, candles, hover, history, step])

  const save = useCallback((time: number, counts: TickCounts) => setHistory(previous => new Map(previous).set(time, counts)), [])
  return { history, save }
}
