import type { IsmAnalysis } from '../../runtime/ism-analysis'
import { format } from '../presentation'
export function IsmContextSummary({ analysis, loading, timestamp, error }: {
  analysis: IsmAnalysis | null; loading: boolean; timestamp: (at: number | null) => string; error?: string | null
}) {
  const resolved = analysis?.resolution
  return <section aria-label={'ISM v3 final context'}>
    <div className="inspector-ism-v3-summary">
      <strong className={`inspector-majority inspector-direction-${loading ? 'uncomputed' : resolved?.direction ?? 'uncomputed'}`}
        aria-label={'ISM v3 final pair direction'}>{loading || error ? 'Uncomputed' : resolved?.label ?? 'Pending'}</strong>
      {!loading && resolved?.strength && <span>{resolved.strength} evidence</span>}
      {!loading && resolved?.changeSize && <span>{resolved.changeSize}</span>}

    </div>
    <small className="scoring-engine-version">Scoring system v3 · Experimental</small>
    <p>{loading ? 'Calculating ISM context…' : resolved?.dominance ?? 'No published context is available yet.'}</p>
    {!loading && resolved && <>
      <p>As of {timestamp(resolved.asOf)} · Services contribution {format(resolved.servicesContribution)} · Manufacturing contribution {format(resolved.manufacturingContribution)}</p>
      <p>{resolved.strengthReason}</p>
      {resolved.reduced && <p>Incomplete context: pending or excluded components receive no redistributed weight.</p>}
    </>}
  </section>
}
