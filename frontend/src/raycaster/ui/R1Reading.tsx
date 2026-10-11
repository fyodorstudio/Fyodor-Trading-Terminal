import { useR1Timeline } from '../../scoring-system/r1/useR1Timeline'
import { r1CandleUpdates, r1TimelineAt, type R1TimelineState, type R1Update } from '../../scoring-system/r1/timeline'
import type { R1Currency } from '../../scoring-system/r1/contracts'
import { chartClockToUtc } from '../../appearance/time-display/chart-clock'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { r1DisplayParts, r1EvidenceComparison, r1EvidencePoints as points } from '../core/r1-evidence-presentation'
import { eventFamilyOptions } from '../../inspector/event-families'
import { symbolGlyph, type EventSymbol } from '../../inspector/event-symbols'
const color=(value:number)=>value>0?'r1-ray-positive':value<0?'r1-ray-negative':''
const direction=(state:R1TimelineState,currency:R1Currency)=>state.direction==='strengthening'?`${currency} Strengthening`:state.direction==='weakening'?`${currency} Weakening`:state.direction==='balanced'?`${currency} · Balanced evidence`:state.direction==='empty'?`${currency} · No evidence selected`:`${currency} · Insufficient evidence`
function Update({update,currency,symbols}:{update:R1Update;currency:R1Currency;symbols?:Record<string,EventSymbol>}) {
  const clock=useDisplayClock(),change=update.change
  return <div className="r1-ray-update">
    <div className="r1-ray-releases">{update.releases.length?update.releases.map(release=><span className="r1-ray-release" key={release.id}>{symbolGlyph(symbols?.[release.family]??eventFamilyOptions.find(f=>f.id===release.family)?.symbol??'star')} {release.country==='US'?'US':currency} · {release.label.replace(/^US /,'')} · {clock.utc(update.at)}</span>):<div>{clock.utc(update.at)} · {update.kind==='expiry'?'Evidence expired':update.kind==='schedule'?'Freshness updated':'Data corrected'}</div>}</div>
    {update.standalone.length>0&&<dl className="r1-ray-standalone" aria-label={`${currency} standalone release points`}>{update.standalone.map(a=><div key={`${a.releaseId}/${a.family}`} title={a.explanation}><dt>{a.label} · {a.direction==='strengthening'?`${currency}-supportive`:a.direction==='weakening'?`${currency}-negative`:a.direction==='balanced'?'Unchanged / balanced':'Insufficient evidence'}</dt><dd className={a.direction==='insufficient'?'':color(a.net)}><b>{a.direction==='insufficient'?'—':points(a.net)}</b></dd></div>)}</dl>}
    <small>Overall change by family</small>
    <dl className="r1-ray-parts" aria-label={`${currency} change by family`}>
      {r1DisplayParts(update).map(part=><div key={part.family??part.label}><dt>{part.label}</dt><dd className={color(part.change)}>{points(part.change)}</dd></div>)}
      <div className="r1-ray-change-total"><dt>{currency} overall score change</dt><dd className={color(change)}><b>{points(change)}</b></dd></div>
    </dl>
  </div>
}
export function R1Reading({brokerId,now,cutoff,open,brokerOffsetSeconds,symbols}:{brokerId:string|null;now:number;cutoff:number|null;open:number|null;brokerOffsetSeconds:number;symbols?:Record<string,EventSymbol>}) {
  const history=useR1Timeline(brokerId,now),clock=useDisplayClock(),scope={brokerId,brokerOffsetSeconds}
  const at=cutoff===null?null:chartClockToUtc(cutoff,scope),from=open===null?null:chartClockToUtc(open*1000,scope)
  const point=history.result&&at!==null?r1TimelineAt(history.result,Math.min(at,now)):null
  if(!brokerId||history.error||history.loading||!point)return <p role="status">{!brokerId?'Select a connected broker with stored calendar history.':history.error??(history.loading?'Preparing R1 evidence history.':cutoff===null?'Move across the chart to inspect a candle.':'Evidence unavailable at this time.')}</p>
  const comparison=r1EvidenceComparison(point.EUR,point.USD)
  return <section aria-label="R1 currency evidence">
    <p className="raycaster-clock">{cutoff!==null?clock.chart(cutoff):''} · candle end</p>
    <div className="r1-ray-currencies">{(['EUR','USD'] as const).map(currency=>{
      const state=point[currency],update=state.update
      return <section key={currency} aria-label={`${currency} R1 evidence`}>
        <strong className={`r1-ray-direction ${state.direction==='strengthening'?color(1):state.direction==='weakening'?color(-1):''}`}>{direction(state,currency)}</strong>
        <small className="r1-ray-strength">{state.strength?`${state.strength[0].toUpperCase()+state.strength.slice(1)} evidence`:' '}</small>
        <div className="r1-ray-points"><span>Overall evidence points</span><b>{points(update?.before??state.net)} → {points(state.net)}</b></div>
        <p className={`r1-ray-change ${color(update?.change??0)}`}>Overall score change <b>{update?points(update.change):'—'}</b></p>
        <p className="r1-ray-totals">Supportive {points(state.supportive)} · Negative {points(state.negative)}</p>
      </section>
    })}</div>
    <div className="r1-ray-comparison" aria-label="EUR and USD comparison">
      <strong>{comparison.unavailable?'Currency comparison unavailable':comparison.leader?`${comparison.leader} leads ${comparison.leader==='USD'?'EUR':'USD'} by: ${points(Math.abs(comparison.gap)).replace('+','')} points`:'EUR and USD tied · 0.00 points'}</strong>
      <small>{comparison.unavailable?'Select evidence for both currencies.':comparison.uncertain?comparison.leader?'Missing evidence could change this lead.':'Missing evidence could break this tie.':' '}</small>
    </div>
    <div aria-label="R1 evidence updates">{(['EUR','USD'] as const).map(currency=>{
      const updates=history.result&&from!==null&&at!==null?r1CandleUpdates(history.result,from,Math.min(at,now),currency):[]
      const shown=updates.length?updates:point[currency].update?[point[currency].update!]:[]
      return <div className="r1-ray-update-group" key={currency} aria-label={`${currency} evidence updates`}>{shown.length?shown.map(update=><Update key={update.at} update={update} currency={currency} symbols={symbols}/>):<p>No {currency} update at this time.</p>}</div>
    })}</div>
    {history.partial&&<small>Partial stored history</small>}
  </section>
}
