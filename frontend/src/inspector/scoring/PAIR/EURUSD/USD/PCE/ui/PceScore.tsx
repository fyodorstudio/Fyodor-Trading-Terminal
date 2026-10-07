import { SignalCalibration } from '../../../../../shared/ui/SignalCalibration'
import { ScoringSection, ScoringNotes } from '../../../../../shared/ui/ScoringSection'
import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { pceSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'
import { assessPceScore, pceSeriesIds } from '../assessment/pce-score'

const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
const scope = { currency: 'USD' as const, eventIds: pceSeriesIds }

export function PceScore({ release, brokerId, events = [] }: InspectorScoringProps) {
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const settings = pceSignalSettings.useSettings()
  const assessment = useMemo(() => assessPceScore(release, history, settings), [release, history, settings])
  if (!assessment) return null
  const loading = storage.loading
  const direction = loading ? 'uncomputed' : assessment.direction
  const coverageMissing = Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-pce-v1" aria-label="PCE scoring system">
    <div className="inspector-pce-v1-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="PCE pair direction">{loading ? 'Uncomputed' : assessment.label}</strong>
      {!loading && assessment.strength && <span aria-label="PCE evidence strength">{assessment.strength} evidence</span>}
      {!loading && assessment.direction !== 'uncomputed' && assessment.changeSize && <span aria-label="PCE change size">{assessment.changeSize}</span>}
    </div>
    <small className="scoring-engine-version">Scoring system v1 · Experimental</small>
    <p className="scoring-result-explanation">{loading ? 'Loading earlier PCE releases…' : assessment.explanation}</p>
    {storage.error && <p role="alert">PCE history: {storage.error}</p>}
    {!loading && assessment.strength && <p aria-label="PCE evidence explanation">{assessment.strengthReason}</p>}
    {!loading && assessment.reduced && <p>Reduced data: {assessment.readings.filter((row) => row.points !== null).length} of 4 components usable. Missing components do not vote.</p>}
    <ScoringSection title="What drove the result"><div className="inspector-table-scroll"><table aria-label="PCE component scores">
      <thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
      <tbody>{assessment.readings.map((row) => <tr key={row.id}>
        <td title={row.description}>{row.label}</td>
        <td title={`${format(row.value)} pp · ${row.sampleCount} earlier usable signals`}>
          {loading ? 'Loading' : row.points === null ? 'Unavailable' : row.points > 0 ? `Heating · ${row.size}` : row.points < 0 ? `Cooling · ${row.size}` : 'Unchanged'}
          {!loading && row.reason && <small>{row.reason}</small>}
        </td>
        <td>{row.weight}%</td>
        <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' :
          row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{loading ? '—' : format(row.contribution)}</td>
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={4}>USD score {loading ? '—' : format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr>
        {!loading && assessment.tieBreak && <tr><td colSpan={4}>Tie-break: {assessment.tieBreak.label} · weak evidence</td></tr>}</tfoot>
    </table></div></ScoringSection>
    {!loading && <ScoringSection title="Inflation level · no additional vote"><p aria-label="PCE target context">{assessment.targetContext}</p></ScoringSection>}
    <ScoringSection title="How this scorer works"><ScoringNotes items={[
        { label: 'Voting rules & revisions', content: <>Core inflation has 75% of the vote: latest core pace 45%, annual core change 30%. Headline pace has 15% and annual headline change 10%. Monthly pace compares this reading with the preceding three-month average, including the release’s revised preceding month when supplied. Annual change compares with Revised Previous when supplied, otherwise Previous. A high inflation level alone does not create a fresh directional vote.</> },
        { label: 'Evidence groups', content: <>Monthly core and headline share one evidence group; annual core and headline share another. Agreement across both horizons can strengthen evidence. These related readings are not independent statistical confirmations. Evidence strength and change size do not describe price probabilities or the size of a price move.</> },
        { label: 'History & tie-break', content: <>Each component uses its own earlier history since January 2015, with at least 24 usable signals. Missing weights are not redistributed. Exact cancellation follows the table order. At least one usable core component is required; absent directional evidence remains Uncomputed.</> }
      ]} /></ScoringSection>
    <SignalCalibration readings={assessment.readings} unit="pp" label="PCE signal calibration" />
    <ScoringSection title="Coverage & limits"><p>This interprets PCE alone without forecasts, CPI, policy decisions or price inputs. Stored readings may include provider revisions. Scatter Plot → Scoring signal shows these components and their configurable magnitude boundaries. Original A−P settings remain separate.</p>
    {coverageMissing && <p>Partial calendar coverage; earlier calibration uses the available observations.</p>}</ScoringSection>
  </div>
}
