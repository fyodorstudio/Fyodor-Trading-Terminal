import '../../inspector/scoring/shared/ui/release-score.css'
import type { ReactNode } from 'react'
import type { InspectorEvent, InspectorRelease } from '../../inspector/inspector-data'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { toggleContextFamily } from '../storage/context-family-settings'
import { usePublicationContext } from '../runtime/usePublicationContext'
import { contextPairLabel } from '../core/usd-pair'
import { ContextInputTable } from './ContextInputTable'
import { ContextPolicyDetails } from './ContextPolicyDetails'
import { ScoringSection } from '../../inspector/scoring/shared/ui/ScoringSection'
const empty: readonly InspectorEvent[] = []
const defaultTime: TimeDisplayPreference = { mode: 'utc', utcOffsetMinutes: 0 }
export function PublicationContext({ release, brokerId = null, events = empty, now = 0, timeDisplay = defaultTime, controls }: {
  release: InspectorRelease; brokerId?: string | null; events?: readonly InspectorEvent[]; now?: number; timeDisplay?: TimeDisplayPreference; controls?: ReactNode
}) {
  const { families, context, eligible, at, before, result, ready } = usePublicationContext(release, brokerId, events, now)
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Combined USD context at publication">
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${ready && result?.direction === 'stronger' ? 'short' : ready && result?.direction === 'weaker' ? 'long' : 'uncomputed'}`}>{ready ? contextPairLabel('EURUSD', result?.direction ?? 'uncomputed') : 'Uncomputed'}</strong>
      {ready && result?.strength && <span>{result.strength} context evidence</span>}</div>
    {controls}
    <h3>USD context at publication</h3>
    <p>{context.loading ? 'Calculating publication context…' : context.error ?? (!eligible ? 'A verified, already published chart time is required.' : result?.explanation ?? 'No enabled context assessment is available.')}</p>
    {ready && before && <p>Before publication: {contextPairLabel('EURUSD', before.result.direction)} · {before.result.strength ?? 'no'} evidence.</p>}
    {context.storage.error && <p role="alert">Context history: {context.storage.error}</p>}
    <ScoringSection title="Inputs & contributions"><ContextInputTable families={families} onToggleFamily={toggleContextFamily} result={result} symbol="EURUSD" loading={context.loading}
      unavailable={!eligible || !!context.error} cutoff={at} timeDisplay={timeDisplay} tableLabel="Publication context inputs" summaryLabel={ready ? contextPairLabel('EURUSD', result?.direction ?? 'uncomputed') : 'Uncomputed'} /></ScoringSection>
    {ready && <ScoringSection title="Active relationships"><ContextPolicyDetails policy={result?.policy} /></ScoringSection>}
    <ScoringSection title="Coverage & controls"><p>Uses only releases available at this publication. These controls are shared with Raycaster and CPI v4, independently of chart-marker filters. This context is separate from Standalone Scoring and uses the family policies listed in its input table, including when a legacy release view is selected. Policy text coverage is unavailable.</p></ScoringSection>
  </section>
}
