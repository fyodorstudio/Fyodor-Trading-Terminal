import { PublicationScoringLayout } from '../../../../../shared/ui/PublicationScoringLayout'
import { PublicationScoringContext } from '../../../../../shared/ui/PublicationScoringContext'
import type { InspectorEvent, InspectorRelease } from '../../../../../../inspector-data'
import type { TimeDisplayPreference } from '../../../../../../../appearance/time-display/time-display-preference'
import { ContextInputTable } from '../../../../../../../usd-context/ui/ContextInputTable'
import { ContextPolicyDetails } from '../../../../../../../usd-context/ui/ContextPolicyDetails'
import { contextPairLabel } from '../../../../../../../usd-context/core/usd-pair'
import { toggleContextFamily } from '../../../../../../../usd-context/storage/context-family-settings'
import { useCpiV4Analysis } from '../runtime/useCpiV4Analysis'
import { CpiScoreDetails } from './CpiScoreDetails'
import { CpiContextComparison } from './v4/CpiContextComparison'
import './v4/cpi-v4.css'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { cpiStandaloneVersionLabel } from '../../../../../shared/core/current-scoring-versions'

export function CpiScoreV4({ release, brokerId, events = [], now = 0, timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 } }: InspectorScoringProps) {
  return release ? <CpiPublicationScore release={release} brokerId={brokerId} events={events} now={now} timeDisplay={timeDisplay} /> : null
}
function CpiPublicationScore({ release, brokerId = null, events, now, timeDisplay }: {
  release: InspectorRelease; brokerId?: string | null; events: readonly InspectorEvent[]; now: number; timeDisplay: TimeDisplayPreference
}) {
  const { standalone, context, families, comparison } = useCpiV4Analysis(release, brokerId, events, now)
  const assessment = standalone.result
  const loading = context.storage.loading || standalone.loading
  const ready = !loading && !standalone.error && !!assessment
  const contextUnavailable = !!context.error || !!comparison.explanation && comparison.before === null && comparison.after === null
  const result = comparison.after?.result ?? null
  const coverageMissing = Object.values(context.storage.coverage).some(c => c.missing.length > 0)
  const standaloneView = <section className="inspector-scoring-view inspector-structured-score" aria-label="CPI v4 this release">
    <small>Scoring system v4 · CPI interpretation + publication context · Experimental</small>
    <small className="scoring-engine-version">{cpiStandaloneVersionLabel} · same CPI release calculation used by Raycaster</small>
    <h3>This CPI release</h3>
    <div className="inspector-cpi-v4-summary">
      <strong className={`inspector-majority inspector-direction-${ready ? assessment.direction : 'uncomputed'}`} aria-label="CPI v4 standalone direction">{ready ? assessment.label : 'Uncomputed'}</strong>
      {ready && assessment.strength && <span title="Agreement about this CPI release, not expected price direction">{assessment.strength} inflation evidence</span>}
      {ready && assessment.changeSize && <span>{assessment.changeSize}</span>}
    </div>
    <p>{loading ? 'Calculating CPI interpretation…' : standalone.error ?? assessment?.explanation ?? 'No usable CPI assessment.'}</p>
    {ready && <><p>{assessment.strengthReason}</p><CpiScoreDetails assessment={assessment} label="CPI v4 standalone" /></>}
  </section>
  const contextView = <section className="inspector-scoring-view inspector-structured-score">
    <CpiContextComparison comparison={comparison} loading={context.loading} error={context.error} families={families} />
    {context.storage.error && <p role="alert">Context history: {context.storage.error}</p>}
    {context.result?.excludedTiming ? <p>Some stored publications have excluded timing. The combined result uses eligible history only.</p> : null}
    {coverageMissing && <p>Partial calendar coverage; the results use available observations.</p>}
    <ScoringSection title="Inputs & contributions">
    <ContextInputTable families={families} onToggleFamily={toggleContextFamily} result={result} symbol="EURUSD"
      loading={context.loading} unavailable={contextUnavailable} cutoff={comparison.at} timeDisplay={timeDisplay}
      tableLabel="CPI v4 context inputs" summaryLabel={contextUnavailable ? 'Uncomputed' : contextPairLabel('EURUSD', result?.direction ?? 'uncomputed')} /></ScoringSection>
    {!context.loading && !contextUnavailable && <ScoringSection title="Active relationships"><ContextPolicyDetails policy={result?.policy} /></ScoringSection>}
    <ScoringSection title="Coverage & controls"><p>These context controls are shared with Raycaster. Inspector’s marker filters do not change them. The table uses the selected publication time; later releases are excluded. Claims expires after 14 days, GDP after 120; other families after 45. NFP and Claims share the labor budget.</p></ScoringSection>
  </section>
  return <PublicationScoringLayout label="CPI scoring system v4" standalone={standaloneView}
    context={<PublicationScoringContext release={release} brokerId={brokerId} events={events} now={now} timeDisplay={timeDisplay}>{contextView}</PublicationScoringContext>} />
}
