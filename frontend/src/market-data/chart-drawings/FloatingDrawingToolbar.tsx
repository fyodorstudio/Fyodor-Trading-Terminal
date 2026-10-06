import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { drawingTools, type DrawingToolId } from './drawing-tool'
import {
  readFloatingToolbarPosition,
  saveFloatingToolbarPosition,
  type FloatingToolbarPosition,
} from './floating-toolbar-position'
import './floating-drawing-toolbar.css'

type FloatingDrawingToolbarProps = {
  activeTool: DrawingToolId | null
  drawingCount: number
  onSelectCrosshair: () => void
  onToolChange: (tool: DrawingToolId | null) => void
  onClearAll: () => void
}

export function FloatingDrawingToolbar({
  activeTool,
  drawingCount,
  onSelectCrosshair,
  onToolChange,
  onClearAll,
}: FloatingDrawingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<FloatingToolbarPosition>(readFloatingToolbarPosition)
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)

  useEffect(() => {
    const toolbar = toolbarRef.current
    const container = toolbar?.parentElement
    if (!toolbar || !container) return

    const keepToolbarVisible = () => {
      const containerRect = container.getBoundingClientRect()
      const toolbarRect = toolbar.getBoundingClientRect()
      setPosition((current) => {
        const next = {
          x: Math.min(Math.max(0, current.x), Math.max(0, containerRect.width - toolbarRect.width)),
          y: Math.min(Math.max(0, current.y), Math.max(0, containerRect.height - toolbarRect.height)),
        }
        if (next.x === current.x && next.y === current.y) return current
        saveFloatingToolbarPosition(next)
        return next
      })
    }

    const resizeObserver = new ResizeObserver(keepToolbarVisible)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!deleteConfirmationOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDeleteConfirmationOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [deleteConfirmationOpen])

  const startDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const toolbar = toolbarRef.current
    const container = toolbar?.parentElement
    if (!toolbar || !container) return

    event.preventDefault()
    const pointerId = event.pointerId
    const startPointer = { x: event.clientX, y: event.clientY }
    const startPosition = position
    const containerRect = container.getBoundingClientRect()
    const toolbarRect = toolbar.getBoundingClientRect()
    event.currentTarget.setPointerCapture(pointerId)

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      setPosition({
        x: Math.min(
          Math.max(0, startPosition.x + moveEvent.clientX - startPointer.x),
          Math.max(0, containerRect.width - toolbarRect.width),
        ),
        y: Math.min(
          Math.max(0, startPosition.y + moveEvent.clientY - startPointer.y),
          Math.max(0, containerRect.height - toolbarRect.height),
        ),
      })
    }

    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      setPosition((current) => {
        saveFloatingToolbarPosition(current)
        return current
      })
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const clearDrawings = () => {
    onClearAll()
    setDeleteConfirmationOpen(false)
  }

  return (
    <div
      ref={toolbarRef}
      className="floating-drawing-toolbar"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      aria-label="Chart drawing tools"
    >
      <button
        className="drawing-toolbar-handle"
        type="button"
        onPointerDown={startDragging}
        aria-label="Move drawing toolbar"
        title="Hold and drag to move toolbar"
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <button
        className={activeTool === null ? 'drawing-toolbar-crosshair active' : 'drawing-toolbar-crosshair'}
        type="button"
        onClick={onSelectCrosshair}
        aria-pressed={activeTool === null}
        aria-label="Crosshair and chart navigation"
        title="Crosshair · deselect drawing tool"
      >
        <span className="crosshair-glyph" aria-hidden="true" />
      </button>
      {drawingTools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={activeTool === tool.id ? 'active' : ''}
          onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
          aria-pressed={activeTool === tool.id}
          aria-label={tool.label}
          title={`${tool.label}${activeTool === tool.id ? ' · click again to return to chart navigation' : ''}`}
        >
          <span aria-hidden="true">{tool.icon}</span>
        </button>
      ))}

      <span className="drawing-toolbar-separator" aria-hidden="true" />
      <button
        className="drawing-toolbar-trash"
        type="button"
        onClick={() => setDeleteConfirmationOpen((open) => !open)}
        disabled={drawingCount === 0}
        aria-expanded={deleteConfirmationOpen}
        aria-label="Delete all drawings"
        title={drawingCount === 0 ? 'No saved drawings' : `Delete all ${drawingCount} saved drawings`}
      >
        <span aria-hidden="true">⌫</span>
      </button>
      {deleteConfirmationOpen && (
        <div className="drawing-delete-popover" role="dialog" aria-label="Delete all drawings confirmation">
          <strong>Delete all drawings?</strong>
          <span>{drawingCount} saved drawing{drawingCount === 1 ? '' : 's'} will be removed.</span>
          <div>
            <button type="button" onClick={() => setDeleteConfirmationOpen(false)}>Cancel</button>
            <button className="confirm-delete" type="button" onClick={clearDrawings}>Delete all</button>
          </div>
        </div>
      )}
    </div>
  )
}
