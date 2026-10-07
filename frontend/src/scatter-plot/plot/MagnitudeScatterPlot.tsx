import { memo, useEffect, useId, useState, type CSSProperties } from 'react'
import type { ScatterModel } from '../contracts/scatter-plot-types'
import { useScatterPlotInteraction } from './useScatterPlotInteraction'
import { defaultScatterAppearance, type ScatterAppearance } from '../settings/scatter-plot-appearance'
import { ScatterPlotLayer } from './ScatterPlotLayer'
import type { ScatterAxisRange } from './scatter-plot-geometry'

export const MagnitudeScatterPlot = memo(function MagnitudeScatterPlot({ model, zoom, onInspect, viewKey = '', appearance: a = defaultScatterAppearance, dateWindow, dateResetKey }: {
  model: ScatterModel; zoom: boolean; onInspect: (releaseId: string) => void; viewKey?: string; appearance?: ScatterAppearance
  dateWindow?: ScatterAxisRange; dateResetKey?: string
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 900, height: 280 })
  useEffect(() => {
    if (!element) return
    const measure = () => {
      const width = Math.max(320, element.clientWidth || 900), height = Math.max(210, element.clientHeight || 280)
      setSize((current) => current.width === width && current.height === height ? current : { width, height })
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [element])
  const { points, inspection, formatDelta } = model
  const { g, cursor, dragging, setSvg, svgEvents, onAxisKeyDown } = useScatterPlotInteraction(model, zoom, size.width, size.height, viewKey, dateWindow, dateResetKey)
  const clipId = `scatter-clip-${useId().replace(/:/g, '')}`
  const currentIndex = points.findIndex((point) => point.releaseId === inspection?.releaseId)
  return <div className="scatter-plot-canvas" ref={setElement}>
    <svg ref={setSvg} viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={model.measure === 'signal' ? 'Release date versus scoring signal scatter plot' : 'Release date versus signed A−P scatter plot'}
      className={dragging ? 'scatter-plot-dragging' : undefined}
      style={{ '--scatter-dot-color': a.dotColor, '--scatter-higher-color': a.higherColor, '--scatter-lower-color': a.lowerColor } as CSSProperties}
      data-date-from={g.first} data-date-to={g.last} data-delta-from={g.minDelta} data-delta-to={g.maxDelta}
      {...svgEvents}
      onKeyDown={(event) => {
        const index = event.key === 'ArrowLeft' ? Math.max(0, currentIndex - 1) : event.key === 'ArrowRight' ? Math.min(points.length - 1, currentIndex + 1) :
          event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : null
        if (index === null || !points[index]) return
        event.preventDefault(); onInspect(points[index].releaseId)
      }}>
      <ScatterPlotLayer model={model} g={g} appearance={a} clipId={clipId} height={size.height} onInspect={onInspect} />
      <rect className="scatter-plot-axis-hit scatter-plot-axis-x" data-scale-axis="x" role="button" tabIndex={0}
        aria-label="Date axis zoom. Drag horizontally or scroll to zoom; double-click or press 0 to reset. Plus and minus also zoom."
        x={g.left} y={g.bottom} width={g.right - g.left} height={size.height - g.bottom}
        onKeyDown={(event) => onAxisKeyDown('x', event)}>
        <title>Drag horizontally or scroll to zoom date · Double-click to reset</title>
      </rect>
      <rect className="scatter-plot-axis-hit scatter-plot-axis-y" data-scale-axis="y" role="button" tabIndex={0}
        aria-label="Delta axis zoom. Drag vertically or scroll to zoom; double-click or press 0 to reset. Plus and minus also zoom."
        x={0} y={g.top} width={g.left} height={g.bottom - g.top}
        onKeyDown={(event) => onAxisKeyDown('y', event)}>
        <title>Drag vertically or scroll to zoom delta · Double-click to reset</title>
      </rect>
      {cursor && <g className="scatter-plot-crosshair" aria-hidden="true" data-crosshair-date={g.dateAt(cursor.x)} data-crosshair-delta={g.deltaAt(cursor.y)}>
        <line x1={cursor.x} x2={cursor.x} y1={g.top} y2={g.bottom} />
        <line x1={g.left} x2={g.right} y1={cursor.y} y2={cursor.y} />
        <rect x={4} y={Math.max(g.top, Math.min(g.bottom - 18, cursor.y - 9))} width={g.left - 8} height={18} rx={2} />
        <text x={g.left / 2} y={Math.max(g.top + 12, Math.min(g.bottom - 6, cursor.y + 3))} textAnchor="middle">{formatDelta(g.deltaAt(cursor.y), 2)}</text>
        <g transform={`translate(${Math.max(g.left, Math.min(g.right - 112, cursor.x - 56))} ${g.bottom + 2})`}>
          <rect width={112} height={18} rx={2} />
          <text x={56} y={12} textAnchor="middle">{new Date(g.dateAt(cursor.x)).toISOString().slice(0, 16).replace('T', ' ')}</text>
        </g>
      </g>}
    </svg>
  </div>
})
