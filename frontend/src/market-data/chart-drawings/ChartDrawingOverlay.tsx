import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import type { ChartTimeframe } from '../contracts/ChartTimeframe'
import { ChartDrawingShape } from './ChartDrawingShape'
import { ChartDrawingSelectionHandles, type DrawingHandleKind } from './ChartDrawingSelectionHandles'
import type { ChartDrawingPoint, ChartDrawingRecord } from './chart-drawing-record'
import type { ChartDrawingScreenPoint } from './chart-drawing-screen-point'
import { drawingTools, type DrawingToolId } from './drawing-tool'
import { normalizeDrawingPoints } from './position-drawing-geometry'
import { defaultChannelOffset, editParallelChannel } from './parallel-channel-geometry'
import { useDrawingViewport } from './useDrawingViewport'
import { drawingCoordinates, emptyDrawingTimeline, type DrawingTimeline } from './drawing-coordinates'
import './chart-drawing-overlay.css'

type ChartDrawingOverlayProps = {
  chartApi: IChartApi
  seriesApi: ISeriesApi<'Candlestick', Time>
  activeTool: DrawingToolId | null
  drawings: ChartDrawingRecord[]
  selectedDrawingId: string | null
  bars?: DrawingTimeline
  timeframe?: ChartTimeframe
  precision?: number
  onSelectDrawing: (drawingId: string | null) => void
  onCreateDrawing: (tool: DrawingToolId, points: ChartDrawingPoint[]) => string
  onUpdateDrawingPoint: (drawingId: string, pointIndex: number, point: ChartDrawingPoint, persist: boolean) => void
  onUpdateDrawingPoints?: (drawingId: string, points: ChartDrawingPoint[], persist: boolean) => void
  onUpdatePositionWidth: (drawingId: string, time: ChartDrawingPoint['time'], persist: boolean) => void
  onUpdateDrawingText?: (drawingId: string, text: string) => void
  onDeleteSelectedDrawing?: () => void
  onDeleteDrawing?: (drawingId: string) => void
  onExitDrawingMode: () => void
}

type EditingHandle = {
  drawingId: string
  pointIndex: number
  kind: DrawingHandleKind
  startPoint?: ChartDrawingPoint
  initialPoints?: ChartDrawingPoint[]
  startLogical?: number
  initialLogicals?: (number | null)[]
  originalPoints?: ChartDrawingPoint[]
  startX: number
  startY: number
  moved: boolean
  captureTarget: Element
  pointerId: number
  tool: DrawingToolId
}

type InlineTextEditorProps = {
  initialText: string
  onCommit: (text: string) => void
  onCancel: () => void
}

function InlineTextEditor({ initialText, onCommit, onCancel }: InlineTextEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initialText)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  return (
    <input
      ref={inputRef}
      className="drawing-text-input"
      type="text"
      value={value}
      placeholder="Type text..."
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit(value.trim())
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
        e.stopPropagation()
      }}
      onBlur={() => onCommit(value.trim())}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}

