import type { ReactNode } from 'react'
import type { SignalInputs } from '../../../../scoring-system/shared/core/historical-release-signals'
import { formatScore } from './format-score'
import './standalone-score-table.css'

export type StandaloneScoreRow = {
  id: string; label: string; description?: string; inputs?: SignalInputs; value: number | null;
  points: number | null; size?: string | null; weight: number; contribution: number | null;
  reason?: string; baseWeight?: number; state?: string
}
type Result = {
  direction: string; label: string; strength?: string | null; changeSize?: string | null;
  explanation?: string; total: number | null; tieBreak?: { label: string } | null; reduced?: boolean
}
const numbers = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 })

export function StandaloneScoreTable({ assessment, rows = [], groups, supporting = [], loading = false, error, historyError,
  partial = false, label, directionLabel, evidenceLabel, changeSizeLabel, tones = ['Stronger', 'Weaker'] }: {
  assessment: Result | null; rows?: readonly StandaloneScoreRow[];
  groups?: readonly { id: string; label: string; note?: ReactNode; rows: readonly StandaloneScoreRow[] }[];
  supporting?: readonly { id: string; label: string; text: string }[];
  loading?: boolean; error?: string | null; historyError?: string | null; partial?: boolean;
  label: string; directionLabel: string; evidenceLabel?: string; changeSizeLabel?: string; tones?: readonly [string, string]
}) {
  const ready = !loading && !error && !!assessment
  const unavailable = loading || !!error
  const value = (n: number | undefined, unit: string | undefined) => n === undefined ? '—' : `${numbers.format(n)}${unit ? ` ${unit}` : ''}`
  const body = (readings: readonly StandaloneScoreRow[]) => readings.map(row => <tr key={row.id} data-score-signal={row.id}>
    <td title={row.description}><strong>{row.label}</strong></td>
    <td title={row.inputs?.actualLabel}>{unavailable ? '—' : value(row.inputs?.actual, row.inputs?.unit)}</td>
    <td>{unavailable ? '—' : value(row.inputs?.baseline, row.inputs?.unit)}{!unavailable && row.inputs && <small>{row.inputs.baselineLabel}</small>}</td>
    <td title={row.value === null ? undefined : `Comparison ${formatScore(row.value)}`}>
      {loading ? 'Loading' : error || row.points === null ? 'Unavailable' : row.points > 0 ? `${tones[0]} · ${row.size}` : row.points < 0 ? `${tones[1]} · ${row.size}` : 'Unchanged'}
      {!unavailable && row.state && <small>{row.state}</small>}
      {!unavailable && row.reason && <small>{row.reason}</small>}
    </td>
    <td>{row.weight}%{row.baseWeight !== undefined && row.weight !== row.baseWeight && <small>Participation adjustment</small>}</td>
    <td className={unavailable || row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' : row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{unavailable ? '—' : formatScore(row.contribution)}</td>
  </tr>)
  return <div className="inspector-scoring-view inspector-standalone-table"><table aria-label={label}>
    <caption className="inspector-table-result">
      <strong className={`inspector-direction-${ready ? assessment.direction : 'uncomputed'}`} aria-label={directionLabel} title={ready ? assessment.explanation : undefined}>{ready ? assessment.label : 'Uncomputed'}</strong>
      {ready && assessment.strength && <span aria-label={evidenceLabel}>{assessment.strength} evidence</span>}
      {ready && assessment.direction !== 'uncomputed' && assessment.changeSize && <span aria-label={changeSizeLabel}>{assessment.changeSize}</span>}
      {ready && <span>USD score {formatScore(assessment.total)}</span>}
      {ready && assessment.tieBreak && <span>Tie-break: {assessment.tieBreak.label}</span>}
      {ready && assessment.reduced && <span>Reduced data</span>}
      {loading && <span role="status">Loading…</span>}{error && <span role="alert">{error}</span>}
      {historyError && <span role="alert">History: {historyError}</span>}{partial && <span>Partial history</span>}
    </caption>
    <colgroup><col style={{ width: '24%' }} /><col style={{ width: '18%' }} /><col style={{ width: '24%' }} /><col style={{ width: '18%' }} /><col style={{ width: '6%' }} /><col style={{ width: '10%' }} /></colgroup>
    <thead><tr><th>Signal</th><th>Current</th><th>Comparison</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
    {groups ? groups.map(group => <tbody key={group.id}>
      <tr className="inspector-table-section"><th colSpan={6} scope="rowgroup">{group.label}{group.note && <small>{group.note}</small>}</th></tr>
      {body(group.rows)}
    </tbody>) : <tbody>{body(rows)}</tbody>}
    {!unavailable && !!supporting.length && <tbody aria-label="Supporting readings">
      <tr className="inspector-table-section"><th colSpan={6} scope="rowgroup">Supporting readings · no vote</th></tr>
      {supporting.map(row => <tr key={row.id}><td>{row.label}</td><td colSpan={5}>{row.text}</td></tr>)}
    </tbody>}
  </table></div>
}
