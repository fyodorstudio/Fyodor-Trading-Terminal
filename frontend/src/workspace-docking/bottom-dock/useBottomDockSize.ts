import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { BottomDockWindow } from './bottom-dock-window'

export const inspectorDockHeightKey = 'fyodor.inspector.dock-height.v1'
export const bottomDockHeightKeys: Record<BottomDockWindow, string> = {
  inspector: inspectorDockHeightKey,
  notebook: 'fyodor.notebook.dock-height.v1',
  activity: 'fyodor.activity.dock-height.v1',
  'scatter-plot': 'fyodor.scatter-plot.dock-height.v1',
  alert: 'fyodor.alert.dock-height.v1',
}
const defaultHeights: Record<BottomDockWindow, number> = { inspector: 380, notebook: 258, activity: 258, 'scatter-plot': 420, alert: 258 }
const dockLabels: Record<BottomDockWindow, string> = { inspector: 'Inspector', notebook: 'Notebook', activity: 'Activity', 'scatter-plot': 'Scatter Plot', alert: 'Alert' }
function readHeight(dock: BottomDockWindow) {
  try {
    const stored = localStorage.getItem(bottomDockHeightKeys[dock])
    const height = stored === null ? NaN : Number(stored)
    return Number.isFinite(height) && height > 0 ? height : defaultHeights[dock]
  } catch { return defaultHeights[dock] }
}

export function useBottomDockSize(activeWindow: BottomDockWindow | null) {
  const [preferredHeights, setPreferredHeights] = useState(() => ({
    inspector: readHeight('inspector'), notebook: readHeight('notebook'), activity: readHeight('activity'),
    'scatter-plot': readHeight('scatter-plot'), alert: readHeight('alert'),
  }))
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)
  const [resizingDock, setResizingDock] = useState<BottomDockWindow | null>(null)
  if (resizingDock !== null && resizingDock !== activeWindow) setResizingDock(null)
  const drag = useRef<{ dock: BottomDockWindow; element: HTMLDivElement; pointerId: number;
    startY: number; startHeight: number; height: number } | null>(null)
  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  useEffect(() => {
    return () => {
      const current = drag.current
      drag.current = null
      if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
    }
  }, [activeWindow])
  const maxHeight = Math.max(140, Math.floor(Math.min(viewportHeight * .65, viewportHeight - 240)))
  const minHeight = Math.min(240, maxHeight)
  const clamp = (height: number) => Math.max(minHeight, Math.min(maxHeight, Math.round(height)))
  const height = activeWindow ? clamp(preferredHeights[activeWindow]) : 258
  function save(dock: BottomDockWindow, nextHeight: number) {
    setPreferredHeights((current) => ({ ...current, [dock]: nextHeight }))
    try { localStorage.setItem(bottomDockHeightKeys[dock], String(nextHeight)) }
    catch { /* Resizing remains available for this session. */ }
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !activeWindow) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { dock: activeWindow, element: event.currentTarget,
      pointerId: event.pointerId, startY: event.clientY, startHeight: height, height }
    setResizingDock(activeWindow)
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    current.height = clamp(current.startHeight + current.startY - event.clientY)
    setPreferredHeights((heights) => ({ ...heights, [current.dock]: current.height }))
  }
  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    drag.current = null
    setResizingDock(null)
    save(current.dock, current.height)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!activeWindow) return
    const next = event.key === 'ArrowUp' ? height + 24 : event.key === 'ArrowDown' ? height - 24 :
      event.key === 'Home' ? minHeight : event.key === 'End' ? maxHeight : null
    if (next === null) return
    event.preventDefault()
    save(activeWindow, clamp(next))
  }
  const [restoredHeights, setRestoredHeights] = useState<Record<BottomDockWindow, number>>(() => ({
    inspector: 380, notebook: 258, activity: 258, 'scatter-plot': 420, alert: 258,
  }))
  const isMaxHeight = height >= maxHeight
  function toggleHeight() {
    if (!activeWindow) return
    if (isMaxHeight) {
      const restored = restoredHeights[activeWindow] ?? minHeight
      const nextHeight = restored < maxHeight ? Math.max(minHeight, restored) : minHeight
      save(activeWindow, nextHeight)
    } else {
      setRestoredHeights((current) => ({ ...current, [activeWindow]: height }))
      save(activeWindow, maxHeight)
    }
  }
  return { height, isMaxHeight, toggleHeight, resizeHandle: activeWindow ? {
    role: 'separator' as const, tabIndex: 0, 'aria-label': `Resize ${dockLabels[activeWindow]} dock`, 'aria-orientation': 'horizontal' as const,
    'aria-valuemin': minHeight, 'aria-valuemax': maxHeight, 'aria-valuenow': height, 'aria-valuetext': `${height} pixels high`,
    'data-resizing': resizingDock === activeWindow, onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag, onKeyDown,
  } : null }
}
export type BottomDockResizeHandle = NonNullable<ReturnType<typeof useBottomDockSize>['resizeHandle']>
