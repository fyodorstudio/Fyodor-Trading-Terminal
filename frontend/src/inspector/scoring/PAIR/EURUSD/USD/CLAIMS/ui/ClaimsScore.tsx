import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { supportsClaimsScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-features'
import { claimsHorizons } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'
import { saveClaimsPreferences, useClaimsPreferences } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-settings'
import { useClaimsAnalysis } from '../runtime/useClaimsAnalysis'
import { ClaimsScoreDetails } from './ClaimsScoreDetails'
import './claims-score.css'

export function ClaimsScore(props: InspectorScoringProps) {
  const preferences = useClaimsPreferences(), { assessment, loading, error, storage } = useClaimsAnalysis(props)
  if (!supportsClaimsScore(props.release)) return null
  const direction = loading || error ? 'uncomputed' : assessment?.direction ?? 'uncomputed'
  return <div className="inspector-detail-overview inspector-scoring-view inspector-claims" aria-label="Jobless Claims scoring system">
    <div className="inspector-claims-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Jobless Claims USD direction">{loading || error ? 'Uncomputed' : assessment?.usdLabel ?? 'Uncomputed'}</strong>
      <span aria-label="Jobless Claims pair direction">{loading || error ? 'Uncomputed' : assessment?.label}</span>
      {!loading && !error && assessment?.strength && <span aria-label="Jobless Claims evidence strength">{assessment.strength} evidence</span>}
    </div>
    <nav aria-label="Claims assessment">{claimsHorizons.map(h => <button key={h.id} type="button" aria-pressed={preferences.horizon === h.id}
      onClick={() => saveClaimsPreferences({ ...preferences, horizon: h.id })}>{h.label}</button>)}</nav>
    <small className="scoring-engine-version">Claims v3</small>
    <p className="scoring-result-explanation" role={error ? 'alert' : undefined}>{loading ? 'Calculating Claims…' : error ?? assessment?.explanation}</p>
    {storage.error && <p role="alert">Claims history: {storage.error}</p>}
    {!loading && !error && assessment && <ClaimsScoreDetails assessment={assessment} />}
    {Object.values(storage.coverage).some(coverage => coverage.missing.length > 0) && <p>Partial history</p>}
  </div>
}
