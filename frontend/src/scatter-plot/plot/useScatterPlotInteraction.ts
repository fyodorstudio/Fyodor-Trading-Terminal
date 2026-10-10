import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type MouseEvent, type KeyboardEvent } from 'react'
import type { ScatterModel } from '../contracts/scatter-plot-types'
import { scatterPlotGeometry, type ScatterViewport, type ScatterAxisRange } from './scatter-plot-geometry'
import { limitScatterDates, scaleScatterAxis, scatterPointerZone, translateScatterAxis, type ScatterGeometry, type ScatterPointerZone } from './scatter-plot-viewport'
import { useScatterPointerFrame } from './useScatterPointerFrame'
import { useRetainedScatterState } from './useRetainedScatterState'

type Position = { x: number; y: number }
type Drag = { start: Position; startClient: Position; clientScale: Position; geometry: ScatterGeometry; zone: ScatterPointerZone; pointerId: number; moved: boolean }
const day = 86400000
const dateSpanLimit = (Date.UTC(2200, 0, 1) - Date.UTC(1900, 0, 1)) / 2
const emptyViewport: ScatterViewport = {}

function scaled(geometry: ScatterGeometry, axis: 'x' | 'y', factor: number, anchor?: number) {
  const range = axis === 'x' ? { from: geometry.first, to: geometry.last } : { from: geometry.minDelta, to: geometry.maxDelta }
  const center = anchor ?? (range.from + range.to) / 2
  return axis === 'x' ? limitScatterDates(scaleScatterAxis(range, factor, center, day, dateSpanLimit)) :
    scaleScatterAxis(range, factor, center, geometry.extent * 2e-6, geometry.extent * 200)
}

