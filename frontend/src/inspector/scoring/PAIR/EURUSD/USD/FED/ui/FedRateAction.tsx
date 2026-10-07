import type { assessFedScore } from '../assessment/fed-score'
import type { usePreviousFedMeeting } from '../runtime/usePreviousFedMeeting'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'

export function FedRateAction({ action, eligible, path, pathLoading = false, pathError = null }: {
  action: NonNullable<ReturnType<typeof assessFedScore>>; eligible: boolean;
  path?: ReturnType<typeof usePreviousFedMeeting>['path']; pathLoading?: boolean; pathError?: string | null
}) {
  const consistent = path?.priorConsistent !== false
  const direction = eligible && consistent ? action.direction : 'uncomputed'
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Fed rate-action interpretation">
    <div className="inspector-release-score-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Fed standalone direction">{direction === 'uncomputed' ? 'Uncomputed' : action.label}</strong>
      {direction !== 'uncomputed' && <span>{action.strength} rate-action evidence</span>}
    </div>
    <small className="scoring-engine-version">Rate-action v1 · Partial policy coverage</small>
    <ScoringSection title="Decision & rate action"><p><strong>Decision: {eligible ? consistent ? action.action : 'Prior-rate inconsistency' : 'Unavailable at this cutoff'}</strong>{eligible && action.actual !== null && ` · ${action.actual}%`}</p>
    <p>Rate action alone: {!consistent ? 'Unavailable: supplied prior conflicts with the stored preceding meeting.' : !eligible || action.delta === null ? 'Unavailable.' : action.delta === 0 ? 'No directional change.' : `${action.label} · weak rate-action evidence.`}</p>
    <p>{!consistent ? 'The supplied prior rate conflicts with the stored preceding meeting; no standalone rate direction is assigned.' :
      !eligible && action.delta !== null ? 'A verified, already published release is required.' : action.explanation}</p>
    {eligible && action.delta !== null && <table aria-label="Fed rate action readings"><thead><tr><th>Actual</th><th>Previous</th><th>Change</th></tr></thead>
      <tbody><tr><td>{action.actual}%</td><td>{action.previous}%</td><td>{action.delta > 0 ? '+' : ''}{action.delta} bp</td></tr></tbody></table>}</ScoringSection>
    <ScoringSection title="Stored rate path · no additional vote">
    {eligible && path && !pathLoading && !pathError && <p aria-label="Fed numerical rate path"><strong>Stored rate path:</strong> {path.path}. Meeting change: {path.meetingChangeBps} bp. This describes rate history; it adds no extra vote and does not infer guidance.</p>}
    {(!eligible || !path) && !pathLoading && !pathError && <p>Stored rate path unavailable at this cutoff.</p>}
    {pathLoading && <p>Loading earlier decision timing…</p>}{pathError && <p role="alert">{pathError}</p>}</ScoringSection>
    <ScoringSection title="Coverage & limits">
    <p><strong>Fed guidance: Not scored.</strong> {action.coverage}</p>
    <p>A rate hold supplies no standalone direction. The economic context on the right is calculated separately and cannot claim what the Fed communicated.</p></ScoringSection>
  </section>
}
