import '../../inspector/scoring/shared/ui/release-score.css'
import type { ReactNode } from 'react'
import type { InspectorEvent, InspectorRelease } from '../../inspector/inspector-data'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { toggleContextFamily } from '../storage/context-family-settings'
import { usePublicationContext } from '../runtime/usePublicationContext'
import { contextResultLabel, contextResultTone } from '../../scoring-system/context/usd/usd-pair'
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
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${ready ? contextResultTone(result) : 'uncomputed'}`}>{ready ? contextResultLabel('EURUSD', result) : 'Uncomputed'}</strong>
      {ready && result?.strength && <span>{result.strength} context evidence</span>}</div>
    {controls}
    <h3>USD context at publication</h3>
    <p>{context.loading ? 'Calculating publication context…' : context.error ?? (!eligible ? 'A verified, already published chart time is required.' : result?.explanation ?? 'No enabled context assessment is available.')}</p>
    {ready && before && <p>Before publication: {contextResultLabel('EURUSD', before.result)} · {before.result.strength ?? 'no'} evidence.</p>}
    {context.storage.error && <p role="alert">Context history: {context.storage.error}</p>}
    <ScoringSection title="Inputs & contributions"><ContextInputTable families={families} onToggleFamily={toggleContextFamily} result={result} symbol="EURUSD" loading={context.loading}
      unavailable={!eligible || !!context.error} cutoff={at} timeDisplay={timeDisplay} tableLabel="Publication context inputs" summaryLabel={ready ? contextResultLabel('EURUSD', result) : 'Uncomputed'} /></ScoringSection>
    {ready && <ScoringSection title="Active relationships"><ContextPolicyDetails policy={result?.policy} /></ScoringSection>}
  </section>
}
