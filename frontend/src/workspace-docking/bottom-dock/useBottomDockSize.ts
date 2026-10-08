import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { BottomDockWindow } from './bottom-dock-window'
import { bottomDockHeightKey, readBottomDockHeight, saveBottomDockHeight } from './bottom-dock-height'

const dockLabels: Record<BottomDockWindow, string> = { inspector: 'Inspector', roofs: 'Roofs', notebook: 'Notebook', activity: 'Activity', 'scatter-plot': 'Scatter Plot', alert: 'Alert' }

export function useBottomDockSize(activeWindow: BottomDockWindow | null) {
  const [preferredHeight, setPreferredHeight] = useState(() => readBottomDockHeight(activeWindow))
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
    const current = drag.current
    if (current && current.dock !== activeWindow) {
      drag.current = null
      setPreferredHeight(current.startHeight)
      if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
    }
  }, [activeWindow])
  useEffect(() => () => {
    const current = drag.current
    drag.current = null
    if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId)
  }, [])
  useEffect(() => {
    const restore = (event: StorageEvent) => {
      if (event.key === bottomDockHeightKey || event.key === null) setPreferredHeight(readBottomDockHeight(activeWindow))
    }
    window.addEventListener('storage', restore)
    return () => window.removeEventListener('storage', restore)
  }, [activeWindow])
  const maxHeight = Math.max(140, Math.floor(Math.min(viewportHeight * .65, viewportHeight - 240)))
  const minHeight = Math.min(240, maxHeight)
  const clamp = (height: number) => Math.max(minHeight, Math.min(maxHeight, Math.round(height)))
  const height = clamp(preferredHeight)
  function save(nextHeight: number) {
    setPreferredHeight(nextHeight)
    try { saveBottomDockHeight(nextHeight) }
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
    setPreferredHeight(current.height)
  }
  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    drag.current = null
    setResizingDock(null)
    save(current.height)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!activeWindow) return
    const next = event.key === 'ArrowUp' ? height + 24 : event.key === 'ArrowDown' ? height - 24 :
      event.key === 'Home' ? minHeight : event.key === 'End' ? maxHeight : null
    if (next === null) return
    event.preventDefault()
    save(clamp(next))
  }
  return { height, resizeHandle: activeWindow ? {
    role: 'separator' as const, tabIndex: 0, 'aria-label': `Resize ${dockLabels[activeWindow]} dock`, 'aria-orientation': 'horizontal' as const,
    'aria-valuemin': minHeight, 'aria-valuemax': maxHeight, 'aria-valuenow': height, 'aria-valuetext': `${height} pixels high`,
    'data-resizing': resizingDock === activeWindow, onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag, onKeyDown,
  } : null }
}
export type BottomDockResizeHandle = NonNullable<ReturnType<typeof useBottomDockSize>['resizeHandle']>
