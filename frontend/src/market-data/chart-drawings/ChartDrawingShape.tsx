import { useLayoutEffect, useRef, useState } from 'react'
import type { ChartDrawingRecord } from './chart-drawing-record'
import type { ChartDrawingScreenPoint } from './chart-drawing-screen-point'
import { parallelChannelCorners } from './parallel-channel-geometry'

type ChartDrawingShapeProps = {
  drawing: ChartDrawingRecord
  points: ChartDrawingScreenPoint[]
  width: number
  height: number
  precision?: number
}

function PositionLabel({ firstLine, secondLine, target, centerX, y, width }: {
  firstLine: string
  secondLine?: string
  target: boolean
  centerX: number
  y: number
  width: number
}) {
  const textRef = useRef<SVGGElement>(null)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  useLayoutEffect(() => {
    const lengths = [...(textRef.current?.querySelectorAll('text') ?? [])]
      .map(text => text.getComputedTextLength?.() ?? 0)
    setMeasuredWidth(Math.max(0, ...lengths))
  }, [firstLine, secondLine])
  const textWidth = measuredWidth || Math.max(firstLine.length, secondLine?.length ?? 0) * 6
  const cardWidth = Math.min(textWidth + 16, Math.max(2, width - 4))
  const x = Math.max(2, Math.min(centerX - cardWidth / 2, width - cardWidth - 2))
  const scale = Math.min(1, Math.max(1, cardWidth - 16) / textWidth)
  return (
    <g className="position-label" transform={`translate(${x} ${y})`}>
      <rect className={`position-label-background ${target ? 'target' : 'stop'}`} width={cardWidth} height={secondLine ? 38 : 20} rx="4" />
      <g ref={textRef}>
        <text className="position-label-text" textAnchor="middle" transform={`translate(${cardWidth / 2} ${secondLine ? 15 : 14}) scale(${scale})`}>{firstLine}</text>
        {secondLine && <text className="position-label-text" textAnchor="middle" transform={`translate(${cardWidth / 2} 29) scale(${scale})`}>{secondLine}</text>}
      </g>
    </g>
  )
}

function PositionDrawing({ points, width, height, precision = 5 }: Pick<ChartDrawingShapeProps, 'points' | 'width' | 'height' | 'precision'>) {
  const entry = points[0]
  const target = points[1]
  const stop = points[2]
  if (!entry || !target || !stop) return null

  const left = Math.min(entry.x, target.x)
  const right = Math.max(entry.x, target.x)
  const positionWidth = Math.max(2, right - left)
  const reward = Math.abs(target.price - entry.price)
  const risk = Math.max(Math.abs(entry.price - stop.price), Number.EPSILON)
  const rewardPercent = (reward / entry.price) * 100
  const riskPercent = (risk / entry.price) * 100

  const point = 10 ** -precision
  const isGold = entry.price > 500 || (precision === 2 && entry.price > 100)
  const pipSize = isGold
    ? 0.10
    : (precision === 5 || precision === 3)
      ? point * 10
      : point
  const rewardPips = reward / pipSize
  const riskPips = risk / pipSize
  const riskReward = reward / risk
  const targetTop = Math.min(target.y, entry.y)
  const targetHeight = Math.abs(entry.y - target.y)
  const stopTop = Math.min(stop.y, entry.y)
  const stopHeight = Math.abs(stop.y - entry.y)
  const boxTop = Math.min(target.y, stop.y, entry.y)
  const boxBottom = Math.max(target.y, stop.y, entry.y)
  const boxHeight = Math.max(2, boxBottom - boxTop)
  if (right < 0 || left > width || boxBottom < 0 || boxTop > height) return null
  const isTargetAbove = target.y <= entry.y
  const boxCenterX = (Math.max(0, left) + Math.min(width, right)) / 2
  const topCardY = Math.max(2, Math.min(boxTop - 40, height - 40))
  const bottomCardY = Math.max(2, Math.min(boxBottom + 2, height - 22))
  const targetText = `Target: ${reward.toFixed(precision)} (${rewardPercent.toFixed(3)}%) ${rewardPips.toFixed(1)} pips`
  const stopText = `Stop: ${risk.toFixed(precision)} (${riskPercent.toFixed(3)}%) ${riskPips.toFixed(1)} pips`

  return (
    <g>
      <rect className="position-target-area" x={left} y={targetTop} width={positionWidth} height={targetHeight} />
      <rect className="position-stop-area" x={left} y={stopTop} width={positionWidth} height={stopHeight} />
      <rect className="position-outline" x={left} y={boxTop} width={positionWidth} height={boxHeight} />
      <line className="position-entry-line" x1={left} y1={entry.y} x2={right} y2={entry.y} />

      <PositionLabel firstLine={isTargetAbove ? targetText : stopText}
        secondLine={`Open P&L: 0.00000, Qty: 1,000 · Risk/Reward: ${riskReward.toFixed(2)}`}
        target={isTargetAbove} centerX={boxCenterX} y={topCardY} width={width} />
      <PositionLabel firstLine={isTargetAbove ? stopText : targetText}
        target={!isTargetAbove} centerX={boxCenterX} y={bottomCardY} width={width} />
    </g>
  )
}

