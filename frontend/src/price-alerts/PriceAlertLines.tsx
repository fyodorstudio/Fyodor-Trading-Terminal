import { useLayoutEffect, useMemo, useRef } from 'react'
import type { IChartApi, IPriceLine, ISeriesApi, Time } from 'lightweight-charts'
import type { PriceAlert } from './price-alert-store'
import { PriceAlertHandles } from './PriceAlertHandles'

export function PriceAlertLines({ chartApi, seriesApi, alerts, symbol, dragEnabled, onPriceChange, onDragChange, onDeleteAlert, selectedAlertId }: {
  chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time>; alerts: PriceAlert[]; symbol: string
  dragEnabled: boolean; onPriceChange: (id: string, price: number) => void; onDragChange: (id: string | null) => void
  onDeleteAlert: (id: string) => void
  selectedAlertId: string | null
}) {
  const lines = useRef(new Map<string, IPriceLine>())
  const visible = useMemo(() => alerts.filter(alert => alert.symbol === symbol && alert.status !== 'triggered'), [alerts, symbol])
  useLayoutEffect(() => {
    const current = lines.current
    return () => { for (const line of current.values()) seriesApi.removePriceLine(line); current.clear() }
  }, [seriesApi])
  useLayoutEffect(() => {
    const ids = new Set(visible.map(alert => alert.id))
    for (const [id, line] of lines.current) {
      if (!ids.has(id)) { seriesApi.removePriceLine(line); lines.current.delete(id) }
    }
    for (const alert of visible) {
      const selected = alert.id === selectedAlertId
      const options = { price: alert.price, color: selected ? '#0891b2' : alert.status === 'armed' ? '#b45309' : '#4f46e5',
        lineWidth: selected ? 3 as const : 2 as const, lineStyle: 2, axisLabelVisible: true,
        title: `⏰ ${alert.status === 'paused' ? 'Paused · ' : ''}${alert.name || 'Price alert'}` }
      const existing = lines.current.get(alert.id)
      if (existing) existing.applyOptions(options)
      else lines.current.set(alert.id, seriesApi.createPriceLine(options))
    }
  }, [seriesApi, visible, selectedAlertId])
  return visible.length && dragEnabled ? <PriceAlertHandles chartApi={chartApi} seriesApi={seriesApi} alerts={visible}
    lines={lines} onPriceChange={onPriceChange} onDragChange={onDragChange} onDeleteAlert={onDeleteAlert} /> : null
}
