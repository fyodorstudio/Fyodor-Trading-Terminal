import { useEffect } from 'react'
import type { ISeriesApi, Time } from 'lightweight-charts'
import type { PriceAlert } from './price-alert-store'

export function PriceAlertLines({ seriesApi, alerts, symbol }: {
  seriesApi: ISeriesApi<'Candlestick', Time>; alerts: PriceAlert[]; symbol: string
}) {
  useEffect(() => {
    const lines = alerts.filter(alert => alert.symbol === symbol && alert.status !== 'triggered').map(alert =>
      seriesApi.createPriceLine({ price: alert.price, color: alert.status === 'armed' ? '#b45309' : '#4f46e5',
        lineWidth: 2, lineStyle: 2, axisLabelVisible: true,
        title: `⏰ ${alert.status === 'armed' ? 'Price alert' : 'Paused'}` }))
    return () => { for (const line of lines) seriesApi.removePriceLine(line) }
  }, [seriesApi, alerts, symbol])
  return null
}
