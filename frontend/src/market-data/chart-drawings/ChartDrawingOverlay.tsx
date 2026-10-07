import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { IChartApi, ISeriesApi, Logical, Time } from 'lightweight-charts'
import type { ChartTimeframe } from '../contracts/ChartTimeframe'
import { ChartDrawingShape } from './ChartDrawingShape'
import { ChartDrawingSelectionHandles, type DrawingHandleKind } from './ChartDrawingSelectionHandles'
import type { ChartDrawingPoint, ChartDrawingRecord } from './chart-drawing-record'
import type { ChartDrawingScreenPoint } from './chart-drawing-screen-point'
import { drawingTools, type DrawingToolId } from './drawing-tool'
import { normalizeDrawingPoints } from './position-drawing-geometry'
import { useDrawingViewport } from './useDrawingViewport'
import './chart-drawing-overlay.css'

type ChartDrawingOverlayProps = {
  chartApi: IChartApi
  seriesApi: ISeriesApi<'Candlestick', Time>
  activeTool: DrawingToolId | null
  drawings: ChartDrawingRecord[]
  selectedDrawingId: string | null
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
  const [draft, setDraft] = useState<ChartDrawingPoint[]>([])
  const viewport = useDrawingViewport(chartApi, overlayRef)
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

  const eventToDataPoint = (event: ReactPointerEvent<Element>) => {
    const overlay = overlayRef.current
    const rectangle = overlay ? overlay.getBoundingClientRect() : event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rectangle.left
    const y = event.clientY - rectangle.top
    const time = chartApi.timeScale().coordinateToTime(x)
    const price = seriesApi.coordinateToPrice(y)
    if (typeof time !== 'number' || price === null) return null
    return { time, price } as ChartDrawingPoint
  }

  const toScreenPoints = (drawing: ChartDrawingRecord) => {
    const timeScale = chartApi.timeScale()
    const points = drawing.points.map((point) => {
      let x = timeScale.timeToCoordinate(point.time as unknown as Time)
      if (x === null) {
        const index = timeScale.timeToIndex(point.time as unknown as Time, true)
        if (index !== null) {
          x = timeScale.logicalToCoordinate(index as unknown as Logical)
        }
      }
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

  const createAndSelectDrawing = (tool: DrawingToolId, points: ChartDrawingPoint[]) => {
    const drawingId = onCreateDrawing(tool, normalizeDrawingPoints(tool, points, timeframe))
    onSelectDrawing(drawingId)
    resetDraft()
    if (tool === 'text') {
      setEditingTextId(drawingId)
    }
    onExitDrawingMode()
  }

  const startInteraction = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !activeTool || editingHandleRef.current) return
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

    const overlay = overlayRef.current
    const timeScale = chartApi.timeScale()
    const currentX = overlay ? event.clientX - overlay.getBoundingClientRect().left : 0
    const currentLogical = timeScale.coordinateToLogical(currentX)

    if (currentLogical !== null && editing.startLogical !== undefined && editing.initialLogicals) {
      const deltaLogical = Math.round(currentLogical - editing.startLogical)
      return editing.initialPoints.map((p, idx) => {
        const initLogical = editing.initialLogicals?.[idx]
        let newTime = p.time
        if (initLogical !== null && initLogical !== undefined) {
          const targetLogical = initLogical + deltaLogical
          const coord = timeScale.logicalToCoordinate(targetLogical as unknown as Logical)
          if (coord !== null) {
            const t = timeScale.coordinateToTime(coord)
            if (typeof t === 'number') {
              newTime = t as ChartDrawingPoint['time']
            }
          }
        }
        return {
          time: newTime,
          price: p.price + deltaPrice,
        }
      })
    }

    const deltaTime = point.time - editing.startPoint.time
    return editing.initialPoints.map((p) => ({
      time: (p.time + deltaTime) as ChartDrawingPoint['time'],
      price: p.price + deltaPrice,
    }))
  }

  const continueInteraction = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = eventToDataPoint(event)
    if (!point) return

    const editing = editingHandleRef.current
    if (editing) {
      if (editing.kind === 'position-move-all') {
        if (onUpdateDrawingPoints) {
          const shifted = calcShiftedPoints(editing, point, event)
          if (shifted) onUpdateDrawingPoints(editing.drawingId, shifted, false)
        }
      } else if (editing.kind === 'position-width') {
        onUpdatePositionWidth(editing.drawingId, point.time, false)
      } else if (editing.kind === 'position-price' || editing.kind === 'position-entry-price') {
        const drawing = drawings.find((candidate) => candidate.id === editing.drawingId)
        const original = drawing?.points[editing.pointIndex]
        if (original) onUpdateDrawingPoint(editing.drawingId, editing.pointIndex, { time: original.time, price: point.price }, false)
      } else {
        onUpdateDrawingPoint(editing.drawingId, editing.pointIndex, point, false)
      }
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
      if (point) {
        if (editing.kind === 'position-move-all') {
          if (onUpdateDrawingPoints) {
            const shifted = calcShiftedPoints(editing, point, event)
            if (shifted) onUpdateDrawingPoints(editing.drawingId, shifted, true)
          }
        } else if (editing.kind === 'position-width') {
          onUpdatePositionWidth(editing.drawingId, point.time, true)
        } else if (editing.kind === 'position-price' || editing.kind === 'position-entry-price') {
          const drawing = drawings.find((candidate) => candidate.id === editing.drawingId)
          const original = drawing?.points[editing.pointIndex]
          if (original) onUpdateDrawingPoint(editing.drawingId, editing.pointIndex, { time: original.time, price: point.price }, true)
        } else {
          onUpdateDrawingPoint(editing.drawingId, editing.pointIndex, point, true)
        }
      }
      editingHandleRef.current = null
      return
    }

    if (!activeTool || activeTool === 'path' || dragDraftRef.current.length === 0) return
    const completed = point ? [dragDraftRef.current[0], point] : dragDraftRef.current
    createAndSelectDrawing(activeTool, completed)
  }

  const cancelInteraction = () => {
    editingHandleRef.current = null
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
    editingHandleRef.current = null
    onExitDrawingMode()
  }

  const startHandleEdit = (
    event: ReactPointerEvent<SVGCircleElement | SVGRectElement>,
    drawingId: string,
    pointIndex: number,
    kind: DrawingHandleKind = 'point',
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const drawing = drawings.find((candidate) => candidate.id === drawingId)
    const point = eventToDataPoint(event)

    const overlay = overlayRef.current
    const timeScale = chartApi.timeScale()
    const currentX = overlay ? event.clientX - overlay.getBoundingClientRect().left : 0
    const startLogical = timeScale.coordinateToLogical(currentX)
    const initialLogicals = drawing
      ? drawing.points.map((p) => timeScale.timeToIndex(p.time as unknown as Time, true))
      : undefined

    editingHandleRef.current = {
      drawingId,
      pointIndex,
      kind,
      startPoint: point ?? undefined,
      initialPoints: drawing ? [...drawing.points] : undefined,
      startLogical: startLogical !== null ? startLogical : undefined,
      initialLogicals,
    }
    onSelectDrawing(drawingId)
  }

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
      onContextMenu={handleContextMenu}
      aria-label={activeTool ? `Draw with ${activeTool}` : 'Saved chart drawings'}
    >
      <defs>
        <marker id="drawing-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="drawing-arrow-head" />
        </marker>
      </defs>
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
              onSelectDrawing(drawing.id)
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
    </svg>
  )
}
