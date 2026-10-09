import { useState } from 'react'
import type { ComboSnapshot, RelationshipFamily } from '../../../scoring-system/relationships/contracts'
import { relationshipFamilies, relationshipName, relationshipPairs } from '../../../scoring-system/relationships/relationship-registry'
import { relationshipAvailability, relationshipResultLabel, relationshipSupport, type RelationshipMode } from '../../../scoring-system/relationships/relationship-support'
import { RelationshipSupport } from './RelationshipSupport'

export function RelationshipCatalogue({ combo }: { combo: ComboSnapshot }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<RelationshipMode>('release')
  const [selected, setSelected] = useState<RelationshipFamily[]>([...new Set(combo.sources.map(s => s.family))])
  const support = relationshipSupport(combo, selected, mode)
  const fed = selected.includes('fed') ? combo.catalogue?.fed : null
  return <section className="combo-card" aria-label="USD relationship catalogue">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>USD relationship catalogue · 36 pairs + larger groups</button>
    {open && <>
      <p>Compare any selection at this activation time. These annotations reuse source evidence and add no Raycaster vote. Missing weights stay missing.</p>
      <small>This is a group preview. Raycaster's price-reaction controls record the original selected Roof, not this group preview.</small>
      <label>Interpretation <select aria-label="Relationship interpretation" value={mode} onChange={e => setMode(e.target.value as RelationshipMode)}>
        <option value="release">Standalone support at activation</option><option value="fresh">Comparable support changes · seven days</option></select></label>
      <fieldset className="relationship-families"><legend>Compose a group · select two or more families</legend>
        {relationshipFamilies.map(f => <label key={f}><input type="checkbox" checked={selected.includes(f)}
          onChange={e => setSelected(e.target.checked ? [...selected, f] : selected.filter(x => x !== f))} /> {relationshipName(f)}</label>)}
      </fieldset>
      {selected.length < 2 ? <p>Select at least two families to inspect a relationship.</p> : <>
        <strong className={`combo-bias ${support.direction ?? ''}`}>{relationshipResultLabel(combo, selected, mode)}</strong>
        <RelationshipSupport support={support} />
        {selected.includes('fed') && <p>Fed: {fed?.policyAction?.action ?? 'Unavailable'}{fed?.policyAction?.delta != null && ` · ${fed.policyAction.delta} bp`}.
          {' '}The support split covers macro inputs only. No overall numeric winner between rate action and macro support is asserted; a hold adds no direction.</p>}
      </>}
      <table><thead><tr><th>Selected input</th><th>Eligibility at activation</th></tr></thead><tbody>
        {selected.map(f => <tr key={f}><td>{relationshipName(f)}</td><td>{relationshipAvailability(combo, f, mode)}</td></tr>)}
      </tbody></table>
      <details><summary>All 36 registered pairs</summary><table><thead><tr><th>Relationship</th><th>Result at activation</th><th>Availability</th></tr></thead><tbody>
        {relationshipPairs.map(pair => <tr key={pair.id}><td><button type="button" onClick={() => setSelected([...pair.families])}>{pair.label}</button><small>{pair.group}</small></td>
          <td>{relationshipResultLabel(combo, pair.families, mode)}</td><td>{pair.families.map(f => `${relationshipName(f)}: ${relationshipAvailability(combo, f, mode)}`).join('; ')}</td></tr>)}
      </tbody></table></details>
    </>}
  </section>
}
