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
    const refresh = () => {
      const left = chartApi.options().leftPriceScale.visible ? chartApi.priceScale('left').width() : 0
      element.style.height = `${chartApi.paneSize(0).height}px`
      element.style.left = `${left}px`
      element.style.width = `calc(100% - ${left}px)`
    }
    const views = [{ renderer: () => ({ draw: refresh }) }]
    const primitive: ISeriesPrimitive<Time> = { paneViews: () => views }
    seriesApi.attachPrimitive(primitive)
    // Native axis widgets exist at paint, after the first layout effect.
    element.style.height = `${chartApi.paneSize(0).height}px`
    return () => {
      seriesApi.detachPrimitive(primitive)
      for (const property of ['height', 'left', 'width']) element.style.removeProperty(property)
    }
  }, [chartApi, seriesApi, constrained])
  return <div ref={overlay} className="chart-price-pane-overlays" data-constrained={constrained || undefined}>{children}</div>
}
