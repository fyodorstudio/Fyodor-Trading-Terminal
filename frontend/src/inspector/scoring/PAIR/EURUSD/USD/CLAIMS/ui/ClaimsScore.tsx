import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { supportsClaimsScore } from '../assessment/claims-features'
import { useClaimsAnalysis } from '../runtime/useClaimsAnalysis'
import { ClaimsScoreDetails } from './ClaimsScoreDetails'
import './claims-score.css'

export function ClaimsScore(props: InspectorScoringProps) {
  const { assessment, loading, error, storage } = useClaimsAnalysis(props)
  if (!supportsClaimsScore(props.release)) return null
  const direction = loading || error ? 'uncomputed' : assessment?.direction ?? 'uncomputed'
  return <div className="inspector-detail-overview inspector-scoring-view inspector-claims-v2" aria-label="Jobless Claims scoring system">
    <div className="inspector-claims-v2-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Jobless Claims pair direction">{loading || error ? 'Uncomputed' : assessment?.label ?? 'Uncomputed'}</strong>
      {!loading && !error && assessment?.strength && <span aria-label="Jobless Claims evidence strength" title="Agreement within this release; not expected price-move strength">{assessment.strength} evidence</span>}
      {!loading && !error && direction !== 'uncomputed' && assessment?.changeSize && <span aria-label="Jobless Claims change size">{assessment.changeSize}</span>}
      <span className="scoring-result-explanation">{loading ? 'Calculating Jobless Claims context…' : error ?? assessment?.explanation}</span>
      <small>Scoring system v2 · Experimental</small>
    </div>
    {error && <p role="alert">{error}</p>}
    {storage.error && <p role="alert">Jobless Claims history: {storage.error}</p>}
    {!loading && !error && assessment && <ClaimsScoreDetails assessment={assessment} />}
    {Object.values(storage.coverage).some(coverage => coverage.missing.length > 0) && <p>Partial calendar coverage; calibration uses the available observations.</p>}
  </div>
}
