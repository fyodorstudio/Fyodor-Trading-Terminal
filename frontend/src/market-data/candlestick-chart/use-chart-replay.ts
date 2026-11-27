import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OhlcBar } from '../contracts/OhlcBar'

const initialLookback = 100
export const replaySpeeds = [0.25, 0.50, 0.75, 1, 1.25, 1.50, 1.75, 2] as const
type ReplaySpeed = typeof replaySpeeds[number]
type ReplayPosition = { scope: string; time: number; playing: boolean; seekRevision: number; anchor?: number }

export function useChartReplay(open: boolean, scope: string, source: OhlcBar[], step: number, offset: number, keepPosition = false) {
  const [position, setPosition] = useState<ReplayPosition | null>(null)
  const [pickerScope, setPickerScope] = useState<string | null>(null)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)
  const [observed, setObserved] = useState(Date.now)
  const now = observed / 1000 + offset
  const cursor = (open || keepPosition) && position?.scope === scope ? position : null
  if (position && !cursor) setPosition(null)
  const picking = open && pickerScope === scope
  if (pickerScope && !picking) setPickerScope(null)
  const last = source.at(-1)
  const latest = source.length - (last && last.time + step > now ? 2 : 1)
  const anchor = cursor?.anchor ?? null
  const start = anchor !== null && latest >= 0 ? findCandle(source, anchor, latest) : Math.max(0, latest - initialLookback)
  const index = cursor && latest >= 0 ? findCandle(source, cursor.time, latest) : latest
  const playing = cursor?.playing === true && index < latest
  const nextTime = playing ? source[index + 1]?.time : undefined
  const canContinue = index + 1 < latest
  const end = cursor && index >= 0 ? source[index].time + step : null
  const bars = useMemo(() => end === null ? source : source.slice(0, index + 1), [end, source, index])

  const watchClock = open || cursor !== null
  useEffect(() => {
    if (!watchClock) return
    const timer = window.setInterval(() => setObserved(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [watchClock])

  useEffect(() => {
    if (!playing || !cursor || nextTime === undefined) return
    const timer = window.setTimeout(() => {
      setPosition(current => current === cursor ? { ...current, time: nextTime, playing: canContinue } : current)
    }, 1000 / speed)
    return () => window.clearTimeout(timer)
  }, [playing, cursor, nextTime, canContinue, speed])

  const pause = useCallback(() => {
    setPosition(current => current?.playing ? { ...current, playing: false } : current)
  }, [])

  const cancelPicking = useCallback(() => setPickerScope(null), [])

  function setIndex(target: number, play = false) {
    if (latest < 0) return
    const at = Math.max(0, Math.min(latest, target))
    setPosition(current => ({ scope, time: source[at].time, playing: play && at < latest,
      anchor: current?.scope === scope ? current.anchor : undefined, seekRevision: (current?.seekRevision ?? 0) + 1 }))
  }

  const pickAnchor = useCallback((time: number) => {
    if (!picking || latest < 0) return false
    const candle = source[findCandle(source, time, latest)]
    if (candle.time !== time || candle.closeOnly) return false
    cancelPicking()
    setPosition(current => ({ scope, time, anchor: time, playing: false, seekRevision: (current?.seekRevision ?? 0) + 1 }))
    return true
  }, [picking, latest, source, scope, cancelPicking])

  return {
    bars, end, seekRevision: cursor?.seekRevision ?? null, index, latest, playing, speed, setSpeed, pause,
    anchor, picking, pickAnchor, cancelPicking,
    startPicking() { pause(); setPickerScope(scope) },
    seek(target: number) { cancelPicking(); setIndex(target) },
    togglePlay() {
      cancelPicking()
      if (playing) pause()
      else if (cursor && index < latest) setPosition({ ...cursor, playing: true })
      else setIndex(start, true)
    },
    returnToLive() { cancelPicking(); setPosition(null) },
  }
}

function findCandle(bars: readonly OhlcBar[], time: number, last: number) {
  let left = 0, right = last + 1
  while (left < right) {
    const middle = (left + right) >>> 1
    if (bars[middle].time <= time) left = middle + 1
    else right = middle
  }
  return Math.max(0, left - 1)
}
