import { useEffect, useMemo, useState } from 'react'
import type { OhlcBar } from '../contracts/OhlcBar'

const initialLookback = 100
export const replaySpeeds = [0.25, 0.50, 0.75, 1, 1.25, 1.50, 1.75, 2] as const
type ReplaySpeed = typeof replaySpeeds[number]
type ReplayPosition = { scope: string; time: number; playing: boolean }

export function useChartReplay(open: boolean, scope: string, source: OhlcBar[], step: number, offset: number) {
  const [position, setPosition] = useState<ReplayPosition | null>(null)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)
  const [observed, setObserved] = useState(Date.now)
  const now = observed / 1000 + offset
  if (position && (!open || position.scope !== scope)) setPosition(null)
  const last = source.at(-1)
  const latest = source.length - (last && last.time + step > now ? 2 : 1)
  const start = Math.max(0, latest - initialLookback)
  const cursor = open && position?.scope === scope ? position : null
  const index = cursor && latest >= 0 ? findCandle(source, cursor.time, latest) : latest
  const playing = cursor?.playing === true && index < latest
  const nextTime = playing ? source[index + 1]?.time : undefined
  const canContinue = index + 1 < latest
  const end = cursor && index >= 0 ? source[index].time + step : null
  const bars = useMemo(() => end === null ? source : source.slice(0, index + 1), [end, source, index])

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setObserved(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [open])

  useEffect(() => {
    if (!playing || !cursor || nextTime === undefined) return
    const timer = window.setTimeout(() => {
      setPosition(current => current === cursor ? { scope, time: nextTime, playing: canContinue } : current)
    }, 1000 / speed)
    return () => window.clearTimeout(timer)
  }, [playing, cursor, nextTime, canContinue, scope, speed])

  function setIndex(target: number, play = false) {
    if (latest < 0) return
    const at = Math.max(0, Math.min(latest, target))
    setPosition({ scope, time: source[at].time, playing: play && at < latest })
  }

  return {
    bars, end, index, latest, playing, speed, setSpeed,
    seek: setIndex,
    togglePlay() {
      if (playing && cursor) setPosition({ ...cursor, playing: false })
      else setIndex(!cursor || index >= latest ? start : index, true)
    },
    returnToLive() { setPosition(null) },
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
