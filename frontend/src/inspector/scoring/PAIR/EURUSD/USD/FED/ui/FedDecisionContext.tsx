import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { formatAppTimestamp } from '../../../../../../../appearance/time-display/time-display-preference'
import { usePublicationContext } from '../../../../../../../usd-context/runtime/usePublicationContext'
import { contextAt } from '../../../../../../../usd-context/core/context-lookup'
import { contextPairLabel } from '../../../../../../../usd-context/core/usd-pair'
import { toggleContextFamily } from '../../../../../../../usd-context/storage/context-family-settings'
import { ContextInputTable } from '../../../../../../../usd-context/ui/ContextInputTable'
import { ContextPolicyDetails } from '../../../../../../../usd-context/ui/ContextPolicyDetails'
import { fedContextPressure } from '../assessment/fed-context'
import type { assessFedScore } from '../assessment/fed-score'
import { usePreviousFedMeeting } from '../runtime/usePreviousFedMeeting'

const defaultTime = { mode: 'utc' as const, utcOffsetMinutes: 0 }
export function FedDecisionContext({ release, action, brokerId = null, events, now = 0, timeDisplay = defaultTime }: InspectorScoringProps & {
  release: InspectorRelease; action: NonNullable<ReturnType<typeof assessFedScore>>
}) {
  const { families, context, eligible, at, result, ready } = usePublicationContext(release, brokerId, events, now)
  const { previous, storage, path } = usePreviousFedMeeting(release, brokerId, events)
  const earlier = previous && context.result ? contextAt(context.result, previous.chartTime! * 1000) : null
  const direction = ready && result?.direction === 'stronger' ? 'short' : ready && result?.direction === 'weaker' ? 'long' : 'uncomputed'
  const label = ready ? contextPairLabel('EURUSD', result?.direction ?? 'uncomputed') : 'Uncomputed'
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Fed policy interpretation">
    <div className="inspector-release-score-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Fed contextual pair direction">{label}</strong>
      {ready && result?.strength && <span>{result.strength} context evidence</span>}
      <small>Fed v2 · Economic context</small>
    </div>
    <p>{context.loading ? 'Calculating decision context…' : context.error ?? (!eligible ?
      'A verified, already published chart time is required.' : result?.explanation ?? 'No enabled context assessment is available.')}</p>
    <p><strong>Decision: {eligible ? path?.priorConsistent === false ? 'Prior-rate inconsistency' : action.action : 'Unavailable at this cutoff'}</strong>{eligible && action.actual !== null && ` · ${action.actual}%`}</p>
    <p>Rate action alone: {path?.priorConsistent === false ? 'Unavailable: supplied prior conflicts with the stored preceding meeting.' : !eligible || action.delta === null ? 'Unavailable.' : action.delta === 0 ? 'No directional change.' : `${action.label} · weak rate-action evidence.`}</p>
    {eligible && path && !storage.loading && !storage.error && <p aria-label="Fed numerical rate path"><strong>Stored rate path:</strong> {path.path}. Meeting change: {path.meetingChangeBps} bp.{path.priorConsistent === false && ' The feed’s supplied prior rate differs from the stored preceding meeting.'} This describes rate history; it adds no extra vote and does not infer guidance.</p>}
    {ready && <p aria-label="Fed economic policy pressure">{fedContextPressure(result)}</p>}
    <p><strong>Fed guidance: Not scored.</strong> Statements, projections and speech content are outside this numerical interpreter. The contextual bias does not claim what the Fed said.</p>
    {ready && earlier && previous && !storage.loading && !storage.error ? <div aria-label="Fed previous meeting comparison">
      <p>At the previous meeting ({formatAppTimestamp(previous.releaseAt!, timeDisplay)}): {contextPairLabel('EURUSD', earlier.result.direction)} · {earlier.result.strength ?? 'no'} context evidence.</p>
      <p>{earlier.result.direction === 'uncomputed' || result?.direction === 'uncomputed' ?
        'A directional comparison cannot be established because one meeting lacks a usable context bias.' :
        earlier.result.direction !== result?.direction ? 'The economic-context direction changed since that meeting.' :
        'The economic-context direction stayed the same; the contribution table shows the current balance.'}</p>
    </div> : <p>{storage.loading ? 'Loading earlier decision timing…' : storage.error ?? 'Previous meeting comparison unavailable.'}</p>}
    {(context.error || context.storage.error) && <p role="alert">{context.error ?? context.storage.error}</p>}
    <ContextInputTable families={families} onToggleFamily={toggleContextFamily} result={result} symbol="EURUSD" loading={context.loading}
      unavailable={!eligible || !!context.error} cutoff={at} timeDisplay={timeDisplay} tableLabel="Fed economic context inputs" summaryLabel={label} />
    {ready && <ContextPolicyDetails policy={result?.policy} />}
    <p>This is the same publication-time context used by Raycaster, with its shared independent filters. Both meetings use the same currently configured rules and only releases available at their respective publication times. A hold adds no vote, does not refresh old evidence, and does not reset its age. Rate actions remain separate from the combined score.</p>
  </section>
}
