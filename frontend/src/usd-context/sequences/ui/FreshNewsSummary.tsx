import type { FreshPoint } from '../../../scoring-system/relationships/contracts'
import { contextResultLabel } from '../../../scoring-system/context/usd/usd-pair'

export function FreshNewsSummary({ point, symbol }: { point: FreshPoint | null; symbol: string }) {
  return <section className="raycaster-section" aria-label="Experimental fresh news">
    <h3>Fresh-news change · Experimental</h3>
    <strong>{point ? `${contextResultLabel(symbol, point)}${point.decision?.state === 'directional' ? ' · Weak evidence' : ''}` : 'No comparable update in the seven-day window'}</strong>
    <p>{point?.explanation ?? 'Hover a candle to inspect recent publication changes.'}</p>
    <p>Compares each family’s latest derived features with its predecessor under the latest release’s calibration, at the same base weight and component membership. Both require at least 60% usable components. Calibration drift, renewal, changed coverage and an unknown predecessor add no directional change vote. This is a change in interpreted support, separate from the standalone bias and a native-unit economic change.</p>
  </section>
}
