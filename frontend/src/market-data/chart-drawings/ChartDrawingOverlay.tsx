import { ChartDrawingShape } from './ChartDrawingShape'
import { ChartDrawingSelectionHandles } from './ChartDrawingSelectionHandles'
import type { ChartDrawingOverlayProps } from './interaction/drawing-overlay-contract'
import { useDrawingInteraction } from './interaction/useDrawingInteraction'
import { InlineTextEditor } from './interaction/InlineTextEditor'
import './chart-drawing-overlay.css'

export function ChartDrawingOverlay(props: ChartDrawingOverlayProps) {
  const { activeTool, cancelInteraction, clipId, continueInteraction, crosshair, draft, draftDrawing, drawings, editingTextId, finishInteraction, handleContextMenu, onDeleteDrawing, onDeleteSelectedDrawing, onSelectDrawing, onUpdateDrawingText, overlayRef, precision, selectedDrawingId, setEditingTextId, startHandleEdit, startInteraction, toScreenPoints, viewport } = useDrawingInteraction(props)
  return (
    <svg
      ref={overlayRef}
      className={`chart-drawing-overlay${activeTool ? ' drawing-active' : ''}`}
      onPointerDown={startInteraction}
      onPointerEnter={crosshair.move}
      onPointerMove={event => { crosshair.move(event); continueInteraction(event) }}
      onPointerLeave={crosshair.leave}
      onPointerUp={finishInteraction}
      onPointerCancel={cancelInteraction}
      onLostPointerCapture={cancelInteraction}
      onContextMenu={handleContextMenu}
      onDoubleClick={event => {
        // Pointer capture can retarget a double-click from a text hit/handle
        // to the SVG. Preserve editing in that case as well.
        const selected = drawings.find(drawing => drawing.id === selectedDrawingId)
        if (selected?.tool === 'text') { event.stopPropagation(); setEditingTextId(selected.id) }
      }}
      aria-label={activeTool ? `Draw with ${activeTool}` : 'Saved chart drawings'}
    >
      <defs>
        <clipPath id={clipId}><rect width={viewport.width || '100%'} height={viewport.height || '100%'} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
      {drawings.map((drawing) => {
        const screenPoints = toScreenPoints(drawing)
        const selected = drawing.id === selectedDrawingId
        return (
          <g
            key={drawing.id}
            className={`drawing-object${selected ? ' selected' : ''}`}
            data-drawing-id={drawing.id}
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
              key={drawing.id}
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
