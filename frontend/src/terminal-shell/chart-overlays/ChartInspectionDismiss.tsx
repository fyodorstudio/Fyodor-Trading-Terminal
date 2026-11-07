import { useEffect } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import { chartClickClaimed } from '../../market-data/candlestick-chart/chart-click-selection'

/** Canvas clicks clear inspection; overlay buttons do not trigger chart clicks. */
export function ChartInspectionDismiss({ chartApi, onClear }: { chartApi: IChartApi; onClear?: () => void }) {
  useEffect(() => {
    if (!onClear) return
    const click = (event: MouseEventParams<Time>) => {
      if (chartClickClaimed(event)) return
      if (chartApi.chartElement().dataset.ledgerPicking === 'true') return
      if (event.point && !(event.hoveredInfo?.objectId ?? event.hoveredObjectId)) onClear()
    }
    chartApi.subscribeClick(click)
    return () => chartApi.unsubscribeClick(click)
  }, [chartApi, onClear])
  return null
}
