import { useEffect } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'

/** Canvas clicks clear inspection; overlay buttons do not trigger chart clicks. */
export function ChartInspectionDismiss({ chartApi, onClear }: { chartApi: IChartApi; onClear?: () => void }) {
  useEffect(() => {
    if (!onClear) return
    const click = (event: MouseEventParams<Time>) => {
      if (event.point && !event.hoveredObjectId) onClear()
    }
    chartApi.subscribeClick(click)
    return () => chartApi.unsubscribeClick(click)
  }, [chartApi, onClear])
  return null
}
