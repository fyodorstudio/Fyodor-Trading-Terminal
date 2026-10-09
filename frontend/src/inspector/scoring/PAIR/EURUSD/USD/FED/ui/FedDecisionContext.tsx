import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import type { ReactNode } from 'react'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { formatAppTimestamp } from '../../../../../../../appearance/time-display/time-display-preference'
import { usePublicationContext } from '../../../../../../../usd-context/runtime/usePublicationContext'
import { contextAt } from '../../../../../../../scoring-system/context/usd/context-lookup'
import { contextResultLabel, contextResultTone } from '../../../../../../../scoring-system/context/usd/usd-pair'
import { toggleContextFamily } from '../../../../../../../usd-context/storage/context-family-settings'
import { ContextInputTable } from '../../../../../../../usd-context/ui/ContextInputTable'
import { ContextPolicyDetails } from '../../../../../../../usd-context/ui/ContextPolicyDetails'
import { fedContextPressure } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/FED/assessment/fed-context'
import type { assessFedScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/FED/assessment/fed-score'
import { usePreviousFedMeeting } from '../runtime/usePreviousFedMeeting'
import { PublicationScoringLayout } from '../../../../../shared/ui/PublicationScoringLayout'
import { PublicationScoringContext } from '../../../../../shared/ui/PublicationScoringContext'
import { FedRateAction } from './FedRateAction'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'

const defaultTime = { mode: 'utc' as const, utcOffsetMinutes: 0 }
export function FedDecisionContext({ release, action, brokerId = null, events, now = 0, timeDisplay = defaultTime }: InspectorScoringProps & {
  release: InspectorRelease; action: NonNullable<ReturnType<typeof assessFedScore>>
}) {
  const { families, context, eligible, at, result, ready } = usePublicationContext(release, brokerId, events, now)
  const { previous, storage, path } = usePreviousFedMeeting(release, brokerId, events)
  const earlier = previous && context.result ? contextAt(context.result, previous.chartTime! * 1000) : null
  const direction = ready ? contextResultTone(result) : 'uncomputed'
  const label = ready ? contextResultLabel('EURUSD', result) : 'Uncomputed'
  const contextView = (controls: ReactNode) => <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Fed policy interpretation">
    <div className="inspector-release-score-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="Fed contextual pair direction">{label}</strong>
      {ready && result?.strength && <span>{result.strength} context evidence</span>}
    </div>
    <small className="scoring-engine-version">Fed v2 · Economic context</small>
    {controls}
    <h3>USD context at the Fed publication</h3>
    <p>{context.loading ? 'Calculating decision context…' : context.error ?? (!eligible ?
      'A verified, already published chart time is required.' : result?.explanation ?? 'No enabled context assessment is available.')}</p>
    <ScoringSection title="Policy pressure & previous meeting">
    {ready && <p aria-label="Fed economic policy pressure">{fedContextPressure(result)}</p>}
    {ready && earlier && previous && !storage.loading && !storage.error ? <div aria-label="Fed previous meeting comparison">
      <p>At the previous meeting ({formatAppTimestamp(previous.releaseAt!, timeDisplay)}): {contextResultLabel('EURUSD', earlier.result)} · {earlier.result.strength ?? 'no'} context evidence.</p>
    </div> : <p>{storage.loading ? 'Loading earlier decision timing…' : storage.error ?? 'Previous meeting comparison unavailable.'}</p>}</ScoringSection>
    {(context.error || context.storage.error) && <p role="alert">{context.error ?? context.storage.error}</p>}
    <ScoringSection title="Inputs & contributions"><ContextInputTable families={families} onToggleFamily={toggleContextFamily} result={result} symbol="EURUSD" loading={context.loading}
      unavailable={!eligible || !!context.error} cutoff={at} timeDisplay={timeDisplay} tableLabel="Fed economic context inputs" summaryLabel={label} /></ScoringSection>
    {ready && <ScoringSection title="Active relationships"><ContextPolicyDetails policy={result?.policy} /></ScoringSection>}
  </section>
  return <PublicationScoringLayout standalone={<FedRateAction action={action} eligible={eligible} path={path} pathLoading={storage.loading} pathError={storage.error} />}
    context={<PublicationScoringContext release={release} brokerId={brokerId} events={events} now={now} timeDisplay={timeDisplay}>{contextView}</PublicationScoringContext>} />
}
