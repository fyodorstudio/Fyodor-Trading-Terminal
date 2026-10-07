import { useEffect, useState, type RefObject } from 'react'
import type { IChartApi } from 'lightweight-charts'

export function useDrawingViewport(chartApi: IChartApi, overlayRef: RefObject<SVGSVGElement | null>) {
  const [viewport, setViewport] = useState({ width: 0, height: 0, revision: 0 })
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const scale = chartApi.timeScale()
    let frame: number | null = null
    const refresh = () => {
      frame = null
      setViewport(current => ({ width: overlay.clientWidth, height: overlay.clientHeight, revision: current.revision + 1 }))
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(refresh) }
    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(overlay)
    scale.subscribeVisibleLogicalRangeChange(schedule)
    refresh()
    return () => {
      resizeObserver.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      scale.unsubscribeVisibleLogicalRangeChange(schedule)
    }
  }, [chartApi, overlayRef])
  return viewport
}
