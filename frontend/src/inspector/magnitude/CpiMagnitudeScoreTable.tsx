import type { InspectorRelease } from '../inspector-data'
import { assessCpiMagnitudeScore, cpiScoreColumns, formatCpiScore } from '../grading/cpi-magnitude-score'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

const statusLabels = { undefined: 'Undefined', missing: 'Missing', duplicate: 'Duplicate', unavailable: 'Unavailable' }
export function CpiMagnitudeScoreTable({ release, history }: { release: InspectorRelease | null; history: FamilyMagnitudeHistory }) {
  const assessment = assessCpiMagnitudeScore(release, history)
  if (!assessment) return null
  return <div className="inspector-magnitude-summary" role="status">
    <table className="inspector-magnitude-tally inspector-cpi-score" aria-label="CPI signed magnitude score">
      <caption className="inspector-sr-only">Signed USD contributions. Green positive = bullish USD / EURUSD Short pressure;
        red negative = bearish USD / EURUSD Long pressure. All four series have weight 1.</caption>
      <thead><tr>
        <th scope="col"><strong className={`inspector-majority inspector-direction-${assessment.direction}`}
          aria-label="CPI pair direction" title={assessment.explanation}>{assessment.label}</strong></th>
        {cpiScoreColumns.map((column) => <th scope="col" key={column.size}>{column.size} ({column.points})</th>)}
      </tr></thead>
      <tbody>{assessment.readings.map((reading) => <tr key={reading.id} data-series={reading.id} data-period={reading.period}>
        <th scope="row">{reading.label}</th>
        {reading.status !== 'scored' ? <td colSpan={5} className="inspector-magnitude-empty" title={reading.reason}>
          {statusLabels[reading.status]}</td> : cpiScoreColumns.map((column) => {
          const active = reading.size === column.size
          const tone = reading.score! > 0 ? 'good' : reading.score! < 0 ? 'bad' : 'unchanged'
          return <td key={column.size} data-size={column.size} data-score={active ? reading.score! : undefined}
            className={active ? `inspector-cpi-score-value inspector-grade-${tone}` : 'inspector-magnitude-empty'}
            title={active ? reading.reason : undefined}
            aria-label={active ? `${reading.label}: ${column.size}, USD score ${formatCpiScore(reading.score)}` : `${reading.label}: ${column.size} does not apply`}>
            {active ? formatCpiScore(reading.score) : '–'}
          </td>
        })}
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={6} aria-label="CPI USD score" title="Subtotals and total are signed USD contributions, not holding periods.">
        Monthly {formatCpiScore(assessment.monthly)} · Annual {formatCpiScore(assessment.annual)} · Total {formatCpiScore(assessment.total)}
      </td></tr>
        {assessment.tieBreak && <tr><td colSpan={6}>Tie-break: {assessment.tieBreak.label} {formatCpiScore(assessment.tieBreak.score)}</td></tr>}
        {history.partial && <tr><td colSpan={6}>Partial history</td></tr>}
      </tfoot>
    </table>
  </div>
}
