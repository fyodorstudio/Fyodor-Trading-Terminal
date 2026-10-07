import { ScoringSection, ScoringNotes } from './ScoringSection'
import { SignalCalibration } from './SignalCalibration'
import './release-score.css'
import type { InspectorScoringProps } from '../../scoring-contracts'
import { useExpandedRelease } from '../runtime/useExpandedRelease'
const format = (n: number | null) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function ExpandedReleaseScore(props: InspectorScoringProps) {
  const calculation = useExpandedRelease(props), a = calculation.result
  const name = props.release?.familyId === 'gdp' ? 'GDP' : 'PPI'
  const ready = !calculation.loading && !calculation.error && !!a
  return <div className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label={`${name} scoring system v1`}>
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${ready ? a.direction : 'uncomputed'}`}>{ready ? a.label : 'Uncomputed'}</strong>
      {ready && a.strength && <span>{a.strength} evidence</span>} {ready && a.changeSize && <span>{a.changeSize}</span>}</div>
    <small className="scoring-engine-version">{name} v1 · Experimental</small>
    <p>{calculation.loading ? `Calculating ${name} interpretation…` : calculation.error ?? a?.explanation}</p>
    {calculation.storage.error && <p role="alert">History: {calculation.storage.error}</p>}
    {ready && <><p>{a.strengthReason}</p>{'stage' in a && <p>{a.stage === 'revision' ? 'Same-quarter estimate revision: measures the change to the previously published estimate.' : 'New quarter: compares growth with the preceding four quarters.'}</p>}
      <ScoringSection title="What drove the result"><div className="inspector-table-scroll"><table aria-label={`${name} component scores`}><thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
      <tbody>{a.readings.map(row => <tr key={row.id}><td title={row.description}>{row.label}</td><td>{row.points === null ? 'Unavailable' : row.points > 0 ? `Stronger · ${row.size}` : row.points < 0 ? `Weaker · ${row.size}` : 'Unchanged'}{row.reason && <small>{row.reason}</small>}</td><td>{row.weight}%</td><td>{format(row.contribution)}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={4}>USD score {format(a.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr></tfoot></table></div></ScoringSection>
      {a.reduced && <p>Some components are unavailable. Missing weights are not redistributed.</p>}
      </>}
    <ScoringSection title="How this scorer works"><ScoringNotes items={name === 'GDP' ? [
      { label: 'Voting rules', content: <>GDP 50%, real consumption 30%, real final sales 20%. Output and final sales share one evidence group; consumption supplies demand context. These aggregates overlap. Negative growth compared with the zero-floored recent mean stays USD-weakening even if the contraction is smaller.</> },
      { label: 'Quarter & revision comparison', content: <>A new quarter compares actual growth with four consecutive preceding quarters, using the latest estimate available before publication. Revised Previous replaces the nearest quarter when supplied. Later estimates compare with the latest earlier estimate of the same quarter. New quarters and revisions calibrate separately. Quarterly inflation readings remain context, without an extra inflation vote.</> }
    ] : [
      { label: 'Voting rules & revisions', content: <>Core monthly pace 50%, annual core change 30%, headline monthly pace 15%, annual headline change 5%. Monthly pace uses the prior three-month mean; Revised Previous replaces the nearest month when supplied. Annual changes compare with Revised Previous, otherwise Previous. Core excludes food and energy in this catalog; it is not the separate measure excluding trade services.</> },
      { label: 'Producer-price scope', content: <>PPI describes producer selling prices. It is upstream inflation context, not a direct estimate of CPI or the PCE components used by the Fed.</> }
    ]} /></ScoringSection>
    {ready && <SignalCalibration readings={a.readings} label={`${name} signal calibration`} />}
    <ScoringSection title="Coverage & limits"><p>At least 24 earlier usable signals are required per component. Exact cancellation follows table order with weak evidence. All-zero evidence stays Uncomputed. No forecasts or price reactions enter. Scatter Plot → Scoring signal exposes these same inputs and magnitude boundaries.</p></ScoringSection>
  </div>
}
