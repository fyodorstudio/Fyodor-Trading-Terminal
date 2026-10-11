import {useMemo} from 'react'
import type {R1Family,R1MagnitudeSnapshot,R1Settings} from '../../scoring-system/r1/contracts'
import {fedPolicyGroupAudit,fedPolicyInputAudit,r1AllocationAudit} from '../../scoring-system/r1/policy-arithmetic-audit'
import {policyContextShare,policyContextVersion} from '../../scoring-system/r1/policy-context'
import {preferredShares} from '../../scoring-system/r1/relationships'
import {r1Families,r1Profiles} from '../../scoring-system/r1/profiles'
import {useR1Bands} from '../../scoring-system/r1/settings'

const number=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:6})
const categoryLabel={inflation:'Inflation',labor:'Labor',activity:'Activity',policy:'Fed action + policy context'}
function bands(family:R1Family,component:string,settings:R1Settings,saved:R1MagnitudeSnapshot) {
  const input=r1Profiles[family].components.find(c=>c.id===component)!
  const manual=settings.calibration.limits[`${family}/${component}`]
  if(manual)return `R1 manual: ${manual.map(number).join(' / ')} ${input.unit}`
  const raw=saved[family]?.[input.seriesId]
  return raw?`Saved A−P: ${raw.map(value=>number(value*(input.scale??1))).join(' / ')} ${input.unit}`:settings.calibration.mode==='automatic'?'Earlier history at the selected date':'Undefined'
}
export function R1PolicyArithmetic({settings,fed}:{settings:R1Settings;fed:boolean}) {
  const saved=useR1Bands()
  const allocation=useMemo(()=>r1AllocationAudit(settings.selected),[settings.selected])
  return <section aria-label="USD R1 arithmetic audit">
    <h4>Relationship arithmetic · selected inputs</h4>
    <p>Base family shares: Consumer anchor uses the newest CPI/PCE reference month; PCE wins a tie. Matching-month PPI receives {number(preferredShares.ppi*100)}%. Jobs / Claims: {number(preferredShares.jobs*100)}% / {number((1-preferredShares.jobs)*100)}%. Activity: GDP {number(preferredShares.gdp*100)}%, Retail / Services {number((1-preferredShares.gdp)*40)}% each, Manufacturing {number((1-preferredShares.gdp)*20)}%.</p>
    <table aria-label="USD R1 allocation audit"><thead><tr><th>Category</th><th>Origin allocation</th><th>Retained</th><th>To policy context</th><th>Final allocation</th></tr></thead><tbody>{allocation.map(r=><tr key={r.category}><td>{categoryLabel[r.category]}</td><td>{number(r.base)}%</td><td>{number(r.retained)}%</td><td>{number(r.routed)}%</td><td>{number(r.effective)}%</td></tr>)}</tbody></table>
    <p>With Fed selected, {number(policyContextShare*100)}% of each macro allocation moves into policy context. Final allocations also route Manufacturing employment to Labor and prices to Inflation. Selected families share their category allowance; missing inputs keep their allowance.</p>
    {fed&&<section aria-label="Fed policy arithmetic audit">
      <h4>{policyContextVersion} · hold arithmetic</h4>
      <p>Policy pressure = Σ(input weight × signed magnitude points / 4). Hold points = (current pressure − previous decision’s pressure) / 2. Both use a −100 to +100 scale. The held rate contributes 0 points.</p>
      <table aria-label="Fed policy category weights"><thead><tr><th>Policy pressure category</th><th>Weight</th></tr></thead><tbody>{fedPolicyGroupAudit.map(r=><tr key={r.category}><td>{categoryLabel[r.category]}</td><td>{number(r.weight)}%</td></tr>)}</tbody></table>
      <table aria-label="Fed policy input weights"><thead><tr><th>Input</th><th>Weight in pressure</th><th>Comparison</th><th>Magnitude boundaries · Small / Medium / Large</th><th>Points</th></tr></thead><tbody>{fedPolicyInputAudit.map(r=><tr key={r.id}><td>{r.consumer?r.label.replace('PCE','CPI / PCE'):`${r1Profiles[r.family].label} · ${r.label}`}</td><td>{number(r.weight)}%</td><td>{r.basis}</td><td>{r.limits?`${r.limits.map(number).join(' / ')} ${r.unit} · fixed policy scale`:r.consumer?<>{['us-cpi','pce'].map(f=><div key={f}>{r1Profiles[f as R1Family].label}: {bands(f as R1Family,r.component,settings,saved)}</div>)}</>:bands(r.family,r.component,settings,saved)}</td><td>{r.fractional?'Fractional 0 / 1 / 2 / 4':'Bands 1 / 2 / 3 / 4'}</td></tr>)}</tbody></table>
      <p>Fractional points interpolate through zero → Small 1 → Medium 2 → Large 4. PPI retains its standalone band points. Extreme stays capped at 4. Lower unemployment and claims are supportive; higher readings are supportive for the other inputs.</p>
      <p>Fed standalone uses all {r1Families.length} USD families. These weights total 100% of inferred pressure; they are separate from the overall allocation above. Overall retains current pressure and adds no new rate-action points for a hold.</p>
      <p>Missing comparison inputs retain their maximum possible influence. A direction requires the entire possible range to be above or below zero. Strength uses the minimum supported net: Slight ≤ 10, Moderate ≤ 30, Strong &gt; 30.</p>
    </section>}
  </section>
}
