import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { BottomDockWindow } from './bottom-dock-window'

export const inspectorDockHeightKey = 'fyodor.inspector.dock-height.v1'
const defaultInspectorHeight = 380
function readHeight() {
  try {
    const stored = localStorage.getItem(inspectorDockHeightKey)
    const height = stored === null ? NaN : Number(stored)
    return Number.isFinite(height) && height > 0 ? height : defaultInspectorHeight
  } catch { return defaultInspectorHeight }
}

export function useBottomDockSize(activeWindow: BottomDockWindow | null) {
  const [preferredHeight, setPreferredHeight] = useState(readHeight)
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)
  const [resizing, setResizing] = useState(false)
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number; height: number } | null>(null)
  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const maxHeight = Math.max(140, Math.floor(Math.min(viewportHeight * .65, viewportHeight - 240)))
  const minHeight = Math.min(240, maxHeight)
  const clamp = (height: number) => Math.max(minHeight, Math.min(maxHeight, Math.round(height)))
  const height = activeWindow === 'inspector' ? clamp(preferredHeight) : 258
  function save(nextHeight: number) {
    setPreferredHeight(nextHeight)
    try { localStorage.setItem(inspectorDockHeightKey, String(nextHeight)) }
    catch { /* Resizing remains available for this session. */ }
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: height, height }
    setResizing(true)
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
    setResizing(false)
    save(current.height)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = event.key === 'ArrowUp' ? height + 24 : event.key === 'ArrowDown' ? height - 24 :
      event.key === 'Home' ? minHeight : event.key === 'End' ? maxHeight : null
    if (next === null) return
    event.preventDefault()
    save(clamp(next))
  }
  return { height, resizeHandle: activeWindow === 'inspector' ? {
    role: 'separator' as const, tabIndex: 0, 'aria-label': 'Resize Inspector dock', 'aria-orientation': 'horizontal' as const,
    'aria-valuemin': minHeight, 'aria-valuemax': maxHeight, 'aria-valuenow': height, 'aria-valuetext': `${height} pixels high`,
    'data-resizing': resizing, onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag, onKeyDown,
  } : null }
}
export type BottomDockResizeHandle = NonNullable<ReturnType<typeof useBottomDockSize>['resizeHandle']>
