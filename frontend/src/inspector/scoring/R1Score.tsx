import type { InspectorScoringProps } from './scoring-contracts'
import type { R1Balance } from '../../scoring-system/r1/contracts'
import { useR1Analysis } from '../../scoring-system/r1/useR1Analysis'
import {useDisplayClock} from '../../appearance/time-display/useDisplayClock'
import {r1Profiles} from '../../scoring-system/r1/profiles'
import './r1-score.css'
const number=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2,signDisplay:'exceptZero'})
function reportAge(published:number|null|undefined,at:number) {
  if(published==null||published>at)return '—'
  const days=Math.floor((at-published)/86400000)
  return `${days} ${days===1?'day':'days'}`
}
function r1DirectionLabel(b:R1Balance){return b.direction==='strengthening'?'USD Strengthening':b.direction==='weakening'?'USD Weakening':b.direction==='balanced'?'Balanced evidence':b.direction==='empty'?'No evidence selected':'Insufficient evidence'}
function Result({value,multiplier=1,explanation}:{value:R1Balance;multiplier?:number;explanation:string}) {
  return <><div className={`r1-result r1-${value.direction}`}><strong>{r1DirectionLabel(value)}</strong>{value.strength&&<span className="r1-strength"><span>EVIDENCE</span><b>{value.strength.toUpperCase()}</b></span>}</div>
    <div className="r1-evidence"><span>USD-supportive <b>{number(value.supportive*multiplier)}</b></span><span>USD-negative <b>{number(value.negative*multiplier)}</b></span><span>Net <b>{number(value.net*multiplier)}</b></span><p className="r1-explanation">{explanation}</p></div>
    {value.strength&&(value.sensitive||value.coverage<1)&&<p className="r1-notes">{[value.sensitive?'Direction sensitive to weighting':null,value.coverage<1?'Partial coverage':null].filter(Boolean).join(' · ')}</p>}</>
}
export function R1Score(props:InspectorScoringProps&{selectedFamilies?:readonly string[]}) {
  const {result,loading,error,storage}=useR1Analysis(props)
  const clock=useDisplayClock()
  if(loading||storage.loading)return <p role="status">Calculating USD evidence…</p>
  if(error)return <p role="alert">{error}</p>
  if(!result)return null
  const {assessment:a,overall:o}=result
  return <section className="r1-score" aria-label="USD R1 scoring">
    <Result value={a} multiplier={4} explanation={a.explanation}/>
    <section aria-label="Release evidence"><table><thead><tr><th>Input</th><th>Weight</th><th>Actual</th><th>Previous</th><th>A−P</th><th>Magnitude</th><th>Evidence</th></tr></thead><tbody>{a.readings.map(r=><tr key={r.id}><td>{r.label}</td><td>{r.weight}%</td><td>{r.actual===null?'Unavailable':number(r.actual)}</td><td>{r.previous===null?'Unavailable':number(r.previous)}</td><td>{r.delta===null?'Unavailable':`${number(r.delta)} ${r.unit}`}</td><td>{r.magnitude===null?'Unavailable':['Unchanged','Small','Medium','Large','Extreme'][r.magnitude]??`${r.magnitude} points`}</td><td>{r.contribution===null?'Unavailable':number(r.contribution)}</td></tr>)}</tbody></table>
      <p>{a.version}{a.stage==='revision'?' · same-quarter revision':''}</p>
      {a.unavailable>0&&<p>Possible net: {number(a.interval[0]*4)} to {number(a.interval[1]*4)}.</p>}
    </section>
    <section className="r1-audit" aria-label="Input audit"><h4>Input audit</h4>{a.readings.map(r=><p key={r.id}>{r.label}: {r.reason||r.basis} · {r.vintage?.replaceAll('-',' ')??'unavailable'}{r.knownAt?` (captured ${new Date(r.knownAt).toISOString()})`:''} · {r.calibration}{r.limits?` · boundaries ${r.limits.join(' / ')} ${r.unit}`:''}</p>)}</section>
    <section className="r1-relationships" aria-label="USD evidence as of this publication"><h3>USD evidence as of this publication</h3><Result value={o} explanation={o.explanation}/>
      <table><thead><tr><th>Evidence</th><th>Direction</th><th>Supportive</th><th>Negative</th></tr></thead><tbody>{o.categories.map(c=><tr key={c.category}><td>{c.label}</td><td>{r1DirectionLabel(c)}</td><td>{number(c.supportive)}</td><td>{number(c.negative)}</td></tr>)}</tbody></table>
    </section>
    <section className="r1-audit" aria-label="Relationship audit"><h4>Relationship audit</h4><p>Known input coverage: {Math.round(o.coverage*100)}%. Possible net: {number(o.interval[0])} to {number(o.interval[1])}.</p>
        {o.timingSensitive&&<p>Direction changes under the tested expiry windows.</p>}
        <p>Freshness at {clock.utc(o.at)} ({clock.zone}).</p>
        <table aria-label="Relationship freshness"><thead><tr><th>Family</th><th>Age at selected time</th><th>Fallback limit</th><th>Applied rule</th><th>Published</th><th>Next release</th><th>Expires</th><th>Status</th></tr></thead><tbody>{o.slots.map(s=><tr key={s.family} data-family={s.family}>
          <td>{r1Profiles[s.family].label}{s.assessment?.readings.some(r=>r.vintage==='corrected')?' · corrected snapshot':''}</td>
          <td>{reportAge(s.assessment?.publishedAt,o.at)}</td>
          <td>{s.fallbackDays} {s.fallbackDays===1?'day':'days'}</td>
          <td>{s.method==='scheduled'?`Scheduled: next release + ${s.graceHours} hours`:s.method==='age-based'?`Age-based: ${s.fallbackDays} days from publication`:'No report available'}</td>
          <td>{s.assessment?.publishedAt!=null?<time dateTime={new Date(s.assessment.publishedAt).toISOString()}>{clock.utc(s.assessment.publishedAt)}</time>:'—'}</td>
          <td>{s.nextDue!=null?<time dateTime={new Date(s.nextDue).toISOString()}>{clock.utc(s.nextDue)}</time>:s.method==='age-based'?'Schedule unavailable':'—'}</td>
          <td>{s.expiresAt!=null?<time dateTime={new Date(s.expiresAt).toISOString()}>{clock.utc(s.expiresAt)}</time>:'—'}</td>
          <td>{s.status==='current'?'Current':s.status==='stale'?'Expired':'Unavailable'}</td>
        </tr>)}</tbody></table>
    </section>
    {storage.error&&<p role="alert">History unavailable: {storage.error}</p>}
  </section>
}
