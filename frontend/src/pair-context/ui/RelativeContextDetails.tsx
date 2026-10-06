import './relative-context.css'
import type { EurContextPoint } from '../core/contracts'
import { relativeContext } from '../core/relative-context'
import type { ContextPoint } from '../../usd-context/core/contracts'
import { eurPolicies } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-policies'
import { useRelativePreferences, saveRelativePreferences, toggleEurFamily } from '../storage/relative-preferences'
export function RelativeContextDetails({eur,usd,loading,supported}:{eur:EurContextPoint|null;usd:ContextPoint|null;loading:boolean;supported:boolean}){
  const preferences=useRelativePreferences(), result=relativeContext(eur,usd)
  return <section aria-label="Relative EURUSD calculation">
    <label>Context view <select aria-label="Raycaster context view" value={supported?preferences.mode:'usd'} disabled={!supported}
      onChange={e=>saveRelativePreferences({...preferences,mode:e.target.value as 'usd'|'relative'})}>
      <option value="usd">USD side</option><option value="relative">EUR vs USD</option></select></label>
    {supported && preferences.mode==='relative' && <>
      <p>EUR and USD each have a 100% budget: inflation 40%, labor / wages 40%, activity 20%. Each leg is normalized by the maximum magnitude of 4. EUR pressure minus USD pressure gives the pair direction; missing weights stay missing.</p>
      <table className="relative-context-inputs" aria-label="EUR relative context inputs"><thead><tr><th>EUR input</th><th>Use</th><th>Contribution</th></tr></thead><tbody>
        {eurPolicies.map(policy=><tr key={policy.family}><td>{policy.label}</td><td><button type="button" aria-label={`Use ${policy.label}`} aria-pressed={preferences.families.includes(policy.family)} onClick={()=>toggleEurFamily(policy.family)}>{preferences.families.includes(policy.family)?'Enabled':'Off'}</button></td>
          <td>{loading?'Calculating…':eur?.members.filter(m=>m.family===policy.family).map(m=>`${m.slot}: ${m.contribution.toFixed(3)} (${m.status}${m.provisional?', country proxy':''}; ${m.weight}%, ${(m.retention*100).toFixed(0)}% retention)`).join('; ') || 'No active aggregate / proxy contribution'}</td></tr>)}
      </tbody><tfoot><tr><td colSpan={3}>{loading?'Calculating relative context…':`${result.label} · EUR ${result.eurTotal?.toFixed(3)??'—'} − USD ${result.usdTotal?.toFixed(3)??'—'} = ${result.total?.toFixed(3)??'—'}`}</td></tr></tfoot></table>
      <p>Euro-area inflation replaces Germany for the same reference month. Germany alone carries at most 40% of the inflation slot. Euro-area composite PMI replaces overlapping German / French proxies; country PMI shares are 60% / 40% of the 15% activity slot. Final readings update flash readings without extra votes.</p>
      <p>Monthly slots halve after 30 days and expire after 60; quarterly employment, wages and GDP halve after 90 days and expire after 150. Latest unavailable readings replace earlier votes. ECB text and holds add no vote. Relative evidence is capped at Moderate in this first version and is not a price probability.</p>
    </>}
    {!supported && <p>Relative EUR / USD context is available on EURUSD only. This pair keeps its USD-side interpretation.</p>}
  </section>
}
