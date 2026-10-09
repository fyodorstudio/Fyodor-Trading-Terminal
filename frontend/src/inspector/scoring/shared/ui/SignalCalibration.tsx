import { memo } from 'react'
import { formatScore } from './format-score'
import { ScoringSection } from './ScoringSection'

type Reading = { id: string; label: string; value: number | null; sampleCount: number;
  limits: readonly number[] | null; magnitudeMode?: string; unit?: string; reason?: string | null }
const number = (n: number | null, precision = 3) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: precision })

function SignalCalibrationComponent({ readings, unit = 'pp', label = 'Signal calibration' }: {
  readings: readonly Reading[]; unit?: string; label?: string
}) {
  return <ScoringSection title="Calibration & settings" collapsible>
    <table className="scoring-calibration" aria-label={label}>
      <thead><tr><th>Signal</th><th>Value / history</th><th>Magnitude boundaries</th></tr></thead>
      <tbody>{readings.map(row => <tr key={row.id}><td>{row.label}</td>
        <td>{formatScore(row.value)} {row.unit ?? unit}<small>N = {row.sampleCount} earlier usable signals</small>{row.reason && <small>{row.reason}</small>}</td>
        <td>{row.limits ? <>{row.limits.map(n => number(n, 6)).join(' / ')} {row.unit ?? unit}
          <small>{row.magnitudeMode === 'custom' ? 'manual override boundaries' : 'automatic boundaries'}</small></> : 'Unavailable'}</td>
      </tr>)}</tbody>
    </table>
    <p className="scoring-section-hint">Edit in Scatter Plot → Scoring signal.</p>
  </ScoringSection>
}

export const SignalCalibration = memo(SignalCalibrationComponent)
