import { useContext } from 'react'
import { ScoringSurface } from './scoring-surface'
import { StandaloneScoreTable } from './StandaloneScoreTable'
import { ScoringSection } from './ScoringSection'
import './release-score.css'
import type { InspectorScoringProps } from '../../scoring-contracts'
import { useExpandedRelease } from '../runtime/useExpandedRelease'
import { formatScore as format } from './format-score'
export function ExpandedReleaseScore(props: InspectorScoringProps) {
  const calculation = useExpandedRelease(props), a = calculation.result
  const name = props.release?.familyId === 'gdp' ? 'GDP' : 'PPI'
  const plain = useContext(ScoringSurface) === 'standalone'
  const ready = !calculation.loading && !calculation.error && !!a
  if (plain) return <StandaloneScoreTable assessment={a} rows={a?.readings} loading={calculation.loading}
    error={calculation.error} historyError={calculation.storage.error} partial={Object.values(calculation.storage.coverage).some(c => c.missing.length > 0)}
    label={`${name} component scores`} directionLabel={`${name} standalone direction`}
    supporting={a && 'stage' in a ? [{ id: 'stage', label: 'Estimate type', text: a.stage === 'revision' ? 'Same-quarter revision' : 'New quarter' }] : []} />
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


  </div>
}
