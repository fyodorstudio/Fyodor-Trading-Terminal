import { useEffect, useMemo, useState } from 'react'
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts'

export function useRaycasterHover(chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>, scope: string, enabled = true) {
  // A new token also prevents returning to an old chart scope from reviving its
  // held candle. No extra reset render or scoring work is needed on scope change.
  const identity = useMemo(() => ({ scope, enabled }), [scope, enabled])
  const [hover, setHover] = useState<{ identity: object; open: number | null; lastOpen: number | null }>({ identity, open: null, lastOpen: null })
  useEffect(() => {
    if (!enabled) return
    let frame = 0, pending: number | null = null, pendingLast: number | null = null
    const handle = (event: MouseEventParams<Time>) => {
      pending = event.point && typeof event.time === 'number' && event.seriesData.has(seriesApi) ? Number(event.time) : null
      if (pending !== null) pendingLast = pending
      if (!frame) frame = window.requestAnimationFrame(() => {
        frame = 0
        const open = pending, latest = pendingLast
        pendingLast = null
        setHover(previous => {
          const lastOpen = latest ?? (previous.identity === identity ? previous.lastOpen : null)
          return previous.identity === identity && previous.open === open && previous.lastOpen === lastOpen ? previous : { identity, open, lastOpen }
        })
      })
    }
    chartApi.subscribeCrosshairMove(handle)
    return () => { chartApi.unsubscribeCrosshairMove(handle); if (frame) window.cancelAnimationFrame(frame) }
  }, [chartApi, seriesApi, identity, enabled])
  return enabled && hover.identity === identity ? hover : { open: null, lastOpen: null }
}
