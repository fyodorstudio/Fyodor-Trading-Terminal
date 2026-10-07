import type { FreshPoint } from '../core/contracts'
import { contextPairLabel } from '../../core/usd-pair'

export function FreshNewsSummary({ point, symbol }: { point: FreshPoint | null; symbol: string }) {
  return <section className="raycaster-section" aria-label="Experimental fresh news">
    <h3>Fresh-news change · Experimental</h3>
    <strong>{point?.direction !== 'uncomputed' && point ? `${contextPairLabel(symbol, point.direction)} · Weak evidence` : 'No directional update in the seven-day window'}</strong>
    <p>{point?.explanation ?? 'Hover a candle to inspect recent publication changes.'}</p>
    <p>Compares each family’s latest new vote with the vote it replaced, using the same base weight on both. This is a change in interpreted support, not the standalone release bias or an extra vote.</p>
  </section>
}
