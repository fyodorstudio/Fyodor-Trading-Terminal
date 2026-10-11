import type {R1Currency} from '../../scoring-system/r1/contracts'
import type {R1TimelineState} from '../../scoring-system/r1/timeline'
import {r1DirectionLabel} from '../../scoring-system/r1/presentation'
import {r1EvidencePoints as points,r1TankGeometry} from '../core/r1-evidence-presentation'

export function R1EvidenceTank({state,currency}:{state:R1TimelineState;currency:R1Currency}) {
  const geometry=r1TankGeometry(state),previous=state.update?.before??state.net
  return <div className="r1-evidence-tank" role="meter" aria-label={`${currency} overall evidence tank`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={geometry.fillHeight}
    aria-valuetext={`${r1DirectionLabel(state,currency)}; ${points(state.net)} points${state.unavailable?`; incomplete, ${state.missing.join(', ')} unavailable`:''}`}>
    <span className="r1-tank-currency" aria-hidden="true">{currency}</span>
    <span className="r1-tank-score"><b className={state.net>0?'r1-ray-positive':state.net<0?'r1-ray-negative':''}>{state.coverage?points(state.net):'—'}</b><small>Evidence points</small></span>
    <span className={`r1-tank-fill ${state.net<0?'r1-tank-negative':'r1-tank-positive'}`} style={{height:`${geometry.fillHeight}%`}} aria-hidden="true"/>
    <span className={`r1-tank-previous ${previous<0?'r1-tank-negative':'r1-tank-positive'}`} style={{bottom:`${geometry.previousBottom}%`}} title={`Previous score ${points(previous)}`} aria-hidden="true"/>
  </div>
}
