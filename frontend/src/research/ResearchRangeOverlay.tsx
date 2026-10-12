import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import { drawingCoordinates } from '../market-data/chart-drawings/drawing-coordinates'
import { useDrawingViewport } from '../market-data/chart-drawings/useDrawingViewport'
import './research.css'

export function ResearchRangeOverlay({ chartApi, seriesApi, bars, timeframe, onSelect, onCancel }: {
  chartApi: IChartApi; seriesApi: ISeriesApi<'Candlestick', Time>; bars: OhlcBar[]; timeframe: ChartTimeframe
  onSelect: (from: number, to: number) => void; onCancel: () => void
}) {
  const overlay = useRef<SVGSVGElement>(null), start = useRef<{ x: number; time: number; pointerId: number } | null>(null)
  const frame = useRef<number | null>(null), latestX = useRef(0)
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null)
  const viewport = useDrawingViewport(chartApi, seriesApi, overlay)
  const coordinates = drawingCoordinates(chartApi, seriesApi, bars, timeframe)
  useEffect(() => {
    const node = overlay.current
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('keydown', escape)
      if (frame.current !== null) window.cancelAnimationFrame(frame.current)
      if (start.current) { try { node?.releasePointerCapture(start.current.pointerId) } catch { /* Capture may already have ended. */ } }
      start.current = null
    }
  }, [onCancel])
  const xAt = (event: PointerEvent<SVGSVGElement>) => Math.max(0, Math.min(viewport.width, event.clientX - event.currentTarget.getBoundingClientRect().left))
  const timeAt = (x: number) => { const logical = coordinates.xToLogical(x); return logical === null ? null : coordinates.logicalToTime(logical) }
  return <>
    <svg ref={overlay} className="research-range-overlay" aria-label="Select research date range"
      onPointerDown={event => {
        if (event.button !== 0 || !viewport.width || !bars.length) return
        event.preventDefault(); event.stopPropagation()
        const x = xAt(event), time = timeAt(x)
        if (time === null) return
        start.current = { x, time, pointerId: event.pointerId }; latestX.current = x
        event.currentTarget.setPointerCapture(event.pointerId); setSelection({ from: x, to: x })
      }}
      onPointerMove={event => {
        if (!start.current || event.pointerId !== start.current.pointerId) return
        latestX.current = xAt(event)
        if (frame.current === null) frame.current = window.requestAnimationFrame(() => {
          frame.current = null
          if (start.current) setSelection({ from: start.current.x, to: latestX.current })
        })
      }}
      onPointerUp={event => {
        const anchor = start.current
        if (!anchor || event.pointerId !== anchor.pointerId) return
        const x = xAt(event), time = timeAt(x)
        start.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        if (frame.current !== null) { window.cancelAnimationFrame(frame.current); frame.current = null }
        if (time !== null) onSelect(anchor.time, time)
      }}
      onPointerCancel={event => {
        const anchor = start.current; start.current = null; setSelection(null)
        if (frame.current !== null) { window.cancelAnimationFrame(frame.current); frame.current = null }
        if (anchor) { try { event.currentTarget.releasePointerCapture(anchor.pointerId) } catch { /* Capture may already have ended. */ } }
      }}
      onLostPointerCapture={() => { start.current = null; setSelection(null) }}>
      {selection && <rect x={Math.min(selection.from, selection.to)} y={0} width={Math.abs(selection.to - selection.from)} height={viewport.height} />}
    </svg>
    <div className="research-range-hint">Drag across the dates to research.<button type="button" onClick={onCancel}>Cancel</button></div>
  </>
}
