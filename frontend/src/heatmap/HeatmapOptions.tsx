import { memo } from 'react'
import { heatmapFields, type HeatmapField, type HeatmapRow } from './heatmap-model'
import type { HeatmapPreferences } from './heatmap-preferences'

export function HeatmapFields({value,onChange,label='Visible fields',disabled=false}:{value:readonly HeatmapField[];onChange:(fields:HeatmapField[])=>void;label?:string;disabled?:boolean}) {
  return <fieldset className="heatmap-fields"><legend>{label}</legend>{heatmapFields.map(field=><label key={field}>
    <input type="checkbox" aria-label={`${label} ${field}`} checked={value.includes(field)} disabled={disabled||value.length===1&&value.includes(field)}
      onChange={()=>onChange(heatmapFields.filter(f=>f===field?!value.includes(f):value.includes(f)))}/>{field}</label>)}</fieldset>
}

export const HeatmapCopyOptions = memo(function HeatmapCopyOptions({preferences,rows,onChange,eventMode,selectionActive=false}:{preferences:HeatmapPreferences;rows:HeatmapRow[];onChange:(next:HeatmapPreferences)=>void;eventMode:boolean;selectionActive?:boolean}) {
  const chosen=preferences.copyRows??rows.map(r=>r.id)
  return <details className="heatmap-copy-options"><summary>Copy options</summary><div>
    <label><input type="checkbox" aria-label="Match visible fields" checked={preferences.matchFields} onChange={()=>onChange({...preferences,matchFields:!preferences.matchFields})}/>Match visible fields</label>
    <HeatmapFields label="Copy fields" value={preferences.matchFields?preferences.fields:preferences.copyFields} disabled={preferences.matchFields} onChange={copyFields=>onChange({...preferences,copyFields})}/>
    {selectionActive && <p className="heatmap-copy-hint">Highlighted cells determine instruments and periods. These instrument and event-format defaults apply after clearing the selection.</p>}
    {eventMode&&<label>Export <select aria-label="Event export format" disabled={selectionActive} value={preferences.copyFormat} onChange={e=>onChange({...preferences,copyFormat:e.target.value as HeatmapPreferences['copyFormat']})}>
      <option value="summary">Window summary</option><option value="candles">Candle sequence</option></select></label>}
    <fieldset disabled={selectionActive} className="heatmap-copy-instruments"><legend>Default instruments</legend>
    <div><button type="button" onClick={()=>onChange({...preferences,copyRows:null})}>All instruments</button><button type="button" onClick={()=>onChange({...preferences,copyRows:[]})}>None</button></div>
    {[...new Set(rows.map(r=>r.group))].map(group=><fieldset key={group}><legend>{group}</legend>
      <label><input type="checkbox" checked={rows.filter(r=>r.group===group).every(r=>chosen.includes(r.id))} onChange={()=>{
        const ids=rows.filter(r=>r.group===group).map(r=>r.id),all=ids.every(id=>chosen.includes(id))
        onChange({...preferences,copyRows:all?chosen.filter(id=>!ids.includes(id)):[...new Set([...chosen,...ids])]})}}/>Whole category</label>
      {rows.filter(r=>r.group===group).map(row=><label key={row.id}><input type="checkbox" aria-label={`Copy ${row.label}`} checked={chosen.includes(row.id)}
        onChange={()=>onChange({...preferences,copyRows:chosen.includes(row.id)?chosen.filter(id=>id!==row.id):[...chosen,row.id]})}/>{row.label}</label>)}</fieldset>)}
    </fieldset>
  </div></details>
})
