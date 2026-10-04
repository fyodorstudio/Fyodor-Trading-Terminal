import type { ReactNode } from 'react'
import type { ScatterModel } from '../contracts/scatter-plot-types'

const date = (at: number) => new Date(at).toISOString().slice(0, 10)
export function MagnitudeCalculationDetails({ model, seriesLabel, children }: { model: ScatterModel; seriesLabel: string; children?: ReactNode }) {
  const { inspection, formatDelta, formatReading } = model
  if (!inspection) return null
  const { distribution: d, quantile } = inspection
  const magnitude = (value: number) => formatDelta(value).replace(/^\+/, '')
  return <aside className="scatter-plot-inspection" aria-label="Magnitude calculation">
    <strong>{seriesLabel}</strong>
    <time>{date(inspection.at)}</time>
    <dl>
      <div><dt>Actual</dt><dd>{formatReading(inspection.actual)}</dd></div>
      <div><dt>Previous</dt><dd>{formatReading(inspection.previous)}</dd></div>
      <div><dt>A−P</dt><dd>{formatDelta(inspection.delta)}</dd></div>
      <div><dt>Size</dt><dd>{inspection.delta === null ? 'Unavailable' : d?.currentSize ?? 'No earlier baseline'}</dd></div>
      <div><dt>Earlier readings</dt><dd data-sample-count={d?.count ?? 0}>{d?.count ?? 0}</dd></div>
      {inspection.excluded > 0 && <div><dt>Excluded publications</dt><dd>{inspection.excluded}</dd></div>}
      {d && <>
        <div><dt>{d.source === 'custom' ? 'Custom outer boundary' : 'P95 of |A−P|'}</dt><dd data-threshold={d.threshold}>{magnitude(d.threshold)}</dd></div>
        <div><dt>Small</dt><dd>0 &lt; |Δ| ≤ {magnitude(d.limits[0])}</dd></div>
        <div><dt>Medium</dt><dd>{magnitude(d.limits[0])} &lt; |Δ| ≤ {magnitude(d.limits[1])}</dd></div>
        <div><dt>Large</dt><dd>{magnitude(d.limits[1])} &lt; |Δ| ≤ {magnitude(d.threshold)}</dd></div>
        <div><dt>Extreme</dt><dd>|Δ| &gt; {magnitude(d.threshold)}</dd></div>
      </>}
    </dl>
    {children}
    {quantile && d?.source === 'p95' && <details>
      <summary>P95 calculation</summary>
      <p>Sort earlier |A−P| from smallest to largest, including zeros and extremes.</p>
      <dl>
        <div><dt>Position (index from 0)</dt><dd>({d.count} − 1) × 0.95 = {quantile.position}</dd></div>
        <div><dt>Lower value</dt><dd>{magnitude(Math.abs(quantile.lower.delta))} · {date(quantile.lower.at)}</dd></div>
        <div><dt>Upper value</dt><dd>{magnitude(Math.abs(quantile.upper.delta))} · {date(quantile.upper.at)}</dd></div>
        <div><dt>Interpolation fraction</dt><dd>{quantile.fraction}</dd></div>
      </dl>
      <p>{magnitude(Math.abs(quantile.lower.delta))} + ({magnitude(Math.abs(quantile.upper.delta))} − {magnitude(Math.abs(quantile.lower.delta))}) × {quantile.fraction} = {magnitude(d.threshold)}</p>
    </details>}
  </aside>
}