export function ChartDrawingShape({ drawing, points, width, height, precision = 5 }: ChartDrawingShapeProps) {
  const first = points[0]
  const last = points.at(-1) ?? first
  if (!first || !last) return null

  const left = Math.min(first.x, last.x)
  const top = Math.min(first.y, last.y)
  const shapeWidth = Math.abs(last.x - first.x)
  const shapeHeight = Math.abs(last.y - first.y)

  switch (drawing.tool) {
    case 'trend-line':
      return (
        <g>
          <line className="drawing-hit-area" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
          <line className="drawing-stroke" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
        </g>
      )
    case 'arrow': {
      const length = Math.hypot(last.x - first.x, last.y - first.y)
      const headLength = Math.min(12, length)
      const halfWidth = Math.min(5.5, headLength / 2)
      const ux = length ? (last.x - first.x) / length : 0
      const uy = length ? (last.y - first.y) / length : 0
      const baseX = last.x - ux * headLength
      const baseY = last.y - uy * headLength
      return (
        <g>
          <line className="drawing-hit-area" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
          <line className="drawing-stroke" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
          {length > 0 && <polygon className="drawing-arrow-head" points={`${last.x},${last.y} ${baseX - uy * halfWidth},${baseY + ux * halfWidth} ${baseX + uy * halfWidth},${baseY - ux * halfWidth}`} />}
        </g>
      )
    }
    case 'rectangle':
      return <rect className="drawing-stroke drawing-fill" x={left} y={top} width={shapeWidth} height={shapeHeight} />
    case 'circle':
      return <ellipse className="drawing-stroke drawing-fill" cx={(first.x + last.x) / 2} cy={(first.y + last.y) / 2} rx={shapeWidth / 2} ry={shapeHeight / 2} />
    case 'horizontal-line':
      return (
        <g>
          <line className="drawing-hit-area" x1={0} y1={first.y} x2={width} y2={first.y} />
          <line className="drawing-stroke" x1={0} y1={first.y} x2={width} y2={first.y} />
        </g>
      )
    case 'vertical-line':
      return (
        <g>
          <line className="drawing-hit-area" x1={first.x} y1={0} x2={first.x} y2={height} />
          <line className="drawing-stroke" x1={first.x} y1={0} x2={first.x} y2={height} />
        </g>
      )
    case 'parallel-channel': {
      const [start, end, oppositeStart, oppositeEnd] = parallelChannelCorners(points)
      if (!start || !end || !oppositeStart || !oppositeEnd) return null
      return (
        <g className="drawing-stroke">
          <polygon className="drawing-body-hit-area" points={[start, end, oppositeEnd, oppositeStart].map(point => `${point.x},${point.y}`).join(' ')} />
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          <line x1={oppositeStart.x} y1={oppositeStart.y} x2={oppositeEnd.x} y2={oppositeEnd.y} />
          <line x1={start.x} y1={start.y} x2={oppositeStart.x} y2={oppositeStart.y} />
          <line x1={end.x} y1={end.y} x2={oppositeEnd.x} y2={oppositeEnd.y} />
        </g>
      )
    }
    case 'path':
      return (
        <g>
          <polyline className="drawing-hit-area" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
          <polyline className="drawing-stroke" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
        </g>
      )
    case 'text':
      return (
        <g>
          <title>Double-click or select and press Enter to edit text</title>
          <rect
            x={first.x}
            y={first.y - 20}
            width={Math.max(50, ((drawing.text?.length ?? 4) + 1) * 9)}
            height={24}
            fill="transparent"
            className="drawing-body-hit-area"
          />
          <text className="drawing-text" x={first.x + 5} y={first.y - 6}>
            {drawing.text && drawing.text.trim() !== '' ? drawing.text : 'Text'}
          </text>
        </g>
      )
    case 'price-note':
      return (
        <g>
          <line className="drawing-hit-area" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
          <line className="drawing-stroke" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
          <rect className="drawing-body-hit-area" x={last.x - 12} y={last.y - 12} width={Math.max(60, last.price.toFixed(precision).length * 7 + 20)} height={24} />
          <circle className="drawing-note-dot" cx={last.x} cy={last.y} r={3} />
          <text className="drawing-note" x={last.x + 7} y={last.y + 4}>{last.price.toFixed(precision)}</text>
        </g>
      )
    case 'long-position':
    case 'short-position':
      return <PositionDrawing points={points} width={width} height={height} precision={precision} />
    case 'fib-retracement': {
      const ratios = [0, 0.236, 0.382, 0.5, 0.618, 1]
      return (
        <g>
          <rect className="drawing-body-hit-area" x={left} y={top} width={shapeWidth} height={shapeHeight} />
          {ratios.map((ratio) => {
            const y = first.y + (last.y - first.y) * ratio
            return (
              <g key={ratio}>
                <line className="drawing-fib-line" x1={left} y1={y} x2={left + shapeWidth} y2={y} />
                <text className="drawing-fib-label" x={left + 3} y={y - 3}>{ratio}</text>
              </g>
            )
          })}
        </g>
      )
    }
    case 'date-price-range':
      return (
        <g>
          <rect className="drawing-range" x={left} y={top} width={shapeWidth} height={shapeHeight} />
          <text className="drawing-range-label" x={left + 5} y={top + 14}>Δ {Math.abs(last.price - first.price).toFixed(5)}</text>
        </g>
      )
  }
}
