import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { IChartApi, IPriceLine, ISeriesApi, Time } from 'lightweight-charts'
import { useDrawingViewport } from '../../market-data/chart-drawings/useDrawingViewport'
import { drawingCoordinates } from '../../market-data/chart-drawings/drawing-coordinates'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import type { PlannedTradeState, RegisteredTradeArrow, TradePriceField } from '../contracts/entry-trade-types'
import './trade-level-handles.css'

const fields = [['entryPrice', 'Entry'], ['tpPrice', 'Take Profit'], ['slPrice', 'Stop Loss']] as const
type Props = {
  chartApi: IChartApi
  seriesApi: ISeriesApi<'Candlestick', Time>
  plan: Pick<PlannedTradeState, 'entryPrice' | 'tpPrice' | 'slPrice'> | null
  arrows: RegisteredTradeArrow[]
  bars: OhlcBar[]
  timeframe: ChartTimeframe
  precision: number
  lines: RefObject<Partial<Record<TradePriceField, IPriceLine>>>
  onPriceChange: (field: TradePriceField, price: number) => void
  onTimeChange: (id: string, time: number) => void
  previewTime: (id: string, time: number | null) => void
}

export function TradeLevelHandles({ chartApi, seriesApi, plan, arrows, bars, timeframe, precision, lines, onPriceChange, onTimeChange, previewTime }: Props) {
  const overlayRef = useRef<SVGSVGElement>(null)
  const viewport = useDrawingViewport(chartApi, seriesApi, overlayRef)
  const drag = useRef<{ field: TradePriceField | 'time'; arrowId?: string; element: SVGSVGElement; pointerId: number; startClientY: number; startY: number; original: number; clientY: number } | null>(null)
  const frame = useRef<number | null>(null)
  const [preview, setPreview] = useState<{ field: TradePriceField | 'time'; arrowId?: string; price: number } | null>(null)
  const coordinates = drawingCoordinates(chartApi, seriesApi, bars, timeframe)
  const firstBarTime = bars[0]?.time

  const priceAt = () => {
    const current = drag.current
    if (!current) return null
    if (current.field === 'time') {
      const logical = coordinates.xToLogical(current.startY + current.clientY - current.startClientY)
      if (logical == null || !Number.isFinite(logical) || !bars.length) return null
      return bars[Math.max(0, Math.min(bars.length - 1, Math.round(logical)))].time
    }
    const y = Math.max(0, Math.min(viewport.height, current.startY + current.clientY - current.startClientY))
    const price = seriesApi.coordinateToPrice(y)
    return price != null && Number.isFinite(price) && price > 0 ? Number(price.toFixed(precision)) : null
  }
  const paint = () => {
    frame.current = null
    const current = drag.current, price = priceAt()
    if (!current || price == null) return
    if (current.field === 'time') previewTime(current.arrowId!, price)
    else lines.current[current.field]?.applyOptions({ price })
    setPreview({ field: current.field, arrowId: current.arrowId, price })
  }
  const cancel = useCallback((render = true) => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    const current = drag.current
    drag.current = null
    if (current) {
      if (current.field === 'time') previewTime(current.arrowId!, null)
      else lines.current[current.field]?.applyOptions({ price: current.original })
      const overlay = current.element
      if (overlay?.hasPointerCapture(current.pointerId)) overlay.releasePointerCapture(current.pointerId)
    }
    if (render) setPreview(null)
  }, [lines, previewTime])
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag.current) { event.preventDefault(); cancel() } }
    const blur = () => cancel()
    window.addEventListener('keydown', key); window.addEventListener('blur', blur)
    return () => { cancel(false); window.removeEventListener('keydown', key); window.removeEventListener('blur', blur) }
  }, [cancel, seriesApi, plan?.entryPrice, plan?.tpPrice, plan?.slPrice, precision, arrows, bars.length, firstBarTime])

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    drag.current.clientY = drag.current.field === 'time' ? event.clientX : event.clientY
    if (frame.current === null) frame.current = window.requestAnimationFrame(paint)
  }
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    current.clientY = current.field === 'time' ? event.clientX : event.clientY
    const price = priceAt()
    cancel()
    if (current.clientY !== current.startClientY && price != null && price !== current.original) {
      if (current.field === 'time') onTimeChange(current.arrowId!, price)
      else onPriceChange(current.field, price)
    } else if (current.field === 'time') onTimeChange(current.arrowId!, current.original)
  }
  return <svg ref={overlayRef} className="trade-level-handles" width={viewport.width} height={viewport.height}
    onPointerMove={move} onPointerUp={finish} onPointerCancel={() => cancel()} onLostPointerCapture={() => cancel()}>
    {fields.map(([field, label]) => {
      const price = preview?.field === field ? preview.price : plan?.[field]
      const y = price != null ? seriesApi.priceToCoordinate(price) : null
      if (price == null || price <= 0 || y == null || y < 0 || y > viewport.height) return null
      return <line key={field} className="trade-level-handle" x1={0} x2={viewport.width} y1={y} y2={y}
        role="slider" tabIndex={0} aria-label={`Drag ${label} price`} aria-valuenow={price} aria-valuemin={0}
        onPointerDown={event => {
          if (event.button !== 0 || !overlayRef.current) return
          event.preventDefault(); event.stopPropagation()
          cancel()
          drag.current = { field, element: overlayRef.current, pointerId: event.pointerId, startClientY: event.clientY, startY: y, original: price, clientY: event.clientY }
          overlayRef.current?.setPointerCapture(event.pointerId)
        }}
        onKeyDown={event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault(); event.stopPropagation()
          onPriceChange(field, Number((price + (event.key === 'ArrowUp' ? 1 : -1) * 10 ** -precision).toFixed(precision)))
        }} />
    })}
    {arrows.map(arrow => {
      const time = preview?.field === 'time' && preview.arrowId === arrow.id ? preview.price : arrow.time
      const x = coordinates.timeToX(time as OhlcBar['time'])
      if (x == null || x < 0 || x > viewport.width) return null
      const y = seriesApi.priceToCoordinate(arrow.entryPrice)
      if (y == null || y < 0 || y > viewport.height) return null
      const offset = arrow.direction === 'long' ? 7 : arrow.direction === 'short' ? -7 : 0
      return <rect key={arrow.id} className="trade-arrow-handle" x={x - 9} y={y + offset - 9} width={18} height={18}
        data-arrow-id={arrow.id} role="slider" tabIndex={0} aria-label={`Drag ${arrow.symbol} arrow date`}
        aria-valuenow={time} aria-valuemin={bars[0]?.time} aria-valuemax={bars.at(-1)?.time}
        onPointerDown={event => {
          if (event.button !== 0 || !overlayRef.current) return
          event.preventDefault(); event.stopPropagation(); cancel()
          drag.current = { field: 'time', arrowId: arrow.id, element: overlayRef.current, pointerId: event.pointerId,
            startClientY: event.clientX, startY: x, original: arrow.time, clientY: event.clientX }
          overlayRef.current.setPointerCapture(event.pointerId)
        }}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault(); event.stopPropagation()
          const logical = coordinates.timeToLogical(arrow.time)
          if (logical == null || !bars.length) return
          const index = Math.max(0, Math.min(bars.length - 1, Math.round(logical) + (event.key === 'ArrowRight' ? 1 : -1)))
          onTimeChange(arrow.id, bars[index].time)
        }} />
    })}
  </svg>
}
