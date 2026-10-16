import { useLayoutEffect, useRef, useState } from 'react'
import type { ChartDrawingRecord } from './chart-drawing-record'
import type { ChartDrawingScreenPoint } from './chart-drawing-screen-point'

function DrawingTag({ text, x, y, note = false, centered = false, width, height }: {
  text: string; x: number; y: number; note?: boolean; centered?: boolean; width?: number; height?: number
}) {
  const textRef = useRef<SVGTextElement>(null)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  useLayoutEffect(() => {
    setMeasuredWidth(textRef.current?.getComputedTextLength?.() ?? 0)
  }, [text])
  const textWidth = measuredWidth || text.length * 7
  const cardWidth = textWidth + 16
  const left = x - (centered ? cardWidth / 2 : 0)
  const labelX = width === undefined ? left : Math.max(2, Math.min(left, width - cardWidth - 2))
  const labelY = height === undefined ? y : Math.max(2, Math.min(y, height - 26))
  return <g className={note ? 'drawing-note-label' : 'drawing-range-measure'} transform={`translate(${labelX} ${labelY})`}>
    <rect className={note ? 'drawing-note-background' : 'drawing-range-background'} width={cardWidth} height="24" rx="4" />
    <text ref={textRef} className={note ? 'drawing-note' : 'drawing-range-label'} x="8" y="16">{text}</text>
  </g>
}

export function PriceNoteDrawing({ points, precision }: { points: ChartDrawingScreenPoint[]; precision: number }) {
  const first = points[0], last = points.at(-1)
  if (!first || !last) return null
  const price = last.price.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })
  return <g>
    <line className="drawing-hit-area" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
    <line className="drawing-stroke" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
    <DrawingTag text={price} x={last.x} y={last.y - 12} note />
    <circle className="drawing-note-dot" cx={last.x} cy={last.y} r="3" />
  </g>
}

export function DatePriceRangeDrawing({ drawing, points, precision, width, height }: {
  drawing: ChartDrawingRecord; points: ChartDrawingScreenPoint[]; precision: number; width: number; height: number
}) {
  const first = points[0], last = points.at(-1)
  const start = drawing.points[0], end = drawing.points.at(-1)
  if (!first || !last || !start || !end) return null
  const left = Math.min(first.x, last.x), right = Math.max(first.x, last.x)
  const top = Math.min(first.y, last.y), bottom = Math.max(first.y, last.y)
  if (right < 0 || left > width || bottom < 0 || top > height) return null
  // Measure elapsed timestamps, including session gaps, rather than candle count.
  const seconds = Math.abs(end.time - start.time)
  const minutes = Math.floor(seconds / 60)
  const duration = seconds > 0 && seconds < 60 ? '<1m' : `${Math.floor(minutes / 1440)}d ${Math.floor(minutes / 60) % 24}h ${minutes % 60}m`
  const symbol = drawing.symbol.toUpperCase()
  const pipSize = symbol.includes('XAU') ? 0.1 : symbol.includes('BTC') ? 1
    : symbol.includes('JPY') || precision === 3 || precision === 2 ? 0.01 : 0.0001
  const pips = `${(Math.abs(end.price - start.price) / pipSize).toFixed(1)} pips`
  return <g>
    <rect className="drawing-range" x={left} y={top} width={right - left} height={bottom - top} />
    <g className="drawing-range-duration">
      <title>Elapsed time</title>
      <DrawingTag text={duration} x={(Math.max(0, left) + Math.min(width, right)) / 2} y={bottom + 6} centered width={width} height={height} />
    </g>
    <g className="drawing-range-pips">
      <title>Price distance in pips</title>
      <DrawingTag text={pips} x={right + 6} y={(Math.max(0, top) + Math.min(height, bottom)) / 2 - 12} width={width} height={height} />
    </g>
  </g>
}
