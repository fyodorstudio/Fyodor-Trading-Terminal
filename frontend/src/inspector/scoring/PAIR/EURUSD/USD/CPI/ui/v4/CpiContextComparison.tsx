import type { compareCpiPublication } from '../../../../../../../../usd-context/core/publication-comparison'
import type { ContextFamily } from '../../../../../../../../usd-context/core/contracts'
import { contextPairLabel } from '../../../../../../../../usd-context/core/usd-pair'

export function CpiContextComparison({ comparison, loading, error, families }: {
  comparison: ReturnType<typeof compareCpiPublication>; loading: boolean; error: string | null; families: readonly ContextFamily[]
}) {
  const unavailable = loading || !!error || comparison.before === null && comparison.after === null
  const before = comparison.before?.result, after = comparison.after?.result
  const label = unavailable ? 'Uncomputed' : contextPairLabel('EURUSD', after?.direction ?? 'uncomputed')
  const direction = unavailable || !after ? 'uncomputed' : after.direction === 'stronger' ? 'short' : after.direction === 'weaker' ? 'long' : 'uncomputed'
  return <section aria-label="CPI v4 publication context">
    <h3>Combined context after publication</h3>
    <div className="inspector-cpi-v4-summary"><strong className={`inspector-majority inspector-direction-${direction}`} aria-label="CPI v4 combined direction">{label}</strong>
      {!unavailable && after?.strength && <span>{after.strength} context evidence</span>}</div>
    <p>{loading ? 'Calculating publication context…' : error ?? (!families.length ? 'Enable a context input to calculate the combined bias.' : after?.explanation ?? comparison.explanation)}</p>
    {!unavailable && <>
      <p aria-label="CPI v4 previous context">Before publication: {contextPairLabel('EURUSD', before?.direction ?? 'uncomputed')}{before?.strength ? ` · ${before.strength} evidence` : ''}.</p>
      <p aria-label="CPI v4 context change">{comparison.explanation}</p>
      {after && <p>{after.reason}</p>}
    </>}
  </section>
}
