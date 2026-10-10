import type { ReactNode } from 'react'
import type { ScatterModel } from '../contracts/scatter-plot-types'

import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
export function MagnitudeCalculationDetails({ model, seriesLabel, children, preview = false,r1=false }: { model: ScatterModel; seriesLabel: string; children?: ReactNode; preview?: boolean;r1?:boolean }) {
  const { inspection, formatDelta, formatReading } = model
  const { date } = useDisplayClock()
  if (!inspection) return null
  const { distribution: d } = inspection
  const signal = inspection.signal
  const magnitude = (value: number) => formatDelta(value).replace(/^\+/, '')
  return <aside className="scatter-plot-inspection" aria-label="Magnitude calculation">
    <strong>{seriesLabel}</strong>
    <time>{date(inspection.at)}</time>
    {signal && !r1 && <>
      <p>{model.description}</p>
      <p>Positive → USD supportive · Negative → USD adverse. This component is combined with the other weighted signals in the Inspector.</p>
      {signal.reason && <p role="status">{signal.reason}</p>}
      {preview && <p role="status">Unsaved chart preview · Inspector still uses saved boundaries.</p>}
    </>}
    <dl>
      <div><dt>{signal?.inputs?.actualLabel ?? 'Actual'}</dt><dd>{formatReading(inspection.actual)}</dd></div>
      <div><dt>{signal?.inputs?.baselineLabel ?? 'Previous'}</dt><dd>{formatReading(inspection.previous)}</dd></div>
      <div><dt>{signal ? 'Scorer comparison' : 'A−P'}</dt><dd>{formatDelta(inspection.delta)}</dd></div>
      <div><dt>Size</dt><dd>{signal ? signal.size ?? 'Unavailable' : inspection.delta === null ? 'Unavailable' : inspection.magnitudeMode === 'undefined' ? 'Undefined' : d?.currentSize ?? 'No usable dataset'}</dd></div>
      {signal && <>{!r1&&<div><dt>Magnitude source</dt><dd>{preview ? 'Manual preview' : signal.magnitudeMode === 'automatic' ? 'Automatic · earlier history' : 'Saved manual override'}</dd></div>}
        <div><dt>Calibration N</dt><dd>{signal.sampleCount}</dd></div></>}
      <div><dt>Earlier / All</dt><dd data-sample-count={inspection.samples.length}>{inspection.earlierCount} / {inspection.samples.length}</dd></div>
      {inspection.excluded > 0 && <div><dt>Excluded publications</dt><dd>{inspection.excluded}</dd></div>}
      {d && <>
        <div><dt>{preview ? 'Preview outer boundary' : signal ? 'Selected release outer boundary' : 'Frozen outer boundary'}</dt><dd data-threshold={d.threshold}>{magnitude(d.threshold)}</dd></div>
        <div><dt>Small</dt><dd>0 &lt; |Δ| ≤ {magnitude(d.limits[0])}</dd></div>
        <div><dt>Medium</dt><dd>{magnitude(d.limits[0])} &lt; |Δ| ≤ {magnitude(d.limits[1])}</dd></div>
        <div><dt>Large</dt><dd>{magnitude(d.limits[1])} &lt; |Δ| ≤ {magnitude(d.threshold)}</dd></div>
        <div><dt>Extreme</dt><dd>|Δ| &gt; {magnitude(d.threshold)}</dd></div>
      </>}
    </dl>
    {signal && !r1 && <p>Dots after this release provide chart context and do not enter its calibration. Each dot’s tooltip uses its own earlier-history classification. Missing inputs create gaps; early signals remain visible before they have enough history to score.</p>}
    {children}
  </aside>
}
