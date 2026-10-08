import { useEffect, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { IChartApi, ISeriesApi, ISeriesPrimitive, Logical, Time } from 'lightweight-charts'

export function useDrawingViewport(chartApi: IChartApi, seriesApi: ISeriesApi<'Candlestick', Time>, overlayRef: RefObject<SVGSVGElement | null>) {
  const [viewport, setViewport] = useState({ width: 0, height: 0, revision: 0 })
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const scale = chartApi.timeScale()
    let frame: number | null = null
    let disposed = false
    let lastTransform = ''
    const refresh = (synchronous = false) => {
      if (disposed) return
      const pane = chartApi.paneSize?.()
      const width = pane?.width ?? overlay.clientWidth
      const height = pane?.height ?? overlay.clientHeight
      const transform = attached ? [width, height, scale.logicalToCoordinate(0 as Logical), scale.logicalToCoordinate(1 as Logical),
        seriesApi.priceToCoordinate(1), seriesApi.priceToCoordinate(2)].join(',') : ''
      if (synchronous && transform === lastTransform) return
      lastTransform = transform
      const update = () => setViewport(current => ({ width, height, revision: current.revision + 1 }))
      if (synchronous) flushSync(update)
      else update()
    }
    // The primitive renderer runs inside the chart's animation frame, after
    // scale calculation. Commit the SVG before that same frame is painted.
    const renderer = { draw: () => refresh(true) }
    const views = [{ renderer: () => renderer }]
    const primitive: ISeriesPrimitive<Time> = { paneViews: () => views }
    const attached = typeof seriesApi.attachPrimitive === 'function'
    if (attached) seriesApi.attachPrimitive(primitive)
    // Fallback for chart adapters without a primitive lifecycle.
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(() => { frame = null; refresh() }) }
    const resizeObserver = attached ? null : new ResizeObserver(schedule)
    resizeObserver?.observe(overlay)
    if (!attached) scale.subscribeVisibleLogicalRangeChange(schedule)
    refresh()
    return () => {
      disposed = true
      resizeObserver?.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      if (attached) seriesApi.detachPrimitive(primitive)
      else scale.unsubscribeVisibleLogicalRangeChange(schedule)
    }
  }, [chartApi, seriesApi, overlayRef])
  return viewport
}
