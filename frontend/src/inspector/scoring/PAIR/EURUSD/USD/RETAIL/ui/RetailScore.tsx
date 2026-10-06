import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { supportsRetailScore } from '../assessment/retail-features'
import { useRetailAnalysis } from '../runtime/useRetailAnalysis'
import { RetailScoreDetails } from './RetailScoreDetails'
import './retail-score.css'

export function RetailScore(props: InspectorScoringProps) {
  const { assessment, loading, error, storage } = useRetailAnalysis(props)
  if (!supportsRetailScore(props.release)) return null
  const direction = loading || error ? 'uncomputed' : assessment?.direction ?? 'uncomputed'
  return <div className="inspector-detail-overview inspector-scoring-view inspector-retail-v1" aria-label="Retail Sales scoring system">
    <div className="inspector-retail-v1-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Retail Sales pair direction">{loading || error ? 'Uncomputed' : assessment?.label ?? 'Uncomputed'}</strong>
      {!loading && !error && assessment?.strength && <span aria-label="Retail Sales evidence strength">{assessment.strength} evidence</span>}
      {!loading && !error && direction !== 'uncomputed' && assessment?.changeSize && <span aria-label="Retail Sales change size">{assessment.changeSize}</span>}
      <span>{loading ? 'Calculating Retail Sales context…' : error ?? assessment?.explanation}</span>
      <small>Scoring system v1 · Experimental</small>
    </div>
    {error && <p role="alert">{error}</p>}
    {storage.error && <p role="alert">Retail Sales history: {storage.error}</p>}
    {!loading && !error && assessment && <RetailScoreDetails assessment={assessment} />}
    {Object.values(storage.coverage).some(coverage => coverage.missing.length > 0) && <p>Partial calendar coverage; calibration uses the available observations.</p>}
  </div>
}
