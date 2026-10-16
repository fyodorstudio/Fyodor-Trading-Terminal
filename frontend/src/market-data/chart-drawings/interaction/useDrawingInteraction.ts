import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { type DrawingHandleKind } from '../ChartDrawingSelectionHandles'
import type { ChartDrawingPoint, ChartDrawingRecord } from '../chart-drawing-record'
import type { ChartDrawingScreenPoint } from '../chart-drawing-screen-point'
import { drawingTools, type DrawingToolId } from '../drawing-tool'
import { normalizeDrawingPoints } from '../position-drawing-geometry'
import { defaultChannelOffset, editParallelChannel } from '../parallel-channel-geometry'
import { useDrawingViewport } from '../useDrawingViewport'
import { drawingCoordinates, emptyDrawingTimeline } from '../drawing-coordinates'
import { editRectangleCorner } from '../rectangle-drawing-geometry'
import { useDrawingCrosshair } from '../useDrawingCrosshair'
import type { ChartDrawingOverlayProps, EditingHandle } from './drawing-overlay-contract'
import { shiftEditedDrawingPoints } from './drawing-edit-math'

function constrainDrag(tool: DrawingToolId | null, points: ChartDrawingPoint[], shift: boolean) {
  if (!shift || (tool !== 'trend-line' && tool !== 'price-note') || points.length !== 2) return points
  return [points[0], { ...points[1], price: points[0].price }]
}

