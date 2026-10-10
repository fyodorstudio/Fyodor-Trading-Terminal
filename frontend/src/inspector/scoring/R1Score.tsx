import {useState} from 'react'
import type { InspectorScoringProps } from './scoring-contracts'
import type { R1Balance } from '../../scoring-system/r1/contracts'
import { useR1Analysis } from '../../scoring-system/r1/useR1Analysis'
import {useDisplayClock} from '../../appearance/time-display/useDisplayClock'
import {r1Profiles} from '../../scoring-system/r1/profiles'
import {usesFractionalMagnitude} from '../../scoring-system/r1/arithmetic'
import {r1DirectionLabel} from '../../scoring-system/r1/presentation'
import './r1-score.css'
const number=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2,signDisplay:'exceptZero'})
const detailChoices={release:'Release inputs',relationships:'Overall relationships',freshness:'Freshness',audit:'Input audit'}
type Detail=keyof typeof detailChoices
export const r1DetailsKey='fyodor.scoring.r1.details'
function initialDetail():Detail {try{const saved=window.localStorage.getItem(r1DetailsKey);if(saved&&Object.hasOwn(detailChoices,saved))return saved as Detail}catch{/* Use Release inputs. */}return 'release'}
function reportAge(published:number|null|undefined,at:number) {
  if(published==null||published>at)return '—'
  const days=Math.floor((at-published)/86400000)
  return `${days} ${days===1?'day':'days'}`
}
function Totals({value,multiplier=1,currency='USD'}:{value:R1Balance;multiplier?:number;currency?:string}) {
  return <><span>{currency}-supportive <b>{number(value.supportive*multiplier)}</b></span><span>{currency}-negative <b>{number(value.negative*multiplier)}</b></span><span>Net <b>{number(value.net*multiplier)}</b></span></>
}
function Change({value}:{value:number}) {
  return <span className={`r1-change ${value>0?'r1-change-positive':value<0?'r1-change-negative':''}`}>Change <b>{number(value)}</b></span>
}
export function R1Score(props:InspectorScoringProps) {
  const {result,loading,error,storage}=useR1Analysis(props)
  const clock=useDisplayClock(),[detail,setDetail]=useState(initialDetail),[assessmentFamily,setAssessmentFamily]=useState('')
  if(loading||storage.loading)return <p role="status">Calculating currency evidence…</p>
  if(error)return <p role="alert">{error}</p>
  if(!result)return null
  const {overall:o,transition:t,otherCurrency}=result
  const a=result.assessments?.find(a=>a.family===assessmentFamily)??result.assessment
  const currency=props.release?.currency??'USD'
  const rate=a.readings.find(r=>r.period==='action'),held=rate?.delta===0
  const action=rate&&rate.actual!==null&&rate.delta!==null?`Rate ${held?'held at':rate.delta>0?'increased to':'reduced to'} ${rate.actual}%.`:null
  const stable=o.direction===t.before.direction&&(o.direction==='weakening'||o.direction==='strengthening')
  const explanation=stable?t.change===0?`${o.direction==='weakening'?'Negative':'Positive'} ${currency} evidence is unchanged.`:`${currency} evidence remains ${o.direction==='weakening'?'negative':'positive'}, but ${Math.abs(o.net)<Math.abs(t.before.net)?'less':'more'} ${o.direction==='weakening'?'negative':'positive'}.`:o.explanation
  return <section className="r1-score" aria-label={`${currency} R1 scoring`}>
    <header className="r1-summary" aria-label="Publication summary">
      <section className="r1-summary-block" aria-label="Standalone summary">
        <h3>Standalone · {a.label}</h3>
        <div className={`r1-result r1-${a.direction}`}><strong>{action??r1DirectionLabel(a,currency)}</strong>{a.strength&&<b className="r1-strength">Evidence: {a.strength[0].toUpperCase()+a.strength.slice(1)}</b>}
          <span className="r1-points">Release points: <b>{number(a.net*4)}</b></span>
        </div>
        <div className="r1-evidence"><Totals value={a} multiplier={4} currency={currency}/><p className="r1-explanation">{held?'A hold alone does not establish currency strength or weakness.':a.explanation}</p></div>
        {a.unavailable>0&&<p className="r1-notes">Possible release net: {number(a.interval[0]*4)} to {number(a.interval[1]*4)}.</p>}
      </section>
      <section className="r1-summary-block" aria-label="Combined relationship summary">
      <h3>Combined relationships</h3>
      <div className={`r1-result r1-${o.direction}`}><strong>Overall {r1DirectionLabel(o,currency)}</strong>{o.strength&&<b className="r1-strength">Evidence: {o.strength[0].toUpperCase()+o.strength.slice(1)}</b>}
        <span className="r1-points">Evidence points: <b>{number(t.before.net)} → {number(o.net)}</b></span><Change value={t.change}/>
      </div>
      <div className="r1-evidence"><Totals value={o} currency={currency}/><p className="r1-explanation">{explanation}</p></div>
      {t.publications.length>1&&<p className="r1-notes">Combined update: {t.publications.join(', ')}.</p>}
      {(o.coverage<1||t.before.coverage<1)&&<p className="r1-notes">Partial coverage · possible net {number(o.interval[0])} to {number(o.interval[1])}.</p>}
      {o.sensitive&&<p className="r1-notes">Direction sensitive to weights or boundaries.</p>}
      </section>
      {otherCurrency&&<section className="r1-summary-block" aria-label={`${currency==='USD'?'EUR':'USD'} combined relationship summary`}>
        <h3>{currency==='USD'?'EUR':'USD'} combined relationships</h3>
        <div className={`r1-result r1-${otherCurrency.overall.direction}`}><strong>Overall {r1DirectionLabel(otherCurrency.overall,currency==='USD'?'EUR':'USD')}</strong>{otherCurrency.overall.strength&&<b className="r1-strength">Evidence: {otherCurrency.overall.strength[0].toUpperCase()+otherCurrency.overall.strength.slice(1)}</b>}
          <span className="r1-points">Evidence points: <b>{number(otherCurrency.transition.before.net)} → {number(otherCurrency.overall.net)}</b></span><Change value={otherCurrency.transition.change}/>
        </div>
        <div className="r1-evidence"><Totals value={otherCurrency.overall} currency={currency==='USD'?'EUR':'USD'}/><p className="r1-explanation">{otherCurrency.overall.explanation}</p></div>
        {otherCurrency.overall.coverage<1&&<p className="r1-notes">Known evidence: {Math.round(otherCurrency.overall.coverage*100)}%.</p>}
      </section>}
    </header>
    <label className="r1-details-choice">Details <select aria-label="Scoring details" value={detail} onChange={e=>{const next=e.target.value as Detail;setDetail(next);try{window.localStorage.setItem(r1DetailsKey,next)}catch{/* Keep session choice. */}}}>{Object.entries(detailChoices).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    {detail==='release'&&<section aria-label="Release evidence">{result.assessments&&<label className="r1-details-choice">Assessment <select aria-label="Release assessment" value={a.family} onChange={e=>setAssessmentFamily(e.target.value)}>{result.assessments.map(a=><option key={a.family} value={a.family}>{a.label}</option>)}</select></label>}<table><thead><tr><th>Input</th><th>Weight</th><th>Actual</th><th>Previous</th><th>A−P</th><th>Magnitude</th><th>Evidence</th></tr></thead><tbody>{a.readings.map(r=><tr key={r.id}><td>{r.label}</td><td>{r.weight}%</td><td>{r.actual===null?'Unavailable':number(r.actual)}</td><td>{r.previous===null?'Unavailable':number(r.previous)}</td><td>{r.delta===null?'Unavailable':`${number(r.delta)} ${r.unit}`}</td><td>{r.magnitude===null?'Unavailable':['Unchanged','Small','Medium','Large','Extreme'][r.magnitude]??`${r.magnitude} points`}{usesFractionalMagnitude(a.family)&&r.points!==null&&<> · {number(Math.abs(r.points)).replace(/^\+/,'')} pts</>}</td><td>{r.contribution===null?'Unavailable':number(r.contribution)}</td></tr>)}</tbody></table>
      <div className="r1-evidence"><Totals value={a} multiplier={4} currency={currency}/><p className="r1-explanation">{held?'A hold alone does not establish currency strength or weakness.':a.explanation}</p></div><p>{a.version}{a.stage==='revision'?' · same-quarter revision':''}</p>
      {a.unavailable>0&&<p>Possible release net: {number(a.interval[0]*4)} to {number(a.interval[1]*4)}.</p>}
    </section>}
    {detail==='relationships'&&<section className="r1-relationships" aria-label={`${currency} evidence as of this publication`}>
      <table><thead><tr><th>Evidence</th><th>Overall weight</th><th>Direction</th><th>Supportive</th><th>Negative</th></tr></thead><tbody>{o.categories.map(c=><tr key={c.category}><td>{c.label}</td><td>{c.share==null?'—':`${(c.share*100).toLocaleString(undefined,{maximumFractionDigits:3})}%`}</td><td>{r1DirectionLabel(c,currency)}</td><td>{number(c.supportive)}</td><td>{number(c.negative)}</td></tr>)}</tbody></table>
    </section>}
    {detail==='audit'&&<section className="r1-audit" aria-label="Input audit"><h4>Input audit</h4>{a.readings.map(r=><p key={r.id}>{r.label}: {r.reason||r.basis} · {r.vintage?.replaceAll('-',' ')??'unavailable'}{r.knownAt?` (captured ${new Date(r.knownAt).toISOString()})`:''} · {r.calibration}{r.limits?` · boundaries ${r.limits.join(' / ')} ${r.unit}`:''}</p>)}
      <p>Before: {clock.utc(t.before.at)}. After: {clock.utc(o.at)} ({clock.zone}).</p><p>Known input coverage: {Math.round(t.before.coverage*100)}% → {Math.round(o.coverage*100)}%. Before possible net: {number(t.before.interval[0])} to {number(t.before.interval[1])}.</p>
      {t.publications.length>0&&<p>Publications: {t.publications.join(', ')}.</p>}{t.corrections.length>0&&<p>Corrections: {t.corrections.join(', ')}.</p>}{t.expiries.length>0&&<p>Expired inputs: {t.expiries.join(', ')}.</p>}
      {o.timingSensitive&&<p>Direction changes under the tested expiry windows.</p>}
    </section>}
    {detail==='freshness'&&<section className="r1-audit" aria-label="Relationship audit"><p>Freshness at {clock.utc(o.at)} ({clock.zone}).</p>
      <table aria-label="Relationship freshness"><thead><tr><th>Family</th><th>Age at selected time</th><th>Fallback limit</th><th>Applied rule</th><th>Published</th><th>Next release</th><th>Expires</th><th>Status</th></tr></thead><tbody>{o.slots.map(s=><tr key={s.family} data-family={s.family}>
        <td>{r1Profiles[s.family].label}{s.assessment?.readings.some(r=>r.vintage==='corrected')?' · corrected snapshot':''}</td><td>{reportAge(s.assessment?.publishedAt,o.at)}</td><td>{s.fallbackDays} {s.fallbackDays===1?'day':'days'}</td>
        <td>{s.method==='scheduled'?`Scheduled: next release + ${s.graceHours} hours`:s.method==='age-based'?`Age-based: ${s.fallbackDays} days from publication`:'No report available'}</td>
        <td>{s.assessment?.publishedAt!=null?<time dateTime={new Date(s.assessment.publishedAt).toISOString()}>{clock.utc(s.assessment.publishedAt)}</time>:'—'}</td>
        <td>{s.nextDue!=null?<time dateTime={new Date(s.nextDue).toISOString()}>{clock.utc(s.nextDue)}</time>:s.method==='age-based'?'Schedule unavailable':'—'}</td>
        <td>{s.expiresAt!=null?<time dateTime={new Date(s.expiresAt).toISOString()}>{clock.utc(s.expiresAt)}</time>:'—'}</td><td>{s.status==='current'?'Current':s.status==='stale'?'Expired':'Unavailable'}</td>
      </tr>)}</tbody></table>
    </section>}
    {storage.error&&<p role="alert">History unavailable: {storage.error}</p>}
  </section>
}
