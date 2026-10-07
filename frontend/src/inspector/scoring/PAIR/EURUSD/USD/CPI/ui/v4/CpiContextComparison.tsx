import type { compareCpiPublication } from '../../../../../../../../usd-context/core/publication-comparison'
import type { ReactNode } from 'react'
import type { ContextFamily } from '../../../../../../../../usd-context/core/contracts'
import { contextResultLabel, contextResultTone } from '../../../../../../../../usd-context/core/usd-pair'
import { ScoringSection } from '../../../../../../shared/ui/ScoringSection'

export function CpiContextComparison({ comparison, loading, error, families, controls }: {
  comparison: ReturnType<typeof compareCpiPublication>; loading: boolean; error: string | null; families: readonly ContextFamily[]; controls?: ReactNode
}) {
  const unavailable = loading || !!error || comparison.before === null && comparison.after === null
  const before = comparison.before?.result, after = comparison.after?.result
  const label = unavailable ? 'Uncomputed' : contextResultLabel('EURUSD', after)
  const direction = unavailable || !after ? 'uncomputed' : contextResultTone(after)
  return <section aria-label="CPI v4 publication context">
    <div className="inspector-cpi-v4-summary"><strong className={`inspector-majority inspector-direction-${direction}`} aria-label="CPI v4 combined direction">{label}</strong>
      {!unavailable && after?.strength && <span>{after.strength} context evidence</span>}</div>
    {controls}
    <h3>Combined context after publication</h3>
    <p>{loading ? 'Calculating publication context…' : error ?? (!families.length ? 'Enable a context input to calculate the combined bias.' : after?.explanation ?? comparison.explanation)}</p>
    {!unavailable && <ScoringSection title="What changed at publication">
      <p aria-label="CPI v4 previous context">Before publication: {contextResultLabel('EURUSD', before)}{before?.strength ? ` · ${before.strength} evidence` : ''}.</p>
      <p aria-label="CPI v4 context change">{comparison.explanation}</p>
      {after && <p>{after.reason}</p>}
    </ScoringSection>}
  </section>
}
