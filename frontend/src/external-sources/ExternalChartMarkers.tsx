import { memo, useEffect, useMemo, useState } from 'react'
import type { IChartApi } from 'lightweight-charts'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import { chartEventScope, chartEventCurrencies } from '../economic-calendar/forex/chart-event-scope'
import { useMarkerBars } from '../inspector/chart/useMarkerBars'
import { useExternalSources } from './useExternalSources'
import { buildExternalMarkers, projectExternalMarkers, sameExternalClusters, type ExternalCluster } from './external-markers'
import './external-chart-markers.css'
import { useExternalIconVisibility } from './external-icon-visibility'

export const ExternalChartMarkers = memo(function ExternalChartMarkers({ chartApi, symbol, bars, timeframe, brokerRows, onSelect }: {
  chartApi: IChartApi; symbol: string; bars: OhlcBar[]; timeframe: ChartTimeframe; brokerRows: number; onSelect: (key: string | null) => void
}) {
  const { scope: clock, utc } = useDisplayClock()
  const scope = chartEventScope(symbol)
  const currencies = chartEventCurrencies(symbol)
  const records = useExternalSources(scope ?? 'all', 'all')
  const visibility = useExternalIconVisibility()
  const timeline = useMarkerBars(bars)
  const markers = useMemo(() => scope ? buildExternalMarkers(records.items.filter(item => currencies.some(currency => item.currencies.includes(currency))),
    timeline, timeframe, clock, visibility) : [], [scope, currencies, records.items, timeline, timeframe, clock, visibility])
  const [clusters, setClusters] = useState<ExternalCluster[]>([]), [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => {
    const scale = chartApi.timeScale(); let frame: number | null = null
    const update = () => {
      frame = null
      const next = projectExternalMarkers(scale, markers)
      setClusters(previous => sameExternalClusters(previous, next) ? previous : next)
      setExpanded(key => next.some(cluster => cluster.markers.length > 1 && cluster.markers[0].item.key === key) ? key : null)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    // Wait until the chart's parent effect has applied its candle timeline.
    schedule(); scale.subscribeVisibleLogicalRangeChange(schedule); scale.subscribeSizeChange(schedule)
    return () => { if (frame !== null) window.cancelAnimationFrame(frame); scale.unsubscribeVisibleLogicalRangeChange(schedule); scale.unsubscribeSizeChange(schedule) }
  }, [chartApi, markers])
  useEffect(() => {
    if (!expanded) return
    const dismiss = () => setExpanded(null)
    chartApi.subscribeClick(dismiss)
    return () => chartApi.unsubscribeClick(dismiss)
  }, [chartApi, expanded])
  return <div className="external-chart-markers" aria-label="Custom External Sources stars"
    style={{ bottom: 34 + Math.max(1, brokerRows) * 34 }}>
    {records.error && <button type="button" className="external-chart-error" title={records.error} onClick={() => onSelect(null)}>External Sources unavailable</button>}
    {clusters.map(cluster => {
      const first = cluster.markers[0], multiple = cluster.markers.length > 1
      const description = (marker: typeof first) => `${marker.item.title} · ${marker.item.currencies.join('/')} · ${marker.item.event_at ? utc(Date.parse(marker.item.event_at)) : `${marker.item.event_date} · hour unconfirmed`} · custom ${marker.item.status}`
      return <div className="external-chart-cluster" key={first.item.key} style={{ left: cluster.x }}>
        <button type="button" className="external-chart-star" title={cluster.markers.map(description).join('\n')}
          aria-label={multiple ? `${cluster.markers.length} nearby custom events` : `Open custom event ${description(first)}`}
          aria-expanded={multiple ? expanded === first.item.key : undefined} onClick={() => {
            if (multiple) setExpanded(key => key === first.item.key ? null : first.item.key)
            else { setExpanded(null); onSelect(first.item.key) }
          }}><span aria-hidden="true">★</span>{multiple && <sup>{cluster.markers.length}</sup>}</button>
        {multiple && expanded === first.item.key && <div className="external-chart-popup" style={{ left: cluster.x > chartApi.timeScale().width() / 2 ? -270 : 0 }}>
          <button type="button" onClick={() => setExpanded(null)}>Close</button>
          {cluster.markers.map(marker => <button type="button" key={marker.item.key} onClick={() => { setExpanded(null); onSelect(marker.item.key) }}>{description(marker)}</button>)}
        </div>}
      </div>
    })}
  </div>
})
