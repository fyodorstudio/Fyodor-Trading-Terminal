import { useMemo, useState } from 'react'
import type { InspectorScoringProps } from '../../inspector/scoring/scoring-contracts'
import { useClaimsAnalysis } from '../../inspector/scoring/PAIR/EURUSD/USD/CLAIMS/runtime/useClaimsAnalysis'
import { ClaimsScoreDetails } from '../../inspector/scoring/PAIR/EURUSD/USD/CLAIMS/ui/ClaimsScoreDetails'
import { supportsClaimsScore } from '../../scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-features'
import { claimsDefaultInitialWeight, claimsHorizons, claimsWeightedSignals, type ClaimsHorizon } from '../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'
import { claimsStandaloneMagnitude, useClaimsPreferences, saveClaimsPreferences } from '../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-settings'
import { useMagnitudeSettings, type MagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'
import { historicalMagnitudePolicy } from '../../scoring-system/shared/core/historical-release-signals'
import { CalibrationEditor } from './CalibrationEditor'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'

export function ClaimsScoringSettings(props: InspectorScoringProps) {
  const preferences = useClaimsPreferences(), [horizon, setHorizon] = useState(preferences.horizon)
  const saved = useMagnitudeSettings(claimsStandaloneMagnitude[horizon]), weight = preferences[horizon === 'release' ? 'releaseWeight' : 'trendWeight']
  return <>
    <header className="scoring-model-header"><h3>Claims v3</h3>
    <label>Assessment<select aria-label="Claims settings assessment" value={horizon} onChange={e => setHorizon(e.target.value as ClaimsHorizon)}>
      {claimsHorizons.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}</select></label></header>
    <ClaimsSettingsDraft key={`${horizon}/${weight}/${JSON.stringify(saved)}`} {...props} horizon={horizon} saved={saved} weight={weight} />
  </>
}

function ClaimsSettingsDraft({ horizon, saved, weight, ...props }: InspectorScoringProps & { horizon: ClaimsHorizon; saved: MagnitudeSettings; weight: number }) {
  const preferences = useClaimsPreferences(), store = claimsStandaloneMagnitude[horizon], clock = useDisplayClock()
  const [draftWeight, setDraftWeight] = useState(String(weight)), [settings, setSettings] = useState(saved), [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const [resetKey, setResetKey] = useState(0)
  const initialWeight = Number(draftWeight), weightValid = Number.isInteger(initialWeight) && initialWeight >= 1 && initialWeight <= 99
  const signals = useMemo(() => claimsWeightedSignals(horizon, weightValid ? initialWeight : weight), [horizon, initialWeight, weightValid, weight])
  const release = supportsClaimsScore(props.release) ? props.release : null
  const valid = weightValid && !Object.values(invalid).some(Boolean)
  const preview = useClaimsAnalysis({ ...props, release: valid ? release : null }, { horizon, settings, initialWeight: weightValid ? initialWeight : weight })
  const apply = (reset = false) => {
    const next = reset ? {} : settings
    signals.forEach(s => store.save(s.id, next[s.id] ?? null))
    saveClaimsPreferences({ ...preferences, [horizon === 'release' ? 'releaseWeight' : 'trendWeight']: reset ? claimsDefaultInitialWeight : initialWeight })
  }
  return <>
    <div className="scoring-settings-grid">
    <section className="scoring-settings-method" aria-label="Claims method"><h4>Method</h4>
    <table aria-label="Scoring rules"><thead><tr><th>Component</th><th>Comparison</th><th>Weight</th></tr></thead>
      <tbody>{signals.map(s => <tr key={s.id}><td>{s.label}</td><td>{s.description}</td><td>{s.weight}%</td></tr>)}</tbody></table>
    <details><summary>Magnitude and directional rules</summary>
      <p>Grade each comparison from its own earlier history: {historicalMagnitudePolicy.minimumHistory} usable samples, nonzero absolute percentiles at 1/3, 2/3 and 90%. Small / Medium / Large / Extreme receive 1 / 2 / 3 / 4 signed points; fewer claims give positive points.</p>
      <p>USD score = initial points × initial weight + continuing points × continuing weight. Positive supports USD strength / EURUSD Short; negative supports USD weakness / EURUSD Long. Exact cancellation or all unchanged gives no net bias. Unavailable inputs do not vote.</p>
      <p>Example at 60/40: initial +1 and continuing −2 gives −0.2. The two assessments have separate calibration and weights. Forecasts are excluded; historical revisions must have been published by the selected release.</p>
    </details>
    </section>
    <section className="scoring-settings-calibration" aria-label="Claims calibration"><h4>Calibration</h4>
    <label className="scoring-weight-control">Initial claims weight (%)<input type="number" min="1" max="99" step="1" aria-label="Claims initial weight" value={draftWeight} onChange={e => setDraftWeight(e.target.value)} /></label>
    {signals.map(signal => <CalibrationEditor key={`${signal.id}/${resetKey}`} store={store} signal={signal} saved={settings[signal.id]} draftOnly
      onPreview={(limits, valid) => {
        setInvalid(previous => ({ ...previous, [signal.id]: !valid }))
        if (valid) setSettings(previous => { const next = { ...previous }; if (limits) next[signal.id] = limits; else delete next[signal.id]; return next })
      }} />)}
    <div className="scoring-settings-actions"><button type="button" disabled={!valid} onClick={() => apply()}>Apply Claims settings</button>
      <button type="button" onClick={() => { setDraftWeight(String(claimsDefaultInitialWeight)); setSettings({}); setInvalid({}); setResetKey(k => k + 1); apply(true) }}>Reset to defaults</button></div>
    {!weightValid && <p role="status">Use an integer weight from 1 to 99.</p>}
    </section></div>
    <section className="scoring-settings-preview" aria-label="Claims settings preview"><h4>Selected release preview</h4>
      {!release ? <p>Select a Jobless Claims release in Inspector.</p> : !valid ? <p>Finish valid settings to preview.</p> : <>
        <time>{clock.utc(release.releaseAt!)} ({clock.zone})</time>
        <p>{preview.loading ? 'Calculating Claims…' : preview.error ?? `${preview.assessment?.usdLabel} · ${preview.assessment?.label}${preview.assessment?.strength ? ` · ${preview.assessment.strength} evidence` : ''}`}</p>
        {!preview.loading && !preview.error && preview.assessment && <ClaimsScoreDetails assessment={preview.assessment} />}
        {preview.storage.error && <p role="alert">Claims history: {preview.storage.error}</p>}
      </>}
    </section>
  </>
}
