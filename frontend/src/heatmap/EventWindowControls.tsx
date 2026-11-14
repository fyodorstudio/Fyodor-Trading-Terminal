import { useState } from 'react'
import { jakartaInput, parseJakarta, validEventWindow, type EventWindow } from './event-window'

export function EventWindowControls({value,onApply}:{value:EventWindow;onApply:(window:EventWindow)=>void}) {
  const [draft,setDraft]=useState(()=>({from:jakartaInput(value.from),through:jakartaInput(value.through),anchor:jakartaInput(value.anchor),minutes:value.minutes}))
  const next={from:parseJakarta(draft.from),through:parseJakarta(draft.through),anchor:parseJakarta(draft.anchor),minutes:draft.minutes},valid=validEventWindow(next)
  return <div className="heatmap-event-controls"><strong>Event window · Jakarta (WIB)</strong>
    {(['from','through'] as const).map(field=><label key={field}>{field==='from'?'From':'Through (exclusive)'} <input type="datetime-local" aria-label={`Event ${field}`} value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}/></label>)}
    <label>Anchor / event time <input type="datetime-local" aria-label="Event anchor" value={draft.anchor} onChange={e=>setDraft({...draft,anchor:e.target.value})}/></label>
    <label>Candles <select aria-label="Event candle interval" value={draft.minutes} onChange={e=>setDraft({...draft,minutes:Number(e.target.value)})}>{[1,5,15,30,60,240,1440].map(m=><option key={m} value={m}>{m<60?`M${m}`:m===1440?'D1':`H${m/60}`}</option>)}</select></label>
    <button type="button" disabled={!valid} onClick={()=>onApply(next)}>Apply window</button>
    <small>Up to 72 hours. Anchor must be inside the window. All candles use the last completed minute close before the anchor. Minute history availability varies by instrument.</small>
    {!valid&&<span role="alert">Choose valid dates from 2015, a past start, and a window of 1 minute–72 hours containing the anchor.</span>}
  </div>
}
