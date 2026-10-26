import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { IChartApi, IPriceLine, ISeriesApi, Time } from 'lightweight-charts'
import { useDrawingViewport } from '../market-data/chart-drawings/useDrawingViewport'
import { useDrawingCrosshair } from '../market-data/chart-drawings/useDrawingCrosshair'
import type { PriceAlert } from './price-alert-store'
import './price-alert-handles.css'

type Drag = { id: string; original: number; status: PriceAlert['status']; precision: number; price: number
  startClientY: number; clientY: number; startY: number; pointerId: number; element: SVGSVGElement }

export function PriceAlertHandles({ chartApi, seriesApi, alerts, lines, onPriceChange, onDragChange }: {
  chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time>; alerts: PriceAlert[]
  lines: RefObject<Map<string, IPriceLine>>; onPriceChange: (id: string, price: number) => void
  onDragChange: (id: string | null) => void
}) {
  const overlay = useRef<SVGSVGElement>(null)
  const viewport = useDrawingViewport(chartApi, seriesApi, overlay)
  const crosshair = useDrawingCrosshair(chartApi)
  const drag = useRef<Drag | null>(null)
  const frame = useRef<number | null>(null)
  const [preview, setPreview] = useState<{ id: string; price: number } | null>(null)
  const cancel = useCallback((render = true, restore = true) => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    const current = drag.current
    drag.current = null
    if (current) {
      if (restore) lines.current.get(current.id)?.applyOptions({ price: current.original })
      if (current.element.hasPointerCapture?.(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
      onDragChange(null)
    }
    if (render) setPreview(null)
  }, [lines, onDragChange])
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag.current) { event.preventDefault(); cancel() } }
    const blur = () => cancel()
    window.addEventListener('keydown', key); window.addEventListener('blur', blur)
    return () => { cancel(false); window.removeEventListener('keydown', key); window.removeEventListener('blur', blur) }
  }, [cancel])
  useEffect(() => {
    const current = drag.current
    if (!current) return
    const alert = alerts.find(item => item.id === current.id)
    if (!alert || alert.price !== current.original || alert.status !== current.status) cancel(true, false)
    else lines.current.get(current.id)?.applyOptions({ price: current.price })
  }, [alerts, cancel, lines])
  const priceAt = () => {
    const current = drag.current
    if (!current) return null
    const y = Math.max(0, Math.min(viewport.height, current.startY + current.clientY - current.startClientY))
    const price = seriesApi.coordinateToPrice(y)
    if (price == null || !Number.isFinite(price) || price <= 0) return null
    const rounded = Number(price.toFixed(current.precision))
    return rounded > 0 ? rounded : null
  }
  const paint = () => {
    frame.current = null
    const current = drag.current, price = priceAt()
    if (!current || price == null) return
    current.price = price
    lines.current.get(current.id)?.applyOptions({ price })
    setPreview({ id: current.id, price })
  }
  const move = (event: PointerEvent<SVGSVGElement>) => {
    crosshair.move(event)
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    drag.current.clientY = event.clientY
    if (frame.current === null) frame.current = window.requestAnimationFrame(paint)
  }
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    current.clientY = event.clientY
    const price = priceAt()
    // Commit the dropped level before resuming this alert's quote checks.
    if (price != null && price !== current.original && current.clientY !== current.startClientY) onPriceChange(current.id, price)
    cancel()
  }
  return <svg ref={overlay} className="price-alert-handles" width={viewport.width} height={viewport.height}
    onPointerMove={move} onPointerLeave={crosshair.leave} onPointerUp={finish}
    onPointerCancel={() => cancel()} onLostPointerCapture={() => cancel()}>
    {alerts.map(alert => {
      const price = preview?.id === alert.id ? preview.price : alert.price
      const y = seriesApi.priceToCoordinate(price)
      if (y == null || y < 0 || y > viewport.height) return null
      return <line key={alert.id} className="price-alert-handle" data-price-alert-id={alert.id} x1={0} x2={viewport.width} y1={y} y2={y}
        role="slider" tabIndex={0} aria-label={`Drag ${alert.name || alert.symbol} alert price`} aria-valuenow={price} aria-valuemin={10 ** -alert.precision}
        onPointerDown={event => {
          if (event.button !== 0 || !overlay.current) return
          event.preventDefault(); event.stopPropagation(); cancel()
          drag.current = { id: alert.id, original: alert.price, status: alert.status, precision: alert.precision, price: alert.price,
            startClientY: event.clientY, clientY: event.clientY, startY: y, pointerId: event.pointerId, element: overlay.current }
          overlay.current.setPointerCapture?.(event.pointerId)
          onDragChange(alert.id)
        }}
        onKeyDown={event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault(); event.stopPropagation()
          const next = Number((alert.price + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1) * 10 ** -alert.precision).toFixed(alert.precision))
          if (next > 0) onPriceChange(alert.id, next)
        }}><title>Drag vertically to change price. Escape cancels. Arrow keys fine-tune.</title></line>
    })}
  </svg>
}
