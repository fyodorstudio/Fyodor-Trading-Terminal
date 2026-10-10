import { useState } from 'react'
import { validMagnitudeLimits,type MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import { r1Families,r1Family,r1Profiles,r1CalibrationPolicy } from '../../scoring-system/r1/profiles'
import { saveR1Settings,useR1Settings } from '../../scoring-system/r1/settings'
import type { R1Component } from '../../scoring-system/r1/contracts'

export function R1ScoringSettings({family}:{family:string}) {
  const settings=useR1Settings(),profile=r1Profiles[r1Family(family)??'us-cpi']
  return <section aria-label="USD R1 settings"><h3>{profile.label} · {profile.version}</h3>
    <table><thead><tr><th>Input</th><th>Weight</th><th>USD-supportive change</th></tr></thead><tbody>{profile.components.map(c=><tr key={c.id}><td>{c.label}</td><td>{c.weight}%</td><td>{c.polarity===1?'Higher':'Lower'}</td></tr>)}</tbody></table>
    <h4>Magnitude</h4><label>Unconfigured inputs<select aria-label="R1 calibration mode" value={settings.calibration.mode} onChange={e=>saveR1Settings({...settings,calibration:{...settings.calibration,mode:e.target.value as 'automatic'|'undefined'}})}><option value="automatic">Calibrate from earlier history</option><option value="undefined">Leave undefined</option></select></label>
    {profile.family==='fomc'?<p>Each 25 bp step contributes one signed point, capped at four. A hold contributes zero.</p>:profile.components.flatMap(c=>[<R1LimitsEditor key={`${profile.family}/${c.id}/${JSON.stringify(settings.calibration.limits)}`} family={profile.family} component={c}/>,...(profile.family==='gdp'?[<R1LimitsEditor key={`revision/${JSON.stringify(settings.calibration.limits)}`} family={profile.family} component={c} revision/>]:[])])}
    <h4>Relationship inputs</h4><div className="scoring-settings-toolbar">{r1Families.map(f=><label key={f}><input type="checkbox" checked={settings.selected.includes(f)} onChange={e=>saveR1Settings({...settings,selected:e.target.checked?[...settings.selected,f]:settings.selected.filter(x=>x!==f)})}/>{r1Profiles[f].label}</label>)}</div>
    <details><summary>Method and source rationale</summary><p>Signed magnitude × input weight gives release evidence. Small / Medium / Large / Extreme receive 1 / 2 / 3 / 4. Relationships divide release evidence by four before allocating category budgets. Missing selected inputs retain their possible influence.</p>
      <p>R1 overrides take priority, followed by compatible saved raw A−P bands. Otherwise automatic boundaries use {r1CalibrationPolicy.quantiles.map(q=>`${q*100}%`).join(' / ')} of earlier nonzero absolute changes, requiring {r1CalibrationPolicy.minimum} earlier usable observations. GDP revisions have separate calibration.</p>
      <p>Inflation uses the newest consumer reference month, preferring PCE over CPI for the same month, with 10% reserved for matching-month PPI. Labor uses Jobs 80% / Claims 20%. Activity uses GDP 50% / Retail 20% / Services 20% / Manufacturing 10%. Overall uses Inflation 35% / Labor 30% / Activity 15% / Fed action 20%.</p>
      <p>Unchecked inputs are excluded. Inspector filters further restrict relationship scope. Current evidence expires 24 hours after its next verified scheduled release; an unverified schedule retains uncertainty.</p>
      <p>The exact shares, bands and thresholds are design policies. Sources support the economic roles: <a href="https://www.federalreserve.gov/faqs/economy_14419.htm" target="_blank" rel="noreferrer">Fed inflation target</a>, <a href="https://www.bls.gov/cpi/questions-and-answers.htm" target="_blank" rel="noreferrer">BLS CPI</a>, <a href="https://www.bea.gov/resources/learning-center/what-to-know-prices-inflation" target="_blank" rel="noreferrer">BEA inflation measures</a>, <a href="https://www.bls.gov/ppi/overview.htm" target="_blank" rel="noreferrer">BLS PPI</a>.</p>
    </details>
  </section>
}
function R1LimitsEditor({family,component,revision=false}:{family:string;component:R1Component;revision?:boolean}) {
  const settings=useR1Settings(),key=`${family}/${component.id}${revision?'/revision':''}`,saved=settings.calibration.limits[key]
  const [draft,setDraft]=useState(saved?.map(String)??['','','']),[error,setError]=useState('')
  const limits=draft.map(Number) as unknown as MagnitudeLimits,valid=draft.every(s=>s.trim())&&validMagnitudeLimits(limits)
  const apply=(value:MagnitudeLimits|null)=>{const next={...settings.calibration.limits};if(value)next[key]=value;else delete next[key];try{saveR1Settings({...settings,calibration:{...settings.calibration,limits:next}});setError('')}catch(e){setError(String(e))}}
  return <fieldset><legend>{component.label}{revision?' · revision':''} ({component.unit})</legend>{['Small','Medium','Large'].map((label,i)=><label key={label}>{label} ≤ <input type="number" min="0" step="any" aria-label={`${key} ${label}`} value={draft[i]} onChange={e=>setDraft(draft.map((x,j)=>j===i?e.target.value:x))}/></label>)}<button type="button" disabled={!valid} onClick={()=>apply(limits)}>Apply</button><button type="button" disabled={!saved} onClick={()=>apply(null)}>Use inherited calibration</button>{error&&<p role="alert">{error}</p>}</fieldset>
}
