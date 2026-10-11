import type {R1Currency} from '../../scoring-system/r1/contracts'
import type {R1TimelineState} from '../../scoring-system/r1/timeline'
import {r1DirectionLabel} from '../../scoring-system/r1/presentation'
import {r1EvidencePoints as points,r1TankGeometry} from '../core/r1-evidence-presentation'

export function R1EvidenceTank({state,currency}:{state:R1TimelineState;currency:R1Currency}) {
  const geometry=r1TankGeometry(state),previous=state.update?.before??state.net
  return <div className="r1-evidence-tank" role="meter" aria-label={`${currency} overall evidence tank`} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={state.net}
    aria-valuetext={`${r1DirectionLabel(state,currency)}; ${points(state.net)} points${state.unavailable?`; incomplete, ${state.missing.join(', ')} unavailable`:''}`}>
    <span className="r1-tank-scale r1-tank-upper" aria-hidden="true">+100</span>
    <span className="r1-tank-scale r1-tank-lower" aria-hidden="true">−100</span>
    {state.unavailable>0&&<span className="r1-tank-unknown" style={{top:`${geometry.rangeTop}%`,height:`${geometry.rangeHeight}%`}} title={`Missing evidence: ${points(state.interval[0])} to ${points(state.interval[1])}`}/>}
    <span className={`r1-tank-fill ${state.net<0?'r1-tank-negative':'r1-tank-positive'}`} style={{top:`${geometry.fillTop}%`,height:`${geometry.fillHeight}%`}}/>
    <span className="r1-tank-zero" aria-hidden="true">0</span>
    <span className="r1-tank-previous" style={{top:`${geometry.previousTop}%`}} title={`Previous score ${points(previous)}`} aria-hidden="true"/>
  </div>
}
