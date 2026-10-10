import {useId,useState} from 'react'
import {validMagnitudeLimits,type MagnitudeLimits} from '../../inspector/magnitude/magnitude-distribution'
import './magnitude-boundary-editor.css'

export function R1BoundaryEditor({limits,preview,manual,unit,onPreview,onApply,onReset}:{
  limits:MagnitudeLimits|null;preview:MagnitudeLimits|null;manual:boolean;unit:string
  onPreview:(limits:MagnitudeLimits|null)=>void;onApply:(limits:MagnitudeLimits)=>void;onReset:()=>void
}) {
  const id=useId(),signature=JSON.stringify(limits)
  const [state,setState]=useState(()=>({signature,draft:(preview??limits)?.map(String)??['','',''],dirty:!!preview}))
  if(state.signature!==signature&&!state.dirty)setState({signature,draft:limits?.map(String)??['','',''],dirty:false})
  const {draft,dirty}=state
  const values=draft.map(v=>v.trim()?Number(v):NaN),valid=validMagnitudeLimits(values)
  return <form className="scatter-magnitude-boundaries" aria-label="R1 magnitude boundaries" onSubmit={e=>{
    e.preventDefault();if(valid){onApply(values);setState({signature,draft,dirty:false})}
  }}><fieldset><legend>Magnitude ({unit})</legend>
    <span className="scatter-magnitude-source">{dirty?'Unsaved preview':manual?'Saved R1 override':'Inherited calibration'}</span>
    {['Small','Medium','Large'].map((label,i)=><div className="scatter-magnitude-boundary-row" key={label}>
      <label htmlFor={`${id}-${i}`}>{label} ≤</label><input id={`${id}-${i}`} aria-label={`${label} R1 upper boundary`} type="number" min="0" step="any" value={draft[i]} onChange={e=>{
        const next=draft.map((v,j)=>j===i?e.target.value:v),parsed=next.map(v=>v.trim()?Number(v):NaN)
        setState({signature,draft:next,dirty:true});onPreview(validMagnitudeLimits(parsed)?parsed:null)
      }}/>
    </div>)}
    {dirty&&!valid&&<p role="status">Use 0 &lt; Small &lt; Medium &lt; Large.</p>}
    <p>Preview changes this chart. Apply updates scoring.</p>
    <div className="scatter-magnitude-boundary-actions"><button type="submit" disabled={!valid||!dirty}>Apply</button>
      <button type="button" disabled={!manual&&!dirty} onClick={()=>{setState({signature,draft:limits?.map(String)??['','',''],dirty:false});onPreview(null);onReset()}}>Reset to inherited</button></div>
  </fieldset></form>
}
