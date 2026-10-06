import '../../inspector/scoring/shared/ui/release-score.css'
import { useMemo } from 'react'
import type { InspectorEvent, InspectorRelease } from '../../inspector/inspector-data'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { useContextFamilies, toggleContextFamily } from '../storage/context-family-settings'
import { useUsdContextTimeline } from '../runtime/useUsdContextTimeline'
import { contextSourceFamilies } from '../core/policy'
import { contextAt } from '../core/context-lookup'
import { contextPairLabel } from '../core/usd-pair'
import { ContextInputTable } from './ContextInputTable'
import { ContextPolicyDetails } from './ContextPolicyDetails'
const empty: readonly InspectorEvent[] = []
const defaultTime: TimeDisplayPreference = { mode: 'utc', utcOffsetMinutes: 0 }
export function PublicationContext({ release, brokerId = null, events = empty, now = 0, timeDisplay = defaultTime }: {
  release: InspectorRelease; brokerId?: string | null; events?: readonly InspectorEvent[]; now?: number; timeDisplay?: TimeDisplayPreference
}) {
  const families = useContextFamilies(), sources = useMemo(() => contextSourceFamilies(families), [families])
  const context = useUsdContextTimeline(brokerId, sources, now, events, true)
  const eligible = !release.timingUncertain && release.releaseAt !== null && Number.isFinite(release.releaseAt) && release.releaseAt <= now && release.chartTime !== null && Number.isFinite(release.chartTime)
  const at = eligible ? release.chartTime! * 1000 : null
  const before = at === null || !context.result ? null : contextAt(context.result, at - 1)
  const after = at === null || !context.result ? null : contextAt(context.result, at)
  const result = after?.result ?? null, ready = !context.loading && !context.error && eligible
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Combined USD context at publication">
    <h3>Combined context at this publication</h3>
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${ready && result?.direction === 'stronger' ? 'short' : ready && result?.direction === 'weaker' ? 'long' : 'uncomputed'}`}>{ready ? contextPairLabel('EURUSD', result?.direction ?? 'uncomputed') : 'Uncomputed'}</strong>
      {ready && result?.strength && <span>{result.strength} context evidence</span>}</div>
    <p>{context.loading ? 'Calculating publication context…' : context.error ?? (!eligible ? 'A verified, already published chart time is required.' : result?.explanation ?? 'No enabled context assessment is available.')}</p>
    {ready && before && <p>Before publication: {contextPairLabel('EURUSD', before.result.direction)} · {before.result.strength ?? 'no'} evidence.</p>}
    {context.storage.error && <p role="alert">Context history: {context.storage.error}</p>}
    <ContextInputTable families={families} onToggleFamily={toggleContextFamily} result={result} symbol="EURUSD" loading={context.loading}
      unavailable={!eligible || !!context.error} cutoff={at} timeDisplay={timeDisplay} tableLabel="Publication context inputs" summaryLabel={ready ? contextPairLabel('EURUSD', result?.direction ?? 'uncomputed') : 'Uncomputed'} />
    {ready && <ContextPolicyDetails policy={result?.policy} />}
    <p>Uses only releases available at this publication. These controls are shared with Raycaster and CPI v4, independently of chart-marker filters. This context does not replace the standalone interpretation above. Policy text coverage is unavailable.</p>
  </section>
}