export function ChartDrawingOverlay({
  chartApi,
  seriesApi,
  activeTool,
  drawings,
  selectedDrawingId,
  bars = emptyDrawingTimeline,
  timeframe,
  precision = 5,
  onSelectDrawing,
  onCreateDrawing,
  onUpdateDrawingPoint,
  onUpdateDrawingPoints,
  onUpdatePositionWidth,
  onUpdateDrawingText,
  onDeleteSelectedDrawing,
  onDeleteDrawing,
  onExitDrawingMode,
}: ChartDrawingOverlayProps) {
  const overlayRef = useRef<SVGSVGElement>(null)
  const dragDraftRef = useRef<ChartDrawingPoint[]>([])
  const pathPointsRef = useRef<ChartDrawingPoint[]>([])
  const editingHandleRef = useRef<EditingHandle | null>(null)
  const cancelRef = useRef<() => void>(() => {})
  const [draft, setDraft] = useState<ChartDrawingPoint[]>([])
  const viewport = useDrawingViewport(chartApi, seriesApi, overlayRef)
  const clipId = useId()
  const coordinates = drawingCoordinates(chartApi, seriesApi, bars, timeframe)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedDrawingId || !onDeleteSelectedDrawing) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const target = event.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        event.preventDefault()
        onDeleteSelectedDrawing()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDeleteSelectedDrawing, selectedDrawingId])

  const eventPosition = (event: ReactPointerEvent<Element>) => {
    const overlay = overlayRef.current
    const rectangle = overlay ? overlay.getBoundingClientRect() : event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rectangle.left
    const y = event.clientY - rectangle.top
    return { x, y }
  }

  const eventToDataPoint = (event: ReactPointerEvent<Element>) => {
    const { x, y } = eventPosition(event)
    return coordinates.pointAt(x, y)
  }

  const toScreenPoints = (drawing: ChartDrawingRecord) => {
    const xs = drawing.points.map(point => coordinates.timeToX(point.time))
    if (xs.some(x => x === null)) return []
    // Skip price projection for shapes entirely outside the horizontal pane.
    // Horizontal lines span the pane independently of their saved timestamp.
    const padding = drawing.tool.includes('position') ? 320 : drawing.tool === 'text' ? 220 : 24
    if (drawing.tool !== 'horizontal-line' && viewport.width > 0
      && (Math.max(...xs as number[]) < -padding || Math.min(...xs as number[]) > viewport.width + padding)) return []
    const points = drawing.points.map((point, index) => {
      const x = xs[index]
      const y = seriesApi.priceToCoordinate(point.price)
      return x === null || y === null ? null : { x, y, price: point.price }
    })
    return points.some((point) => point === null) ? [] : points as ChartDrawingScreenPoint[]
  }

  const resetDraft = () => {
    dragDraftRef.current = []
    pathPointsRef.current = []
    setDraft([])
  }

  const withChannelAnchor = (points: ChartDrawingPoint[]) => {
    if (points.length !== 2) return points
    const y = seriesApi.priceToCoordinate(points[0].price)
    const price = y === null ? null : seriesApi.coordinateToPrice(y + defaultChannelOffset)
    return price === null ? points : [...points, { time: points[0].time, price }]
  }

  const createAndSelectDrawing = (tool: DrawingToolId, points: ChartDrawingPoint[]) => {
    const normalized = normalizeDrawingPoints(tool, points, timeframe)
    const drawingId = onCreateDrawing(tool, tool === 'parallel-channel' ? withChannelAnchor(normalized) : normalized)
    onSelectDrawing(drawingId)
    resetDraft()
    if (tool === 'text') {
      setEditingTextId(drawingId)
    }
    onExitDrawingMode()
  }

  const startInteraction = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !activeTool || editingHandleRef.current) return
    const { x, y } = eventPosition(event)
    if (viewport.width > 0 && (x < 0 || y < 0 || x > viewport.width || y > viewport.height)) return
    const point = eventToDataPoint(event)
    if (!point) return
    const tool = drawingTools.find((candidate) => candidate.id === activeTool)
    if (!tool) return

    event.preventDefault()
    if (tool.gesture === 'path') {
      if (pathPointsRef.current.length === 0) onSelectDrawing(null)
      pathPointsRef.current = [...pathPointsRef.current, point]
      setDraft([...pathPointsRef.current, point])
      return
    }

    if (tool.gesture === 'point') {
      createAndSelectDrawing(activeTool, [point])
      return
    }

    onSelectDrawing(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragDraftRef.current = [point, point]
    setDraft(dragDraftRef.current)
  }

  const calcShiftedPoints = (
    editing: EditingHandle,
    point: ChartDrawingPoint,
    event: ReactPointerEvent<SVGSVGElement>,
  ): ChartDrawingPoint[] | null => {
    if (!editing.startPoint || !editing.initialPoints) return null
    const deltaPrice = point.price - editing.startPoint.price
    const deltaTime = point.time - editing.startPoint.time

    const currentLogical = coordinates.xToLogical(eventPosition(event).x)

    if (currentLogical !== null && editing.startLogical !== undefined && editing.initialLogicals) {
      const deltaLogical = currentLogical - editing.startLogical
      return editing.initialPoints.map((p, idx) => {
        const initLogical = editing.initialLogicals?.[idx]
        let newTime = (p.time + deltaTime) as ChartDrawingPoint['time']
        if (initLogical !== null && initLogical !== undefined) {
          newTime = coordinates.logicalToTime(initLogical + deltaLogical) ?? newTime
        }
        return {
          time: editing.tool === 'horizontal-line' ? p.time : newTime,
          price: editing.tool === 'vertical-line' ? p.price : p.price + deltaPrice,
        }
      })
    }

    return editing.initialPoints.map((p) => ({
      time: editing.tool === 'horizontal-line' ? p.time : (p.time + deltaTime) as ChartDrawingPoint['time'],
      price: editing.tool === 'vertical-line' ? p.price : p.price + deltaPrice,
    }))
  }

  const updateEdit = (editing: EditingHandle, point: ChartDrawingPoint, event: ReactPointerEvent<SVGSVGElement>, persist: boolean) => {
    if (!editing.startPoint || !editing.initialPoints) return
    const { x, y } = eventPosition(event)
    if (!editing.moved && Math.hypot(x - editing.startX, y - editing.startY) < 3) return
    editing.moved = true
    const shifted = calcShiftedPoints(editing, point, event)
    if (!shifted) return
    const original = editing.initialPoints[editing.pointIndex]
    const moved = shifted[editing.pointIndex]
    if (editing.kind === 'channel-corner') {
      const channelPoint = moved ?? point
      const points = editParallelChannel(editing.initialPoints, editing.pointIndex, channelPoint, point.price - editing.startPoint.price)
      onUpdateDrawingPoints?.(editing.drawingId, points, persist)
    } else if (editing.kind === 'move-all' || editing.kind === 'position-move-all') {
      onUpdateDrawingPoints?.(editing.drawingId, shifted, persist)
    } else if (editing.kind === 'position-width' && moved) {
      onUpdatePositionWidth(editing.drawingId, moved.time, persist)
    } else if (original && moved) {
      const tool = editing.tool
      const priceOnly = editing.kind === 'position-price' || editing.kind === 'position-entry-price' || tool === 'horizontal-line'
      onUpdateDrawingPoint(editing.drawingId, editing.pointIndex, {
        time: priceOnly ? original.time : moved.time,
        price: tool === 'vertical-line' ? original.price : moved.price,
      }, persist)
    }
  }

  const continueInteraction = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = eventToDataPoint(event)
    if (!point) return

    const editing = editingHandleRef.current
    if (editing) {
      updateEdit(editing, point, event, false)
      return
    }

    if (activeTool === 'path' && pathPointsRef.current.length > 0) {
      setDraft([...pathPointsRef.current, point])
      return
    }

    if (!activeTool || dragDraftRef.current.length === 0) return
    dragDraftRef.current = [dragDraftRef.current[0], point]
    setDraft(dragDraftRef.current)
  }

  const finishInteraction = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = eventToDataPoint(event)
    const editing = editingHandleRef.current
    if (editing) {
      if (point) updateEdit(editing, point, event, true)
      else if (editing.moved && editing.originalPoints) onUpdateDrawingPoints?.(editing.drawingId, editing.originalPoints, false)
      editingHandleRef.current = null
      releaseCapture(editing)
      return
    }

    if (!activeTool || activeTool === 'path' || dragDraftRef.current.length === 0) return
    const completed = point ? [dragDraftRef.current[0], point] : dragDraftRef.current
    createAndSelectDrawing(activeTool, completed)
  }

  const cancelInteraction = () => {
    const editing = editingHandleRef.current
    editingHandleRef.current = null
    if (editing) {
      if (editing.moved && editing.originalPoints) onUpdateDrawingPoints?.(editing.drawingId, editing.originalPoints, false)
      releaseCapture(editing)
    }
    dragDraftRef.current = []
    setDraft(pathPointsRef.current)
  }

  const handleContextMenu = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.preventDefault()
    if (activeTool === 'path' && pathPointsRef.current.length >= 2) {
      createAndSelectDrawing('path', pathPointsRef.current)
    } else if (activeTool) {
      resetDraft()
    } else {
      resetDraft()
      onSelectDrawing(null)
    }
    cancelInteraction()
    onExitDrawingMode()
  }

  const startHandleEdit = (
    event: ReactPointerEvent<SVGElement>,
    drawingId: string,
    pointIndex: number,
    kind: DrawingHandleKind = 'point',
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const drawing = drawings.find((candidate) => candidate.id === drawingId)
    const point = eventToDataPoint(event)
    if (!drawing || !point) return
    const captureTarget = overlayRef.current?.setPointerCapture ? overlayRef.current : event.currentTarget
    captureTarget.setPointerCapture?.(event.pointerId)

    const { x, y } = eventPosition(event)
    const startLogical = coordinates.xToLogical(x)
    const initialPoints = drawing.tool === 'parallel-channel' ? withChannelAnchor(drawing.points) : drawing.points
    const initialLogicals = initialPoints.map(p => coordinates.timeToLogical(p.time))

    editingHandleRef.current = {
      drawingId,
      pointIndex,
      kind,
      startPoint: point ?? undefined,
      initialPoints,
      originalPoints: drawing.points,
      startLogical: startLogical !== null ? startLogical : undefined,
      initialLogicals,
      startX: x,
      startY: y,
      moved: false,
      captureTarget,
      pointerId: event.pointerId,
      tool: drawing.tool,
    }
    onSelectDrawing(drawingId)
  }

  const releaseCapture = (editing: EditingHandle) => {
    if (editing.captureTarget.hasPointerCapture?.(editing.pointerId)) editing.captureTarget.releasePointerCapture(editing.pointerId)
  }

  useEffect(() => () => {
    if (editingHandleRef.current) releaseCapture(editingHandleRef.current)
  }, [])

  useEffect(() => { cancelRef.current = cancelInteraction })

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && editingHandleRef.current) cancelRef.current()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])

  const normalizedDraft = activeTool ? normalizeDrawingPoints(activeTool, draft, timeframe) : draft
  const draftDrawing: ChartDrawingRecord | null = activeTool && normalizedDraft.length > 0
    ? { id: 'draft', symbol: '', timeframe: 'H4', tool: activeTool, points: normalizedDraft, createdAt: 0 }
    : null

  return (
    <svg
      ref={overlayRef}
      className={`chart-drawing-overlay${activeTool ? ' drawing-active' : ''}`}
      onPointerDown={startInteraction}
      onPointerMove={continueInteraction}
      onPointerUp={finishInteraction}
      onPointerCancel={cancelInteraction}
      onLostPointerCapture={cancelInteraction}
      onContextMenu={handleContextMenu}
      aria-label={activeTool ? `Draw with ${activeTool}` : 'Saved chart drawings'}
    >
      <defs>
        <clipPath id={clipId}><rect width={viewport.width || '100%'} height={viewport.height || '100%'} /></clipPath>
        <marker id="drawing-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="drawing-arrow-head" />
        </marker>
      </defs>
      <g clipPath={`url(#${clipId})`}>
      {drawings.map((drawing) => {
        const screenPoints = toScreenPoints(drawing)
        const selected = drawing.id === selectedDrawingId
        return (
          <g
            key={drawing.id}
            className={`drawing-object${selected ? ' selected' : ''}`}
            onPointerDown={(event) => {
              if (activeTool || event.button !== 0) return
              event.stopPropagation()
              if (selected) startHandleEdit(event, drawing.id, 0, 'move-all')
              else onSelectDrawing(drawing.id)
            }}
            onDoubleClick={(event) => {
              if (drawing.tool === 'text') {
                event.stopPropagation()
                setEditingTextId(drawing.id)
              }
            }}
            onContextMenu={(event) => {
              if (activeTool) return
              event.preventDefault()
              event.stopPropagation()
              if (onDeleteDrawing) {
                onDeleteDrawing(drawing.id)
              } else if (onDeleteSelectedDrawing) {
                onSelectDrawing(drawing.id)
                onDeleteSelectedDrawing()
              }
            }}
          >
            <ChartDrawingShape drawing={drawing} points={screenPoints} width={viewport.width} height={viewport.height} precision={precision} />
            {selected && (
              <ChartDrawingSelectionHandles
                drawing={drawing}
                screenPoints={screenPoints}
                viewport={viewport}
                onStartHandleEdit={startHandleEdit}
              />
            )}
          </g>
        )
      })}
      {(() => {
        if (!editingTextId) return null
        const drawing = drawings.find((d) => d.id === editingTextId)
        if (!drawing || drawing.tool !== 'text') return null
        const screenPoints = toScreenPoints(drawing)
        const point = screenPoints[0]
        if (!point) return null
        return (
          <foreignObject
            x={Math.max(4, point.x + 2)}
            y={Math.max(4, point.y - 18)}
            width={220}
            height={32}
            className="drawing-text-foreign-object"
          >
            <InlineTextEditor
              initialText={drawing.text ?? ''}
              onCommit={(text) => {
                if (onUpdateDrawingText) {
                  onUpdateDrawingText(drawing.id, text)
                }
                setEditingTextId(null)
              }}
              onCancel={() => setEditingTextId(null)}
            />
          </foreignObject>
        )
      })()}
      {draftDrawing && (
        <g className="drawing-draft">
          <ChartDrawingShape drawing={draftDrawing} points={toScreenPoints(draftDrawing)} width={viewport.width} height={viewport.height} precision={precision} />
          {activeTool === 'path' && draft.length > 0 && (() => {
            const draftPoints = toScreenPoints(draftDrawing)
            const last = draftPoints.at(-1)
            return last ? <circle className="drawing-ghost-point" cx={last.x} cy={last.y} r="4" /> : null
          })()}
        </g>
      )}
      </g>
    </svg>
  )
}
