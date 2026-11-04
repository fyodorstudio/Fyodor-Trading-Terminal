import { useEffect, useRef, type ReactNode } from 'react'
import type { IChartApi, ISeriesApi, ISeriesPrimitive, Time } from 'lightweight-charts'

export function PricePaneOverlays({ chartApi, seriesApi, constrained, children }: {
  chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time>; constrained: boolean; children: ReactNode
}) {
  const overlay = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!constrained) return
    const element = overlay.current
    if (!element) return
    const refresh = () => { element.style.height = `${chartApi.paneSize(0).height}px` }
    const views = [{ renderer: () => ({ draw: refresh }) }]
    const primitive: ISeriesPrimitive<Time> = { paneViews: () => views }
    seriesApi.attachPrimitive(primitive)
    refresh()
    return () => { seriesApi.detachPrimitive(primitive); element.style.removeProperty('height') }
  }, [chartApi, seriesApi, constrained])
  return <div ref={overlay} className="chart-price-pane-overlays" data-constrained={constrained || undefined}>{children}</div>
}
