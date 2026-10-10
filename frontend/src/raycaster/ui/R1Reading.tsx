import { useR1Timeline } from '../../scoring-system/r1/useR1Timeline'
import { r1CandleUpdates, r1TimelineAt, type R1TimelineState, type R1Update } from '../../scoring-system/r1/timeline'
import type { R1Currency } from '../../scoring-system/r1/contracts'
import { chartClockToUtc } from '../../appearance/time-display/chart-clock'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { eventFamilyOptions } from '../../inspector/event-families'
import { symbolGlyph, type EventSymbol } from '../../inspector/event-symbols'
const points=(value:number)=>`${value>0?'+':''}${Number(value.toFixed(2))}`
const color=(value:number)=>value>0?'r1-ray-positive':value<0?'r1-ray-negative':''
const direction=(state:R1TimelineState,currency:R1Currency)=>state.direction==='strengthening'?`${currency} Strengthening`:state.direction==='weakening'?`${currency} Weakening`:state.direction==='balanced'?`${currency} · Balanced evidence`:state.direction==='empty'?`${currency} · No evidence selected`:`${currency} · Insufficient evidence`
function Update({update,currency,symbols}:{update:R1Update;currency:R1Currency;symbols?:Record<string,EventSymbol>}) {
  const clock=useDisplayClock(),change=update.change
  return <div className="r1-ray-update">
    {update.releases.length?update.releases.map(release=><span className="r1-ray-release" key={release.id}>{symbolGlyph(symbols?.[release.family]??eventFamilyOptions.find(f=>f.id===release.family)?.symbol??'star')} {release.country==='US'?'US':currency} · {release.label.replace(/^US /,'')} · {clock.utc(update.at)}</span>):<div>{clock.utc(update.at)} · {update.kind==='expiry'?'Evidence expired':update.kind==='schedule'?'Freshness updated':'Data corrected'}</div>}
    <span className={color(change)}> — {currency} evidence {change>0?'increased by':change<0?'decreased by':'unchanged ·'} <b>{points(change)}</b></span>
  </div>
}
export function R1Reading({brokerId,now,cutoff,open,brokerOffsetSeconds,symbols}:{brokerId:string|null;now:number;cutoff:number|null;open:number|null;brokerOffsetSeconds:number;symbols?:Record<string,EventSymbol>}) {
  const history=useR1Timeline(brokerId,now),clock=useDisplayClock(),scope={brokerId,brokerOffsetSeconds}
  const at=cutoff===null?null:chartClockToUtc(cutoff,scope),from=open===null?null:chartClockToUtc(open*1000,scope)
  const point=history.result&&at!==null?r1TimelineAt(history.result,Math.min(at,now)):null
  if(!brokerId||history.error||history.loading||!point)return <p role="status">{!brokerId?'Select a connected broker with stored calendar history.':history.error??(history.loading?'Preparing R1 evidence history.':cutoff===null?'Move across the chart to inspect a candle.':'Evidence unavailable at this time.')}</p>
  return <section aria-label="R1 currency evidence">
    <p className="raycaster-clock">{cutoff!==null?clock.chart(cutoff):''} · candle end</p>
    <div className="r1-ray-currencies">{(['EUR','USD'] as const).map(currency=>{
      const state=point[currency],update=state.update
      return <section key={currency} aria-label={`${currency} R1 evidence`}>
        <strong className={state.direction==='strengthening'?color(1):state.direction==='weakening'?color(-1):''}>{direction(state,currency)}</strong>
        {state.strength&&<small>{state.strength[0].toUpperCase()+state.strength.slice(1)} evidence</small>}
        <p>Evidence points <b>{update?`${points(update.before)} → `:''}{points(state.net)}</b></p>
        {update&&<p className={color(update.change)}>Change <b>{points(update.change)}</b></p>}
        <p className="r1-ray-totals">Supportive {points(state.supportive)} · Negative {points(state.negative)}</p>
      </section>
    })}</div>
    <div aria-label="R1 evidence updates">{(['EUR','USD'] as const).flatMap(currency=>{
      const updates=history.result&&from!==null&&at!==null?r1CandleUpdates(history.result,from,Math.min(at,now),currency):[]
      return (updates.length?updates:point[currency].update?[point[currency].update!]:[]).map(update=>({currency,update}))
    }).sort((a,b)=>b.update.at-a.update.at||a.currency.localeCompare(b.currency)).map(({currency,update})=><Update key={`${currency}/${update.at}`} update={update} currency={currency} symbols={symbols}/>)}</div>
    {history.partial&&<small>Partial stored history</small>}
  </section>
}
