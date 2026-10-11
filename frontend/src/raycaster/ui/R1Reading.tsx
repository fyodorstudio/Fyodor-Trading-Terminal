import { useR1Timeline } from '../../scoring-system/r1/useR1Timeline'
import { r1CandleUpdates, r1TimelineAt, type R1Update } from '../../scoring-system/r1/timeline'
import type { R1Currency } from '../../scoring-system/r1/contracts'
import { chartClockToUtc } from '../../appearance/time-display/chart-clock'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { r1EvidenceComparison, r1EvidencePoints as points, r1UpdateRows } from '../core/r1-evidence-presentation'
import { eventFamilyOptions } from '../../inspector/event-families'
import { symbolGlyph, type EventSymbol } from '../../inspector/event-symbols'
import {r1DirectionLabel} from '../../scoring-system/r1/presentation'
import {R1EvidenceTank} from './R1EvidenceTank'
const color=(value:number)=>value>0?'r1-ray-positive':value<0?'r1-ray-negative':''
function Update({update,currency,symbols}:{update:R1Update;currency:R1Currency;symbols?:Record<string,EventSymbol>}) {
  const clock=useDisplayClock(),change=update.change
  return <div className="r1-ray-update">
    <div className="r1-ray-update-clock"><b>{currency}</b> · {clock.utc(update.at)}{update.kind!=='publication'&&<> · {update.kind==='expiry'?'Evidence expired':update.kind==='schedule'?'Freshness updated':'Data corrected'}</>}</div>
    <table className="r1-ray-release-table" aria-label={`${currency} release points and overall changes`}>
      <thead><tr><th>Release</th><th>Points</th><th>Overall Δ</th></tr></thead>
      <tbody>{r1UpdateRows(update).map(row=>{
        const release=update.releases.find(r=>r.id===row.score?.releaseId),a=row.score
        const icon=release?symbolGlyph(symbols?.[release.family]??eventFamilyOptions.find(f=>f.id===release.family)?.symbol??'star'):null
        return <tr key={row.key}><td title={a?.explanation}>{icon&&`${icon} ${release?.country==='US'?'US':currency} · `}{row.label}
          {a?.unavailable? <small>{a.explanation==='MT5 Actual is unavailable.'?'MT5 Actual unavailable':'Incomplete evidence'}</small>:null}</td>
          <td className={a?color(a.net):''}>{a?(a.unavailable===100?'—':points(a.net)):'—'}</td><td className={color(row.change??0)}>{row.change===undefined?'—':points(row.change)}</td></tr>
      })}</tbody>
      <tfoot><tr><th colSpan={2}>{currency} overall score change</th><td className={color(change)}><b>{points(change)}</b></td></tr></tfoot>
    </table>
  </div>
}
export function R1Reading({brokerId,now,cutoff,open,brokerOffsetSeconds,symbols}:{brokerId:string|null;now:number;cutoff:number|null;open:number|null;brokerOffsetSeconds:number;symbols?:Record<string,EventSymbol>}) {
  const history=useR1Timeline(brokerId,now),clock=useDisplayClock(),scope={brokerId,brokerOffsetSeconds}
  const at=cutoff===null?null:chartClockToUtc(cutoff,scope),from=open===null?null:chartClockToUtc(open*1000,scope)
  const point=history.result&&at!==null?r1TimelineAt(history.result,Math.min(at,now)):null
  if(!brokerId||history.error||history.loading||!point)return <p role="status">{!brokerId?'Select a connected broker with stored calendar history.':history.error??(history.loading?'Preparing R1 evidence history.':cutoff===null?'Move across the chart to inspect a candle.':'Evidence unavailable at this time.')}</p>
  const comparison=r1EvidenceComparison(point.EUR,point.USD)
  return <section className="r1-ray-reading" aria-label="R1 currency evidence">
    <p className="raycaster-clock">{cutoff!==null?clock.chart(cutoff):''} · candle end</p>
    <div className="r1-ray-currencies">{(['EUR','USD'] as const).map(currency=>{
      const state=point[currency],update=state.update,label=r1DirectionLabel(state,currency)
      return <section key={currency} aria-label={`${currency} R1 evidence`}>
        <R1EvidenceTank state={state} currency={currency}/>
        <strong className={`r1-ray-direction ${color(state.net)}`}>{label.startsWith(currency)?label:`${currency} · ${label}`}</strong>
        <small className="r1-ray-strength" title={state.missing.join(', ')}>{state.unavailable>0?`Incomplete — ${state.missing.length===1?state.missing[0]:`${state.missing.length} inputs`} unavailable`:state.strength?`${state.strength[0].toUpperCase()+state.strength.slice(1)} evidence`:' '}</small>
        <div className="r1-ray-points"><b>{points(update?.before??state.net)} → {points(state.net)}</b></div>
        <p className={`r1-ray-change ${color(update?.change??0)}`}>Change <b>{update?points(update.change):'—'}</b></p>
        <p className="r1-ray-totals">Supportive {points(state.supportive)}<br/>Negative {points(state.negative)}</p>
      </section>
    })}</div>
    <div className="r1-ray-comparison" aria-label="EUR and USD comparison">
      <strong>{comparison.unavailable?'Currency comparison unavailable':comparison.leader?`${comparison.leader} leads ${comparison.leader==='USD'?'EUR':'USD'} by ${points(Math.abs(comparison.gap)).replace('+','')} evidence points`:'EUR and USD tied · 0.00 points'}</strong>
      <small>{comparison.unavailable?'Select evidence for both currencies.':comparison.uncertain?comparison.leader?'Missing evidence could change this lead.':'Missing evidence could break this tie.':' '}</small>
    </div>
    <div className="r1-ray-updates" aria-label="R1 evidence updates">{(['EUR','USD'] as const).map(currency=>{
      const updates=history.result&&from!==null&&at!==null?r1CandleUpdates(history.result,from,Math.min(at,now),currency):[]
      const shown=updates.length?updates:point[currency].update?[point[currency].update!]:[]
      return <div className="r1-ray-update-group" key={currency} aria-label={`${currency} evidence updates`}>{shown.length?shown.map(update=><Update key={update.at} update={update} currency={currency} symbols={symbols}/>):<p>No {currency} update at this time.</p>}</div>
    })}</div>
    {history.partial&&<small>Partial stored history</small>}
  </section>
}
