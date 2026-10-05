import type { ReactNode } from 'react'
import { formatSignedMagnitudeScore, signedMagnitudeColumns, type SignedMagnitudeReading } from '../grading/signed-magnitude-score'

const statusLabels = { undefined: 'Undefined', missing: 'Missing', duplicate: 'Duplicate', unavailable: 'Unavailable' }
export function SignedMagnitudeMatrix({ label, className, caption, header, readings, footer, scoreMeaning }: {
  label: string; className: string; caption: string; header: ReactNode; readings: readonly SignedMagnitudeReading[]
  footer: ReactNode; scoreMeaning: string
}) {
  return <div className="inspector-magnitude-summary" role="status">
    <table className={`inspector-magnitude-tally inspector-signed-magnitude-matrix ${className}`} aria-label={label}>
      <caption className="inspector-sr-only">{caption}</caption>
      <thead><tr><th scope="col">{header}</th>
        {signedMagnitudeColumns.map((column) => <th scope="col" key={column.size}>{column.size} ({column.points})</th>)}
      </tr></thead>
      <tbody>{readings.map((reading) => <tr key={reading.id} data-series={reading.id}>
        <th scope="row">{reading.label}</th>
        {reading.status !== 'scored' ? <td colSpan={5} className="inspector-magnitude-empty" title={reading.reason}>
          {statusLabels[reading.status]}</td> : signedMagnitudeColumns.map((column) => {
          const active = reading.size === column.size
          const tone = reading.score! > 0 ? 'good' : reading.score! < 0 ? 'bad' : 'unchanged'
          return <td key={column.size} data-size={column.size} data-score={active ? reading.score! : undefined}
            className={active ? `inspector-cpi-score-value inspector-grade-${tone}` : 'inspector-magnitude-empty'}
            title={active ? reading.reason : undefined}
            aria-label={active ? `${reading.label}: ${column.size}, ${scoreMeaning} score ${formatSignedMagnitudeScore(reading.score)}` : `${reading.label}: ${column.size} does not apply`}>
            {active ? formatSignedMagnitudeScore(reading.score) : '–'}
          </td>
        })}
      </tr>)}</tbody>
      <tfoot>{footer}</tfoot>
    </table>
  </div>
}
