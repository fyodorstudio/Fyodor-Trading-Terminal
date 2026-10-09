import { useMemo } from 'react'
import { scoringMethod, usdScoringFamilies } from '../../scoring-system/scoring-catalog'
import { historicalMagnitudePolicy } from '../../scoring-system/shared/core/historical-release-signals'
import { useMagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'
import { CalibrationEditor } from './CalibrationEditor'
import { ClaimsScoringSettings } from './ClaimsScoringSettings'
import type { InspectorScoringProps } from '../../inspector/scoring/scoring-contracts'

export function ScoringSystemSettings({ family, onFamilyChange, ...preview }: InspectorScoringProps & { family: string; onFamilyChange: (family: string) => void }) {
  const method = useMemo(() => scoringMethod(family), [family]), settings = useMagnitudeSettings(method.binding?.settings ?? null)
  const example = method.signals.reduce((sum, signal, index) => sum + (index === 0 ? 2 : index === 1 ? -1 : 0) * (signal.weight ?? 0) / 100, 0)
  return <section className="scoring-system-settings" aria-label="Scoring System">
    <div className="scoring-settings-toolbar"><label>Scoring family<select aria-label="Scoring family" value={family} onChange={e => onFamilyChange(e.target.value)}>
      {usdScoringFamilies.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label></div>
    {family === 'claims' ? <ClaimsScoringSettings {...preview} /> : <><header className="scoring-model-header"><h3>{method.binding?.label ?? 'Fed rate action'}</h3></header>
    {method.binding ? <div className="scoring-settings-grid">
      <section className="scoring-settings-method" aria-label="Scoring method"><h4>Method</h4>
      {method.sectorWeight !== null && <p>This sector has {method.sectorWeight}% of the combined ISM budget.</p>}
      <table aria-label="Scoring rules"><thead><tr><th>Component</th><th>Comparison</th><th>Default weight</th></tr></thead>
        <tbody>{method.signals.map(signal => <tr key={signal.id}><td>{signal.label}</td><td>{signal.description}</td><td>{signal.weight}%</td></tr>)}</tbody></table>
      <details><summary>Magnitude and directional rules</summary>
        <p>Each comparison is graded against its own earlier history. Automatic boundaries are {historicalMagnitudePolicy.quantiles.map(q => `${+(q * 100).toFixed(2)}%`).join(' / ')} of nonzero absolute changes, with at least {historicalMagnitudePolicy.minimumHistory} usable earlier readings.</p>
        <p>Small / Medium / Large / Extreme receive 1 / 2 / 3 / 4 signed points. Contributions are points × weight. Positive totals support USD strength and EURUSD Short; negative totals support USD weakness and EURUSD Long. Forecasts are excluded.</p>
        <p>Worked example: {method.signals[0].label} at +2, {method.signals[1]?.label} at −1, remaining components at zero gives {example.toLocaleString(undefined, { signDisplay: 'exceptZero', maximumFractionDigits: 3 })} weighted points. Component descriptions govern any conditional weights or eligibility rules.</p>
      </details>
      </section>
      <section className="scoring-settings-calibration" aria-label="Scoring calibration"><h4>Calibration</h4>
      {method.signals.map(signal => <CalibrationEditor key={`${method.binding!.settings.key}/${signal.id}/${JSON.stringify(settings[signal.id])}`}
        store={method.binding!.settings} signal={signal} saved={settings[signal.id]} />)}
      <p>Raw Actual−Previous magnitude settings remain separate in Scatter Plot.</p>
      </section>
    </div> : <p>Rate action compares the decision rate with its prior rate. A hold alone supplies no directional bias. The existing Fed context view uses experimental accumulated economic scores; policy text is not scored.</p>}</>}
  </section>
}