export function useScatterPlotInteraction(model: ScatterModel, zoom: boolean, width: number, height: number, viewKey: string,
  dateWindow?: ScatterAxisRange, dateResetKey = '',viewState?:Map<string,unknown>,viewStateKey='viewport') {
  const resetKey = `${viewKey}/${zoom}`
  const [state, setState] = useRetainedScatterState<{ key: string; dateKey: string; viewport: ScatterViewport }>(viewState,viewStateKey,{ key: resetKey, dateKey: dateResetKey, viewport: {} })
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const pointerFrame = useScatterPointerFrame()
  if (state.key !== resetKey) {
    setState({ key: resetKey, dateKey: dateResetKey, viewport: {} })
  } else if (state.dateKey !== dateResetKey) {
    setState({ ...state, dateKey: dateResetKey, viewport: { y: state.viewport.y } })
  }
  useEffect(() => {
    pointerFrame.cancel(); drag.current = null; suppressClick.current = false
  }, [resetKey, dateResetKey, width, height, pointerFrame])
  const viewport = useMemo(() => state.key !== resetKey ? emptyViewport : state.dateKey !== dateResetKey ? { y: state.viewport.y } : state.viewport,
    [state, resetKey, dateResetKey])
  const g = useMemo(() => scatterPlotGeometry(model.points, model.inspection?.distribution ?? null, zoom, width, height,
    model.inspection?.at, viewport, dateWindow), [model.points, model.inspection, zoom, width, height, viewport, dateWindow])
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const [cursor, setCursor] = useState<{ key: string; position: Position } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const interactionKey = `${resetKey}/${dateResetKey}`
  const position = useCallback((event: { clientX: number; clientY: number }, element: SVGSVGElement): Position => {
    const rect = element.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * width / (rect.width || width), y: (event.clientY - rect.top) * height / (rect.height || height) }
  }, [width, height])
  const change = useCallback((next: ScatterViewport) => setState({ key: resetKey, dateKey: dateResetKey, viewport: next }), [resetKey, dateResetKey,setState])
  useEffect(() => {
    if (!svg) return
    // A native non-passive listener lets the chart consume wheel zoom without scrolling the dock.
    const wheel = (event: WheelEvent) => {
      pointerFrame.flush()
      const p = position(event, svg), zone = scatterPointerZone(g, p.x, p.y)
      if (!zone || !event.deltaY || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      const axis = zone === 'y' || (zone === 'plot' && event.shiftKey) ? 'y' : 'x'
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)
      const factor = Math.exp(Math.max(-1, Math.min(1, delta * .002)))
      change({ ...viewport, [axis]: scaled(g, axis, factor, axis === 'x' ? g.dateAt(p.x) : g.deltaAt(p.y)) })
    }
    svg.addEventListener('wheel', wheel, { passive: false })
    return () => svg.removeEventListener('wheel', wheel)
  }, [svg, g, height, viewport, position, change, pointerFrame])

  const reset = (axis: 'x' | 'y' | 'plot') => {
    pointerFrame.cancel()
    const next = { ...viewport }
    if (axis === 'x' || axis === 'plot') delete next.x
    if (axis === 'y' || axis === 'plot') delete next.y
    change(next)
  }
  const endDrag = () => {
    // A fast drag can finish before the scheduled frame. Preserve its final
    // movement and click suppression before releasing the active gesture.
    pointerFrame.flush(); drag.current = null; setDragging(null)
  }
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !event.isPrimary || event.ctrlKey || event.metaKey || event.altKey) return
    const rect = event.currentTarget.getBoundingClientRect()
    const clientScale = { x: width / (rect.width || width), y: height / (rect.height || height) }
    const p = { x: (event.clientX - rect.left) * clientScale.x, y: (event.clientY - rect.top) * clientScale.y }
    const zone = scatterPointerZone(g, p.x, p.y)
    if (!zone) return
    pointerFrame.cancel()
    suppressClick.current = false
    drag.current = { start: p, startClient: { x: event.clientX, y: event.clientY }, clientScale, geometry: g, zone, pointerId: event.pointerId, moved: false }
    // Capture the original hit target so a simple point click still selects its publication.
    const target = event.target as Element
    if (target.setPointerCapture) target.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const { clientX, clientY, pointerId, currentTarget } = event
    const active = drag.current
    // Remember any drag excursion, even if the pointer returns to its starting
    // point before the frame. Cached scaling avoids a layout read per event.
    if (active?.pointerId === pointerId && Math.hypot((clientX - active.startClient.x) * active.clientScale.x,
      (clientY - active.startClient.y) * active.clientScale.y) >= 3) {
      active.moved = true; suppressClick.current = true
    }
    pointerFrame.schedule(() => movePointer(position({ clientX, clientY }, currentTarget), pointerId))
  }
  const movePointer = (p: Position, pointerId: number) => {
    setCursor(scatterPointerZone(g, p.x, p.y) === 'plot' ? { key: interactionKey, position: p } : null)
    const active = drag.current
    if (!active || active.pointerId !== pointerId) return
    const dx = p.x - active.start.x, dy = p.y - active.start.y
    if (!active.moved && Math.hypot(dx, dy) < 3) return
    active.moved = true
    suppressClick.current = true
    setDragging(interactionKey)
    const initial = active.geometry
    if (active.zone === 'plot') {
      change({ x: limitScatterDates(translateScatterAxis({ from: initial.first, to: initial.last }, -dx * (initial.last - initial.first) / (initial.right - initial.left))),
        y: translateScatterAxis({ from: initial.minDelta, to: initial.maxDelta }, dy * (initial.maxDelta - initial.minDelta) / (initial.bottom - initial.top)) })
    } else {
      const factor = Math.exp(Math.max(-5, Math.min(5, (active.zone === 'x' ? -dx : dy) * .01)))
      change({ ...viewport, [active.zone]: scaled(initial, active.zone, factor) })
    }
  }
  const onAxisKeyDown = (axis: 'x' | 'y', event: KeyboardEvent<SVGRectElement>) => {
    pointerFrame.cancel()
    if (['0', 'Home', 'Enter', ' '].includes(event.key)) reset(axis)
    else if (['+', '=', '-'].includes(event.key)) change({ ...viewport, [axis]: scaled(g, axis, event.key === '-' ? 1.25 : .8) })
    else return
    event.preventDefault(); event.stopPropagation()
  }
  const visibleCursor = cursor?.key === interactionKey && scatterPointerZone(g, cursor.position.x, cursor.position.y) === 'plot' ? cursor.position : null
  return { g, cursor: visibleCursor, dragging: dragging === interactionKey, setSvg, onAxisKeyDown, svgEvents: {
    onPointerDown, onPointerMove, onPointerUp: endDrag,
    onPointerCancel: () => { pointerFrame.cancel(); endDrag(); suppressClick.current = false; setCursor(null) },
    onLostPointerCapture: endDrag,
    onPointerLeave: () => { pointerFrame.flush(); setCursor(null) },
    onClickCapture: (event: MouseEvent<SVGSVGElement>) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
    },
    onDoubleClick: (event: MouseEvent<SVGSVGElement>) => {
      const p = position(event, event.currentTarget), zone = scatterPointerZone(g, p.x, p.y)
      if (zone) { event.preventDefault(); reset(zone) }
    },
  } }
}
