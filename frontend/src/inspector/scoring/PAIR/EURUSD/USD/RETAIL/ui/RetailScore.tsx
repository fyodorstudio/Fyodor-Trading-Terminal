import { useContext } from 'react'
import { StandaloneScoreTable } from '../../../../../shared/ui/StandaloneScoreTable'
import { ScoringSurface } from '../../../../../shared/ui/scoring-surface'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { supportsRetailScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/RETAIL/assessment/retail-features'
import { useRetailAnalysis } from '../runtime/useRetailAnalysis'
import { RetailScoreDetails } from './RetailScoreDetails'
import './retail-score.css'

export function RetailScore(props: InspectorScoringProps) {
  const { assessment, loading, error, storage } = useRetailAnalysis(props)
  const plain = useContext(ScoringSurface) === 'standalone'
  if (!supportsRetailScore(props.release)) return null
  const direction = loading || error ? 'uncomputed' : assessment?.direction ?? 'uncomputed'
  if (plain) return <StandaloneScoreTable assessment={assessment} rows={assessment?.readings} supporting={assessment?.supporting}
    loading={loading} error={error} historyError={storage.error} partial={Object.values(storage.coverage).some(c => c.missing.length > 0)}
    label="Retail Sales component scores" directionLabel="Retail Sales pair direction" evidenceLabel="Retail Sales evidence strength" changeSizeLabel="Retail Sales change size" />
  return <div className="inspector-detail-overview inspector-scoring-view inspector-retail-v1" aria-label="Retail Sales scoring system">
    <div className="inspector-retail-v1-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Retail Sales pair direction">{loading || error ? 'Uncomputed' : assessment?.label ?? 'Uncomputed'}</strong>
      {!loading && !error && assessment?.strength && <span aria-label="Retail Sales evidence strength" title="Agreement within this release; not expected price-move strength">{assessment.strength} evidence</span>}
      {!loading && !error && direction !== 'uncomputed' && assessment?.changeSize && <span aria-label="Retail Sales change size">{assessment.changeSize}</span>}
    </div>
    <small className="scoring-engine-version">Scoring system v1 · Experimental</small>
    <p className="scoring-result-explanation">{loading ? 'Calculating Retail Sales context…' : error ?? assessment?.explanation}</p>
    {error && <p role="alert">{error}</p>}
    {storage.error && <p role="alert">Retail Sales history: {storage.error}</p>}
    {!loading && !error && assessment && <RetailScoreDetails assessment={assessment} />}
    {Object.values(storage.coverage).some(coverage => coverage.missing.length > 0) && <p>Partial calendar coverage; calibration uses the available observations.</p>}
  </div>
}
