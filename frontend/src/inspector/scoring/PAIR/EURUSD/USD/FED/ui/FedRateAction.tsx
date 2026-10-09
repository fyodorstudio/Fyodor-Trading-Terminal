import type { assessFedScore } from '../assessment/fed-score'
import type { usePreviousFedMeeting } from '../runtime/usePreviousFedMeeting'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'

export function FedRateAction({ action, eligible, path, pathLoading = false, pathError = null }: {
  action: NonNullable<ReturnType<typeof assessFedScore>>; eligible: boolean;
  path?: ReturnType<typeof usePreviousFedMeeting>['path']; pathLoading?: boolean; pathError?: string | null
}) {
  const consistent = path?.priorConsistent !== false
  const direction = eligible && consistent ? action.direction : 'uncomputed'
  const hold = eligible && consistent && action.delta === 0
  const explanation = !eligible && action.delta !== null ? 'A verified, already published release is required.' : !consistent ?
    'No rate direction: the supplied prior conflicts with the stored preceding meeting.' : hold ?
    `Rate held at ${action.actual}%. A hold alone does not establish currency strength or weakness.` : action.explanation
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Fed rate-action interpretation">
    {!hold && <div className="inspector-release-score-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Fed standalone direction">{direction === 'uncomputed' ? 'Uncomputed' : action.label}</strong>
      {direction !== 'uncomputed' && <span>{action.strength} rate-action evidence</span>}
    </div>}
    <ScoringSection title="Decision & rate action"><p>{explanation}</p>
    {eligible && action.delta !== null && <table aria-label="Fed rate action readings"><thead><tr><th>Actual</th><th>Previous</th><th>Change</th></tr></thead>
      <tbody><tr><td>{action.actual}%</td><td>{action.previous}%</td><td>{action.delta > 0 ? '+' : ''}{action.delta} bp</td></tr></tbody></table>}</ScoringSection>
    <ScoringSection title="Rate history" collapsible>
    {eligible && path && !pathLoading && !pathError && <p aria-label="Fed numerical rate path">{path.path}.</p>}
    {(!eligible || !path) && !pathLoading && !pathError && <p>Stored rate path unavailable at this cutoff.</p>}
    {pathLoading && <p>Loading earlier decision timing…</p>}{pathError && <p role="alert">{pathError}</p>}</ScoringSection>
  </section>
}
