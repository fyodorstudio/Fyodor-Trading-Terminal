import { useEffect, useRef } from 'react'
import {
  createSeriesMarkers,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type ISeriesApi,
  type ISeriesPrimitive,
  type MouseEventParams,
  type PrimitiveHoveredItem,
  type PrimitivePaneViewZOrder,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { PlannedTradeState, RegisteredTradeArrow } from '../contracts/trader-notebook-types'

export type ResearchChartArrow = { id: string; time: number; direction: 'long' | 'short'; entryPrice: number;
  contextOnly?: boolean; isStar?: boolean }
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

function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes = 5,
  outerRadius = 7,
  innerRadius = 3.2,
) {
  let rot = (Math.PI / 2) * 3
  const step = Math.PI / spikes

  ctx.beginPath()
  ctx.moveTo(cx, cy - outerRadius)
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerRadius
    let y = cy + Math.sin(rot) * outerRadius
    ctx.lineTo(x, y)
    rot += step

    x = cx + Math.cos(rot) * innerRadius
    y = cy + Math.sin(rot) * innerRadius
    ctx.lineTo(x, y)
    rot += step
  }
  ctx.lineTo(cx, cy - outerRadius)
  ctx.closePath()
}

type PrimitiveTarget = Parameters<IPrimitivePaneRenderer['draw']>[0]

class StarMarkersRenderer implements IPrimitivePaneRenderer {
  private _getMarkers: () => ResearchChartArrow[]
  private _getSelectedId: () => string | null
  private _chart: IChartApi
  private _series: ISeriesApi<'Candlestick', Time>

  constructor(
    getMarkers: () => ResearchChartArrow[],
    getSelectedId: () => string | null,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
  ) {
    this._getMarkers = getMarkers
    this._getSelectedId = getSelectedId
    this._chart = chart
    this._series = series
  }

  draw(target: PrimitiveTarget): void {
    const markers = this._getMarkers()
    if (!markers.length) return
    const selectedId = this._getSelectedId()
    const timeScale = this._chart.timeScale()

    target.useMediaCoordinateSpace((scope: { context: CanvasRenderingContext2D }) => {
      const ctx = scope.context
      for (const marker of markers) {
        const x = timeScale.timeToCoordinate(marker.time as Time)
        if (x == null) continue
        const y = this._series.priceToCoordinate(marker.entryPrice)
        if (y == null) continue

        const isSelected = marker.id === selectedId
        const outerRadius = isSelected ? 10 : 7
        const innerRadius = isSelected ? 4.5 : 3.0

        ctx.save()
        drawFivePointStar(ctx, x, y, 5, outerRadius, innerRadius)
        ctx.fillStyle = isSelected ? '#38bdf8' : '#f59e0b'
        ctx.fill()
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = 1.3
        ctx.stroke()
        ctx.restore()
      }
    })
  }
}

class StarMarkersPaneView implements IPrimitivePaneView {
  private _renderer: StarMarkersRenderer

  constructor(
    getMarkers: () => ResearchChartArrow[],
    getSelectedId: () => string | null,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
  ) {
    this._renderer = new StarMarkersRenderer(getMarkers, getSelectedId, chart, series)
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'top'
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer
  }
}

class StarMarkersPrimitive implements ISeriesPrimitive<Time> {
  private _markers: ResearchChartArrow[]
  private _selectedId: string | null
  private _chart: IChartApi
  private _series: ISeriesApi<'Candlestick', Time>
  private _paneView: StarMarkersPaneView
  private _requestUpdate?: () => void

  constructor(
    markers: ResearchChartArrow[],
    selectedId: string | null,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick', Time>,
  ) {
    this._markers = markers
    this._selectedId = selectedId
    this._chart = chart
    this._series = series
    this._paneView = new StarMarkersPaneView(
      () => this._markers,
      () => this._selectedId,
      chart,
      series,
    )
  }

  setMarkers(markers: ResearchChartArrow[], selectedId: string | null): void {
    this._markers = markers
    this._selectedId = selectedId
    this._requestUpdate?.()
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._requestUpdate = param.requestUpdate
  }

  detached(): void {
    this._requestUpdate = undefined
  }

  update(): void {
    this._requestUpdate?.()
  }

  updateAllViews(): void {
    this._requestUpdate?.()
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView]
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    if (!this._markers.length) return null
    const timeScale = this._chart.timeScale()

    for (const marker of this._markers) {
      const cx = timeScale.timeToCoordinate(marker.time as Time)
      if (cx == null) continue
      const cy = this._series.priceToCoordinate(marker.entryPrice)
      if (cy == null) continue

      const dist = Math.hypot(cx - x, cy - y)
      if (dist <= 14) {
        return {
          cursorStyle: 'pointer',
          externalId: marker.id,
          zOrder: 'top',
        }
      }
    }
    return null
  }
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
  const starArrows = researchArrows.filter((a) => a.isStar === true)
  const regularResearchArrows = researchArrows.filter((a) => !a.isStar)

  const starPrimitiveRef = useRef<StarMarkersPrimitive | null>(null)

  // Render True 5-Point Stars via custom ISeriesPrimitive
  useEffect(() => {
    if (starArrows.length === 0) {
      if (starPrimitiveRef.current) {
        seriesApi.detachPrimitive(starPrimitiveRef.current)
        starPrimitiveRef.current = null
      }
      return
    }

    if (!starPrimitiveRef.current) {
      const primitive = new StarMarkersPrimitive(
        starArrows,
        selectedResearchArrowId,
        chartApi,
        seriesApi,
      )
      seriesApi.attachPrimitive(primitive)
      starPrimitiveRef.current = primitive
    } else {
      starPrimitiveRef.current.setMarkers(starArrows, selectedResearchArrowId)
    }

    return () => {
      if (starPrimitiveRef.current) {
        seriesApi.detachPrimitive(starPrimitiveRef.current)
        starPrimitiveRef.current = null
      }
    }
  }, [chartApi, seriesApi, starArrows, selectedResearchArrowId])

  // 1. Render Registered Arrow Markers on the Candlestick Chart (arrows + regular research arrows)
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
    for (const arrow of regularResearchArrows) {
      const selected = arrow.id === selectedResearchArrowId
      markers.push({
        id: arrow.id,
        time: arrow.time as Time,
        price: arrow.entryPrice,
        position: arrow.direction === 'long' ? 'atPriceBottom' : 'atPriceTop',
        shape: arrow.direction === 'long' ? 'arrowUp' : 'arrowDown',
        color: arrow.contextOnly ? '#7c3aed' : selected ? '#38bdf8' : arrow.direction === 'long' ? '#10b981' : '#f43f5e',
        text: arrow.contextOnly ? 'YOY CONTEXT ONLY' : selected ? 'HISTORICAL AUDIT' : 'RESEARCH',
        size: selected ? 1.25 : 0.85,
      })
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time))

    const markerApi = createSeriesMarkers(seriesApi, markers, { zOrder: 'top' })
    return () => markerApi.detach()
  }, [arrows, regularResearchArrows, selectedArrowId, selectedResearchArrowId, seriesApi])

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
