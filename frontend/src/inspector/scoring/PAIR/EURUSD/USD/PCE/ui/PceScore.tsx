import { StandaloneScoreTable } from '../../../../../shared/ui/StandaloneScoreTable'
import { ScoringSurface } from '../../../../../shared/ui/scoring-surface'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'
import { useContext, useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../../../scoring-system/shared/core/historical-release-signals'
import { pceSignalSettings } from '../../../../../../../scoring-system/shared/core/signal-magnitude-settings'
import { assessPceScore, pceSeriesIds } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/PCE/assessment/pce-score'

import { formatScore as format } from '../../../../../shared/ui/format-score'
const scope = { currency: 'USD' as const, eventIds: pceSeriesIds }

export function PceScore({ release, brokerId, events = [] }: InspectorScoringProps) {
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const settings = pceSignalSettings.useSettings()
  const assessment = useMemo(() => assessPceScore(release, history, settings), [release, history, settings])
  const plain = useContext(ScoringSurface) === 'standalone'
  if (!assessment) return null
  const loading = storage.loading
  const direction = loading ? 'uncomputed' : assessment.direction
  const coverageMissing = Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0)
  if (plain) return <StandaloneScoreTable assessment={assessment} rows={assessment.readings}
    supporting={[{ id: 'level', label: 'Inflation level', text: assessment.targetContext }]} loading={loading}
    historyError={storage.error} partial={coverageMissing} label="PCE component scores" directionLabel="PCE pair direction"
    evidenceLabel="PCE evidence strength" changeSizeLabel="PCE change size" tones={['Heating', 'Cooling']} />
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
    {!loading && assessment.reduced && <p>Reduced data: {assessment.readings.filter((row) => row.points !== null).length} of 4 components usable.</p>}
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
    {!loading && <ScoringSection title="Inflation level" collapsible><p aria-label="PCE target context">{assessment.targetContext}</p></ScoringSection>}


    {coverageMissing && <p>Partial calendar history; calibration uses the available observations.</p>}
  </div>
}
