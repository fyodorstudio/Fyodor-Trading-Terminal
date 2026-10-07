import { ScoringSection } from './ScoringSection'

type Reading = { id: string; label: string; value: number | null; sampleCount: number;
  limits: readonly number[] | null; magnitudeMode?: string; unit?: string; reason?: string | null }
const number = (n: number | null, precision = 3) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: precision })

export function SignalCalibration({ readings, unit = 'pp', label = 'Signal calibration' }: {
  readings: readonly Reading[]; unit?: string; label?: string
}) {
  return <ScoringSection title="Calibration & settings">
    <table className="scoring-calibration" aria-label={label}>
      <thead><tr><th>Signal</th><th>Value / history</th><th>Magnitude boundaries</th></tr></thead>
      <tbody>{readings.map(row => <tr key={row.id}><td>{row.label}</td>
        <td>{row.value === null ? '—' : row.value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })} {row.unit ?? unit}<small>N = {row.sampleCount} earlier usable signals</small>{row.reason && <small>{row.reason}</small>}</td>
        <td>{row.limits ? <>{row.limits.map(n => number(n, 6)).join(' / ')} {row.unit ?? unit}
          <small>{row.magnitudeMode === 'custom' ? 'manual override boundaries' : 'automatic boundaries'}</small></> : 'Unavailable'}</td>
      </tr>)}</tbody>
    </table>
    <p className="scoring-section-hint">View or configure these boundaries in Scatter Plot → Scoring signal. Original Actual − Previous settings remain separate.</p>
  </ScoringSection>
}
