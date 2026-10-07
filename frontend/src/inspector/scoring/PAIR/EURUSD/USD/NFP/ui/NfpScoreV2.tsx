import { SignalCalibration } from '../../../../../shared/ui/SignalCalibration'
import { ScoringSection, ScoringNotes } from '../../../../../shared/ui/ScoringSection'
import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { assessNfpScoreV2, nfpV2SeriesIds } from '../assessment/nfp-score-v2'
import { nfpSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'

const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
const scope = { currency: 'USD' as const, eventIds: nfpV2SeriesIds }

export function NfpScoreV2({ release, brokerId, events = [] }: InspectorScoringProps) {
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const settings = nfpSignalSettings.useSettings()
  const assessment = useMemo(() => assessNfpScoreV2(release, history, settings), [release, history, settings])
  if (!assessment) return null
  const loading = storage.loading
  const direction = loading ? 'uncomputed' : assessment.direction
  const coverageMissing = Object.values(storage.coverage).some((c) => c.missing.length > 0)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-nfp-v2" aria-label="NFP scoring system v2">
    <div className="inspector-nfp-v2-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="NFP v2 pair direction">
        {loading ? 'Uncomputed' : assessment.label}
      </strong>
      {!loading && assessment.strength && <span aria-label="NFP v2 evidence strength">{assessment.strength} evidence</span>}
      {!loading && assessment.direction !== 'uncomputed' && assessment.changeSize && <span aria-label="NFP v2 change size">{assessment.changeSize}</span>}
      <span className="scoring-result-explanation">{loading ? 'Loading earlier employment releases…' : assessment.explanation}</span>
      <small>Scoring system v2 · Experimental</small>
    </div>
    {storage.error && <p role="alert">Employment history: {storage.error}</p>}
    {!loading && assessment.strength && <p aria-label="NFP v2 evidence explanation">{assessment.strengthReason}</p>}
    {!loading && assessment.reduced && <p>Reduced data: {assessment.readings.filter((r) => r.points !== null).length} of 5 components usable. Missing components do not vote.</p>}
    <ScoringSection title="What drove the result"><div className="inspector-table-scroll"><table aria-label="NFP v2 component scores">
      <thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
      <tbody>{assessment.readings.map((row) => <tr key={row.id}>
        <td title={row.description}>{row.label}</td>
        <td title={`${format(row.value)} ${row.unit} · ${row.sampleCount} earlier usable signals`}>
          {loading ? 'Loading' : row.points === null ? 'Unavailable' : row.points > 0 ? `USD supportive · ${row.size}` :
            row.points < 0 ? `USD adverse · ${row.size}` : 'Unchanged'}
          {!loading && row.reason && <small>{row.reason}</small>}
        </td>
        <td>{row.weight}%{row.weight !== row.baseWeight && <small>Participation adjustment</small>}</td>
        <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' :
          row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{loading ? '—' : format(row.contribution)}</td>
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={4}>USD score {loading ? '—' : format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr>
        {!loading && assessment.tieBreak && <tr><td colSpan={4}>Tie-break: {assessment.tieBreak.label} · weak evidence</td></tr>}</tfoot>
    </table></div></ScoringSection>
    <ScoringSection title="Supporting context · no additional vote"><div className="inspector-table-scroll"><table aria-label="NFP v2 supporting context">
      <thead><tr><th>Supporting reading</th><th>Interpretation</th></tr></thead>
      <tbody>{assessment.supporting.map((row) => <tr key={row.id}><td>{row.label}</td><td>{loading ? 'Loading' : row.text}</td></tr>)}</tbody>
    </table></div></ScoringSection>
    <ScoringSection title="How this scorer works"><ScoringNotes items={[
        { label: 'Hiring benchmark', content: <>Hiring and unemployment have the largest votes. Hiring and monthly wage growth are compared with their preceding three-month pace. A negative hiring benchmark is floored at zero so job losses cannot count as stronger hiring merely because earlier losses were larger.</> },
        { label: 'Participation & composition', content: <>Falling unemployment receives half its usual weight when participation also falls. Participation does not vote by itself. Payroll revisions and working hours add smaller votes; private, government and manufacturing payrolls explain composition without being added again.</> },
        { label: 'Revision coverage', content: <>The revision component covers only the preceding month supplied by this provider, not the full two-month BLS revision. It requires an earlier publication for that reference month. After a skipped report, the provider prior may be a newly published month instead of a revision; that component stays unavailable. An absent revision also remains unavailable.</> },
        { label: 'Evidence & change size', content: <>Evidence strength describes agreement across employment, unemployment and wage groups. Change size describes historical signal magnitude. Neither is a probability or a size of a price move. Limited data and conflicting readings have separate explanations.</> },
        { label: 'History & tie-break', content: <>Each component uses its own earlier history since January 2015, with at least 24 usable signals. Weights are 40 / 30 / 15 / 10 / 5, without redistribution. Exact cancellation follows the table order. No usable hiring/unemployment component or no directional evidence remains Uncomputed.</> }
      ]} /></ScoringSection>
    <SignalCalibration readings={assessment.readings} unit="pp" label="NFP signal calibration" />
    <ScoringSection title="Coverage & limits"><p>This is an employment-release bias without forecasts, CPI, Fed decisions or price inputs. Historical stored readings may include provider revisions. Scatter Plot → Scoring signal shows these inputs and lets you apply component magnitude overrides. Original A−P boundaries remain separate.</p>
    {coverageMissing && <p>Partial calendar coverage; earlier calibration uses the available observations.</p>}</ScoringSection>
  </div>
}
