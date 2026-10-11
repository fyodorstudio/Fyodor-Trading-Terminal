import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { inspectorCategories, inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { inspectorFilterRows } from '../../inspector/filters/inspector-filter-rows'
import { FamilyFilterGroups } from '../../inspector/filters/FamilyFilterGroups'
import { alertCurrencies, type AlertPreferences } from '../model/alert-preferences'
import '../../inspector/inspector.css'

export function AlertFiltersModal({ preferences, onSave, onClose }: {
  preferences: AlertPreferences; onSave: (preferences: AlertPreferences) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(preferences)
  const [currency, setCurrency] = useState(preferences.currency === 'all' ? 'USD' : preferences.currency)
  const [search, setSearch] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null
    dialog.current?.show()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('keydown', escape); focus?.focus() }
  }, [onClose])
  const ids = inspectorFamilies.filter(f => f.currency === currency).map(f => f.id)
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matches = inspectorFilterRows.filter(f => f.currency === currency && terms.every(term =>
    `${f.label} ${inspectorCategories.find(c => c.id === f.category)?.label} ${f.currency} ${f.ids.join(' ')}`.toLocaleLowerCase().includes(term)))
  function toggle(ids: string[], checked: boolean) {
    setDraft(current => ({ ...current, families: checked ? [...new Set([...current.families, ...ids])] : current.families.filter(id => !ids.includes(id)) }))
  }
  return createPortal(<dialog ref={dialog} className="inspector-modal alert-filter-modal" aria-labelledby="alert-filter-title">
    <div className="inspector-modal-content">
      <header><h2 id="alert-filter-title">Alert filters</h2><button type="button" aria-label="Close Alert filters" onClick={onClose}>×</button></header>
      <nav className="alert-currencies" aria-label="Filter currency">{alertCurrencies.map(code => <button type="button" key={code}
        aria-pressed={currency === code} onClick={() => setCurrency(code)}>{code}</button>)}</nav>
      <div className="inspector-filter-tools"><label className="inspector-select-all"><input type="checkbox" aria-label={`Select all ${currency}`}
        checked={ids.every(id => draft.families.includes(id))}
        ref={input => { if (input) input.indeterminate = ids.some(id => draft.families.includes(id)) && !ids.every(id => draft.families.includes(id)) }}
        onChange={event => toggle(ids, event.target.checked)} />Select all {currency}</label>
        <input type="search" aria-label="Search Alert families" placeholder="Search families…" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className="inspector-filter-columns alert-filter-groups"><FamilyFilterGroups currency={currency} selected={draft.families} matches={matches} toggle={toggle} /></div>
      {!matches.length && <p role="status">No matching families.</p>}
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="inspector-primary" onClick={() => { onSave(draft); onClose() }}>Save</button></footer>
    </div>
  </dialog>, document.body)
}