export function useDrawingInteraction({
  chartApi,
  seriesApi,
  activeTool,
  drawings,
  selectedDrawingId,
  bars = emptyDrawingTimeline,
  timeframe,
  symbol = '',
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
  const crosshair = useDrawingCrosshair(chartApi)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const previousToolRef = useRef(activeTool)

  useEffect(() => {
    if (!selectedDrawingId) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const selected = drawings.find(drawing => drawing.id === selectedDrawingId)
      if ((event.key === 'Enter' || event.key === 'F2') && selected?.tool === 'text') {
        const target = event.target as HTMLElement | null
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
        event.preventDefault()
        setEditingTextId(selectedDrawingId)
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const target = event.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        event.preventDefault()
        onDeleteSelectedDrawing?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawings, onDeleteSelectedDrawing, selectedDrawingId])

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
    const dataPoints = drawing.tool === 'price-note' ? withPriceNoteLine(drawing.points) : drawing.points
    const xs = dataPoints.map(point => coordinates.timeToX(point.time))
    if (xs.some(x => x === null)) return []
    // Skip price projection for shapes entirely outside the horizontal pane.
    // Horizontal lines span the pane independently of their saved timestamp.
    const padding = drawing.tool.includes('position') ? 2 : drawing.tool === 'text' ? 220 : drawing.tool === 'price-note' ? 100 : 24
    if (drawing.tool !== 'horizontal-line' && viewport.width > 0
      && (Math.max(...xs as number[]) < -padding || Math.min(...xs as number[]) > viewport.width + padding)) return []
    const points = dataPoints.map((point, index) => {
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

  const withPriceNoteLine = (points: ChartDrawingPoint[]) => {
    if (points.length !== 1) return points
    const anchor = points[0]
    const x = coordinates.timeToX(anchor.time)
    const y = seriesApi.priceToCoordinate(anchor.price)
    const start = x === null || y === null ? null : coordinates.pointAt(x - 80, y)
    return start ? [{ time: start.time, price: anchor.price }, anchor] : points
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
    setDraft(constrainDrag(activeTool, dragDraftRef.current, event.shiftKey))
  }

  const updateEdit = (editing: EditingHandle, point: ChartDrawingPoint, event: ReactPointerEvent<SVGSVGElement>, persist: boolean) => {
    if (!editing.startPoint || !editing.initialPoints) return
    const { x, y } = eventPosition(event)
    if (!editing.moved && Math.hypot(x - editing.startX, y - editing.startY) < 3) return
    editing.moved = true
    const shifted = shiftEditedDrawingPoints(editing, point, coordinates, coordinates.xToLogical(eventPosition(event).x))
    if (!shifted) return
    const original = editing.initialPoints[editing.pointIndex]
    const moved = shifted[editing.pointIndex]
    if (editing.kind === 'channel-corner') {
      const points = editParallelChannel(editing.initialPoints, editing.pointIndex, point.price - editing.startPoint.price)
      onUpdateDrawingPoints?.(editing.drawingId, points, persist)
    } else if (editing.kind === 'rectangle-corner') {
      onUpdateDrawingPoints?.(editing.drawingId, editRectangleCorner(editing.initialPoints, editing.pointIndex, shifted), persist)
    } else if (editing.kind === 'move-all' || editing.kind === 'position-move-all') {
      onUpdateDrawingPoints?.(editing.drawingId, shifted, persist)
    } else if (editing.kind === 'position-width' && moved) {
      onUpdatePositionWidth(editing.drawingId, moved.time, persist)
    } else if (original && moved) {
      const tool = editing.tool
      const priceOnly = editing.kind === 'position-price' || editing.kind === 'position-entry-price' || tool === 'horizontal-line'
      const edited = {
        time: priceOnly ? original.time : moved.time,
        price: tool === 'vertical-line' ? original.price : moved.price,
      }
      if (editing.initialPoints.length !== editing.originalPoints?.length) {
        const points = [...editing.initialPoints]
        points[editing.pointIndex] = edited
        onUpdateDrawingPoints?.(editing.drawingId, points, persist)
      } else onUpdateDrawingPoint(editing.drawingId, editing.pointIndex, edited, persist)
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
    setDraft(constrainDrag(activeTool, dragDraftRef.current, event.shiftKey))
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
    createAndSelectDrawing(activeTool, constrainDrag(activeTool, completed, event.shiftKey))
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
    const initialPoints = drawing.tool === 'parallel-channel' ? withChannelAnchor(drawing.points)
      : drawing.tool === 'price-note' ? withPriceNoteLine(drawing.points) : drawing.points
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
    if (previousToolRef.current === activeTool) return
    previousToolRef.current = activeTool
    pathPointsRef.current = []
    cancelRef.current()
    if (activeTool) {
      // The tool is an external prop. Cancel its editor on an actual tool
      // transition while preserving the mounted editor when creation exits.
      // eslint-disable-next-line react/set-state-in-effect
      setEditingTextId(null)
    }
  }, [activeTool])

  useEffect(() => {
    if (activeTool !== 'trend-line' && activeTool !== 'price-note') return
    const updateShift = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && dragDraftRef.current.length) {
        setDraft(constrainDrag(activeTool, dragDraftRef.current, event.type === 'keydown'))
      }
    }
    window.addEventListener('keydown', updateShift)
    window.addEventListener('keyup', updateShift)
    return () => {
      window.removeEventListener('keydown', updateShift)
      window.removeEventListener('keyup', updateShift)
    }
  }, [activeTool])

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && editingHandleRef.current) cancelRef.current()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])

  const normalizedDraft = activeTool ? normalizeDrawingPoints(activeTool, draft, timeframe) : draft
  const draftDrawing: ChartDrawingRecord | null = activeTool && normalizedDraft.length > 0
    ? { id: 'draft', symbol, timeframe: timeframe ?? 'H4', tool: activeTool, points: normalizedDraft, createdAt: 0 }
    : null

  return { activeTool, cancelInteraction, clipId, continueInteraction, crosshair, draft, draftDrawing, drawings, editingTextId, finishInteraction, handleContextMenu, onDeleteDrawing, onDeleteSelectedDrawing, onSelectDrawing, onUpdateDrawingText, overlayRef, precision, selectedDrawingId, setEditingTextId, startHandleEdit, startInteraction, toScreenPoints, viewport }
}
