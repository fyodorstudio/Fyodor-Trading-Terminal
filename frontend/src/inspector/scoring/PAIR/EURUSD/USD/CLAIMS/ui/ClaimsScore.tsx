import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { supportsClaimsScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-features'
import { claimsHorizons } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'
import { saveClaimsPreferences, useClaimsPreferences } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-settings'
import { useClaimsAnalysis } from '../runtime/useClaimsAnalysis'
import { ClaimsScoreDetails } from './ClaimsScoreDetails'
import { formatScore } from '../../../../../shared/ui/format-score'
import './claims-score.css'

export function ClaimsScoreControls() {
  const preferences = useClaimsPreferences()
  return <div className="inspector-claims-controls">
    <select aria-label="Claims assessment" value={preferences.horizon} onChange={e => saveClaimsPreferences({ ...preferences, horizon: e.target.value as typeof preferences.horizon })}>
      {claimsHorizons.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
    </select>
  </div>
}

export function ClaimsScore(props: InspectorScoringProps) {
  const { assessment, loading, error, storage } = useClaimsAnalysis(props)
  if (!supportsClaimsScore(props.release)) return null
  const direction = loading || error ? 'uncomputed' : assessment?.direction ?? 'uncomputed'
  return <div className="inspector-scoring-view inspector-claims" aria-label="Jobless Claims scoring system">
    <ClaimsScoreDetails assessment={!loading && !error ? assessment : null} result={<>
      <strong className={`inspector-direction-${direction}`} aria-label="Jobless Claims USD direction" title={assessment?.explanation}>{loading || error ? 'Uncomputed' : assessment?.usdLabel ?? 'Uncomputed'}</strong>
      <span aria-label="Jobless Claims pair direction">{loading || error ? 'Uncomputed' : assessment?.label}</span>
      {!loading && !error && assessment?.strength && <span aria-label="Jobless Claims evidence strength">{assessment.strength} evidence</span>}
      {!loading && !error && assessment && <span>USD score {formatScore(assessment.total)}</span>}
      {loading && <span role="status">Calculating Claims…</span>}
      {error && <span role="alert">{error}</span>}
      {storage.error && <span role="alert">Claims history: {storage.error}</span>}
      {Object.values(storage.coverage).some(coverage => coverage.missing.length > 0) && <span>Partial history</span>}
    </>} />
  </div>
}
