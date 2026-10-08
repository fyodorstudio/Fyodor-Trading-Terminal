import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { ChartDrawingRecord } from './chart-drawing-record'
import type { ChartDrawingScreenPoint } from './chart-drawing-screen-point'
import { parallelChannelCorners } from './parallel-channel-geometry'

export type DrawingHandleKind = 'point' | 'channel-corner' | 'position-price' | 'position-entry-price' | 'position-width' | 'position-move-all' | 'move-all'

type ChartDrawingSelectionHandlesProps = {
  drawing: ChartDrawingRecord
  screenPoints: ChartDrawingScreenPoint[]
  viewport: { width: number; height: number }
  onStartHandleEdit: (
    event: ReactPointerEvent<SVGElement>,
    drawingId: string,
    pointIndex: number,
    kind?: DrawingHandleKind,
  ) => void
}

function DrawingHandle({ cx, cy, style, onPointerDown, 'aria-label': label }: {
  cx: number; cy: number; style?: CSSProperties; 'aria-label'?: string
  onPointerDown: (event: ReactPointerEvent<SVGElement>) => void
}) {
  return <g style={style} onPointerDown={onPointerDown} aria-label={label}>
    <circle className="drawing-handle-hit-area" cx={cx} cy={cy} r="12" />
    <circle className="drawing-resize-handle" cx={cx} cy={cy} r="7" style={style} />
  </g>
}

function handlePoint(
  drawing: ChartDrawingRecord,
  point: ChartDrawingScreenPoint,
  _pointIndex: number,
  _screenPoints: ChartDrawingScreenPoint[],
  viewport: { width: number; height: number },
) {
  if (drawing.tool === 'horizontal-line') return { ...point, x: viewport.width / 2 }
  if (drawing.tool === 'vertical-line') return { ...point, y: viewport.height / 2 }
  return point
}

export function ChartDrawingSelectionHandles({
  drawing,
  screenPoints,
  viewport,
  onStartHandleEdit,
}: ChartDrawingSelectionHandlesProps) {
  const isPosition = drawing.tool === 'long-position' || drawing.tool === 'short-position'

  if (drawing.tool === 'parallel-channel') {
    return <>
      {parallelChannelCorners(screenPoints).map((point, index) => (
        <DrawingHandle
          key={`${drawing.id}-${index}`}
          cx={point.x}
          cy={point.y}
          style={{ cursor: index >= 2 ? 'ns-resize' : 'move' }}
          aria-label={index >= 2 ? `Resize channel height ${index - 1}` : `Move channel endpoint ${index + 1}`}
          onPointerDown={(event) => onStartHandleEdit(event, drawing.id, index, 'channel-corner')}
        />
      ))}
    </>
  }

  if (isPosition && screenPoints[0] && screenPoints[1] && screenPoints[2]) {
    const entry = screenPoints[0]
    const target = screenPoints[1]
    const stop = screenPoints[2]
    const left = Math.min(entry.x, target.x)
    const right = Math.max(entry.x, target.x)
    const boxTop = Math.min(entry.y, target.y, stop.y)
    const boxBottom = Math.max(entry.y, target.y, stop.y)
    const boxHeight = Math.max(10, boxBottom - boxTop)
    const boxWidth = Math.max(10, right - left)

    return (
      <>
        {/* Invisible hit area covering the entire position box for moving all points */}
        <rect
          className="position-drag-hitarea"
          x={left}
          y={boxTop}
          width={boxWidth}
          height={boxHeight}
          fill="transparent"
          style={{ cursor: 'move', pointerEvents: 'all' }}
          onPointerDown={(event) => onStartHandleEdit(event, drawing.id, 0, 'position-move-all')}
        />

        {/* Target handle - top-left corner */}
        <DrawingHandle
          cx={left}
          cy={target.y}
          style={{ cursor: 'ns-resize' }}
          onPointerDown={(event) => onStartHandleEdit(event, drawing.id, 1, 'position-price')}
        />

        {/* Stop handle - bottom-left corner */}
        <DrawingHandle
          cx={left}
          cy={stop.y}
          style={{ cursor: 'ns-resize' }}
          onPointerDown={(event) => onStartHandleEdit(event, drawing.id, 2, 'position-price')}
        />

        {/* Entry price handle - mid-left corner (resizes TP/SL ratio) */}
        <DrawingHandle
          cx={left}
          cy={entry.y}
          style={{ cursor: 'ns-resize' }}
          onPointerDown={(event) => onStartHandleEdit(event, drawing.id, 0, 'position-entry-price')}
        />

        {/* Width handle - mid-right edge */}
        <DrawingHandle
          cx={right}
          cy={entry.y}
          style={{ cursor: 'ew-resize' }}
          onPointerDown={(event) => onStartHandleEdit(event, drawing.id, 1, 'position-width')}
        />
      </>
    )
  }

  return (
    <>
      {screenPoints.map((point, pointIndex) => {
        const displayedPoint = handlePoint(drawing, point, pointIndex, screenPoints, viewport)
        return (
          <DrawingHandle
            key={`${drawing.id}-${pointIndex}`}
            cx={displayedPoint.x}
            cy={displayedPoint.y}
            onPointerDown={(event) => onStartHandleEdit(event, drawing.id, pointIndex, 'point')}
          />
        )
      })}
    </>
  )
}
