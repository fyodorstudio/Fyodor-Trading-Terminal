import type { ContextPoint } from '../../scoring-system/context/usd/contracts'
import type { EurContextPoint } from '../../scoring-system/context/relative/contracts'
import type { FreshPoint } from '../../scoring-system/relationships/contracts'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { UsdContextPresentation } from '../core/usd-context-presentation'
import { ContextInputTable } from '../../usd-context/ui/ContextInputTable'
import { ContextPolicyDetails } from '../../usd-context/ui/ContextPolicyDetails'
import { RelativeContextDetails } from '../../pair-context/ui/RelativeContextDetails'
import { FreshNewsSummary } from '../../usd-context/sequences/ui/FreshNewsSummary'
import { useRaycasterFamilies } from '../storage/raycaster-family-settings'
import { useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { RaycasterNotes } from './RaycasterNotes'
import { formatAppTimestamp } from '../../appearance/time-display/time-display-preference'
import type { InspectorScoringProps } from '../../inspector/scoring/scoring-contracts'
import { InspectorScoringView } from '../../inspector/scoring/InspectorScoringView'
import { inspectorScoringBinding } from '../../inspector/scoring/scoring-registry'
import { displaySourceRelease } from '../../inspector/episodes/display-episodes'
import { memo } from 'react'

export function ContextDetailed({ point, eurPoint, fresh, publication, symbol, cutoff, loading, message, label, presentation, relative, timeDisplay }: {
  point: ContextPoint | null; eurPoint?: EurContextPoint | null; fresh?: FreshPoint | null; symbol: string;
  cutoff: number | null; loading: boolean; message: string | null; label: string;
  presentation: UsdContextPresentation | null; relative: boolean; timeDisplay: TimeDisplayPreference;
  publication?: InspectorScoringProps;
}) {
  const families = useRaycasterFamilies(), sequences = useSequencePreferences()
  const ready = !loading && !message && cutoff !== null
  const activityAt = relative ? Math.max(point?.chartAt ?? 0, eurPoint?.chartAt ?? 0) : point?.chartAt
  return <div className="raycaster-details context-detailed-content" aria-label="Context-detailed calculations">
    <PublicationDetails symbol={symbol} publication={publication} />
    <section className="raycaster-section"><h3>Candle-end contributions and calculations</h3>
      {ready && presentation && <dl className="reading-metrics">
        <div><dt>Long support</dt><dd>{presentation.long.toFixed(3)}</dd></div><div><dt>Short support</dt><dd>{presentation.short.toFixed(3)}</dd></div>
        <div><dt>Net toward Long</dt><dd>{presentation.net.toFixed(3)}</dd></div><div><dt>Separation</dt><dd>{(100 * presentation.separation).toFixed(1)}%</dd></div>
      </dl>}
      {relative && <>
        <RelativeContextDetails eur={eurPoint ?? null} usd={point} loading={loading} supported showSelector={false} showInputSettings={false} />
        <table aria-label="EUR vote age and new releases"><thead><tr><th>EUR input</th><th>Vote activity</th></tr></thead><tbody>
          {ready && eurPoint?.members.map((m, i) => <VoteRows key={`${m.slot}/${m.family}/${i}`} label={m.label}
            age={Math.max(0, Math.floor(eurPoint.chartAt / 86400000) - Math.floor(m.chartAt / 86400000))}
            retention={m.status === 'unavailable' ? null : m.retention} status={m.status}
            release={m.chartAt === activityAt ? `${m.label} · ${formatAppTimestamp(m.releaseAt, timeDisplay)}` : '-'} />)}
        </tbody></table>
      </>}
      <ContextInputTable families={families} result={point?.result ?? null} symbol={symbol} loading={loading} layout="audit"
        unavailable={!!message} cutoff={cutoff} activityAt={activityAt} timeDisplay={timeDisplay} summaryLabel={label}
        summaryEvidence={presentation?.evidence}
        presentationNote={!relative ? 'USD presentation v1 requires 60% usable configured coverage. Opposing retained family votes show Conflicted with the weighted leading side; a narrow lead stays Weak. Exact balance and unchanged evidence assert no lead.' : undefined} />
      {ready && presentation?.state === 'insufficient' && <p>{presentation.explanation}</p>}
    </section>
    <section className="raycaster-section"><h3>Active relationships</h3>
      {ready && <ContextPolicyDetails policy={point?.result.policy} />}
      {!ready || !point?.result.policy ? <p>Inspect a candle with available history to see applicable conditions.</p> : null}
    </section>
    {sequences.fresh && <FreshNewsSummary point={ready ? fresh ?? null : null} symbol={symbol} />}
    <div className="reading-documentation"><RaycasterNotes relative={relative} /></div>
  </div>
}

// Candle hover changes must not rerender the selected publication's scorers.
const PublicationDetails = memo(function PublicationDetails({ symbol, publication }: {
  symbol: string; publication?: InspectorScoringProps
}) {
  const release = publication?.release ?? null
  const source = displaySourceRelease(release, null, publication?.now ?? 0)
  const binding = inspectorScoringBinding(symbol, source)
  return <section className="raycaster-section raycaster-publication" aria-label="Selected release context at publication">
    <h3>At publication · selected Inspector release</h3>
    {release && binding && publication ? <>
      <p className="raycaster-publication-name">{release.label}</p>
      <p>This section uses the selected release’s publication cutoff. The candle-end calculations below use the inspected candle.</p>
      <InspectorScoringView {...publication} binding={binding} surface="context" />
    </> : <p>Select a release in the Inspector to see its publication context and comparisons here.</p>}
  </section>
})

function VoteRows({ label, age, retention, status, release }: { label: string; age: number; retention: number | null; status: string; release: string }) {
  return <>
    <tr><th scope="row">{label} · Age / influence</th><td>{age} days old · {retention === null ? 'No usable vote' : `${(100 * retention).toFixed(1)}% remaining · ${(100 * (1 - retention)).toFixed(1)}% lost`}{status === 'expired' ? ' · Expired' : ''}</td></tr>
    <tr><th scope="row">New release</th><td>{release}</td></tr>
  </>
}
