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

export function CpiScoreV4({ release, brokerId = null, events, now, timeDisplay }: {
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
    <h3>This CPI release</h3>
    <div className="inspector-cpi-v4-summary">
      <strong className={`inspector-majority inspector-direction-${ready ? assessment.direction : 'uncomputed'}`} aria-label="CPI v4 standalone direction">{ready ? assessment.label : 'Uncomputed'}</strong>
      {ready && assessment.strength && <span title="Agreement about this CPI release, not expected price direction">{assessment.strength} inflation evidence</span>}
      {ready && assessment.changeSize && <span>{assessment.changeSize}</span>}
    </div>
    <p>{loading ? 'Calculating CPI interpretation…' : standalone.error ?? assessment?.explanation ?? 'No usable CPI assessment.'}</p>
    <h3>CPI readings and standalone rules</h3>
    {ready && <><p>{assessment.strengthReason}</p><CpiScoreDetails assessment={assessment} label="CPI v4 standalone" /></>}
  </section>
  const contextView = <section className="inspector-scoring-view inspector-structured-score">
    <CpiContextComparison comparison={comparison} loading={context.loading} error={context.error} families={families} />
    {context.storage.error && <p role="alert">Context history: {context.storage.error}</p>}
    {context.result?.excludedTiming ? <p>Some stored publications have excluded timing. The combined result uses eligible history only.</p> : null}
    {coverageMissing && <p>Partial calendar coverage; the results use available observations.</p>}
    <h3>Context inputs at this publication</h3>
    <ContextInputTable families={families} onToggleFamily={toggleContextFamily} result={result} symbol="EURUSD"
      loading={context.loading} unavailable={contextUnavailable} cutoff={comparison.at} timeDisplay={timeDisplay}
      tableLabel="CPI v4 context inputs" summaryLabel={contextUnavailable ? 'Uncomputed' : contextPairLabel('EURUSD', result?.direction ?? 'uncomputed')} />
    {!context.loading && !contextUnavailable && <ContextPolicyDetails policy={result?.policy} />}
    <p>These context controls are shared with Raycaster. Inspector’s marker filters do not change them. The table uses the selected publication time; later releases are excluded. Claims expires after 14 days, GDP after 120; other families after 45. NFP and Claims share the labor budget.</p>
  </section>
  return <PublicationScoringLayout label="CPI scoring system v4" standalone={standaloneView}
    context={<PublicationScoringContext release={release} brokerId={brokerId} events={events} now={now} timeDisplay={timeDisplay}>{contextView}</PublicationScoringContext>} />
}
