import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  createSeriesMarkers,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import { hasArrowCandle } from './arrow-time'
import { TradeLevelHandles } from './TradeLevelHandles'
import type { PlannedTradeState, RegisteredTradeArrow, TradePriceField } from '../contracts/entry-trade-types'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'

type PlannedTradePriceLinesProps = {
  chartApi: IChartApi
  seriesApi: ISeriesApi<'Candlestick', Time>
  arrows: RegisteredTradeArrow[]
  selectedArrowId: string | null
  draftPlan: PlannedTradeState
  onSelectArrow: (arrow: RegisteredTradeArrow) => void
  onPriceChange: (field: TradePriceField, price: number) => void
  precision: number
  dragEnabled: boolean
  scopeKey: string
  bars: OhlcBar[]
  timeframe: ChartTimeframe
  onTimeChange: (id: string, time: number) => void
}

export function PlannedTradePriceLines({
  chartApi,
  seriesApi,
  arrows,
  selectedArrowId,
  draftPlan,
  onSelectArrow, onPriceChange, precision, dragEnabled, scopeKey, bars, timeframe, onTimeChange,
}: PlannedTradePriceLinesProps) {
  const lines = useRef<Partial<Record<TradePriceField, IPriceLine>>>({})
  const markerApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const markersRef = useRef<SeriesMarker<Time>[]>([])
  const barsRef = useRef(bars)
  useLayoutEffect(() => { barsRef.current = bars }, [bars])
  const firstBarTime = bars[0]?.time, lastBarTime = bars.at(-1)?.time
  const previewTime = useCallback((id: string, time: number | null) => {
    const markers = time === null ? markersRef.current : markersRef.current.map(marker => marker.id === id ? { ...marker, time: time as Time } : marker)
    markerApiRef.current?.setMarkers(markers.filter(marker => hasArrowCandle(Number(marker.time), barsRef.current)).sort((a, b) => Number(a.time) - Number(b.time)))
  }, [])
  const selectedArrow = arrows.find(arrow => arrow.id === selectedArrowId)
  const visible = Boolean(selectedArrow || draftPlan.showOnChart)
  const plan = selectedArrow ?? draftPlan
  const { direction, entryPrice, tpPrice, slPrice } = plan
  const prefix = selectedArrow?.rrRatio != null ? `[${selectedArrow.rrRatio.toFixed(2)}R] ` : '[PLAN] '
  // 1. Render Registered Arrow Markers on the Candlestick Chart
  useEffect(() => {
    const markers: SeriesMarker<Time>[] = arrows.filter(arrow => arrow.entryPrice != null && Number.isFinite(arrow.entryPrice) && arrow.entryPrice > 0 && arrow.time > 0).map((arrow) => {
      const isSelected = arrow.id === selectedArrowId
      const isLong = arrow.direction === 'long'
      const waiting = arrow.direction === 'waiting'
      return {
        id: arrow.id,
        time: arrow.time as Time,
        price: arrow.entryPrice!,
        position: waiting ? 'atPriceMiddle' : isLong ? 'atPriceBottom' : 'atPriceTop',
        shape: waiting ? 'square' : isLong ? 'arrowUp' : 'arrowDown',
        color: isSelected ? '#38bdf8' : waiting ? '#f59e0b' : isLong ? '#10b981' : '#f43f5e',
        text: isSelected
          ? `★ ${waiting ? 'WAITING' : isLong ? 'LONG' : 'SHORT'} (${arrow.rrRatio == null ? 'Levels unset' : `${arrow.rrRatio.toFixed(2)}R`})`
          : `${waiting ? 'WAITING' : isLong ? '↑' : '↓'} ${arrow.rrRatio == null ? '' : `${arrow.rrRatio.toFixed(1)}R`}`,
        size: isSelected ? 1.25 : 0.85,
      }
    })
    markers.sort((a, b) => Number(a.time) - Number(b.time))

    const markerApi = createSeriesMarkers(seriesApi, markers.filter(marker => hasArrowCandle(Number(marker.time), barsRef.current)), { zOrder: 'top' })
    markerApiRef.current = markerApi; markersRef.current = markers
    return () => { markerApiRef.current = null; markerApi.detach() }
  }, [arrows, selectedArrowId, seriesApi, bars.length, firstBarTime, lastBarTime])

  // 2. Handle click on marker to select arrow
  useEffect(() => {
    const handleClick = (param: MouseEventParams<Time>) => {
      const objectId = param.hoveredInfo?.objectId ?? param.hoveredObjectId
      if (typeof objectId !== 'string') return
      const arrow = arrows.find((a) => a.id === objectId)
      if (arrow) onSelectArrow(arrow)
    }
    chartApi.subscribeClick(handleClick)
    return () => chartApi.unsubscribeClick(handleClick)
  }, [arrows, chartApi, onSelectArrow])

  useEffect(() => {
    if (!visible) return
    const values = [
      ['entryPrice', entryPrice, '#0284c7', `ENTRY (${direction.toUpperCase()})`, 1, LineStyle.Dotted],
      ['tpPrice', tpPrice, '#10b981', 'TP', 2, LineStyle.Dashed],
      ['slPrice', slPrice, '#e11d48', 'SL', 2, LineStyle.Dashed],
    ] as const
    for (const [field, price, color, label, lineWidth, lineStyle] of values) {
      if (price == null || !Number.isFinite(price) || price <= 0) continue
      lines.current[field] = seriesApi.createPriceLine({ price, color, lineWidth, lineStyle,
        lineVisible: true, axisLabelVisible: true, title: `${prefix}${label}: ${price.toFixed(precision)}` })
    }
    return () => {
      for (const line of Object.values(lines.current)) seriesApi.removePriceLine(line)
      lines.current = {}
    }
  }, [visible, direction, entryPrice, tpPrice, slPrice, prefix, precision, seriesApi])

  return (visible || arrows.length > 0) ? <TradeLevelHandles key={`${scopeKey}:${selectedArrowId ?? 'draft'}`}
    chartApi={chartApi} seriesApi={seriesApi} dragEnabled={dragEnabled} selectedArrowId={selectedArrowId} plan={visible ? plan : null} precision={precision} lines={lines}
    arrows={arrows} bars={bars} timeframe={timeframe} onPriceChange={onPriceChange} onTimeChange={onTimeChange} previewTime={previewTime} /> : null
}
