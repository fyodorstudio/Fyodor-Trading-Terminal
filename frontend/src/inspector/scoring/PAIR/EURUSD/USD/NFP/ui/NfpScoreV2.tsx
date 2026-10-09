import { ScoringSection } from '../../../../../shared/ui/ScoringSection'
import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../../../scoring-system/shared/core/historical-release-signals'
import { assessNfpScoreV2, nfpV2SeriesIds } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import { nfpSignalSettings } from '../../../../../../../scoring-system/shared/core/signal-magnitude-settings'

import { formatScore as format } from '../../../../../shared/ui/format-score'
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
    </div>
    <small className="scoring-engine-version">Scoring system v2.2 · Experimental</small>
    <p className="scoring-result-explanation">{loading ? 'Loading earlier employment releases…' : assessment.explanation}</p>
    {storage.error && <p role="alert">Employment history: {storage.error}</p>}
    {!loading && assessment.strength && <p aria-label="NFP v2 evidence explanation">{assessment.strengthReason}</p>}
    {!loading && assessment.reduced && <p>Reduced data: {assessment.readings.filter((r) => r.points !== null).length} of 5 components usable.</p>}
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
    <ScoringSection title="Supporting context" collapsible><div className="inspector-table-scroll"><table aria-label="NFP v2 supporting context">
      <thead><tr><th>Supporting reading</th><th>Interpretation</th></tr></thead>
      <tbody>{assessment.supporting.map((row) => <tr key={row.id}><td>{row.label}</td><td>{loading ? 'Loading' : row.text}</td></tr>)}</tbody>
    </table></div></ScoringSection>


    {coverageMissing && <p>Partial calendar history; calibration uses the available observations.</p>}
  </div>
}
