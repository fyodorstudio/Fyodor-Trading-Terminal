import type { ReactNode } from 'react'
import type { ScatterModel } from '../contracts/scatter-plot-types'

const date = (at: number) => new Date(at).toISOString().slice(0, 10)
export function MagnitudeCalculationDetails({ model, seriesLabel, children, preview = false }: { model: ScatterModel; seriesLabel: string; children?: ReactNode; preview?: boolean }) {
  const { inspection, formatDelta, formatReading } = model
  if (!inspection) return null
  const { distribution: d } = inspection
  const magnitude = (value: number) => formatDelta(value).replace(/^\+/, '')
  return <aside className="scatter-plot-inspection" aria-label="Magnitude calculation">
    <strong>{seriesLabel}</strong>
    <time>{date(inspection.at)}</time>
    <dl>
      <div><dt>Actual</dt><dd>{formatReading(inspection.actual)}</dd></div>
      <div><dt>Previous</dt><dd>{formatReading(inspection.previous)}</dd></div>
      <div><dt>A−P</dt><dd>{formatDelta(inspection.delta)}</dd></div>
      <div><dt>Size</dt><dd>{inspection.delta === null ? 'Unavailable' : inspection.magnitudeMode === 'undefined' ? 'Undefined' : d?.currentSize ?? 'No usable dataset'}</dd></div>
      <div><dt>Earlier / All</dt><dd data-sample-count={inspection.samples.length}>{inspection.earlierCount} / {inspection.samples.length}</dd></div>
      {inspection.excluded > 0 && <div><dt>Excluded publications</dt><dd>{inspection.excluded}</dd></div>}
      {d && <>
        <div><dt>{preview ? 'Preview outer boundary' : 'Frozen outer boundary'}</dt><dd data-threshold={d.threshold}>{magnitude(d.threshold)}</dd></div>
        <div><dt>Small</dt><dd>0 &lt; |Δ| ≤ {magnitude(d.limits[0])}</dd></div>
        <div><dt>Medium</dt><dd>{magnitude(d.limits[0])} &lt; |Δ| ≤ {magnitude(d.limits[1])}</dd></div>
        <div><dt>Large</dt><dd>{magnitude(d.limits[1])} &lt; |Δ| ≤ {magnitude(d.threshold)}</dd></div>
        <div><dt>Extreme</dt><dd>|Δ| &gt; {magnitude(d.threshold)}</dd></div>
      </>}
    </dl>
    {children}
  </aside>
}
