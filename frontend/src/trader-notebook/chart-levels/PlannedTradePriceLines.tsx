import { useEffect } from 'react'
import {
  createSeriesMarkers,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { PlannedTradeState, RegisteredTradeArrow } from '../contracts/trader-notebook-types'

export type ResearchChartArrow = { id: string; time: number; direction: 'long' | 'short'; entryPrice: number }
export type ResearchChartLevels = { entry: number; stop: number; target: number; direction: number }

type PlannedTradePriceLinesProps = {
  chartApi: IChartApi
  seriesApi: ISeriesApi<'Candlestick', Time>
  arrows: RegisteredTradeArrow[]
  selectedArrowId: string | null
  draftPlan: PlannedTradeState
  onSelectArrow: (arrow: RegisteredTradeArrow) => void
  researchArrows?: ResearchChartArrow[]
  selectedResearchArrowId?: string | null
  onSelectResearchArrow?: (arrow: ResearchChartArrow) => void
  researchLevels?: ResearchChartLevels | null
}

export function PlannedTradePriceLines({
  chartApi,
  seriesApi,
  arrows,
  selectedArrowId,
  draftPlan,
  onSelectArrow,
  researchArrows = [],
  selectedResearchArrowId = null,
  onSelectResearchArrow,
  researchLevels = null,
}: PlannedTradePriceLinesProps) {
  // 1. Render Registered Arrow Markers on the Candlestick Chart
  useEffect(() => {
    const markers: SeriesMarker<Time>[] = arrows.map((arrow) => {
      const isSelected = arrow.id === selectedArrowId
      const isLong = arrow.direction === 'long'
      return {
        id: arrow.id,
        time: arrow.time as Time,
        price: arrow.entryPrice,
        position: isLong ? 'atPriceBottom' : 'atPriceTop',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        color: isSelected ? '#38bdf8' : isLong ? '#10b981' : '#f43f5e',
        text: isSelected
          ? `★ ${isLong ? 'LONG' : 'SHORT'} (${arrow.rrRatio.toFixed(2)}R)`
          : `${isLong ? '↑' : '↓'} ${arrow.rrRatio.toFixed(1)}R`,
        size: isSelected ? 1.25 : 0.85,
      }
    })
    for (const arrow of researchArrows) {
      const selected = arrow.id === selectedResearchArrowId
      markers.push({
        id: arrow.id,
        time: arrow.time as Time,
        price: arrow.entryPrice,
        position: arrow.direction === 'long' ? 'atPriceBottom' : 'atPriceTop',
        shape: arrow.direction === 'long' ? 'arrowUp' : 'arrowDown',
        color: selected ? '#38bdf8' : arrow.direction === 'long' ? '#10b981' : '#f43f5e',
        text: selected ? 'HISTORICAL AUDIT' : 'RESEARCH',
        size: selected ? 1.25 : 0.85,
      })
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time))

    const markerApi = createSeriesMarkers(seriesApi, markers, { zOrder: 'top' })
    return () => markerApi.detach()
  }, [arrows, researchArrows, selectedArrowId, selectedResearchArrowId, seriesApi])

  // 2. Handle click on marker to select arrow
  useEffect(() => {
    const handleClick = (param: MouseEventParams<Time>) => {
      const objectId = param.hoveredInfo?.objectId ?? param.hoveredObjectId
      if (typeof objectId !== 'string') return
      const arrow = arrows.find((a) => a.id === objectId)
      if (arrow) onSelectArrow(arrow)
      const researchArrow = researchArrows.find((a) => a.id === objectId)
      if (researchArrow) onSelectResearchArrow?.(researchArrow)
    }
    chartApi.subscribeClick(handleClick)
    return () => chartApi.unsubscribeClick(handleClick)
  }, [arrows, chartApi, onSelectArrow, researchArrows, onSelectResearchArrow])

  // 3. Render Horizontal Lines (Entry, TP, SL)
  useEffect(() => {
    const selectedArrow = selectedArrowId ? arrows.find((a) => a.id === selectedArrowId) : null

    // Determine target prices to render
    let direction: 'long' | 'short' = 'long'
    let entryPrice: number | null = null
    let tpPrice: number | null = null
    let slPrice: number | null = null
    let labelPrefix = ''

    if (researchLevels) {
      direction = researchLevels.direction > 0 ? 'long' : 'short'
      entryPrice = researchLevels.entry
      tpPrice = researchLevels.target
      slPrice = researchLevels.stop
      labelPrefix = 'AUDIT '
    } else if (selectedArrow) {
      direction = selectedArrow.direction
      entryPrice = selectedArrow.entryPrice
      tpPrice = selectedArrow.tpPrice
      slPrice = selectedArrow.slPrice
      labelPrefix = `[${selectedArrow.rrRatio.toFixed(2)}R] `
    } else if (draftPlan.showOnChart) {
      direction = draftPlan.direction
      entryPrice = draftPlan.entryPrice
      tpPrice = draftPlan.tpPrice
      slPrice = draftPlan.slPrice
      labelPrefix = '[PLAN] '
    } else {
      return
    }

    const lines: IPriceLine[] = []

    // A. Entry Price Line
    if (entryPrice != null && !Number.isNaN(entryPrice) && entryPrice > 0) {
      lines.push(
        seriesApi.createPriceLine({
          price: entryPrice,
          color: '#0284c7',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          lineVisible: true,
          axisLabelVisible: true,
          title: `${labelPrefix}ENTRY (${direction.toUpperCase()}): ${entryPrice.toFixed(5)}`,
        }),
      )
    }

    // B. Take Profit Line
    if (tpPrice != null && !Number.isNaN(tpPrice) && tpPrice > 0) {
      lines.push(
        seriesApi.createPriceLine({
          price: tpPrice,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: true,
          title: `${labelPrefix}TP${researchLevels ? ' (nominal)' : ''}: ${tpPrice.toFixed(5)}`,
        }),
      )
    }

    // C. Stop Loss Line
    if (slPrice != null && !Number.isNaN(slPrice) && slPrice > 0) {
      lines.push(
        seriesApi.createPriceLine({
          price: slPrice,
          color: '#e11d48',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          lineVisible: true,
          axisLabelVisible: true,
          title: `${labelPrefix}SL${researchLevels ? ' (nominal)' : ''}: ${slPrice.toFixed(5)}`,
        }),
      )
    }

    return () => {
      for (const line of lines) {
        try {
          seriesApi.removePriceLine(line)
        } catch {
          // ignore
        }
      }
    }
  }, [arrows, draftPlan, researchLevels, selectedArrowId, seriesApi])

  return null
}
