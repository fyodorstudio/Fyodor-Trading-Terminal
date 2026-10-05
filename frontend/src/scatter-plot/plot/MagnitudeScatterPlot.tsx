import { useEffect, useId, useState, type CSSProperties } from 'react'
import { magnitudeSizeForValue } from '../../inspector/magnitude/magnitude-distribution'
import type { ScatterModel } from '../contracts/scatter-plot-types'
import { useScatterPlotInteraction } from './useScatterPlotInteraction'
import { defaultScatterAppearance, scatterGuideLevels, type ScatterAppearance } from '../settings/scatter-plot-appearance'

const date = (at: number) => new Date(at).toISOString().slice(0, 10)
export function MagnitudeScatterPlot({ model, zoom, onInspect, viewKey = '', appearance: a = defaultScatterAppearance }: {
  model: ScatterModel; zoom: boolean; onInspect: (releaseId: string) => void; viewKey?: string; appearance?: ScatterAppearance
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 900, height: 280 })
  useEffect(() => {
    if (!element) return
    const measure = () => setSize({ width: Math.max(320, element.clientWidth || 900), height: Math.max(210, element.clientHeight || 280) })
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [element])
  const { points, inspection, formatDelta, formatReading } = model
  const distribution = inspection?.distribution ?? null
  const { g, cursor, dragging, setSvg, svgEvents, onAxisKeyDown } = useScatterPlotInteraction(model, zoom, size.width, size.height, viewKey)
  const clipId = `scatter-clip-${useId().replace(/:/g, '')}`
  const quantileIds = [inspection?.quantile?.lower.id, inspection?.quantile?.upper.id]
  const currentIndex = points.findIndex((point) => point.releaseId === inspection?.releaseId)
  const guides = distribution && distribution.threshold > 0 ? scatterGuideLevels(a, distribution.threshold,
    distribution.source === 'custom' ? distribution.limits : undefined) : []
  return <div className="scatter-plot-canvas" ref={setElement}>
    <svg ref={setSvg} viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="Release date versus signed A−P scatter plot"
      className={dragging ? 'scatter-plot-dragging' : undefined}
      style={{ '--scatter-dot-color': a.dotColor, '--scatter-good-color': a.goodColor, '--scatter-bad-color': a.badColor, '--scatter-quantile-color': a.quantileColor } as CSSProperties}
      data-date-from={g.first} data-date-to={g.last} data-delta-from={g.minDelta} data-delta-to={g.maxDelta}
      {...svgEvents}
      onKeyDown={(event) => {
        const index = event.key === 'ArrowLeft' ? Math.max(0, currentIndex - 1) : event.key === 'ArrowRight' ? Math.min(points.length - 1, currentIndex + 1) :
          event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : null
        if (index === null || !points[index]) return
        event.preventDefault(); onInspect(points[index].releaseId)
      }}>
      <defs><clipPath id={clipId}><rect x={g.left} y={g.top} width={g.right - g.left} height={g.bottom - g.top} /></clipPath></defs>
      <rect className="scatter-plot-hit-area" x={g.left} y={g.top} width={g.right - g.left} height={g.bottom - g.top} />
      <g clipPath={`url(#${clipId})`}>
      {guides.map((level) => {
        const { inner, limit } = level
        return <g key={level.id} data-guide-level={level.id}>
          {a.showBands && [1, -1].map((sign) => <rect key={sign} className="scatter-plot-band" fill={level.color} fillOpacity={level.shade / 100}
            x={g.left} width={g.right - g.left} y={Math.min(g.y(sign * inner), g.y(sign * limit))}
            height={Math.abs(g.y(sign * limit) - g.y(sign * inner))} />)}
          {a.showGuides && [1, -1].map((sign) => <line key={sign} className="scatter-plot-cutoff" data-cutoff={sign * limit}
            stroke={level.color} strokeWidth={level.width} strokeOpacity={a.guideOpacity / 100}
            strokeDasharray={a.guideStyle === 'dashed' ? '3 4' : a.guideStyle === 'dotted' ? '1 3' : undefined}
            x1={g.left} x2={g.right} y1={g.y(sign * limit)} y2={g.y(sign * limit)}>
            <title>{distribution?.source === 'custom' ? `${['Small', 'Medium', 'Large'][level.id - 1]} boundary` :
              `Guide at ${Number((level.factor * 100).toFixed(6))}% of P95`}: {formatDelta(sign * limit)}</title>
          </line>)}
        </g>
      })}
      {a.grid.visible && g.deltaTicks.map((delta) => <g key={delta}>
        <line className="scatter-plot-grid" stroke={a.grid.color} strokeWidth={a.grid.width} x1={g.left} x2={g.right} y1={g.y(delta)} y2={g.y(delta)} />
      </g>)}
      {a.grid.visible && g.dateTicks.map((at) => <g key={at}>
        <line className="scatter-plot-grid" stroke={a.grid.color} strokeWidth={a.grid.width} x1={g.x(at)} x2={g.x(at)} y1={g.top} y2={g.bottom} />
      </g>)}
      {a.zero.visible && <line className="scatter-plot-zero" stroke={a.zero.color} strokeWidth={a.zero.width} x1={g.left} x2={g.right} y1={g.y(0)} y2={g.y(0)} />}
      {inspection && a.inspectedDate.visible && <line className="scatter-plot-inspected-date" data-inspected-at={inspection.at} stroke={a.inspectedDate.color} strokeWidth={a.inspectedDate.width}
        x1={g.x(inspection.at)} x2={g.x(inspection.at)} y1={g.top} y2={g.bottom} />}
      {points.map((point) => {
        const selected = point.releaseId === inspection?.releaseId
        const later = inspection ? point.at > inspection.at : false
        const offScale = point.delta < g.minDelta || point.delta > g.maxDelta
        const radius = (selected ? a.selectedDotSize : a.dotSize) / 2
        const category = inspection?.magnitudeMode === 'undefined' ? 'Magnitude undefined' : distribution ? magnitudeSizeForValue(distribution.limits, point.delta) : 'No earlier baseline'
        const details = `${date(point.at)}. Actual ${formatReading(point.actual)}; Previous ${formatReading(point.previous)}; A−P ${formatDelta(point.delta)}. ` +
          `${category}${distribution ? ' against inspected thresholds' : ''}. ${selected ? 'Inspected release; excluded from baseline.' : later ? 'Later release; excluded from baseline.' : 'Earlier release.'}` +
          (offScale ? ' Outside zoom range; marker is at the edge.' : '')
        return <g key={point.id} role="button" tabIndex={selected || (currentIndex < 0 && point === points[0]) ? 0 : -1}
          aria-label={details} aria-pressed={selected} data-point-id={point.id} data-release-id={point.releaseId}
          data-at={point.at} data-delta={point.delta} data-later={later} data-off-scale={offScale}
          className={`scatter-plot-point${selected ? ` scatter-plot-selected scatter-plot-tone-${point.tone}` : ''}${quantileIds.includes(point.id) ? ' scatter-plot-quantile' : ''}`}
          onClick={() => onInspect(point.releaseId)} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onInspect(point.releaseId) }
          }}>
          <title>{details}</title>
          <circle className="scatter-plot-point-target" cx={g.x(point.at)} cy={g.pointY(point.delta)} r={Math.max(8, radius + 3)} />
          {offScale ? <path className="scatter-plot-dot" d={point.delta > g.maxDelta ?
            `M ${g.x(point.at)} ${g.top} l ${-radius} ${radius * 2} h ${radius * 2} Z` : `M ${g.x(point.at)} ${g.bottom} l ${-radius} ${-radius * 2} h ${radius * 2} Z`} /> :
            <circle className="scatter-plot-dot" cx={g.x(point.at)} cy={g.y(point.delta)} r={radius} />}
        </g>
      })}
      </g>
      {g.deltaTicks.map((delta) => <text key={delta} className="scatter-plot-tick" x={g.left - 8} y={g.y(delta) + 3} textAnchor="end">{formatDelta(delta, 2)}</text>)}
      {g.dateTicks.map((at, index) => <text key={at} className="scatter-plot-tick" x={g.x(at)} y={g.bottom + 18}
        textAnchor={index === 0 ? 'start' : index === g.dateTicks.length - 1 ? 'end' : 'middle'}>{date(at)}</text>)}
      <text className="scatter-plot-axis-label" x={(g.left + g.right) / 2} y={size.height - 6} textAnchor="middle">Release date (UTC)</text>
      <text className="scatter-plot-axis-label" transform={`translate(13 ${(g.top + g.bottom) / 2}) rotate(-90)`} textAnchor="middle">A−P / Delta</text>
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
}
