import type { ReactNode } from 'react'
import { inspectorCategories, inspectorFamilies } from '../catalog/inspector-families'
import { inspectorFilterRows } from './inspector-filter-rows'

export type FamilyFilterRow = typeof inspectorFilterRows[number]
// Shared selection controls; consumers own their separate saved preferences.
export function FamilyFilterGroups({ currency, selected, matches, toggle, column = 0, renderControl }: {
  currency: string; selected: readonly string[]; matches: readonly FamilyFilterRow[]
  toggle: (ids: string[], checked: boolean) => void; column?: number; renderControl?: (family: FamilyFilterRow) => ReactNode
}) {
  return inspectorCategories.map((category, row) => {
    const ids = inspectorFamilies.filter(f => f.currency === currency && f.category === category.id).map(f => f.id)
    const visible = matches.filter(f => f.currency === currency && f.category === category.id)
    if (!visible.length) return null
    const checked = ids.every(id => selected.includes(id))
    return <fieldset key={category.id} style={{ gridColumn: column + 1, gridRow: row + 2 }}>
      <legend><label><input type="checkbox" checked={checked} aria-label={`${currency} ${category.label}`}
        ref={input => { if (input) input.indeterminate = !checked && ids.some(id => selected.includes(id)) }}
        onChange={event => toggle(ids, event.target.checked)} />{category.label}</label></legend>
      {visible.map(family => <div className="inspector-family" key={family.id}>
        <label><input type="checkbox" checked={family.ids.every(id => selected.includes(id))} aria-label={family.label}
          ref={input => { if (input) input.indeterminate = family.ids.some(id => selected.includes(id)) && !family.ids.every(id => selected.includes(id)) }}
          onChange={event => toggle(family.ids, event.target.checked)} />{family.label}</label>
        {renderControl?.(family)}
      </div>)}
    </fieldset>
  })
}
