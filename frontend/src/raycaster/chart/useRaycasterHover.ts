import { useEffect, useState } from 'react'
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts'

export function useRaycasterHover(chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>) {
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    let frame = 0, pending: number | null = null
    const handle = (event: MouseEventParams<Time>) => {
      pending = event.point && typeof event.time === 'number' && event.seriesData.has(seriesApi) ? Number(event.time) : null
      if (!frame) frame = window.requestAnimationFrame(() => {
        frame = 0; setOpen(previous => previous === pending ? previous : pending)
      })
    }
    chartApi.subscribeCrosshairMove(handle)
    return () => { chartApi.unsubscribeCrosshairMove(handle); if (frame) window.cancelAnimationFrame(frame) }
  }, [chartApi, seriesApi])
  return open
}
